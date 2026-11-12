"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

import { PrintLink } from "~/app/_components/print-link";
import { Alert, BackBar, Badge, Button, Card, Dialog, Field, Input, PageTitle, Select, Table, Textarea } from "~/app/_components/ui";
import { docNumber } from "~/lib/business";
import { errorMessage } from "~/lib/errors";
import { formatDateTime, formatDay, money } from "~/lib/format";
import { api } from "~/trpc/react";

/** Invoice detail and printable receipt (CLI-006 "comprobante para imprimir"). */
export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const inv = api.sales.getInvoice.useQuery({ id: Number(id) });
  const me = api.auth.me.useQuery();
  const [returning, setReturning] = useState(false);
  const [voiding, setVoiding] = useState(false);
  if (inv.error) return <Alert>{errorMessage(inv.error)}</Alert>;
  const d = inv.data;
  if (!d) return <p className="text-neutral-400">Cargando…</p>;
  const perms = me.data?.permissions ?? [];
  const voided = !!d.void;
  const ageDays = (Date.now() - new Date(d.createdAt).getTime()) / 86_400_000;
  const canVoid = !voided && perms.includes("ventas.anular") && ageDays <= 3;
  return (
    <>
      <BackBar
        crumbs={[{ label: "Facturas", href: "/facturas" }, { label: `Factura N.º ${d.invoiceNumber ?? docNumber(d.id)}` }]}
        back={{ href: "/facturas", label: "Volver a facturas" }}
      />
      <PageTitle
        title={`Factura N.º ${d.invoiceNumber ?? docNumber(d.id)}`}
        subtitle={`${formatDateTime(d.createdAt)} · ${d.customer?.name ?? "Cliente de contado"} · atendió ${d.createdBy.username}`}
        actions={
          <div className="flex gap-2 print:hidden">
            {canVoid && (
              <Button variant="danger" onClick={() => setVoiding(true)}>
                Anular factura
              </Button>
            )}
            {!voided && perms.includes("ventas.devoluciones") && d.lines.some((l) => l.lineType === "PRODUCTO") && (
              <Button variant="secondary" onClick={() => setReturning(true)}>
                Devolución
              </Button>
            )}
            <PrintLink
              href={`/imprimir/factura/${d.id}?imprimir=1`}
              className="bg-brand-600 hover:bg-brand-700 inline-flex items-center rounded-md px-3.5 py-2 text-sm font-medium text-white"
            >
              Imprimir factura
            </PrintLink>
          </div>
        }
      />
      {d.void && (
        <div className="mb-4">
          <Alert>
            <span className="font-semibold">Factura anulada</span> el {formatDateTime(d.void.voidedAt)} por {d.void.voidedBy.username}. Motivo: {d.void.reason}.
            {Number(d.void.refundAmount) > 0 && <> Se devolvieron {money(d.void.refundAmount)} al cliente.</>} Los productos regresaron al inventario.
          </Alert>
        </div>
      )}
      <Card>
        <div className="mb-3 flex flex-wrap gap-2">
          {voided && <Badge tone="red">Anulada</Badge>}
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
      <Dialog open={voiding} onClose={() => setVoiding(false)} title={`Anular la factura N.º ${d.invoiceNumber ?? docNumber(d.id)}`}>
        <VoidForm
          invoiceId={d.id}
          paid={d.paid.toString()}
          hasProducts={d.lines.some((l) => l.lineType === "PRODUCTO" && l.quantity > l.returnedQuantity)}
          fromWorkshop={!!d.serviceOrderId}
          onDone={() => setVoiding(false)}
        />
      </Dialog>
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
          // «Anulación de factura» is only for the «Anular factura» button.
          ?.filter((r) => r.active && r.name.trim().toLowerCase() !== "anulación de factura")
          .map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
      </Select>
      <Alert kind="info">La devolución baja el saldo de la factura y regresa el producto al inventario. Si le devuelve efectivo al cliente, regístrelo en Retiros de caja.</Alert>
      <Alert>{ret.error && errorMessage(ret.error)}</Alert>
      <Button className="w-full" disabled={!reasonId || chosen.length === 0 || ret.isPending} onClick={() => ret.mutate({ saleInvoiceId: invoiceId, returnReasonId: reasonId, lines: chosen })}>
        Registrar devolución
      </Button>
    </div>
  );
}

/**
 * DEC-055 — Void: says what will happen (products back, cash back) and asks the
 * reason. The server checks the owner, the 3 days and the paid commission.
 */
function VoidForm({
  invoiceId,
  paid,
  hasProducts,
  fromWorkshop,
  onDone,
}: {
  invoiceId: number;
  paid: string;
  hasProducts: boolean;
  fromWorkshop: boolean;
  onDone: () => void;
}) {
  const utils = api.useUtils();
  const [reason, setReason] = useState("");
  const voidIt = api.sales.voidInvoice.useMutation({
    onSuccess: () => {
      void utils.sales.invalidate();
      void utils.inventory.invalidate();
      void utils.customer.invalidate();
      void utils.reports.invalidate();
      void utils.staff.invalidate();
      onDone();
    },
  });
  return (
    <div className="space-y-3">
      <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-300">
        <li>La factura queda guardada como «Anulada»; no se borra.</li>
        {hasProducts && <li>Los productos regresan al inventario.</li>}
        {Number(paid) > 0 ? (
          <li>
            Devuelva al cliente <span className="font-semibold">{money(paid)}</span> en efectivo.
          </li>
        ) : (
          <li>No hay dinero que devolver: el saldo de la factura queda en cero.</li>
        )}
        {fromWorkshop && <li>La mano de obra deja de contar para la comisión del mecánico.</li>}
      </ul>
      <Field label="Motivo de la anulación">
        <Textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Por ejemplo: se cobró el producto equivocado" />
      </Field>
      <Alert>{voidIt.error && errorMessage(voidIt.error)}</Alert>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" className="h-11" onClick={onDone}>
          No anular
        </Button>
        <Button
          variant="danger"
          className="h-11"
          disabled={reason.trim().length < 5 || voidIt.isPending}
          onClick={() => voidIt.mutate({ saleInvoiceId: invoiceId, reason })}
        >
          {voidIt.isPending ? "Anulando…" : "Anular factura"}
        </Button>
      </div>
    </div>
  );
}
