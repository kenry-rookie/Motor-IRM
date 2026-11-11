"use client";

import { forwardRef, type ReactNode, useId, useImperativeHandle, useRef, useState } from "react";

import { ProductCatalogDialog } from "~/app/_components/catalog";
import { Alert, Badge, Button, cx, Dialog, Field, Input, SearchField, Select } from "~/app/_components/ui";
import { errorMessage } from "~/lib/errors";
import { money } from "~/lib/format";
import { useDebounced } from "~/lib/use-debounced";
import { api, type RouterOutputs } from "~/trpc/react";

/**
 * The ONLY pickers of the app (DEC-043). Every screen that chooses a product,
 * a customer, a motorcycle or the responsible of an order uses one of these:
 *
 *   SearchField          the search box (with a real «Buscar» button) — in ui.tsx
 *   ProductPicker        products: scanner or typed name, typo-tolerant
 *   CustomerPicker       customers: name, phone, cédula or plate
 *   MotorcyclePicker     one of the customer's motorcycles, or a new one
 *   MotorcycleModelSelect brand + model from the catalog (never typed, §7.4)
 *   ResponsibleSelect    mechanic or owner of a service order (DEC-041)
 *
 * Text search always goes through the server's `search` router.
 */
export type Product = RouterOutputs["search"]["products"]["items"][number];
export { SearchField };
export type Customer = RouterOutputs["search"]["customers"]["items"][number];

// ---------------------------------------------------------------------------
//  Combobox (internal)
// ---------------------------------------------------------------------------

/**
 * Type, ↑/↓ to move, Enter to pick, Esc to close — or just click.
 * Results come from the server's typo-tolerant search.
 */
