import { z } from "zod";

import { fail } from "~/server/api/errors";
import { createTRPCRouter, permissionProcedure } from "~/server/api/trpc";
import { dayToDate, todayInManagua, zDay, zId, zOptText, zPositiveMoney, zRate, zText } from "~/server/domain/constants";
import { totalOf, unpaidCommissions, unsettledAdvances } from "~/server/domain/commission";
import { D } from "~/server/domain/money";

/**
 * API-018 — staff, mechanics' pay (commissions − advances), cash withdrawals.
 *
 * DEC-030: the pay period is the days the mechanic actually worked (not a fixed
 * week). A payout takes every delivered, unpaid order up to its end date —
 * including late ones from earlier periods (BR-104) — and every unsettled advance.
 */
const view = permissionProcedure("personal.ver");
const pay = permissionProcedure("personal.pagos");

const dayEnd = (day: string) => new Date(new Date(`${day}T00:00:00-06:00`).getTime() + 86_400_000);

export const staffRouter = createTRPCRouter({
  list: view
    .input(z.object({ includeInactive: z.boolean().default(false) }).default({}))
    .query(({ ctx, input }) =>
      ctx.db.staff.findMany({
        where: input.includeInactive ? {} : { active: true },
        orderBy: { name: "asc" },
        include: { appUser: { select: { id: true, username: true } } },
      }),
    ),

  /** Mechanics are staff with a commission rate (e.g. 0.60 = 60 % of labor). */
  save: permissionProcedure("admin.usuarios")
    .input(
      z.object({
        id: zId.optional(),
        name: zText(100),
        phone: zText(20),
        commissionRate: zRate.nullish(),
        active: z.boolean().default(true),
      }),
    )
    .mutation(({ ctx, input }) => {
      const data = {
        name: input.name,
        phone: input.phone,
        commissionRate: input.commissionRate && D(input.commissionRate).gt(0) ? input.commissionRate : null,
        active: input.active,
      };
      return input.id ? ctx.db.staff.update({ where: { id: input.id }, data }) : ctx.db.staff.create({ data });
    }),

  /** What the mechanic has earned and not been paid yet, minus advances. */
  pending: view.input(z.object({ staffId: zId, until: zDay.optional() })).query(({ ctx, input }) =>
    ctx.db.$transaction(async (tx) => {
      const until = input.until ? dayEnd(input.until) : undefined;
      const orders = await unpaidCommissions(tx, input.staffId, until);
      const advances = await unsettledAdvances(tx, input.staffId, until);
      const commission = totalOf(orders);
      const advanced = totalOf(advances);
      return { orders, advances, commission, advanced, net: commission.minus(advanced) };
    }),
  ),

  /** BR-103: an advance can't exceed what the mechanic has already earned and not received. */
  giveAdvance: pay
    .input(z.object({ staffId: zId, amount: zPositiveMoney }))
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM staff WHERE id = ${input.staffId} FOR UPDATE`;
        const available = totalOf(await unpaidCommissions(tx, input.staffId)).minus(
          totalOf(await unsettledAdvances(tx, input.staffId)),
        );
        if (D(input.amount).gt(available)) {
          throw fail(`Solo tiene C$ ${available.toFixed(2)} ganados sin cobrar; no se puede adelantar más.`);
        }
        return tx.staffAdvance.create({
          data: { staffId: input.staffId, amount: input.amount, givenByUserId: ctx.user.id },
        });
      }),
    ),

  /** Creates the payout for the period and attaches orders and advances to it. */
  createPayout: pay
    .input(z.object({ staffId: zId, periodStart: zDay, periodEnd: zDay, markPaid: z.boolean().default(true) }))
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        if (input.periodEnd < input.periodStart) throw fail("El fin del periodo es antes del inicio.");
        await tx.$queryRaw`SELECT id FROM staff WHERE id = ${input.staffId} FOR UPDATE`;
        const until = dayEnd(input.periodEnd);
        const orders = await unpaidCommissions(tx, input.staffId, until);
        const advances = await unsettledAdvances(tx, input.staffId, until);
        if (orders.length === 0 && advances.length === 0) throw fail("No hay comisiones ni adelantos pendientes.");
        const today = todayInManagua();
        const payout = await tx.staffPayout.create({
          data: {
            staffId: input.staffId,
            periodStart: dayToDate(input.periodStart),
            periodEnd: dayToDate(input.periodEnd),
            paidOn: input.markPaid ? dayToDate(today < input.periodStart ? input.periodStart : today) : null,
            paidByUserId: input.markPaid ? ctx.user.id : null,
          },
        });
        await tx.serviceOrder.updateMany({
          where: { id: { in: orders.map((o) => o.serviceOrderId) } },
          data: { staffPayoutId: payout.id },
        });
        await tx.staffAdvance.updateMany({
          where: { id: { in: advances.map((a) => a.id) } },
          data: { staffPayoutId: payout.id },
        });
        const commission = totalOf(orders);
        const advanced = totalOf(advances);
        return { payout, orders, advances, commission, advanced, net: commission.minus(advanced) };
      }),
    ),

  markPayoutPaid: pay.input(z.object({ staffPayoutId: zId })).mutation(({ ctx, input }) =>
    ctx.db.staffPayout.update({
      where: { id: input.staffPayoutId },
      data: { paidOn: dayToDate(todayInManagua()), paidByUserId: ctx.user.id },
    }),
  ),

  payouts: view.input(z.object({ staffId: zId })).query(({ ctx, input }) =>
    ctx.db.staffPayout.findMany({
      where: { staffId: input.staffId },
      orderBy: { periodStart: "desc" },
      include: { advances: true, serviceOrders: { select: { id: true } }, paidBy: { select: { username: true } } },
      take: 52,
    }),
  ),

  // ---- Cash withdrawals (DEC-005, DEC-007) ------------------------------------------
  cashWithdrawals: view
    .input(z.object({ from: zDay.optional(), to: zDay.optional() }).default({}))
    .query(({ ctx, input }) =>
      ctx.db.cashWithdrawal.findMany({
        where: {
          withdrawnOn: {
            gte: input.from ? dayToDate(input.from) : undefined,
            lte: input.to ? dayToDate(input.to) : undefined,
          },
        },
        orderBy: { id: "desc" },
        include: { reason: true, withdrawnBy: { select: { username: true } } },
        take: 200,
      }),
    ),

  withdrawCash: permissionProcedure("caja.retiros")
    .input(z.object({ cashWithdrawalReasonId: zId, amount: zPositiveMoney, description: zOptText(200) }))
    .mutation(({ ctx, input }) =>
      ctx.db.cashWithdrawal.create({
        data: {
          cashWithdrawalReasonId: input.cashWithdrawalReasonId,
          amount: input.amount,
          description: input.description ?? null,
          withdrawnByUserId: ctx.user.id,
        },
      }),
    ),
});
