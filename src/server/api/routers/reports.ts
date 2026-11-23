import { z } from "zod";

import { fail } from "~/server/api/errors";
import { createTRPCRouter, permissionProcedure, protectedProcedure } from "~/server/api/trpc";
import { dayToDate, LABELS, MONEY_IN_KINDS, MONEY_OUT_KINDS, type MoneyKind, todayInManagua, zDay } from "~/server/domain/constants";
import { LOW_STOCK } from "~/server/domain/search";

const nioFmt = new Intl.NumberFormat("es-NI", { style: "currency", currency: "NIO", minimumFractionDigits: 2 });
const fmtNio = (v: string) => nioFmt.format(Number(v));
const dayFmt = new Intl.DateTimeFormat("es-NI", { timeZone: "UTC", dateStyle: "medium" });
const formatDayEs = (day: string) => dayFmt.format(new Date(`${day}T00:00:00Z`));
import { D, type Dec, sum } from "~/server/domain/money";

/**
 * API-023 — what the owners check. ONE report with a period (DEC-043): "today"
 * is just the preset from = to = today. Besides the charts it returns the money
 * received by method, withdrawals and advances of the period, and two snapshots
 * that don't depend on the period: open orders and low stock.
 * Everything is grouped in Managua time (DEC-038) and in córdobas (DEC-025).
 */
type Notice = {
  key: string;
  tone: "red" | "amber" | "info";
  title: string;
  detail: string;
  href: string;
  action: string;
};

