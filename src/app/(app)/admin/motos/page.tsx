"use client";

import { useState } from "react";

import { MergeDialog } from "~/app/(app)/admin/catalog-table";
import { confirmDialog } from "~/app/_components/confirm";
import { Alert, Badge, Button, Card, Dialog, Field, Input, PageTitle, SearchField, Select } from "~/app/_components/ui";
import { errorMessage } from "~/lib/errors";
import { api, type RouterOutputs } from "~/trpc/react";

type Model = RouterOutputs["admin"]["motorcycleModels"][number];
type Brand = RouterOutputs["admin"]["catalog"][number];

/**
 * Motorcycle brands and models (DEC-044, DEC-061): at reception they are CHOSEN
 * from here. A typo is fixed here: rename it, delete it if no motorcycle uses
 * it, or merge it into the right one (its motorcycles move there).
 * Deactivated brands/models are hidden until «Ver desactivados».
 */
export default function MotorcyclesPage() {
  const utils = api.useUtils();
  const brands = api.admin.catalog.useQuery({ kind: "motorcycleBrand" });
  const models = api.admin.motorcycleModels.useQuery();
  const [text, setText] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [newBrand, setNewBrand] = useState("");
  const [newModel, setNewModel] = useState<Record<number, string>>({});
  const [brandEdit, setBrandEdit] = useState<Brand | null>(null);
  const [modelEdit, setModelEdit] = useState<Model | null>(null);
  const refresh = () => {
    void utils.admin.catalog.invalidate();
    void utils.admin.motorcycleModels.invalidate();
  };
  const createBrand = api.admin.createCatalogItem.useMutation({
    onSuccess: () => {
      setNewBrand("");
      refresh();
    },
  });
  const saveModel = api.admin.saveMotorcycleModel.useMutation({
    onSuccess: (m) => {
      setNewModel((x) => ({ ...x, [m.motorcycleBrandId]: "" }));
      refresh();
    },
  });
  const q = text.trim().toLowerCase();
  const err = createBrand.error ?? saveModel.error;
  const inactiveCount = (brands.data?.filter((b) => !b.active).length ?? 0) + (models.data?.filter((m) => !m.active).length ?? 0);
  const visibleModel = (m: Model) => (showInactive ? true : m.active);
  const visibleBrand = (b: Brand) =>
    showInactive ? !b.active || (models.data?.some((m) => m.motorcycleBrandId === b.id && !m.active) ?? false) : b.active;

  return (
    <>
      <PageTitle title="Marcas y modelos de moto" subtitle="Lo que se elige al recibir una moto en el taller. Toque una marca o un modelo para corregirlo." />
      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <SearchField className="min-w-72 flex-1" label="Buscar marca o modelo" placeholder="Buscar marca o modelo…" value={text} onValue={setText} />
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (newBrand.trim()) createBrand.mutate({ kind: "motorcycleBrand", name: newBrand });
            }}
          >
            <Input className="h-11 w-56" placeholder="Marca nueva" value={newBrand} onChange={(e) => setNewBrand(e.target.value)} />
            <Button type="submit" className="h-11" disabled={!newBrand.trim() || createBrand.isPending}>
              + Agregar marca
            </Button>
          </form>
          <Button variant={showInactive ? "primary" : "secondary"} className="h-11" onClick={() => setShowInactive((v) => !v)}>
            {showInactive ? "← Volver a los activos" : `Ver desactivados (${inactiveCount})`}
          </Button>
        </div>
        {err && <Alert>{errorMessage(err)}</Alert>}
        {showInactive && (
          <div className="mb-3">
            <Alert kind="info">Desactivados: no se ofrecen al recibir una moto. Toque uno para activarlo.</Alert>
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {brands.data
            ?.filter(visibleBrand)
            .filter((b) => !q || b.name.toLowerCase().includes(q) || models.data?.some((m) => m.motorcycleBrandId === b.id && m.name.toLowerCase().includes(q)))
            .map((b) => {
              const own = models.data?.filter((m) => m.motorcycleBrandId === b.id && (showInactive && b.active ? !m.active : visibleModel(m))) ?? [];
              return (
                <section key={b.id} className="rounded-lg border border-neutral-800 p-3">
                  <button type="button" className="font-display text-left text-lg font-semibold hover:text-brand-600" onClick={() => setBrandEdit(b)}>
                    {b.name} {!b.active && <Badge tone="amber">Desactivada</Badge>}{" "}
                    <span className="text-sm font-normal text-neutral-500">
                      · {own.length} modelo{own.length === 1 ? "" : "s"} · ✎
                    </span>
                  </button>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {own.map((m) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => setModelEdit(m)}
                          title="Corregir, desactivar, eliminar o unir este modelo"
                          className={`rounded px-2 py-1 text-sm hover:ring-1 hover:ring-brand-600 ${m.active ? "bg-neutral-800" : "bg-neutral-800/40 text-neutral-500 line-through"}`}
                        >
                          {m.name}
                          {m.uses > 0 && <span className="ml-1 text-xs text-neutral-500">({m.uses})</span>}
                        </button>
                      </li>
                    ))}
                    {own.length === 0 && <li className="text-sm text-neutral-500">Sin modelos</li>}
                  </ul>
                  {b.active && !showInactive && (
                    <form
                      className="mt-3 flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (newModel[b.id]?.trim()) saveModel.mutate({ motorcycleBrandId: b.id, name: newModel[b.id]! });
                      }}
                    >
                      <Input placeholder="Modelo nuevo" value={newModel[b.id] ?? ""} onChange={(e) => setNewModel({ ...newModel, [b.id]: e.target.value })} />
                      <Button type="submit" variant="secondary" disabled={!newModel[b.id]?.trim() || saveModel.isPending}>
                        Agregar
                      </Button>
                    </form>
                  )}
                </section>
              );
            })}
        </div>
        <p className="mt-4 text-xs text-neutral-500">
          El número entre paréntesis es cuántas motos tienen ese modelo. Un modelo sin motos se puede eliminar; uno con motos se une con el correcto.
        </p>
      </Card>
      <BrandDialog brand={brandEdit} brands={brands.data ?? []} onClose={() => setBrandEdit(null)} onDone={refresh} />
      <ModelDialog model={modelEdit} models={models.data ?? []} brands={brands.data ?? []} onClose={() => setModelEdit(null)} onDone={refresh} />
    </>
  );
}

