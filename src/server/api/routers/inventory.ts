import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

// Products, price history and the inventory movement ledger.
export const inventoryRouter = createTRPCRouter({
  listProducts: publicProcedure.query(({ ctx }) =>
    ctx.db.product.findMany({
      orderBy: { name: "asc" },
      include: { category: true, brand: true },
      take: 50, // shortcut: fixed page size, add cursor pagination when lists grow
    }),
  ),
});
