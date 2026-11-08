import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

// Staff, payouts, advances and cash withdrawals.
export const staffRouter = createTRPCRouter({
  list: publicProcedure.query(({ ctx }) =>
    ctx.db.staff.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
  ),
});
