"use client";

import Link from "next/link";
import { useState } from "react";

import { EMPTY_PRODUCT_FILTERS, useProductSearch } from "~/app/_components/catalog";
import { Alert, BackBar, Button, Card, PageTitle, SearchField, Table } from "~/app/_components/ui";
import { errorMessage } from "~/lib/errors";
import { money } from "~/lib/format";
import { api } from "~/trpc/react";

/**
 * Productos desactivados (migration 9b): they don't show up in Inventario, Caja
 * or Compras. Here they are listed so nothing gets lost, and can be reactivated.
 */
export default function InactiveProductsPage() {
  const utils = api.useUtils();
  const [text, setText] = useState("");
  const r = useProductSearch(text, { ...EMPTY_PRODUCT_FILTERS, inactive: true });
  const setActive = api.inventory.setActive.useMutation({
    onSuccess: () => {
      void utils.search.invalidate();
      void utils.inventory.invalidate();
    },
  });
  return (
    <>
      <BackBar crumbs={[{ label: "Administración", href: "/admin" }, { label: "Productos desactivados" }]} back={{ href: "/admin", label: "Volver a administración" }} />
      <PageTitle title="Productos desactivados" subtitle="No aparecen en Inventario, Caja ni Compras. Nada se borra: sus ventas y su kardex se conservan." />
      <Card>
        <SearchField className="mb-3 w-full max-w-xl" label="Buscar producto desactivado" placeholder="Nombre, marca o código…" value={text} onValue={setText} />
        {r.error && <Alert>{errorMessage(r.error)}</Alert>}
        <Alert>{setActive.error && errorMessage(setActive.error)}</Alert>
        <p className="mb-2 text-sm text-neutral-500">{r.loading ? "Buscando…" : `${r.total} producto${r.total === 1 ? "" : "s"} desactivado${r.total === 1 ? "" : "s"}`}</p>
        <Table head={["Producto", "Categoría", "Marca", "Precio", "Stock", ""]} empty={!r.loading && r.items.length === 0}>
          {r.items.map((p) => (
            <tr key={p.id}>
              <td>
                <Link className="hover:text-brand-600" href={`/inventario/${p.id}`}>
                  {p.name}
                </Link>
                <div className="text-xs text-neutral-500">{p.barcode ?? "sin código"}</div>
              </td>
              <td>{p.category.name}</td>
              <td>{p.brand.name}</td>
              <td className="tabular-nums">{money(p.listPrice)}</td>
              <td className="tabular-nums">{p.stock}</td>
              <td className="text-right">
                <Button variant="secondary" disabled={setActive.isPending} onClick={() => setActive.mutate({ id: p.id, active: true })}>
                  Activar
                </Button>
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
    </>
  );
}
