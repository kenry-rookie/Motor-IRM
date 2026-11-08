import { TRPCClientError } from "@trpc/client";

import { type AppRouter } from "~/server/api/root";

/**
 * CLI-005 — Readable message for any API error. Zod validation errors come per
 * field (`fieldErrors`) so forms can show them next to the input.
 */
export function errorMessage(err: unknown): string {
  if (err instanceof TRPCClientError) {
    const e = err as TRPCClientError<AppRouter>;
    const zod = e.data?.zodError;
    if (zod) {
      const fields = Object.entries(zod.fieldErrors)
        .map(([k, v]) => `${k}: ${(v ?? []).join(", ")}`)
        .join(" · ");
      return [zod.formErrors.join(" "), fields].filter(Boolean).join(" ") || e.message;
    }
    return e.message;
  }
  return err instanceof Error ? err.message : "Ocurrió un error inesperado.";
}

export function fieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof TRPCClientError)) return {};
  const zod = (err as TRPCClientError<AppRouter>).data?.zodError;
  if (!zod) return {};
  return Object.fromEntries(Object.entries(zod.fieldErrors).map(([k, v]) => [k, (v ?? []).join(", ")]));
}
