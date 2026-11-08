import Decimal from "decimal.js";

/**
 * CLI-004 — Money and dates for display.
 * Amounts arrive as Decimal (exact). Arithmetic in the client uses Decimal too;
 * converting to Number happens ONLY here, at the last step, to print.
 */
const nio = new Intl.NumberFormat("es-NI", { style: "currency", currency: "NIO", minimumFractionDigits: 2 });
const usd = new Intl.NumberFormat("es-NI", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

type Amount = Decimal | string | number | { toString(): string } | null | undefined;

export const dec = (v: Amount) => new Decimal(v?.toString() ?? 0);

export function money(v: Amount, currency: "NIO" | "USD" = "NIO") {
  const n = Number(dec(v).toFixed(2));
  return (currency === "USD" ? usd : nio).format(n);
}

const dateTime = new Intl.DateTimeFormat("es-NI", {
  timeZone: "America/Managua",
  dateStyle: "medium",
  timeStyle: "short",
});
/** An instant (TIMESTAMPTZ) shown in Managua time. */
export const formatDateTime = (d: Date | string | null | undefined) => (d ? dateTime.format(new Date(d)) : "—");

const dayFmt = new Intl.DateTimeFormat("es-NI", { timeZone: "UTC", dateStyle: "medium" });
/** A calendar day (DATE column, stored as UTC midnight): never shift it. */
export const formatDay = (d: Date | string | null | undefined) => (d ? dayFmt.format(new Date(d)) : "—");

export const todayISO = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Managua" }).format(new Date());
export const addDaysISO = (day: string, n: number) =>
  new Date(new Date(`${day}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
