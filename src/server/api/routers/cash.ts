import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { fail } from "~/server/api/errors";
import {
  createTRPCRouter,
  permissionProcedure,
  protectedProcedure,
} from "~/server/api/trpc";
import { type PermissionCode } from "~/server/auth/permissions";
import { type Prisma } from "~/server/db";
import {
  canCancelOpening,
  cashSnapshot,
  cashSummary,
  expectedCash,
  movementsSince,
  validateCount,
} from "~/server/domain/cash";
import {
  dayToDate,
  todayInManagua,
  zDay,
  zId,
  zMoney,
  zOptText,
} from "~/server/domain/constants";
import { D, ZERO } from "~/server/domain/money";

/**
 * Apertura, cierre y arqueo de caja (migraciones 9c, 9d, 9e). Una caja por día:
 *   open         → con cuánto se empieza (C$ y US$)
 *   current      → la caja abierta con lo que debería haber en este momento
 *   close        → se cuenta el dinero; se guarda esperado, contado y diferencia
 *   cancelOpening→ deshacer una apertura hecha por error
 *   reopen       → ADMIN: reabre la caja de HOY (se cerró antes de tiempo)
 *   correct      → ADMIN: corrige el cierre de cualquier caja ya cerrada
 *   discardToday → ADMIN: elimina la caja de hoy (prueba / abierta por error)
 *   history      → cajas de un rango con su sobrante / faltante
 *   detail       → una caja, con su bitácora de cambios
 * Reabrir, corregir y eliminar quedan en la bitácora cash_session_change
 * (quién, cuándo, por qué, antes y después). No cambia ventas, cobros ni
 * retiros: el arqueo solo lee lo que ya se registra.
 */
const day = (d: Date) => d.toISOString().slice(0, 10);

/** Ver el arqueo: quien abre/cierra caja o quien ve reportes (dueños). */
const VIEW: PermissionCode[] = ["caja.arqueo", "reportes.ver"];
const viewProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!VIEW.some((c) => ctx.user.permissions.has(c)))
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Su rol no tiene permiso para ver la caja (caja.arqueo).",
    });
  return next();
});

/** Reabrir, corregir y eliminar: solo perfiles de administrador. */
const FIX: PermissionCode = "caja.corregir";
const fixProcedure = permissionProcedure(FIX);

const zReason = z
  .string()
  .trim()
  .min(5, "Escriba el motivo (mínimo 5 letras).")
  .max(200, "El motivo es muy largo (máximo 200 letras).");

const userSel = {
  select: { username: true, staff: { select: { name: true } } },
} as const;
const sessionInclude = { openedBy: userSel, closedBy: userSel } as const;

/** Una operación de caja a la vez (abrir, cerrar, reabrir, corregir, eliminar). */
const lockCash = (tx: Prisma.TransactionClient) =>
  tx.$executeRawUnsafe(
    `SELECT pg_advisory_xact_lock(hashtext('cash_session'))`,
  );

/** Bloquea la fila de la caja: los cobros en curso (FOR SHARE) terminan primero. */
async function lockSession(tx: Prisma.TransactionClient, id: number) {
  await tx.$queryRaw`SELECT id FROM cash_session WHERE id = ${id} FOR UPDATE`;
  const s = await tx.cashSession.findUnique({ where: { id } });
  if (!s) throw fail("Esa caja no existe.", "NOT_FOUND");
  return s;
}

