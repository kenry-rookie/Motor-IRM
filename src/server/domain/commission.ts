import { type Prisma } from "~/server/db";
import { D, round2, sum } from "~/server/domain/money";
import { lineNet } from "~/server/domain/billing";

type Tx = Prisma.TransactionClient;

/**
 * Commission of a delivered order = labor charged (MANO_OBRA lines, net of
 * discounts) × the rate frozen on the order. Parts and external charges don't pay
 * commission ("se cobra mano de obra + insumos").
 */
export async function unpaidCommissions(tx: Tx, staffId: number, deliveredUntil?: Date) {
  const orders = await tx.serviceOrder.findMany({
    where: {
      mechanicStaffId: staffId,
      staffPayoutId: null,
      statusChanges: { some: { status: "ENTREGADA", changedAt: deliveredUntil ? { lt: deliveredUntil } : undefined } },
    },
    include: {
      saleInvoice: { include: { lines: { where: { lineType: "MANO_OBRA" } } } },
      motorcycle: { include: { customer: true } },
      statusChanges: { where: { status: "ENTREGADA" }, take: 1 },
    },
    orderBy: { id: "asc" },
  });
  return orders.map((o) => {
    const labor = sum(o.saleInvoice?.lines.map(lineNet) ?? []);
    const commission = round2(labor.times(o.appliedCommissionRate ?? 0));
    return {
      serviceOrderId: o.id,
      deliveredAt: o.statusChanges[0]?.changedAt ?? null,
      customer: o.motorcycle.customer.name,
      labor,
      rate: o.appliedCommissionRate,
      commission,
    };
  });
}

export async function unsettledAdvances(tx: Tx, staffId: number, givenUntil?: Date) {
  return tx.staffAdvance.findMany({
    where: { staffId, staffPayoutId: null, givenOn: givenUntil ? { lte: givenUntil } : undefined },
    orderBy: { givenOn: "asc" },
  });
}

export const totalOf = (rows: { commission?: Prisma.Decimal; amount?: Prisma.Decimal }[]) =>
  sum(rows.map((r) => D(r.commission ?? r.amount ?? 0)));
