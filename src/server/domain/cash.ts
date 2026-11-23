import { fail } from "~/server/api/errors";
import { type DbClient, type Prisma } from "~/server/db";
import { dayToDate, LABELS, MONEY_IN_KINDS, MONEY_OUT_KINDS, type MoneyKind, todayInManagua } from "~/server/domain/constants";
import { D, type Dec, ZERO } from "~/server/domain/money";
import { Sql } from "~/server/domain/sql";

/**
 * Arqueo de caja (migraciones 9c y 9f) — cuánto dinero DEBERÍA haber en la gaveta.
 *
 *   esperado C$  = apertura C$  + entradas en efectivo C$  − salidas en efectivo C$
 *   esperado US$ = apertura US$ + entradas en efectivo US$ − salidas en efectivo US$
 *
 * Todo sale de la vista v_money_movement (DEC-058): una fila por cada motivo
 * de dinero (venta, taller, abono, retiro, pago a proveedor, viaje,
 * reembolso…). Solo cuenta lo que es efectivo de la gaveta (in_drawer):
 * transferencias, tarjeta, dinero del viaje o del dueño se muestran aparte.
 * Todo es del DÍA de negocio de la caja, en hora de Managua (DEC-038).
 */
type Db = DbClient | Prisma.TransactionClient;

export type CashLine = {
  key: MoneyKind;
  label: string;
  /** Efectivo en córdobas y en dólares (los dólares en dólares, sin convertir). */
  nio: Dec;
  usd: Dec;
  count: number;
};

export type CashSummary = {
  day: string;
  /** Entradas de efectivo a la gaveta, por motivo (ventas, taller, abonos, vuelto de viaje). */
  inflows: CashLine[];
  /** Salidas de efectivo de la gaveta, por motivo. */
  outflows: CashLine[];
  totalIn: { nio: Dec; usd: Dec };
  totalOut: { nio: Dec; usd: Dec };
  /** Cobrado por otros métodos (transferencia, tarjeta): no está en la gaveta. */
  otherMethods: { method: string; amountNio: Dec; count: number }[];
  /** Pagado sin tocar la gaveta (proveedores fuera de caja, gastos y pagos con dinero del viaje). */
  offDrawerOut: { kind: MoneyKind; label: string; method: string; amountNio: Dec; count: number }[];
};

type SumRow = { kind: MoneyKind; direction: "ENTRADA" | "SALIDA"; currency: "NIO" | "USD"; amount: string; n: number };

export async function cashSummary(db: Db, day: string): Promise<CashSummary> {
  const q = new Sql();
  const d = q.p(day, "date");
  const rows = await q.run<SumRow[]>(
    db,
    `SELECT kind, direction, currency, sum(amount)::text AS amount, count(DISTINCT (ref_table, ref_id))::int AS n
       FROM v_money_movement
      WHERE in_drawer AND business_day = ${d}
      GROUP BY kind, direction, currency`,
  );
  const q2 = new Sql();
  const d2 = q2.p(day, "date");
  const other = await q2.run<{ method: string; amount: string; n: number }[]>(
    db,
    `SELECT method, sum(amount_nio)::text AS amount, count(DISTINCT ref_id)::int AS n
       FROM v_money_movement
      WHERE NOT in_drawer AND direction = 'ENTRADA' AND business_day = ${d2}
      GROUP BY method ORDER BY 2 DESC`,
  );
  const q3 = new Sql();
  const d3 = q3.p(day, "date");
  const offOut = await q3.run<{ kind: MoneyKind; method: string; amount: string; n: number }[]>(
    db,
    `SELECT kind, method, sum(amount_nio)::text AS amount, count(DISTINCT (ref_table, ref_id))::int AS n
       FROM v_money_movement
      WHERE NOT in_drawer AND direction = 'SALIDA' AND business_day = ${d3}
      GROUP BY kind, method ORDER BY 3 DESC`,
  );

  const lines = (kinds: readonly MoneyKind[], direction: "ENTRADA" | "SALIDA") =>
    kinds
      .map((kind): CashLine => {
        const mine = rows.filter((r) => r.kind === kind && r.direction === direction);
        const of = (c: "NIO" | "USD") => D(mine.find((r) => r.currency === c)?.amount ?? 0);
        return {
          key: kind,
          label: LABELS.moneyKind[kind],
          nio: of("NIO"),
          usd: of("USD"),
          count: mine.reduce((a, r) => a + Number(r.n), 0),
        };
      })
      // Los motivos que casi nunca pasan solo se muestran si pasaron.
      .filter((l) => l.count > 0 || ALWAYS_SHOWN.has(l.key));
  const inflows = lines(MONEY_IN_KINDS, "ENTRADA");
  const outflows = lines(MONEY_OUT_KINDS, "SALIDA");
  const total = (ls: CashLine[]) => ({
    nio: ls.reduce<Dec>((a, l) => a.plus(l.nio), ZERO),
    usd: ls.reduce<Dec>((a, l) => a.plus(l.usd), ZERO),
  });
  return {
    day,
    inflows,
    outflows,
    totalIn: total(inflows),
    totalOut: total(outflows),
    otherMethods: other.map((o) => ({ method: o.method, amountNio: D(o.amount), count: Number(o.n) })),
    offDrawerOut: offOut.map((o) => ({
      kind: o.kind,
      label: LABELS.moneyKind[o.kind],
      method: o.method,
      amountNio: D(o.amount),
      count: Number(o.n),
    })),
  };
}

