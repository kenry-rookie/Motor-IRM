/**
 * Demo de arqueo (Kenry, 11-nov-2026): dos cajas ya cerradas, antes de hoy.
 *
 *   npm run db:demo-cash
 *
 *   - Lunes 9 de noviembre de 2026: abre el dueño a las 7:30 con C$ 2 000 y
 *     US$ 20; cierra el encargado a las 6:00 p. m. — cuadra exacto.
 *   - Martes 10 de noviembre de 2026: abre el encargado a las 7:35 con lo que
 *     quedó contado el lunes; cierra el dueño a las 6:10 p. m. — faltan C$ 20.
 *
 * Lo ESPERADO no se inventa: se calcula con los cobros en efectivo y las
 * salidas de dinero que la base ya tiene esos días (la misma fórmula que
 * src/server/domain/cash.ts). Si un día ya tiene caja, no lo toca.
 */
import { Prisma, PrismaClient } from "../generated/prisma";

const db = new PrismaClient();
const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);

/** Lo que debería haber en la gaveta un día, sin la apertura. */
async function movementsOf(day: string) {
  const [r] = await db.$queryRawUnsafe<
    { in_nio: string; in_usd: string; out: string }[]
  >(
    `WITH pay AS (
       SELECT cp.amount, cp.currency
         FROM customer_payment cp JOIN payment_method pm ON pm.id = cp.payment_method_id
        WHERE lower(pm.name) = 'efectivo' AND (cp.paid_at AT TIME ZONE 'America/Managua')::date = $1::date
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
              - (SELECT coalesce(sum(a.amount), 0) FROM staff_advance a WHERE a.staff_payout_id = sp.id), 0) AS net
         FROM staff_payout sp WHERE sp.paid_on = $1::date
     )
     SELECT (SELECT coalesce(sum(amount), 0) FROM pay WHERE currency = 'NIO')::text AS in_nio,
            (SELECT coalesce(sum(amount), 0) FROM pay WHERE currency = 'USD')::text AS in_usd,
            ((SELECT coalesce(sum(amount), 0) FROM cash_withdrawal WHERE withdrawn_on = $1::date)
           + (SELECT coalesce(sum(amount), 0) FROM staff_advance WHERE given_on = $1::date)
           + (SELECT coalesce(sum(net), 0) FROM payout)
           + (SELECT coalesce(sum(refund_amount), 0) FROM sale_invoice_void
               WHERE (voided_at AT TIME ZONE 'America/Managua')::date = $1::date)
           + (SELECT coalesce(sum(refund_amount), 0) FROM warranty_claim
               WHERE outcome = 'REEMBOLSO' AND claimed_on = $1::date))::text AS out`,
    day,
  );
  return { inNio: D(r!.in_nio), inUsd: D(r!.in_usd), out: D(r!.out) };
}

/** Instante en hora de Managua (UTC−6, sin horario de verano). */
const at = (day: string, time: string) => new Date(`${day}T${time}:00-06:00`);

async function main() {
  const owner = await db.appUser.findFirst({
    where: { role: { name: "Dueño" }, active: true },
    orderBy: { id: "asc" },
  });
  if (!owner)
    throw new Error("No hay usuario dueño: corra primero npm run db:seed");
  const clerk =
    (await db.appUser.findFirst({
      where: { role: { name: "Encargado" }, active: true },
      orderBy: { id: "asc" },
    })) ?? owner;

  const days = [
    {
      day: "2026-11-09",
      opens: owner,
      closes: clerk,
      openAt: "07:30",
      closeAt: "18:00",
      short: D(0),
      note: null as string | null,
    },
    {
      day: "2026-11-10",
      opens: clerk,
      closes: owner,
      openAt: "07:35",
      closeAt: "18:10",
      short: D(20),
      note: "Faltan C$ 20: se dio vuelto de más a un cliente.",
    },
  ];

  // Apertura del lunes; la del martes es lo que quedó contado el lunes.
  let opening = { nio: D(2000), usd: D(20) };
  const last = await db.cashSession.findFirst({
    where: {
      businessDay: { lt: new Date("2026-11-09T00:00:00Z") },
      closedAt: { not: null },
    },
    orderBy: { businessDay: "desc" },
  });
  if (last?.countedNio && last.countedUsd)
    opening = { nio: last.countedNio, usd: last.countedUsd };

  for (const d of days) {
    const existing = await db.cashSession.findUnique({
      where: { businessDay: new Date(`${d.day}T00:00:00Z`) },
    });
    if (existing) {
      console.log(`• ${d.day}: ya tiene caja, no se toca.`);
      if (existing.countedNio && existing.countedUsd)
        opening = { nio: existing.countedNio, usd: existing.countedUsd };
      continue;
    }
    const m = await movementsOf(d.day);
    // Si ese día salió más de lo que entró, se abrió con lo necesario para cubrirlo.
    const needed = m.out.minus(m.inNio);
    if (opening.nio.lt(needed)) opening = { ...opening, nio: needed.plus(500) };
    const expectedNio = opening.nio.plus(m.inNio).minus(m.out);
    const expectedUsd = opening.usd.plus(m.inUsd);
    const countedNio = expectedNio.minus(d.short);
    await db.cashSession.create({
      data: {
        businessDay: new Date(`${d.day}T00:00:00Z`),
        openedAt: at(d.day, d.openAt),
        openedByUserId: d.opens.id,
        openingNio: opening.nio,
        openingUsd: opening.usd,
        closedAt: at(d.day, d.closeAt),
        closedByUserId: d.closes.id,
        expectedNio,
        expectedUsd,
        countedNio,
        countedUsd: expectedUsd,
        closingNotes: d.note,
      },
    });
    console.log(
      `✔ ${d.day}: apertura C$ ${opening.nio.toFixed(2)} · esperado C$ ${expectedNio.toFixed(2)} · contado C$ ${countedNio.toFixed(2)}`,
    );
    opening = { nio: countedNio, usd: expectedUsd };
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void db.$disconnect());
