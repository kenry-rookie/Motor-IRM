"use client";

import { Suspense, useState } from "react";

import { confirmDialog } from "~/app/_components/confirm";
import { MechanicSelect, PendingSummary, useMechanic } from "~/app/(app)/pagos/shared";
import { Alert, BackBar, Button, Card, Field, Input, PageTitle, Table } from "~/app/_components/ui";
import { errorMessage } from "~/lib/errors";
import { addDaysISO, dec, formatDay, money, todayISO } from "~/lib/format";
import { api } from "~/trpc/react";

/**
 * DEC-056 — Pagar periodo trabajado: orders delivered up to the end of the period
 * and not paid before, minus the advances; the pay is recorded in one step.
 */
export default function PeriodPage() {
  return (
    <Suspense>
      <Period />
    </Suspense>
  );
}

function Period() {
  const utils = api.useUtils();
  const m = useMechanic();
  const [period, setPeriod] = useState({ start: addDaysISO(todayISO(), -6), end: todayISO() });
  const staffId = m.selected?.id ?? 0;
  const pending = api.staff.pending.useQuery({ staffId, until: period.end }, { enabled: !!m.selected });
  const history = api.staff.payouts.useQuery({ staffId }, { enabled: !!m.selected });
  const pay = api.staff.createPayout.useMutation({ onSuccess: () => void utils.staff.invalidate() });
  const p = pending.data;
  const nothing = !!p && p.orders.length === 0 && p.advances.length === 0;
  const badRange = period.end < period.start;

  return (
    <>
      <BackBar
        crumbs={[{ label: "Pago a mecánicos", href: m.href("/pagos") }, { label: "Pagar periodo trabajado" }]}
        back={{ href: m.href("/pagos"), label: "Volver a pago a mecánicos" }}
      />
      <PageTitle title="Pagar periodo trabajado" />
      <div className="mb-4">
        <MechanicSelect m={m} />
      </div>
      {m.selected && (
        <div className="grid items-start gap-4 lg:grid-cols-[1fr_380px]">
          <div className="space-y-4">
            <PendingSummary p={p} error={pending.error} title={`Entregadas hasta el ${formatDay(period.end)} y sin pagar`} />
            <Card title="Pagos anteriores">
              <Table head={["Periodo", "Órdenes", "Adelantos", "Pagado", "Por"]} empty={!history.data?.length}>
                {history.data?.map((h) => (
                  <tr key={h.id}>
                    <td>
                      {formatDay(h.periodStart)} – {formatDay(h.periodEnd)}
                    </td>
                    <td>{h.serviceOrders.length}</td>
                    <td className="tabular-nums">{money(h.advances.reduce((a, x) => a.plus(dec(x.amount)), dec(0)))}</td>
                    <td>{h.paidOn ? formatDay(h.paidOn) : "Pendiente"}</td>
                    <td>{h.paidBy?.username ?? "—"}</td>
                  </tr>
                ))}
              </Table>
            </Card>
          </div>
          <Card title={`Pago a ${m.selected.name}`} className="lg:sticky lg:top-20">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Desde">
                  <Input type="date" value={period.start} max={period.end} onChange={(e) => setPeriod({ ...period, start: e.target.value })} />
                </Field>
                <Field label="Hasta">
                  <Input type="date" value={period.end} min={period.start} onChange={(e) => setPeriod({ ...period, end: e.target.value })} />
                </Field>
              </div>
              <div className="flex items-end justify-between border-t border-dashed border-neutral-700 pt-3">
                <span className="text-sm text-neutral-400">A pagar</span>
                <span className="font-display text-3xl font-semibold tabular-nums">{p ? money(p.net) : "—"}</span>
              </div>
              {nothing && <p className="text-sm text-neutral-500">No hay comisiones ni adelantos pendientes en ese periodo.</p>}
              <Alert>{pay.error && errorMessage(pay.error)}</Alert>
              {pay.data && <Alert kind="ok">Pago registrado: {money(pay.data.net)}.</Alert>}
              <Button
                className="h-12 w-full text-base"
                disabled={!p || nothing || badRange || pay.isPending}
                onClick={async () => {
                  if (!p || !(await confirmDialog(`¿Registrar el pago de ${money(p.net)} a ${m.selected!.name}?`, { title: "Registrar pago", confirmLabel: "Sí, registrar" }))) return;
                  pay.mutate({ staffId, periodStart: period.start, periodEnd: period.end });
                }}
              >
                {pay.isPending ? "Guardando…" : "Registrar pago"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
