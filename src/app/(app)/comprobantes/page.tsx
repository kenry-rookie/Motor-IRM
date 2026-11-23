"use client";

import Link from "next/link";
import { useState } from "react";

import { PurchaseDetailDialog } from "~/app/(app)/compras/purchase-detail";
import { PrintLink } from "~/app/_components/print-link";
import { Alert, Badge, Button, Card, Dialog, Field, Input, PageTitle, SearchField, Segmented, Select, Stat, Table } from "~/app/_components/ui";
import { docNo, invoiceNo, REF_DOC } from "~/lib/business";
import { errorMessage } from "~/lib/errors";
import { addDaysISO, dec, formatDateTime, formatDay, money, todayISO } from "~/lib/format";
import { LABELS, MONEY_IN_KINDS, MONEY_OUT_KINDS, type MoneyKind } from "~/server/domain/constants";
import { api, type RouterOutputs } from "~/trpc/react";

type Item = RouterOutputs["money"]["list"]["items"][number];

/**
 * Comprobantes (Kenry, 23-nov: «que se puedan ver todos, tener detalles»):
 * every document where money came in or went out — receipts of payments,
 * withdrawals, supplier payments, purchase trips, refunds, mechanics' pay —
 * with its number (R-, RT-, PP-, V-…), who registered it and «Ver detalle».
 */
export default function VouchersPage() {
  const [range, setRange] = useState({ from: addDaysISO(todayISO(), -6), to: todayISO() });
  const [kind, setKind] = useState<MoneyKind | "">("");
  const [drawer, setDrawer] = useState<"TODOS" | "CAJA" | "FUERA">("TODOS");
  const [direction, setDirection] = useState<"TODAS" | "ENTRADA" | "SALIDA">("TODAS");
  const [text, setText] = useState("");
  const list = api.money.list.useQuery({ ...range, kind: kind || undefined, drawer, direction, text: text.trim() || undefined });
  const [open, setOpen] = useState<Item | null>(null);
  const t = list.data?.totals;
  return (
    <>
      <PageTitle
        title="Comprobantes"
        subtitle="Todo el dinero que entró o salió: recibos, retiros, pagos a proveedores, viajes, reembolsos y pagos a mecánicos. Toque uno para ver su detalle."
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Entró a la caja" value={t ? money(t.inDrawer) : "—"} detail="Efectivo de la gaveta" />
        <Stat label="Salió de la caja" value={t ? money(t.outDrawer) : "—"} detail="Efectivo de la gaveta" />
        <Stat label="Entró por otros medios" value={t ? money(t.inOther) : "—"} detail="Transferencia, tarjeta" />
        <Stat label="Pagado fuera de la caja" value={t ? money(t.outOther) : "—"} detail="Dinero del dueño o de viajes" />
      </div>
      <Card>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <SearchField
            className="min-w-72 flex-1"
            label="Buscar comprobante"
            placeholder="Número (R-45, RT-12…), cliente, proveedor o detalle…"
            value={text}
            onValue={setText}
          />
          <Field label="Desde">
            <Input type="date" value={range.from} max={range.to} onChange={(e) => setRange({ ...range, from: e.target.value })} />
          </Field>
          <Field label="Hasta">
            <Input type="date" value={range.to} min={range.from} onChange={(e) => setRange({ ...range, to: e.target.value })} />
          </Field>
          <Field label="Qué fue">
            <Select value={kind} onChange={(e) => setKind(e.target.value as MoneyKind | "")}>
              <option value="">Todo</option>
              <optgroup label="Entradas">
                {MONEY_IN_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {LABELS.moneyKind[k]}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Salidas">
                {MONEY_OUT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {LABELS.moneyKind[k]}
                  </option>
                ))}
              </optgroup>
            </Select>
          </Field>
        </div>
        <div className="mb-3 flex flex-wrap gap-3">
          <Segmented
            label="Entradas o salidas"
            value={direction}
            onChange={setDirection}
            options={[
              { value: "TODAS", label: "Entradas y salidas" },
              { value: "ENTRADA", label: "Solo entradas" },
              { value: "SALIDA", label: "Solo salidas" },
            ]}
          />
          <Segmented
            label="Caja o fuera de caja"
            value={drawer}
            onChange={setDrawer}
            options={[
              { value: "TODOS", label: "Todo" },
              { value: "CAJA", label: "Solo la gaveta" },
              { value: "FUERA", label: "Fuera de la gaveta" },
            ]}
          />
        </div>
        {list.error && <Alert>{errorMessage(list.error)}</Alert>}
        <Table head={["N.º", "Fecha", "Qué fue", "De / para", "Detalle", "Registró", "Entró", "Salió", ""]} empty={!list.isLoading && list.data?.items.length === 0}>
          {list.data?.items.map((i) => {
            const value = money(i.amount, i.currency);
            return (
              <tr key={`${i.refTable}-${i.refId}-${i.direction}`} className="cursor-pointer" onClick={() => setOpen(i)}>
                <td className="whitespace-nowrap font-medium">{numberOf(i)}</td>
                <td className="whitespace-nowrap">{i.occurredAt ? formatDateTime(i.occurredAt) : formatDay(i.day)}</td>
                <td>
                  {i.labels.join(" + ")}
                  {!i.inDrawer && (
                    <div>
                      <Badge tone="blue">{i.method}</Badge>
                    </div>
                  )}
                </td>
                <td>{i.customer?.name ?? i.supplier?.name ?? "—"}</td>
                <td className="max-w-72 text-neutral-400">{i.detail}</td>
                <td className="text-neutral-400">{i.user ?? "—"}</td>
                <td className="text-ok-fg text-right tabular-nums">{i.direction === "ENTRADA" ? value : ""}</td>
                <td className="text-bad-fg text-right tabular-nums">{i.direction === "SALIDA" ? value : ""}</td>
                <td className="text-right">
                  <Button variant="ghost" onClick={() => setOpen(i)}>
                    Ver detalle
                  </Button>
                </td>
              </tr>
            );
          })}
        </Table>
        {list.data?.truncated && <p className="mt-2 text-sm text-neutral-500">Se muestran los 1000 más recientes: acorte las fechas para ver el resto.</p>}
      </Card>
      <VoucherDialog item={open} onClose={() => setOpen(null)} />
    </>
  );
}