/** Lo que el dueño mira todos los días: siempre en la tabla, aunque sea 0. */
const ALWAYS_SHOWN = new Set<MoneyKind>(["COBRO_VENTA", "COBRO_TALLER", "ABONO_CLIENTE", "RETIRO", "PAGO_PROVEEDOR"]);

export type CashMovement = {
  kind: MoneyKind;
  label: string;
  direction: "ENTRADA" | "SALIDA";
  inDrawer: boolean;
  method: string;
  currency: "NIO" | "USD";
  amount: Dec;
  amountNio: Dec;
  occurredAt: Date | null;
  refTable: string;
  refId: number;
  saleInvoiceId: number | null;
  customerId: number | null;
  customerName: string | null;
  supplierId: number | null;
  supplierName: string | null;
  detail: string;
  user: string | null;
};

/** Cada movimiento de dinero de un día (el detalle del arqueo: «¿de qué fue ese efectivo?»). */
export async function cashMovements(db: Db, day: string, opts: { onlyDrawer?: boolean } = {}): Promise<CashMovement[]> {
  const q = new Sql();
  const rows = await q.run<
    {
      kind: MoneyKind;
      direction: "ENTRADA" | "SALIDA";
      in_drawer: boolean;
      method: string;
      currency: "NIO" | "USD";
      amount: Dec;
      amount_nio: Dec;
      occurred_at: Date | null;
      ref_table: string;
      ref_id: number;
      sale_invoice_id: number | null;
      customer_id: number | null;
      customer_name: string | null;
      supplier_id: number | null;
      supplier_name: string | null;
      detail: string;
      username: string | null;
      staff_name: string | null;
    }[]
  >(
    db,
    `SELECT m.*, c.name AS customer_name, s.name AS supplier_name, u.username, st.name AS staff_name
       FROM v_money_movement m
       LEFT JOIN customer c ON c.id = m.customer_id
       LEFT JOIN supplier s ON s.id = m.supplier_id
       LEFT JOIN app_user u ON u.id = m.user_id
       LEFT JOIN staff st ON st.id = u.staff_id
      WHERE m.business_day = ${q.p(day, "date")} ${opts.onlyDrawer ? "AND m.in_drawer" : ""}
      ORDER BY m.occurred_at NULLS LAST, m.ref_table, m.ref_id`,
  );
  return rows.map((r) => ({
    kind: r.kind,
    label: LABELS.moneyKind[r.kind] ?? r.kind,
    direction: r.direction,
    inDrawer: r.in_drawer,
    method: r.method,
    currency: r.currency,
    amount: D(r.amount),
    amountNio: D(r.amount_nio),
    occurredAt: r.occurred_at,
    refTable: r.ref_table,
    refId: r.ref_id,
    saleInvoiceId: r.sale_invoice_id,
    customerId: r.customer_id,
    customerName: r.customer_name,
    supplierId: r.supplier_id,
    supplierName: r.supplier_name,
    detail: r.detail,
    user: r.staff_name ?? r.username,
  }));
}

/** ¿Se movió dinero ese día (cualquier cobro o salida)? */
export const hasMovements = (s: CashSummary) =>
  [...s.inflows, ...s.outflows].reduce((a, o) => a + o.count, 0) +
    s.otherMethods.reduce((a, m) => a + m.count, 0) +
    s.offDrawerOut.reduce((a, m) => a + m.count, 0) >
  0;

/** Lo que debería haber en la gaveta, dada la apertura y el resumen del día. */
export function expectedCash(opening: { nio: Dec; usd: Dec }, s: CashSummary) {
  return {
    nio: opening.nio.plus(s.totalIn.nio).minus(s.totalOut.nio),
    usd: opening.usd.plus(s.totalIn.usd).minus(s.totalOut.usd),
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
 * Movimientos de dinero (cobros de cualquier método, retiros, reembolsos,
 * pagos a proveedor, viajes) registrados DESDE que se abrió la caja. Lo de
 * antes de abrir no cuenta: no lo hizo esta apertura.
 */
export async function movementsSince(db: Db, since: Date) {
  const [r] = await db.$queryRaw<{ n: number }[]>`
    SELECT count(DISTINCT (ref_table, ref_id))::int AS n FROM v_money_movement WHERE occurred_at >= ${since}`;
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
