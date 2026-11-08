import { redirect } from "next/navigation";
import { type ReactNode } from "react";

import { Shell } from "~/app/_components/shell";
import { api } from "~/trpc/server";

/** CLI-001 — every page inside (app) needs a session; without one, go to /login. */
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const me = await api.auth.me();
  if (!me) redirect("/login");
  return <Shell me={me}>{children}</Shell>;
}
