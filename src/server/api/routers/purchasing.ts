import { z } from "zod";

import { fail } from "~/server/api/errors";
import { createTRPCRouter, permissionProcedure } from "~/server/api/trpc";
import { type DbClient, type Prisma } from "~/server/db";
import { type PurchaseBalance, purchaseBalances, supplierBalance } from "~/server/domain/balances";
import {
  CURRENCIES,
  dayToDate,
  PAYMENT_TERMS,
  SUPPLIER_RETURN_RESOLUTIONS,
  todayInManagua,
  zDay,
  zExchangeRate,
  zId,
  zMoney,
  zOptText,
  pageFields,
  zPositiveMoney,
  zQty,
  zText,
} from "~/server/domain/constants";
import { recordMovement } from "~/server/domain/inventory";
import { D, sum, toNio } from "~/server/domain/money";

/** API-017 — suppliers, purchases (COMPRA entries), supplier returns and payments. */
const view = permissionProcedure("compras.ver");
const manage = permissionProcedure("compras.gestionar");

/**
 * What we owe for each purchase and each supplier comes from the views
 * v_purchase_invoice_balance and v_supplier_balance (DEC-042): lines − invoice
 * discount − returns settled with money or discount (REPOSICION returns are
 * replaced with goods, so the debt stays) − payments.
 */
async function supplierAccount(db: Prisma.TransactionClient | DbClient, supplierId: number) {
  const supplier = await db.supplier.findUniqueOrThrow({ where: { id: supplierId } });
  const balance = await supplierBalance(db, supplierId);
  const numbers = new Map(
    (await db.purchaseInvoice.findMany({ where: { supplierId }, select: { id: true, invoiceNumber: true } })).map((p) => [
      p.id,
      p.invoiceNumber,
    ]),
  );
  const rows = (await purchaseBalances(db, { supplierId })).map((p) => ({
    id: p.purchaseInvoiceId,
    invoiceNumber: numbers.get(p.purchaseInvoiceId)!,
    purchaseDate: p.purchaseDate,
    paymentTerms: p.paymentTerms,
    dueDate: p.dueDate,
    total: p.total,
    returned: p.returned,
    paid: p.paid,
    balance: p.balance,
    daysOverdue: p.daysOverdue,
  }));
  return { supplier, openingBalance: balance.openingBalance, purchases: rows, totalBalance: balance.balance, overdue: balance.overdue };
}

const pick = (b: PurchaseBalance) => ({ total: b.total, returned: b.returned, paid: b.paid, balance: b.balance });

const zSupplier = z.object({
  name: zText(100),
  phone: zOptText(20),
  contactPerson: zOptText(100),
  givesWarranty: z.boolean().nullish(),
  openingBalance: zMoney.optional(),
  openingDate: zDay.optional(),
});

