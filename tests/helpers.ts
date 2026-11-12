import { createCaller } from "~/server/api/root";
import { getSessionUser, createSession } from "~/server/auth/session";
import { db } from "~/server/db";

export { db };

/** A caller logged in as `username` (created by the seed), going through the real session code. */
export async function callerAs(username: string) {
  const user = await db.appUser.findFirstOrThrow({ where: { username } });
  const { token } = await createSession(db, user.id);
  const sessionUser = await getSessionUser(db, token);
  return createCaller({ db, user: sessionUser, sessionToken: token, headers: new Headers() });
}

export async function productByBarcode(barcode: string) {
  return db.product.findUniqueOrThrow({ where: { barcode } });
}

export async function idOf(model: "paymentMethod" | "returnReason", name: string) {
  const row =
    model === "paymentMethod"
      ? await db.paymentMethod.findFirstOrThrow({ where: { name } })
      : await db.returnReason.findFirstOrThrow({ where: { name } });
  return row.id;
}
