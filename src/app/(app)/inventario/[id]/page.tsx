"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

import { confirmDialog } from "~/app/_components/confirm";
import { Alert, BackBar, Badge, Button, Card, Dialog, Field, Input, PageTitle, Select, Table } from "~/app/_components/ui";
import { LABELS } from "~/server/domain/constants";
import { errorMessage } from "~/lib/errors";
import { formatDateTime, money } from "~/lib/format";
import { api, type RouterOutputs } from "~/trpc/react";

const IN = new Set(["COMPRA", "DEVOLUCION_CLIENTE", "INVENTARIO_INICIAL", "AJUSTE_ENTRADA"]);

/** CLI-008 — Product card: stock, kardex, adjustments, price change with history. */
export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const productId = Number(id);
  const me = api.auth.me.useQuery();
  const utils = api.useUtils();
  const product = api.inventory.get.useQuery({ id: productId });
  const moves = api.inventory.movements.useInfiniteQuery(
    { productId, limit: 30 },
    { getNextPageParam: (l) => l.nextCursor, initialCursor: null },
  );
  const refresh = () => void utils.inventory.invalidate();
  const [adj, setAdj] = useState({ direction: "SALIDA" as "ENTRADA" | "SALIDA", quantity: "", notes: "" });
  const [price, setPrice] = useState("");
  const adjust = api.inventory.adjust.useMutation({ onSuccess: () => { setAdj({ ...adj, quantity: "", notes: "" }); refresh(); } });
  const changePrice = api.inventory.changePrice.useMutation({ onSuccess: () => { setPrice(""); refresh(); } });
  const [editing, setEditing] = useState(false);
  const setActive = api.inventory.setActive.useMutation({
    onSuccess: () => {
      refresh();
      void utils.search.invalidate();
    },
  });
  const perms = me.data?.permissions ?? [];
  const p = product.data;
  if (product.error) return <Alert>{errorMessage(product.error)}</Alert>;
  if (!p) return <p className="text-neutral-400">Cargando…</p>;

  return (
    <>
      <BackBar crumbs={[{ label: "Inventario", href: "/inventario" }, { label: p.name }]} back={{ href: "/inventario", label: "Volver al inventario" }} />
      <PageTitle
        title={p.name}
        subtitle={`${p.category.name} · ${p.brand.name} · ${p.barcode ?? "sin código"}`}
        actions={
          perms.includes("inventario.gestionar") && (
            <div className="flex gap-2">
              {!p.active && <Badge tone="red">Desactivado</Badge>}
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Editar datos
              </Button>
              <Button
                variant={p.active ? "danger" : "primary"}
                disabled={setActive.isPending}
                onClick={async () => {
                  if (
                    p.active &&
                    !(await confirmDialog(
                      `«${p.name}» dejará de aparecer en Inventario, Caja y Compras.${p.stock > 0 ? ` Todavía tiene ${p.stock} en stock.` : ""}\n\nSe puede volver a activar en Administración → Productos desactivados.`,
                      { title: "Desactivar producto", confirmLabel: "Sí, desactivar", danger: true },
                    ))
                  )
                    return;
                  setActive.mutate({ id: p.id, active: !p.active });
                }}
              >
                {p.active ? "Desactivar" : "Activar"}
              </Button>
            </div>
          )
        }
      />
      <Alert>{setActive.error && errorMessage(setActive.error)}</Alert>
      <Dialog open={editing} onClose={() => setEditing(false)} title="Editar datos del producto">
        {editing && <EditProductForm product={p} onDone={() => setEditing(false)} />}
      </Dialog>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Existencias">
          <p className="text-4xl font-bold">{p.stock}</p>
          <p className="mt-2 text-sm text-neutral-400">
            Precio {money(p.listPrice)} · último costo {money(p.lastCost)} · calidad <Badge>{p.qualityTier}</Badge>
          </p>
        </Card>
        {perms.includes("inventario.ajustar") && (
          <Card title="Ajuste de inventario">
            <div className="grid grid-cols-2 gap-3">
              <Select value={adj.direction} onChange={(e) => setAdj({ ...adj, direction: e.target.value as "ENTRADA" | "SALIDA" })}>
                <option value="SALIDA">Salida (pérdida, daño…)</option>
                <option value="ENTRADA">Entrada (sobrante…)</option>
              </Select>
              <Input type="number" min={1} placeholder="Cantidad" value={adj.quantity} onChange={(e) => setAdj({ ...adj, quantity: e.target.value })} />
              <Input className="col-span-2" placeholder="Motivo (obligatorio)" value={adj.notes} onChange={(e) => setAdj({ ...adj, notes: e.target.value })} />
              <Button
                className="col-span-2"
                disabled={!adj.quantity || !adj.notes || adjust.isPending}
                onClick={() => adjust.mutate({ productId, direction: adj.direction, quantity: Number(adj.quantity), notes: adj.notes })}
              >
                Registrar ajuste
              </Button>
            </div>
            <div className="mt-2">
              <Alert>{adjust.error && errorMessage(adjust.error)}</Alert>
            </div>
          </Card>
        )}
        {perms.includes("inventario.precios") && (
          <Card title="Cambiar precio">
            <Field label="Nuevo precio (C$)">
              <Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
            </Field>
            <Button className="mt-3 w-full" disabled={!price || changePrice.isPending} onClick={() => changePrice.mutate({ productId, newPrice: price })}>
              Guardar precio
            </Button>
            <div className="mt-2">
              <Alert>{changePrice.error && errorMessage(changePrice.error)}</Alert>
            </div>
            <ul className="mt-3 space-y-1 text-xs text-neutral-400">
              {p.priceHistory.map((h) => (
                <li key={h.id}>
                  {formatDateTime(h.changedAt)} → {money(h.newPrice)} {h.changedBy && `(${h.changedBy.username})`}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
      <Card title="Kardex (movimientos)" className="mt-4">
        <Table head={["Fecha", "Tipo", "Cantidad", "Costo unit.", "Nota", "Usuario"]}>
          {moves.data?.pages
            .flatMap((pg) => pg.items)
            .map((m) => (
              <tr key={m.id}>
                <td>{formatDateTime(m.movedAt)}</td>
                <td>{LABELS.movementType[m.movementType as keyof typeof LABELS.movementType] ?? m.movementType}</td>
                <td className={IN.has(m.movementType) ? "text-ok-fg" : "text-bad-fg"}>
                  {IN.has(m.movementType) ? "+" : "−"}
                  {m.quantity}
                </td>
                <td>{money(m.unitCost)}</td>
                <td className="text-neutral-400">{m.notes}</td>
                <td className="text-neutral-400">{m.registeredBy.username}</td>
              </tr>
            ))}
        </Table>
        {moves.hasNextPage && (
          <Button variant="secondary" className="mt-3" onClick={() => void moves.fetchNextPage()}>
            Cargar más
          </Button>
        )}
      </Card>
    </>
  );
}

type Product = RouterOutputs["inventory"]["get"];

/** Name, barcode, category, brand and quality can be fixed (mistakes happen). Price and stock have their own cards. */
function EditProductForm({ product, onDone }: { product: Product; onDone: () => void }) {
  const utils = api.useUtils();
  const categories = api.admin.catalog.useQuery({ kind: "productCategory" });
  const brands = api.admin.catalog.useQuery({ kind: "productBrand" });
  const [f, setF] = useState({
    name: product.name,
    barcode: product.barcode ?? "",
    productCategoryId: product.productCategoryId,
    productBrandId: product.productBrandId,
    qualityTier: product.qualityTier as "ALTA" | "MEDIA" | "BAJA",
  });
  const update = api.inventory.update.useMutation({
    onSuccess: () => {
      void utils.inventory.invalidate();
      void utils.search.invalidate();
      onDone();
    },
  });
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        update.mutate({ id: product.id, ...f, barcode: f.barcode || undefined });
      }}
    >
      <Field label="Nombre">
        <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </Field>
      <Field label="Código de barras (opcional)">
        <Input inputMode="numeric" maxLength={14} placeholder="Solo números, 8 a 14 dígitos" value={f.barcode} onChange={(e) => setF({ ...f, barcode: e.target.value })} />
      </Field>
      <Field label="Categoría">
        <Select value={f.productCategoryId} onChange={(e) => setF({ ...f, productCategoryId: Number(e.target.value) })}>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Marca">
        <Select value={f.productBrandId} onChange={(e) => setF({ ...f, productBrandId: Number(e.target.value) })}>
          {brands.data?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
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
      <div className="sm:col-span-2">
        <Alert>{update.error && errorMessage(update.error)}</Alert>
        <p className="mb-2 text-xs text-neutral-500">El precio y las existencias se cambian en sus propias tarjetas, para que quede el historial.</p>
        <Button type="submit" className="w-full" disabled={!f.name.trim() || update.isPending}>
          {update.isPending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
