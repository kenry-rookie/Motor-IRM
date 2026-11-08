"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

import { Alert, Badge, Button, Card, Field, Input, PageTitle, Select, Table } from "~/app/_components/ui";
import { LABELS } from "~/server/domain/constants";
import { errorMessage } from "~/lib/errors";
import { formatDateTime, money } from "~/lib/format";
import { api } from "~/trpc/react";

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
  const perms = me.data?.permissions ?? [];
  const p = product.data;
  if (product.error) return <Alert>{errorMessage(product.error)}</Alert>;
  if (!p) return <p className="text-neutral-400">Cargando…</p>;

  return (
    <>
      <PageTitle title={p.name} subtitle={`${p.category.name} · ${p.brand.name} · ${p.barcode ?? "sin código"}`} />
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
                <td className={IN.has(m.movementType) ? "text-emerald-300" : "text-red-300"}>
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
