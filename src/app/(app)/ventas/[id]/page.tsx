"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

import { Alert, Badge, Button, Card, Dialog, Input, PageTitle, Select, Table } from "~/app/_components/ui";
import { errorMessage } from "~/lib/errors";
import { formatDateTime, formatDay, money } from "~/lib/format";
import { api } from "~/trpc/react";

/** Invoice detail and printable receipt (CLI-006 "comprobante para imprimir"). */
export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const inv = api.sales.getInvoice.useQuery({ id: Number(id) });
  const me = api.auth.me.useQuery();
  const [returning, setReturning] = useState(false);
  if (inv.error) return <Alert>{errorMessage(inv.error)}</Alert>;
  const d = inv.data;
  if (!d) return <p className="text-neutral-400">Cargando…</p>;
  return (
    <>
      <PageTitle
        title={`Factura #${d.id}${d.invoiceNumber ? ` · ${d.invoiceNumber}` : ""}`}
        subtitle={`${formatDateTime(d.createdAt)} · ${d.customer?.name ?? "Cliente de contado"} · atendió ${d.createdBy.username}`}
        actions={
          <div className="flex gap-2 print:hidden">
            {me.data?.permissions.includes("ventas.devoluciones") && d.lines.some((l) => l.lineType === "PRODUCTO") && (
              <Button variant="secondary" onClick={() => setReturning(true)}>
                Devolución
              </Button>
            )}
            <Button variant="secondary" onClick={() => window.print()}>
              Imprimir
            </Button>
          </div>
        }
      />
      <Card>
        <div className="mb-3 flex flex-wrap gap-2">
          <Badge tone={d.paymentTerms === "CREDITO" ? "amber" : "green"}>{d.paymentTerms === "CREDITO" ? "Crédito" : "Contado"}</Badge>
          {d.dueDate && <Badge>Vence {formatDay(d.extendedDueDate ?? d.dueDate)}</Badge>}
          {d.serviceOrderId && <Badge tone="blue">Orden de taller #{d.serviceOrderId}</Badge>}
        </div>
        <Table head={["#", "Descripción", "Cant.", "Precio", "Desc.", "Total", "Devuelto"]}>
          {d.lines.map((l) => (
            <tr key={l.id}>
              <td>{l.lineNo}</td>
              <td>{l.product?.name ?? l.description}</td>
              <td>{l.quantity}</td>
              <td>{money(l.unitPrice)}</td>
              <td>{money(l.discountAmount)}</td>
              <td>{money(l.net)}</td>
              <td>{l.returnedQuantity || ""}</td>
            </tr>
          ))}
        </Table>
        <dl className="mt-4 ml-auto grid max-w-xs grid-cols-2 gap-1 text-sm">
          <dt className="text-neutral-400">Total</dt>
          <dd className="text-right">{money(d.total)}</dd>
          <dt className="text-neutral-400">Devoluciones</dt>
          <dd className="text-right">{money(d.returned)}</dd>
          <dt className="text-neutral-400">Pagado</dt>
          <dd className="text-right">{money(d.paid)}</dd>
          <dt className="font-semibold">Saldo</dt>
          <dd className="text-right font-semibold">{money(d.balance)}</dd>
        </dl>
      </Card>
      <Dialog open={returning} onClose={() => setReturning(false)} title={`Devolución de la factura #${d.id}`}>
        <ReturnForm
          invoiceId={d.id}
          lines={d.lines
            .filter((l) => l.lineType === "PRODUCTO")
            .map((l) => ({ id: l.id, name: l.product?.name ?? "", available: l.quantity - l.returnedQuantity }))}
          onDone={() => setReturning(false)}
        />
      </Dialog>
    </>
  );
}

/** CLI-011 — Pick lines and quantities to return; the API validates sold − already returned. */
function ReturnForm({ invoiceId, lines, onDone }: { invoiceId: number; lines: { id: number; name: string; available: number }[]; onDone: () => void }) {
  const utils = api.useUtils();
  const reasons = api.admin.catalog.useQuery({ kind: "returnReason" });
  const [qty, setQty] = useState<Record<number, string>>({});
  const [reasonId, setReasonId] = useState(0);
  const ret = api.sales.createReturn.useMutation({
    onSuccess: () => {
      void utils.sales.invalidate();
      void utils.inventory.invalidate();
      onDone();
    },
  });
  const chosen = Object.entries(qty)
    .map(([id, q]) => ({ saleInvoiceLineId: Number(id), quantity: Number(q) }))
    .filter((x) => x.quantity > 0);
  return (
    <div className="space-y-3">
      <Table head={["Producto", "Se puede devolver", "Cantidad"]}>
        {lines.map((l) => (
          <tr key={l.id}>
            <td>{l.name}</td>
            <td>{l.available}</td>
            <td>
              <Input type="number" min={0} max={l.available} className="w-20" disabled={l.available === 0} value={qty[l.id] ?? ""} onChange={(e) => setQty({ ...qty, [l.id]: e.target.value })} />
            </td>
          </tr>
        ))}
      </Table>
      <Select value={reasonId} onChange={(e) => setReasonId(Number(e.target.value))}>
        <option value={0}>Motivo…</option>
        {reasons.data
          ?.filter((r) => r.active)
          .map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
      </Select>
      <Alert kind="info">La devolución baja el saldo de la factura y regresa el producto al inventario. El reembolso en efectivo aún no se registra (Q-011).</Alert>
      <Alert>{ret.error && errorMessage(ret.error)}</Alert>
      <Button className="w-full" disabled={!reasonId || chosen.length === 0 || ret.isPending} onClick={() => ret.mutate({ saleInvoiceId: invoiceId, returnReasonId: reasonId, lines: chosen })}>
        Registrar devolución
      </Button>
    </div>
  );
}
