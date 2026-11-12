import { z } from "zod";

import { createTRPCRouter, permissionProcedure } from "~/server/api/trpc";
import { customerInclude } from "~/server/domain/search";
import { customerInvoiceBalances, openingBalances } from "~/server/domain/balances";
import { estimatedInterest } from "~/server/domain/billing";
import { dayToDate, zDay, zId, zOptText, pageFields, zPhone, zPositiveMoney, zRate, zText } from "~/server/domain/constants";
import { sum } from "~/server/domain/money";

/** Customers, motorcycles, opening balances and the account statement (API-014). */
const view = permissionProcedure("clientes.ver");
const manage = permissionProcedure("clientes.gestionar");

const zCustomer = z.object({
  name: zText(100),
  phone: zPhone,
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
  /** Paged list to browse (API-022). Text search is `search.customers` (DEC-043). */
  list: view.input(z.object({ ...pageFields }).default({})).query(async ({ ctx, input }) => {
    const { cursor, limit } = input;
    const items = await ctx.db.customer.findMany({
      orderBy: { id: "asc" },
      include: customerInclude,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    return { items: items.slice(0, limit), nextCursor: items.length > limit ? items[limit - 1]!.id : null };
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
    // Balances come from the views (DEC-042); the rest of each row from its table.
    const balances = await customerInvoiceBalances(ctx.db, input.customerId);
    const invoices = new Map(
      (
        await ctx.db.saleInvoice.findMany({
          where: { customerId: input.customerId },
          select: { id: true, invoiceNumber: true, monthlyInterest: true },
        })
      ).map((i) => [i.id, i]),
    );
    const openingInfo = new Map(
      (
        await ctx.db.customerOpeningBalance.findMany({
          where: { customerId: input.customerId },
          select: { id: true, monthlyInterest: true, notes: true },
        })
      ).map((o) => [o.id, o]),
    );
    const invoiceRows = balances.map((b) => {
      const inv = invoices.get(b.saleInvoiceId)!;
      return {
        kind: "FACTURA" as const,
        id: b.saleInvoiceId,
        invoiceNumber: inv.invoiceNumber,
        createdAt: b.createdAt,
        paymentTerms: b.paymentTerms,
        dueDate: b.dueDate,
        total: b.total,
        returned: b.returned,
        paid: b.paid,
        balance: b.balance,
        overdue: (b.daysOverdue ?? 0) > 0,
        interest: estimatedInterest(b.balance, inv.monthlyInterest, b.dueDate),
      };
    });
    const openingRows = (await openingBalances(ctx.db, { customerId: input.customerId })).map((ob) => {
      const info = openingInfo.get(ob.customerOpeningBalanceId)!;
      return {
        kind: "SALDO_INICIAL" as const,
        id: ob.customerOpeningBalanceId,
        asOfDate: ob.asOfDate,
        dueDate: ob.dueDate,
        amount: ob.amount,
        balance: ob.balance,
        overdue: (ob.daysOverdue ?? 0) > 0,
        interest: estimatedInterest(ob.balance, info.monthlyInterest, ob.dueDate),
        notes: info.notes,
      };
    });
    const total = sum([...invoiceRows.map((r) => r.balance), ...openingRows.map((r) => r.balance)]);
    const interest = sum([...invoiceRows.map((r) => r.interest), ...openingRows.map((r) => r.interest)]);
    // Abonos (payments that paid one of this customer's debts), to reprint their receipt (DEC-053).
    const payments = await ctx.db.customerPayment.findMany({
      where: {
        allocations: {
          some: {
            OR: [{ saleInvoice: { customerId: input.customerId } }, { customerOpeningBalance: { customerId: input.customerId } }],
          },
        },
      },
      orderBy: { id: "desc" },
      take: 50,
      include: { paymentMethod: { select: { name: true } }, allocations: { select: { saleInvoiceId: true, customerOpeningBalanceId: true } } },
    });
    // Contado payments are made with the invoice itself; only list the ones of credit debts.
    const creditInvoiceIds = new Set(invoiceRows.filter((r) => r.paymentTerms === "CREDITO").map((r) => r.id));
    const paymentRows = payments
      .filter((p) =>
        p.allocations.some((a) => a.customerOpeningBalanceId != null || (a.saleInvoiceId != null && creditInvoiceIds.has(a.saleInvoiceId))),
      )
      .map((p) => ({ id: p.id, paidAt: p.paidAt, amount: p.amount, currency: p.currency, method: p.paymentMethod.name }));
    return {
      customer,
      invoices: invoiceRows,
      openingBalances: openingRows,
      payments: paymentRows,
      totalBalance: total,
      totalInterest: interest,
    };
  }),
});
