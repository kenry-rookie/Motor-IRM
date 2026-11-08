/**
 * tRPC setup: context, error formatting and the procedure types every router uses.
 *
 *   publicProcedure              anyone (only login/session use it)
 *   protectedProcedure           a logged-in user — ctx.user is guaranteed (API-004)
 *   permissionProcedure("a.b")   a logged-in user whose role has that permission (API-005)
 *
 * Audit columns (created_by_user_id, registered_by_user_id, …) are ALWAYS filled
 * with ctx.user.id inside the routers, never taken from the input (API-006).
 */
import { initTRPC, TRPCError } from "@trpc/server";
import { ZodError } from "zod";

import { transformer } from "~/lib/transformer";
import { mapDatabaseError } from "~/server/api/errors";
import { type PermissionCode } from "~/server/auth/permissions";
import { getSessionUser, readSessionToken } from "~/server/auth/session";
import { db } from "~/server/db";

/**
 * 1. CONTEXT — built per request. `resHeaders` exists on HTTP requests (it is how
 * login/logout set the cookie); server components calling the API don't have it.
 */
export const createTRPCContext = async (opts: { headers: Headers; resHeaders?: Headers }) => {
  const sessionToken = readSessionToken(opts.headers);
  const user = await getSessionUser(db, sessionToken);
  return { db, user, sessionToken, ...opts };
};

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

/** 2. INITIALIZATION */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;

/** 3. MIDDLEWARES */

const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();
  const result = await next();
  if (t._config.isDev) console.log(`[TRPC] ${path} took ${Date.now() - start}ms to execute`);
  return result;
});

/** API-009: database rule violations become readable messages. */
const dbErrorMiddleware = t.middleware(async ({ next }) => {
  const result = await next();
  if (!result.ok) {
    const mapped = mapDatabaseError(result.error.cause) ?? mapDatabaseError(result.error);
    if (mapped) throw mapped;
  }
  return result;
});

const authMiddleware = t.middleware(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Inicie sesión para continuar." });
  return next({ ctx: { ...ctx, user: ctx.user } });
});

/** 4. PROCEDURES */

export const publicProcedure = t.procedure.use(timingMiddleware).use(dbErrorMiddleware);

export const protectedProcedure = publicProcedure.use(authMiddleware);

/** Requires every listed permission. */
export const permissionProcedure = (...codes: PermissionCode[]) =>
  protectedProcedure.use(({ ctx, next }) => {
    const missing = codes.filter((c) => !ctx.user.permissions.has(c));
    if (missing.length > 0) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Su rol no tiene permiso para esta acción (${missing.join(", ")}).`,
      });
    }
    return next();
  });
