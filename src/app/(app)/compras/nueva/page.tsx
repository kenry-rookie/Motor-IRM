"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { confirmDialog } from "~/app/_components/confirm";
import { SupplierForm } from "~/app/(app)/compras/supplier-form";
import { type CatalogProduct, ProductCatalogDialog } from "~/app/_components/catalog";
import { ProductPicker } from "~/app/_components/pickers";
import { Alert, BackBar, Badge, Button, Card, cx, Dialog, Field, Input, PageTitle, Select } from "~/app/_components/ui";
import { errorMessage } from "~/lib/errors";
import { addDaysISO, dec, formatDay, money, todayISO } from "~/lib/format";
import { api } from "~/trpc/react";

/**
 * CLI-012 v2 — Register a purchase, full screen (prompt v2 §6.4):
 *  - «Ver todos los productos» opens the catalog with filters; one click adds.
 *  - each line shows the LAST COST PAID TO THIS SUPPLIER (and the date), not the
 *    sale price, with ▲/▼ and % when the cost changed;
 *  - the sale price can be updated from the same line, seeing the new margin;
 *  - totals, invoice discount and cash/credit in a fixed panel, like Caja;
 *  - what is filled in is kept as a draft until it is registered.
 */
type Line = { productId: number; name: string; stock: number; listPrice: string; quantity: string; unitCost: string; newListPrice: string };
type Draft = {
  supplierId: number;
  invoiceNumber: string;
  purchaseDate: string;
  paymentTerms: "CONTADO" | "CREDITO";
  dueDate: string;
  discountAmount: string;
  lines: Line[];
};
const DRAFT_KEY = "motor-irm.compra.borrador.v1";
const empty = (): Draft => ({
  supplierId: 0,
  invoiceNumber: "",
  purchaseDate: todayISO(),
  paymentTerms: "CONTADO",
  dueDate: addDaysISO(todayISO(), 30),
  discountAmount: "",
  lines: [],
});

