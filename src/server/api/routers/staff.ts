import { z } from "zod";

import { fail } from "~/server/api/errors";
import { createTRPCRouter, permissionProcedure } from "~/server/api/trpc";
import { requireOpenCash } from "~/server/domain/cash";
import { dayToDate, STAFF_KINDS, todayInManagua, zDay, zId, zOptText, zPhone, zPositiveMoney, zRate, zText } from "~/server/domain/constants";
import { totalOf, unpaidCommissions, unsettledAdvances } from "~/server/domain/commission";
import { D } from "~/server/domain/money";
import { type DbClient, type Prisma } from "~/server/db";

/**
 * API-018 — staff, mechanics' pay (commissions − advances), cash withdrawals.
 *
 * DEC-030: the pay period is the days the mechanic actually worked (not a fixed
 * week). A payout takes every delivered, unpaid order up to its end date —
 * including late ones from earlier periods (BR-104) — and every unsettled advance.
 */
const zChangeReason = z
  .string()
  .trim()
  .min(5, "Escriba el motivo del cambio (mínimo 5 letras).")
  .max(200, "El motivo es muy largo (máximo 200 letras).");

const view = permissionProcedure("personal.ver");
const pay = permissionProcedure("personal.pagos");

const dayEnd = (day: string) => new Date(new Date(`${day}T00:00:00-06:00`).getTime() + 86_400_000);

export const staffRouter = createTRPCRouter({
  list: view
    .input(
      z
        .object({
          includeInactive: z.boolean().default(false),
          /** Only people who can be the responsible of an order (DEC-041). */
          onlyRepairers: z.boolean().default(false),
        })
        .default({}),
    )
    .query(({ ctx, input }) =>
      ctx.db.staff.findMany({
        where: { active: input.includeInactive ? undefined : true, canRepair: input.onlyRepairers ? true : undefined },
        orderBy: [{ kind: "asc" }, { name: "asc" }],
        include: { appUser: { select: { id: true, username: true } } },
      }),
    ),

  /**
   * DEC-041: who the person is (owner, mechanic, manager), whether they repair
   * motorcycles, and their commission (e.g. 0.60 = 60 % of labor). No rate = no
   * commission: owners and the "100 %" mechanic, who is not paid by the system.
   */
  save: permissionProcedure("admin.usuarios")
    .input(
      z.object({
        id: zId.optional(),
        name: zText(100),
        phone: zPhone,
        kind: z.enum(STAFF_KINDS).default("MECANICO"),
        canRepair: z.boolean().optional(),
        commissionRate: zRate.nullish(),
        active: z.boolean().default(true),
      }),
    )
    .mutation(({ ctx, input }) => {
      // 100 % = like an owner: not paid by the system, so no rate at all (migration 8).
      const hasRate = !!input.commissionRate && D(input.commissionRate).gt(0) && D(input.commissionRate).lt(1);
      if (input.kind === "DUENO" && hasRate) throw fail("Un dueño no cobra comisión.");
      const data = {
        name: input.name,
        phone: input.phone,
        kind: input.kind,
        canRepair: input.canRepair ?? input.kind !== "ENCARGADO",
        commissionRate: hasRate ? input.commissionRate : null,
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
        await requireOpenCash(tx);
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
        if (input.markPaid) await requireOpenCash(tx);
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
    ctx.db.$transaction(async (tx) => {
      await requireOpenCash(tx);
      return tx.staffPayout.update({
        where: { id: input.staffPayoutId },
        data: { paidOn: dayToDate(todayInManagua()), paidByUserId: ctx.user.id },
      });
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

  // ---- Cash withdrawals (DEC-007, DEC-060) ------------------------------------------
  /** Withdrawals of a range (voided ones too, marked), newest first. */
  cashWithdrawals: view
    .input(z.object({ from: zDay.optional(), to: zDay.optional(), includeVoided: z.boolean().default(true) }).default({}))
    .query(({ ctx, input }) =>
      ctx.db.cashWithdrawal.findMany({
        where: {
          withdrawnOn: {
            gte: input.from ? dayToDate(input.from) : undefined,
            lte: input.to ? dayToDate(input.to) : undefined,
          },
          voidedAt: input.includeVoided ? undefined : null,
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: {
          reason: true,
          withdrawnBy: userName,
          voidedBy: userName,
          _count: { select: { changes: true } },
        },
        take: 500,
      }),
    ),

  /** One withdrawal with its log of edits and void (detail window). */
  withdrawal: view.input(z.object({ id: zId })).query(async ({ ctx, input }) => {
    const w = await ctx.db.cashWithdrawal.findUnique({
      where: { id: input.id },
      include: {
        reason: true,
        withdrawnBy: userName,
        voidedBy: userName,
        changes: { orderBy: [{ changedAt: "desc" }, { id: "desc" }], include: { changedBy: userName } },
      },
    });
    if (!w) throw fail("Ese retiro no existe.", "NOT_FOUND");
    return { ...w, ...(await withdrawalRights(ctx, w)) };
  }),

  withdrawCash: permissionProcedure("caja.retiros")
    .input(z.object({ cashWithdrawalReasonId: zId, amount: zPositiveMoney, description: zOptText(200) }))
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        await requireOpenCash(tx);
        const reason = await tx.cashWithdrawalReason.findUnique({ where: { id: input.cashWithdrawalReasonId } });
        if (!reason?.active) throw fail("Ese motivo de retiro no existe o está desactivado.");
        return tx.cashWithdrawal.create({
          data: {
            cashWithdrawalReasonId: input.cashWithdrawalReasonId,
            amount: input.amount,
            description: input.description ?? null,
            withdrawnByUserId: ctx.user.id,
          },
        });
      }),
    ),

  /**
   * DEC-060 — Fix a withdrawal (wrong amount, reason or detail). Who: an
   * administrator (caja.corregir) any day; the person who registered it, only
   * today while the cash is open. Always with a reason; it goes to the log.
   * If that day's cash was already closed, the arqueo shows «se registró dinero
   * después del cierre» until an administrator corrects the closing.
   */
  updateWithdrawal: permissionProcedure("caja.retiros")
    .input(
      z.object({
        id: zId,
        cashWithdrawalReasonId: zId,
        amount: zPositiveMoney,
        description: zOptText(200),
        reason: zChangeReason,
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        const w = await lockWithdrawal(tx, input.id);
        const rights = await withdrawalRights({ ...ctx, db: tx }, w);
        if (!rights.canEdit) throw fail(rights.blockedReason ?? "No puede cambiar este retiro.", "FORBIDDEN");
        if (!rights.isAdmin) await requireOpenCash(tx);
        const newReason = await tx.cashWithdrawalReason.findUnique({ where: { id: input.cashWithdrawalReasonId } });
        if (!newReason) throw fail("Ese motivo de retiro no existe.");
        const before = withdrawalSnapshot(w);
        const data = {
          cashWithdrawalReasonId: input.cashWithdrawalReasonId,
          amount: D(input.amount),
          description: input.description ?? null,
        };
        const after = withdrawalSnapshot({ ...w, ...data });
        if (JSON.stringify(before) === JSON.stringify(after)) throw fail("No cambió nada: el retiro ya tiene esos datos.");
        const updated = await tx.cashWithdrawal.update({ where: { id: w.id }, data });
        await tx.cashWithdrawalChange.create({
          data: { cashWithdrawalId: w.id, action: "EDICION", changedByUserId: ctx.user.id, reason: input.reason, before, after },
        });
        return updated;
      }),
    ),

  /** DEC-060 — Void a withdrawal (registered by mistake): it stays listed, crossed out, and stops counting. */
  voidWithdrawal: permissionProcedure("caja.retiros")
    .input(z.object({ id: zId, reason: zChangeReason }))
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        const w = await lockWithdrawal(tx, input.id);
        const rights = await withdrawalRights({ ...ctx, db: tx }, w);
        if (!rights.canEdit) throw fail(rights.blockedReason ?? "No puede anular este retiro.", "FORBIDDEN");
        if (!rights.isAdmin) await requireOpenCash(tx);
        const data = { voidedAt: new Date(), voidedByUserId: ctx.user.id, voidReason: input.reason };
        const updated = await tx.cashWithdrawal.update({ where: { id: w.id }, data });
        await tx.cashWithdrawalChange.create({
          data: {
            cashWithdrawalId: w.id,
            action: "ANULACION",
            changedByUserId: ctx.user.id,
            reason: input.reason,
            before: withdrawalSnapshot(w),
            after: withdrawalSnapshot(updated),
          },
        });
        return updated;
      }),
    ),
});

