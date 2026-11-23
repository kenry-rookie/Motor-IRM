"use client";

import Link from "next/link";
import { useState } from "react";

import { SupplierPayment } from "~/app/(app)/compras/supplier-form";
import { confirmDialog } from "~/app/_components/confirm";
import { Alert, Badge, Button, Card, Dialog, Field, Input, Select, Stat, Table } from "~/app/_components/ui";
import { docNo } from "~/lib/business";
import { errorMessage } from "~/lib/errors";
import { dec, formatDateTime, formatDay, money } from "~/lib/format";
import { LABELS } from "~/server/domain/constants";
import { api } from "~/trpc/react";

const RESOLUTION: Record<string, string> = {
  REPOSICION: "Reposición (nos dieron otro)",
  DINERO: "Nos devolvieron el dinero",
  DESCUENTO: "Descuento en la deuda",
};

const who = (u: { username: string; staff: { name: string } | null } | null | undefined) => u?.staff?.name ?? u?.username ?? "—";

/**
 * The complete purchase invoice (Kenry, 23-nov): what was bought, totals,
 * payments (with where the money came from), returns and the trip it belongs to.
 * Used by the full page /compras/[id] and by the detail window everywhere else.
 */
export function PurchaseDetail({ id, compact = false }: { id: number; compact?: boolean }) {
  const me = api.auth.me.useQuery();
  const inv = api.purchasing.getInvoice.useQuery({ id });
  const [paying, setPaying] = useState(false);
  const [returning, setReturning] = useState(false);
  if (inv.error) return <Alert>{errorMessage(inv.error)}</Alert>;
  const p = inv.data;
  if (!p) return <p className="text-neutral-400">Cargando…</p>;
  const credit = p.paymentTerms === "CREDITO";
  const canPay = !!me.data?.permissions.includes("compras.gestionar") && dec(p.balance).gt(0);
  const gross = p.lines.reduce((a, l) => a.plus(dec(l.unitCost).times(l.quantity)), dec(0));
  const units = p.lines.reduce((a, l) => a + l.quantity, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-neutral-400">
          <p>
            <span className="font-medium text-neutral-200">{docNo("compra", p.id)}</span> · factura del proveedor{" "}
            <span className="font-medium text-neutral-200">{p.invoiceNumber}</span>
          </p>
          <p>
            <Link className="hover:text-brand-600 hover:underline" href={`/compras/proveedores/${p.supplier.id}`}>
              {p.supplier.name}
            </Link>{" "}
            · fecha {formatDay(p.purchaseDate)} · registró {who(p.receivedBy)} el {formatDateTime(p.createdAt)}
          </p>
          {p.purchaseTrip && (
            <p>
              Parte del{" "}
              <Link className="text-brand-600 hover:underline" href={`/compras/viajes/${p.purchaseTrip.id}`}>
                viaje de compras {docNo("viaje", p.purchaseTrip.id)} ({p.purchaseTrip.destination}, {formatDay(p.purchaseTrip.tripDate)})
              </Link>
            </p>
          )}
          {p.notes && <p>Nota: {p.notes}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={credit ? "amber" : "green"}>{credit ? `Crédito · vence ${formatDay(p.dueDate)}` : "Contado"}</Badge>
          {me.data?.permissions.includes("compras.gestionar") && p.lines.some((l) => l.quantity > l.returnLines.reduce((a, r) => a + r.quantity, 0)) && (
            <Button variant="secondary" onClick={() => setReturning(true)}>
              Devolución al proveedor
            </Button>
          )}
          {canPay && <Button onClick={() => setPaying(true)}>Pagar</Button>}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Total" value={money(p.total)} detail={`${p.lines.length} productos · ${units} unidades`} />
        <Stat label="Devuelto" value={money(p.returned)} />
        <Stat label="Pagado" value={money(p.paid)} />
        <Stat label="Saldo" value={money(p.balance)} />
      </div>

      <Card title="Lo que se compró">
        <Table head={["#", "Producto", "Cantidad", "Costo unit.", "Subtotal", "Devuelto"]}>
          {p.lines.map((l) => {
            const returned = l.returnLines.reduce((a, r) => a + r.quantity, 0);
            return (
              <tr key={l.id}>
                <td>{l.lineNo}</td>
                <td>
                  <Link className="hover:text-brand-600" href={`/inventario/${l.productId}`}>
                    {l.product.name}
                  </Link>
                  {l.product.barcode && <div className="text-xs text-neutral-500">{l.product.barcode}</div>}
                </td>
                <td className="tabular-nums">{l.quantity}</td>
                <td className="tabular-nums">{money(l.unitCost)}</td>
                <td className="tabular-nums">{money(dec(l.unitCost).times(l.quantity))}</td>
                <td className="tabular-nums">{returned || "—"}</td>
              </tr>
            );
          })}
        </Table>
        <dl className="mt-3 ml-auto grid max-w-xs grid-cols-2 gap-1 text-sm">
          <dt className="text-neutral-400">Suma de líneas</dt>
          <dd className="text-right tabular-nums">{money(gross)}</dd>
          <dt className="text-neutral-400">Descuento</dt>
          <dd className="text-right tabular-nums">− {money(p.discountAmount)}</dd>
          <dt className="border-t border-neutral-700 pt-1 font-semibold">Total</dt>
          <dd className="border-t border-neutral-700 pt-1 text-right font-semibold tabular-nums">{money(p.total)}</dd>
        </dl>
      </Card>

      <div className={compact ? "space-y-4" : "grid gap-4 lg:grid-cols-2"}>
        <Card title="Pagos">
          <Table head={["N.º", "Fecha", "Monto", "Con qué dinero", "Registró"]} empty={p.payments.length === 0}>
            {p.payments.map((x) => (
              <tr key={x.id}>
                <td className="whitespace-nowrap">{docNo("pagoProveedor", x.id)}</td>
                <td>{formatDateTime(x.paidAt)}</td>
                <td className="tabular-nums">
                  {money(x.amount, x.currency === "USD" ? "USD" : "NIO")}
                  {x.currency === "USD" && <div className="text-xs text-neutral-500">TC {x.exchangeRate?.toString()}</div>}
                </td>
                <td>
                  {LABELS.supplierPaymentSource[x.source as keyof typeof LABELS.supplierPaymentSource] ?? x.source}
                  {x.purchaseTrip && <div className="text-xs text-neutral-500">{docNo("viaje", x.purchaseTrip.id)}</div>}
                  {x.notes && <div className="text-xs text-neutral-500">{x.notes}</div>}
                </td>
                <td className="text-neutral-400">{who(x.registeredBy)}</td>
              </tr>
            ))}
          </Table>
        </Card>
        <Card title="Devoluciones al proveedor">
          <Table head={["Fecha", "Motivo", "Cómo se resolvió", "Unidades"]} empty={p.returns.length === 0}>
            {p.returns.map((r) => (
              <tr key={r.id}>
                <td>{formatDay(r.returnedOn)}</td>
                <td>{r.returnReason.name}</td>
                <td>{RESOLUTION[r.resolution] ?? r.resolution}</td>
                <td className="tabular-nums">{r.lines.reduce((a, x) => a + x.quantity, 0)}</td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      <Dialog open={returning} onClose={() => setReturning(false)} title={`Devolución al proveedor · factura ${p.invoiceNumber}`}>
        {returning && (
          <SupplierReturnForm
            purchaseInvoiceId={p.id}
            lines={p.lines.map((l) => ({
              id: l.id,
              name: l.product.name,
              available: l.quantity - l.returnLines.reduce((a, r) => a + r.quantity, 0),
            }))}
            onDone={() => setReturning(false)}
          />
        )}
      </Dialog>
      <Dialog open={paying} onClose={() => setPaying(false)} title={`Pagar la factura ${p.invoiceNumber}`}>
        {paying && <SupplierPayment supplierId={p.supplierId} purchaseInvoiceId={p.id} balance={p.balance.toString()} onDone={() => setPaying(false)} />}
      </Dialog>
    </div>
  );
}

/** The detail in a window over the current screen, with a link to open it full screen. */
export function PurchaseDetailDialog({ id, onClose }: { id: number | null; onClose: () => void }) {
  return (
    <Dialog open={id !== null} onClose={onClose} title="Detalle de la factura de compra" size="xl">
      {id !== null && (
        <>
          <PurchaseDetail id={id} compact />
          <div className="mt-4 text-right">
            <Link href={`/compras/${id}`} className="text-sm text-brand-600 hover:underline">
              Abrir en pantalla completa →
            </Link>
          </div>
        </>
      )}
    </Dialog>
  );
}

/**
 * Products that go back to the supplier (API-017, CLI-012): they leave the
 * inventory now. How it is settled: the supplier gives another one (the debt
 * stays), gives the money back, or discounts it from the debt.
 */
function SupplierReturnForm({
  purchaseInvoiceId,
  lines,
  onDone,
}: {
  purchaseInvoiceId: number;
  lines: { id: number; name: string; available: number }[];
  onDone: () => void;
}) {
  const utils = api.useUtils();
  const reasons = api.admin.catalog.useQuery({ kind: "returnReason", onlyActive: true });
  const [qty, setQty] = useState<Record<number, string>>({});
  const [reasonId, setReasonId] = useState(0);
  const [resolution, setResolution] = useState<"REPOSICION" | "DINERO" | "DESCUENTO" | "">("");
  const save = api.purchasing.createReturn.useMutation({
    onSuccess: () => {
      void utils.purchasing.invalidate();
      void utils.inventory.invalidate();
      void utils.search.invalidate();
      onDone();
    },
  });
  const chosen = Object.entries(qty)
    .map(([id, q]) => ({ purchaseInvoiceLineId: Number(id), quantity: Number(q) }))
    .filter((x) => x.quantity > 0);
  return (
    <div className="space-y-3">
      <Table head={["Producto", "Se puede devolver", "Cantidad"]}>
        {lines.map((l) => (
          <tr key={l.id}>
            <td>{l.name}</td>
            <td className="tabular-nums">{l.available}</td>
            <td>
              <Input inputMode="numeric" className="w-20" disabled={l.available === 0} value={qty[l.id] ?? ""} onChange={(e) => setQty({ ...qty, [l.id]: e.target.value })} />
            </td>
          </tr>
        ))}
      </Table>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Motivo">
          <Select value={reasonId} onChange={(e) => setReasonId(Number(e.target.value))}>
            <option value={0}>Elegir…</option>
            {reasons.data
              ?.filter((r) => r.name.trim().toLowerCase() !== "anulación de factura")
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="¿Cómo lo resuelve el proveedor?">
          <Select value={resolution} onChange={(e) => setResolution(e.target.value as typeof resolution)}>
            <option value="">Elegir…</option>
            {Object.entries(RESOLUTION).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Alert kind="info">
        Los productos salen del inventario al registrar. «Reposición»: la deuda sigue y el producto nuevo se ingresa cuando llegue. «Dinero» o
        «Descuento»: baja lo que se le debe por esta factura.
      </Alert>
      <Alert>{save.error && errorMessage(save.error)}</Alert>
      <Button
        className="w-full"
        disabled={!reasonId || !resolution || chosen.length === 0 || save.isPending}
        onClick={async () => {
          if (!resolution) return;
          const units = chosen.reduce((a, l) => a + l.quantity, 0);
          if (
            await confirmDialog(`Salen ${units} unidad${units === 1 ? "" : "es"} del inventario para devolverlas al proveedor.`, {
              title: "¿Registrar la devolución?",
              confirmLabel: "Sí, registrar",
            })
          )
            save.mutate({ purchaseInvoiceId, returnReasonId: reasonId, resolution, lines: chosen });
        }}
      >
        Registrar devolución al proveedor
      </Button>
    </div>
  );
}
