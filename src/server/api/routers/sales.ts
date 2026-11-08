import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

// Sale invoices, customer returns, customer payments and their allocations.
export const salesRouter = createTRPCRouter({
  listInvoices: publicProcedure.query(({ ctx }) =>
    ctx.db.saleInvoice.findMany({
      orderBy: { createdAt: "desc" },
      include: { customer: true, lines: true },
      take: 50, // shortcut: fixed page size, add cursor pagination when lists grow
    }),
  ),
});