function BrandDialog({ brand, brands, onClose, onDone }: { brand: Brand | null; brands: Brand[]; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [merging, setMerging] = useState(false);
  const ok = () => {
    onDone();
    onClose();
  };
  const rename = api.admin.renameCatalogItem.useMutation({ onSuccess: ok });
  const toggle = api.admin.setCatalogItemActive.useMutation({ onSuccess: ok });
  const remove = api.admin.deleteCatalogItem.useMutation({ onSuccess: ok });
  const merge = api.admin.mergeCatalogItem.useMutation({ onSuccess: ok });
  const err = rename.error ?? toggle.error ?? remove.error ?? merge.error;
  const busy = rename.isPending || toggle.isPending || remove.isPending || merge.isPending;
  if (!brand) return null;
  const value = name || brand.name;
  return (
    <>
      <Dialog open={!merging} onClose={onClose} title={`Marca ${brand.name}`}>
        <div className="space-y-3">
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              rename.mutate({ kind: "motorcycleBrand", id: brand.id, name: value });
            }}
          >
            <div className="flex-1">
              <Field label="Nombre">
                <Input value={value} onChange={(e) => setName(e.target.value)} />
              </Field>
            </div>
            <Button type="submit" disabled={busy || !value.trim() || value === brand.name}>
              Guardar nombre
            </Button>
          </form>
          <p className="text-sm text-neutral-400">{brand.uses > 0 ? `La usan ${brand.uses} modelo(s) y motos.` : "Nadie la usa todavía."}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={async () => {
                if (
                  !brand.active ||
                  (await confirmDialog(`La marca «${brand.name}» deja de salir al recibir motos. Las motos ya registradas no cambian.`, {
                    title: "¿Desactivar la marca?",
                    confirmLabel: "Sí, desactivar",
                  }))
                )
                  toggle.mutate({ kind: "motorcycleBrand", id: brand.id, active: !brand.active });
              }}
            >
              {brand.active ? "Desactivar marca" : "Activar marca"}
            </Button>
            {brand.uses > 0 ? (
              <Button variant="secondary" disabled={busy} onClick={() => setMerging(true)}>
                Unir con otra marca…
              </Button>
            ) : (
              <Button
                variant="danger"
                disabled={busy}
                onClick={async () => {
                  if (await confirmDialog(`¿Eliminar la marca «${brand.name}»?`, { title: "Eliminar marca", confirmLabel: "Sí, eliminar", danger: true }))
                    remove.mutate({ kind: "motorcycleBrand", id: brand.id });
                }}
              >
                Eliminar marca
              </Button>
            )}
          </div>
          <Alert>{err && errorMessage(err)}</Alert>
        </div>
      </Dialog>
      <MergeDialog
        row={merging ? brand : null}
        options={brands.filter((b) => b.id !== brand.id)}
        onClose={() => setMerging(false)}
        onMerge={(intoId) => {
          setMerging(false);
          merge.mutate({ kind: "motorcycleBrand", fromId: brand.id, intoId });
        }}
      />
    </>
  );
}

