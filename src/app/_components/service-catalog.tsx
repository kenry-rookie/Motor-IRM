"use client";

import { useMemo, useState } from "react";

import { Alert, Button, cx, Field, Input, SearchField, Select } from "~/app/_components/ui";
import { errorMessage, fieldErrors } from "~/lib/errors";
import { money } from "~/lib/format";
import { api, type RouterOutputs } from "~/trpc/react";

/**
 * Workshop jobs are CHOSEN from the catalog, never typed (prompt v2 §7, DEC-048).
 * Search box + category pills + one click per job. If a job is missing, an owner
 * (permission catalogos.gestionar) adds it to the catalog right here, so the list
 * grows in order instead of filling with loose text. There is no "Otro".
 */
export type ServiceType = RouterOutputs["admin"]["serviceTypes"][number];

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

export function ServiceCatalogPicker({
  selected,
  onToggle,
  compact = false,
}: {
  selected: number[];
  onToggle: (t: ServiceType) => void;
  /** Smaller list (billing panel). */
  compact?: boolean;
}) {
  const me = api.auth.me.useQuery();
  const types = api.admin.serviceTypes.useQuery();
  const [text, setText] = useState("");
  const [category, setCategory] = useState<number | "usuales" | "todas">("usuales");
  const [adding, setAdding] = useState(false);
  const canAdd = me.data?.permissions.includes("catalogos.gestionar");

  const active = useMemo(() => (types.data ?? []).filter((t) => t.active), [types.data]);
  const categories = useMemo(
    () => [...new Map(active.map((t) => [t.category.id, t.category])).values()].sort((a, b) => a.sortOrder - b.sortOrder),
    [active],
  );
  const q = norm(text);
  const usual = [...active].sort((a, b) => b.timesOrdered - a.timesOrdered || a.name.localeCompare(b.name)).slice(0, 10);
  const shown = q
    ? active.filter((t) => norm(`${t.name} ${t.category.name}`).includes(q))
    : category === "usuales"
      ? usual
      : category === "todas"
        ? active
        : active.filter((t) => t.category.id === category);

  return (
    <div className="space-y-2">
      <SearchField
        label="Buscar trabajo"
        placeholder="Buscar trabajo: aceite, frenos, cadena…"
        value={text}
        onValue={setText}
      />
      {!q && (
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Categorías de trabajos">
          {(
            [
              ["usuales", "Más pedidos"],
              ...categories.map((c) => [c.id, c.name] as const),
              ["todas", "Todos"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={String(id)}
              type="button"
              role="tab"
              aria-selected={category === id}
              onClick={() => setCategory(id)}
              className={cx(
                "min-h-9 rounded-full border px-3 text-xs font-medium",
                category === id ? "border-brand-600 bg-brand-600 text-white" : "border-neutral-700 text-neutral-300 hover:bg-neutral-800",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div className={cx("grid gap-2", compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3")}>
        {shown.map((t) => {
          const on = selected.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(t)}
              className={cx(
                "flex min-h-11 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                on ? "border-brand-600 bg-brand-600/8 text-neutral-50" : "border-neutral-700 hover:bg-neutral-800/60",
              )}
            >
              <span>
                <span className="block font-medium">
                  {on ? "✓ " : "+ "}
                  {t.name}
                </span>
                <span className="block text-xs text-neutral-500">{t.category.name}</span>
              </span>
              {t.referencePrice && <span className="shrink-0 text-xs tabular-nums text-neutral-400">{money(t.referencePrice)}</span>}
            </button>
          );
        })}
      </div>
      {shown.length === 0 && (
        <p className="text-sm text-neutral-500">
          Ningún trabajo dice «{text}».{" "}
          {canAdd ? "Puede agregarlo al catálogo." : "Pídale a un dueño que lo agregue al catálogo."}
        </p>
      )}
      {canAdd &&
        (adding ? (
          <NewServiceType
            initialName={text}
            onCancel={() => setAdding(false)}
            onDone={(t) => {
              setAdding(false);
              setText("");
              onToggle(t);
            }}
          />
        ) : (
          <Button type="button" variant="ghost" onClick={() => setAdding(true)}>
            + Agregar trabajo al catálogo
          </Button>
        ))}
    </div>
  );
}

function NewServiceType({
  initialName,
  onDone,
  onCancel,
}: {
  initialName: string;
  onDone: (t: ServiceType) => void;
  onCancel: () => void;
}) {
  const utils = api.useUtils();
  const categories = api.admin.serviceCategories.useQuery();
  const [f, setF] = useState({ name: initialName, serviceCategoryId: 0, referencePrice: "", minPrice: "", maxPrice: "" });
  const save = api.admin.saveServiceType.useMutation({
    onSuccess: async (t) => {
      await utils.admin.serviceTypes.invalidate();
      onDone({ ...t, timesOrdered: 0 });
    },
  });
  const errs = fieldErrors(save.error);
  return (
    <div className="space-y-3 rounded-lg border border-dashed border-neutral-700 p-3">
      <p className="text-sm font-medium text-neutral-200">Nuevo trabajo del catálogo</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre" error={errs.name} hint="Como se le dice en el taller, corto y claro">
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
        <Field label="Precio de referencia (C$)" error={errs.referencePrice}>
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
      </div>
      <p className="text-xs text-neutral-500">Cobrar fuera del mínimo o el máximo pedirá la clave de un dueño.</p>
      {save.error && <Alert>{errorMessage(save.error)}</Alert>}
      <div className="flex gap-2">
        <Button
          type="button"
          disabled={!f.name.trim() || !f.serviceCategoryId || save.isPending}
          onClick={() =>
            save.mutate({
              name: f.name,
              serviceCategoryId: f.serviceCategoryId,
              referencePrice: f.referencePrice || null,
              minPrice: f.minPrice || null,
              maxPrice: f.maxPrice || null,
            })
          }
        >
          Guardar y elegir
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
