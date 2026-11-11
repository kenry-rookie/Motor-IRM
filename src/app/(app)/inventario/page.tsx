"use client";

import Link from "next/link";
import { useState } from "react";

import {
  EMPTY_PRODUCT_FILTERS,
  ProductFilterBar,
  type ProductFilterState,
  StockBadge,
  useProductSearch,
} from "~/app/_components/catalog";
import { ProductForm } from "~/app/_components/product-form";
import { Alert, Badge, Button, Card, Dialog, PageTitle, SearchField, Table } from "~/app/_components/ui";
import { errorMessage } from "~/lib/errors";
import { money } from "~/lib/format";
import { LABELS } from "~/server/domain/constants";
import { api } from "~/trpc/react";

/**
 * CLI-008 — Products: search + filters done by the database (DEC-049), stock,
 * last cost and margin. Stock is never edited here: it comes from the kardex.
 */
export default function InventoryPage() {
  const me = api.auth.me.useQuery();
  const [text, setText] = useState("");
  const [filters, setFilters] = useState<ProductFilterState>(EMPTY_PRODUCT_FILTERS);
  const [creating, setCreating] = useState(false);
  const r = useProductSearch(text, filters, 50);
  const canManage = me.data?.permissions.includes("inventario.gestionar");
  const canSeeCost = me.data?.permissions.includes("compras.ver");

  return (
    <>
      <PageTitle
        title="Inventario"
        actions={canManage && <Button onClick={() => setCreating(true)}>+ Nuevo producto</Button>}
      />
      <Card>
        <div className="mb-3 space-y-3">
          <SearchField
            className="w-full max-w-xl"
            label="Buscar producto"
            placeholder="Nombre, marca, categoría o código de barras…"
            value={text}
            onValue={setText}
          />
          <ProductFilterBar value={filters} onChange={setFilters} />
        </div>
        {r.suggestionsOnly && (
          <div className="mb-3">
            <Alert kind="info">
              Ningún producto dice «{r.query}». ¿Quiso decir <strong>{r.didYouMean}</strong>? Estos son los más parecidos.
            </Alert>
          </div>
        )}
        {r.error && <Alert>{errorMessage(r.error)}</Alert>}
        <p className="mb-2 text-xs text-neutral-500">{r.loading ? "Buscando…" : `${r.total} producto${r.total === 1 ? "" : "s"}`}</p>
        <Table
          head={["Producto", "Categoría", "Marca", "Calidad", "Precio", ...(canSeeCost ? ["Último costo", "Margen"] : []), "Vendidos 90 días", "Stock"]}
          empty={!r.loading && r.items.length === 0}
        >
          {r.items.map((p) => (
            <tr key={p.id}>
              <td>
                <Link className="font-medium hover:text-brand-600" href={`/inventario/${p.id}`}>
                  {p.name}
                </Link>
                <div className="text-xs text-neutral-500">{p.barcode ?? "sin código"}</div>
              </td>
              <td>{p.category.name}</td>
              <td>{p.brand.name}</td>
              <td>
                <Badge>{LABELS.qualityTier[p.qualityTier as "ALTA" | "MEDIA" | "BAJA"] ?? p.qualityTier}</Badge>
              </td>
              <td className="tabular-nums">{money(p.listPrice)}</td>
              {canSeeCost && (
                <>
                  <td className="tabular-nums text-neutral-400">{p.lastCost ? money(p.lastCost) : "—"}</td>
                  <td className="tabular-nums">{p.marginPct ? `${p.marginPct.toString()} %` : "—"}</td>
                </>
              )}
              <td className="tabular-nums text-neutral-400">{p.sold90d}</td>
              <td>
                <StockBadge stock={p.stock} />
              </td>
            </tr>
          ))}
        </Table>
        {r.hasMore && (
          <Button variant="secondary" className="mt-3" onClick={r.loadMore} disabled={r.fetching}>
            Cargar más
          </Button>
        )}
      </Card>
      <Dialog open={creating} onClose={() => setCreating(false)} title="Nuevo producto">
        <ProductForm onDone={() => setCreating(false)} />
      </Dialog>
    </>
  );
}