export const reportsRouter = createTRPCRouter({
  /**
   * «Lo que necesita atención» (Kenry, 23-nov): what someone should do today,
   * each with a button to the screen where it is done. Not tied to a period.
   * Each notice only appears to whoever can act on it (by permission).
   */
  attention: protectedProcedure.query(async ({ ctx }) => {
    const can = (p: string) => ctx.user.permissions.has(p);
    const out: Notice[] = [];
    const today = todayInManagua();
    const days = (d: Date | string) => Math.max(0, Math.round((Date.parse(today) - Date.parse(new Date(d).toISOString().slice(0, 10))) / 86_400_000));
    const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

    if (can("caja.arqueo") || can("reportes.ver")) {
      const open = await ctx.db.cashSession.findFirst({ where: { closedAt: null }, select: { businessDay: true } });
      const openDay = open?.businessDay.toISOString().slice(0, 10);
      if (openDay && openDay !== today) {
        out.push({
          key: "caja-vieja",
          tone: "red",
          title: `La caja del ${formatDayEs(openDay)} sigue abierta`,
          detail: "Ciérrela con el conteo del dinero; después abra la de hoy.",
          href: "/arqueo",
          action: "Cerrar esa caja",
        });
      } else if (!open) {
        const todays = await ctx.db.cashSession.findUnique({ where: { businessDay: dayToDate(today) }, select: { id: true } });
        if (!todays)
          out.push({ key: "caja-hoy", tone: "info", title: "La caja de hoy no está abierta", detail: "Ábrala con el dinero con que empieza el día.", href: "/arqueo", action: "Abrir caja" });
      }
    }

    if (can("taller.ver")) {
      const rows = await ctx.db.$queryRaw<{ status: string; n: number; oldest: Date | null }[]>`
        SELECT st.status, count(*)::int AS n, min(st.status_since) AS oldest
          FROM v_service_order_status st
         WHERE st.status IN ('TERMINADA', 'EN_PRUEBA', 'ESPERA_REPUESTO', 'ESPERA_CLIENTE')
         GROUP BY st.status`;
      const of = (...ss: string[]) => rows.filter((r) => ss.includes(r.status));
      const ready = of("TERMINADA", "EN_PRUEBA");
      const nReady = ready.reduce((a, r) => a + Number(r.n), 0);
      if (nReady > 0) {
        const oldest = ready.map((r) => r.oldest).filter(Boolean).sort((a, b) => +a! - +b!)[0];
        const d = oldest ? days(oldest) : 0;
        out.push({
          key: "motos-listas",
          tone: d >= 3 ? "red" : "amber",
          title: `${plural(nReady, "moto lista", "motos listas")} sin entregar`,
          detail: d > 0 ? `La más vieja está lista desde hace ${plural(d, "día", "días")}. Avise al cliente para que la retire y la pague.` : "Avise al cliente para que la retire y la pague.",
          href: "/taller",
          action: "Ver el taller",
        });
      }
      const nParts = of("ESPERA_REPUESTO").reduce((a, r) => a + Number(r.n), 0);
      if (nParts > 0)
        out.push({
          key: "espera-repuesto",
          tone: "info",
          title: `${plural(nParts, "moto espera", "motos esperan")} un repuesto`,
          detail: "Revise si ya se pidió o si llegó en la última compra.",
          href: "/taller",
          action: "Ver el taller",
        });
      const [noResp] = await ctx.db.$queryRaw<{ n: number }[]>`
        SELECT count(*)::int AS n FROM service_order so JOIN v_service_order_status st ON st.service_order_id = so.id
         WHERE so.mechanic_staff_id IS NULL AND st.status NOT IN ('ENTREGADA', 'CANCELADA')`;
      if (Number(noResp?.n ?? 0) > 0)
        out.push({
          key: "sin-responsable",
          tone: "amber",
          title: `${plural(Number(noResp!.n), "moto no tiene", "motos no tienen")} mecánico asignado`,
          detail: "Sin responsable no se puede cobrar la orden.",
          href: "/taller",
          action: "Asignar",
        });
    }

    if (can("compras.ver")) {
      const trips = await ctx.db.purchaseTrip.findMany({ where: { status: "ABIERTO" }, orderBy: { tripDate: "asc" }, select: { id: true, tripDate: true, destination: true } });
      if (trips.length) {
        const d = days(trips[0]!.tripDate);
        out.push({
          key: "viajes-abiertos",
          tone: d >= 2 ? "amber" : "info",
          title: `${plural(trips.length, "viaje de compras abierto", "viajes de compras abiertos")}`,
          detail: `${trips.length === 1 ? `A ${trips[0]!.destination}. ` : ""}Al regresar, ciérrelo con el vuelto para que la caja cuadre.`,
          href: trips.length === 1 ? `/compras/viajes/${trips[0]!.id}` : "/compras?ver=viajes",
          action: trips.length === 1 ? "Abrir el viaje" : "Ver viajes",
        });
      }
      const [sup] = await ctx.db.$queryRaw<{ n: number; overdue: string }[]>`
        SELECT count(*)::int AS n, coalesce(sum(overdue), 0)::text AS overdue FROM v_supplier_balance WHERE overdue > 0`;
      if (Number(sup?.n ?? 0) > 0)
        out.push({
          key: "proveedores-vencidos",
          tone: "amber",
          title: `Se deben ${fmtNio(sup!.overdue)} vencidos a ${plural(Number(sup!.n), "proveedor", "proveedores")}`,
          detail: "Facturas de compra al crédito que ya pasaron su fecha.",
          href: "/compras",
          action: "Ver compras",
        });
    }

    if (can("clientes.ver")) {
      const [cr] = await ctx.db.$queryRaw<{ n: number; overdue: string }[]>`
        SELECT count(*)::int AS n, coalesce(sum(overdue), 0)::text AS overdue FROM v_customer_balance WHERE overdue > 0`;
      if (Number(cr?.n ?? 0) > 0)
        out.push({
          key: "creditos-vencidos",
          tone: "red",
          title: `${plural(Number(cr!.n), "cliente debe", "clientes deben")} ${fmtNio(cr!.overdue)} vencidos`,
          detail: "Créditos que ya pasaron su fecha de pago. Llámelos o cóbreles cuando vengan.",
          href: "/clientes?deuda=vencida",
          action: "Ver quiénes",
        });
    }

    if (can("inventario.ver")) {
      const [st] = await ctx.db.$queryRaw<{ out: number; low: number }[]>`
        SELECT count(*) FILTER (WHERE stock = 0)::int AS out,
               count(*) FILTER (WHERE stock BETWEEN 1 AND ${LOW_STOCK})::int AS low
          FROM product WHERE active`;
      const nOut = Number(st?.out ?? 0);
      const nLow = Number(st?.low ?? 0);
      if (nOut + nLow > 0)
        out.push({
          key: "poco-stock",
          tone: nOut > 0 ? "amber" : "info",
          title: nOut > 0 ? `${plural(nOut, "producto agotado", "productos agotados")}` : `${plural(nLow, "producto con poco stock", "productos con poco stock")}`,
          detail: nOut > 0 && nLow > 0 ? `Y ${plural(nLow, "producto", "productos")} con 1 o 2 unidades.` : "Anótelos para el próximo viaje de compras.",
          href: nOut > 0 ? "/inventario?stock=agotado" : "/inventario?stock=poco",
          action: "Ver cuáles",
        });
    }

    const order = { red: 0, amber: 1, info: 2 } as const;
    return out.sort((a, b) => order[a.tone] - order[b.tone]);
  }),


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

      // Sales are NET of returns (Kenry, 23-nov): a returned product stops counting
      // as sold on the day it comes back. Voided invoices (and the returns their
      // void created) don't count at all.
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
        rets AS (
          SELECT date_trunc(${g}::text, (cr.returned_at AT TIME ZONE 'America/Managua'))::date AS bucket,
                 sum(CASE WHEN si.payment_terms = 'CONTADO'
                          THEN round((l.quantity * l.unit_price - l.discount_amount) / l.quantity * rl.quantity, 2) ELSE 0 END) AS cash,
                 sum(CASE WHEN si.payment_terms = 'CREDITO'
                          THEN round((l.quantity * l.unit_price - l.discount_amount) / l.quantity * rl.quantity, 2) ELSE 0 END) AS credit
            FROM customer_return cr
            JOIN customer_return_line rl ON rl.customer_return_id = cr.id
            JOIN sale_invoice_line l ON l.id = rl.sale_invoice_line_id
            JOIN sale_invoice si ON si.id = cr.sale_invoice_id
           WHERE (cr.returned_at AT TIME ZONE 'America/Managua')::date BETWEEN ${from}::date AND ${to}::date
             AND NOT EXISTS (SELECT 1 FROM sale_invoice_void v WHERE v.sale_invoice_id = si.id)
           GROUP BY 1
        ),
        pay AS (
          -- Money from customers (every method) minus the money given back, from the
          -- same view as the arqueo and Comprobantes (v_money_movement, DEC-058).
          SELECT date_trunc(${g}::text, m.business_day)::date AS bucket,
                 sum(CASE WHEN m.direction = 'ENTRADA' THEN m.amount_nio ELSE -m.amount_nio END) AS received
            FROM v_money_movement m
           WHERE m.business_day BETWEEN ${from}::date AND ${to}::date
             AND m.kind IN ('COBRO_VENTA', 'COBRO_TALLER', 'ABONO_CLIENTE', 'COBRO_SIN_REPARTIR',
                            'REEMBOLSO_DEVOLUCION', 'REEMBOLSO_ANULACION', 'REEMBOLSO_GARANTIA')
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
               (coalesce(s.cash, 0) - coalesce(r.cash, 0))::text AS cash,
               (coalesce(s.credit, 0) - coalesce(r.credit, 0))::text AS credit,
               coalesce(s.invoices, 0) AS invoices, coalesce(p.received, 0)::text AS received,
               coalesce(d.delivered, 0) AS delivered
          FROM b
          LEFT JOIN sales s ON s.bucket = b.bucket
          LEFT JOIN rets r ON r.bucket = b.bucket
          LEFT JOIN pay p ON p.bucket = b.bucket
          LEFT JOIN delivered d ON d.bucket = b.bucket
         ORDER BY b.bucket`;

      const topProducts = await ctx.db.$queryRaw<{ id: number; name: string; quantity: number; revenue: string }[]>`
        WITH sold AS (
          SELECT l.product_id, l.quantity, l.quantity * l.unit_price - l.discount_amount AS revenue
            FROM sale_invoice_line l
            JOIN sale_invoice si ON si.id = l.sale_invoice_id
           WHERE l.line_type = 'PRODUCTO'
             AND (si.created_at AT TIME ZONE 'America/Managua')::date BETWEEN ${from}::date AND ${to}::date
             AND NOT EXISTS (SELECT 1 FROM sale_invoice_void v WHERE v.sale_invoice_id = si.id)
          UNION ALL
          SELECT l.product_id, -rl.quantity, -round((l.quantity * l.unit_price - l.discount_amount) / l.quantity * rl.quantity, 2)
            FROM customer_return cr
            JOIN customer_return_line rl ON rl.customer_return_id = cr.id
            JOIN sale_invoice_line l ON l.id = rl.sale_invoice_line_id
           WHERE (cr.returned_at AT TIME ZONE 'America/Managua')::date BETWEEN ${from}::date AND ${to}::date
             AND NOT EXISTS (SELECT 1 FROM sale_invoice_void v WHERE v.sale_invoice_id = cr.sale_invoice_id)
        )
        SELECT p.id, p.name, sum(x.quantity)::int AS quantity, sum(x.revenue)::text AS revenue
          FROM sold x JOIN product p ON p.id = x.product_id
         GROUP BY p.id, p.name
        HAVING sum(x.revenue) > 0
         ORDER BY sum(x.revenue) DESC
         LIMIT 8`;

      /**
       * Totals of a range, used for this period and the previous one.
       *
       * Ganancia (Kenry, 23-nov), two kinds:
       *  - Taller: labor charged − the mechanics' part of it. An owner's job is
       *    all profit; a mechanic with a rate keeps rate × labor; the «100 %»
       *    mechanic (a mechanic without a rate) keeps all of it. Commission is
       *    earned when the order is delivered (ENTREGADA), so a cancellation fee
       *    is the shop's.
       *  - Productos (shelves): what products were sold for − what they cost
       *    (the cost stored on each inventory exit, DEC-024), for counter sales
       *    and for parts used in the workshop, minus what came back.
       *  External charges (lathe, welding done outside) are passed through, not profit.
       */
      const totals = async (f: string, t: string) => {
        const [r] = await ctx.db.$queryRaw<
          {
            invoices: number;
            gross: string;
            returns: string;
            counter_sales: string;
            counter_cost: string;
            parts_sales: string;
            parts_cost: string;
            counter_ret: string;
            counter_ret_cost: string;
            parts_ret: string;
            parts_ret_cost: string;
            labor: string;
            mechanics_share: string;
            external: string;
            received: string;
            withdrawals: string;
            delivered: number;
            trip_expenses: string;
          }[]
        >`
          WITH inv AS (
            SELECT si.id, si.service_order_id
              FROM sale_invoice si
             WHERE (si.created_at AT TIME ZONE 'America/Managua')::date BETWEEN ${f}::date AND ${t}::date
               AND NOT EXISTS (SELECT 1 FROM sale_invoice_void v WHERE v.sale_invoice_id = si.id)
          ),
          lines AS (
            SELECT inv.service_order_id, l.line_type,
                   l.quantity * l.unit_price - l.discount_amount AS net,
                   (SELECT coalesce(sum(m.quantity * m.unit_cost), 0) FROM inventory_movement m WHERE m.sale_invoice_line_id = l.id) AS cost,
                   so.applied_commission_rate AS rate,
                   st.kind AS staff_kind,
                   EXISTS (SELECT 1 FROM service_order_status_change sc
                            WHERE sc.service_order_id = so.id AND sc.status = 'ENTREGADA') AS delivered
              FROM inv
              JOIN sale_invoice_line l ON l.sale_invoice_id = inv.id
              LEFT JOIN service_order so ON so.id = inv.service_order_id
              LEFT JOIN staff st ON st.id = so.mechanic_staff_id
          ),
          ret AS (
            SELECT si.service_order_id,
                   round((l.quantity * l.unit_price - l.discount_amount) / l.quantity * rl.quantity, 2) AS value,
                   (SELECT coalesce(sum(m.quantity * m.unit_cost), 0) FROM inventory_movement m WHERE m.customer_return_line_id = rl.id) AS cost
              FROM customer_return cr
              JOIN customer_return_line rl ON rl.customer_return_id = cr.id
              JOIN sale_invoice_line l ON l.id = rl.sale_invoice_line_id
              JOIN sale_invoice si ON si.id = cr.sale_invoice_id
             WHERE (cr.returned_at AT TIME ZONE 'America/Managua')::date BETWEEN ${f}::date AND ${t}::date
               AND NOT EXISTS (SELECT 1 FROM sale_invoice_void v WHERE v.sale_invoice_id = si.id)
          )
          SELECT
            (SELECT count(*) FROM inv)::int AS invoices,
            (SELECT coalesce(sum(net), 0) FROM lines)::text AS gross,
            (SELECT coalesce(sum(value), 0) FROM ret)::text AS returns,
            (SELECT coalesce(sum(net), 0) FROM lines WHERE line_type = 'PRODUCTO' AND service_order_id IS NULL)::text AS counter_sales,
            (SELECT coalesce(sum(cost), 0) FROM lines WHERE line_type = 'PRODUCTO' AND service_order_id IS NULL)::text AS counter_cost,
            (SELECT coalesce(sum(net), 0) FROM lines WHERE line_type = 'PRODUCTO' AND service_order_id IS NOT NULL)::text AS parts_sales,
            (SELECT coalesce(sum(cost), 0) FROM lines WHERE line_type = 'PRODUCTO' AND service_order_id IS NOT NULL)::text AS parts_cost,
            (SELECT coalesce(sum(value), 0) FROM ret WHERE service_order_id IS NULL)::text AS counter_ret,
            (SELECT coalesce(sum(cost), 0) FROM ret WHERE service_order_id IS NULL)::text AS counter_ret_cost,
            (SELECT coalesce(sum(value), 0) FROM ret WHERE service_order_id IS NOT NULL)::text AS parts_ret,
            (SELECT coalesce(sum(cost), 0) FROM ret WHERE service_order_id IS NOT NULL)::text AS parts_ret_cost,
            (SELECT coalesce(sum(net), 0) FROM lines WHERE line_type = 'MANO_OBRA')::text AS labor,
            (SELECT coalesce(sum(CASE WHEN NOT delivered OR staff_kind IS NULL OR staff_kind = 'DUENO' THEN 0
                                      WHEN rate IS NULL THEN net
                                      ELSE round(net * rate, 2) END), 0)
               FROM lines WHERE line_type = 'MANO_OBRA')::text AS mechanics_share,
            (SELECT coalesce(sum(net), 0) FROM lines WHERE line_type = 'CARGO_EXTERNO')::text AS external,
            (SELECT coalesce(sum(CASE WHEN direction = 'ENTRADA' THEN amount_nio ELSE -amount_nio END), 0)
               FROM v_money_movement
              WHERE business_day BETWEEN ${f}::date AND ${t}::date
                AND kind IN ('COBRO_VENTA', 'COBRO_TALLER', 'ABONO_CLIENTE', 'COBRO_SIN_REPARTIR',
                             'REEMBOLSO_DEVOLUCION', 'REEMBOLSO_ANULACION', 'REEMBOLSO_GARANTIA'))::text AS received,
            (SELECT coalesce(sum(amount), 0) FROM cash_withdrawal
              WHERE voided_at IS NULL AND withdrawn_on BETWEEN ${f}::date AND ${t}::date)::text AS withdrawals,
            (SELECT count(*) FROM service_order_status_change WHERE status = 'ENTREGADA'
              AND (changed_at AT TIME ZONE 'America/Managua')::date BETWEEN ${f}::date AND ${t}::date)::int AS delivered,
            (SELECT coalesce(sum(e.amount), 0) FROM purchase_trip_expense e JOIN purchase_trip pt ON pt.id = e.purchase_trip_id
              WHERE pt.trip_date BETWEEN ${f}::date AND ${t}::date)::text AS trip_expenses`;
        const x = r!;
        const counterSales = D(x.counter_sales).minus(x.counter_ret);
        const counterCost = D(x.counter_cost).minus(x.counter_ret_cost);
        const partsSales = D(x.parts_sales).minus(x.parts_ret);
        const partsCost = D(x.parts_cost).minus(x.parts_ret_cost);
        const shelfProfit = counterSales.minus(counterCost).plus(partsSales.minus(partsCost));
        const workshopProfit = D(x.labor).minus(x.mechanics_share);
        const profit = shelfProfit.plus(workshopProfit);
        return {
          invoices: Number(x.invoices),
          /** Sales net of returns (what the owners call «ventas»). */
          sales: D(x.gross).minus(x.returns).toString(),
          grossSales: x.gross,
          returns: x.returns,
          labor: x.labor,
          received: x.received,
          withdrawals: x.withdrawals,
          delivered: Number(x.delivered),
          tripExpenses: x.trip_expenses,
          profit: {
            total: profit.toString(),
            afterTrips: profit.minus(x.trip_expenses).toString(),
            workshop: { total: workshopProfit.toString(), labor: x.labor, mechanics: x.mechanics_share, external: x.external },
            shelf: {
              total: shelfProfit.toString(),
              counterSales: counterSales.toString(),
              counterCost: counterCost.toString(),
              partsSales: partsSales.toString(),
              partsCost: partsCost.toString(),
            },
          },
        };
      };

      // Money of the period by reason, from the same view as the arqueo (DEC-058):
      // the drawer lines add up to the drawer total; transfers and money that did
      // not touch the drawer are shown apart.
      const moneyRows = await ctx.db.$queryRaw<{ kind: MoneyKind; direction: "ENTRADA" | "SALIDA"; in_drawer: boolean; method: string; amount: string; n: number }[]>`
        SELECT kind, direction, in_drawer, CASE WHEN in_drawer THEN '' ELSE method END AS method,
               sum(amount_nio)::text AS amount, count(DISTINCT (ref_table, ref_id))::int AS n
          FROM v_money_movement
         WHERE business_day BETWEEN ${from}::date AND ${to}::date
         GROUP BY 1, 2, 3, 4`;
      const kindLines = (dir: "ENTRADA" | "SALIDA", inDrawer: boolean) => {
        const order = dir === "ENTRADA" ? MONEY_IN_KINDS : MONEY_OUT_KINDS;
        return order.flatMap((k) => {
          const rows = moneyRows.filter((r) => r.kind === k && r.direction === dir && r.in_drawer === inDrawer);
          if (!rows.length) return [];
          return [{ kind: k, label: LABELS.moneyKind[k], amount: sum(rows.map((r) => r.amount)).toString(), count: rows.reduce((a, r) => a + Number(r.n), 0) }];
        });
      };
      const drawerIn = kindLines("ENTRADA", true);
      const drawerOut = kindLines("SALIDA", true);
      const otherIn = Object.values(
        moneyRows
          .filter((r) => r.direction === "ENTRADA" && !r.in_drawer)
          .reduce<Record<string, { method: string; amount: Dec; count: number }>>((acc, r) => {
            const a = (acc[r.method] ??= { method: r.method, amount: D(0), count: 0 });
            a.amount = a.amount.plus(r.amount);
            a.count += Number(r.n);
            return acc;
          }, {}),
      ).map((x) => ({ ...x, amount: x.amount.toString() }));
      const otherOut = kindLines("SALIDA", false);
      const totalOf = (ls: { amount: string }[]) => sum(ls.map((l) => l.amount));
      const money = {
        drawerIn,
        drawerOut,
        drawerInTotal: totalOf(drawerIn).toString(),
        drawerOutTotal: totalOf(drawerOut).toString(),
        drawerNet: totalOf(drawerIn).minus(totalOf(drawerOut)).toString(),
        otherIn,
        otherInTotal: totalOf(otherIn).toString(),
        otherOut,
        otherOutTotal: totalOf(otherOut).toString(),
      };

      const [orders] = await ctx.db.$queryRaw<{ open: number }[]>`
        SELECT count(*)::int AS open FROM v_service_order_status WHERE status NOT IN ('ENTREGADA', 'CANCELADA')`;
      const lowStock = await ctx.db.product.findMany({
        where: { stock: { lte: input.lowStockThreshold }, active: true },
        orderBy: { stock: "asc" },
        select: { id: true, name: true, stock: true, barcode: true },
        take: 50,
      });

      // «¿Cuánto nos deben? ¿Cuánto debemos?» — right now, not tied to the period.
      const [debt] = await ctx.db.$queryRaw<
        {
          customers: string;
          customers_overdue: string;
          customers_n: number;
          suppliers: string;
          suppliers_overdue: string;
          suppliers_n: number;
          commissions: string;
          advances: string;
        }[]
      >`
        SELECT (SELECT coalesce(sum(balance), 0) FROM v_customer_balance WHERE balance > 0)::text AS customers,
               (SELECT coalesce(sum(overdue), 0) FROM v_customer_balance)::text AS customers_overdue,
               (SELECT count(*) FROM v_customer_balance WHERE balance > 0)::int AS customers_n,
               (SELECT coalesce(sum(balance), 0) FROM v_supplier_balance WHERE balance > 0)::text AS suppliers,
               (SELECT coalesce(sum(overdue), 0) FROM v_supplier_balance)::text AS suppliers_overdue,
               (SELECT count(*) FROM v_supplier_balance WHERE balance > 0)::int AS suppliers_n,
               (SELECT coalesce(sum(commission), 0) FROM v_mechanic_unpaid_commission)::text AS commissions,
               (SELECT coalesce(sum(amount), 0) FROM staff_advance WHERE staff_payout_id IS NULL)::text AS advances`;
      const d = debt!;
      const debts = {
        customers: { total: d.customers, overdue: d.customers_overdue, count: Number(d.customers_n) },
        suppliers: { total: d.suppliers, overdue: d.suppliers_overdue, count: Number(d.suppliers_n) },
        /** Commissions earned and not paid, minus the advances already given (what the mechanics still have to get). */
        mechanics: { commissions: d.commissions, advances: d.advances, net: D(d.commissions).minus(d.advances).toString() },
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
        current,
        previous,
        previousRange: { from: shift(from, -days), to: shift(from, -1) },
        money,
        debts,
        openOrders: Number(orders!.open),
        lowStock,
      };
    }),
});
