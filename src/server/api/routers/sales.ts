import { z } from "zod";

import { fail } from "~/server/api/errors";
import { createTRPCRouter, permissionProcedure } from "~/server/api/trpc";
import { requireOpenCash } from "~/server/domain/cash";
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
  PAYMENT_TERMS,
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
import { lockRows, Sql } from "~/server/domain/sql";
import { D, type Dec, round2, sum, toNio } from "~/server/domain/money";
import { type Prisma } from "~/server/db";

/** Return reason used only by «Anular factura» (migration 7); not offered for normal returns. */
export const VOID_REASON = "Anulación de factura";

/** Prompt v2 §2: owners can void an invoice up to 3 days after it was made. */
export const VOID_DAYS = 3;

type Tx = Prisma.TransactionClient;

/**
 * API-016 — Products come back from an invoice: return + lines + DEVOLUCION_CLIENTE
 * movements at the cost they left with. Used by returns and by voids (DEC-055).
 */
async function createCustomerReturn(
  tx: Tx,
  userId: number,
  input: {
    saleInvoiceId: number;
    returnReasonId: number;
    creditNoteNumber?: string | null;
    notes?: string | null;
    lines: { saleInvoiceLineId: number; quantity: number }[];
  },
) {
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
      registeredByUserId: userId,
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
      userId,
      customerReturnLineId: rl.id,
    });
  }
  return ret;
}

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

  /**
   * Facturas (registro de lo cobrado): filters done by the database (DEC-049, DEC-054)
   * on v_invoice_balance, plus the totals of everything that matches (not only
   * the page). Pages by offset: the list is sorted newest first.
   */
  searchInvoices: permissionProcedure("ventas.ver")
    .input(
      z
        .object({
          from: zDay.optional(),
          to: zDay.optional(),
          /** Customer name (no accents needed) or the invoice number. */
          text: z.string().trim().max(100).optional(),
          paymentTerms: z.enum(PAYMENT_TERMS).optional(),
          state: z.enum(["TODAS", "PENDIENTES", "PAGADAS", "VENCIDAS", "ANULADAS"]).default("TODAS"),
          origin: z.enum(["TODAS", "MOSTRADOR", "TALLER"]).default("TODAS"),
          offset: z.number().int().min(0).default(0),
          limit: z.number().int().min(1).max(100).default(50),
        })
        .default({}),
    )
    .query(async ({ ctx, input }) => {
      const q = new Sql();
      const conds = ["true"];
      // created_at is TIMESTAMPTZ: the day is the one in Managua (DEC-038).
      if (input.from) conds.push(`(si.created_at AT TIME ZONE 'America/Managua')::date >= ${q.p(input.from, "date")}`);
      if (input.to) conds.push(`(si.created_at AT TIME ZONE 'America/Managua')::date <= ${q.p(input.to, "date")}`);
      if (input.paymentTerms) conds.push(`b.payment_terms = ${q.p(input.paymentTerms)}`);
      if (input.state === "PENDIENTES") conds.push("b.balance > 0");
      if (input.state === "PAGADAS") conds.push("b.balance <= 0 AND NOT b.voided");
      if (input.state === "ANULADAS") conds.push("b.voided");
      if (input.state === "VENCIDAS") conds.push("b.days_overdue > 0");
      if (input.origin === "TALLER") conds.push("si.service_order_id IS NOT NULL");
      if (input.origin === "MOSTRADOR") conds.push("si.service_order_id IS NULL");
      if (input.text) {
        const digits = /^#?0*(\d{1,9})$/.exec(input.text)?.[1];
        const byName = `mirm_norm(coalesce(c.name, 'Cliente de contado')) LIKE '%' || mirm_norm(${q.p(input.text)}) || '%'`;
        conds.push(
          digits
            ? `(si.id = ${q.p(Number(digits), "int")} OR si.invoice_number = ${q.p(input.text)} OR ${byName})`
            : `(si.invoice_number = ${q.p(input.text)} OR ${byName})`,
        );
      }
      const from = `FROM v_invoice_balance b
        JOIN sale_invoice si ON si.id = b.sale_invoice_id
        LEFT JOIN customer c ON c.id = b.customer_id
        JOIN app_user u ON u.id = si.created_by_user_id
       WHERE ${conds.join(" AND ")}`;
      const rows = await q.run<
        {
          id: number;
          invoice_number: string | null;
          created_at: Date;
          payment_terms: string;
          due_date: Date | null;
          customer_id: number | null;
          customer_name: string | null;
          service_order_id: number | null;
          created_by: string;
          total: Dec;
          returned: Dec;
          paid: Dec;
          balance: Dec;
          days_overdue: number | null;
          voided: boolean;
          count: bigint;
          sum_total: Dec;
          sum_paid: Dec;
          sum_balance: Dec;
        }[]
      >(
        ctx.db,
        `SELECT si.id, si.invoice_number, b.created_at, b.payment_terms, b.due_date, b.customer_id,
                c.name AS customer_name, si.service_order_id, u.username AS created_by,
                b.total, b.returned, b.paid, b.balance, b.days_overdue, b.voided,
                count(*) OVER () AS count,
                -- A voided invoice counts as billed 0 and collected 0 (its money went back).
                sum(CASE WHEN b.voided THEN 0 ELSE b.total - b.returned END) OVER () AS sum_total,
                sum(CASE WHEN b.voided THEN 0 ELSE b.paid END) OVER () AS sum_paid,
                sum(b.balance) OVER () AS sum_balance
           ${from}
          ORDER BY si.id DESC
          LIMIT ${q.p(input.limit, "int")} OFFSET ${q.p(input.offset, "int")}`,
      );
      const first = rows[0];
      return {
        items: rows.map((r) => ({
          id: r.id,
          invoiceNumber: r.invoice_number,
          createdAt: r.created_at,
          paymentTerms: r.payment_terms,
          dueDate: r.due_date,
          customer: r.customer_id ? { id: r.customer_id, name: r.customer_name ?? "" } : null,
          serviceOrderId: r.service_order_id,
          createdBy: r.created_by,
          total: r.total,
          returned: r.returned,
          paid: r.paid,
          balance: r.balance,
          overdue: (r.days_overdue ?? 0) > 0,
          voided: r.voided,
        })),
        // With an offset past the end there are no rows to read the totals from.
        count: first ? Number(first.count) : 0,
        sumTotal: first?.sum_total ?? D(0),
        sumPaid: first?.sum_paid ?? D(0),
        sumBalance: first?.sum_balance ?? D(0),
      };
    }),

  /**
   * DEC-055 — Void an invoice: only an owner, within 3 days, with a reason. Nothing
   * is deleted: the unreturned products come back through a return, what was paid
   * is recorded as cash given back, and the balance becomes 0. The database checks
   * the same rules (tg_sale_invoice_void_check) and blocks new payments/returns.
   */
  voidInvoice: permissionProcedure("ventas.anular")
    .input(z.object({ saleInvoiceId: zId, reason: z.string().trim().min(5, "Escriba el motivo (al menos 5 letras)").max(200) }))
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM sale_invoice WHERE id = ${input.saleInvoiceId} FOR UPDATE`;
        const inv = await tx.saleInvoice.findUniqueOrThrow({
          where: { id: input.saleInvoiceId },
          include: {
            void: true,
            serviceOrder: { select: { staffPayoutId: true } },
            lines: { include: { returnLines: true } },
          },
        });
        if (inv.void) throw fail("Esta factura ya está anulada.");
        const me = await tx.appUser.findUniqueOrThrow({ where: { id: ctx.user.id }, include: { staff: true } });
        if (me.staff?.kind !== "DUENO" || !me.staff.active) throw fail("Solo un dueño puede anular facturas.", "FORBIDDEN");
        if (Date.now() - inv.createdAt.getTime() > VOID_DAYS * 86_400_000) {
          throw fail(`La factura tiene más de ${VOID_DAYS} días: ya no se puede anular.`);
        }
        if (inv.serviceOrder?.staffPayoutId) throw fail("La comisión de esta orden ya se pagó: no se puede anular la factura.");

        // Products not returned yet go back to the shelf.
        const pending = inv.lines.flatMap((l) => {
          const left = l.lineType === "PRODUCTO" ? l.quantity - l.returnLines.reduce((a, r) => a + r.quantity, 0) : 0;
          return left > 0 ? [{ saleInvoiceLineId: l.id, quantity: left }] : [];
        });
        let customerReturnId: number | null = null;
        if (pending.length) {
          const reason = await tx.returnReason.findFirst({ where: { name: { equals: VOID_REASON, mode: "insensitive" } } });
          if (!reason) throw fail("Falta el motivo «Anulación de factura» (migración 7).");
          const ret = await createCustomerReturn(tx, ctx.user.id, {
            saleInvoiceId: inv.id,
            returnReasonId: reason.id,
            notes: `Anulación: ${input.reason}`.slice(0, 200),
            lines: pending,
          });
          customerReturnId = ret.id;
        }
        // Read before the void row: after it, the view says balance 0.
        const b = await invoiceBalance(tx, inv.id);
        if (b.paid.gt(0)) await requireOpenCash(tx); // se devuelve efectivo al cliente
        return tx.saleInvoiceVoid.create({
          data: {
            saleInvoiceId: inv.id,
            voidedByUserId: ctx.user.id,
            reason: input.reason,
            refundAmount: b.paid,
            customerReturnId,
          },
        });
      }),
    ),

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
          serviceOrder: {
            select: { id: true, odometerKm: true, motorcycle: { include: { model: { include: { brand: true } } } } },
          },
          void: { include: { voidedBy: { select: { username: true } } } },
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
      const inv = await ctx.db.saleInvoice.findUnique({ where: { id: input.invoiceId }, include: { void: true } });
      if (!inv) throw fail("La factura no existe.", "NOT_FOUND");
      if (inv.paymentTerms !== "CREDITO" || !inv.dueDate) throw fail("Solo las facturas al crédito tienen vencimiento que prorrogar.");
      if (inv.void) throw fail("La factura está anulada: no se prorroga.");
      if (input.extendedDueDate <= inv.dueDate.toISOString().slice(0, 10)) {
        throw fail("La prórroga debe ser una fecha posterior al vencimiento original.");
      }
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
        // That reason belongs to «Anular factura» (DEC-055), which also leaves a record of the void.
        const reason = await tx.returnReason.findUnique({ where: { id: input.returnReasonId } });
        if (reason?.name.trim().toLowerCase() === VOID_REASON.toLowerCase()) {
          throw fail("Para anular la factura use el botón «Anular factura», no una devolución.");
        }
        return createCustomerReturn(tx, ctx.user.id, input);
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
        await requireOpenCash(tx);
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
        await lockRows(tx, "sale_invoice", invoiceIds);
        await lockRows(tx, "customer_opening_balance", openingIds);
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

  /**
   * A customer payment (abono) with what it paid and what is still owed, for the
   * printable receipt (DEC-053). The customer comes from what the payment paid.
   */
  getPayment: permissionProcedure("clientes.ver")
    .input(z.object({ id: zId }))
    .query(async ({ ctx, input }) => {
      const p = await ctx.db.customerPayment.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          paymentMethod: true,
          receivedBy: { select: { username: true } },
          allocations: {
            orderBy: { id: "asc" },
            include: { saleInvoice: { include: { customer: true } }, customerOpeningBalance: { include: { customer: true } } },
          },
        },
      });
      const customer = p.allocations[0]?.saleInvoice?.customer ?? p.allocations[0]?.customerOpeningBalance?.customer ?? null;
      const invoiceIds = p.allocations.flatMap((a) => (a.saleInvoiceId ? [a.saleInvoiceId] : []));
      const invoices = await invoiceBalances(ctx.db, invoiceIds);
      const openings = await openingBalances(ctx.db, {
        ids: p.allocations.flatMap((a) => (a.customerOpeningBalanceId ? [a.customerOpeningBalanceId] : [])),
      });
      const account = customer ? (await customerBalances(ctx.db, { customerId: customer.id }))[0] : undefined;
      return {
        id: p.id,
        paidAt: p.paidAt,
        amount: p.amount,
        currency: p.currency,
        exchangeRate: p.exchangeRate,
        amountNio: toNio(p.amount, p.currency, p.exchangeRate),
        method: p.paymentMethod.name,
        receivedBy: p.receivedBy.username,
        customer: customer ? { id: customer.id, name: customer.name, phone: customer.phone, nationalId: customer.nationalId } : null,
        allocations: p.allocations.map((a) => ({
          id: a.id,
          saleInvoiceId: a.saleInvoiceId,
          customerOpeningBalanceId: a.customerOpeningBalanceId,
          amount: a.amount,
          /** What that debt still owes now. */
          balanceNow: a.saleInvoiceId
            ? (invoices.get(a.saleInvoiceId)?.balance ?? null)
            : (openings.find((o) => o.customerOpeningBalanceId === a.customerOpeningBalanceId)?.balance ?? null),
        })),
        customerBalanceNow: account?.balance ?? null,
      };
    }),

  /** Net value of a line per unit, for the returns screen. */
  unitNet: permissionProcedure("ventas.ver")
    .input(z.object({ saleInvoiceLineId: zId }))
    .query(async ({ ctx, input }) => {
      const l = await ctx.db.saleInvoiceLine.findUniqueOrThrow({ where: { id: input.saleInvoiceLineId } });
      return round2(lineNet(l).div(l.quantity));
    }),
});