export default function NewPurchasePage() {
  const router = useRouter();
  const utils = api.useUtils();
  const me = api.auth.me.useQuery();
  const suppliers = api.purchasing.suppliers.useQuery();
  const [d, setD] = useState<Draft>(empty);
  const [loaded, setLoaded] = useState(false);
  const [catalog, setCatalog] = useState<"all" | "supplier" | null>(null);
  const [newSupplier, setNewSupplier] = useState(false);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const canPrice = me.data?.permissions.includes("inventario.precios");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (raw) setD({ ...empty(), ...(JSON.parse(raw) as Partial<Draft>) });
    } catch {
      /* no draft */
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch {
      /* without storage it still works */
    }
  }, [d, loaded]);

  const last = api.purchasing.lastCosts.useQuery(
    { supplierId: d.supplierId, productIds: d.lines.map((l) => l.productId) },
    { enabled: d.supplierId > 0 && d.lines.length > 0, placeholderData: (p) => p },
  );
  const lastBy = new Map((last.data ?? []).map((r) => [r.productId, r]));

  const create = api.purchasing.createInvoice.useMutation({
    onSuccess: () => {
      try {
        window.localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* nothing to clear */
      }
      void utils.purchasing.invalidate();
      void utils.inventory.invalidate();
      void utils.search.invalidate();
      router.push("/compras?registrada=1");
    },
  });

  const add = (p: CatalogProduct) =>
    setD((x) => {
      const i = x.lines.findIndex((l) => l.productId === p.id);
      if (i >= 0) return { ...x, lines: x.lines.map((l, j) => (j === i ? { ...l, quantity: String((Number(l.quantity) || 0) + 1) } : l)) };
      return {
        ...x,
        lines: [
          ...x.lines,
          {
            productId: p.id,
            name: p.name,
            stock: p.stock,
            listPrice: p.listPrice.toString(),
            quantity: "1",
            unitCost: p.lastCost?.toString() ?? "",
            newListPrice: "",
          },
        ],
      };
    });
  const setLine = (i: number, patch: Partial<Line>) => set({ lines: d.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });

  const subtotal = d.lines.reduce((a, l) => a.plus(dec(l.unitCost).times(dec(l.quantity))), dec(0));
  const total = subtotal.minus(dec(d.discountAmount));
  const units = d.lines.reduce((a, l) => a + (Number(l.quantity) || 0), 0);
  const missing = !d.supplierId ? "Elija el proveedor" : !d.invoiceNumber.trim() ? "Escriba el número de factura" : d.lines.length === 0 ? "Agregue productos" : null;

  const submit = () => {
    if (missing || create.isPending) return;
    create.mutate({
      supplierId: d.supplierId,
      invoiceNumber: d.invoiceNumber,
      purchaseDate: d.purchaseDate,
      paymentTerms: d.paymentTerms,
      dueDate: d.paymentTerms === "CREDITO" ? d.dueDate : undefined,
      discountAmount: d.discountAmount || "0",
      lines: d.lines.map((l) => ({
        productId: l.productId,
        quantity: Number(l.quantity),
        unitCost: l.unitCost || "0",
        newListPrice: l.newListPrice || undefined,
      })),
    });
  };

  return (
    <>
      <BackBar crumbs={[{ label: "Compras", href: "/compras" }, { label: "Registrar compra" }]} back={{ href: "/compras", label: "Volver a compras" }} />
      <PageTitle title="Registrar compra" subtitle="Lo que llega del proveedor entra al inventario al registrar" />
      <div className="grid items-start gap-4 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Card title="Factura del proveedor">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Proveedor">
                <div className="flex gap-2">
                  <Select value={d.supplierId} onChange={(e) => set({ supplierId: Number(e.target.value) })}>
                    <option value={0}>Elegir proveedor…</option>
                    {suppliers.data?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                  <Button variant="secondary" type="button" aria-label="Nuevo proveedor" onClick={() => setNewSupplier(true)}>
                    +
                  </Button>
                </div>
              </Field>
              <Field label="N.º de factura">
                <Input value={d.invoiceNumber} onChange={(e) => set({ invoiceNumber: e.target.value })} />
              </Field>
              <Field label="Fecha de la factura">
                <Input type="date" value={d.purchaseDate} max={todayISO()} onChange={(e) => set({ purchaseDate: e.target.value })} />
              </Field>
              <Field label="Descuento de la factura (C$)">
                <Input inputMode="decimal" value={d.discountAmount} onChange={(e) => set({ discountAmount: e.target.value })} />
              </Field>
            </div>
          </Card>

          <Card
            title={`Productos (${d.lines.length} · ${units} unidades)`}
            actions={
              <div className="flex flex-wrap gap-2">
                {d.supplierId > 0 && (
                  <Button variant="secondary" onClick={() => setCatalog("supplier")}>
                    Lo que nos vende este proveedor
                  </Button>
                )}
                <Button onClick={() => setCatalog("all")}>Ver todos los productos</Button>
              </div>
            }
          >
            <ProductPicker
              autoFocus={false}
              placeholder="Escanee o escriba el producto…"
              onPick={add}
              catalog={{ title: "Agregar a la compra", allowCreate: true, showCost: true, supplierId: d.supplierId || undefined }}
            />
            {d.lines.length === 0 ? (
              <p className="mt-6 py-6 text-center text-sm text-neutral-500">
                Escanee los productos, búsquelos arriba o use «Ver todos los productos».
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="text-left text-xs text-neutral-400">
                    <tr>
                      <th className="py-2 pr-2">Producto</th>
                      <th className="px-2 py-2">Cantidad</th>
                      <th className="px-2 py-2">Costo unitario</th>
                      <th className="px-2 py-2">Último costo a este proveedor</th>
                      <th className="px-2 py-2 text-right">Subtotal</th>
                      <th className="px-2 py-2">Precio de venta</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {d.lines.map((l, i) => {
                      const prev = lastBy.get(l.productId);
                      const change =
                        prev && l.unitCost && dec(prev.lastUnitCost).gt(0)
                          ? dec(l.unitCost).minus(prev.lastUnitCost).div(prev.lastUnitCost).times(100)
                          : null;
                      const price = dec(l.newListPrice || l.listPrice);
                      const margin = price.gt(0) && l.unitCost ? price.minus(dec(l.unitCost)).div(price).times(100) : null;
                      return (
                        <tr key={l.productId} className="border-t border-neutral-800 align-top">
                          <td className="py-2 pr-2">
                            <p className="font-medium">{l.name}</p>
                            <p className="text-xs text-neutral-500">Hay {l.stock} en tienda</p>
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              aria-label={`Cantidad de ${l.name}`}
                              inputMode="numeric"
                              className="w-20"
                              value={l.quantity}
                              onChange={(e) => setLine(i, { quantity: e.target.value.replace(/\D/g, "") })}
                            />
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              aria-label={`Costo de ${l.name}`}
                              inputMode="decimal"
                              className="w-28"
                              placeholder="C$"
                              value={l.unitCost}
                              onChange={(e) => setLine(i, { unitCost: e.target.value })}
                            />
                          </td>
                          <td className="px-2 py-2">
                            {prev ? (
                              <>
                                <span className="tabular-nums">{money(prev.lastUnitCost)}</span>{" "}
                                {change && !change.isZero() && (
                                  <Badge tone={change.gt(0) ? "red" : "green"}>
                                    {change.gt(0) ? "▲" : "▼"} {change.abs().toFixed(1)} %
                                  </Badge>
                                )}
                                <p className="text-xs text-neutral-500">{formatDay(prev.lastPurchaseDate)}</p>
                              </>
                            ) : (
                              <span className="text-xs text-neutral-500">{d.supplierId ? "Primera vez con este proveedor" : "Elija el proveedor"}</span>
                            )}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums">{money(dec(l.unitCost).times(dec(l.quantity)))}</td>
                          <td className="px-2 py-2">
                            <div className="flex items-center gap-2">
                              <span className={cx("tabular-nums", l.newListPrice && "text-neutral-500 line-through")}>{money(l.listPrice)}</span>
                              {canPrice && (
                                <Input
                                  aria-label={`Nuevo precio de ${l.name}`}
                                  inputMode="decimal"
                                  className="w-28"
                                  placeholder="Nuevo"
                                  value={l.newListPrice}
                                  onChange={(e) => setLine(i, { newListPrice: e.target.value })}
                                />
                              )}
                            </div>
                            {margin && (
                              <p className={cx("text-xs", margin.lt(15) ? "text-bad-fg" : "text-neutral-500")}>
                                Margen {margin.toFixed(1)} %{margin.lt(15) && " (bajo)"}
                              </p>
                            )}
                          </td>
                          <td className="py-2 text-right">
                            <Button variant="ghost" aria-label={`Quitar ${l.name}`} onClick={() => set({ lines: d.lines.filter((_, j) => j !== i) })}>
                              ×
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <Card className="xl:sticky xl:top-4" title="Total de la compra">
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-neutral-400">Subtotal</dt>
              <dd className="tabular-nums">{money(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-400">Descuento</dt>
              <dd className="tabular-nums">− {money(d.discountAmount)}</dd>
            </div>
            <div className="flex justify-between border-t border-neutral-800 pt-2 text-lg font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{money(total)}</dd>
            </div>
          </dl>
          <div className="mt-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Forma de pago">
            {(["CONTADO", "CREDITO"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={d.paymentTerms === t}
                onClick={() => set({ paymentTerms: t })}
                className={cx(
                  "min-h-11 rounded-lg border text-sm font-medium",
                  d.paymentTerms === t ? "border-brand-600 bg-brand-600 text-white" : "border-neutral-700 hover:bg-neutral-800",
                )}
              >
                {t === "CONTADO" ? "Contado" : "Crédito"}
              </button>
            ))}
          </div>
          {d.paymentTerms === "CREDITO" && (
            <div className="mt-3">
              <Field label="Vence">
                <Input type="date" value={d.dueDate} min={d.purchaseDate} onChange={(e) => set({ dueDate: e.target.value })} />
              </Field>
            </div>
          )}
          {create.error && (
            <div className="mt-3">
              <Alert>{errorMessage(create.error)}</Alert>
            </div>
          )}
          <Button className="mt-4 h-12 w-full text-base" disabled={!!missing || create.isPending} onClick={submit}>
            {create.isPending ? "Registrando…" : "Registrar compra (entra al inventario)"}
          </Button>
          {missing && <p className="mt-2 text-center text-xs text-neutral-500">{missing}</p>}
          {d.lines.length > 0 && (
            <Button
              variant="ghost"
              className="mt-2 w-full"
              onClick={async () => {
                if (await confirmDialog("¿Borrar esta compra sin registrarla?", { title: "Empezar de nuevo", confirmLabel: "Sí, borrar", danger: true })) setD(empty());
              }}
            >
              Empezar de nuevo
            </Button>
          )}
        </Card>
      </div>
      <ProductCatalogDialog
        open={catalog !== null}
        onClose={() => setCatalog(null)}
        onPick={add}
        title={catalog === "supplier" ? "Lo que nos vende este proveedor" : "Todos los productos"}
        allowCreate
        showCost
        supplierId={catalog === "supplier" ? d.supplierId : undefined}
      />
      <Dialog open={newSupplier} onClose={() => setNewSupplier(false)} title="Nuevo proveedor">
        <SupplierForm
          onDone={(s) => {
            setNewSupplier(false);
            if (s) set({ supplierId: s.id });
          }}
        />
      </Dialog>
    </>
  );
}
