import { fail } from "~/server/api/errors";
import { type DbClient, type Prisma } from "~/server/db";
import { dayToDate, todayInManagua } from "~/server/domain/constants";
import { D, type Dec, ZERO } from "~/server/domain/money";
import { Sql } from "~/server/domain/sql";

/**
 * Arqueo de caja (migración 9c) — cuánto dinero DEBERÍA haber en la gaveta.
 *
 *   esperado C$ = apertura C$ + cobros en EFECTIVO en córdobas
 *                 − retiros − adelantos − pagos de periodo a mecánicos
 *                 − reembolsos por anulación − reembolsos de garantía
 *   esperado US$ = apertura US$ + cobros en EFECTIVO en dólares
 *
 * Todo es del DÍA de negocio de la caja, en hora de Managua (DEC-038).
 * Los cobros por transferencia o tarjeta NO entran a la gaveta: se muestran
 * aparte, solo como información. Los pagos a proveedores tampoco se restan:
 * las compras de contado se pagan con el retiro «Viaje a Managua» (DEC-005),
 * restarlos contaría dos veces la misma salida.
 * Las salidas se registran en córdobas (DEC-025), por eso solo restan a C$.
 * Solo se leen tablas que ya existían: el arqueo no cambia ningún flujo.
 */
type Db = DbClient | Prisma.TransactionClient;

export type CashLine = {
  key: string;
  label: string;
  amount: Dec;
  count: number;
};

export type CashSummary = {
  day: string;
  /** Entradas en efectivo, por moneda (dólares en dólares, sin convertir). */
  cashInNio: CashLine;
  cashInUsd: CashLine;
  /** Salidas de efectivo (córdobas). */
  outflows: CashLine[];
  totalOut: Dec;
  /** Cobrado por otros métodos: no está en la gaveta. */
  otherMethods: { method: string; amountNio: Dec; count: number }[];
};

const isCash = `lower(pm.name) = 'efectivo'`;

