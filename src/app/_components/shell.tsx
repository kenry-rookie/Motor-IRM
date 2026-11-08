"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode } from "react";

import { api } from "~/trpc/react";

/**
 * CLI-002 — Layout with navigation by area. The menu shows only what the
 * user's role can use (the API checks again on every call).
 */
const AREAS: { href: string; label: string; permission: string }[] = [
  { href: "/", label: "Inicio", permission: "reportes.ver" },
  { href: "/ventas", label: "Punto de venta", permission: "ventas.crear" },
  { href: "/taller", label: "Taller", permission: "taller.ver" },
  { href: "/inventario", label: "Inventario", permission: "inventario.ver" },
  { href: "/clientes", label: "Clientes y abonos", permission: "clientes.ver" },
  { href: "/compras", label: "Compras", permission: "compras.ver" },
  { href: "/personal", label: "Personal", permission: "personal.ver" },
  { href: "/admin", label: "Administración", permission: "catalogos.gestionar" },
];

type Me = { username: string; role: string; staffName: string | null; permissions: string[] };

export function Shell({ me, children }: { me: Me; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = api.auth.logout.useMutation({
    onSuccess: () => {
      router.replace("/login");
      router.refresh();
    },
  });
  const allowed = AREAS.filter((a) => me.permissions.includes(a.permission));
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 md:flex">
      <aside className="border-b border-neutral-800 bg-neutral-950 md:sticky md:top-0 md:h-screen md:w-56 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex items-center justify-between px-4 py-4 md:block">
          <Link href="/" className="text-lg font-bold">
            Motor <span className="text-amber-400">IRM</span>
          </Link>
          <p className="hidden text-xs text-neutral-500 md:mt-1 md:block">
            {me.staffName ?? me.username} · {me.role}
          </p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:pb-0">
          {allowed.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm ${
                isActive(a.href) ? "bg-amber-500/15 text-amber-300" : "text-neutral-300 hover:bg-neutral-900"
              }`}
            >
              {a.label}
            </Link>
          ))}
        </nav>
        <div className="hidden px-4 py-4 md:absolute md:bottom-0 md:block">
          <button onClick={() => logout.mutate()} className="text-sm text-neutral-400 hover:text-neutral-100">
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8">
        {children}
        <button onClick={() => logout.mutate()} className="mt-10 text-sm text-neutral-500 md:hidden">
          Cerrar sesión
        </button>
      </main>
    </div>
  );
}