const userName = { select: { username: true, staff: { select: { name: true } } } } as const;

async function lockWithdrawal(tx: Prisma.TransactionClient, id: number) {
  await tx.$queryRaw`SELECT id FROM cash_withdrawal WHERE id = ${id} FOR UPDATE`;
  const w = await tx.cashWithdrawal.findUnique({ where: { id } });
  if (!w) throw fail("Ese retiro no existe.", "NOT_FOUND");
  return w;
}

/** What goes to the log (cash_withdrawal_change): the fields that can change. */
function withdrawalSnapshot(w: {
  cashWithdrawalReasonId: number;
  amount: Prisma.Decimal;
  description: string | null;
  voidedAt: Date | null;
  voidReason: string | null;
}) {
  return {
    cashWithdrawalReasonId: w.cashWithdrawalReasonId,
    amount: D(w.amount).toFixed(2),
    description: w.description,
    voidedAt: w.voidedAt?.toISOString() ?? null,
    voidReason: w.voidReason,
  };
}

/**
 * Who can fix a withdrawal: an administrator (caja.corregir) any day; the
 * person who registered it, today, while today's cash is open.
 */
async function withdrawalRights(
  ctx: { db: DbClient | Prisma.TransactionClient; user: { id: number; permissions: Set<string> } },
  w: { withdrawnByUserId: number; withdrawnOn: Date; voidedAt: Date | null },
) {
  const isAdmin = ctx.user.permissions.has("caja.corregir");
  if (w.voidedAt) return { isAdmin, canEdit: false, blockedReason: "El retiro está anulado: ya no se cambia." };
  if (isAdmin) return { isAdmin, canEdit: true, blockedReason: null };
  const today = todayInManagua();
  if (w.withdrawnByUserId !== ctx.user.id)
    return { isAdmin, canEdit: false, blockedReason: "Solo quien registró el retiro (o un administrador) puede cambiarlo." };
  if (w.withdrawnOn.toISOString().slice(0, 10) !== today)
    return { isAdmin, canEdit: false, blockedReason: "El retiro es de otro día: solo un administrador puede cambiarlo." };
  const open = await ctx.db.cashSession.findFirst({ where: { closedAt: null, businessDay: dayToDate(today) }, select: { id: true } });
  if (!open) return { isAdmin, canEdit: false, blockedReason: "La caja de hoy ya se cerró: solo un administrador puede cambiar el retiro." };
  return { isAdmin, canEdit: true, blockedReason: null };
}
