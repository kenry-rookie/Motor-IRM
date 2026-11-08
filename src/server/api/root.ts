import { customerRouter } from "~/server/api/routers/customer";
import { inventoryRouter } from "~/server/api/routers/inventory";
import { purchasingRouter } from "~/server/api/routers/purchasing";
import { salesRouter } from "~/server/api/routers/sales";
import { serviceRouter } from "~/server/api/routers/service";
import { staffRouter } from "~/server/api/routers/staff";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * The API, one router per business area. Add new routers here.
 * The client gets every input/output type from `AppRouter` — no hand-written contracts.
 */
export const appRouter = createTRPCRouter({
  customer: customerRouter,
  inventory: inventoryRouter,
  sales: salesRouter,
  service: serviceRouter,
  purchasing: purchasingRouter,
  staff: staffRouter,
});

export type AppRouter = typeof appRouter;

/** Server-side caller, e.g. `createCaller(ctx).inventory.listProducts()`. */
export const createCaller = createCallerFactory(appRouter);
