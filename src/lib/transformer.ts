import Decimal from "decimal.js";
import SuperJSON from "superjson";

// Prisma returns NUMERIC columns (all money) as Decimal. Without this, SuperJSON can't
// round-trip them and the client would not receive the Decimal the types promise.
SuperJSON.registerCustom<Decimal, string>(
  {
    isApplicable: (v): v is Decimal => Decimal.isDecimal(v),
    serialize: (v) => v.toJSON(),
    deserialize: (v) => new Decimal(v),
  },
  "decimal.js",
);

/** The one tRPC transformer, shared by server and client. */
export const transformer = SuperJSON;
