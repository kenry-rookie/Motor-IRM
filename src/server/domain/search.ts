import { type DbClient, type Prisma } from "~/server/db";
import { Sql } from "~/server/domain/sql";

/**
 * API-021 v3 — ONE search service for products and customers (DEC-043), with
 * filters and sorting done by PostgreSQL (DEC-049). With text, results are
 * ranked and tolerant to typos (migration 3_fuzzy_search); without text, it is
 * a filtered list. Raw SQL follows DEC-046 (plain parameters, no fragments).
 *
 * Product score:   +3 barcode equal · +1 name starts with · +0.6 contains ·
 *                  +0..1 word_similarity · +0..0.5 similarity of the whole name
 * Customer score:  +3 cédula · +2 plate · +2 phone · +1 starts with · +0.6 contains ·
 *                  +0..1 word_similarity
 * A result is "exact" when it contains the text; otherwise it is a suggestion.
 */
const MIN_SIMILARITY = 0.3;

type Db = DbClient | Prisma.TransactionClient;
export type Ranked = { id: number; score: number; exact: boolean };

/** What a product / customer row carries wherever it is listed or searched. */
export const productInclude = { category: true, brand: true } satisfies Prisma.ProductInclude;
export const customerInclude = {
  motorcycles: { include: { model: { include: { brand: true } } } },
} satisfies Prisma.CustomerInclude;

/** Escapes LIKE wildcards so "50%" searches the text "50%". */
const likeSafe = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

// ---------------------------------------------------------------------------
//  Products
// ---------------------------------------------------------------------------

export const PRODUCT_STOCK_FILTERS = ["agotado", "poco", "disponible"] as const;
export const PRODUCT_SORTS = ["relevancia", "nombre", "precio_asc", "precio_desc", "stock_asc", "mas_vendidos", "margen"] as const;

export type ProductFilters = {
  q?: string;
  categoryId?: number;
  brandId?: number;
  qualityTier?: string;
  stock?: (typeof PRODUCT_STOCK_FILTERS)[number];
  supplierId?: number;
  /** true = only the deactivated ones (Administración); otherwise only active products. */
  inactive?: boolean;
  sort?: (typeof PRODUCT_SORTS)[number];
  limit: number;
  offset?: number;
};

/** "Poco stock" until each product has its own minimum (Phase 5). */
export const LOW_STOCK = 2;

export async function searchProductIds(db: Db, f: ProductFilters) {
  const q = new Sql();
  const text = f.q?.trim() ?? "";
  // Deactivated products only show up in Administración (migration 9b).
  const where: string[] = [f.inactive ? "NOT p.active" : "p.active"];
  let score = "0";
  let exact = "true";
  if (text) {
    const raw = q.p(text, "text");
    const t = `mirm_norm(${q.p(likeSafe(text), "text")})`;
    score = `( CASE WHEN p.barcode = ${raw} THEN 3 ELSE 0 END
             + CASE WHEN mirm_norm(p.name) LIKE ${t} || '%' THEN 1 ELSE 0 END
             + CASE WHEN d.all_n LIKE '%' || ${t} || '%' THEN 0.6 ELSE 0 END
             + word_similarity(${t}, d.all_n)
             + 0.5 * similarity(${t}, mirm_norm(p.name))
             + CASE WHEN p.stock > 0 THEN 0.05 ELSE 0 END )`;
    exact = `(coalesce(p.barcode = ${raw}, false) OR d.all_n LIKE '%' || ${t} || '%')`;
    where.push(`(p.barcode = ${raw} OR d.all_n LIKE '%' || ${t} || '%' OR word_similarity(${t}, d.all_n) >= ${MIN_SIMILARITY})`);
  }
  if (f.categoryId) where.push(`p.product_category_id = ${q.p(f.categoryId, "int")}`);
  if (f.brandId) where.push(`p.product_brand_id = ${q.p(f.brandId, "int")}`);
  if (f.qualityTier) where.push(`p.quality_tier = ${q.p(f.qualityTier, "text")}`);
  if (f.supplierId) where.push(`${q.p(f.supplierId, "int")} = ANY(o.supplier_ids)`);
  if (f.stock === "agotado") where.push("p.stock = 0");
  if (f.stock === "poco") where.push(`p.stock BETWEEN 1 AND ${LOW_STOCK}`);
  if (f.stock === "disponible") where.push("p.stock > 0");

  const order = {
    relevancia: text ? "score DESC, p.id" : "p.name, p.id",
    nombre: "p.name, p.id",
    precio_asc: "p.list_price, p.name",
    precio_desc: "p.list_price DESC, p.name",
    stock_asc: "p.stock, p.name",
    mas_vendidos: "o.sold_90d DESC, p.name",
    margen: "o.margin_pct DESC NULLS LAST, p.name",
  }[f.sort ?? "relevancia"];

  const rows = await q.run<{ id: number; score: number; exact: boolean; total: number }[]>(
    db,
    `WITH d AS (
       SELECT p.id, mirm_norm(p.name || ' ' || b.name || ' ' || c.name || ' ' || coalesce(p.barcode, '')) AS all_n
         FROM product p
         JOIN product_brand b ON b.id = p.product_brand_id
         JOIN product_category c ON c.id = p.product_category_id
     )
     SELECT p.id, (${score})::float8 AS score, ${exact} AS exact, count(*) OVER ()::int AS total
       FROM product p
       JOIN d ON d.id = p.id
       JOIN v_product_overview o ON o.product_id = p.id
      WHERE ${where.join(" AND ")}
      ORDER BY ${order}
      LIMIT ${q.p(f.limit, "int")} OFFSET ${q.p(f.offset ?? 0, "int")}`,
  );
  return {
    ranked: rows.map((r): Ranked => ({ id: Number(r.id), score: Number(r.score), exact: Boolean(r.exact) })),
    total: Number(rows[0]?.total ?? 0),
  };
}

