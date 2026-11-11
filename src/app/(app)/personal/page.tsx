"use client";

import { useState } from "react";

import { responsibleLabel } from "~/app/_components/pickers";
import { Alert, Badge, Button, Card, Dialog, Field, Input, PageTitle, Select, Table } from "~/app/_components/ui";
import { errorMessage } from "~/lib/errors";
import { formatDay, money, todayISO } from "~/lib/format";
import { LABELS, STAFF_KINDS, type StaffKind } from "~/server/domain/constants";
import { api, type RouterOutputs } from "~/trpc/react";

/** CLI-013 — Mechanics' pay (commissions − advances), advances and cash withdrawals. */
export default function StaffPage() {
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
      <PageTitle title="Personal" subtitle="Comisión = mano de obra cobrada × porcentaje del mecánico" />
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
            <CashWithdrawal />
          </div>
        )}
      </div>
      <People canEdit={!!me.data?.permissions.includes("admin.usuarios")} />
    </>
  );
}

type Person = RouterOutputs["staff"]["list"][number];

/** Who works at the shop: owners, mechanics, manager (DEC-041). Nobody is deleted, only deactivated. */
function People({ canEdit }: { canEdit: boolean }) {
  const staff = api.staff.list.useQuery({ includeInactive: true });
  const [editing, setEditing] = useState<Person | "new" | null>(null);
  return (
    <Card
      title="Personas del negocio"
      actions={canEdit && <Button onClick={() => setEditing("new")}>+ Agregar persona</Button>}
    >
      <p className="mb-3 text-sm text-neutral-400">
        El responsable de una moto puede ser un mecánico o un dueño. Un dueño nunca cobra comisión.
      </p>
      <Table head={["Nombre", "Tipo", "Repara motos", "Comisión", "Estado", ""]} empty={staff.data?.length === 0}>
        {staff.data?.map((p) => (
          <tr key={p.id}>
            <td>
              {p.name}
              <div className="text-xs text-neutral-500">{p.phone}</div>
            </td>
            <td>{LABELS.staffKind[p.kind as StaffKind] ?? p.kind}</td>
            <td>{p.canRepair ? "Sí" : "No"}</td>
            <td>{p.commissionRate ? `${Math.round(Number(p.commissionRate.toString()) * 100)} % de mano de obra` : "Sin comisión"}</td>
            <td>{p.active ? <Badge tone="green">Activo</Badge> : <Badge tone="red">Inactivo</Badge>}</td>
            <td>
              {canEdit && (
                <Button variant="ghost" onClick={() => setEditing(p)}>
                  Editar
                </Button>
              )}
            </td>
          </tr>
        ))}
      </Table>
      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Agregar persona" : "Editar persona"}>
        {editing !== null && <PersonForm person={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
      </Dialog>
    </Card>
  );
}

function PersonForm({ person, onDone }: { person: Person | null; onDone: () => void }) {
  const utils = api.useUtils();
  const [f, setF] = useState({
    name: person?.name ?? "",
    phone: person?.phone ?? "",
    kind: (person?.kind ?? "MECANICO") as StaffKind,
    canRepair: person?.canRepair ?? true,
    percent: person?.commissionRate ? String(Math.round(Number(person.commissionRate.toString()) * 100)) : "",
    active: person?.active ?? true,
  });
  const save = api.staff.save.useMutation({
    onSuccess: () => {
      void utils.staff.invalidate();
      onDone();
    },
  });
  const isOwner = f.kind === "DUENO";
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Nombre">
        <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </Field>
      <Field label="Teléfono">
        <Input inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
      </Field>
      <Field label="Tipo">
        <Select
          value={f.kind}
          onChange={(e) => {
            const kind = e.target.value as StaffKind;
            setF({ ...f, kind, canRepair: kind !== "ENCARGADO", percent: kind === "DUENO" ? "" : f.percent });
          }}
        >
          {STAFF_KINDS.map((k) => (
            <option key={k} value={k}>
              {LABELS.staffKind[k]}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label="Comisión (% de la mano de obra)"
        hint={isOwner ? "Un dueño no cobra comisión." : "Vacío = no se le paga por el sistema (por ejemplo, el mecánico al 100 %)."}
      >
        <Input
          inputMode="decimal"
          disabled={isOwner}
          placeholder={isOwner ? "—" : "60"}
          value={f.percent}
          onChange={(e) => setF({ ...f, percent: e.target.value.replace(/[^\d.]/g, "") })}
        />
      </Field>
      <label className="flex min-h-10 items-center gap-2 text-sm">
        <input type="checkbox" checked={f.canRepair} onChange={(e) => setF({ ...f, canRepair: e.target.checked })} /> Repara motos
        (puede ser responsable de una orden)
      </label>
      <label className="flex min-h-10 items-center gap-2 text-sm">
        <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Activo
      </label>
      <div className="sm:col-span-2">
        <Alert>{save.error && errorMessage(save.error)}</Alert>
      </div>
      <Button
        className="sm:col-span-2"
        disabled={!f.name.trim() || !f.phone.trim() || save.isPending}
        onClick={() =>
          save.mutate({
            id: person?.id,
            name: f.name,
            phone: f.phone,
            kind: f.kind,
            canRepair: f.canRepair,
            commissionRate: !isOwner && f.percent ? (Number(f.percent) / 100).toFixed(4) : null,
            active: f.active,
          })
        }
      >
        Guardar
      </Button>
    </div>
  );
}

function CashWithdrawal() {
  const utils = api.useUtils();
  const reasons = api.admin.catalog.useQuery({ kind: "cashWithdrawalReason" });
  const [f, setF] = useState({ reasonId: 0, amount: "", description: "" });
  const w = api.staff.withdrawCash.useMutation({
    onSuccess: () => {
      setF({ reasonId: 0, amount: "", description: "" });
      void utils.reports.invalidate();
    },
  });
  return (
    <Card title="Retiro de caja">
      <div className="space-y-2">
        <Select value={f.reasonId} onChange={(e) => setF({ ...f, reasonId: Number(e.target.value) })}>
          <option value={0}>Motivo…</option>
          {reasons.data
            ?.filter((r) => r.active)
            .map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
        </Select>
        <Input inputMode="decimal" placeholder="Monto C$" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        <Input placeholder="Detalle (opcional)" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <Button
          className="w-full"
          disabled={!f.reasonId || !f.amount || w.isPending}
          onClick={() => w.mutate({ cashWithdrawalReasonId: f.reasonId, amount: f.amount, description: f.description || undefined })}
        >
          Registrar retiro
        </Button>
        <Alert>{w.error && errorMessage(w.error)}</Alert>
        {w.isSuccess && <Alert kind="ok">Retiro registrado.</Alert>}
      </div>
    </Card>
  );
}
