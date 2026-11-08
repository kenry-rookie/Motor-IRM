"use client";

import { useState } from "react";

import { Input } from "~/app/_components/ui";
import { api, type RouterOutputs } from "~/trpc/react";

type Customer = RouterOutputs["customer"]["list"]["items"][number];
type Product = RouterOutputs["inventory"]["listProducts"]["items"][number];

/** Search a customer by name, phone, cédula or plate (API-021). */
export function CustomerPicker({ value, onChange }: { value: Customer | null; onChange: (c: Customer | null) => void }) {
  const [search, setSearch] = useState("");
  const list = api.customer.list.useQuery({ search, limit: 8 }, { enabled: search.length >= 2 && !value });
  if (value) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-neutral-700 px-3 py-2 text-sm">
        <span>
          {value.name} <span className="text-neutral-500">· {value.phone}</span>
        </span>
        <button className="text-neutral-400 hover:text-neutral-100" onClick={() => onChange(null)}>
          Cambiar
        </button>
      </div>
    );
  }
  return (
    <div className="relative">
      <Input placeholder="Nombre, teléfono, cédula o placa…" value={search} onChange={(e) => setSearch(e.target.value)} />
      {list.data && list.data.items.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-neutral-700 bg-neutral-900 text-sm shadow-xl">
          {list.data.items.map((c) => (
            <li key={c.id}>
              <button
                className="w-full px-3 py-2 text-left hover:bg-neutral-800"
                onClick={() => {
                  onChange(c);
                  setSearch("");
                }}
              >
                {c.name} <span className="text-neutral-500">· {c.phone}</span>
                {c.motorcycles.length > 0 && (
                  <span className="text-neutral-500"> · {c.motorcycles.map((m) => m.plate ?? m.model.name).join(", ")}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Product search: a barcode + Enter adds it at once (scanner); otherwise shows
 * matches by name.
 */
export function ProductSearch({ onPick, placeholder }: { onPick: (p: Product) => void; placeholder?: string }) {
  const [search, setSearch] = useState("");
  const utils = api.useUtils();
  const list = api.inventory.listProducts.useQuery({ search, limit: 8 }, { enabled: search.length >= 2 });
  return (
    <div className="relative">
      <Input
        autoFocus
        placeholder={placeholder ?? "Escanee o escriba el nombre del producto…"}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={async (e) => {
          if (e.key !== "Enter" || !search.trim()) return;
          e.preventDefault();
          const byCode = await utils.inventory.byBarcode.fetch({ barcode: search.trim() });
          const first = byCode ?? (list.data?.items.length === 1 ? list.data.items[0] : null);
          if (first) {
            onPick(first);
            setSearch("");
          }
        }}
      />
      {list.data && list.data.items.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-neutral-700 bg-neutral-900 text-sm shadow-xl">
          {list.data.items.map((p) => (
            <li key={p.id}>
              <button
                className="flex w-full justify-between gap-3 px-3 py-2 text-left hover:bg-neutral-800"
                onClick={() => {
                  onPick(p);
                  setSearch("");
                }}
              >
                <span>
                  {p.name} <span className="text-neutral-500">· {p.brand.name}</span>
                </span>
                <span className={p.stock > 0 ? "text-neutral-400" : "text-red-400"}>stock {p.stock}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
