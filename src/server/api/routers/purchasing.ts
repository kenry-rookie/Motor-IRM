import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

// Suppliers, purchase invoices, supplier returns and supplier payments.
export const purchasingRouter = createTRPCRouter({
  listInvoices: publicProcedure.query(({ ctx }) =>
    ctx.db.purchaseInvoice.findMany({
      orderBy: { purchaseDate: "desc" },
      include: { supplier: true },
      take: 50, // shortcut: fixed page size, add cursor pagination when lists grow
    }),
  ),
});
