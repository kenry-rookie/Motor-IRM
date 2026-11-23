import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { DOC_PREFIX, type DocKind, parseDocNo } from "~/lib/business";
import { fail } from "~/server/api/errors";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { type PermissionCode } from "~/server/auth/permissions";
import { LABELS, MONEY_KINDS, type MoneyKind, zDay } from "~/server/domain/constants";
import { D, type Dec } from "~/server/domain/money";
import { Sql } from "~/server/domain/sql";

/**
 * Comprobantes (Kenry, 23-nov: «que se puedan ver todos, tener detalles»):
 * every money document in one list — receipts of customer payments, cash
 * withdrawals, supplier payments, trips, refunds, mechanics' pay — read from
 * v_money_movement (DEC-058), one row per document. Each row opens its own
 * detail window in the screen.
 */
const VIEW: PermissionCode[] = ["caja.arqueo", "reportes.ver", "caja.retiros"];
const viewProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!VIEW.some((c) => ctx.user.permissions.has(c)))
    throw new TRPCError({ code: "FORBIDDEN", message: "Su rol no tiene permiso para ver los comprobantes de dinero." });
  return next();
});

/** Which tables each document kind lives in (for the number search: "RT-12" → cash_withdrawal 12). */
const KIND_TABLES: Partial<Record<DocKind, string[]>> = {
  recibo: ["customer_payment"],
  retiro: ["cash_withdrawal"],
  pagoProveedor: ["supplier_payment"],
  viaje: ["purchase_trip"],
  factura: ["sale_invoice_void"],
  devolucion: ["customer_return"],
  adelanto: ["staff_advance"],
  pagoMecanico: ["staff_payout"],
  garantia: ["warranty_claim"],
};

export const moneyRouter = createTRPCRouter({
  list: viewProcedure
    .input(
      z.object({
        from: zDay,
        to: zDay,
        kind: z.enum(MONEY_KINDS).optional(),
        /** CAJA = only cash of the drawer; FUERA = transfers, trip money, owner's money. */
        drawer: z.enum(["TODOS", "CAJA", "FUERA"]).default("TODOS"),
        direction: z.enum(["TODAS", "ENTRADA", "SALIDA"]).default("TODAS"),
        /** Number (R-45, RT-12, 45), customer or supplier name, or text of the detail. */
        text: z.string().trim().max(100).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (input.to < input.from) throw fail("La fecha final es antes de la inicial.");
      const q = new Sql();
      const where = [`m.business_day BETWEEN ${q.p(input.from, "date")} AND ${q.p(input.to, "date")}`];
      if (input.drawer === "CAJA") where.push("m.in_drawer");
      if (input.drawer === "FUERA") where.push("NOT m.in_drawer");
      if (input.direction !== "TODAS") where.push(`m.direction = ${q.p(input.direction)}`);
      const having: string[] = [];
      if (input.kind) having.push(`bool_or(m.kind = ${q.p(input.kind)})`);
      if (input.text) {
        const doc = parseDocNo(input.text);
        const tables = doc?.kind ? (KIND_TABLES[doc.kind] ?? []) : null;
        const byText = `(mirm_norm(coalesce(c.name, '') || ' ' || coalesce(s.name, '') || ' ' || m.detail) LIKE '%' || mirm_norm(${q.p(input.text)}) || '%')`;
        where.push(
          doc
            ? `((m.ref_id = ${q.p(doc.id, "int")}${tables ? ` AND m.ref_table IN (${tables.map((t) => q.p(t)).join(",")})` : ""}) OR ${byText})`
            : byText,
        );
      }
      const rows = await q.run<
        {
          ref_table: string;
          ref_id: number;
          business_day: Date;
          occurred_at: Date | null;
          direction: "ENTRADA" | "SALIDA";
          in_drawer: boolean;
          method: string;
          currency: "NIO" | "USD";
          amount: Dec;
          amount_nio: Dec;
          kinds: MoneyKind[];
          detail: string;
          sale_invoice_id: number | null;
          customer_id: number | null;
          customer_name: string | null;
          supplier_id: number | null;
          supplier_name: string | null;
          trip_id: number | null;
          user_name: string | null;
        }[]
      >(
        ctx.db,
        `SELECT m.ref_table, m.ref_id,
                min(m.business_day) AS business_day,
                min(m.occurred_at) AS occurred_at,
                min(m.direction) AS direction,
                bool_or(m.in_drawer) AS in_drawer,
                min(m.method) AS method,
                min(m.currency) AS currency,
                sum(m.amount) AS amount,
                sum(m.amount_nio) AS amount_nio,
                array_agg(DISTINCT m.kind) AS kinds,
                string_agg(DISTINCT m.detail, ' · ') AS detail,
                min(m.sale_invoice_id) AS sale_invoice_id,
                min(m.customer_id) AS customer_id, min(c.name) AS customer_name,
                min(m.supplier_id) AS supplier_id, min(s.name) AS supplier_name,
                min(CASE WHEN m.ref_table = 'purchase_trip' THEN m.ref_id ELSE coalesce(e.purchase_trip_id, spp.purchase_trip_id) END) AS trip_id,
                min(coalesce(st.name, u.username)) AS user_name
           FROM v_money_movement m
           LEFT JOIN customer c ON c.id = m.customer_id
           LEFT JOIN supplier s ON s.id = m.supplier_id
           LEFT JOIN purchase_trip_expense e ON m.ref_table = 'purchase_trip_expense' AND e.id = m.ref_id
           LEFT JOIN supplier_payment spp ON m.ref_table = 'supplier_payment' AND spp.id = m.ref_id
           LEFT JOIN app_user u ON u.id = m.user_id
           LEFT JOIN staff st ON st.id = u.staff_id
          WHERE ${where.join(" AND ")}
          GROUP BY m.ref_table, m.ref_id, m.direction
          ${having.length ? `HAVING ${having.join(" AND ")}` : ""}
          ORDER BY min(m.business_day) DESC, min(m.occurred_at) DESC NULLS LAST, m.ref_id DESC
          LIMIT 1000`,
      );
      const items = rows.map((r) => ({
        refTable: r.ref_table,
        refId: r.ref_id,
        day: r.business_day.toISOString().slice(0, 10),
        occurredAt: r.occurred_at,
        direction: r.direction,
        inDrawer: r.in_drawer,
        method: r.method,
        currency: r.currency,
        amount: D(r.amount),
        amountNio: D(r.amount_nio),
        kinds: r.kinds,
        labels: r.kinds.map((k) => LABELS.moneyKind[k] ?? k),
        detail: r.detail,
        saleInvoiceId: r.sale_invoice_id,
        customer: r.customer_id ? { id: r.customer_id, name: r.customer_name ?? "" } : null,
        supplier: r.supplier_id ? { id: r.supplier_id, name: r.supplier_name ?? "" } : null,
        tripId: r.trip_id,
        user: r.user_name,
      }));
      const tot = (dir: "ENTRADA" | "SALIDA", drawer: boolean) =>
        items.filter((i) => i.direction === dir && i.inDrawer === drawer).reduce<Dec>((a, i) => a.plus(i.amountNio), D(0));
      return {
        items,
        truncated: items.length === 1000,
        totals: {
          inDrawer: tot("ENTRADA", true),
          outDrawer: tot("SALIDA", true),
          inOther: tot("ENTRADA", false),
          outOther: tot("SALIDA", false),
        },
      };
    }),

  /** For the screen: the prefixes, so it can show «R-000045». */
  prefixes: viewProcedure.query(() => DOC_PREFIX),
});
