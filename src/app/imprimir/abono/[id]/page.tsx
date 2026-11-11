"use client";

import { useParams } from "next/navigation";

import { InfoGrid, PrintToolbar, Sheet, SheetFooter, SheetHeader, Signatures, useAutoPrint } from "~/app/imprimir/print-kit";
import { docNumber } from "~/lib/business";
import { errorMessage } from "~/lib/errors";
import { dec, formatDateTime, money } from "~/lib/format";
import { api } from "~/trpc/react";

/**
 * DEC-053 — Comprobante de abono: the customer's proof that a credit payment was
 * received — how much, how, which debts it paid and what is still owed.
 */
export default function PrintPaymentPage() {
  const { id } = useParams<{ id: string }>();
  const p = api.sales.getPayment.useQuery({ id: Number(id) });
  useAutoPrint(!!p.data, p.error ? errorMessage(p.error) : null);

  if (p.error) return <p className="p-8 text-center text-[#a3161f]">{errorMessage(p.error)}</p>;
  const d = p.data;
  if (!d) return <p className="p-8 text-center text-[#555]">Cargando el comprobante…</p>;
  const usd = d.currency === "USD";

  return (
    <>
      <PrintToolbar backHref={d.customer ? `/clientes/${d.customer.id}` : "/clientes"} backLabel="Volver al cliente" />
      <Sheet>
        <SheetHeader
          title="Recibo de abono"
          number={docNumber(d.id)}
          rows={[
            ["Fecha", formatDateTime(d.paidAt)],
            ["Forma de pago", d.method],
          ]}
        />

        <InfoGrid
          items={[
            ["Cliente", d.customer?.name ?? "—"],
            ["Teléfono", d.customer?.phone ?? "—"],
            ...(d.customer?.nationalId ? ([["Cédula", d.customer.nationalId]] as [string, string][]) : []),
          ]}
        />

        <div className="mt-6 rounded-md border-2 border-[#111] px-5 py-4 text-center">
          <p className="text-sm text-[#444]">Recibimos de {d.customer?.name ?? "el cliente"} la cantidad de</p>
          <p className="font-display text-4xl font-bold tabular-nums">{money(d.amount, usd ? "USD" : "NIO")}</p>
          {usd && (
            <p className="text-sm text-[#444]">
              Tipo de cambio {dec(d.exchangeRate).toFixed(2)} · equivale a {money(d.amountNio)}
            </p>
          )}
          <p className="mt-1 text-sm text-[#444]">como abono a su cuenta de crédito.</p>
        </div>

        <table className="mt-5 w-full border-collapse">
          <thead>
            <tr className="border-y-2 border-[#111] text-left text-xs uppercase">
              <th className="py-1.5">Se aplicó a</th>
              <th className="w-36 py-1.5 text-right">Abono</th>
              <th className="w-36 py-1.5 text-right">Queda debiendo</th>
            </tr>
          </thead>
          <tbody>
            {d.allocations.map((a) => (
              <tr key={a.id} className="border-b border-[#dde1e6]">
                <td className="py-1.5">{a.saleInvoiceId ? `Factura N.º ${docNumber(a.saleInvoiceId)}` : "Saldo anterior"}</td>
                <td className="py-1.5 text-right tabular-nums">{money(a.amount)}</td>
                <td className="py-1.5 text-right tabular-nums">{a.balanceNow != null ? money(a.balanceNow) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {d.customerBalanceNow != null && (
          <div className="mt-4 ml-auto flex w-72 justify-between border-y-2 border-[#111] py-1.5 text-base font-bold">
            <span>Saldo total pendiente</span>
            <span className="tabular-nums">{money(d.customerBalanceNow)}</span>
          </div>
        )}
        <p className="mt-2 text-right text-xs text-[#555]">Saldo a la fecha de impresión. Recibió: {d.receivedBy}</p>

        <Signatures left="Recibido por" right="Firma del cliente" />
        <SheetFooter>
          <p>Guarde este recibo: es su comprobante de pago.</p>
        </SheetFooter>
      </Sheet>
    </>
  );
}
