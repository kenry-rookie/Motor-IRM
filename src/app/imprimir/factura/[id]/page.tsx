"use client";

import { useParams } from "next/navigation";

import { InfoGrid, PrintToolbar, Sheet, SheetFooter, SheetHeader, Signatures, useAutoPrint } from "~/app/imprimir/print-kit";
import { BUSINESS, docNumber } from "~/lib/business";
import { errorMessage } from "~/lib/errors";
import { dec, formatDateTime, formatDay, money } from "~/lib/format";
import { api } from "~/trpc/react";

/**
 * DEC-053 — The invoice on paper: business header, customer (and motorcycle for a
 * workshop bill), lines, totals and, on credit, the due date, balance and the
 * customer's signature. Opened from Caja after charging, or from the invoice.
 */
export default function PrintInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const inv = api.sales.getInvoice.useQuery({ id: Number(id) });
  useAutoPrint(!!inv.data, inv.error ? errorMessage(inv.error) : null);

  if (inv.error) return <p className="p-8 text-center text-[#a3161f]">{errorMessage(inv.error)}</p>;
  const d = inv.data;
  if (!d) return <p className="p-8 text-center text-[#555]">Cargando la factura…</p>;

  const credit = d.paymentTerms === "CREDITO";
  const gross = d.lines.reduce((a, l) => a.plus(dec(l.unitPrice).times(l.quantity)), dec(0));
  const discounts = d.lines.reduce((a, l) => a.plus(dec(l.discountAmount)), dec(0));
  const hasDiscount = discounts.gt(0);
  const moto = d.serviceOrder?.motorcycle;
  const payments = d.paymentAllocations.map((a) => a.customerPayment);

  return (
    <>
      <PrintToolbar backHref={`/ventas/${d.id}`} backLabel="Volver a la factura" />
      <Sheet>
        {d.void && (
          <div
            aria-label="Factura anulada"
            className="pointer-events-none fixed top-1/3 left-1/2 z-10 -translate-x-1/2 -rotate-12 rounded-lg border-8 border-[#c8202a]/70 px-10 py-3 font-display text-7xl font-bold tracking-widest text-[#c8202a]/70"
          >
            ANULADA
          </div>
        )}
        <SheetHeader
          title="Factura"
          number={d.invoiceNumber ?? docNumber(d.id)}
          rows={[
            ["Fecha", formatDateTime(d.createdAt)],
            ["Condición", credit ? "CRÉDITO" : "CONTADO"],
            ...(credit && d.dueDate ? ([["Vence", formatDay(d.extendedDueDate ?? d.dueDate)]] as [string, string][]) : []),
          ]}
        />

        <InfoGrid
          items={[
            ["Cliente", d.customer?.name ?? "Cliente de contado"],
            ["Teléfono", d.customer?.phone ?? "—"],
            ...(d.customer?.nationalId ? ([["Cédula", d.customer.nationalId]] as [string, string][]) : []),
            ...(d.customer?.address ? ([["Dirección", d.customer.address]] as [string, string][]) : []),
            ...(moto
              ? ([
                  ["Moto", `${moto.model.brand.name} ${moto.model.name} ${moto.color}`],
                  ["Placa", moto.plate ?? "sin placa"],
                  ["Orden", `#${d.serviceOrder!.id}`],
                  ...(d.serviceOrder!.odometerKm != null
                    ? ([["Kilometraje", `${d.serviceOrder!.odometerKm.toLocaleString("es-NI")} km`]] as [string, string][])
                    : []),
                ] as [string, string][])
              : []),
          ]}
        />

        <table className="mt-5 w-full border-collapse">
          <thead>
            <tr className="border-y-2 border-[#111] text-left text-xs uppercase">
              <th className="w-14 py-1.5 text-center">Cant.</th>
              <th className="py-1.5">Descripción</th>
              <th className="w-28 py-1.5 text-right">P. unitario</th>
              {hasDiscount && <th className="w-24 py-1.5 text-right">Descuento</th>}
              <th className="w-28 py-1.5 text-right">Importe</th>
            </tr>
          </thead>
          <tbody>
            {d.lines.map((l) => (
              <tr key={l.id} className="border-b border-[#dde1e6] align-top">
                <td className="py-1.5 text-center tabular-nums">{l.quantity}</td>
                <td className="py-1.5">
                  {l.product?.name ?? l.description ?? l.serviceType?.name}
                  {l.lineType === "MANO_OBRA" && <span className="ml-1 text-xs text-[#555]">(mano de obra)</span>}
                  {l.lineType === "CARGO_EXTERNO" && <span className="ml-1 text-xs text-[#555]">(trabajo externo)</span>}
                </td>
                <td className="py-1.5 text-right tabular-nums">{money(l.unitPrice)}</td>
                {hasDiscount && <td className="py-1.5 text-right tabular-nums">{dec(l.discountAmount).gt(0) ? `−${money(l.discountAmount)}` : ""}</td>}
                <td className="py-1.5 text-right font-medium tabular-nums">{money(l.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex justify-between gap-8">
          <div className="text-xs text-[#444]">
            {!credit && payments.length > 0 && (
              <p>
                Pagado con:{" "}
                {payments
                  .map((p) => `${p.paymentMethod.name} ${p.currency === "USD" ? `${money(p.amount, "USD")} (T/C ${dec(p.exchangeRate).toFixed(2)})` : ""}`.trim())
                  .join(", ")}
              </p>
            )}
            <p>Atendió: {d.createdBy.username}</p>
            {d.notes && <p>Nota: {d.notes}</p>}
          </div>
          <dl className="w-64 shrink-0 text-sm">
            {hasDiscount && (
              <>
                <Row label="Subtotal" value={money(gross)} />
                <Row label="Descuentos" value={`−${money(discounts)}`} />
              </>
            )}
            <div className="mt-1 flex justify-between border-y-2 border-[#111] py-1.5 text-lg font-bold">
              <dt>TOTAL</dt>
              <dd className="tabular-nums">{money(d.total)}</dd>
            </div>
            {dec(d.returned).gt(0) && <Row label="Devoluciones" value={`−${money(d.returned)}`} />}
            {credit && (
              <>
                <Row label="Abonado" value={money(d.paid)} />
                <div className="flex justify-between pt-1 font-bold">
                  <dt>Saldo pendiente</dt>
                  <dd className="tabular-nums">{money(d.balance)}</dd>
                </div>
              </>
            )}
          </dl>
        </div>

        {credit && (
          <>
            <p className="mt-6 rounded-md border border-[#c9ced5] px-4 py-2 text-xs text-[#333]">
              Recibí la mercadería y los servicios de esta factura al crédito. Me comprometo a pagar el saldo de{" "}
              <span className="font-semibold">{money(d.balance)}</span> a {BUSINESS.name} a más tardar el{" "}
              <span className="font-semibold">{formatDay(d.extendedDueDate ?? d.dueDate)}</span>. Cada abono se entrega con su comprobante.
            </p>
            <Signatures left="Firma del cliente" right="Autorizado por" />
          </>
        )}
        {!credit && <Signatures left="Recibí conforme" right="Entregado por" />}

        {d.void && (
          <p className="mt-4 rounded-md border border-[#c8202a] px-4 py-2 text-xs text-[#a3161f]">
            Anulada el {formatDateTime(d.void.voidedAt)} por {d.void.voidedBy.username}. Motivo: {d.void.reason}.
          </p>
        )}
        <SheetFooter>
          <p>Conserve esta factura: se pide para cualquier cambio o garantía.</p>
        </SheetFooter>
      </Sheet>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-0.5">
      <dt className="text-[#555]">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