function ModelDialog({
  model,
  models,
  brands,
  onClose,
  onDone,
}: {
  model: Model | null;
  models: Model[];
  brands: Brand[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [f, setF] = useState<{ name: string; brandId: number } | null>(null);
  const [merging, setMerging] = useState(false);
  const ok = () => {
    setF(null);
    onDone();
    onClose();
  };
  const save = api.admin.saveMotorcycleModel.useMutation({ onSuccess: ok });
  const toggle = api.admin.setMotorcycleModelActive.useMutation({ onSuccess: ok });
  const remove = api.admin.deleteMotorcycleModel.useMutation({ onSuccess: ok });
  const merge = api.admin.mergeMotorcycleModel.useMutation({ onSuccess: ok });
  const err = save.error ?? toggle.error ?? remove.error ?? merge.error;
  const busy = save.isPending || toggle.isPending || remove.isPending || merge.isPending;
  if (!model) return null;
  const form = f ?? { name: model.name, brandId: model.motorcycleBrandId };
  const changed = form.name.trim() !== model.name || form.brandId !== model.motorcycleBrandId;
  return (
    <>
      <Dialog
        open={!merging}
        onClose={() => {
          setF(null);
          onClose();
        }}
        title={`Modelo ${model.brand.name} ${model.name}`}
      >
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre del modelo">
              <Input value={form.name} onChange={(e) => setF({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Marca">
              <Select value={form.brandId} onChange={(e) => setF({ ...form, brandId: Number(e.target.value) })}>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Button disabled={busy || !changed || !form.name.trim()} onClick={() => save.mutate({ id: model.id, motorcycleBrandId: form.brandId, name: form.name })}>
            Guardar cambios
          </Button>
          <p className="text-sm text-neutral-400">{model.uses > 0 ? `${model.uses} moto(s) tienen este modelo.` : "Ninguna moto tiene este modelo."}</p>
          <div className="flex flex-wrap gap-2 border-t border-neutral-800 pt-3">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={async () => {
                if (
                  !model.active ||
                  (await confirmDialog(`El modelo «${model.name}» deja de salir al recibir motos. Las motos ya registradas no cambian.`, {
                    title: "¿Desactivar el modelo?",
                    confirmLabel: "Sí, desactivar",
                  }))
                )
                  toggle.mutate({ id: model.id, active: !model.active });
              }}
            >
              {model.active ? "Desactivar" : "Activar"}
            </Button>
            {model.uses > 0 ? (
              <Button variant="secondary" disabled={busy} onClick={() => setMerging(true)}>
                Unir con el modelo correcto…
              </Button>
            ) : (
              <Button
                variant="danger"
                disabled={busy}
                onClick={async () => {
                  if (await confirmDialog(`¿Eliminar el modelo «${model.name}»?`, { title: "Eliminar modelo", confirmLabel: "Sí, eliminar", danger: true }))
                    remove.mutate({ id: model.id });
                }}
              >
                Eliminar modelo
              </Button>
            )}
          </div>
          <Alert>{err && errorMessage(err)}</Alert>
        </div>
      </Dialog>
      <MergeDialog
        row={merging ? model : null}
        options={models.filter((m) => m.id !== model.id).map((m) => ({ id: m.id, name: `${m.brand.name} ${m.name}`, active: m.active }))}
        onClose={() => setMerging(false)}
        onMerge={(intoId) => {
          setMerging(false);
          merge.mutate({ fromId: model.id, intoId });
        }}
      />
    </>
  );
}
