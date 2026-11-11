"use client";

import { useState } from "react";

import { type Product, ProductPicker } from "~/app/_components/pickers";
import { Alert, Button, Card, Dialog, Field, Input, PageTitle, Select, Table } from "~/app/_components/ui";
import { errorMessage } from "~/lib/errors";
import { addDaysISO, dec, formatDay, money, todayISO } from "~/lib/format";
import { api } from "~/trpc/react";


/** CLI-012 — Purchases (stock entry), supplier payments and suppliers. */
export default function PurchasesPage() {
  const me = api.auth.me.useQuery();
  const suppliers = api.purchasing.suppliers.useQuery();
  const invoices = api.purchasing.listInvoices.useQuery({ limit: 50 });
  const [creating, setCreating] = useState(false);
  const [newSupplier, setNewSupplier] = useState(false);
  const [paying, setPaying] = useState<{ supplierId: number; purchaseInvoiceId: number; balance: string } | null>(null);
  const canManage = me.data?.permissions.includes("compras.gestionar");
  return (
    <>
      <PageTitle
        title="Compras"
        actions={
          canManage && (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setNewSupplier(true)}>
                Nuevo proveedor
              </Button>
              <Button onClick={() => setCreating(true)}>Registrar compra</Button>
            </div>
          )
        }
      />
      <Card title="Facturas de compra">
        {invoices.error && <Alert>{errorMessage(invoices.error)}</Alert>}
        <Table head={["#", "Proveedor", "Factura", "Fecha", "Tipo", "Vence", "Total", "Saldo", ""]} empty={invoices.data?.items.length === 0}>
          {invoices.data?.items.map((p) => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td>{p.supplier.name}</td>
              <td>{p.invoiceNumber}</td>
              <td>{formatDay(p.purchaseDate)}</td>
              <td>{p.paymentTerms === "CREDITO" ? "Crédito" : "Contado"}</td>
              <td>{formatDay(p.dueDate)}</td>
              <td>{money(p.total)}</td>
              <td className="font-semibold">{money(p.balance)}</td>
              <td>
                {canManage && dec(p.balance).gt(0) && (
                  <Button variant="secondary" onClick={() => setPaying({ supplierId: p.supplier.id, purchaseInvoiceId: p.id, balance: p.balance.toString() })}>
                    Pagar
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </Card>
      <Card title="Proveedores" className="mt-4">
        <ul className="text-sm">
          {suppliers.data?.map((s) => (
            <li key={s.id}>
              {s.name} <span className="text-neutral-500">{s.phone ?? ""}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Dialog open={creating} onClose={() => setCreating(false)} title="Registrar compra">
        <PurchaseForm onDone={() => setCreating(false)} />
      </Dialog>
      <Dialog open={newSupplier} onClose={() => setNewSupplier(false)} title="Nuevo proveedor">
        <SupplierForm onDone={() => setNewSupplier(false)} />
      </Dialog>
      <Dialog open={!!paying} onClose={() => setPaying(null)} title="Pago a proveedor">
        {paying && <SupplierPayment {...paying} onDone={() => setPaying(null)} />}
      </Dialog>
    </>
  );
}

function PurchaseForm({ onDone }: { onDone: () => void }) {
  const utils = api.useUtils();
  const suppliers = api.purchasing.suppliers.useQuery();
  const [f, setF] = useState({ supplierId: 0, invoiceNumber: "", paymentTerms: "CONTADO" as "CONTADO" | "CREDITO", dueDate: addDaysISO(todayISO(), 30), discountAmount: "" });
  const [lines, setLines] = useState<{ product: Product; quantity: string; unitCost: string }[]>([]);
  const create = api.purchasing.createInvoice.useMutation({
    onSuccess: () => {
      void utils.purchasing.invalidate();
      void utils.inventory.invalidate();
      onDone();
    },
  });
  const total = lines.reduce((a, l) => a.plus(dec(l.unitCost || 0).times(Number(l.quantity) || 0)), dec(0)).minus(dec(f.discountAmount || 0));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Proveedor">
          <Select value={f.supplierId} onChange={(e) => setF({ ...f, supplierId: Number(e.target.value) })}>
            <option value={0}>Elegir…</option>
            {suppliers.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="N.º de factura">
          <Input value={f.invoiceNumber} onChange={(e) => setF({ ...f, invoiceNumber: e.target.value })} />
        </Field>
        <Field label="Tipo">
          <Select value={f.paymentTerms} onChange={(e) => setF({ ...f, paymentTerms: e.target.value as "CONTADO" | "CREDITO" })}>
            <option value="CONTADO">Contado</option>
            <option value="CREDITO">Crédito</option>
          </Select>
        </Field>
        {f.paymentTerms === "CREDITO" ? (
          <Field label="Vence">
            <Input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
          </Field>
        ) : (
          <div />
        )}
        <Field label="Descuento de la factura (C$)">
          <Input inputMode="decimal" value={f.discountAmount} onChange={(e) => setF({ ...f, discountAmount: e.target.value })} />
        </Field>
      </div>
      <ProductPicker placeholder="Agregar producto…" onPick={(p) => setLines([...lines, { product: p, quantity: "1", unitCost: "" }])} />
      <Table head={["Producto", "Cantidad", "Costo unit.", ""]}>
        {lines.map((l, i) => (
          <tr key={i}>
            <td>{l.product.name}</td>
            <td>
              <Input type="number" min={1} className="w-20" value={l.quantity} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} />
            </td>
            <td>
              <Input inputMode="decimal" className="w-28" value={l.unitCost} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, unitCost: e.target.value } : x)))} />
            </td>
            <td>
              <Button variant="ghost" onClick={() => setLines(lines.filter((_, j) => j !== i))}>
                ✕
              </Button>
            </td>
          </tr>
        ))}
      </Table>
      <p className="text-right text-lg font-semibold">Total {money(total)}</p>
      <Alert>{create.error && errorMessage(create.error)}</Alert>
      <Button
        className="w-full"
        disabled={!f.supplierId || !f.invoiceNumber || lines.length === 0 || create.isPending}
        onClick={() =>
          create.mutate({
            supplierId: f.supplierId,
            invoiceNumber: f.invoiceNumber,
            paymentTerms: f.paymentTerms,
            dueDate: f.paymentTerms === "CREDITO" ? f.dueDate : undefined,
            discountAmount: f.discountAmount || "0",
            lines: lines.map((l) => ({ productId: l.product.id, quantity: Number(l.quantity), unitCost: l.unitCost || "0" })),
          })
        }
      >
        Registrar compra (entra al inventario)
      </Button>
    </div>
  );
}

