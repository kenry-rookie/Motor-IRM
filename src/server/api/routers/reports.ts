import { z } from "zod";

import { fail } from "~/server/api/errors";
import { createTRPCRouter, permissionProcedure } from "~/server/api/trpc";
import { zDay } from "~/server/domain/constants";

/**
 * API-023 — what the owners check. ONE report with a period (DEC-043): "today"
 * is just the preset from = to = today. Besides the charts it returns the money
 * received by method, withdrawals and advances of the period, and two snapshots
 * that don't depend on the period: open orders and low stock.
 * Everything is grouped in Managua time (DEC-038) and in córdobas (DEC-025).
 */
export const reportsRouter = createTRPCRouter({
  /**
   * Reports by period (day / week / month buckets) for the charts, plus totals
   * compared with the previous period of the same length. Weeks start on Monday.
   * Everything is grouped in Managua time (DEC-038) and in córdobas (DEC-025).
   */
  period: permissionProcedure("reportes.ver")
    .input(
      z.object({
        from: zDay,
        to: zDay,
        granularity: z.enum(["day", "week", "month"]).default("day"),
        lowStockThreshold: z.number().int().min(0).default(2),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (input.to < input.from) throw fail("La fecha final es antes de la inicial.");
      const days = (Date.parse(input.to) - Date.parse(input.from)) / 86_400_000 + 1;
      if (days > 731) throw fail("El rango máximo es de dos años.");
      // Plain parameters only (DEC-046): a Prisma.raw fragment here reached
      // PostgreSQL as jsonb under Next.js ("date_trunc(jsonb, date)").
      const g = input.granularity;
      const step = `1 ${input.granularity}`;
      const from = input.from;
      const to = input.to;

      const series = await ctx.db.$queryRaw<
        { bucket: Date; cash: string; credit: string; invoices: number; received: string; delivered: number }[]
      >`
        WITH b AS (
          SELECT generate_series(date_trunc(${g}::text, ${from}::date), date_trunc(${g}::text, ${to}::date), ${step}::interval)::date AS bucket
        ),
        sales AS (
          SELECT date_trunc(${g}::text, (si.created_at AT TIME ZONE 'America/Managua'))::date AS bucket,
                 sum(CASE WHEN si.payment_terms = 'CONTADO' THEN l.quantity * l.unit_price - l.discount_amount ELSE 0 END) AS cash,
                 sum(CASE WHEN si.payment_terms = 'CREDITO' THEN l.quantity * l.unit_price - l.discount_amount ELSE 0 END) AS credit,
                 count(DISTINCT si.id)::int AS invoices
            FROM sale_invoice si JOIN sale_invoice_line l ON l.sale_invoice_id = si.id
           WHERE (si.created_at AT TIME ZONE 'America/Managua')::date BETWEEN ${from}::date AND ${to}::date
             AND NOT EXISTS (SELECT 1 FROM sale_invoice_void v WHERE v.sale_invoice_id = si.id)
           GROUP BY 1
        ),
        pay AS (
          -- Money in, minus the cash given back when an invoice was voided (DEC-055).
          SELECT bucket, sum(amount) AS received FROM (
            SELECT date_trunc(${g}::text, (cp.paid_at AT TIME ZONE 'America/Managua'))::date AS bucket,
                   CASE WHEN cp.currency = 'USD' THEN round(cp.amount * cp.exchange_rate, 2) ELSE cp.amount END AS amount
              FROM customer_payment cp
             WHERE (cp.paid_at AT TIME ZONE 'America/Managua')::date BETWEEN ${from}::date AND ${to}::date
            UNION ALL
            SELECT date_trunc(${g}::text, (v.voided_at AT TIME ZONE 'America/Managua'))::date, -v.refund_amount
              FROM sale_invoice_void v
             WHERE (v.voided_at AT TIME ZONE 'America/Managua')::date BETWEEN ${from}::date AND ${to}::date
          ) x
           GROUP BY 1
        ),
        delivered AS (
          SELECT date_trunc(${g}::text, (sc.changed_at AT TIME ZONE 'America/Managua'))::date AS bucket, count(*)::int AS delivered
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
           AND NOT EXISTS (SELECT 1 FROM sale_invoice_void v WHERE v.sale_invoice_id = si.id)
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
              WHERE (si.created_at AT TIME ZONE 'America/Managua')::date BETWEEN ${f}::date AND ${t}::date
                AND NOT EXISTS (SELECT 1 FROM sale_invoice_void v WHERE v.sale_invoice_id = si.id))::text AS sales,
            (SELECT count(*) FROM sale_invoice si
              WHERE (si.created_at AT TIME ZONE 'America/Managua')::date BETWEEN ${f}::date AND ${t}::date
                AND NOT EXISTS (SELECT 1 FROM sale_invoice_void v WHERE v.sale_invoice_id = si.id))::int AS invoices,
            (SELECT coalesce(sum(l.quantity * l.unit_price - l.discount_amount), 0) FROM sale_invoice si JOIN sale_invoice_line l ON l.sale_invoice_id = si.id
              WHERE l.line_type = 'MANO_OBRA' AND (si.created_at AT TIME ZONE 'America/Managua')::date BETWEEN ${f}::date AND ${t}::date
                AND NOT EXISTS (SELECT 1 FROM sale_invoice_void v WHERE v.sale_invoice_id = si.id))::text AS labor,
            ((SELECT coalesce(sum(CASE WHEN currency = 'USD' THEN round(amount * exchange_rate, 2) ELSE amount END), 0) FROM customer_payment
              WHERE (paid_at AT TIME ZONE 'America/Managua')::date BETWEEN ${f}::date AND ${t}::date)
             - (SELECT coalesce(sum(refund_amount), 0) FROM sale_invoice_void
              WHERE (voided_at AT TIME ZONE 'America/Managua')::date BETWEEN ${f}::date AND ${t}::date))::text AS received,
            (SELECT coalesce(sum(amount), 0) FROM cash_withdrawal WHERE withdrawn_on BETWEEN ${f}::date AND ${t}::date)::text AS withdrawals,
            (SELECT count(*) FROM service_order_status_change WHERE status = 'ENTREGADA'
              AND (changed_at AT TIME ZONE 'America/Managua')::date BETWEEN ${f}::date AND ${t}::date)::int AS delivered`;
        return r!;
      };
      const byMethod = await ctx.db.$queryRaw<{ method: string; amount: string }[]>`
        SELECT pm.name AS method,
               sum(CASE WHEN cp.currency = 'USD' THEN round(cp.amount * cp.exchange_rate, 2) ELSE cp.amount END)::text AS amount
          FROM customer_payment cp
          JOIN payment_method pm ON pm.id = cp.payment_method_id
         WHERE (cp.paid_at AT TIME ZONE 'America/Managua')::date BETWEEN ${from}::date AND ${to}::date
         GROUP BY pm.name
         ORDER BY 2 DESC`;
      // Money in and out of the drawer in the period; for "today" the net is what should be in the cash box.
      const [cashOut] = await ctx.db.$queryRaw<{ withdrawals: string; advances: string; net: string }[]>`
        WITH m AS (
          SELECT (SELECT coalesce(sum(CASE WHEN currency = 'USD' THEN round(amount * exchange_rate, 2) ELSE amount END), 0)
                    FROM customer_payment WHERE (paid_at AT TIME ZONE 'America/Managua')::date BETWEEN ${from}::date AND ${to}::date) AS received,
                 (SELECT coalesce(sum(amount), 0) FROM cash_withdrawal WHERE withdrawn_on BETWEEN ${from}::date AND ${to}::date) AS withdrawals,
                 (SELECT coalesce(sum(amount), 0) FROM staff_advance WHERE given_on BETWEEN ${from}::date AND ${to}::date) AS advances,
                 (SELECT coalesce(sum(refund_amount), 0) FROM sale_invoice_void
                   WHERE (voided_at AT TIME ZONE 'America/Managua')::date BETWEEN ${from}::date AND ${to}::date) AS refunds
        )
        SELECT withdrawals::text, advances::text, (received - withdrawals - advances - refunds)::text AS net FROM m`;
      const [orders] = await ctx.db.$queryRaw<{ open: number }[]>`
        SELECT count(*)::int AS open FROM v_service_order_status WHERE status NOT IN ('ENTREGADA', 'CANCELADA')`;
      const lowStock = await ctx.db.product.findMany({
        where: { stock: { lte: input.lowStockThreshold } },
        orderBy: { stock: "asc" },
        select: { id: true, name: true, stock: true, barcode: true },
        take: 50,
      });

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
        receivedByMethod: byMethod,
        withdrawals: cashOut!.withdrawals,
        advances: cashOut!.advances,
        cashNet: cashOut!.net,
        openOrders: Number(orders!.open),
        lowStock,
      };
    }),
});
