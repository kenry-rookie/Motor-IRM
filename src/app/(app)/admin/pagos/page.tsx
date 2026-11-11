"use client";

import { useState } from "react";

import { responsibleLabel } from "~/app/_components/pickers";
import { Alert, Button, Card, Field, Input, PageTitle, Select, Table } from "~/app/_components/ui";
import { errorMessage } from "~/lib/errors";
import { formatDay, money, todayISO } from "~/lib/format";
import { api } from "~/trpc/react";

/**
 * CLI-013 — Mechanics' pay: what each one earned (commission = labor × rate),
 * minus advances, for the period worked (DEC-030). Owners and the "100 %"
 * mechanic are not paid here (DEC-041).
 */
export default function PayPage() {
  const me = api.auth.me.useQuery();
  const utils = api.useUtils();
  const staff = api.staff.list.useQuery();
  // Only people who earn commission are paid here; owners and the "100 %" mechanic are not (DEC-041).
  const mechanics = staff.data?.filter((s) => s.kind === "MECANICO" && s.commissionRate) ?? [];
  const [staffId, setStaffId] = useState(0);
  const selected = staffId !== 0 ? staffId : (mechanics[0]?.id ?? 0);
  const pending = api.staff.pending.useQuery({ staffId: selected }, { enabled: !!selected });
  const [advance, setAdvance] = useState("");
  const [period, setPeriod] = useState({ start: todayISO(), end: todayISO() });
  const refresh = () => void utils.staff.invalidate();
  const give = api.staff.giveAdvance.useMutation({ onSuccess: () => { setAdvance(""); refresh(); } });
  const payout = api.staff.createPayout.useMutation({ onSuccess: refresh });
  const canPay = me.data?.permissions.includes("personal.pagos");
  const p = pending.data;

  return (
    <>
      <PageTitle title="Pago a mecánicos" subtitle="Comisión = mano de obra cobrada × porcentaje del mecánico" />
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card
          title={
            <Select value={selected} onChange={(e) => setStaffId(Number(e.target.value))}>
              {mechanics.map((m) => (
                <option key={m.id} value={m.id}>
                  {responsibleLabel(m)}
                </option>
              ))}
            </Select>
          }
        >
          {mechanics.length === 0 && (
            <p className="text-sm text-neutral-500">
              No hay mecánicos con comisión. Regístrelos en Administración › Personas del negocio.
            </p>
          )}
          {pending.error && <Alert>{errorMessage(pending.error)}</Alert>}
          {p && (
            <>
              <Table head={["Orden", "Cliente", "Entregada", "Mano de obra", "Comisión"]} empty={p.orders.length === 0}>
                {p.orders.map((o) => (
                  <tr key={o.serviceOrderId}>
                    <td>
                      <a className="hover:text-brand-600" href={`/taller/${o.serviceOrderId}`}>
                        #{o.serviceOrderId}
                      </a>
                    </td>
                    <td>{o.customer}</td>
                    <td>{o.deliveredAt ? new Date(o.deliveredAt).toLocaleDateString("es-NI") : "—"}</td>
                    <td>{money(o.labor)}</td>
                    <td>{money(o.commission)}</td>
                  </tr>
                ))}
              </Table>
              <h3 className="mt-4 mb-2 text-sm font-semibold">Adelantos sin descontar</h3>
              <ul className="text-sm text-neutral-300">
                {p.advances.map((a) => (
                  <li key={a.id}>
                    {formatDay(a.givenOn)} · {money(a.amount)}
                  </li>
                ))}
                {p.advances.length === 0 && <li className="text-neutral-500">Ninguno</li>}
              </ul>
              <dl className="mt-4 grid max-w-xs grid-cols-2 gap-1 text-sm">
                <dt className="text-neutral-400">Comisiones</dt>
                <dd className="text-right">{money(p.commission)}</dd>
                <dt className="text-neutral-400">Adelantos</dt>
                <dd className="text-right">− {money(p.advanced)}</dd>
                <dt className="font-semibold">A pagar</dt>
                <dd className="text-right font-semibold">{money(p.net)}</dd>
              </dl>
            </>
          )}
        </Card>
        {canPay && (
          <div className="space-y-4">
            <Card title="Dar adelanto">
              <p className="mb-2 text-xs text-neutral-400">No puede pasar de lo ganado sin cobrar (BR-103).</p>
              <div className="flex gap-2">
                <Input inputMode="decimal" placeholder="C$" value={advance} onChange={(e) => setAdvance(e.target.value)} />
                <Button disabled={!advance || give.isPending} onClick={() => give.mutate({ staffId: selected, amount: advance })}>
                  Dar
                </Button>
              </div>
              <div className="mt-2">
                <Alert>{give.error && errorMessage(give.error)}</Alert>
              </div>
            </Card>
            <Card title="Pagar periodo trabajado">
              <p className="mb-2 text-xs text-neutral-400">Incluye órdenes entregadas hasta el fin del periodo que no se hayan pagado antes (DEC-030, BR-104).</p>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Desde">
                  <Input type="date" value={period.start} onChange={(e) => setPeriod({ ...period, start: e.target.value })} />
                </Field>
                <Field label="Hasta">
                  <Input type="date" value={period.end} onChange={(e) => setPeriod({ ...period, end: e.target.value })} />
                </Field>
              </div>
              <Button className="mt-3 w-full" disabled={payout.isPending} onClick={() => payout.mutate({ staffId: selected, periodStart: period.start, periodEnd: period.end })}>
                Registrar pago
              </Button>
              <div className="mt-2">
                <Alert>{payout.error && errorMessage(payout.error)}</Alert>
                {payout.data && <Alert kind="ok">Pago registrado: {money(payout.data.net)}</Alert>}
              </div>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}

