import { type DbClient, type Prisma } from "~/server/db";

/**
 * DEC-046 — Raw SQL without nested fragments.
 *
 * Under Next.js (Turbopack) a `Prisma.sql` / `Prisma.raw` / `Prisma.join` fragment
 * placed INSIDE a `$queryRaw` template is not recognized as SQL and is sent as a
 * JSON parameter ("argument of AND must be type boolean, not type jsonb",
 * "date_trunc(jsonb, date)"). Vitest doesn't bundle, so tests never saw it.
 *
 * Rule: build the SQL text here and pass ONLY plain values as parameters
 * ($1, $2…), then run it with `$queryRawUnsafe`. Values never go into the text;
 * the only thing inlined are integer lists checked one by one (`intList`) and
 * fixed words chosen from a whitelist by the caller.
 */
type Db = DbClient | Prisma.TransactionClient;

export class Sql {
  private readonly params: unknown[] = [];
  /** Adds a parameter and returns its placeholder, e.g. `$3::date`. */
  p(value: unknown, cast?: string) {
    this.params.push(value);
    return `$${this.params.length}${cast ? `::${cast}` : ""}`;
  }
  run<T>(db: Db, text: string) {
    return db.$queryRawUnsafe<T>(text, ...this.params);
  }
}

/** "1,2,3" for `IN (…)`; every value must be a safe integer. Empty → "NULL" (matches nothing). */
export function intList(ids: readonly number[]) {
  for (const id of ids) if (!Number.isSafeInteger(id)) throw new Error(`intList: ${String(id)} is not an integer`);
  return ids.length ? ids.join(",") : "NULL";
}

/** Locks rows of a table by id inside the caller's transaction (SELECT … FOR UPDATE). */
export async function lockRows(tx: Prisma.TransactionClient, table: "sale_invoice" | "customer_opening_balance", ids: number[]) {
  if (!ids.length) return;
  await tx.$queryRawUnsafe(`SELECT id FROM ${table} WHERE id IN (${intList(ids)}) FOR UPDATE`);
}