export async function cashSummary(db: Db, day: string): Promise<CashSummary> {
  const q = new Sql();
  const d = q.p(day, "date");
  const [r] = await q.run<
    {
      in_nio: string;
      in_nio_n: number;
      in_usd: string;
      in_usd_n: number;
      withdrawals: string;
      withdrawals_n: number;
      advances: string;
      advances_n: number;
      payouts: string;
      payouts_n: number;
      voids: string;
      voids_n: number;
      warranty: string;
      warranty_n: number;
    }[]
  >(
    db,
    `WITH pay AS (
       SELECT cp.amount, cp.currency
         FROM customer_payment cp JOIN payment_method pm ON pm.id = cp.payment_method_id
        WHERE ${isCash} AND (cp.paid_at AT TIME ZONE 'America/Managua')::date = ${d}
     ),
     payout AS (
       SELECT greatest(
                (SELECT coalesce(sum(round(lab.labor * so.applied_commission_rate, 2)), 0)
                   FROM service_order so
                  CROSS JOIN LATERAL (
                        SELECT coalesce(sum(l.quantity * l.unit_price - l.discount_amount), 0) AS labor
                          FROM sale_invoice si JOIN sale_invoice_line l ON l.sale_invoice_id = si.id
                         WHERE si.service_order_id = so.id AND l.line_type = 'MANO_OBRA') lab
                  WHERE so.staff_payout_id = sp.id AND so.applied_commission_rate IS NOT NULL)
              - (SELECT coalesce(sum(a.amount), 0) FROM staff_advance a WHERE a.staff_payout_id = sp.id),
              0) AS net
         FROM staff_payout sp
        WHERE sp.paid_on = ${d}
     )
     SELECT
       (SELECT coalesce(sum(amount), 0) FROM pay WHERE currency = 'NIO')::text AS in_nio,
       (SELECT count(*) FROM pay WHERE currency = 'NIO')::int AS in_nio_n,
       (SELECT coalesce(sum(amount), 0) FROM pay WHERE currency = 'USD')::text AS in_usd,
       (SELECT count(*) FROM pay WHERE currency = 'USD')::int AS in_usd_n,
       (SELECT coalesce(sum(amount), 0) FROM cash_withdrawal WHERE withdrawn_on = ${d})::text AS withdrawals,
       (SELECT count(*) FROM cash_withdrawal WHERE withdrawn_on = ${d})::int AS withdrawals_n,
       (SELECT coalesce(sum(amount), 0) FROM staff_advance WHERE given_on = ${d})::text AS advances,
       (SELECT count(*) FROM staff_advance WHERE given_on = ${d})::int AS advances_n,
       (SELECT coalesce(sum(net), 0) FROM payout)::text AS payouts,
       (SELECT count(*) FROM payout WHERE net > 0)::int AS payouts_n,
       (SELECT coalesce(sum(refund_amount), 0) FROM sale_invoice_void
         WHERE refund_amount > 0 AND (voided_at AT TIME ZONE 'America/Managua')::date = ${d})::text AS voids,
       (SELECT count(*) FROM sale_invoice_void
         WHERE refund_amount > 0 AND (voided_at AT TIME ZONE 'America/Managua')::date = ${d})::int AS voids_n,
       (SELECT coalesce(sum(refund_amount), 0) FROM warranty_claim
         WHERE outcome = 'REEMBOLSO' AND claimed_on = ${d})::text AS warranty,
       (SELECT count(*) FROM warranty_claim WHERE outcome = 'REEMBOLSO' AND claimed_on = ${d})::int AS warranty_n`,
  );

  const q2 = new Sql();
  const d2 = q2.p(day, "date");
  const other = await q2.run<{ method: string; amount: string; n: number }[]>(
    db,
    `SELECT pm.name AS method,
            sum(CASE WHEN cp.currency = 'USD' THEN round(cp.amount * cp.exchange_rate, 2) ELSE cp.amount END)::text AS amount,
            count(*)::int AS n
       FROM customer_payment cp JOIN payment_method pm ON pm.id = cp.payment_method_id
      WHERE NOT (${isCash}) AND (cp.paid_at AT TIME ZONE 'America/Managua')::date = ${d2}
      GROUP BY pm.name
      ORDER BY 2 DESC`,
  );

  const line = (
    key: string,
    label: string,
    amount: string,
    count: number,
  ): CashLine => ({
    key,
    label,
    amount: D(amount),
    count: Number(count),
  });
  const outflows = [
    line("withdrawals", "Retiros de caja", r!.withdrawals, r!.withdrawals_n),
    line("advances", "Adelantos a mecánicos", r!.advances, r!.advances_n),
    line("payouts", "Pago de periodo a mecánicos", r!.payouts, r!.payouts_n),
    line("voids", "Reembolsos por facturas anuladas", r!.voids, r!.voids_n),
    line("warranty", "Reembolsos de garantía", r!.warranty, r!.warranty_n),
  ];
  return {
    day,
    cashInNio: line(
      "in_nio",
      "Cobros en efectivo (córdobas)",
      r!.in_nio,
      r!.in_nio_n,
    ),
    cashInUsd: line(
      "in_usd",
      "Cobros en efectivo (dólares)",
      r!.in_usd,
      r!.in_usd_n,
    ),
    outflows,
    totalOut: outflows.reduce<Dec>((a, o) => a.plus(o.amount), ZERO),
    otherMethods: other.map((o) => ({
      method: o.method,
      amountNio: D(o.amount),
      count: Number(o.n),
    })),
  };
}

/** ¿Se movió dinero ese día (cualquier cobro o salida)? */
export const hasMovements = (s: CashSummary) =>
  s.cashInNio.count +
    s.cashInUsd.count +
    s.outflows.reduce((a, o) => a + o.count, 0) +
    s.otherMethods.reduce((a, m) => a + m.count, 0) >
  0;

/** Lo que debería haber en la gaveta, dada la apertura y el resumen del día. */
export function expectedCash(opening: { nio: Dec; usd: Dec }, s: CashSummary) {
  return {
    nio: opening.nio.plus(s.cashInNio.amount).minus(s.totalOut),
    usd: opening.usd.plus(s.cashInUsd.amount),
  };
}

/**
 * Sin caja abierta HOY no entra ni sale dinero: cobros (cualquier método),
 * retiros, adelantos, pago a mecánicos y reembolsos. Se llama dentro de la
 * transacción de cada operación de dinero.
 */
export async function requireOpenCash(db: Db) {
  const today = todayInManagua();
  const open = await db.cashSession.findFirst({
    where: { closedAt: null },
    select: { businessDay: true },
  });
  if (open) {
    const d = open.businessDay.toISOString().slice(0, 10);
    if (d === today) return;
    throw fail(
      `La caja del ${d} sigue abierta. Ciérrela (arqueo) y abra la de hoy antes de mover dinero.`,
      "CONFLICT",
    );
  }
  const closedToday = await db.cashSession.findUnique({
    where: { businessDay: dayToDate(today) },
    select: { id: true },
  });
  throw fail(
    closedToday
      ? "La caja de hoy ya se cerró: no se puede cobrar ni sacar dinero. Un dueño puede reabrirla en «Apertura y cierre»."
      : "La caja está cerrada. Ábrala en «Apertura y cierre» antes de cobrar o sacar dinero.",
    "CONFLICT",
  );
}
