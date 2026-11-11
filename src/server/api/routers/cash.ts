import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { fail } from "~/server/api/errors";
import {
  createTRPCRouter,
  permissionProcedure,
  protectedProcedure,
} from "~/server/api/trpc";
import { type PermissionCode } from "~/server/auth/permissions";
import { cashSummary, expectedCash, hasMovements } from "~/server/domain/cash";
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
 * Apertura, cierre y arqueo de caja (migración 9c). Una caja por día:
 *   open    → con cuánto se empieza (C$ y US$)
 *   current → la caja abierta con lo que debería haber en este momento
 *   close   → se cuenta el dinero; se guarda esperado, contado y diferencia
 *   reopen  → solo un dueño (permiso de anular), solo la caja de hoy
 *   history → cajas anteriores con su sobrante / faltante
 * No cambia ventas, cobros ni retiros: solo lee lo que ya se registra.
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

const userSel = {
  select: { username: true, staff: { select: { name: true } } },
} as const;
const sessionInclude = { openedBy: userSel, closedBy: userSel } as const;

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
        await tx.$executeRawUnsafe(
          `SELECT pg_advisory_xact_lock(hashtext('cash_session'))`,
        );
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
            "La caja de hoy ya se cerró. Si fue un error, un dueño puede reabrirla.",
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
    return {
      session: { ...s, day: day(s.businessDay) },
      summary,
      expected: expectedCash({ nio: s.openingNio, usd: s.openingUsd }, summary),
    };
  }),

  close: permissionProcedure("caja.arqueo")
    .input(
      z.object({
        cashSessionId: zId,
        countedNio: zMoney,
        countedUsd: zMoney.default("0"),
        notes: zOptText(200),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM cash_session WHERE id = ${input.cashSessionId} FOR UPDATE`;
        const s = await tx.cashSession.findUnique({
          where: { id: input.cashSessionId },
        });
        if (!s) throw fail("Esa caja no existe.", "NOT_FOUND");
        if (s.closedAt) throw fail("Esa caja ya fue cerrada.", "CONFLICT");
        const summary = await cashSummary(tx, day(s.businessDay));
        const expected = expectedCash(
          { nio: s.openingNio, usd: s.openingUsd },
          summary,
        );
        const countedNio = D(input.countedNio);
        const countedUsd = D(input.countedUsd);
        const diffNio = countedNio.minus(expected.nio);
        const diffUsd = countedUsd.minus(expected.usd);
        if (!diffNio.isZero() || !diffUsd.isZero()) {
          if (!input.notes)
            throw fail(
              "Hay diferencia entre lo contado y lo esperado: escriba una nota que la explique.",
            );
        }
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
   * tiempo). Solo la caja abierta de hoy y solo si todavía no se movió dinero;
   * con movimientos, la caja se cierra con su arqueo. Después se puede abrir otra vez.
   */
  cancelOpening: permissionProcedure("caja.arqueo")
    .input(z.object({ cashSessionId: zId }))
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `SELECT pg_advisory_xact_lock(hashtext('cash_session'))`,
        );
        const s = await tx.cashSession.findUnique({
          where: { id: input.cashSessionId },
        });
        if (!s) throw fail("Esa caja no existe.", "NOT_FOUND");
        if (s.closedAt)
          throw fail("Esa caja ya se cerró: no se puede cancelar.", "CONFLICT");
        if (day(s.businessDay) !== todayInManagua())
          throw fail("Solo se puede cancelar la apertura de hoy.");
        if (hasMovements(await cashSummary(tx, day(s.businessDay))))
          throw fail(
            "Ya hay cobros o salidas de dinero hoy: la caja no se cancela, se cierra con el arqueo.",
            "CONFLICT",
          );
        await tx.cashSession.delete({ where: { id: s.id } });
        return { cancelled: true };
      }),
    ),

  /** Un dueño reabre la caja de HOY (p. ej. se contó mal o faltó registrar algo). */
  reopen: permissionProcedure("ventas.anular")
    .input(z.object({ cashSessionId: zId }))
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `SELECT pg_advisory_xact_lock(hashtext('cash_session'))`,
        );
        const s = await tx.cashSession.findUnique({
          where: { id: input.cashSessionId },
        });
        if (!s) throw fail("Esa caja no existe.", "NOT_FOUND");
        if (!s.closedAt) throw fail("Esa caja está abierta.");
        if (day(s.businessDay) !== todayInManagua())
          throw fail("Solo se puede reabrir la caja de hoy.");
        const open = await tx.cashSession.findFirst({
          where: { closedAt: null },
        });
        if (open) throw fail("Ya hay otra caja abierta.", "CONFLICT");
        const previous = s.closingNotes
          ? ` (cierre anterior: ${s.closingNotes})`
          : "";
        const note =
          `${s.openingNotes ? `${s.openingNotes} · ` : ""}Reabierta por ${ctx.user.username}${previous}`.slice(
            0,
            200,
          );
        return tx.cashSession.update({
          where: { id: s.id },
          data: {
            closedAt: null,
            closedByUserId: null,
            expectedNio: null,
            expectedUsd: null,
            countedNio: null,
            countedUsd: null,
            closingNotes: null,
            openingNotes: note,
          },
        });
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
        include: sessionInclude,
        take: 400,
      });
      return rows.map((s) => ({
        ...s,
        day: day(s.businessDay),
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
   * Detalle de una caja. Si está cerrada, recalcula y avisa cuando lo esperado
   * de hoy ya no coincide con lo guardado (se registró dinero después del cierre).
   */
  detail: viewProcedure
    .input(z.object({ cashSessionId: zId }))
    .query(async ({ ctx, input }) => {
      const s = await ctx.db.cashSession.findUnique({
        where: { id: input.cashSessionId },
        include: sessionInclude,
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
