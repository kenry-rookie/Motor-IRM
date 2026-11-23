"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

import { PrintLink } from "~/app/_components/print-link";
import { Alert, BackBar, Badge, Button, Card, Dialog, Field, Input, PageTitle, Select, Table, Textarea } from "~/app/_components/ui";
import { docNo, invoiceNo } from "~/lib/business";
import { errorMessage } from "~/lib/errors";
import { dec, formatDateTime, formatDay, money } from "~/lib/format";
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
        crumbs={[{ label: "Facturas", href: "/facturas" }, { label: `Factura ${invoiceNo(d)}` }]}
        back={{ href: "/facturas", label: "Volver a facturas" }}
      />
      <PageTitle
        title={`Factura ${invoiceNo(d)}`}
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
          {d.serviceOrderId && <Badge tone="blue">Orden de taller {docNo("orden", d.serviceOrderId)}</Badge>}
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
          {dec(d.refunded).gt(0) && (
            <>
              <dt className="text-neutral-400">Se le devolvió en efectivo</dt>
              <dd className="text-right">− {money(d.refunded)}</dd>
            </>
          )}
          <dt className="font-semibold">Saldo</dt>
          <dd className="text-right font-semibold">{money(d.balance)}</dd>
        </dl>
      </Card>
      {d.returns.length > 0 && (
        <Card title="Devoluciones" className="mt-4">
          <Table head={["N.º", "Fecha", "Motivo", "Unidades", "Efectivo devuelto", "Nota"]}>
            {d.returns.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap">{docNo("devolucion", r.id)}</td>
                <td>{formatDateTime(r.returnedAt)}</td>
                <td>{r.returnReason.name}</td>
                <td className="tabular-nums">{r.lines.reduce((a, x) => a + x.quantity, 0)}</td>
                <td className="tabular-nums">{dec(r.refundAmount).gt(0) ? money(r.refundAmount) : "—"}</td>
                <td className="text-neutral-400">{r.notes ?? "—"}</td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
      <Dialog open={voiding} onClose={() => setVoiding(false)} title={`Anular la factura ${invoiceNo(d)}`}>
        <VoidForm
          invoiceId={d.id}
          paid={dec(d.paid).minus(dec(d.refunded)).toString()}
          hasProducts={d.lines.some((l) => l.lineType === "PRODUCTO" && l.quantity > l.returnedQuantity)}
          fromWorkshop={!!d.serviceOrderId}
          onDone={() => setVoiding(false)}
        />
      </Dialog>
      <Dialog open={returning} onClose={() => setReturning(false)} title={`Devolución de la factura ${invoiceNo(d)}`}>
        <ReturnForm
          invoiceId={d.id}
          balance={d.balance.toString()}
          lines={d.lines
            .filter((l) => l.lineType === "PRODUCTO")
            .map((l) => ({
              id: l.id,
              name: l.product?.name ?? "",
              available: l.quantity - l.returnedQuantity,
              unitNet: dec(l.net).div(l.quantity).toString(),
            }))}
          onDone={() => setReturning(false)}
        />
      </Dialog>
    </>
  );
}

/**
 * CLI-011 — Pick lines and quantities to return; the API validates sold − already
 * returned. If the customer had paid more than what they owe after the return,
 * the cash given back is part of the return (DEC-057): it shows in the arqueo as
 * «Reembolsos por devoluciones», not as a cash withdrawal.
 */
function ReturnForm({
  invoiceId,
  balance,
  lines,
  onDone,
}: {
  invoiceId: number;
  balance: string;
  lines: { id: number; name: string; available: number; unitNet: string }[];
  onDone: () => void;
}) {
  const utils = api.useUtils();
  const reasons = api.admin.catalog.useQuery({ kind: "returnReason", onlyActive: true });
  const [qty, setQty] = useState<Record<number, string>>({});
  const [reasonId, setReasonId] = useState(0);
  const [refund, setRefund] = useState<string | null>(null);
  const ret = api.sales.createReturn.useMutation({
    onSuccess: () => {
      void utils.sales.invalidate();
      void utils.inventory.invalidate();
      void utils.cash.invalidate();
      void utils.customer.invalidate();
      onDone();
    },
  });
  const chosen = Object.entries(qty)
    .map(([id, q]) => ({ saleInvoiceLineId: Number(id), quantity: Number(q) }))
    .filter((x) => x.quantity > 0);
  // Same rounding as v_invoice_balance: each line's returned value is rounded to cents.
  const value = chosen.reduce((a, c) => {
    const l = lines.find((x) => x.id === c.saleInvoiceLineId);
    return l ? a.plus(dec(l.unitNet).times(c.quantity).toDecimalPlaces(2)) : a;
  }, dec(0));
  const after = dec(balance).minus(value);
  const owed = after.lt(0) ? after.neg() : dec(0);
  const refundValue = refund ?? owed.toFixed(2);
  const tooMuch = dec(refundValue).gt(owed);
  return (
    <div className="space-y-3">
      <Table head={["Producto", "Se puede devolver", "Cantidad"]}>
        {lines.map((l) => (
          <tr key={l.id}>
            <td>{l.name}</td>
            <td>{l.available}</td>
            <td>
              <Input
                inputMode="numeric"
                className="w-20"
                disabled={l.available === 0}
                value={qty[l.id] ?? ""}
                onChange={(e) => {
                  setQty({ ...qty, [l.id]: e.target.value });
                  setRefund(null);
                }}
              />
            </td>
          </tr>
        ))}
      </Table>
      <Select value={reasonId} onChange={(e) => setReasonId(Number(e.target.value))}>
        <option value={0}>Motivo…</option>
        {reasons.data
          // «Anulación de factura» is only for the «Anular factura» button.
          ?.filter((r) => r.name.trim().toLowerCase() !== "anulación de factura")
          .map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
      </Select>
      {chosen.length > 0 && (
        <div className="space-y-2 rounded-md border border-neutral-800 p-3 text-sm">
          <p>
            Valor de lo devuelto: <b className="tabular-nums">{money(value)}</b>
          </p>
          {owed.gt(0) ? (
            <>
              <p className="text-neutral-400">El cliente ya había pagado: se le deben {money(owed)}.</p>
              <Field label="Efectivo que se le devuelve ahora (C$)" hint="Sale de la caja (necesita la caja abierta). 0 si no se le da dinero.">
                <Input inputMode="decimal" value={refundValue} onChange={(e) => setRefund(e.target.value)} />
              </Field>
              {tooMuch && <p className="text-bad-fg text-xs">No puede ser más de {money(owed)}.</p>}
            </>
          ) : (
            <p className="text-neutral-400">No hay dinero que devolver: lo devuelto baja lo que el cliente debe ({money(after)} quedan por pagar).</p>
          )}
        </div>
      )}
      <Alert>{ret.error && errorMessage(ret.error)}</Alert>
      <Button
        className="w-full"
        disabled={!reasonId || chosen.length === 0 || ret.isPending || tooMuch}
        onClick={() =>
          ret.mutate({ saleInvoiceId: invoiceId, returnReasonId: reasonId, lines: chosen, refundAmount: owed.gt(0) ? dec(refundValue).toFixed(2) : "0" })
        }
      >
        {owed.gt(0) && dec(refundValue).gt(0) ? `Registrar devolución y entregar ${money(refundValue)}` : "Registrar devolución"}
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
