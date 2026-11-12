"use client";

import { useState } from "react";

import { type ServiceType } from "~/app/_components/service-catalog";
import { Alert, Badge, Button, Card, Dialog, Field, Input, PageTitle, SearchField, Select, Table } from "~/app/_components/ui";
import { errorMessage, fieldErrors } from "~/lib/errors";
import { money } from "~/lib/format";
import { api } from "~/trpc/react";

/**
 * The workshop catalog (DEC-048): what can be chosen at reception and charged
 * as labor. Each job has a category, a reference price and, if wanted, a range:
 * charging outside it asks for an owner's key. Jobs are deactivated, never deleted.
 */
export default function JobsPage() {
  const types = api.admin.serviceTypes.useQuery();
  const categories = api.admin.serviceCategories.useQuery();
  const [text, setText] = useState("");
  const [category, setCategory] = useState(0);
  const [editing, setEditing] = useState<ServiceType | "new" | null>(null);
  const [catDialog, setCatDialog] = useState(false);
  const q = text.trim().toLowerCase();
  const rows = (types.data ?? []).filter(
    (t) => (!category || t.serviceCategoryId === category) && (!q || `${t.name} ${t.category.name}`.toLowerCase().includes(q)),
  );

  return (
    <>
      <PageTitle
        title="Trabajos del taller"
        subtitle="Lo que se elige al recibir una moto y se cobra como mano de obra"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setCatDialog(true)}>
              Categorías
            </Button>
            <Button onClick={() => setEditing("new")}>+ Nuevo trabajo</Button>
          </div>
        }
      />
      <Card>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <SearchField className="min-w-72 flex-1" label="Buscar trabajo" placeholder="Buscar trabajo…" value={text} onValue={setText} />
          <Select className="h-11 w-56" value={category} onChange={(e) => setCategory(Number(e.target.value))}>
            <option value={0}>Todas las categorías</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <Table head={["Trabajo", "Categoría", "Precio de referencia", "Rango permitido", "Veces pedido", "Estado", ""]} empty={!types.isLoading && rows.length === 0}>
          {rows.map((t) => (
            <tr key={t.id}>
              <td className="font-medium">{t.name}</td>
              <td>{t.category.name}</td>
              <td className="tabular-nums">{t.referencePrice ? money(t.referencePrice) : "—"}</td>
              <td className="tabular-nums text-neutral-400">
                {t.minPrice || t.maxPrice ? `${t.minPrice ? money(t.minPrice) : "—"} a ${t.maxPrice ? money(t.maxPrice) : "—"}` : "Sin límite"}
              </td>
              <td className="tabular-nums">{t.timesOrdered}</td>
              <td>{t.active ? <Badge tone="green">Activo</Badge> : <Badge tone="red">Inactivo</Badge>}</td>
              <td className="text-right">
                <Button variant="ghost" onClick={() => setEditing(t)}>
                  Editar
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Nuevo trabajo" : "Editar trabajo"}>
        {editing !== null && <JobForm job={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
      </Dialog>
      <Dialog open={catDialog} onClose={() => setCatDialog(false)} title="Categorías de trabajos">
        <Categories />
      </Dialog>
    </>
  );
}

function JobForm({ job, onDone }: { job: ServiceType | null; onDone: () => void }) {
  const utils = api.useUtils();
  const categories = api.admin.serviceCategories.useQuery();
  const s = (v: { toString(): string } | null | undefined) => v?.toString() ?? "";
  const [f, setF] = useState({
    name: job?.name ?? "",
    serviceCategoryId: job?.serviceCategoryId ?? 0,
    referencePrice: s(job?.referencePrice),
    minPrice: s(job?.minPrice),
    maxPrice: s(job?.maxPrice),
    active: job?.active ?? true,
  });
  const save = api.admin.saveServiceType.useMutation({
    onSuccess: () => {
      void utils.admin.serviceTypes.invalidate();
      onDone();
    },
  });
  const errs = fieldErrors(save.error);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Nombre" error={errs.name}>
        <Input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </Field>
      <Field label="Categoría" error={errs.serviceCategoryId}>
        <Select value={f.serviceCategoryId} onChange={(e) => setF({ ...f, serviceCategoryId: Number(e.target.value) })}>
          <option value={0}>Elegir…</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Precio de referencia (C$)" error={errs.referencePrice} hint="Se propone al cobrar; se puede cambiar">
        <Input inputMode="decimal" value={f.referencePrice} onChange={(e) => setF({ ...f, referencePrice: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Mínimo (C$)" error={errs.minPrice}>
          <Input inputMode="decimal" value={f.minPrice} onChange={(e) => setF({ ...f, minPrice: e.target.value })} />
        </Field>
        <Field label="Máximo (C$)" error={errs.maxPrice}>
          <Input inputMode="decimal" value={f.maxPrice} onChange={(e) => setF({ ...f, maxPrice: e.target.value })} />
        </Field>
      </div>
      <label className="flex min-h-10 items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" className="h-5 w-5" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Activo (aparece
        en la lista al recibir motos)
      </label>
      <p className="text-xs text-neutral-500 sm:col-span-2">Vacíos el mínimo y el máximo = sin límite. Cobrar fuera del rango pide la clave de un dueño.</p>
      <div className="sm:col-span-2">{save.error && <Alert>{errorMessage(save.error)}</Alert>}</div>
      <Button
        className="sm:col-span-2"
        disabled={!f.name.trim() || !f.serviceCategoryId || save.isPending}
        onClick={() =>
          save.mutate({
            id: job?.id,
            name: f.name,
            serviceCategoryId: f.serviceCategoryId,
            referencePrice: f.referencePrice || null,
            minPrice: f.minPrice || null,
            maxPrice: f.maxPrice || null,
            active: f.active,
          })
        }
      >
        Guardar
      </Button>
    </div>
  );
}

function Categories() {
  const utils = api.useUtils();
  const categories = api.admin.serviceCategories.useQuery();
  const [name, setName] = useState("");
  const save = api.admin.saveServiceCategory.useMutation({
    onSuccess: () => {
      setName("");
      void utils.admin.serviceCategories.invalidate();
      void utils.admin.serviceTypes.invalidate();
    },
  });
  return (
    <div className="space-y-3">
      <ul className="grid gap-1 sm:grid-cols-2">
        {categories.data?.map((c) => (
          <li key={c.id} className="rounded-md border border-neutral-800 px-3 py-2 text-sm">
            {c.name}
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Input placeholder="Nueva categoría" value={name} onChange={(e) => setName(e.target.value)} />
        <Button disabled={!name.trim() || save.isPending} onClick={() => save.mutate({ name, sortOrder: 150 })}>
          Agregar
        </Button>
      </div>
      {save.error && <Alert>{errorMessage(save.error)}</Alert>}
    </div>
  );
}
