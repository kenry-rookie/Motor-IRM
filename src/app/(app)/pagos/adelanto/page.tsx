"use client";

import { Suspense, useState } from "react";

import { MechanicSelect, PendingSummary, useMechanic } from "~/app/(app)/pagos/shared";
import { Alert, BackBar, Button, Card, Field, Input, PageTitle } from "~/app/_components/ui";
import { errorMessage } from "~/lib/errors";
import { dec, money } from "~/lib/format";
import { api } from "~/trpc/react";

/** DEC-056 — Dar adelanto: never more than what the mechanic has earned and not received. */
export default function AdvancePage() {
  return (
    <Suspense>
      <Advance />
    </Suspense>
  );
}

function Advance() {
  const utils = api.useUtils();
  const m = useMechanic();
  const pending = api.staff.pending.useQuery({ staffId: m.selected?.id ?? 0 }, { enabled: !!m.selected });
  const [amount, setAmount] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const give = api.staff.giveAdvance.useMutation({
    onSuccess: (a) => {
      setDone(a.amount.toString());
      setAmount("");
      void utils.staff.invalidate();
    },
  });
  const p = pending.data;
  const available = p ? dec(p.net) : dec(0);
  const tooMuch = dec(amount).gt(available);

  return (
    <>
      <BackBar crumbs={[{ label: "Pago a mecánicos", href: m.href("/pagos") }, { label: "Dar adelanto" }]} back={{ href: m.href("/pagos"), label: "Volver a pago a mecánicos" }} />
      <PageTitle title="Dar adelanto" />
      <div className="mb-4">
        <MechanicSelect m={m} />
      </div>
      {m.selected && (
        <div className="grid items-start gap-4 lg:grid-cols-[1fr_380px]">
          <PendingSummary p={p} error={pending.error} />
          <Card title={`Adelanto a ${m.selected.name}`} className="lg:sticky lg:top-20">
            <div className="space-y-4">
              <div className="flex items-end justify-between border-b border-dashed border-neutral-700 pb-3">
                <span className="text-sm text-neutral-400">Puede adelantar hasta</span>
                <span className="font-display text-3xl font-semibold tabular-nums">{money(available)}</span>
              </div>
              <Field label="Monto del adelanto (C$)" error={tooMuch ? "Es más de lo que tiene ganado sin cobrar." : undefined}>
                <Input autoFocus inputMode="decimal" className="h-11 text-base" value={amount} onChange={(e) => { setAmount(e.target.value); setDone(null); }} />
              </Field>
              <Alert>{give.error && errorMessage(give.error)}</Alert>
              {done && <Alert kind="ok">Adelanto de {money(done)} registrado.</Alert>}
              <Button
                className="h-12 w-full text-base"
                disabled={!dec(amount).gt(0) || tooMuch || give.isPending}
                onClick={() => give.mutate({ staffId: m.selected!.id, amount })}
              >
                {give.isPending ? "Guardando…" : "Dar adelanto"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
