import { z } from "zod";

import { fail } from "~/server/api/errors";
import { verifyPassword } from "~/server/auth/password";
import { type PermissionCode } from "~/server/auth/permissions";
import { type SessionUser } from "~/server/auth/session";
import { type DbClient, type Prisma } from "~/server/db";

/**
 * Some actions need someone with more permissions to approve them at the counter
 * (a discount, a sale on credit). If the logged-in user has the permission, they
 * are the authorizer. Otherwise an owner types their username and password in the
 * same screen (`authorizer`), and that user is recorded as the one who authorized.
 */
export const zAuthorizer = z
  .object({ username: z.string().trim().min(1), password: z.string().min(1) })
  .optional();

export async function resolveAuthorizer(
  db: DbClient | Prisma.TransactionClient,
  user: SessionUser,
  permission: PermissionCode,
  authorizer?: { username: string; password: string },
): Promise<number> {
  if (user.permissions.has(permission)) return user.id;
  if (!authorizer) throw fail(`Necesita la autorización de alguien con permiso «${permission}».`, "FORBIDDEN");

  const candidates = await db.appUser.findMany({
    where: { username: { equals: authorizer.username, mode: "insensitive" }, active: true },
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  });
  const found = candidates[0];
  const ok = found ? await verifyPassword(authorizer.password, found.passwordHash) : false;
  if (!found || !ok) throw fail("Usuario o contraseña de quien autoriza incorrectos.", "FORBIDDEN");
  const has = found.role.active && found.role.permissions.some((rp) => rp.permission.code === permission);
  if (!has) throw fail(`${found.username} no tiene permiso para autorizar esto (${permission}).`, "FORBIDDEN");
  return found.id;
}
