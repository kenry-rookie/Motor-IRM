import { z } from "zod";

import { fail } from "~/server/api/errors";
import { createTRPCRouter, permissionProcedure } from "~/server/api/trpc";
import { purchaseBalances } from "~/server/domain/balances";
import { requireOpenCash } from "~/server/domain/cash";
import { dayToDate, TRIP_STATUSES, todayInManagua, zDay, zId, zMoney, zOptText, zPositiveMoney } from "~/server/domain/constants";
import { D } from "~/server/domain/money";
import { lockOpenTrip, tripSummary, tripSummaries } from "~/server/domain/trips";

/**
 * DEC-059 — Viaje de compras (Ingreso de mercadería).
 *
 * The owners travel (usually to Managua) with money from the drawer, buy from
 * several suppliers, pay the trip (fare, fuel, food, freight) and come back
 * with the change. The trip keeps it all together:
 *
 *   create     → how much money leaves the drawer (needs today's cash open)
 *   invoices   → each supplier invoice is registered with purchasing.createInvoice
 *                (purchaseTripId): stock goes up and the kardex says which trip;
 *                cash invoices are paid with the trip money (source VIAJE)
 *   expenses   → what was spent and on what (they don't touch the drawer)
 *   close      → how much came back to the drawer; the difference with what
 *                should have come back is shown and needs a note
 *
 * The arqueo sees «Dinero llevado al viaje» (out, the day it was taken) and
 * «Vuelto del viaje» (in, the day it was closed) — v_money_movement.
 * Trip expenses are recorded only; they are NOT added to the product cost
 * (Kenry, 23-nov: «Solo registrarlos»).
 */
const view = permissionProcedure("compras.ver");
const manage = permissionProcedure("compras.gestionar");

const userName = { select: { username: true, staff: { select: { name: true } } } } as const;
const managuaDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Managua" }).format(d);

const zTripData = z.object({
  destination: z.string().trim().min(2, "Escriba a dónde fue el viaje").max(80),
  traveler: zOptText(100),
  /** Money that did NOT come from the drawer (owner, bank): only to know the total of the trip. */
  otherFunds: zMoney.default("0"),
  notes: zOptText(200),
});

