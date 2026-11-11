"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";

import { ADMIN_OPTIONS } from "~/app/(app)/admin/options";
import { cx } from "~/app/_components/ui";
import { api } from "~/trpc/react";

/** Administración: a menu of options on the left, the chosen option on the right. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const me = api.auth.me.useQuery();
  const perms = me.data?.permissions ?? [];
  const options = ADMIN_OPTIONS.filter((o) => o.perms.some((p) => perms.includes(p)));
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[240px_1fr]">
      <nav aria-label="Opciones de administración" className="rounded-xl border border-neutral-800 bg-neutral-900 p-2 lg:sticky lg:top-4">
        <Link
          href="/admin"
          className={cx(
            "block rounded-md px-3 py-2.5 text-sm font-semibold",
            pathname === "/admin" ? "bg-brand-600/8 text-brand-600" : "text-neutral-100 hover:bg-neutral-800",
          )}
        >
          Administración
        </Link>
        <ul className="mt-1 space-y-0.5">
          {options.map((o) => (
            <li key={o.href}>
              <Link
                href={o.href}
                aria-current={pathname.startsWith(o.href) ? "page" : undefined}
                className={cx(
                  "block min-h-10 rounded-md px-3 py-2.5 text-sm",
                  pathname.startsWith(o.href) ? "bg-brand-600/8 font-medium text-brand-600" : "text-neutral-300 hover:bg-neutral-800",
                )}
              >
                {o.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
