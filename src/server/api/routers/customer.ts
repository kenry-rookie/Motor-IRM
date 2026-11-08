import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

// Customers, their motorcycles and opening balances.
export const customerRouter = createTRPCRouter({
  list: publicProcedure.query(({ ctx }) =>
    ctx.db.customer.findMany({
      orderBy: { name: "asc" },
      include: {
        motorcycles: { include: { model: { include: { brand: true } } } },
      },
      take: 50, // shortcut: fixed page size, add cursor pagination when lists grow
    }),
  ),
});
