"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { SupplierForm, SupplierPayment } from "~/app/(app)/compras/supplier-form";
import { StockBadge } from "~/app/_components/catalog";
import { Alert, BackBar, Badge, Button, Card, Dialog, PageTitle, Stat, Table } from "~/app/_components/ui";
import { errorMessage } from "~/lib/errors";
import { dec, formatDay, money } from "~/lib/format";
import { api } from "~/trpc/react";

/** A supplier: contact, what we owe, and what they sell us (from their invoices). */
export default function SupplierPage() {
  const { id } = useParams<{ id: string }>();
  const supplierId = Number(id);
  const me = api.auth.me.useQuery();
  const account = api.purchasing.supplierAccount.useQuery({ supplierId });
  const products = api.purchasing.supplierProducts.useQuery({ supplierId });
  const [editing, setEditing] = useState(false);
  const [paying, setPaying] = useState<{ purchaseInvoiceId: number; balance: string } | null>(null);
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
            <p className="mb-2 text-sm">
              Saldo anterior al sistema: <span className="font-semibold">{money(a.openingBalance)}</span>
            </p>
          )}
          <Table head={["Factura", "Fecha", "Tipo", "Vence", "Total", "Saldo", ""]} empty={a.purchases.length === 0}>
            {a.purchases.map((p) => (
              <tr key={p.id}>
                <td>{p.invoiceNumber}</td>
                <td>{formatDay(p.purchaseDate)}</td>
                <td>{p.paymentTerms === "CREDITO" ? "Crédito" : "Contado"}</td>
                <td>
                  {formatDay(p.dueDate)} {(p.daysOverdue ?? 0) > 0 && <Badge tone="red">{p.daysOverdue} días</Badge>}
                </td>
                <td className="tabular-nums">{money(p.total)}</td>
                <td className="font-semibold tabular-nums">{money(p.balance)}</td>
                <td className="text-right">
                  {canManage && dec(p.balance).gt(0) && (
                    <Button variant="secondary" onClick={() => setPaying({ purchaseInvoiceId: p.id, balance: p.balance.toString() })}>
                      Pagar
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
      <Dialog open={editing} onClose={() => setEditing(false)} title="Editar proveedor">
        <SupplierForm supplier={a.supplier} onDone={() => setEditing(false)} />
      </Dialog>
      <Dialog open={!!paying} onClose={() => setPaying(null)} title="Pago a proveedor">
        {paying && <SupplierPayment supplierId={supplierId} {...paying} onDone={() => setPaying(null)} />}
      </Dialog>
    </>
  );
}
