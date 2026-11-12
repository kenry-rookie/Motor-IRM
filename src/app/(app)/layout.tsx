import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { type ReactNode } from "react";

import { Shell } from "~/app/_components/shell";
import { api } from "~/trpc/server";

/** CLI-001 — every page inside (app) needs a session; without one, go to /login. */
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const me = await api.auth.me();
  if (!me) redirect("/login");

  // El menú lateral recuerda si estaba contraído (cookie `irm_nav=0`).
  // Se lee aquí, en el servidor, para que la página cargue ya con el ancho correcto.
  const jar = await cookies();
  const expanded = jar.get("irm_nav")?.value !== "0";

  return (
    <Shell me={me} defaultExpanded={expanded}>
      {children}
    </Shell>
  );
}
