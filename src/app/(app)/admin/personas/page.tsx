"use client";

import { useState } from "react";

import { Alert, Badge, Button, Card, Dialog, Field, Input, PageTitle, PhoneInput, Select, Table } from "~/app/_components/ui";
import { errorMessage } from "~/lib/errors";
import { LABELS, STAFF_KINDS, type StaffKind } from "~/server/domain/constants";
import { api, type RouterOutputs } from "~/trpc/react";

export default function PeoplePage() {
  const me = api.auth.me.useQuery();
  return (
    <>
      <PageTitle title="Personas del negocio" subtitle="Dueños, mecánicos y encargado. Nadie se borra: se desactiva." />
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
    <Card title="Personas" actions={canEdit && <Button onClick={() => setEditing("new")}>+ Agregar persona</Button>}>
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
        <PhoneInput value={f.phone} onValue={(v) => setF({ ...f, phone: v })} />
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
        hint={isOwner ? "Un dueño no cobra comisión." : "Vacío o 100 = no se le paga por el sistema (como el mecánico al 100 %, igual que un dueño)."}
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
            commissionRate: !isOwner && f.percent && Number(f.percent) < 100 ? (Number(f.percent) / 100).toFixed(4) : null,
            active: f.active,
          })
        }
      >
        Guardar
      </Button>
    </div>
  );
}

