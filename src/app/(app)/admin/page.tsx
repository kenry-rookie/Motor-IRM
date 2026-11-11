"use client";

import Link from "next/link";

import { ADMIN_OPTIONS } from "~/app/(app)/admin/options";
import { PageTitle } from "~/app/_components/ui";
import { api } from "~/trpc/react";

/** CLI-015 — Administración: each subject is its own option. */
export default function AdminHome() {
  const me = api.auth.me.useQuery();
  const perms = me.data?.permissions ?? [];
  const options = ADMIN_OPTIONS.filter((o) => o.perms.some((p) => perms.includes(p)));
  return (
    <>
      <PageTitle title="Administración" subtitle="Elija qué quiere administrar" />
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {options.map((o) => (
          <li key={o.href}>
            <Link
              href={o.href}
              className="block h-full rounded-xl border border-neutral-800 bg-neutral-900 p-4 transition-colors hover:border-neutral-600"
            >
              <p className="font-display text-lg font-semibold text-neutral-50">{o.label}</p>
              <p className="mt-1 text-sm text-neutral-400">{o.hint}</p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
