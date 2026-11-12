import { redirect } from "next/navigation";
import { type ReactNode } from "react";

import { api } from "~/trpc/server";

/**
 * Printable documents (DEC-053): factura and comprobante de abono. They live
 * outside the app shell (no side menu) and are always black on white, also when
 * the app uses the dark theme. They still need a session.
 */
export const dynamic = "force-dynamic";

export default async function PrintLayout({ children }: { children: ReactNode }) {
  const me = await api.auth.me();
  if (!me) redirect("/login");
  return <div className="print-page min-h-screen bg-[#e9ebee] py-6 text-[#111] print:bg-white print:py-0">{children}</div>;
}
