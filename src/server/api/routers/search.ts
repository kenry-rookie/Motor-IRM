import { z } from "zod";

import { createTRPCRouter, permissionProcedure } from "~/server/api/trpc";
import { zId } from "~/server/domain/constants";
import { customerInclude, inRankOrder, productInclude, rankCustomers, rankProducts } from "~/server/domain/search";

/**
 * API-021 v3 — the ONE search service (DEC-043). Every screen that searches
 * products or customers by text calls this router; the paged lists
 * (inventory.listProducts, customer.list) only browse and filter.
 *
 * `suggestionsOnly` is true when nothing contains the text and the list is made
 * of look-alikes, so the screen can say "¿Quiso decir…?".
 */
const zQuery = z.object({
  q: z.string().trim().min(1).max(100),
  limit: z.number().int().min(1).max(50).default(10),
});

export const searchRouter = createTRPCRouter({
  products: permissionProcedure("inventario.ver")
    .input(zQuery.extend({ productCategoryId: zId.optional(), lowStock: z.number().int().min(0).optional() }))
    .query(async ({ ctx, input }) => {
      const ranked = await rankProducts(ctx.db, input.q, input.limit);
      const rows = await ctx.db.product.findMany({
        where: {
          id: { in: ranked.map((r) => r.id) },
          productCategoryId: input.productCategoryId,
          stock: input.lowStock !== undefined ? { lte: input.lowStock } : undefined,
        },
        include: productInclude,
      });
      const items = inRankOrder(ranked, rows);
      const suggestionsOnly = items.length > 0 && !items.some((i) => i.exact);
      return { items, suggestionsOnly, didYouMean: suggestionsOnly ? items[0]!.name : null };
    }),

  customers: permissionProcedure("clientes.ver")
    .input(zQuery)
    .query(async ({ ctx, input }) => {
      const ranked = await rankCustomers(ctx.db, input.q, input.limit);
      const rows = await ctx.db.customer.findMany({ where: { id: { in: ranked.map((r) => r.id) } }, include: customerInclude });
      const items = inRankOrder(ranked, rows);
      const suggestionsOnly = items.length > 0 && !items.some((i) => i.exact);
      return { items, suggestionsOnly, didYouMean: suggestionsOnly ? items[0]!.name : null };
    }),
});