function Combobox<T extends { id: number }>({
  value,
  onValue,
  items,
  loading,
  render,
  onPick,
  onEnterEmpty,
  placeholder,
  header,
  footer,
  inputRef,
  autoFocus,
  label,
  onSearchButton,
}: {
  value: string;
  onValue: (v: string) => void;
  /** What «Buscar» does; by default it opens the suggestions. */
  onSearchButton?: () => void;
  items: T[];
  loading: boolean;
  render: (item: T, active: boolean) => ReactNode;
  onPick: (item: T) => void;
  /** Enter with no highlighted item (e.g. barcode scanner). */
  onEnterEmpty?: () => void;
  placeholder: string;
  header?: ReactNode;
  footer?: ReactNode;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  autoFocus?: boolean;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const show = open && value.trim().length > 0 && (items.length > 0 || !!footer || loading);

  const pick = (item: T) => {
    onPick(item);
    setActive(0);
  };

  return (
    <div className="relative">
      <SearchField
        label={label}
        value={value}
        onValue={(v) => {
          onValue(v);
          setOpen(true);
          setActive(0);
        }}
        placeholder={placeholder}
        inputRef={inputRef}
        onSearch={onSearchButton ?? (() => setOpen(true))}
        inputProps={{
          role: "combobox",
          "aria-expanded": show,
          "aria-controls": listId,
          "aria-activedescendant": show && items[active] ? `${listId}-${active}` : undefined,
          autoFocus,
          onFocus: () => setOpen(true),
          onBlur: () => setTimeout(() => setOpen(false), 150),
          onKeyDown: (e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, items.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const it = items[active];
              if (it) pick(it);
              else onEnterEmpty?.();
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          },
        }}
      />
      {show && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-neutral-700 bg-neutral-900 shadow-xl shadow-neutral-50/10">
          {header}
          <ul id={listId} role="listbox" className="max-h-80 overflow-y-auto py-1">
            {items.map((it, i) => (
              <li
                key={it.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(it);
                }}
                onMouseEnter={() => setActive(i)}
                className={cx("min-h-10 cursor-pointer px-3 py-2 text-sm", i === active && "bg-brand-600/8")}
              >
                {render(it, i === active)}
              </li>
            ))}
            {loading && items.length === 0 && <li className="px-3 py-2 text-sm text-neutral-500">Buscando…</li>}
          </ul>
          {footer}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Products
// ---------------------------------------------------------------------------

export type ProductPickerHandle = { focus: () => void };

/**
 * Product search for the counter and purchases. A barcode scanner types the
 * code and presses Enter: it is added at once. Typing a name shows the best
 * matches, even with spelling mistakes ("bugia" → Bujía), and says so when they
 * are only suggestions.
 */
export const ProductPicker = forwardRef<
  ProductPickerHandle,
  {
    onPick: (p: Product) => void;
    placeholder?: string;
    autoFocus?: boolean;
    label?: string;
    /** «Buscar» opens the catalog window with filters (DEC-049). */
    catalog?: { title?: string; allowCreate?: boolean; showCost?: boolean; supplierId?: number };
  }
>(function ProductPicker({ onPick, placeholder, autoFocus = true, label = "Buscar producto", catalog = {} }, ref) {
  const [q, setQ] = useState("");
  const [browsing, setBrowsing] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => ({ focus: () => input.current?.focus() }));
  const dq = useDebounced(q.trim(), 150);
  const utils = api.useUtils();
  const res = api.search.products.useQuery({ q: dq, limit: 8 }, { enabled: dq.length >= 2, placeholderData: (p) => p });
  const items = dq.length >= 2 ? (res.data?.items ?? []) : [];

  const done = (p: Product) => {
    onPick(p);
    setQ("");
    input.current?.focus();
  };

  return (
    <>
    <ProductCatalogDialog
      open={browsing}
      onClose={() => {
        setBrowsing(false);
        input.current?.focus();
      }}
      onPick={onPick}
      {...catalog}
    />
    <Combobox
      label={label}
      onSearchButton={() => setBrowsing(true)}
      inputRef={input}
      autoFocus={autoFocus}
      value={q}
      onValue={setQ}
      items={items}
      loading={res.isFetching}
      placeholder={placeholder ?? "Escanee el código o escriba el producto…"}
      onPick={done}
      onEnterEmpty={async () => {
        const code = q.trim();
        if (!code) return;
        const byCode = await utils.inventory.byBarcode.fetch({ barcode: code });
        const found = await utils.search.products.fetch({ q: code, limit: 1 });
        const hit = found.items[0];
        if (byCode && hit?.id === byCode.id) done(hit);
      }}
      header={
        res.data?.didYouMean && dq.length >= 2 ? (
          <p className="border-b border-neutral-800 bg-warn-bg px-3 py-2 text-xs text-warn-fg">
            No hay nada que diga «{dq}». ¿Quiso decir <strong>{res.data.didYouMean}</strong>?
          </p>
        ) : null
      }
      footer={
        !res.isFetching && dq.length >= 2 && items.length === 0 ? (
          <p className="px-3 py-3 text-sm text-neutral-500">Ningún producto se parece a «{dq}».</p>
        ) : null
      }
      render={(p) => (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium text-neutral-100">{p.name}</p>
            <p className="truncate text-xs text-neutral-500">
              {p.brand.name} · {p.category.name}
              {p.barcode ? ` · ${p.barcode}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-sm tabular-nums">{money(p.listPrice)}</span>
            {p.stock > 0 ? <Badge tone={p.stock <= 2 ? "amber" : "neutral"}>{p.stock} en stock</Badge> : <Badge tone="red">Agotado</Badge>}
          </div>
        </div>
      )}
    />
    </>
  );
});

// ---------------------------------------------------------------------------
//  Customers
// ---------------------------------------------------------------------------

/**
 * Customer search by name (typo-tolerant), phone, cédula or plate. Optionally
 * offers "Registrar «texto» como cliente nuevo" so nobody leaves the screen.
 */
export function CustomerPicker({
  value,
  onChange,
  onCreateNew,
  autoFocus,
}: {
  /** Only what is shown when chosen; a saved tab may hold just these fields. */
  value: Pick<Customer, "id" | "name" | "phone"> | null;
  onChange: (c: Customer | null) => void;
  onCreateNew?: (typed: string) => void;
  autoFocus?: boolean;
}) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim(), 150);
  const res = api.search.customers.useQuery({ q: dq, limit: 8 }, { enabled: dq.length >= 2 && !value, placeholderData: (p) => p });
  const items = dq.length >= 2 ? (res.data?.items ?? []) : [];

  if (value) {
    return (
      <div className="flex min-h-11 items-center justify-between gap-2 rounded-md border border-neutral-700 bg-neutral-800/30 px-3 py-2 text-sm">
        <span className="min-w-0 truncate">
          <span className="font-medium">{value.name}</span> <span className="text-neutral-500">· {value.phone}</span>
        </span>
        <Button type="button" variant="ghost" className="shrink-0" onClick={() => onChange(null)}>
          Cambiar cliente
        </Button>
      </div>
    );
  }
  return (
    <Combobox
      label="Buscar cliente"
      autoFocus={autoFocus}
      value={q}
      onValue={setQ}
      items={items}
      loading={res.isFetching}
      placeholder="Nombre, teléfono, cédula o placa…"
      onPick={(c) => {
        onChange(c);
        setQ("");
      }}
      header={
        res.data?.suggestionsOnly ? (
          <p className="border-b border-neutral-800 bg-warn-bg px-3 py-2 text-xs text-warn-fg">
            Nadie se llama exactamente «{dq}». Estos se parecen:
          </p>
        ) : null
      }
      footer={
        onCreateNew && dq.length >= 2 ? (
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onCreateNew(q.trim());
              setQ("");
            }}
            className="min-h-10 w-full border-t border-neutral-800 px-3 py-2.5 text-left text-sm font-medium text-brand-600 hover:bg-brand-600/8"
          >
            + Registrar «{q.trim()}» como cliente nuevo
          </button>
        ) : null
      }
      render={(c) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-neutral-100">{c.name}</p>
          <p className="truncate text-xs text-neutral-500">
            {c.phone}
            {c.motorcycles.length > 0 &&
              ` · ${c.motorcycles.map((m) => `${m.model.brand.name} ${m.model.name}${m.plate ? ` (${m.plate})` : ""}`).join(", ")}`}
          </p>
        </div>
      )}
    />
  );
}

// ---------------------------------------------------------------------------
//  Motorcycles
// ---------------------------------------------------------------------------

/**
 * Brand and model are CHOSEN from the catalog, never typed (prompt v2 §7.4):
 * "Bajaj", "bajaj " and "Bajah" can't become three brands. If the model is not
 * there, an owner (permission catalogos.gestionar) registers it right here
 * without losing what was already filled in.
 */
export function MotorcycleModelSelect({
  value,
  onChange,
  error,
}: {
  value: number;
  onChange: (motorcycleModelId: number) => void;
  error?: string;
}) {
  const me = api.auth.me.useQuery();
  const models = api.admin.motorcycleModels.useQuery();
  const [brandId, setBrandId] = useState(0);
  const [registering, setRegistering] = useState(false);
  const selected = models.data?.find((m) => m.id === value);
  const currentBrand = brandId !== 0 ? brandId : (selected?.motorcycleBrandId ?? 0);
  const brands = [...new Map((models.data ?? []).map((m) => [m.brand.id, m.brand])).values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const brandModels = (models.data ?? []).filter((m) => m.motorcycleBrandId === currentBrand);
  const canRegister = me.data?.permissions.includes("catalogos.gestionar");

  return (
    <>
      <Field label="Marca">
        <Select
          value={currentBrand}
          onChange={(e) => {
            setBrandId(Number(e.target.value));
            onChange(0);
          }}
        >
          <option value={0}>Elija la marca…</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label="Modelo"
        error={error}
        hint={canRegister ? undefined : "¿No aparece? Pídale a un dueño que lo registre."}
      >
        <Select value={value} disabled={!currentBrand} onChange={(e) => onChange(Number(e.target.value))}>
          <option value={0}>{currentBrand ? "Elija el modelo…" : "Primero la marca"}</option>
          {brandModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
      </Field>
      {canRegister && (
        <div className="flex items-end">
          <Button type="button" variant="ghost" className="h-10" onClick={() => setRegistering(true)}>
            + Registrar marca o modelo
          </Button>
        </div>
      )}
      <Dialog open={registering} onClose={() => setRegistering(false)} title="Registrar marca o modelo de moto">
        <RegisterModelForm
          initialBrandId={currentBrand}
          onDone={(model) => {
            setRegistering(false);
            setBrandId(model.motorcycleBrandId);
            onChange(model.id);
          }}
        />
      </Dialog>
    </>
  );
}

function RegisterModelForm({
  initialBrandId,
  onDone,
}: {
  initialBrandId: number;
  onDone: (m: { id: number; motorcycleBrandId: number }) => void;
}) {
  const utils = api.useUtils();
  const brands = api.admin.catalog.useQuery({ kind: "motorcycleBrand" });
  const [brandId, setBrandId] = useState(initialBrandId);
  const [newBrand, setNewBrand] = useState("");
  const [model, setModel] = useState("");
  const createBrand = api.admin.createCatalogItem.useMutation();
  const saveModel = api.admin.saveMotorcycleModel.useMutation();
  const err = createBrand.error ?? saveModel.error;

  const save = async () => {
    let id = brandId;
    if (!id) {
      const b = await createBrand.mutateAsync({ kind: "motorcycleBrand", name: newBrand });
      id = b.id;
    }
    const m = await saveModel.mutateAsync({ motorcycleBrandId: id, name: model });
    await Promise.all([utils.admin.motorcycleModels.invalidate(), utils.admin.catalog.invalidate()]);
    onDone(m);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-400">
        Revise la lista antes de crear: una marca mal escrita queda como otra marca distinta.
      </p>
      <Field label="Marca">
        <Select value={brandId} onChange={(e) => setBrandId(Number(e.target.value))}>
          <option value={0}>+ Marca nueva</option>
          {brands.data?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
      </Field>
      {!brandId && (
        <Field label="Nombre de la marca nueva">
          <Input value={newBrand} onChange={(e) => setNewBrand(e.target.value)} placeholder="Ej.: Genesis" />
        </Field>
      )}
      <Field label="Modelo">
        <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Ej.: Pulsar 150" />
      </Field>
      {err && <Alert>{errorMessage(err)}</Alert>}
      <Button
        type="button"
        disabled={!model.trim() || (!brandId && !newBrand.trim()) || createBrand.isPending || saveModel.isPending}
        onClick={() => void save().catch(() => undefined)}
      >
        Guardar y usar
      </Button>
    </div>
  );
}

export type MotorcycleChoice =
  | { kind: "existing"; motorcycleId: number }
  | { kind: "new"; motorcycleModelId: number; color: string; plate: string };

type NewMotorcycle = Extract<MotorcycleChoice, { kind: "new" }>;
export const NEW_MOTORCYCLE: NewMotorcycle = { kind: "new", motorcycleModelId: 0, color: "", plate: "" };

/** One of the customer's motorcycles, or the data of a new one. */
export function MotorcyclePicker({
  motorcycles,
  value,
  onChange,
  errors = {},
}: {
  motorcycles: Customer["motorcycles"];
  value: MotorcycleChoice;
  onChange: (v: MotorcycleChoice) => void;
  errors?: Record<string, string | undefined>;
}) {
  const [draft, setDraft] = useState<NewMotorcycle>(value.kind === "new" ? value : NEW_MOTORCYCLE);
  const setNew = (d: NewMotorcycle) => {
    setDraft(d);
    onChange(d);
  };
  const card = (checked: boolean) =>
    cx(
      "min-h-11 rounded-lg border px-3 py-2 text-left text-sm",
      checked ? "border-brand-600 bg-brand-600/8" : "border-neutral-700 hover:bg-neutral-800/50",
    );
  return (
    <div className="space-y-3">
      {motorcycles.length > 0 && (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Moto del cliente">
          {motorcycles.map((m) => {
            const checked = value.kind === "existing" && value.motorcycleId === m.id;
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => onChange({ kind: "existing", motorcycleId: m.id })}
                className={card(checked)}
              >
                <span className="block font-medium">
                  {m.model.brand.name} {m.model.name}
                </span>
                <span className="block text-xs text-neutral-500">
                  {m.color} · {m.plate ?? "sin placa"}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            role="radio"
            aria-checked={value.kind === "new"}
            onClick={() => onChange(draft)}
            className={cx(card(value.kind === "new"), "border-dashed")}
          >
            + Otra moto
          </button>
        </div>
      )}
      {value.kind === "new" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <MotorcycleModelSelect
            value={draft.motorcycleModelId}
            error={errors.motorcycleModelId}
            onChange={(id) => setNew({ ...draft, motorcycleModelId: id })}
          />
          <Field label="Color" error={errors.color}>
            <Input value={draft.color} onChange={(e) => setNew({ ...draft, color: e.target.value })} />
          </Field>
          <Field label="Placa (opcional)" hint="Las motos nuevas pueden no tener placa.">
            <Input value={draft.plate} onChange={(e) => setNew({ ...draft, plate: e.target.value.toUpperCase() })} />
          </Field>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Responsible of a service order (DEC-041)
// ---------------------------------------------------------------------------

type Staff = RouterOutputs["staff"]["list"][number];

/** «Mario · 60 % de mano de obra», «Ana · dueño, sin comisión». */
export function responsibleLabel(s: Pick<Staff, "name" | "kind" | "commissionRate">) {
  if (s.kind === "DUENO") return `${s.name} · dueño, sin comisión`;
  if (!s.commissionRate) return `${s.name} · sin comisión`;
  return `${s.name} · ${Math.round(Number(s.commissionRate.toString()) * 100)} % de mano de obra`;
}

/** Mechanics and owners who repair motorcycles. */
export function ResponsibleSelect({
  value,
  onChange,
  disabled,
  emptyLabel = "Asignar después",
  compact = false,
}: {
  value: number;
  onChange: (staffId: number) => void;
  disabled?: boolean;
  emptyLabel?: string;
  /** Small, for the board cards. */
  compact?: boolean;
}) {
  const staff = api.staff.list.useQuery({ onlyRepairers: true });
  const groups = [
    { label: "Mecánicos", rows: staff.data?.filter((s) => s.kind === "MECANICO") ?? [] },
    { label: "Dueños", rows: staff.data?.filter((s) => s.kind === "DUENO") ?? [] },
  ];
  return (
    <Select
      aria-label="Responsable"
      className={compact ? "h-9 py-1 text-xs" : undefined}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      <option value={0}>{emptyLabel}</option>
      {groups.map(
        (g) =>
          g.rows.length > 0 && (
            <optgroup key={g.label} label={g.label}>
              {g.rows.map((s) => (
                <option key={s.id} value={s.id}>
                  {responsibleLabel(s)}
                </option>
              ))}
            </optgroup>
          ),
      )}
    </Select>
  );
}