export const cashRouter = createTRPCRouter({
  /**
   * Para el aviso de la barra superior y la pantalla de caja: ¿hay caja abierta?,
   * ¿es de hoy?, ¿ya se cerró la de hoy? Cualquier usuario con sesión.
   */
  status: protectedProcedure.query(async ({ ctx }) => {
    const today = todayInManagua();
    const open = await ctx.db.cashSession.findFirst({
      where: { closedAt: null },
      select: { id: true, businessDay: true },
    });
    const todays = await ctx.db.cashSession.findUnique({
      where: { businessDay: dayToDate(today) },
      select: { id: true, closedAt: true },
    });
    const last = await ctx.db.cashSession.findFirst({
      where: { closedAt: { not: null } },
      orderBy: { businessDay: "desc" },
      select: { countedNio: true, countedUsd: true },
    });
    return {
      today,
      open: open
        ? {
            id: open.id,
            day: day(open.businessDay),
            isToday: day(open.businessDay) === today,
          }
        : null,
      todayClosed: Boolean(todays?.closedAt),
      /** La caja de hoy (abierta o cerrada), si existe. */
      todaySessionId: todays?.id ?? null,
      /** Sugerencia para abrir: lo que se contó al cerrar la última caja. */
      suggestedOpening: {
        nio: (last?.countedNio ?? ZERO).toString(),
        usd: (last?.countedUsd ?? ZERO).toString(),
      },
    };
  }),

  open: permissionProcedure("caja.arqueo")
    .input(
      z.object({
        openingNio: zMoney,
        openingUsd: zMoney.default("0"),
        notes: zOptText(200),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        const today = todayInManagua();
        // Serializa dos aperturas al mismo tiempo (dos pestañas, dos computadoras).
        await lockCash(tx);
        const open = await tx.cashSession.findFirst({
          where: { closedAt: null },
        });
        if (open) {
          const d = day(open.businessDay);
          throw fail(
            d === today
              ? "La caja de hoy ya está abierta."
              : `La caja del ${d} sigue abierta: ciérrela (arqueo) antes de abrir la de hoy.`,
            "CONFLICT",
          );
        }
        const todays = await tx.cashSession.findUnique({
          where: { businessDay: dayToDate(today) },
        });
        if (todays)
          throw fail(
            "La caja de hoy ya se cerró. Si fue un error, un administrador puede reabrirla.",
            "CONFLICT",
          );
        return tx.cashSession.create({
          data: {
            businessDay: dayToDate(today),
            openedByUserId: ctx.user.id,
            openingNio: input.openingNio,
            openingUsd: input.openingUsd,
            openingNotes: input.notes ?? null,
          },
        });
      }),
    ),

  /** La caja abierta (si hay) con el detalle de lo que debería haber ahora. */
  current: viewProcedure.query(async ({ ctx }) => {
    const s = await ctx.db.cashSession.findFirst({
      where: { closedAt: null },
      include: sessionInclude,
    });
    if (!s) return null;
    const summary = await cashSummary(ctx.db, day(s.businessDay));
    const cancel = canCancelOpening({
      isOwner: ctx.user.permissions.has(FIX),
      openedAt: s.openedAt,
      movedSinceOpening: await movementsSince(ctx.db, s.openedAt),
    });
    return {
      session: { ...s, day: day(s.businessDay) },
      summary,
      expected: expectedCash({ nio: s.openingNio, usd: s.openingUsd }, summary),
      /** null = se puede cancelar; texto = por qué no. */
      cancelBlockedReason: cancel.ok ? null : cancel.reason,
    };
  }),

  close: permissionProcedure("caja.arqueo")
    .input(
      z.object({
        cashSessionId: zId,
        countedNio: zMoney,
        /** Sin dólares en la gaveta se puede omitir (= 0). Si debería haber, es obligatorio. */
        countedUsd: zMoney.optional(),
        notes: zOptText(200),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        await lockCash(tx);
        const s = await lockSession(tx, input.cashSessionId);
        if (s.closedAt) throw fail("Esa caja ya fue cerrada.", "CONFLICT");
        const summary = await cashSummary(tx, day(s.businessDay));
        const expected = expectedCash(
          { nio: s.openingNio, usd: s.openingUsd },
          summary,
        );
        const countedNio = D(input.countedNio);
        const { countedUsd, diffNio, diffUsd } = validateCount({
          expected,
          countedNio,
          countedUsd:
            input.countedUsd === undefined ? undefined : D(input.countedUsd),
          notes: input.notes,
        });
        const closed = await tx.cashSession.update({
          where: { id: s.id },
          data: {
            closedAt: new Date(),
            closedByUserId: ctx.user.id,
            expectedNio: expected.nio,
            expectedUsd: expected.usd,
            countedNio,
            countedUsd,
            closingNotes: input.notes ?? null,
          },
        });
        return { session: closed, expected, diffNio, diffUsd };
      }),
    ),

  /**
   * Cancela una apertura hecha por error (monto mal puesto, se abrió antes de
   * tiempo). Solo la caja abierta de hoy. El encargado: si todavía no se cobró
   * y en los primeros minutos. Un administrador: siempre.
   */
  cancelOpening: permissionProcedure("caja.arqueo")
    .input(z.object({ cashSessionId: zId }))
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        await lockCash(tx);
        const s = await lockSession(tx, input.cashSessionId);
        if (s.closedAt)
          throw fail("Esa caja ya se cerró: no se puede cancelar.", "CONFLICT");
        if (day(s.businessDay) !== todayInManagua())
          throw fail("Solo se puede cancelar la apertura de hoy.");
        const can = canCancelOpening({
          isOwner: ctx.user.permissions.has(FIX),
          openedAt: s.openedAt,
          movedSinceOpening: await movementsSince(tx, s.openedAt),
        });
        if (!can.ok) throw fail(can.reason, "CONFLICT");
        await tx.cashSession.delete({ where: { id: s.id } });
        return { cancelled: true };
      }),
    ),

  /**
   * ADMIN: reabre la caja de HOY (se cerró antes de tiempo o faltó registrar
   * algo). Se borra el conteo y la caja vuelve a quedar abierta con la misma
   * apertura; después se cierra otra vez. Solo la de hoy: lo que se cobre al
   * reabrir es de hoy. Para una caja de otro día, use «corregir».
   */
  reopen: fixProcedure
    .input(z.object({ cashSessionId: zId, reason: zReason }))
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        await lockCash(tx);
        const s = await lockSession(tx, input.cashSessionId);
        if (!s.closedAt) throw fail("Esa caja está abierta.", "CONFLICT");
        if (day(s.businessDay) !== todayInManagua())
          throw fail(
            "Solo se puede reabrir la caja de hoy. Para una caja de otro día use «Corregir cierre».",
          );
        const open = await tx.cashSession.findFirst({
          where: { closedAt: null },
        });
        if (open) throw fail("Ya hay otra caja abierta.", "CONFLICT");
        const updated = await tx.cashSession.update({
          where: { id: s.id },
          data: {
            closedAt: null,
            closedByUserId: null,
            expectedNio: null,
            expectedUsd: null,
            countedNio: null,
            countedUsd: null,
            closingNotes: null,
          },
        });
        await tx.cashSessionChange.create({
          data: {
            cashSessionId: s.id,
            businessDay: s.businessDay,
            action: "REAPERTURA",
            changedByUserId: ctx.user.id,
            reason: input.reason,
            before: cashSnapshot(s),
            after: cashSnapshot(updated),
          },
        });
        return updated;
      }),
    ),

  /**
   * ADMIN: corrige el cierre de una caja YA CERRADA (cualquier día): apertura,
   * conteo y nota. Lo esperado se vuelve a calcular con los movimientos que hay
   * hoy registrados para ese día, así también se arregla el aviso de «se
   * registró dinero después del cierre». Quién cerró y cuándo no cambia; la
   * corrección queda en la bitácora con el motivo.
   */
  correct: fixProcedure
    .input(
      z.object({
        cashSessionId: zId,
        openingNio: zMoney,
        openingUsd: zMoney,
        countedNio: zMoney,
        countedUsd: zMoney,
        closingNotes: zOptText(200),
        reason: zReason,
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        await lockCash(tx);
        const s = await lockSession(tx, input.cashSessionId);
        if (!s.closedAt)
          throw fail(
            "Esa caja está abierta: ciérrela con el arqueo; solo se corrige una caja cerrada.",
            "CONFLICT",
          );
        const summary = await cashSummary(tx, day(s.businessDay));
        const opening = {
          nio: D(input.openingNio),
          usd: D(input.openingUsd),
        };
        const expected = expectedCash(opening, summary);
        const countedNio = D(input.countedNio);
        const { countedUsd, diffNio, diffUsd } = validateCount({
          expected,
          countedNio,
          countedUsd: D(input.countedUsd),
          notes: input.closingNotes,
        });
        const data = {
          openingNio: opening.nio,
          openingUsd: opening.usd,
          expectedNio: expected.nio,
          expectedUsd: expected.usd,
          countedNio,
          countedUsd,
          closingNotes: input.closingNotes ?? null,
        };
        const before = cashSnapshot(s);
        const after = cashSnapshot({ ...s, ...data });
        if (JSON.stringify(before) === JSON.stringify(after))
          throw fail("No cambió nada: la caja ya tiene esos valores.");
        const updated = await tx.cashSession.update({
          where: { id: s.id },
          data,
        });
        await tx.cashSessionChange.create({
          data: {
            cashSessionId: s.id,
            businessDay: s.businessDay,
            action: "CORRECCION",
            changedByUserId: ctx.user.id,
            reason: input.reason,
            before,
            after,
          },
        });
        return { session: updated, expected, diffNio, diffUsd };
      }),
    ),

  /**
   * ADMIN: ELIMINA la caja de hoy (abierta o cerrada): para una prueba o una
   * caja abierta/cerrada por error. Los cobros y salidas del día no se tocan:
   * siguen siendo del día y la próxima caja de hoy los vuelve a sumar.
   * Las cajas de días anteriores no se eliminan (son el registro del arqueo).
   * La bitácora conserva la foto de lo que se eliminó.
   */
  discardToday: fixProcedure
    .input(z.object({ cashSessionId: zId, reason: zReason }))
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        await lockCash(tx);
        const s = await lockSession(tx, input.cashSessionId);
        if (day(s.businessDay) !== todayInManagua())
          throw fail(
            "Solo se puede eliminar la caja de hoy: las de días anteriores quedan como registro (use «Corregir cierre»).",
          );
        await tx.cashSessionChange.create({
          data: {
            cashSessionId: s.id,
            businessDay: s.businessDay,
            action: "ELIMINACION",
            changedByUserId: ctx.user.id,
            reason: input.reason,
            before: cashSnapshot(s),
          },
        });
        // El trigger solo deja borrar cajas abiertas: primero se quita el cierre.
        if (s.closedAt) {
          await tx.cashSession.update({
            where: { id: s.id },
            data: {
              closedAt: null,
              closedByUserId: null,
              expectedNio: null,
              expectedUsd: null,
              countedNio: null,
              countedUsd: null,
              closingNotes: null,
            },
          });
        }
        await tx.cashSession.delete({ where: { id: s.id } });
        return { discarded: true };
      }),
    ),

  /** Cajas de un rango de días (las más recientes primero) con su diferencia. */
  history: viewProcedure
    .input(z.object({ from: zDay, to: zDay }))
    .query(async ({ ctx, input }) => {
      if (input.to < input.from)
        throw fail("La fecha final es antes de la inicial.");
      const rows = await ctx.db.cashSession.findMany({
        where: {
          businessDay: { gte: dayToDate(input.from), lte: dayToDate(input.to) },
        },
        orderBy: { businessDay: "desc" },
        include: { ...sessionInclude, _count: { select: { changes: true } } },
        take: 400,
      });
      return rows.map(({ _count, ...s }) => ({
        ...s,
        day: day(s.businessDay),
        changes: _count.changes,
        diffNio:
          s.countedNio && s.expectedNio
            ? s.countedNio.minus(s.expectedNio)
            : null,
        diffUsd:
          s.countedUsd && s.expectedUsd
            ? s.countedUsd.minus(s.expectedUsd)
            : null,
      }));
    }),

  /**
   * Detalle de una caja con su bitácora. Si está cerrada, recalcula y avisa
   * cuando lo esperado ya no coincide con lo guardado (se registró dinero de
   * ese día después del cierre).
   */
  detail: viewProcedure
    .input(z.object({ cashSessionId: zId }))
    .query(async ({ ctx, input }) => {
      const s = await ctx.db.cashSession.findUnique({
        where: { id: input.cashSessionId },
        include: {
          ...sessionInclude,
          changes: {
            // changed_at va en segundos: dos cambios en el mismo segundo se ordenan por id.
            orderBy: [{ changedAt: "desc" }, { id: "desc" }],
            include: { changedBy: userSel },
          },
        },
      });
      if (!s) throw fail("Esa caja no existe.", "NOT_FOUND");
      const summary = await cashSummary(ctx.db, day(s.businessDay));
      const now = expectedCash(
        { nio: s.openingNio, usd: s.openingUsd },
        summary,
      );
      const changedAfterClose =
        s.closedAt !== null &&
        (!now.nio.equals(s.expectedNio ?? ZERO) ||
          !now.usd.equals(s.expectedUsd ?? ZERO));
      return {
        session: { ...s, day: day(s.businessDay) },
        summary,
        expectedNow: now,
        changedAfterClose,
      };
    }),
});
