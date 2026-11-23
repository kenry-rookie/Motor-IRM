import { fail } from "~/server/api/errors";
import { type DbClient, type Prisma } from "~/server/db";
import { type Dec } from "~/server/domain/money";
import { intList, Sql } from "~/server/domain/sql";

/** Purchase trips (DEC-059): shared by the trips and purchasing routers. */
type Db = DbClient | Prisma.TransactionClient;

/** Locks an OPEN trip (FOR UPDATE) or fails with a clear message. Used by purchasing too. */
export async function lockOpenTrip(tx: Prisma.TransactionClient, id: number) {
  await tx.$queryRaw`SELECT id FROM purchase_trip WHERE id = ${id} FOR UPDATE`;
  const trip = await tx.purchaseTrip.findUnique({ where: { id } });
  if (!trip) throw fail("Ese viaje de compras no existe.", "NOT_FOUND");
  if (trip.status !== "ABIERTO") throw fail("El viaje de compras ya está cerrado: no se le agregan facturas, pagos ni gastos.", "CONFLICT");
  return trip;
}

export type TripSummary = {
  purchaseTripId: number;
  cashTaken: Dec;
  otherFunds: Dec;
  invoices: number;
  purchasesTotal: Dec;
  purchasesCash: Dec;
  purchasesCredit: Dec;
  paidFromTrip: Dec;
  expenses: Dec;
  expenseLines: number;
  /** cash taken + other funds − paid with the trip − expenses */
  expectedBack: Dec;
  cashReturned: Dec | null;
  /** cash returned − expected back (only when closed): negative = money missing. */
  difference: Dec | null;
};

export async function tripSummaries(db: Db, ids: number[]) {
  if (!ids.length) return new Map<number, TripSummary>();
  const rows = await new Sql().run<
    {
      purchase_trip_id: number;
      cash_taken: Dec;
      other_funds: Dec;
      invoices: number;
      purchases_total: Dec;
      purchases_cash: Dec;
      purchases_credit: Dec;
      paid_from_trip: Dec;
      expenses: Dec;
      expense_lines: number;
      expected_back: Dec;
      cash_returned: Dec | null;
      difference: Dec | null;
    }[]
  >(db, `SELECT * FROM v_purchase_trip_summary WHERE purchase_trip_id IN (${intList(ids)})`);
  return new Map(
    rows.map((r) => [
      r.purchase_trip_id,
      {
        purchaseTripId: r.purchase_trip_id,
        cashTaken: r.cash_taken,
        otherFunds: r.other_funds,
        invoices: Number(r.invoices),
        purchasesTotal: r.purchases_total,
        purchasesCash: r.purchases_cash,
        purchasesCredit: r.purchases_credit,
        paidFromTrip: r.paid_from_trip,
        expenses: r.expenses,
        expenseLines: Number(r.expense_lines),
        expectedBack: r.expected_back,
        cashReturned: r.cash_returned,
        difference: r.difference,
      },
    ]),
  );
}

export async function tripSummary(db: Db, id: number) {
  const s = (await tripSummaries(db, [id])).get(id);
  if (!s) throw fail("Ese viaje de compras no existe.", "NOT_FOUND");
  return s;
}

