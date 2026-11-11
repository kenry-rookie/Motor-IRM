"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { SupplierPayment } from "~/app/(app)/compras/supplier-form";
import { Alert, BackBar, Badge, Button, Card, Dialog, PageTitle, Stat, Table } from "~/app/_components/ui";
import { errorMessage } from "~/lib/errors";
import { dec, formatDay, money } from "~/lib/format";
import { api } from "~/trpc/react";

const RESOLUTION: Record<string, string> = {
  REPOSICION: "Reposición (nos dieron otro)",
  DINERO: "Nos devolvieron el dinero",
  DESCUENTO: "Descuento en la deuda",
};

/** Detail of a purchase: what was bought, what was paid and what was returned. */
export default function PurchaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const me = api.auth.me.useQuery();
  const inv = api.purchasing.getInvoice.useQuery({ id: Number(id) });
  const [paying, setPaying] = useState(false);
  if (inv.error) return <Alert>{errorMessage(inv.error)}</Alert>;
  const p = inv.data;
  if (!p) return <p className="text-neutral-400">Cargando…</p>;
  const credit = p.paymentTerms === "CREDITO";
  const canPay = !!me.data?.permissions.includes("compras.gestionar") && dec(p.balance).gt(0);
  const gross = p.lines.reduce((a, l) => a.plus(dec(l.unitCost).times(l.quantity)), dec(0));

  return (
    <>
      <BackBar crumbs={[{ label: "Compras", href: "/compras" }, { label: `Compra #${p.id}` }]} back={{ href: "/compras", label: "Volver a compras" }} />
      <PageTitle
        title={`Compra #${p.id} · factura ${p.invoiceNumber}`}
        subtitle={`${p.supplier.name} · ${formatDay(p.purchaseDate)} · recibió ${p.receivedBy.username}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={credit ? "amber" : "green"}>{credit ? `Crédito · vence ${formatDay(p.dueDate)}` : "Contado"}</Badge>
            {canPay && <Button onClick={() => setPaying(true)}>Pagar</Button>}
          </div>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Stat label="Total" value={money(p.total)} />
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

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Pagos">
          <Table head={["Fecha", "Monto", "Moneda"]} empty={p.payments.length === 0}>
            {p.payments.map((x) => (
              <tr key={x.id}>
                <td>{formatDay(x.paidOn)}</td>
                <td className="tabular-nums">{money(x.amount, x.currency === "USD" ? "USD" : "NIO")}</td>
                <td>{x.currency === "USD" ? `Dólares (TC ${x.exchangeRate?.toString()})` : "Córdobas"}</td>
              </tr>
            ))}
          </Table>
          {!credit && <p className="mt-2 text-xs text-neutral-500">Compra de contado: se pagó el mismo día de la compra.</p>}
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

      <Dialog open={paying} onClose={() => setPaying(false)} title="Pago a proveedor">
        {paying && <SupplierPayment supplierId={p.supplierId} purchaseInvoiceId={p.id} balance={p.balance.toString()} onDone={() => setPaying(false)} />}
      </Dialog>
    </>
  );
}
