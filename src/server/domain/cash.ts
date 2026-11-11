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
  // FOR SHARE: si en este momento alguien está cerrando la caja (cash.close la
  // bloquea FOR UPDATE), este cobro espera; al terminar el cierre la fila ya no
  // cumple «closed_at IS NULL» y el cobro se rechaza. Así ningún cobro queda
  // registrado en una caja que se cerró al mismo tiempo.
  const [open] = await db.$queryRaw<{ business_day: Date }[]>`
    SELECT business_day FROM cash_session WHERE closed_at IS NULL FOR SHARE`;
  if (open) {
    const d = open.business_day.toISOString().slice(0, 10);
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
      ? "La caja de hoy ya se cerró: no se puede cobrar ni sacar dinero. Un administrador puede reabrirla en «Apertura y cierre»."
      : "La caja está cerrada. Ábrala en «Apertura y cierre» antes de cobrar o sacar dinero.",
    "CONFLICT",
  );
}

/** Minutos que el encargado tiene para cancelar una apertura hecha por error. */
export const CANCEL_OPENING_MINUTES = 30;

/**
 * Cobros (cualquier método) y reembolsos por anulación registrados DESDE que se
 * abrió la caja. Lo de antes de abrir no cuenta: no lo hizo esta apertura.
 */
export async function movementsSince(db: Db, since: Date) {
  const [r] = await db.$queryRaw<{ n: number }[]>`
    SELECT ((SELECT count(*) FROM customer_payment WHERE paid_at >= ${since})
          + (SELECT count(*) FROM sale_invoice_void WHERE refund_amount > 0 AND voided_at >= ${since}))::int AS n`;
  return Number(r?.n ?? 0);
}

/** ¿Puede este usuario cancelar la apertura? Administrador: siempre (la de hoy). Encargado: recién abierta y sin cobros. */
export function canCancelOpening(o: {
  isOwner: boolean;
  openedAt: Date;
  movedSinceOpening: number;
}) {
  if (o.isOwner) return { ok: true as const };
  if (o.movedSinceOpening > 0)
    return {
      ok: false as const,
      reason:
        "Ya se cobró desde que se abrió: la caja no se cancela, se cierra con el arqueo. Un administrador sí puede cancelarla.",
    };
  if (Date.now() - o.openedAt.getTime() > CANCEL_OPENING_MINUTES * 60_000)
    return {
      ok: false as const,
      reason: `Pasaron más de ${CANCEL_OPENING_MINUTES} minutos desde la apertura: la caja no se cancela. Un administrador sí puede cancelarla.`,
    };
  return { ok: true as const };
}

/** Foto de una caja para la bitácora (cash_session_change). */
export function cashSnapshot(s: {
  openingNio: Dec;
  openingUsd: Dec;
  openingNotes: string | null;
  closedAt: Date | null;
  closedByUserId: number | null;
  expectedNio: Dec | null;
  expectedUsd: Dec | null;
  countedNio: Dec | null;
  countedUsd: Dec | null;
  closingNotes: string | null;
}) {
  const m = (v: Dec | null) => (v === null ? null : v.toFixed(2));
  return {
    openingNio: m(s.openingNio),
    openingUsd: m(s.openingUsd),
    openingNotes: s.openingNotes,
    closedAt: s.closedAt?.toISOString() ?? null,
    closedByUserId: s.closedByUserId,
    expectedNio: m(s.expectedNio),
    expectedUsd: m(s.expectedUsd),
    countedNio: m(s.countedNio),
    countedUsd: m(s.countedUsd),
    closingNotes: s.closingNotes,
  };
}

/**
 * Reglas del cierre (se usan al cerrar y al corregir un cierre):
 *  - Si debería haber dólares, hay que decir cuántos se contaron (vacío no es 0).
 *  - Si no cuadra, la nota es obligatoria.
 */
export function validateCount(o: {
  expected: { nio: Dec; usd: Dec };
  countedNio: Dec;
  countedUsd: Dec | undefined;
  notes: string | undefined;
}) {
  if (o.countedUsd === undefined && o.expected.usd.gt(0))
    throw fail(
      `Debería haber ${o.expected.usd.toFixed(2)} dólares: escriba cuántos dólares se contaron (0 si no hay).`,
    );
  const countedUsd = o.countedUsd ?? ZERO;
  const diffNio = o.countedNio.minus(o.expected.nio);
  const diffUsd = countedUsd.minus(o.expected.usd);
  if ((!diffNio.isZero() || !diffUsd.isZero()) && !o.notes)
    throw fail(
      "Hay diferencia entre lo contado y lo esperado: escriba una nota que la explique.",
    );
  return { countedUsd, diffNio, diffUsd };
}
