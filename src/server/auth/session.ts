import { createHash, randomBytes } from "node:crypto";

import type { DbClient } from "~/server/db";

export const SESSION_COOKIE = "mirm_session";
/** A work day plus margin: the counter PC stays logged in during the shift. */
export const SESSION_TTL_HOURS = 14;

export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export function readSessionToken(headers: Headers): string | null {
  const cookie = headers.get("cookie");
  if (!cookie) return null;
  for (const part of cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function sessionCookie(token: string, expires: Date): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires.toUTCString()}${secure}`;
}

export const clearedSessionCookie = () =>
  `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

export async function createSession(db: DbClient, appUserId: number) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600_000);
  await db.appSession.create({
    data: { appUserId, tokenHash: hashToken(token), expiresAt },
  });
  return { token, expiresAt };
}

export type SessionUser = {
  id: number;
  username: string;
  roleId: number;
  roleName: string;
  staffId: number | null;
  staffName: string | null;
  permissions: Set<string>;
};

/** Loads the user behind a session cookie, or null if it is missing/expired/inactive. */
export async function getSessionUser(db: DbClient, token: string | null): Promise<SessionUser | null> {
  if (!token) return null;
  const session = await db.appSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      appUser: {
        include: {
          staff: { select: { name: true } },
          role: { include: { permissions: { include: { permission: true } } } },
        },
      },
    },
  });
  if (!session || session.expiresAt <= new Date()) return null;
  const u = session.appUser;
  if (!u.active || !u.role.active) return null;
  return {
    id: u.id,
    username: u.username,
    roleId: u.roleId,
    roleName: u.role.name,
    staffId: u.staffId,
    staffName: u.staff?.name ?? null,
    permissions: new Set(u.role.permissions.map((rp) => rp.permission.code)),
  };
}

export async function deleteSession(db: DbClient, token: string) {
  await db.appSession.deleteMany({ where: { tokenHash: hashToken(token) } });
}
