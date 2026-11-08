import { Prisma } from "~/server/db";

/** Exact decimal arithmetic for money. Never use JS numbers for amounts. */
export type Dec = Prisma.Decimal;
export const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
export const ZERO = D(0);
export const sum = (values: Prisma.Decimal.Value[]) => values.reduce<Dec>((acc, v) => acc.plus(v), ZERO);
export const round2 = (v: Prisma.Decimal.Value) => D(v).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
/** USD amounts are converted to córdobas with the payment's exchange rate. */
export const toNio = (amount: Prisma.Decimal.Value, currency: string, rate?: Prisma.Decimal.Value | null) =>
  currency === "USD" ? round2(D(amount).times(rate ?? 0)) : D(amount);