// ---------------------------------------------------------------------------
//  Customers
// ---------------------------------------------------------------------------

export const CUSTOMER_DEBT_FILTERS = ["con_deuda", "vencida", "al_dia", "sin_deuda"] as const;
export const CUSTOMER_SORTS = ["relevancia", "nombre", "deuda", "atraso", "reciente"] as const;

export type CustomerFilters = {
  q?: string;
  motorcycle?: "con" | "sin";
  motorcycleBrandId?: number;
  debt?: (typeof CUSTOMER_DEBT_FILTERS)[number];
  credit?: boolean;
  sort?: (typeof CUSTOMER_SORTS)[number];
  limit: number;
  offset?: number;
};

export async function searchCustomerIds(db: Db, f: CustomerFilters) {
  const q = new Sql();
  const text = f.q?.trim() ?? "";
  const where: string[] = ["true"];
  let score = "0";
  let exact = "true";
  if (text) {
    const raw = q.p(text, "text");
    const t = `mirm_norm(${q.p(likeSafe(text), "text")})`;
    const plate = `upper(regexp_replace(${raw}, '[^A-Za-z0-9]', '', 'g'))`;
    const digits = q.p(text.replace(/\D/g, ""), "text");
    const conds = [
      `mirm_norm(c.name) LIKE '%' || ${t} || '%'`,
      `(length(${plate}) >= 3 AND d.plates LIKE '%' || ${plate} || '%')`,
      `(length(${digits}) >= 4 AND d.phone_d LIKE '%' || ${digits} || '%')`,
      `(d.nid <> '' AND d.nid = upper(${raw}))`,
    ];
    score = `( CASE WHEN d.nid <> '' AND d.nid = upper(${raw}) THEN 3 ELSE 0 END
             + CASE WHEN length(${plate}) >= 3 AND d.plates LIKE '%' || ${plate} || '%' THEN 2 ELSE 0 END
             + CASE WHEN length(${digits}) >= 4 AND d.phone_d LIKE '%' || ${digits} || '%' THEN 2 ELSE 0 END
             + CASE WHEN mirm_norm(c.name) LIKE ${t} || '%' THEN 1 ELSE 0 END
             + CASE WHEN mirm_norm(c.name) LIKE '%' || ${t} || '%' THEN 0.6 ELSE 0 END
             + word_similarity(${t}, mirm_norm(c.name)) )`;
    exact = `(${conds.join(" OR ")})`;
    where.push(`(${conds.join(" OR ")} OR word_similarity(${t}, mirm_norm(c.name)) >= ${MIN_SIMILARITY})`);
  }
  if (f.motorcycle === "con") where.push("o.motorcycles > 0");
  if (f.motorcycle === "sin") where.push("o.motorcycles = 0");
  if (f.motorcycleBrandId) where.push(`${q.p(f.motorcycleBrandId, "int")} = ANY(o.motorcycle_brand_ids)`);
  if (f.debt === "con_deuda") where.push("o.balance > 0");
  if (f.debt === "vencida") where.push("o.overdue > 0");
  if (f.debt === "al_dia") where.push("o.balance > 0 AND o.overdue = 0");
  if (f.debt === "sin_deuda") where.push("o.balance <= 0");
  if (f.credit) where.push("o.has_credit");

  const order = {
    relevancia: text ? "score DESC, c.id" : "c.name, c.id",
    nombre: "c.name, c.id",
    deuda: "o.balance DESC, c.name",
    atraso: "o.max_days_overdue DESC NULLS LAST, o.overdue DESC, c.name",
    reciente: "o.last_visit_at DESC NULLS LAST, c.name",
  }[f.sort ?? "relevancia"];

  const rows = await q.run<{ id: number; score: number; exact: boolean; total: number }[]>(
    db,
    `WITH d AS (
       SELECT c.id,
              regexp_replace(c.phone, '[^0-9]', '', 'g') AS phone_d,
              upper(coalesce(c.national_id, '')) AS nid,
              coalesce(string_agg(upper(regexp_replace(m.plate, '[^A-Za-z0-9]', '', 'g')), ' '), '') AS plates
         FROM customer c
         LEFT JOIN motorcycle m ON m.customer_id = c.id
        GROUP BY c.id
     )
     SELECT c.id, (${score})::float8 AS score, ${exact} AS exact, count(*) OVER ()::int AS total
       FROM customer c
       JOIN d ON d.id = c.id
       JOIN v_customer_overview o ON o.customer_id = c.id
      WHERE ${where.join(" AND ")}
      ORDER BY ${order}
      LIMIT ${q.p(f.limit, "int")} OFFSET ${q.p(f.offset ?? 0, "int")}`,
  );
  return {
    ranked: rows.map((r): Ranked => ({ id: Number(r.id), score: Number(r.score), exact: Boolean(r.exact) })),
    total: Number(rows[0]?.total ?? 0),
  };
}

/** Keeps the ranking order when the full rows come back from findMany. */
export function inRankOrder<T extends { id: number }>(ranked: Ranked[], rows: T[]) {
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ranked.flatMap((r) => {
    const row = byId.get(r.id);
    return row ? [{ ...row, exact: r.exact, score: r.score }] : [];
  });
}