/** The number printed on each document, with its prefix. */
function numberOf(i: Item) {
  if (i.refTable === "sale_invoice_void") return invoiceNo({ id: i.refId });
  if (i.refTable === "purchase_trip_expense") return i.tripId ? docNo("viaje", i.tripId) : "—";
  const kind = REF_DOC[i.refTable];
  return kind ? docNo(kind, i.refId) : String(i.refId);
}

function VoucherDialog({ item, onClose }: { item: Item | null; onClose: () => void }) {
  const [purchase, setPurchase] = useState<number | null>(null);
  return (
    <>
      <Dialog open={!!item && purchase === null} onClose={onClose} title={item ? `${numberOf(item)} · ${item.labels.join(" + ")}` : "Comprobante"} size="lg">
        {item && <VoucherDetail item={item} onPurchase={setPurchase} />}
      </Dialog>
      <PurchaseDetailDialog id={purchase} onClose={() => setPurchase(null)} />
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-neutral-800 py-1.5 text-sm">
      <dt className="text-neutral-400">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

/** What each kind of document shows: the common data, plus its own detail and where to go. */
function VoucherDetail({ item: i, onPurchase }: { item: Item; onPurchase: (id: number) => void }) {
  return (
    <div className="space-y-4">
      <dl>
        <Row label="Monto">
          <span className={`font-display text-2xl font-semibold tabular-nums ${i.direction === "ENTRADA" ? "text-ok-fg" : "text-bad-fg"}`}>
            {i.direction === "ENTRADA" ? "+" : "−"} {money(i.amount, i.currency)}
          </span>
          {i.currency === "USD" && <div className="text-xs text-neutral-500">equivale a {money(i.amountNio)}</div>}
        </Row>
        <Row label="Fecha">{i.occurredAt ? formatDateTime(i.occurredAt) : formatDay(i.day)}</Row>
        <Row label="Cómo">{i.inDrawer ? "Efectivo de la gaveta (cuenta en el arqueo)" : `${i.method} (no toca la gaveta)`}</Row>
        {(i.customer ?? i.supplier) && <Row label={i.customer ? "Cliente" : "Proveedor"}>{i.customer?.name ?? i.supplier?.name}</Row>}
        <Row label="Detalle">{i.detail}</Row>
        <Row label="Registró">{i.user ?? "—"}</Row>
      </dl>
      {i.refTable === "customer_payment" && <PaymentDetail id={i.refId} />}
      {i.refTable === "supplier_payment" && <SupplierPaymentDetail id={i.refId} onPurchase={onPurchase} />}
      {i.refTable === "cash_withdrawal" && (
        <p className="text-sm">
          Para corregir o anular este retiro, ábralo en{" "}
          <Link href="/retiros" className="text-brand-600 hover:underline">
            Retiros de caja
          </Link>
          .
        </p>
      )}
      {(i.refTable === "purchase_trip" || i.refTable === "purchase_trip_expense") && i.tripId && (
        <Link href={`/compras/viajes/${i.tripId}`} className="text-brand-600 inline-block text-sm hover:underline">
          Abrir el viaje {docNo("viaje", i.tripId)} →
        </Link>
      )}
      {i.saleInvoiceId && i.refTable !== "customer_payment" && (
        <Link href={`/ventas/${i.saleInvoiceId}`} className="text-brand-600 inline-block text-sm hover:underline">
          Abrir la factura {invoiceNo({ id: i.saleInvoiceId })} →
        </Link>
      )}
      {(i.refTable === "staff_advance" || i.refTable === "staff_payout") && (
        <Link href="/pagos" className="text-brand-600 inline-block text-sm hover:underline">
          Ver en Pago a mecánicos →
        </Link>
      )}
    </div>
  );
}

/** A customer payment: what it paid and what is still owed; reprint the receipt. */
function PaymentDetail({ id }: { id: number }) {
  const q = api.sales.getPayment.useQuery({ id });
  if (q.error) return <Alert>{errorMessage(q.error)}</Alert>;
  const p = q.data;
  if (!p) return <p className="text-sm text-neutral-500">Cargando…</p>;
  return (
    <div className="space-y-2">
      <Table head={["Se aplicó a", "Monto", "Debe ahora"]}>
        {p.allocations.map((a) => (
          <tr key={a.id}>
            <td>
              {a.saleInvoiceId ? (
                <Link href={`/ventas/${a.saleInvoiceId}`} className="text-brand-600 hover:underline">
                  Factura {invoiceNo({ id: a.saleInvoiceId })}
                </Link>
              ) : (
                "Saldo anterior"
              )}
            </td>
            <td className="tabular-nums">{money(a.amount)}</td>
            <td className="tabular-nums">{a.balanceNow != null ? money(a.balanceNow) : "—"}</td>
          </tr>
        ))}
      </Table>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-neutral-400">
          {p.method} · recibió {p.receivedBy}
          {p.customer && dec(p.customerBalanceNow).gt(0) && <> · el cliente debe en total {money(p.customerBalanceNow)}</>}
        </span>
        <div className="flex gap-3">
          {p.customer && (
            <Link href={`/clientes/${p.customer.id}`} className="text-brand-600 hover:underline">
              Ver cliente
            </Link>
          )}
          <PrintLink className="text-brand-600 hover:underline" href={`/imprimir/abono/${p.id}?imprimir=1`}>
            Imprimir recibo
          </PrintLink>
        </div>
      </div>
    </div>
  );
}

function SupplierPaymentDetail({ id, onPurchase }: { id: number; onPurchase: (id: number) => void }) {
  const q = api.purchasing.getPayment.useQuery({ id });
  if (q.error) return <Alert>{errorMessage(q.error)}</Alert>;
  const p = q.data;
  if (!p) return <p className="text-sm text-neutral-500">Cargando…</p>;
  return (
    <dl>
      <Row label="Con qué dinero">{LABELS.supplierPaymentSource[p.source as keyof typeof LABELS.supplierPaymentSource] ?? p.source}</Row>
      <Row label="Pagó">
        {p.purchaseInvoice ? (
          <button type="button" className="text-brand-600 hover:underline" onClick={() => onPurchase(p.purchaseInvoice!.id)}>
            Factura {p.purchaseInvoice.invoiceNumber} ({formatDay(p.purchaseInvoice.purchaseDate)}) — ver detalle
          </button>
        ) : (
          "Saldo anterior al sistema"
        )}
      </Row>
      {p.purchaseTrip && (
        <Row label="Viaje">
          <Link className="text-brand-600 hover:underline" href={`/compras/viajes/${p.purchaseTrip.id}`}>
            {docNo("viaje", p.purchaseTrip.id)} · {p.purchaseTrip.destination}
          </Link>
        </Row>
      )}
      {p.notes && <Row label="Nota">{p.notes}</Row>}
      <Row label="Proveedor">
        <Link className="text-brand-600 hover:underline" href={`/compras/proveedores/${p.supplier.id}`}>
          {p.supplier.name}
        </Link>
      </Row>
    </dl>
  );
}
