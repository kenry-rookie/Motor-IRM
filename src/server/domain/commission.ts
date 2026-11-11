import { type Prisma } from "~/server/db";
import { D, sum } from "~/server/domain/money";

export { unpaidCommissions } from "~/server/domain/balances";

type Tx = Prisma.TransactionClient;

/**
 * Commission of a delivered order = labor charged (MANO_OBRA lines, net of
 * discounts) × the rate frozen on the order. Parts and external charges don't pay
 * commission ("se cobra mano de obra + insumos"). The amounts come from the view
 * v_mechanic_unpaid_commission (DEC-042); orders of an owner have no rate and
 * never appear there (DEC-041).
 */
export async function unsettledAdvances(tx: Tx, staffId: number, givenUntil?: Date) {
  return tx.staffAdvance.findMany({
    where: { staffId, staffPayoutId: null, givenOn: givenUntil ? { lte: givenUntil } : undefined },
    orderBy: { givenOn: "asc" },
  });
}

export const totalOf = (rows: { commission?: Prisma.Decimal; amount?: Prisma.Decimal }[]) =>
  sum(rows.map((r) => D(r.commission ?? r.amount ?? 0)));
