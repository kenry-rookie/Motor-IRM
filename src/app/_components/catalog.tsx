"use client";

import { type ReactNode, useState } from "react";

import { ProductForm } from "~/app/_components/product-form";
import { Alert, Badge, Button, cx, Dialog, SearchField, Select } from "~/app/_components/ui";
import { errorMessage } from "~/lib/errors";
import { money } from "~/lib/format";
import { useDebounced } from "~/lib/use-debounced";
import { api, type RouterInputs, type RouterOutputs } from "~/trpc/react";

/**
 * Product and customer browsing WITH FILTERS (DEC-049). The filtering and
 * sorting are done by PostgreSQL (search router); these components only hold
 * the choices and show the results.
 */

// ---------------------------------------------------------------------------
//  Products
// ---------------------------------------------------------------------------

export type CatalogProduct = RouterOutputs["search"]["products"]["items"][number];
type ProductQuery = RouterInputs["search"]["products"];
export type ProductFilterState = Omit<ProductQuery, "q" | "limit" | "offset">;

export const EMPTY_PRODUCT_FILTERS: ProductFilterState = { sort: "relevancia" };

const STOCK_LABELS = { disponible: "Con existencias", poco: "Poco stock (1–2)", agotado: "Agotados" } as const;
const PRODUCT_SORT_LABELS = {
  relevancia: "Más parecidos / A-Z",
  nombre: "Nombre (A-Z)",
  precio_asc: "Precio: menor a mayor",
  precio_desc: "Precio: mayor a menor",
  stock_asc: "Menos existencias primero",
  mas_vendidos: "Más vendidos (90 días)",
  margen: "Mayor margen",
} as const;

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-40 flex-1 flex-col gap-1 text-xs font-medium text-neutral-400">
      {label}
      <Select className="h-10 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </Select>
    </label>
  );
}

const countActive = (f: object) =>
  Object.entries(f).filter(([k, v]) => k !== "sort" && v !== undefined && v !== "" && v !== false).length;

