"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { SupplierForm, SupplierPayment } from "~/app/(app)/compras/supplier-form";
import { Alert, Badge, Button, Card, cx, Dialog, Input, PageTitle, Table } from "~/app/_components/ui";
import { errorMessage } from "~/lib/errors";
import { dec, formatDay, money } from "~/lib/format";
import { api } from "~/trpc/react";

/** CLI-012 — Purchases (stock entry), what we owe, and the suppliers. */
export default function PurchasesPage() {
  return (
    <Suspense>
      <Purchases />
    </Suspense>
  );
}

function Purchases() {
  const me = api.auth.me.useQuery();
  const params = useSearchParams();
  const [tab, setTab] = useState<"facturas" | "proveedores">(params.get("ver") === "proveedores" ? "proveedores" : "facturas");
  const [newSupplier, setNewSupplier] = useState(false);
  const canManage = me.data?.permissions.includes("compras.gestionar");
  return (
    <>
      <PageTitle
        title="Compras"
        subtitle="Lo que se le compra a los proveedores y lo que se les debe"
        actions={
          canManage && (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setNewSupplier(true)}>
                + Nuevo proveedor
              </Button>
              <Link href="/compras/nueva" className="inline-flex min-h-10 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">
                + Registrar compra
              </Link>
            </div>
          )
        }
      />
      {params.get("registrada") && (
        <div className="mb-4">
          <Alert kind="ok">Compra registrada: los productos ya están en el inventario.</Alert>
        </div>
      )}
      <div className="mb-4 flex gap-2" role="tablist">
        {(
          [
            ["facturas", "Facturas de compra"],
            ["proveedores", "Proveedores"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cx(
              "min-h-10 rounded-lg border px-4 text-sm font-medium",
              tab === k ? "border-brand-600 bg-brand-600 text-white" : "border-neutral-700 text-neutral-200 hover:bg-neutral-800",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "facturas" ? <Invoices canManage={!!canManage} /> : <Suppliers />}
      <Dialog open={newSupplier} onClose={() => setNewSupplier(false)} title="Nuevo proveedor">
        <SupplierForm
          onDone={() => {
            setNewSupplier(false);
            setTab("proveedores");
          }}
        />
      </Dialog>
    </>
  );
}

function Invoices({ canManage }: { canManage: boolean }) {
  const invoices = api.purchasing.listInvoices.useQuery({ limit: 50 });
  const [paying, setPaying] = useState<{ supplierId: number; purchaseInvoiceId: number; balance: string } | null>(null);
  return (
    <Card>
      {invoices.error && <Alert>{errorMessage(invoices.error)}</Alert>}
      <Table head={["#", "Proveedor", "Factura", "Fecha", "Tipo", "Vence", "Total", "Saldo", ""]} empty={invoices.data?.items.length === 0}>
        {invoices.data?.items.map((p) => (
          <tr key={p.id}>
            <td>{p.id}</td>
            <td>
              <Link href={`/compras/proveedores/${p.supplier.id}`} className="hover:text-brand-600">
                {p.supplier.name}
              </Link>
            </td>
            <td>{p.invoiceNumber}</td>
            <td>{formatDay(p.purchaseDate)}</td>
            <td>{p.paymentTerms === "CREDITO" ? "Crédito" : "Contado"}</td>
            <td>{formatDay(p.dueDate)}</td>
            <td className="tabular-nums">{money(p.total)}</td>
            <td className="font-semibold tabular-nums">{money(p.balance)}</td>
            <td className="text-right">
              {canManage && dec(p.balance).gt(0) && (
                <Button variant="secondary" onClick={() => setPaying({ supplierId: p.supplier.id, purchaseInvoiceId: p.id, balance: p.balance.toString() })}>
                  Pagar
                </Button>
              )}
            </td>
          </tr>
        ))}
      </Table>
      <Dialog open={!!paying} onClose={() => setPaying(null)} title="Pago a proveedor">
        {paying && <SupplierPayment {...paying} onDone={() => setPaying(null)} />}
      </Dialog>
    </Card>
  );
}

function Suppliers() {
  const list = api.purchasing.suppliersOverview.useQuery();
  const [text, setText] = useState("");
  const q = text.trim().toLowerCase();
  const rows = (list.data ?? []).filter(
    (s) => !q || `${s.name} ${s.contactPerson ?? ""} ${s.topProducts.join(" ")}`.toLowerCase().includes(q),
  );
  return (
    <Card>
      <Input className="mb-3 h-11 max-w-md" placeholder="Buscar proveedor o producto que vende…" value={text} onChange={(e) => setText(e.target.value)} />
      {list.error && <Alert>{errorMessage(list.error)}</Alert>}
      <Table head={["Proveedor", "Teléfono", "Contacto", "Qué nos vende", "Última compra", "Le debemos", ""]} empty={!list.isLoading && rows.length === 0}>
        {rows.map((s) => (
          <tr key={s.id}>
            <td>
              <Link href={`/compras/proveedores/${s.id}`} className="font-medium hover:text-brand-600">
                {s.name}
              </Link>
              {s.givesWarranty && <div className="text-xs text-neutral-500">da garantía</div>}
            </td>
            <td className="tabular-nums">{s.phone ?? "—"}</td>
            <td>{s.contactPerson ?? "—"}</td>
            <td className="max-w-80 text-neutral-400">
              {s.products === 0 ? (
                "Todavía no le hemos comprado"
              ) : (
                <>
                  {s.topProducts.join(", ")}
                  {s.products > s.topProducts.length && ` y ${s.products - s.topProducts.length} más`}
                </>
              )}
            </td>
            <td>{formatDay(s.lastPurchase)}</td>
            <td className="tabular-nums">
              {dec(s.balance).gt(0) ? money(s.balance) : "—"}
              {dec(s.overdue).gt(0) && (
                <div>
                  <Badge tone="red">vencido {money(s.overdue)}</Badge>
                </div>
              )}
            </td>
            <td className="text-right">
              <Link href={`/compras/proveedores/${s.id}`} className="text-sm text-brand-600 hover:underline">
                Ver ficha
              </Link>
            </td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}
