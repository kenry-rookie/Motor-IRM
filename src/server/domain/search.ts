import { type DbClient, type Prisma } from "~/server/db";

/**
 * API-021 v2 — Typo-tolerant search (migration 3_fuzzy_search).
 *
 * Each product gets a score built from several signals, so a clean match always
 * beats a guess, but a misspelled word still finds something:
 *   +3    barcode equal to what was typed (scanner)
 *   +1    name starts with the text
 *   +0.6  name, brand or category contains the text
 *   +0..1 word_similarity: how well the text matches the best piece of the name
 *   +0..0.5 similarity of the whole name (helps short names)
 * Everything compares `mirm_norm()` = lower case, no accents.
 * A result is "exact" when it contains the text; otherwise it is a suggestion
 * ("¿Quiso decir…?").
 */
const MIN_SIMILARITY = 0.3;

type Db = DbClient | Prisma.TransactionClient;
export type Ranked = { id: number; score: number; exact: boolean };

/** Escapes LIKE wildcards so "50%" searches the text "50%". */
const likeSafe = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function rankProducts(db: Db, text: string, limit = 10): Promise<Ranked[]> {
  const raw = text.trim();
  if (!raw) return [];
  const term = likeSafe(raw);
  const rows = await db.$queryRaw<{ id: number; score: number; exact: boolean }[]>`
    WITH q AS (SELECT mirm_norm(${term}) AS t),
    doc AS (
      SELECT p.id, p.barcode, p.stock,
             mirm_norm(p.name) AS name_n,
             mirm_norm(p.name || ' ' || b.name || ' ' || c.name) AS all_n
        FROM product p
        JOIN product_brand b ON b.id = p.product_brand_id
        JOIN product_category c ON c.id = p.product_category_id
    )
    SELECT d.id,
           ( CASE WHEN d.barcode = ${raw} THEN 3 ELSE 0 END
           + CASE WHEN d.name_n LIKE q.t || '%' THEN 1 ELSE 0 END
           + CASE WHEN d.all_n LIKE '%' || q.t || '%' THEN 0.6 ELSE 0 END
           + word_similarity(q.t, d.all_n)
           + 0.5 * similarity(q.t, d.name_n)
           + CASE WHEN d.stock > 0 THEN 0.05 ELSE 0 END )::float8 AS score,
           (d.barcode = ${raw} OR d.all_n LIKE '%' || q.t || '%') AS exact
      FROM doc d, q
     WHERE d.barcode = ${raw}
        OR d.all_n LIKE '%' || q.t || '%'
        OR word_similarity(q.t, d.all_n) >= ${MIN_SIMILARITY}
     ORDER BY score DESC, d.id
     LIMIT ${limit}`;
  return rows.map((r) => ({ id: Number(r.id), score: Number(r.score), exact: Boolean(r.exact) }));
}

/** Customers by name (typo-tolerant), phone, cédula or motorcycle plate. */
export async function rankCustomers(db: Db, text: string, limit = 10): Promise<Ranked[]> {
  const raw = text.trim();
  if (!raw) return [];
  const term = likeSafe(raw);
  const digits = raw.replace(/\D/g, "");
  const rows = await db.$queryRaw<{ id: number; score: number; exact: boolean }[]>`
    WITH q AS (SELECT mirm_norm(${term}) AS t, upper(regexp_replace(${raw}, '[^A-Za-z0-9]', '', 'g')) AS p),
    doc AS (
      SELECT c.id,
             mirm_norm(c.name) AS name_n,
             regexp_replace(c.phone, '[^0-9]', '', 'g') AS phone_d,
             upper(coalesce(c.national_id, '')) AS nid,
             coalesce(string_agg(upper(regexp_replace(m.plate, '[^A-Za-z0-9]', '', 'g')), ' '), '') AS plates
        FROM customer c
        LEFT JOIN motorcycle m ON m.customer_id = c.id
       GROUP BY c.id
    )
    SELECT d.id,
           ( CASE WHEN d.nid <> '' AND d.nid = upper(${raw}) THEN 3 ELSE 0 END
           + CASE WHEN (length(q.p) >= 3 AND d.plates LIKE '%' || q.p || '%') THEN 2 ELSE 0 END
           + CASE WHEN length(${digits}) >= 4 AND d.phone_d LIKE '%' || ${digits} || '%' THEN 2 ELSE 0 END
           + CASE WHEN d.name_n LIKE q.t || '%' THEN 1 ELSE 0 END
           + CASE WHEN d.name_n LIKE '%' || q.t || '%' THEN 0.6 ELSE 0 END
           + word_similarity(q.t, d.name_n) )::float8 AS score,
           ( d.name_n LIKE '%' || q.t || '%'
             OR (length(q.p) >= 3 AND d.plates LIKE '%' || q.p || '%')
             OR (length(${digits}) >= 4 AND d.phone_d LIKE '%' || ${digits} || '%')
             OR (d.nid <> '' AND d.nid = upper(${raw})) ) AS exact
      FROM doc d, q
     WHERE d.name_n LIKE '%' || q.t || '%'
        OR word_similarity(q.t, d.name_n) >= ${MIN_SIMILARITY}
        OR (length(q.p) >= 3 AND d.plates LIKE '%' || q.p || '%')
        OR (length(${digits}) >= 4 AND d.phone_d LIKE '%' || ${digits} || '%')
        OR (d.nid <> '' AND d.nid = upper(${raw}))
     ORDER BY score DESC, d.id
     LIMIT ${limit}`;
  return rows.map((r) => ({ id: Number(r.id), score: Number(r.score), exact: Boolean(r.exact) }));
}

/** Keeps the ranking order when the full rows come back from findMany. */
export function inRankOrder<T extends { id: number }>(ranked: Ranked[], rows: T[]) {
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ranked.flatMap((r) => {
    const row = byId.get(r.id);
    return row ? [{ ...row, exact: r.exact, score: r.score }] : [];
  });
}
