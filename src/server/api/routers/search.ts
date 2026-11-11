import { z } from "zod";

import { createTRPCRouter, permissionProcedure } from "~/server/api/trpc";
import { type Prisma } from "~/server/db";
import { QUALITY_TIERS, zId } from "~/server/domain/constants";
import {
  CUSTOMER_DEBT_FILTERS,
  CUSTOMER_SORTS,
  customerInclude,
  inRankOrder,
  PRODUCT_SORTS,
  PRODUCT_STOCK_FILTERS,
  productInclude,
  searchCustomerIds,
  searchProductIds,
} from "~/server/domain/search";
import { Sql, intList } from "~/server/domain/sql";

/**
 * API-021 v3 — the ONE search service (DEC-043) with filters done by the
 * database (DEC-049). Every screen that searches or filters products or
 * customers calls this router: the counter, purchases, Inventario, Clientes.
 *
 * Without text it is a filtered list (`offset` pages it); with text the results
 * are ranked and tolerant to typos. `suggestionsOnly` = nothing contains the
 * text, so the screen can say "¿Quiso decir…?".
 */
const zPage = { limit: z.number().int().min(1).max(100).default(20), offset: z.number().int().min(0).default(0) };
const zText = z.string().trim().max(100).optional();

type Dec = Prisma.Decimal;

export const searchRouter = createTRPCRouter({
  products: permissionProcedure("inventario.ver")
    .input(
      z.object({
        q: zText,
        categoryId: zId.optional(),
        brandId: zId.optional(),
        qualityTier: z.enum(QUALITY_TIERS).optional(),
        stock: z.enum(PRODUCT_STOCK_FILTERS).optional(),
        supplierId: zId.optional(),
        inactive: z.boolean().optional(),
        sort: z.enum(PRODUCT_SORTS).default("relevancia"),
        ...zPage,
      }),
    )
    .query(async ({ ctx, input }) => {
      const { ranked, total } = await searchProductIds(ctx.db, input);
      const ids = ranked.map((r) => r.id);
      const rows = await ctx.db.product.findMany({ where: { id: { in: ids } }, include: productInclude });
      const extra = new Map(
        (
          await new Sql().run<{ product_id: number; last_cost: Dec | null; margin_pct: Dec | null; sold_90d: number }[]>(
            ctx.db,
            `SELECT product_id, last_cost, margin_pct, sold_90d FROM v_product_overview WHERE product_id IN (${intList(ids)})`,
          )
        ).map((r) => [r.product_id, r]),
      );
      const items = inRankOrder(ranked, rows).map((p) => {
        const e = extra.get(p.id);
        return { ...p, lastCost: e?.last_cost ?? null, marginPct: e?.margin_pct ?? null, sold90d: Number(e?.sold_90d ?? 0) };
      });
      const suggestionsOnly = !!input.q && items.length > 0 && !items.some((i) => i.exact);
      const nextOffset = input.offset + items.length < total ? input.offset + items.length : null;
      return { items, total, nextOffset, suggestionsOnly, didYouMean: suggestionsOnly ? items[0]!.name : null };
    }),

  customers: permissionProcedure("clientes.ver")
    .input(
      z.object({
        q: zText,
        motorcycle: z.enum(["con", "sin"]).optional(),
        motorcycleBrandId: zId.optional(),
        debt: z.enum(CUSTOMER_DEBT_FILTERS).optional(),
        credit: z.boolean().optional(),
        sort: z.enum(CUSTOMER_SORTS).default("relevancia"),
        ...zPage,
      }),
    )
    .query(async ({ ctx, input }) => {
      const { ranked, total } = await searchCustomerIds(ctx.db, input);
      const ids = ranked.map((r) => r.id);
      const rows = await ctx.db.customer.findMany({ where: { id: { in: ids } }, include: customerInclude });
      const extra = new Map(
        (
          await new Sql().run<
            {
              customer_id: number;
              balance: Dec;
              overdue: Dec;
              max_days_overdue: number | null;
              has_credit: boolean;
              last_visit_at: Date | null;
            }[]
          >(
            ctx.db,
            `SELECT customer_id, balance, overdue, max_days_overdue, has_credit, last_visit_at
               FROM v_customer_overview WHERE customer_id IN (${intList(ids)})`,
          )
        ).map((r) => [r.customer_id, r]),
      );
      const items = inRankOrder(ranked, rows).map((c) => {
        const e = extra.get(c.id);
        return {
          ...c,
          balance: e?.balance ?? null,
          overdue: e?.overdue ?? null,
          maxDaysOverdue: e?.max_days_overdue ?? null,
          hasCredit: !!e?.has_credit,
          lastVisitAt: e?.last_visit_at ?? null,
        };
      });
      const suggestionsOnly = !!input.q && items.length > 0 && !items.some((i) => i.exact);
      const nextOffset = input.offset + items.length < total ? input.offset + items.length : null;
      return { items, total, nextOffset, suggestionsOnly, didYouMean: suggestionsOnly ? items[0]!.name : null };
    }),
});