export const tripsRouter = createTRPCRouter({
  /** Types of trip expense (fare, fuel, food…): the select of «Gastos del viaje». */
  expenseTypes: view.query(({ ctx }) => ctx.db.tripExpenseType.findMany({ orderBy: { name: "asc" } })),

  /** Trips, newest first, with what was taken, bought, spent and brought back. */
  list: view
    .input(z.object({ status: z.enum(TRIP_STATUSES).optional(), from: zDay.optional(), to: zDay.optional() }).default({}))
    .query(async ({ ctx, input }) => {
      const trips = await ctx.db.purchaseTrip.findMany({
        where: {
          status: input.status,
          tripDate: { gte: input.from ? dayToDate(input.from) : undefined, lte: input.to ? dayToDate(input.to) : undefined },
        },
        orderBy: [{ tripDate: "desc" }, { id: "desc" }],
        include: { createdBy: userName },
        take: 200,
      });
      const sums = await tripSummaries(
        ctx.db,
        trips.map((t) => t.id),
      );
      return trips.map((t) => ({ ...t, summary: sums.get(t.id)! }));
    }),

  /** One trip with everything: invoices (and their balance), payments with the trip money, expenses. */
  get: view.input(z.object({ id: zId })).query(async ({ ctx, input }) => {
    const trip = await ctx.db.purchaseTrip.findUnique({
      where: { id: input.id },
      include: {
        createdBy: userName,
        closedBy: userName,
        invoices: {
          orderBy: { id: "asc" },
          include: { supplier: { select: { id: true, name: true } }, _count: { select: { lines: true } } },
        },
        expenses: { orderBy: { id: "asc" }, include: { type: true, createdBy: userName } },
        payments: {
          orderBy: { id: "asc" },
          include: { supplier: { select: { id: true, name: true } }, purchaseInvoice: { select: { id: true, invoiceNumber: true } } },
        },
      },
    });
    if (!trip) throw fail("Ese viaje de compras no existe.", "NOT_FOUND");
    const balances = new Map((await purchaseBalances(ctx.db, { ids: trip.invoices.map((i) => i.id) })).map((b) => [b.purchaseInvoiceId, b]));
    const units = await ctx.db.purchaseInvoiceLine.groupBy({
      by: ["purchaseInvoiceId"],
      where: { purchaseInvoiceId: { in: trip.invoices.map((i) => i.id) } },
      _sum: { quantity: true },
    });
    const unitsBy = new Map(units.map((u) => [u.purchaseInvoiceId, u._sum.quantity ?? 0]));
    return {
      ...trip,
      invoices: trip.invoices.map(({ _count, ...i }) => {
        const b = balances.get(i.id);
        return { ...i, lines: _count.lines, units: unitsBy.get(i.id) ?? 0, total: b?.total ?? D(0), balance: b?.balance ?? D(0) };
      }),
      summary: await tripSummary(ctx.db, trip.id),
    };
  }),

  /**
   * Starts a trip. If money is taken from the drawer it leaves the cash now
   * (needs today's cash open) and shows in the arqueo as «Dinero llevado al viaje».
   */
  create: manage
    .input(
      zTripData.extend({
        tripDate: zDay.refine((d) => d <= todayInManagua(), "El viaje no puede tener fecha futura").optional(),
        /** Taken from the drawer now (C$). 0 = no drawer money (the owner paid from elsewhere). */
        cashTaken: zMoney.default("0"),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        const cash = D(input.cashTaken);
        if (cash.gt(0)) await requireOpenCash(tx);
        return tx.purchaseTrip.create({
          data: {
            tripDate: dayToDate(input.tripDate ?? todayInManagua()),
            destination: input.destination,
            traveler: input.traveler ?? null,
            cashTaken: cash,
            takenAt: cash.gt(0) ? new Date() : null,
            otherFunds: input.otherFunds,
            notes: input.notes ?? null,
            createdByUserId: ctx.user.id,
          },
        });
      }),
    ),

  /**
   * Edits an open trip. The money taken from the drawer can only change the same
   * day it was taken (that day's cash is the one that is still open).
   */
  update: manage
    .input(zTripData.extend({ id: zId, cashTaken: zMoney }))
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        const trip = await lockOpenTrip(tx, input.id);
        const cash = D(input.cashTaken);
        let takenAt = trip.takenAt;
        if (!cash.equals(trip.cashTaken)) {
          if (trip.takenAt && managuaDay(trip.takenAt) !== todayInManagua()) {
            throw fail(
              "El dinero del viaje salió de la caja de otro día: ya no se cambia aquí. Si se llevó más dinero, regístrelo como un retiro o corrija la caja de ese día.",
            );
          }
          await requireOpenCash(tx);
          takenAt = cash.gt(0) ? (trip.takenAt ?? new Date()) : null;
        }
        return tx.purchaseTrip.update({
          where: { id: trip.id },
          data: {
            destination: input.destination,
            traveler: input.traveler ?? null,
            otherFunds: input.otherFunds,
            notes: input.notes ?? null,
            cashTaken: cash,
            takenAt,
          },
        });
      }),
    ),

  addExpense: manage
    .input(z.object({ purchaseTripId: zId, tripExpenseTypeId: zId, amount: zPositiveMoney, description: zOptText(200) }))
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        await lockOpenTrip(tx, input.purchaseTripId);
        const type = await tx.tripExpenseType.findUnique({ where: { id: input.tripExpenseTypeId } });
        if (!type?.active) throw fail("Ese tipo de gasto no existe o está desactivado.");
        return tx.purchaseTripExpense.create({
          data: {
            purchaseTripId: input.purchaseTripId,
            tripExpenseTypeId: input.tripExpenseTypeId,
            amount: input.amount,
            description: input.description ?? null,
            createdByUserId: ctx.user.id,
          },
        });
      }),
    ),

  /** A mistaken expense line is removed while the trip is open (it never touched the drawer). */
  removeExpense: manage.input(z.object({ id: zId })).mutation(({ ctx, input }) =>
    ctx.db.$transaction(async (tx) => {
      const e = await tx.purchaseTripExpense.findUnique({ where: { id: input.id } });
      if (!e) throw fail("Ese gasto no existe.", "NOT_FOUND");
      await lockOpenTrip(tx, e.purchaseTripId);
      await tx.purchaseTripExpense.delete({ where: { id: e.id } });
      return { removed: true };
    }),
  ),

  /**
   * Closes the trip with the change that came back to the drawer. If it is not
   * what should have come back, a note is required (the difference is kept).
   */
  close: manage
    .input(z.object({ id: zId, cashReturned: zMoney, notes: zOptText(200) }))
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        const trip = await lockOpenTrip(tx, input.id);
        const s = await tripSummary(tx, trip.id);
        const returned = D(input.cashReturned);
        const expected = s.expectedBack.gt(0) ? s.expectedBack : D(0);
        if (!returned.equals(expected) && !input.notes) {
          throw fail(
            `Debería regresar C$ ${expected.toFixed(2)} y regresan C$ ${returned.toFixed(2)}: escriba una nota que explique la diferencia.`,
          );
        }
        if (returned.gt(0)) await requireOpenCash(tx); // el vuelto entra a la gaveta hoy
        return tx.purchaseTrip.update({
          where: { id: trip.id },
          data: {
            status: "CERRADO",
            cashReturned: returned,
            closedAt: new Date(),
            closedByUserId: ctx.user.id,
            closingNotes: input.notes ?? null,
          },
        });
      }),
    ),

  /**
   * ADMIN: reopens a trip closed TODAY (the change goes back out of today's cash,
   * which must be open) to add an invoice or expense that was forgotten.
   */
  reopen: permissionProcedure("caja.corregir")
    .input(z.object({ id: zId }))
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM purchase_trip WHERE id = ${input.id} FOR UPDATE`;
        const trip = await tx.purchaseTrip.findUnique({ where: { id: input.id } });
        if (!trip) throw fail("Ese viaje de compras no existe.", "NOT_FOUND");
        if (trip.status !== "CERRADO") throw fail("El viaje ya está abierto.", "CONFLICT");
        if (!trip.closedAt || managuaDay(trip.closedAt) !== todayInManagua()) {
          throw fail("Solo se reabre un viaje cerrado hoy: el vuelto de otro día ya está en el arqueo de ese día.");
        }
        if (trip.cashReturned?.gt(0)) await requireOpenCash(tx);
        return tx.purchaseTrip.update({
          where: { id: trip.id },
          data: { status: "ABIERTO", cashReturned: null, closedAt: null, closedByUserId: null, closingNotes: null },
        });
      }),
    ),
});
