import { z } from "zod";

import { createTRPCRouter, permissionProcedure } from "~/server/api/trpc";
import { type Prisma } from "~/server/db";
import {
  estimatedInterest,
  invoiceBalance,
  invoiceBalanceInclude,
  openingBalanceInclude,
  openingBalanceRemaining,
} from "~/server/domain/billing";
import { dayToDate, todayInManagua, zDay, zId, zOptText, pageFields, zPositiveMoney, zRate, zText } from "~/server/domain/constants";
import { sum } from "~/server/domain/money";
import { inRankOrder, rankCustomers } from "~/server/domain/search";

/** Customers, motorcycles, opening balances and the account statement (API-014). */
const view = permissionProcedure("clientes.ver");
const manage = permissionProcedure("clientes.gestionar");

const zCustomer = z.object({
  name: zText(100),
  phone: zText(20),
  nationalId: zOptText(20),
  address: zOptText(200),
});
const zMotorcycle = z.object({
  motorcycleModelId: zId,
  color: zText(30),
  plate: zOptText(15),
  notes: zOptText(200),
});

export const customerRouter = createTRPCRouter({
  /** Search by name, phone or cédula (API-021); paged (API-022). */
  list: view
    .input(z.object({ search: z.string().trim().max(100).optional(), ...pageFields }).default({}))
    .query(async ({ ctx, input }) => {
      const include = { motorcycles: { include: { model: { include: { brand: true } } } } } as const;
      if (input.search) {
        const ranked = await rankCustomers(ctx.db, input.search, input.limit);
        const rows = await ctx.db.customer.findMany({ where: { id: { in: ranked.map((r) => r.id) } }, include });
        return { items: inRankOrder(ranked, rows), nextCursor: null };
      }
      const where: Prisma.CustomerWhereInput = {};
      const { cursor, limit } = input;
      const items = await ctx.db.customer.findMany({
        where,
        orderBy: { id: "asc" },
        include,
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      return {
        items: items.slice(0, limit).map((c) => ({ ...c, exact: true, score: 0 })),
        nextCursor: items.length > limit ? items[limit - 1]!.id : null,
      };
    }),

  get: view.input(z.object({ id: zId })).query(({ ctx, input }) =>
    ctx.db.customer.findUniqueOrThrow({
      where: { id: input.id },
      include: { motorcycles: { include: { model: { include: { brand: true } } } } },
    }),
  ),

  /** Motorcycle by plate (API-021). */
  motorcycleByPlate: view.input(z.object({ plate: zText(15) })).query(({ ctx, input }) =>
    ctx.db.motorcycle.findFirst({
      where: { plate: { equals: input.plate, mode: "insensitive" } },
      include: { customer: true, model: { include: { brand: true } } },
    }),
  ),

  create: manage
    .input(zCustomer.extend({ motorcycle: zMotorcycle.optional() }))
    .mutation(({ ctx, input }) => {
      const { motorcycle, ...data } = input;
      return ctx.db.customer.create({
        data: {
          ...data,
          nationalId: data.nationalId ?? null,
          address: data.address ?? null,
          motorcycles: motorcycle ? { create: [{ ...motorcycle, plate: motorcycle.plate ?? null }] } : undefined,
        },
        include: { motorcycles: true },
      });
    }),

  update: manage.input(zCustomer.extend({ id: zId })).mutation(({ ctx, input }) => {
    const { id, ...data } = input;
    return ctx.db.customer.update({
      where: { id },
      data: { ...data, nationalId: data.nationalId ?? null, address: data.address ?? null },
    });
  }),

  addMotorcycle: manage
    .input(zMotorcycle.extend({ customerId: zId }))
    .mutation(({ ctx, input }) => ctx.db.motorcycle.create({ data: { ...input, plate: input.plate ?? null } })),

  updateMotorcycle: manage
    .input(zMotorcycle.extend({ id: zId, customerId: zId }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.motorcycle.update({ where: { id }, data: { ...data, plate: data.plate ?? null } });
    }),

  /** Debt the customer had before the system existed (paper/phone notes). */
  addOpeningBalance: manage
    .input(
      z.object({
        customerId: zId,
        asOfDate: zDay,
        amount: zPositiveMoney,
        dueDate: zDay,
        monthlyInterest: zRate.default("0"),
        notes: zOptText(200),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.customerOpeningBalance.create({
        data: {
          customerId: input.customerId,
          asOfDate: dayToDate(input.asOfDate),
          amount: input.amount,
          dueDate: dayToDate(input.dueDate),
          monthlyInterest: input.monthlyInterest,
          notes: input.notes ?? null,
          registeredByUserId: ctx.user.id,
        },
      }),
    ),

  /**
   * Account statement (API-014): every invoice and opening balance with what was
   * paid/returned and what remains, plus overdue and estimated interest.
   */
  statement: view.input(z.object({ customerId: zId })).query(async ({ ctx, input }) => {
    const customer = await ctx.db.customer.findUniqueOrThrow({ where: { id: input.customerId } });
    const invoices = await ctx.db.saleInvoice.findMany({
      where: { customerId: input.customerId },
      include: invoiceBalanceInclude,
      orderBy: { createdAt: "desc" },
    });
    const openings = await ctx.db.customerOpeningBalance.findMany({
      where: { customerId: input.customerId },
      include: openingBalanceInclude,
      orderBy: { asOfDate: "desc" },
    });
    const today = todayInManagua();
    const invoiceRows = invoices.map((inv) => {
      const b = invoiceBalance(inv);
      const due = inv.extendedDueDate ?? inv.dueDate;
      return {
        kind: "FACTURA" as const,
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        createdAt: inv.createdAt,
        paymentTerms: inv.paymentTerms,
        dueDate: due,
        ...b,
        overdue: !!due && b.balance.gt(0) && due.toISOString().slice(0, 10) < today,
        interest: estimatedInterest(b.balance, inv.monthlyInterest, due),
      };
    });
    const openingRows = openings.map((ob) => {
      const balance = openingBalanceRemaining(ob);
      return {
        kind: "SALDO_INICIAL" as const,
        id: ob.id,
        asOfDate: ob.asOfDate,
        dueDate: ob.dueDate,
        amount: ob.amount,
        balance,
        overdue: balance.gt(0) && ob.dueDate.toISOString().slice(0, 10) < today,
        interest: estimatedInterest(balance, ob.monthlyInterest, ob.dueDate),
        notes: ob.notes,
      };
    });
    const total = sum([...invoiceRows.map((r) => r.balance), ...openingRows.map((r) => r.balance)]);
    const interest = sum([...invoiceRows.map((r) => r.interest), ...openingRows.map((r) => r.interest)]);
    return { customer, invoices: invoiceRows, openingBalances: openingRows, totalBalance: total, totalInterest: interest };
  }),
});
