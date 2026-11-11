import { adminRouter } from "~/server/api/routers/admin";
import { authRouter } from "~/server/api/routers/auth";
import { customerRouter } from "~/server/api/routers/customer";
import { inventoryRouter } from "~/server/api/routers/inventory";
import { purchasingRouter } from "~/server/api/routers/purchasing";
import { reportsRouter } from "~/server/api/routers/reports";
import { searchRouter } from "~/server/api/routers/search";
import { salesRouter } from "~/server/api/routers/sales";
import { serviceRouter } from "~/server/api/routers/service";
import { staffRouter } from "~/server/api/routers/staff";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * The API, one router per business area. Add new routers here.
 * The client gets every input/output type from `AppRouter` — no hand-written contracts.
 */
export const appRouter = createTRPCRouter({
  auth: authRouter,
  admin: adminRouter,
  customer: customerRouter,
  inventory: inventoryRouter,
  sales: salesRouter,
  service: serviceRouter,
  purchasing: purchasingRouter,
  staff: staffRouter,
  reports: reportsRouter,
  search: searchRouter,
});

export type AppRouter = typeof appRouter;

/** Server-side caller, e.g. `createCaller(ctx).inventory.listProducts()`. */
export const createCaller = createCallerFactory(appRouter);
