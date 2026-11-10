import { z } from "zod";

import { fail } from "~/server/api/errors";
import { createTRPCRouter, permissionProcedure } from "~/server/api/trpc";
import { Prisma } from "~/server/db";
import { invoiceBalance, invoiceBalanceInclude } from "~/server/domain/billing";
import { dayToDate, FINAL_SERVICE_STATUSES, type ServiceOrderStatus, todayInManagua, zDay } from "~/server/domain/constants";
import { D, sum, toNio } from "~/server/domain/money";

/**
 * API-023 — what the owners check every day. The exact content of the cash
 * close depends on Q-004 / Q-007; this version: money received by method,
 * minus withdrawals and advances given that day.
 */
export const reportsRouter = createTRPCRouter({
  daySummary: permissionProcedure("reportes.ver")
    .input(z.object({ day: zDay.optional(), lowStockThreshold: z.number().int().min(0).default(2) }).default({}))
    .query(async ({ ctx, input }) => {
      const day = input.day ?? todayInManagua();
      const start = new Date(`${day}T00:00:00-06:00`);
      const end = new Date(start.getTime() + 86_400_000);

      const invoices = await ctx.db.saleInvoice.findMany({
        where: { createdAt: { gte: start, lt: end } },
        include: invoiceBalanceInclude,
      });
      const salesTotal = sum(invoices.map((i) => invoiceBalance(i).total));
      const creditTotal = sum(invoices.filter((i) => i.paymentTerms === "CREDITO").map((i) => invoiceBalance(i).total));

      const payments = await ctx.db.customerPayment.findMany({
        where: { paidAt: { gte: start, lt: end } },
        include: { paymentMethod: true },
      });
      const byMethod = new Map<string, ReturnType<typeof D>>();
      for (const p of payments) {
        const key = p.paymentMethod.name;
        byMethod.set(key, (byMethod.get(key) ?? D(0)).plus(toNio(p.amount, p.currency, p.exchangeRate)));
      }
      const received = sum([...byMethod.values()]);

      const withdrawals = sum(
        (await ctx.db.cashWithdrawal.findMany({ where: { withdrawnOn: dayToDate(day) } })).map((w) => w.amount),
      );
      const advances = sum(
        (await ctx.db.staffAdvance.findMany({ where: { givenOn: dayToDate(day) } })).map((a) => a.amount),
      );

      const orders = await ctx.db.serviceOrder.findMany({
        include: { statusChanges: { orderBy: [{ changedAt: "desc" }, { id: "desc" }], take: 1 } },
        take: 1000,
        orderBy: { id: "desc" },
      });
      const openOrders = orders.filter(
        (o) => !FINAL_SERVICE_STATUSES.includes((o.statusChanges[0]?.status ?? "RECIBIDA") as ServiceOrderStatus),
      ).length;

      const lowStock = await ctx.db.product.findMany({
        where: { stock: { lte: input.lowStockThreshold } },
        orderBy: { stock: "asc" },
        select: { id: true, name: true, stock: true, barcode: true },
        take: 50,
      });

      return {
        day,
        sales: { count: invoices.length, total: salesTotal, credit: creditTotal },
        received: { total: received, byMethod: [...byMethod.entries()].map(([method, amount]) => ({ method, amount })) },
        withdrawals,
        advances,
        cashBalance: received.minus(withdrawals).minus(advances),
        openOrders,
        lowStock,
      };
    }),

  /**
   * Reports by period (day / week / month buckets) for the charts, plus totals
   * compared with the previous period of the same length. Weeks start on Monday.
   * Everything is grouped in Managua time (DEC-038) and in córdobas (DEC-025).
   */
  period: permissionProcedure("reportes.ver")
    .input(z.object({ from: zDay, to: zDay, granularity: z.enum(["day", "week", "month"]) }))
    .query(async ({ ctx, input }) => {
      if (input.to < input.from) throw fail("La fecha final es antes de la inicial.");
      const days = (Date.parse(input.to) - Date.parse(input.from)) / 86_400_000 + 1;
      if (days > 731) throw fail("El rango máximo es de dos años.");
      const g = Prisma.raw(`'${input.granularity}'`);
      const step = Prisma.raw(`'1 ${input.granularity}'`);
      const from = input.from;
      const to = input.to;

      const series = await ctx.db.$queryRaw<
        { bucket: Date; cash: string; credit: string; invoices: number; received: string; delivered: number }[]
      >`
        WITH b AS (
          SELECT generate_series(date_trunc(${g}, ${from}::date), date_trunc(${g}, ${to}::date), ${step}::interval)::date AS bucket
        ),
        sales AS (
          SELECT date_trunc(${g}, (si.created_at AT TIME ZONE 'America/Managua'))::date AS bucket,
                 sum(CASE WHEN si.payment_terms = 'CONTADO' THEN l.quantity * l.unit_price - l.discount_amount ELSE 0 END) AS cash,
                 sum(CASE WHEN si.payment_terms = 'CREDITO' THEN l.quantity * l.unit_price - l.discount_amount ELSE 0 END) AS credit,
                 count(DISTINCT si.id)::int AS invoices
            FROM sale_invoice si JOIN sale_invoice_line l ON l.sale_invoice_id = si.id
           WHERE (si.created_at AT TIME ZONE 'America/Managua')::date BETWEEN ${from}::date AND ${to}::date
           GROUP BY 1
        ),
        pay AS (
          SELECT date_trunc(${g}, (cp.paid_at AT TIME ZONE 'America/Managua'))::date AS bucket,
                 sum(CASE WHEN cp.currency = 'USD' THEN round(cp.amount * cp.exchange_rate, 2) ELSE cp.amount END) AS received
            FROM customer_payment cp
           WHERE (cp.paid_at AT TIME ZONE 'America/Managua')::date BETWEEN ${from}::date AND ${to}::date
           GROUP BY 1
        ),
        delivered AS (
          SELECT date_trunc(${g}, (sc.changed_at AT TIME ZONE 'America/Managua'))::date AS bucket, count(*)::int AS delivered
            FROM service_order_status_change sc
           WHERE sc.status = 'ENTREGADA'
             AND (sc.changed_at AT TIME ZONE 'America/Managua')::date BETWEEN ${from}::date AND ${to}::date
           GROUP BY 1
        )
        SELECT b.bucket,
               coalesce(s.cash, 0)::text AS cash, coalesce(s.credit, 0)::text AS credit,
               coalesce(s.invoices, 0) AS invoices, coalesce(p.received, 0)::text AS received,
               coalesce(d.delivered, 0) AS delivered
          FROM b
          LEFT JOIN sales s ON s.bucket = b.bucket
          LEFT JOIN pay p ON p.bucket = b.bucket
          LEFT JOIN delivered d ON d.bucket = b.bucket
         ORDER BY b.bucket`;

      const topProducts = await ctx.db.$queryRaw<{ id: number; name: string; quantity: number; revenue: string }[]>`
        SELECT p.id, p.name, sum(l.quantity)::int AS quantity,
               sum(l.quantity * l.unit_price - l.discount_amount)::text AS revenue
          FROM sale_invoice_line l
          JOIN sale_invoice si ON si.id = l.sale_invoice_id
          JOIN product p ON p.id = l.product_id
         WHERE l.line_type = 'PRODUCTO'
           AND (si.created_at AT TIME ZONE 'America/Managua')::date BETWEEN ${from}::date AND ${to}::date
         GROUP BY p.id, p.name
         ORDER BY sum(l.quantity * l.unit_price - l.discount_amount) DESC
         LIMIT 8`;

      /** Totals of a range, used for this period and the previous one. */
      const totals = async (f: string, t: string) => {
        const [r] = await ctx.db.$queryRaw<
          { sales: string; invoices: number; labor: string; received: string; withdrawals: string; delivered: number }[]
        >`
          SELECT
            (SELECT coalesce(sum(l.quantity * l.unit_price - l.discount_amount), 0) FROM sale_invoice si JOIN sale_invoice_line l ON l.sale_invoice_id = si.id
              WHERE (si.created_at AT TIME ZONE 'America/Managua')::date BETWEEN ${f}::date AND ${t}::date)::text AS sales,
            (SELECT count(*) FROM sale_invoice si
              WHERE (si.created_at AT TIME ZONE 'America/Managua')::date BETWEEN ${f}::date AND ${t}::date)::int AS invoices,
            (SELECT coalesce(sum(l.quantity * l.unit_price - l.discount_amount), 0) FROM sale_invoice si JOIN sale_invoice_line l ON l.sale_invoice_id = si.id
              WHERE l.line_type = 'MANO_OBRA' AND (si.created_at AT TIME ZONE 'America/Managua')::date BETWEEN ${f}::date AND ${t}::date)::text AS labor,
            (SELECT coalesce(sum(CASE WHEN currency = 'USD' THEN round(amount * exchange_rate, 2) ELSE amount END), 0) FROM customer_payment
              WHERE (paid_at AT TIME ZONE 'America/Managua')::date BETWEEN ${f}::date AND ${t}::date)::text AS received,
            (SELECT coalesce(sum(amount), 0) FROM cash_withdrawal WHERE withdrawn_on BETWEEN ${f}::date AND ${t}::date)::text AS withdrawals,
            (SELECT count(*) FROM service_order_status_change WHERE status = 'ENTREGADA'
              AND (changed_at AT TIME ZONE 'America/Managua')::date BETWEEN ${f}::date AND ${t}::date)::int AS delivered`;
        return r!;
      };
      const shift = (day: string, n: number) => new Date(Date.parse(day) + n * 86_400_000).toISOString().slice(0, 10);
      const current = await totals(from, to);
      const previous = await totals(shift(from, -days), shift(from, -1));

      return {
        from,
        to,
        granularity: input.granularity,
        series: series.map((r) => ({
          bucket: r.bucket.toISOString().slice(0, 10),
          cash: r.cash,
          credit: r.credit,
          invoices: Number(r.invoices),
          received: r.received,
          delivered: Number(r.delivered),
        })),
        topProducts: topProducts.map((p) => ({ ...p, id: Number(p.id), quantity: Number(p.quantity) })),
        current: { ...current, invoices: Number(current.invoices), delivered: Number(current.delivered) },
        previous: { ...previous, invoices: Number(previous.invoices), delivered: Number(previous.delivered) },
        previousRange: { from: shift(from, -days), to: shift(from, -1) },
      };
    }),
});