export const purchasingRouter = createTRPCRouter({
  suppliers: view.query(({ ctx }) => ctx.db.supplier.findMany({ orderBy: { name: "asc" } })),

  saveSupplier: manage.input(zSupplier.extend({ id: zId.optional() })).mutation(({ ctx, input }) => {
    const data = {
      name: input.name,
      phone: input.phone ?? null,
      contactPerson: input.contactPerson ?? null,
      givesWarranty: input.givesWarranty ?? null,
      openingBalance: input.openingBalance ?? null,
      openingDate: input.openingDate ? dayToDate(input.openingDate) : null,
    };
    return input.id ? ctx.db.supplier.update({ where: { id: input.id }, data }) : ctx.db.supplier.create({ data });
  }),

  supplierAccount: view.input(z.object({ supplierId: zId })).query(({ ctx, input }) =>
    ctx.db.$transaction((tx) => supplierAccount(tx, input.supplierId)),
  ),

  listInvoices: view
    .input(z.object({ supplierId: zId.optional(), ...pageFields }).default({}))
    .query(async ({ ctx, input }) => {
      const { cursor, limit } = input;
      const items = await ctx.db.purchaseInvoice.findMany({
        where: { supplierId: input.supplierId },
        orderBy: { id: "desc" },
        include: { supplier: true },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      const page = items.slice(0, limit);
      const balances = new Map(
        (await purchaseBalances(ctx.db, { ids: page.map((p) => p.id) })).map((b) => [b.purchaseInvoiceId, b]),
      );
      return {
        items: page.map((p) => ({
          id: p.id,
          supplier: p.supplier,
          invoiceNumber: p.invoiceNumber,
          purchaseDate: p.purchaseDate,
          paymentTerms: p.paymentTerms,
          dueDate: p.dueDate,
          ...pick(balances.get(p.id)!),
        })),
        nextCursor: items.length > limit ? items[limit - 1]!.id : null,
      };
    }),

  getInvoice: view.input(z.object({ id: zId })).query(async ({ ctx, input }) => {
    const p = await ctx.db.purchaseInvoice.findUniqueOrThrow({
      where: { id: input.id },
      include: {
        payments: true,
        supplier: true,
        lines: { orderBy: { lineNo: "asc" }, include: { product: true, returnLines: { include: { supplierReturn: true } } } },
        returns: { include: { lines: true, returnReason: true } },
      },
    });
    const [b] = await purchaseBalances(ctx.db, { ids: [p.id] });
    return { ...p, ...pick(b!) };
  }),

  /** Purchase invoice + lines + COMPRA entries (stock goes up via the trigger). */
  createInvoice: manage
    .input(
      z
        .object({
          supplierId: zId,
          invoiceNumber: zText(30),
          purchaseDate: zDay.optional(),
          paymentTerms: z.enum(PAYMENT_TERMS),
          dueDate: zDay.optional(),
          discountAmount: zMoney.default("0"),
          lines: z.array(z.object({ productId: zId, quantity: zQty, unitCost: zMoney })).min(1),
        })
        .refine((v) => v.paymentTerms === "CONTADO" || !!v.dueDate, {
          path: ["dueDate"],
          message: "Una compra al crédito necesita vencimiento",
        }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        const gross = sum(input.lines.map((l) => D(l.unitCost).times(l.quantity)));
        if (D(input.discountAmount).gt(gross)) throw fail("El descuento es mayor que el total de la compra.");
        const invoice = await tx.purchaseInvoice.create({
          data: {
            supplierId: input.supplierId,
            invoiceNumber: input.invoiceNumber,
            purchaseDate: dayToDate(input.purchaseDate ?? todayInManagua()),
            paymentTerms: input.paymentTerms,
            dueDate: input.paymentTerms === "CREDITO" ? dayToDate(input.dueDate!) : null,
            discountAmount: input.discountAmount,
            receivedByUserId: ctx.user.id,
          },
        });
        for (const [i, l] of input.lines.entries()) {
          const line = await tx.purchaseInvoiceLine.create({
            data: { purchaseInvoiceId: invoice.id, lineNo: i + 1, productId: l.productId, quantity: l.quantity, unitCost: l.unitCost },
          });
          await recordMovement(tx, {
            productId: l.productId,
            movementType: "COMPRA",
            quantity: l.quantity,
            unitCost: l.unitCost,
            userId: ctx.user.id,
            purchaseInvoiceLineId: line.id,
          });
        }
        return invoice;
      }),
    ),

  /** Return to supplier; quantity ≤ bought − already returned (validated under lock). */
  createReturn: manage
    .input(
      z.object({
        purchaseInvoiceId: zId,
        returnReasonId: zId,
        resolution: z.enum(SUPPLIER_RETURN_RESOLUTIONS),
        lines: z.array(z.object({ purchaseInvoiceLineId: zId, quantity: zQty })).min(1),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM purchase_invoice WHERE id = ${input.purchaseInvoiceId} FOR UPDATE`;
        const lines = await tx.purchaseInvoiceLine.findMany({
          where: { purchaseInvoiceId: input.purchaseInvoiceId },
          include: { returnLines: true },
        });
        const byId = new Map(lines.map((l) => [l.id, l]));
        for (const r of input.lines) {
          const line = byId.get(r.purchaseInvoiceLineId);
          if (!line) throw fail("Una de las líneas no pertenece a esta compra.");
          const already = line.returnLines.reduce((a, x) => a + x.quantity, 0);
          if (r.quantity > line.quantity - already) {
            throw fail(`Línea ${line.lineNo}: se compraron ${line.quantity} y ya se devolvieron ${already}.`);
          }
        }
        const ret = await tx.supplierReturn.create({
          data: {
            purchaseInvoiceId: input.purchaseInvoiceId,
            returnReasonId: input.returnReasonId,
            resolution: input.resolution,
            registeredByUserId: ctx.user.id,
          },
        });
        for (const [i, r] of input.lines.entries()) {
          const line = byId.get(r.purchaseInvoiceLineId)!;
          const rl = await tx.supplierReturnLine.create({
            data: {
              supplierReturnId: ret.id,
              purchaseInvoiceId: input.purchaseInvoiceId,
              lineNo: i + 1,
              purchaseInvoiceLineId: line.id,
              productId: line.productId,
              quantity: r.quantity,
            },
          });
          await recordMovement(tx, {
            productId: line.productId,
            movementType: "DEVOLUCION_PROVEEDOR",
            quantity: r.quantity,
            unitCost: line.unitCost,
            userId: ctx.user.id,
            supplierReturnLineId: rl.id,
          });
        }
        return ret;
      }),
    ),

  /** Payment to a supplier: to one purchase, or (no purchase) to the opening balance. */
  registerPayment: manage
    .input(
      z.object({
        supplierId: zId,
        purchaseInvoiceId: zId.optional(),
        amount: zPositiveMoney,
        currency: z.enum(CURRENCIES).default("NIO"),
        exchangeRate: zExchangeRate.optional(),
        paidOn: zDay.optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        if (input.currency === "USD" && !input.exchangeRate) throw fail("Indique el tipo de cambio del dólar.");
        await tx.$queryRaw`SELECT id FROM supplier WHERE id = ${input.supplierId} FOR UPDATE`;
        const account = await supplierAccount(tx, input.supplierId);
        const amountNio = toNio(input.amount, input.currency, input.exchangeRate);
        const owed = input.purchaseInvoiceId
          ? account.purchases.find((p) => p.id === input.purchaseInvoiceId)?.balance
          : account.openingBalance;
        if (owed === undefined) throw fail("Esa compra no es de este proveedor.");
        if (amountNio.gt(owed)) throw fail(`Solo se deben C$ ${owed.toFixed(2)}.`);
        return tx.supplierPayment.create({
          data: {
            supplierId: input.supplierId,
            purchaseInvoiceId: input.purchaseInvoiceId ?? null,
            amount: input.amount,
            currency: input.currency,
            exchangeRate: input.currency === "USD" ? input.exchangeRate : null,
            paidOn: dayToDate(input.paidOn ?? todayInManagua()),
          },
        });
      }),
    ),
});

