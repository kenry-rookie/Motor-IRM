"use client";

import Link from "next/link";
import { Suspense } from "react";

import { MechanicSelect, PendingSummary, useMechanic } from "~/app/(app)/pagos/shared";
import { PageTitle, Stat } from "~/app/_components/ui";
import { money } from "~/lib/format";
import { api } from "~/trpc/react";

/** CLI-013 — Pago a mecánicos: what each one has earned and not been paid (DEC-056). */
export default function PayPage() {
  return (
    <Suspense>
      <Summary />
    </Suspense>
  );
}

function Summary() {
  const me = api.auth.me.useQuery();
  const m = useMechanic();
  const pending = api.staff.pending.useQuery({ staffId: m.selected?.id ?? 0 }, { enabled: !!m.selected });
  const canPay = me.data?.permissions.includes("personal.pagos");
  const p = pending.data;
  return (
    <>
      <PageTitle title="Pago a mecánicos" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <MechanicSelect m={m} />
        {canPay && m.selected && (
          <div className="flex flex-wrap gap-2">
            <Link
              href={m.href("/pagos/adelanto")}
              className="inline-flex h-11 items-center rounded-md border border-neutral-700 bg-neutral-900 px-5 text-sm font-medium hover:bg-neutral-800"
            >
              Dar adelanto
            </Link>
            <Link
              href={m.href("/pagos/periodo")}
              className="bg-brand-600 hover:bg-brand-700 inline-flex h-11 items-center rounded-md px-5 text-sm font-medium text-white"
            >
              Pagar periodo trabajado
            </Link>
          </div>
        )}
      </div>
      {m.selected && (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <Stat label="Comisiones ganadas" value={p ? money(p.commission) : "—"} />
            <Stat label="Adelantos dados" value={p ? money(p.advanced) : "—"} />
            <Stat label="A pagar" value={p ? money(p.net) : "—"} />
          </div>
          <PendingSummary p={p} error={pending.error} />
        </>
      )}
    </>
  );
}
