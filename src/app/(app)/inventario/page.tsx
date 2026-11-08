"use client";

import Link from "next/link";
import { useState } from "react";

import { Alert, Badge, Button, Card, Dialog, Field, Input, PageTitle, Select, Table } from "~/app/_components/ui";
import { errorMessage, fieldErrors } from "~/lib/errors";
import { money } from "~/lib/format";
import { api } from "~/trpc/react";

/** CLI-008 — Product list with stock, search and creation. */
export default function InventoryPage() {
  const me = api.auth.me.useQuery();
  const [search, setSearch] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);
  const [creating, setCreating] = useState(false);
  const list = api.inventory.listProducts.useInfiniteQuery(
    { search: search || undefined, lowStock: onlyLow ? 2 : undefined, limit: 50 },
    { getNextPageParam: (last) => last.nextCursor, initialCursor: null },
  );
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const canManage = me.data?.permissions.includes("inventario.gestionar");

  return (
    <>
      <PageTitle
        title="Inventario"
        subtitle="Existencias calculadas del kardex (no se editan a mano)"
        actions={canManage && <Button onClick={() => setCreating(true)}>Nuevo producto</Button>}
      />
      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <Input className="max-w-sm" placeholder="Buscar por nombre o código…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <label className="flex items-center gap-2 text-sm text-neutral-300">
            <input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} /> Solo poco stock (≤ 2)
          </label>
        </div>
        <Table head={["Producto", "Categoría", "Marca", "Calidad", "Precio", "Stock"]} empty={!list.isLoading && items.length === 0}>
          {items.map((p) => (
            <tr key={p.id}>
              <td>
                <Link className="hover:text-amber-300" href={`/inventario/${p.id}`}>
                  {p.name}
                </Link>
                <div className="text-xs text-neutral-500">{p.barcode ?? "sin código"}</div>
              </td>
              <td>{p.category.name}</td>
              <td>{p.brand.name}</td>
              <td>
                <Badge>{p.qualityTier}</Badge>
              </td>
              <td>{money(p.listPrice)}</td>
              <td className={p.stock === 0 ? "text-red-400" : p.stock <= 2 ? "text-amber-300" : ""}>{p.stock}</td>
            </tr>
          ))}
        </Table>
        {list.hasNextPage && (
          <Button variant="secondary" className="mt-3" onClick={() => void list.fetchNextPage()} disabled={list.isFetchingNextPage}>
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

function ProductForm({ onDone }: { onDone: () => void }) {
  const utils = api.useUtils();
  const categories = api.admin.catalog.useQuery({ kind: "productCategory" });
  const brands = api.admin.catalog.useQuery({ kind: "productBrand" });
  const [f, setF] = useState({
    name: "",
    barcode: "",
    productCategoryId: 0,
    productBrandId: 0,
    qualityTier: "MEDIA" as "ALTA" | "MEDIA" | "BAJA",
    listPrice: "",
    qty: "",
    unitCost: "",
  });
  const create = api.inventory.create.useMutation({
    onSuccess: () => {
      void utils.inventory.invalidate();
      onDone();
    },
  });
  const errs = fieldErrors(create.error);
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate({
          name: f.name,
          barcode: f.barcode || undefined,
          productCategoryId: f.productCategoryId,
          productBrandId: f.productBrandId,
          qualityTier: f.qualityTier,
          listPrice: f.listPrice,
          initialStock: f.qty ? { quantity: Number(f.qty), unitCost: f.unitCost || "0" } : undefined,
        });
      }}
    >
      <Field label="Nombre" error={errs.name}>
        <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </Field>
      <Field label="Código de barras (opcional)" error={errs.barcode}>
        <Input value={f.barcode} onChange={(e) => setF({ ...f, barcode: e.target.value })} />
      </Field>
      <Field label="Categoría">
        <Select value={f.productCategoryId} onChange={(e) => setF({ ...f, productCategoryId: Number(e.target.value) })}>
          <option value={0}>Elegir…</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Marca">
        <Select value={f.productBrandId} onChange={(e) => setF({ ...f, productBrandId: Number(e.target.value) })}>
          <option value={0}>Elegir…</option>
          {brands.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Calidad">
        <Select value={f.qualityTier} onChange={(e) => setF({ ...f, qualityTier: e.target.value as "ALTA" | "MEDIA" | "BAJA" })}>
          <option value="ALTA">Alta</option>
          <option value="MEDIA">Media</option>
          <option value="BAJA">Baja</option>
        </Select>
      </Field>
      <Field label="Precio de venta (C$)" error={errs.listPrice}>
        <Input inputMode="decimal" value={f.listPrice} onChange={(e) => setF({ ...f, listPrice: e.target.value })} />
      </Field>
      <Field label="Inventario inicial (opcional)" hint="Unidades que hay hoy en la tienda">
        <Input type="number" min={0} value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} />
      </Field>
      <Field label="Costo unitario (C$)">
        <Input inputMode="decimal" value={f.unitCost} onChange={(e) => setF({ ...f, unitCost: e.target.value })} />
      </Field>
      <div className="sm:col-span-2">
        <Alert>{create.error && errorMessage(create.error)}</Alert>
      </div>
      <Button type="submit" className="sm:col-span-2" disabled={create.isPending}>
        Guardar
      </Button>
    </form>
  );
}