export function ProductFilterBar({
  value,
  onChange,
  showSupplier = true,
}: {
  value: ProductFilterState;
  onChange: (v: ProductFilterState) => void;
  showSupplier?: boolean;
}) {
  const categories = api.admin.catalog.useQuery({ kind: "productCategory" });
  const brands = api.admin.catalog.useQuery({ kind: "productBrand" });
  const suppliers = api.purchasing.suppliers.useQuery(undefined, { enabled: showSupplier });
  const set = (patch: Partial<ProductFilterState>) => onChange({ ...value, ...patch });
  const num = (v: string) => (v === "" ? undefined : Number(v));
  const active = countActive(value);
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-800 bg-neutral-800/20 p-3">
      <FilterSelect label="Categoría" value={value.categoryId ?? ""} onChange={(v) => set({ categoryId: num(v) })}>
        <option value="">Todas</option>
        {categories.data?.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </FilterSelect>
      <FilterSelect label="Marca" value={value.brandId ?? ""} onChange={(v) => set({ brandId: num(v) })}>
        <option value="">Todas</option>
        {brands.data?.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </FilterSelect>
      <FilterSelect
        label="Calidad"
        value={value.qualityTier ?? ""}
        onChange={(v) => set({ qualityTier: (v || undefined) as ProductFilterState["qualityTier"] })}
      >
        <option value="">Todas</option>
        <option value="ALTA">Alta</option>
        <option value="MEDIA">Media</option>
        <option value="BAJA">Baja</option>
      </FilterSelect>
      <FilterSelect
        label="Existencias"
        value={value.stock ?? ""}
        onChange={(v) => set({ stock: (v || undefined) as ProductFilterState["stock"] })}
      >
        <option value="">Todas</option>
        {Object.entries(STOCK_LABELS).map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </FilterSelect>
      {showSupplier && (
        <FilterSelect label="Lo vende el proveedor" value={value.supplierId ?? ""} onChange={(v) => set({ supplierId: num(v) })}>
          <option value="">Cualquiera</option>
          {suppliers.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </FilterSelect>
      )}
      <FilterSelect
        label="Ordenar por"
        value={value.sort ?? "relevancia"}
        onChange={(v) => set({ sort: v as ProductFilterState["sort"] })}
      >
        {Object.entries(PRODUCT_SORT_LABELS).map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </FilterSelect>
      {active > 0 && (
        <Button variant="ghost" className="h-10" onClick={() => onChange({ sort: value.sort })}>
          Quitar filtros ({active})
        </Button>
      )}
    </div>
  );
}

/** Items of several pages joined; if the data changed between pages, no repeats. */
export function uniqueById<T extends { id: number }>(items: T[]): T[] {
  const seen = new Set<number>();
  return items.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
}

/** Text + filters → a page of products, with "Cargar más". */
export function useProductSearch(text: string, filters: ProductFilterState, pageSize = 30) {
  const q = useDebounced(text.trim(), 200);
  const [pages, setPages] = useState(1);
  const key = JSON.stringify([q, filters]);
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setPages(1);
  }
  // One request per page (offset = i × pageSize), never one growing request:
  // the API allows at most 100 per request, so "Cargar más" used to break on
  // the 4th page (limit 120). Pages already loaded stay cached.
  const res = api.useQueries((t) =>
    Array.from({ length: pages }, (_, i) =>
      t.search.products({ q: q || undefined, ...filters, limit: pageSize, offset: i * pageSize }, { placeholderData: (p) => p }),
    ),
  );
  const first = res[0];
  const last = res[res.length - 1];
  return {
    items: uniqueById(res.flatMap((r) => r.data?.items ?? [])),
    total: first?.data?.total ?? 0,
    suggestionsOnly: first?.data?.suggestionsOnly ?? false,
    didYouMean: first?.data?.didYouMean ?? null,
    loading: first?.isLoading ?? true,
    fetching: res.some((r) => r.isFetching),
    error: res.find((r) => r.error)?.error ?? null,
    hasMore: last?.data?.nextOffset != null,
    loadMore: () => setPages((p) => p + 1),
    query: q,
  };
}

export function StockBadge({ stock }: { stock: number }) {
  if (stock === 0) return <Badge tone="red">Agotado</Badge>;
  if (stock <= 2) return <Badge tone="amber">{stock} en stock</Badge>;
  return <Badge>{stock} en stock</Badge>;
}

/**
 * The product catalog in a big window: search, filters and one click to add.
 * Opens from the «Buscar» button of the product search (Caja and Compras).
 */
export function ProductCatalogDialog({
  open,
  onClose,
  onPick,
  title = "Catálogo de productos",
  allowCreate = false,
  showCost = false,
  supplierId,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (p: CatalogProduct) => void;
  title?: string;
  /** Shows «+ Producto nuevo» (purchases). */
  allowCreate?: boolean;
  /** Shows the last cost instead of only the sale price (purchases). */
  showCost?: boolean;
  /** Preselects «Lo vende el proveedor». */
  supplierId?: number;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title} size="xl">
      <CatalogBody onPick={onPick} allowCreate={allowCreate} showCost={showCost} supplierId={supplierId} />
    </Dialog>
  );
}

function CatalogBody({
  onPick,
  allowCreate,
  showCost,
  supplierId,
}: {
  onPick: (p: CatalogProduct) => void;
  allowCreate: boolean;
  showCost: boolean;
  supplierId?: number;
}) {
  const utils = api.useUtils();
  const [text, setText] = useState("");
  const [filters, setFilters] = useState<ProductFilterState>({ ...EMPTY_PRODUCT_FILTERS, supplierId });
  const [creating, setCreating] = useState(false);
  const [added, setAdded] = useState<Record<number, number>>({});
  const r = useProductSearch(text, filters);

  const add = (p: CatalogProduct) => {
    onPick(p);
    setAdded((a) => ({ ...a, [p.id]: (a[p.id] ?? 0) + 1 }));
  };

  if (creating) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" onClick={() => setCreating(false)}>
          ← Volver al catálogo
        </Button>
        <ProductForm
          withInitialStock={!allowCreate}
          initialName={text}
          onDone={async (p) => {
            const found = await utils.search.products.fetch({ q: p.name, limit: 5, offset: 0, sort: "relevancia" });
            const created = found.items.find((x) => x.id === p.id);
            if (created) add(created);
            setCreating(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchField
          className="min-w-72 flex-1"
          label="Buscar en el catálogo"
          placeholder="Nombre, marca, categoría o código…"
          value={text}
          onValue={setText}
          inputProps={{ autoFocus: true }}
        />
        {allowCreate && (
          <Button variant="secondary" className="h-11" onClick={() => setCreating(true)}>
            + Producto nuevo
          </Button>
        )}
      </div>
      <ProductFilterBar value={filters} onChange={setFilters} />
      {r.suggestionsOnly && (
        <Alert kind="info">
          Nada dice «{r.query}». ¿Quiso decir <strong>{r.didYouMean}</strong>? Estos son los más parecidos.
        </Alert>
      )}
      {r.error && <Alert>{errorMessage(r.error)}</Alert>}
      <p className="text-xs text-neutral-500">
        {r.loading ? "Buscando…" : `${r.total} producto${r.total === 1 ? "" : "s"}`}
        {Object.keys(added).length > 0 && ` · ${Object.values(added).reduce((a, b) => a + b, 0)} agregados`}
      </p>
      <div className={cx("max-h-[50vh] overflow-y-auto rounded-lg border border-neutral-800", r.fetching && "opacity-70")}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-neutral-900 text-left text-xs text-neutral-400">
            <tr>
              <th className="px-3 py-2">Producto</th>
              <th className="px-3 py-2">Categoría · Marca</th>
              <th className="px-3 py-2 text-right">{showCost ? "Último costo" : "Precio"}</th>
              <th className="px-3 py-2 text-right">Existencias</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {r.items.map((p) => (
              <tr key={p.id} className="border-t border-neutral-800 hover:bg-neutral-800/30">
                <td className="px-3 py-2">
                  <p className="font-medium text-neutral-100">{p.name}</p>
                  <p className="text-xs text-neutral-500">{p.barcode ?? "sin código"}</p>
                </td>
                <td className="px-3 py-2 text-neutral-400">
                  {p.category.name} · {p.brand.name}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {showCost ? (p.lastCost ? money(p.lastCost) : "—") : money(p.listPrice)}
                  {showCost && <p className="text-xs text-neutral-500">venta {money(p.listPrice)}</p>}
                </td>
                <td className="px-3 py-2 text-right">
                  <StockBadge stock={p.stock} />
                </td>
                <td className="px-3 py-2 text-right">
                  <Button variant={added[p.id] ? "secondary" : "primary"} className="h-10 min-w-28" onClick={() => add(p)}>
                    {added[p.id] ? `Agregado ×${added[p.id]}` : "Agregar"}
                  </Button>
                </td>
              </tr>
            ))}
            {!r.loading && r.items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-neutral-500">
                  Ningún producto con esos filtros.{allowCreate && " Puede registrarlo con «+ Producto nuevo»."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {r.hasMore && (
        <Button variant="secondary" onClick={r.loadMore}>
          Cargar más
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
//  Customers
// ---------------------------------------------------------------------------

type CustomerQuery = RouterInputs["search"]["customers"];
export type CustomerFilterState = Omit<CustomerQuery, "q" | "limit" | "offset">;
export const EMPTY_CUSTOMER_FILTERS: CustomerFilterState = { sort: "relevancia" };

const DEBT_LABELS = {
  con_deuda: "Con deuda",
  vencida: "Con deuda vencida",
  al_dia: "Debe, pero al día",
  sin_deuda: "Sin deuda",
} as const;
const CUSTOMER_SORT_LABELS = {
  relevancia: "Más parecidos / A-Z",
  nombre: "Nombre (A-Z)",
  deuda: "Deben más",
  atraso: "Deuda más atrasada",
  reciente: "Vinieron hace poco",
} as const;

export function CustomerFilterBar({
  value,
  onChange,
}: {
  value: CustomerFilterState;
  onChange: (v: CustomerFilterState) => void;
}) {
  const models = api.admin.motorcycleModels.useQuery();
  const brands = [...new Map((models.data ?? []).map((m) => [m.brand.id, m.brand])).values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const set = (patch: Partial<CustomerFilterState>) => onChange({ ...value, ...patch });
  const active = countActive(value);
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-800 bg-neutral-800/20 p-3">
      <FilterSelect
        label="Moto"
        value={value.motorcycle ?? ""}
        onChange={(v) => set({ motorcycle: (v || undefined) as CustomerFilterState["motorcycle"] })}
      >
        <option value="">Con o sin moto</option>
        <option value="con">Tiene moto registrada</option>
        <option value="sin">Solo compra repuestos</option>
      </FilterSelect>
      <FilterSelect
        label="Marca de su moto"
        value={value.motorcycleBrandId ?? ""}
        onChange={(v) => set({ motorcycleBrandId: v === "" ? undefined : Number(v) })}
      >
        <option value="">Todas</option>
        {brands.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </FilterSelect>
      <FilterSelect
        label="Deuda"
        value={value.debt ?? ""}
        onChange={(v) => set({ debt: (v || undefined) as CustomerFilterState["debt"] })}
      >
        <option value="">Todos</option>
        {Object.entries(DEBT_LABELS).map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </FilterSelect>
      <FilterSelect
        label="Crédito"
        value={value.credit ? "si" : ""}
        onChange={(v) => set({ credit: v === "si" ? true : undefined })}
      >
        <option value="">Todos</option>
        <option value="si">Ha comprado al crédito</option>
      </FilterSelect>
      <FilterSelect
        label="Ordenar por"
        value={value.sort ?? "relevancia"}
        onChange={(v) => set({ sort: v as CustomerFilterState["sort"] })}
      >
        {Object.entries(CUSTOMER_SORT_LABELS).map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </FilterSelect>
      {active > 0 && (
        <Button variant="ghost" className="h-10" onClick={() => onChange({ sort: value.sort })}>
          Quitar filtros ({active})
        </Button>
      )}
    </div>
  );
}
