import { z } from "zod";

import { fail } from "~/server/api/errors";
import { createTRPCRouter, permissionProcedure } from "~/server/api/trpc";
import { Prisma } from "~/server/db";
import { resolveAuthorizer, zAuthorizer } from "~/server/domain/authorize";
import {
  customerBalances,
  customerInvoiceBalances,
  invoiceBalance,
  invoiceBalances,
  openingBalances,
} from "~/server/domain/balances";
import { buildProductLines, createInvoice, lineNet, zProductLine, zTerms } from "~/server/domain/billing";
import {
  CURRENCIES,
  dayToDate,
  zDay,
  zExchangeRate,
  zId,
  zOptText,
  pageFields,
  zPositiveMoney,
  zQty,
} from "~/server/domain/constants";
import { recordMovement } from "~/server/domain/inventory";
import { D, round2, sum, toNio } from "~/server/domain/money";

/**
 * API-012 counter sale · API-013 customer payments · API-014 receivables ·
 * API-016 customer returns.
 */
export const salesRouter = createTRPCRouter({
  listInvoices: permissionProcedure("ventas.ver")
    .input(
      z
        .object({
          customerId: zId.optional(),
          from: zDay.optional(),
          to: zDay.optional(),
          ...pageFields,
        })
        .default({}),
    )
    .query(async ({ ctx, input }) => {
      const { cursor, limit } = input;
      const items = await ctx.db.saleInvoice.findMany({
        where: {
          customerId: input.customerId,
          createdAt: {
            gte: input.from ? new Date(`${input.from}T00:00:00-06:00`) : undefined,
            lt: input.to ? new Date(new Date(`${input.to}T00:00:00-06:00`).getTime() + 86_400_000) : undefined,
          },
        },
        orderBy: { id: "desc" },
        include: { customer: true, createdBy: { select: { username: true } } },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      const page = items.slice(0, limit);
      const balances = await invoiceBalances(ctx.db, page.map((i) => i.id));
      return {
        items: page.map((inv) => {
          const b = balances.get(inv.id)!;
          return {
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          createdAt: inv.createdAt,
          paymentTerms: inv.paymentTerms,
          customer: inv.customer,
          createdBy: inv.createdBy.username,
          serviceOrderId: inv.serviceOrderId,
          total: b.total,
          returned: b.returned,
          paid: b.paid,
          balance: b.balance,
          };
        }),
        nextCursor: items.length > limit ? items[limit - 1]!.id : null,
      };
    }),

  getInvoice: permissionProcedure("ventas.ver")
    .input(z.object({ id: zId }))
    .query(async ({ ctx, input }) => {
      const inv = await ctx.db.saleInvoice.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          customer: true,
          createdBy: { select: { username: true } },
          creditAuthorizedBy: { select: { username: true } },
          lines: {
            orderBy: { lineNo: "asc" },
            include: { product: true, serviceType: true, discount: true, returnLines: true },
          },
          paymentAllocations: { include: { customerPayment: { include: { paymentMethod: true } } } },
          returns: { include: { lines: true, returnReason: true } },
        },
      });
      const b = await invoiceBalance(ctx.db, inv.id);
      return {
        ...inv,
        lines: inv.lines.map((l) => ({
          ...l,
          net: lineNet(l),
          returnedQuantity: l.returnLines.reduce((a, r) => a + r.quantity, 0),
        })),
        total: b.total,
        returned: b.returned,
        paid: b.paid,
        balance: b.balance,
      };
    }),

  /**
   * Counter sale: invoice + lines + VENTA movements + (CONTADO) payment, all or
   * nothing. Prices come from the product table; the total is computed here.
   */
  create: permissionProcedure("ventas.crear")
    .input(z.object({ terms: zTerms, lines: z.array(zProductLine).min(1, "Agregue al menos un producto") }))
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        const drafts = await buildProductLines(tx, ctx.user, input.lines, input.terms.authorizer);
        return createInvoice(tx, ctx.user, input.terms, drafts, { exitType: "VENTA" });
      }),
    ),

  /** Extends the due date of a credit invoice (needs credit authorization). */
  extendDueDate: permissionProcedure("ventas.ver")
    .input(z.object({ invoiceId: zId, extendedDueDate: zDay, authorizer: zAuthorizer }))
    .mutation(async ({ ctx, input }) => {
      await resolveAuthorizer(ctx.db, ctx.user, "ventas.autorizar_credito", input.authorizer);
      return ctx.db.saleInvoice.update({
        where: { id: input.invoiceId },
        data: { extendedDueDate: dayToDate(input.extendedDueDate) },
      });
    }),

  // ---------------------------------------------------------------------------
  //  API-016 — Customer returns
  // ---------------------------------------------------------------------------
  createReturn: permissionProcedure("ventas.devoluciones")
    .input(
      z.object({
        saleInvoiceId: zId,
        returnReasonId: zId,
        creditNoteNumber: zOptText(20),
        notes: zOptText(200),
        lines: z.array(z.object({ saleInvoiceLineId: zId, quantity: zQty })).min(1),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        // Lock the invoice so two returns can't both pass the quantity check.
        await tx.$queryRaw`SELECT id FROM sale_invoice WHERE id = ${input.saleInvoiceId} FOR UPDATE`;
        const lines = await tx.saleInvoiceLine.findMany({
          where: { saleInvoiceId: input.saleInvoiceId },
          include: { returnLines: true, inventoryMovements: true },
        });
        const byId = new Map(lines.map((l) => [l.id, l]));
        for (const r of input.lines) {
          const line = byId.get(r.saleInvoiceLineId);
          if (!line) throw fail("Una de las líneas no pertenece a esta factura.");
          if (line.lineType !== "PRODUCTO" || !line.productId) throw fail("Solo se devuelven productos.");
          const already = line.returnLines.reduce((a, x) => a + x.quantity, 0);
          if (r.quantity > line.quantity - already) {
            throw fail(`Línea ${line.lineNo}: se vendieron ${line.quantity} y ya se devolvieron ${already}.`);
          }
        }
        const ret = await tx.customerReturn.create({
          data: {
            saleInvoiceId: input.saleInvoiceId,
            returnReasonId: input.returnReasonId,
            creditNoteNumber: input.creditNoteNumber ?? null,
            notes: input.notes ?? null,
            registeredByUserId: ctx.user.id,
          },
        });
        for (const [i, r] of input.lines.entries()) {
          const line = byId.get(r.saleInvoiceLineId)!;
          const rl = await tx.customerReturnLine.create({
            data: {
              customerReturnId: ret.id,
              saleInvoiceId: input.saleInvoiceId,
              lineNo: i + 1,
              saleInvoiceLineId: line.id,
              productId: line.productId!,
              quantity: r.quantity,
            },
          });
          // Goods come back at the cost they left with.
          await recordMovement(tx, {
            productId: line.productId!,
            movementType: "DEVOLUCION_CLIENTE",
            quantity: r.quantity,
            unitCost: line.inventoryMovements[0]?.unitCost,
            userId: ctx.user.id,
            customerReturnLineId: rl.id,
          });
        }
        return ret;
      }),
    ),

  // ---------------------------------------------------------------------------
  //  API-013 — Customer payments (abonos)
  // ---------------------------------------------------------------------------
  /** What the customer owes, item by item: the input for the payment screen. */
  pendingForCustomer: permissionProcedure("cobros.registrar")
    .input(z.object({ customerId: zId }))
    .query(async ({ ctx, input }) => {
      const openings = await openingBalances(ctx.db, { customerId: input.customerId }, true);
      const invoices = await customerInvoiceBalances(ctx.db, input.customerId, true);
      // Oldest first: that is the order a payment is usually applied in.
      return [
        ...openings.reverse().map((o) => ({
          kind: "SALDO_INICIAL" as const,
          id: o.customerOpeningBalanceId,
          date: o.asOfDate,
          dueDate: o.dueDate,
          balance: o.balance,
        })),
        ...invoices.reverse().map((i) => ({
          kind: "FACTURA" as const,
          id: i.saleInvoiceId,
          date: i.createdAt,
          dueDate: i.dueDate,
          balance: i.balance,
        })),
      ];
    }),

  /**
   * Registers a payment and spreads it (in córdobas, DEC-025) over invoices and/or
   * opening balances. A CHECK can't add up rows, so the API validates, inside a
   * locked transaction, that Σ allocations ≤ payment and each ≤ its balance.
   */
  registerPayment: permissionProcedure("cobros.registrar")
    .input(
      z.object({
        customerId: zId,
        amount: zPositiveMoney,
        currency: z.enum(CURRENCIES).default("NIO"),
        exchangeRate: zExchangeRate.optional(),
        paymentMethodId: zId,
        allocations: z
          .array(
            z.object({
              saleInvoiceId: zId.optional(),
              customerOpeningBalanceId: zId.optional(),
              amount: zPositiveMoney,
            }),
          )
          .min(1, "Aplique el pago al menos a una deuda"),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        if (input.currency === "USD" && !input.exchangeRate) throw fail("Indique el tipo de cambio del dólar.");
        const paymentNio = toNio(input.amount, input.currency, input.exchangeRate);
        const allocated = sum(input.allocations.map((a) => a.amount));
        if (allocated.gt(paymentNio)) {
          throw fail(`Se reparten C$ ${allocated.toFixed(2)} pero el pago equivale a C$ ${paymentNio.toFixed(2)}.`);
        }
        const invoiceIds = input.allocations.flatMap((a) => (a.saleInvoiceId ? [a.saleInvoiceId] : []));
        const openingIds = input.allocations.flatMap((a) => (a.customerOpeningBalanceId ? [a.customerOpeningBalanceId] : []));
        if (new Set(invoiceIds).size !== invoiceIds.length || new Set(openingIds).size !== openingIds.length) {
          throw fail("Cada deuda aparece una sola vez en el reparto.");
        }
        if (invoiceIds.length) {
          await tx.$queryRaw`SELECT id FROM sale_invoice WHERE id IN (${Prisma.join(invoiceIds)}) FOR UPDATE`;
        }
        if (openingIds.length) {
          await tx.$queryRaw`SELECT id FROM customer_opening_balance WHERE id IN (${Prisma.join(openingIds)}) FOR UPDATE`;
        }
        // Read AFTER the locks, so the balances can't change under us.
        const invoices = await invoiceBalances(tx, invoiceIds);
        const openings = openingIds.length ? await openingBalances(tx, { ids: openingIds }) : [];
        for (const a of input.allocations) {
          if (a.saleInvoiceId) {
            const inv = invoices.get(a.saleInvoiceId);
            if (inv?.customerId !== input.customerId) throw fail(`La factura ${a.saleInvoiceId} no es de este cliente.`);
            if (D(a.amount).gt(inv.balance)) throw fail(`La factura ${inv.saleInvoiceId} solo debe C$ ${inv.balance.toFixed(2)}.`);
          } else if (a.customerOpeningBalanceId) {
            const ob = openings.find((o) => o.customerOpeningBalanceId === a.customerOpeningBalanceId);
            if (ob?.customerId !== input.customerId) throw fail("El saldo inicial no es de este cliente.");
            if (D(a.amount).gt(ob.balance)) throw fail(`El saldo inicial solo debe C$ ${ob.balance.toFixed(2)}.`);
          } else {
            throw fail("Cada abono se aplica a una factura o a un saldo inicial.");
          }
        }
        return tx.customerPayment.create({
          data: {
            amount: input.amount,
            currency: input.currency,
            exchangeRate: input.currency === "USD" ? input.exchangeRate : null,
            paymentMethodId: input.paymentMethodId,
            receivedByUserId: ctx.user.id,
            allocations: {
              create: input.allocations.map((a) => ({
                saleInvoiceId: a.saleInvoiceId ?? null,
                customerOpeningBalanceId: a.customerOpeningBalanceId ?? null,
                amount: a.amount,
              })),
            },
          },
          include: { allocations: true },
        });
      }),
    ),

  // ---------------------------------------------------------------------------
  //  API-014 — Receivables: who owes what, and what is overdue
  // ---------------------------------------------------------------------------
  receivables: permissionProcedure("clientes.ver")
    .input(z.object({ onlyOverdue: z.boolean().default(false) }).default({}))
    .query(async ({ ctx, input }) => {
      const list = (await customerBalances(ctx.db, { onlyOverdue: input.onlyOverdue })).map((r) => ({
        ...r,
        oldestDue: r.oldestDueDate?.toISOString().slice(0, 10) ?? null,
      }));
      return { rows: list, total: sum(list.map((r) => r.balance)), overdue: sum(list.map((r) => r.overdue)) };
    }),

  /** Net value of a line per unit, for the returns screen. */
  unitNet: permissionProcedure("ventas.ver")
    .input(z.object({ saleInvoiceLineId: zId }))
    .query(async ({ ctx, input }) => {
      const l = await ctx.db.saleInvoiceLine.findUniqueOrThrow({ where: { id: input.saleInvoiceLineId } });
      return round2(lineNet(l).div(l.quantity));
    }),
});
