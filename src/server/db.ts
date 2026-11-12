import { env } from "~/env";
import { PrismaClient } from "../../generated/prisma";

// Re-exported so the rest of the code imports Prisma types/Decimal from one place.
export { Prisma } from "../../generated/prisma";

const createPrismaClient = () =>
  new PrismaClient({
    log:
      env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

export type DbClient = typeof db;

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;
