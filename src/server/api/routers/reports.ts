import { z } from "zod";

import { createTRPCRouter, permissionProcedure } from "~/server/api/trpc";
import { invoiceBalance, invoiceBalanceInclude } from "~/server/domain/billing";
import { dayToDate, FINAL_SERVICE_STATUSES, type ServiceOrderStatus, todayInManagua, zDay } from "~/server/domain/constants";
import { D, sum, toNio } from "~/server/domain/money";

/**
 * API-023 — what the owners check every day. The exact content of the cash
 * close depends on Q-004 / Q-007; this version: money received by method,
 * minus withdrawals and advances given that day.
 */
export const reportsRouter = createTRPCRouter({
  daySummary: permissionProcedure("reportes.ver")
    .input(z.object({ day: zDay.optional(), lowStockThreshold: z.number().int().min(0).default(2) }).default({}))
    .query(async ({ ctx, input }) => {
      const day = input.day ?? todayInManagua();
      const start = new Date(`${day}T00:00:00-06:00`);
      const end = new Date(start.getTime() + 86_400_000);

      const invoices = await ctx.db.saleInvoice.findMany({
        where: { createdAt: { gte: start, lt: end } },
        include: invoiceBalanceInclude,
      });
      const salesTotal = sum(invoices.map((i) => invoiceBalance(i).total));
      const creditTotal = sum(invoices.filter((i) => i.paymentTerms === "CREDITO").map((i) => invoiceBalance(i).total));

      const payments = await ctx.db.customerPayment.findMany({
        where: { paidAt: { gte: start, lt: end } },
        include: { paymentMethod: true },
      });
      const byMethod = new Map<string, ReturnType<typeof D>>();
      for (const p of payments) {
        const key = p.paymentMethod.name;
        byMethod.set(key, (byMethod.get(key) ?? D(0)).plus(toNio(p.amount, p.currency, p.exchangeRate)));
      }
      const received = sum([...byMethod.values()]);

      const withdrawals = sum(
        (await ctx.db.cashWithdrawal.findMany({ where: { withdrawnOn: dayToDate(day) } })).map((w) => w.amount),
      );
      const advances = sum(
        (await ctx.db.staffAdvance.findMany({ where: { givenOn: dayToDate(day) } })).map((a) => a.amount),
      );

      const orders = await ctx.db.serviceOrder.findMany({
        include: { statusChanges: { orderBy: [{ changedAt: "desc" }, { id: "desc" }], take: 1 } },
        take: 1000,
        orderBy: { id: "desc" },
      });
      const openOrders = orders.filter(
        (o) => !FINAL_SERVICE_STATUSES.includes((o.statusChanges[0]?.status ?? "RECIBIDA") as ServiceOrderStatus),
      ).length;

      const lowStock = await ctx.db.product.findMany({
        where: { stock: { lte: input.lowStockThreshold } },
        orderBy: { stock: "asc" },
        select: { id: true, name: true, stock: true, barcode: true },
        take: 50,
      });

      return {
        day,
        sales: { count: invoices.length, total: salesTotal, credit: creditTotal },
        received: { total: received, byMethod: [...byMethod.entries()].map(([method, amount]) => ({ method, amount })) },
        withdrawals,
        advances,
        cashBalance: received.minus(withdrawals).minus(advances),
        openOrders,
        lowStock,
      };
    }),
});
