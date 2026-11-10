"use client";

import { forwardRef, type ReactNode, useId, useImperativeHandle, useRef, useState } from "react";

import { Badge, cx, Input } from "~/app/_components/ui";
import { money } from "~/lib/format";
import { useDebounced } from "~/lib/use-debounced";
import { api, type RouterOutputs } from "~/trpc/react";

export type Product = RouterOutputs["inventory"]["search"]["items"][number];
export type Customer = RouterOutputs["customer"]["list"]["items"][number];

/**
 * Generic keyboard combobox: type, ↑/↓ to move, Enter to pick, Esc to close.
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
}: {
  value: string;
  onValue: (v: string) => void;
  items: T[];
  loading: boolean;
  render: (item: T, active: boolean) => ReactNode;
  onPick: (item: T) => void;
  /** Enter with no highlighted item (e.g. barcode scanner). */
  onEnterEmpty?: () => void;
  placeholder: string;
  header?: ReactNode;
  footer?: ReactNode;
  inputRef?: React.Ref<HTMLInputElement>;
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
      <Input
        ref={inputRef}
        role="combobox"
        aria-label={label}
        aria-expanded={show}
        aria-controls={listId}
        aria-activedescendant={show && items[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value}
        className="h-11 text-base"
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(e) => {
          onValue(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={(e) => {
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
                className={cx("cursor-pointer px-3 py-2 text-sm", i === active && "bg-brand-600/8")}
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

export type ProductSearchHandle = { focus: () => void };

/**
 * Product search for the counter. A barcode scanner types the code and presses
 * Enter: it is added at once. Typing a name shows the best matches, even with
 * spelling mistakes ("bugia" → Bujía), and says so when they are suggestions.
 */
export const ProductSearch = forwardRef<
  ProductSearchHandle,
  { onPick: (p: Product) => void; placeholder?: string; autoFocus?: boolean }
>(function ProductSearch({ onPick, placeholder, autoFocus = true }, ref) {
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => ({ focus: () => input.current?.focus() }));
  const dq = useDebounced(q.trim(), 150);
  const utils = api.useUtils();
  const res = api.inventory.search.useQuery({ q: dq, limit: 8 }, { enabled: dq.length >= 2, placeholderData: (p) => p });
  const items = dq.length >= 2 ? (res.data?.items ?? []) : [];

  const done = (p: Product) => {
    onPick(p);
    setQ("");
    input.current?.focus();
  };

  return (
    <Combobox
      label="Buscar producto"
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
        if (byCode) done({ ...byCode, exact: true, score: 3 });
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
  );
});

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
  value: Customer | null;
  onChange: (c: Customer | null) => void;
  onCreateNew?: (typed: string) => void;
  autoFocus?: boolean;
}) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim(), 150);
  const res = api.customer.list.useQuery({ search: dq, limit: 8 }, { enabled: dq.length >= 2 && !value, placeholderData: (p) => p });
  const items = dq.length >= 2 ? (res.data?.items ?? []) : [];

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-neutral-700 bg-neutral-800/30 px-3 py-2 text-sm">
        <span className="min-w-0 truncate">
          <span className="font-medium">{value.name}</span> <span className="text-neutral-500">· {value.phone}</span>
        </span>
        <button type="button" className="shrink-0 text-sm text-brand-600 hover:underline" onClick={() => onChange(null)}>
          Cambiar
        </button>
      </div>
    );
  }
  const suggestionsOnly = items.length > 0 && !items.some((c) => c.exact);
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
        suggestionsOnly ? (
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
            className="w-full border-t border-neutral-800 px-3 py-2.5 text-left text-sm font-medium text-brand-600 hover:bg-brand-600/8"
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
