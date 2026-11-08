import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { hashPassword, PASSWORD_MIN_LENGTH, verifyPassword } from "~/server/auth/password";
import {
  clearedSessionCookie,
  createSession,
  deleteSession,
  hashToken,
  sessionCookie,
} from "~/server/auth/session";

// API-004 — login, logout, current user, change password.
export const authRouter = createTRPCRouter({
  login: publicProcedure
    .input(z.object({ username: z.string().trim().min(1), password: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const users = await ctx.db.appUser.findMany({
        where: { username: { equals: input.username, mode: "insensitive" } },
        include: { role: true },
        take: 1,
      });
      const user = users[0];
      // Same message whether the user exists or not: don't reveal valid usernames.
      const ok = user ? await verifyPassword(input.password, user.passwordHash) : false;
      if (!user || !ok || !user.active || !user.role.active) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Usuario o contraseña incorrectos." });
      }
      if (!ctx.resHeaders) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "El inicio de sesión solo funciona por HTTP." });
      }
      const { token, expiresAt } = await createSession(ctx.db, user.id);
      await ctx.db.appUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
      // Housekeeping: drop this user's expired sessions.
      await ctx.db.appSession.deleteMany({ where: { appUserId: user.id, expiresAt: { lt: new Date() } } });
      ctx.resHeaders.append("Set-Cookie", sessionCookie(token, expiresAt));
      return { username: user.username, role: user.role.name };
    }),

  logout: publicProcedure.mutation(async ({ ctx }) => {
    if (ctx.sessionToken) await deleteSession(ctx.db, ctx.sessionToken);
    ctx.resHeaders?.append("Set-Cookie", clearedSessionCookie());
    return { ok: true };
  }),

  /** null when nobody is logged in (the client redirects to /login). */
  me: publicProcedure.query(({ ctx }) =>
    ctx.user
      ? {
          id: ctx.user.id,
          username: ctx.user.username,
          role: ctx.user.roleName,
          staffName: ctx.user.staffName,
          permissions: [...ctx.user.permissions].sort(),
        }
      : null,
  ),

  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(PASSWORD_MIN_LENGTH, `Mínimo ${PASSWORD_MIN_LENGTH} caracteres`),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.appUser.findUniqueOrThrow({ where: { id: ctx.user.id } });
      if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "La contraseña actual no es correcta." });
      }
      await ctx.db.appUser.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(input.newPassword) },
      });
      // Close every other session of this user.
      const current = ctx.sessionToken ? hashToken(ctx.sessionToken) : "";
      await ctx.db.appSession.deleteMany({ where: { appUserId: user.id, tokenHash: { not: current } } });
      return { ok: true };
    }),
});