function SupplierForm({ onDone }: { onDone: () => void }) {
  const utils = api.useUtils();
  const [f, setF] = useState({ name: "", phone: "", contactPerson: "" });
  const save = api.purchasing.saveSupplier.useMutation({
    onSuccess: () => {
      void utils.purchasing.invalidate();
      onDone();
    },
  });
  return (
    <div className="space-y-3">
      <Field label="Nombre">
        <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </Field>
      <Field label="Teléfono">
        <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
      </Field>
      <Field label="Contacto">
        <Input value={f.contactPerson} onChange={(e) => setF({ ...f, contactPerson: e.target.value })} />
      </Field>
      <Alert>{save.error && errorMessage(save.error)}</Alert>
      <Button className="w-full" disabled={!f.name || save.isPending} onClick={() => save.mutate({ name: f.name, phone: f.phone || undefined, contactPerson: f.contactPerson || undefined })}>
        Guardar
      </Button>
    </div>
  );
}

function SupplierPayment({ supplierId, purchaseInvoiceId, balance, onDone }: { supplierId: number; purchaseInvoiceId: number; balance: string; onDone: () => void }) {
  const utils = api.useUtils();
  const [amount, setAmount] = useState(balance);
  const pay = api.purchasing.registerPayment.useMutation({
    onSuccess: () => {
      void utils.purchasing.invalidate();
      onDone();
    },
  });
  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-400">Saldo: {money(balance)}</p>
      <Field label="Monto (C$)">
        <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <Alert>{pay.error && errorMessage(pay.error)}</Alert>
      <Button className="w-full" disabled={!amount || pay.isPending} onClick={() => pay.mutate({ supplierId, purchaseInvoiceId, amount })}>
        Registrar pago
      </Button>
    </div>
  );
}
