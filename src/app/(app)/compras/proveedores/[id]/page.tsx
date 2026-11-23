"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { PurchaseDetailDialog } from "~/app/(app)/compras/purchase-detail";
import { SupplierForm, SupplierPayment } from "~/app/(app)/compras/supplier-form";
import { StockBadge } from "~/app/_components/catalog";
import { Alert, BackBar, Badge, Button, Card, Dialog, PageTitle, Stat, Table } from "~/app/_components/ui";
import { errorMessage } from "~/lib/errors";
import { docNo } from "~/lib/business";
import { dec, formatDateTime, formatDay, money } from "~/lib/format";
import { LABELS } from "~/server/domain/constants";
import { api } from "~/trpc/react";

/** A supplier: contact, what we owe, and what they sell us (from their invoices). */
export default function SupplierPage() {
  const { id } = useParams<{ id: string }>();
  const supplierId = Number(id);
  const me = api.auth.me.useQuery();
  const account = api.purchasing.supplierAccount.useQuery({ supplierId });
  const products = api.purchasing.supplierProducts.useQuery({ supplierId });
  const [editing, setEditing] = useState(false);
  const [paying, setPaying] = useState<{ purchaseInvoiceId?: number; balance: string } | null>(null);
  const [detail, setDetail] = useState<number | null>(null);
  const canManage = me.data?.permissions.includes("compras.gestionar");
  const a = account.data;
  if (account.error) return <Alert>{errorMessage(account.error)}</Alert>;
  if (!a) return <p className="text-neutral-400">Cargando…</p>;
  return (
    <>
      <BackBar
        crumbs={[{ label: "Compras", href: "/compras" }, { label: "Proveedores", href: "/compras?ver=proveedores" }, { label: a.supplier.name }]}
        back={{ href: "/compras?ver=proveedores", label: "Volver a proveedores" }}
      />
      <PageTitle
        title={a.supplier.name}
        subtitle={[a.supplier.phone, a.supplier.contactPerson].filter(Boolean).join(" · ") || "Sin datos de contacto"}
        actions={
          canManage && (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Editar datos
            </Button>
          )
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Stat label="Le debemos" value={money(a.totalBalance)} />
        <Stat label="Vencido" value={money(a.overdue)} />
        <Stat label="Productos que nos vende" value={String(products.data?.length ?? "—")} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Qué nos vende">
          {products.error && <Alert>{errorMessage(products.error)}</Alert>}
          <Table head={["Producto", "Último costo", "Última compra", "Veces", "Precio venta", "Existencias"]} empty={products.data?.length === 0}>
            {products.data?.map((p) => (
              <tr key={p.productId}>
                <td>
                  <Link href={`/inventario/${p.productId}`} className="hover:text-brand-600">
                    {p.name}
                  </Link>
                </td>
                <td className="tabular-nums">{money(p.lastUnitCost)}</td>
                <td>{formatDay(p.lastPurchaseDate)}</td>
                <td className="tabular-nums">{p.timesBought}</td>
                <td className="tabular-nums">{money(p.listPrice)}</td>
                <td>
                  <StockBadge stock={p.stock} />
                </td>
              </tr>
            ))}
          </Table>
        </Card>
        <Card title="Facturas">
          {dec(a.openingBalance).gt(0) && (
            <div className="mb-2 flex items-center justify-between gap-2 text-sm">
              <span>
                Saldo anterior al sistema: <span className="font-semibold">{money(a.openingBalance)}</span>
              </span>
              {canManage && (
                <Button variant="secondary" onClick={() => setPaying({ balance: a.openingBalance.toString() })}>
                  Pagar saldo anterior
                </Button>
              )}
            </div>
          )}
          <Table head={["Factura", "Fecha", "Tipo", "Vence", "Total", "Saldo", ""]} empty={a.purchases.length === 0}>
            {a.purchases.map((p) => (
              <tr key={p.id} className="cursor-pointer" onClick={() => setDetail(p.id)}>
                <td>
                  <span className="text-brand-600">{p.invoiceNumber}</span>
                  <div className="text-xs text-neutral-500">{docNo("compra", p.id)}</div>
                </td>
                <td>{formatDay(p.purchaseDate)}</td>
                <td>{p.paymentTerms === "CREDITO" ? "Crédito" : "Contado"}</td>
                <td>
                  {formatDay(p.dueDate)} {(p.daysOverdue ?? 0) > 0 && <Badge tone="red">{p.daysOverdue} días</Badge>}
                </td>
                <td className="tabular-nums">{money(p.total)}</td>
                <td className="font-semibold tabular-nums">{money(p.balance)}</td>
                <td className="text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" onClick={() => setDetail(p.id)}>
                      Ver detalle
                    </Button>
                    {canManage && dec(p.balance).gt(0) && (
                      <Button variant="secondary" onClick={() => setPaying({ purchaseInvoiceId: p.id, balance: p.balance.toString() })}>
                        Pagar
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
      <Card title="Pagos hechos a este proveedor" className="mt-4">
        <Table head={["N.º", "Fecha", "Factura", "Monto", "Con qué dinero", "Registró"]} empty={a.payments.length === 0}>
          {a.payments.map((x) => (
            <tr key={x.id}>
              <td className="whitespace-nowrap">{docNo("pagoProveedor", x.id)}</td>
              <td>{formatDateTime(x.paidAt)}</td>
              <td>
                {x.purchaseInvoice ? (
                  <button type="button" className="text-brand-600 hover:underline" onClick={() => setDetail(x.purchaseInvoice!.id)}>
                    {x.purchaseInvoice.invoiceNumber}
                  </button>
                ) : (
                  "Saldo anterior"
                )}
              </td>
              <td className="tabular-nums">{money(x.amount, x.currency === "USD" ? "USD" : "NIO")}</td>
              <td>
                {LABELS.supplierPaymentSource[x.source as keyof typeof LABELS.supplierPaymentSource] ?? x.source}
                {x.notes && <div className="text-xs text-neutral-500">{x.notes}</div>}
              </td>
              <td className="text-neutral-400">{x.registeredBy?.staff?.name ?? x.registeredBy?.username ?? "—"}</td>
            </tr>
          ))}
        </Table>
      </Card>
      <PurchaseDetailDialog id={detail} onClose={() => setDetail(null)} />
      <Dialog open={editing} onClose={() => setEditing(false)} title="Editar proveedor" size="lg">
        <SupplierForm supplier={a.supplier} onDone={() => setEditing(false)} onCancel={() => setEditing(false)} />
      </Dialog>
      <Dialog open={!!paying} onClose={() => setPaying(null)} title="Pago a proveedor">
        {paying && <SupplierPayment supplierId={supplierId} {...paying} onDone={() => setPaying(null)} />}
      </Dialog>
    </>
  );
}
