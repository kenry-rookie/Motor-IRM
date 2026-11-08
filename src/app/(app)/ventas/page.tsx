"use client";

import { useState } from "react";

import { ProductSearch } from "~/app/_components/pickers";
import { cleanTerms, emptyTerms, type Terms, TermsForm } from "~/app/_components/terms-form";
import { Alert, Button, Card, Input, PageTitle, Select, Table } from "~/app/_components/ui";
import { errorMessage } from "~/lib/errors";
import { dec, money } from "~/lib/format";
import { api, type RouterOutputs } from "~/trpc/react";

type Product = RouterOutputs["inventory"]["listProducts"]["items"][number];
type Customer = RouterOutputs["customer"]["list"]["items"][number];
type CartLine = { product: Product; quantity: number; discountId?: number; discountAmount?: string };

/**
 * CLI-006 — Counter sale. Prices and totals shown here are a preview: the API
 * recalculates everything from the database when the sale is saved.
 */
export default function PosPage() {
  const me = api.auth.me.useQuery();
  const discounts = api.admin.discounts.useQuery();
  const utils = api.useUtils();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [terms, setTerms] = useState<Terms>(emptyTerms);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [done, setDone] = useState<{ id: number; total: string } | null>(null);

  const create = api.sales.create.useMutation({
    onSuccess: (r) => {
      setDone({ id: r.id, total: r.total.toString() });
      setCart([]);
      setCustomer(null);
      setTerms(emptyTerms());
      void utils.inventory.invalidate();
    },
  });

  const perms = me.data?.permissions ?? [];
  const hasManualDiscount = cart.some((l) => !l.discountId && dec(l.discountAmount ?? 0).gt(0));
  const needsAuthorization =
    (terms.paymentTerms === "CREDITO" && !perms.includes("ventas.autorizar_credito")) ||
    (hasManualDiscount && !perms.includes("ventas.autorizar_descuento"));

  const lineDiscount = (l: CartLine) => {
    const gross = dec(l.product.listPrice).times(l.quantity);
    if (l.discountId) {
      const d = discounts.data?.find((x) => x.id === l.discountId);
      if (!d) return dec(0);
      return d.discountType === "PORCENTAJE" ? gross.times(dec(d.value)).toDecimalPlaces(2) : dec(d.value);
    }
    return dec(l.discountAmount ?? 0);
  };
  const total = cart.reduce((acc, l) => acc.plus(dec(l.product.listPrice).times(l.quantity).minus(lineDiscount(l))), dec(0));

  const add = (p: Product) => {
    setDone(null);
    setCart((c) => {
      const i = c.findIndex((l) => l.product.id === p.id);
      if (i >= 0) return c.map((l, j) => (j === i ? { ...l, quantity: l.quantity + 1 } : l));
      return [...c, { product: p, quantity: 1 }];
    });
  };
  const update = (i: number, patch: Partial<CartLine>) => setCart((c) => c.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  return (
    <>
      <PageTitle title="Punto de venta" subtitle="Escanee el código o busque por nombre. Enter agrega el producto." />
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Card>
          <ProductSearch onPick={add} />
          <div className="mt-4">
            <Table head={["Producto", "Precio", "Cant.", "Descuento", "Total", ""]} empty={cart.length === 0}>
              {cart.map((l, i) => (
                <tr key={l.product.id}>
                  <td>
                    {l.product.name}
                    <div className={`text-xs ${l.quantity > l.product.stock ? "text-red-400" : "text-neutral-500"}`}>
                      stock {l.product.stock}
                    </div>
                  </td>
                  <td>{money(l.product.listPrice)}</td>
                  <td>
                    <Input
                      type="number"
                      min={1}
                      className="w-20"
                      value={l.quantity}
                      onChange={(e) => update(i, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                    />
                  </td>
                  <td className="space-y-1">
                    <Select
                      className="w-40"
                      value={l.discountId ?? ""}
                      onChange={(e) =>
                        update(i, { discountId: e.target.value ? Number(e.target.value) : undefined, discountAmount: undefined })
                      }
                    >
                      <option value="">Sin descuento / manual</option>
                      {discounts.data
                        ?.filter((d) => d.active)
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                    </Select>
                    {!l.discountId && (
                      <Input
                        className="w-40"
                        placeholder="C$ manual"
                        inputMode="decimal"
                        value={l.discountAmount ?? ""}
                        onChange={(e) => update(i, { discountAmount: e.target.value })}
                      />
                    )}
                  </td>
                  <td>{money(dec(l.product.listPrice).times(l.quantity).minus(lineDiscount(l)))}</td>
                  <td>
                    <Button variant="ghost" onClick={() => setCart((c) => c.filter((_, j) => j !== i))} aria-label="Quitar">
                      ✕
                    </Button>
                  </td>
                </tr>
              ))}
            </Table>
          </div>
        </Card>

        <Card title="Cobro">
          <div className="space-y-4">
            <TermsForm
              terms={terms}
              onChange={setTerms}
              customer={customer}
              onCustomer={setCustomer}
              needsAuthorization={needsAuthorization}
            />
            <div className="flex items-baseline justify-between border-t border-neutral-800 pt-3">
              <span className="text-neutral-400">Total</span>
              <span className="text-3xl font-bold">{money(total)}</span>
            </div>
            <Alert>{create.error && errorMessage(create.error)}</Alert>
            {done && (
              <Alert kind="ok">
                Venta #{done.id} registrada por {money(done.total)}.{" "}
                <a className="underline" href={`/ventas/${done.id}`}>
                  Ver / imprimir
                </a>
              </Alert>
            )}
            <Button
              className="w-full py-3 text-base"
              disabled={cart.length === 0 || create.isPending}
              onClick={() =>
                create.mutate({
                  terms: cleanTerms(terms, customer?.id),
                  lines: cart.map((l) => ({
                    productId: l.product.id,
                    quantity: l.quantity,
                    discountId: l.discountId,
                    discountAmount: !l.discountId && l.discountAmount ? l.discountAmount : undefined,
                  })),
                })
              }
            >
              {create.isPending ? "Guardando…" : "Cobrar"}
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}
