import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

// Service orders, status history, additional faults and warranty claims.
export const serviceRouter = createTRPCRouter({
  listOrders: publicProcedure.query(({ ctx }) =>
    ctx.db.serviceOrder.findMany({
      orderBy: { id: "desc" },
      include: {
        motorcycle: { include: { customer: true } },
        mechanic: true,
        statusChanges: { orderBy: { changedAt: "desc" }, take: 1 },
      },
      take: 50, // shortcut: fixed page size, add cursor pagination when lists grow
    }),
  ),
});
