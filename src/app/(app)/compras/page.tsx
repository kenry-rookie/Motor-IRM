"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { PurchaseDetailDialog } from "~/app/(app)/compras/purchase-detail";
import { SupplierForm, SupplierPayment } from "~/app/(app)/compras/supplier-form";
import { TripForm } from "~/app/(app)/compras/viajes/trip-form";
import { Alert, Badge, Button, Card, cx, Dialog, Field, Input, PageTitle, Segmented, Table } from "~/app/_components/ui";
import { docNo } from "~/lib/business";
import { errorMessage } from "~/lib/errors";
import { addDaysISO, dec, formatDateTime, formatDay, money, todayISO } from "~/lib/format";
import { LABELS } from "~/server/domain/constants";
import { api } from "~/trpc/react";

type Tab = "facturas" | "viajes" | "pagos" | "proveedores";
const TABS: [Tab, string][] = [
  ["facturas", "Facturas de compra"],
  ["viajes", "Viajes de compras"],
  ["pagos", "Pagos a proveedores"],
  ["proveedores", "Proveedores"],
];

/**
 * CLI-012 — Purchases: stock entry («Ingreso de mercadería»: one supplier
 * invoice or a whole purchase trip, DEC-059), what we owe, what we paid and
 * the suppliers.
 */
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
  const router = useRouter();
  const initial = TABS.find(([k]) => k === params.get("ver"))?.[0] ?? "facturas";
  const [tab, setTab] = useState<Tab>(initial);
  const [newSupplier, setNewSupplier] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [newTrip, setNewTrip] = useState(false);
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
              <Button onClick={() => setChoosing(true)}>+ Ingreso de mercadería</Button>
            </div>
          )
        }
      />
      {params.get("registrada") && (
        <div className="mb-4">
          <Alert kind="ok">Mercadería ingresada: los productos ya están en el inventario.</Alert>
        </div>
      )}
      <div className="mb-4 flex gap-2" role="tablist">
        {TABS.map(([k, label]) => (
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
      {tab === "facturas" && <Invoices canManage={!!canManage} />}
      {tab === "viajes" && <Trips onNew={canManage ? () => setNewTrip(true) : undefined} />}
      {tab === "pagos" && <Payments />}
      {tab === "proveedores" && <Suppliers />}
      <Dialog open={choosing} onClose={() => setChoosing(false)} title="Ingreso de mercadería">
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/compras/nueva"
            className="flex flex-col gap-1 rounded-xl border border-neutral-700 p-4 hover:border-brand-600 hover:bg-neutral-800"
          >
            <span className="font-display text-lg font-semibold">Factura de un proveedor</span>
            <span className="text-sm text-neutral-400">Llegó mercadería con una factura (el proveedor vino o la mandó). Entra al inventario al registrar.</span>
          </Link>
          <button
            type="button"
            onClick={() => {
              setChoosing(false);
              setNewTrip(true);
            }}
            className="flex flex-col gap-1 rounded-xl border border-neutral-700 p-4 text-left hover:border-brand-600 hover:bg-neutral-800"
          >
            <span className="font-display text-lg font-semibold">Registrar viaje de compras</span>
            <span className="text-sm text-neutral-400">
              Un viaje (a Managua u otro lugar): el dinero que se lleva de la caja, todas las facturas, los gastos del viaje y el vuelto.
            </span>
          </button>
        </div>
      </Dialog>
      <Dialog open={newTrip} onClose={() => setNewTrip(false)} title="Nuevo viaje de compras">
        <TripForm onDone={(id) => router.push(`/compras/viajes/${id}`)} />
      </Dialog>
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
  const [terms, setTerms] = useState<"todas" | "CONTADO" | "CREDITO">("todas");
  // Paged by cursor (50 at a time) with «Cargar más», like the kardex.
  const invoices = api.purchasing.listInvoices.useInfiniteQuery(
    { limit: 50, paymentTerms: terms === "todas" ? undefined : terms },
    { getNextPageParam: (l) => l.nextCursor, initialCursor: null },
  );
  const items = invoices.data?.pages.flatMap((pg) => pg.items) ?? [];
  const [paying, setPaying] = useState<{ supplierId: number; purchaseInvoiceId: number; balance: string } | null>(null);
  const [detail, setDetail] = useState<number | null>(null);
  return (
    <Card>
      <Segmented
        label="Tipo de compra"
        className="mb-3"
        value={terms}
        onChange={setTerms}
        options={[
          { value: "todas", label: "Todas" },
          { value: "CONTADO", label: "Contado" },
          { value: "CREDITO", label: "Crédito" },
        ]}
      />
      {invoices.error && <Alert>{errorMessage(invoices.error)}</Alert>}
      <Table head={["N.º", "Proveedor", "Factura", "Fecha", "Tipo", "Vence", "Total", "Saldo", ""]} empty={!invoices.isLoading && items.length === 0}>
        {items.map((p) => (
          <tr key={p.id} className="cursor-pointer" onClick={() => setDetail(p.id)}>
            <td className="whitespace-nowrap">
              <button type="button" className="text-brand-600 hover:underline" onClick={() => setDetail(p.id)}>
                {docNo("compra", p.id)}
              </button>
              {p.purchaseTripId && <div className="text-xs text-neutral-500">{docNo("viaje", p.purchaseTripId)}</div>}
            </td>
            <td>
              <Link href={`/compras/proveedores/${p.supplier.id}`} className="hover:text-brand-600" onClick={(e) => e.stopPropagation()}>
                {p.supplier.name}
              </Link>
            </td>
            <td>{p.invoiceNumber}</td>
            <td>{formatDay(p.purchaseDate)}</td>
            <td>{p.paymentTerms === "CREDITO" ? "Crédito" : "Contado"}</td>
            <td>{formatDay(p.dueDate)}</td>
            <td className="tabular-nums">{money(p.total)}</td>
            <td className="font-semibold tabular-nums">{money(p.balance)}</td>
            <td className="text-right" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-end gap-1">
                <Button variant="ghost" onClick={() => setDetail(p.id)}>
                  Ver detalle
                </Button>
                {canManage && dec(p.balance).gt(0) && (
                  <Button variant="secondary" onClick={() => setPaying({ supplierId: p.supplier.id, purchaseInvoiceId: p.id, balance: p.balance.toString() })}>
                    Pagar
                  </Button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </Table>
      {invoices.hasNextPage && (
        <Button variant="secondary" className="mt-3" onClick={() => void invoices.fetchNextPage()} disabled={invoices.isFetchingNextPage}>
          Cargar más
        </Button>
      )}
      <Dialog open={!!paying} onClose={() => setPaying(null)} title="Pago a proveedor">
        {paying && <SupplierPayment {...paying} onDone={() => setPaying(null)} />}
      </Dialog>
      <PurchaseDetailDialog id={detail} onClose={() => setDetail(null)} />
    </Card>
  );
}

/** Purchase trips (DEC-059): open ones first; what was taken, bought, spent and what came back. */
function Trips({ onNew }: { onNew?: () => void }) {
  const trips = api.trips.list.useQuery({});
  return (
    <Card actions={onNew && <Button onClick={onNew}>+ Nuevo viaje de compras</Button>} title="Viajes de compras">
      {trips.error && <Alert>{errorMessage(trips.error)}</Alert>}
      <Table
        head={["N.º", "Fecha", "A dónde", "Estado", "Llevado de caja", "Compras", "Gastos", "Debe regresar", "Regresó", ""]}
        empty={!trips.isLoading && trips.data?.length === 0}
      >
        {trips.data?.map((t) => (
          <tr key={t.id}>
            <td className="whitespace-nowrap">
              <Link href={`/compras/viajes/${t.id}`} className="text-brand-600 hover:underline">
                {docNo("viaje", t.id)}
              </Link>
            </td>
            <td>{formatDay(t.tripDate)}</td>
            <td>
              {t.destination}
              {t.traveler && <div className="text-xs text-neutral-500">{t.traveler}</div>}
            </td>
            <td>
              <Badge tone={t.status === "ABIERTO" ? "amber" : "green"}>{LABELS.tripStatus[t.status as "ABIERTO" | "CERRADO"]}</Badge>
            </td>
            <td className="tabular-nums">{money(t.summary.cashTaken)}</td>
            <td className="tabular-nums">
              {money(t.summary.purchasesTotal)}
              <div className="text-xs text-neutral-500">{t.summary.invoices} factura(s)</div>
            </td>
            <td className="tabular-nums">{money(t.summary.expenses)}</td>
            <td className="tabular-nums">{money(t.summary.expectedBack)}</td>
            <td className="tabular-nums">
              {t.summary.cashReturned != null ? money(t.summary.cashReturned) : "—"}
              {t.summary.difference != null && !dec(t.summary.difference).isZero() && (
                <div>
                  <Badge tone={dec(t.summary.difference).lt(0) ? "red" : "amber"}>
                    {dec(t.summary.difference).lt(0) ? "Faltan" : "Sobran"} {money(dec(t.summary.difference).abs())}
                  </Badge>
                </div>
              )}
            </td>
            <td className="text-right">
              <Link href={`/compras/viajes/${t.id}`} className="text-sm text-brand-600 hover:underline">
                Abrir
              </Link>
            </td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}

/** Every payment to suppliers (Kenry: «el pago a proveedores no se registra en ningún lugar»). */
function Payments() {
  const [range, setRange] = useState({ from: addDaysISO(todayISO(), -29), to: todayISO() });
  const [source, setSource] = useState<"todas" | "CAJA" | "FUERA_DE_CAJA" | "VIAJE">("todas");
  const list = api.purchasing.listPayments.useInfiniteQuery(
    { ...range, source: source === "todas" ? undefined : source, limit: 50 },
    { getNextPageParam: (l) => l.nextCursor, initialCursor: null },
  );
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const [detail, setDetail] = useState<number | null>(null);
  return (
    <Card
      title="Pagos a proveedores"
      actions={
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Desde">
            <Input type="date" value={range.from} max={range.to} onChange={(e) => setRange({ ...range, from: e.target.value })} />
          </Field>
          <Field label="Hasta">
            <Input type="date" value={range.to} min={range.from} onChange={(e) => setRange({ ...range, to: e.target.value })} />
          </Field>
        </div>
      }
    >
      <Segmented
        label="Con qué dinero"
        className="mb-3"
        value={source}
        onChange={setSource}
        options={[
          { value: "todas", label: "Todos" },
          { value: "CAJA", label: "De la caja" },
          { value: "FUERA_DE_CAJA", label: "Fuera de caja" },
          { value: "VIAJE", label: "Dinero de viaje" },
        ]}
      />
      {list.error && <Alert>{errorMessage(list.error)}</Alert>}
      <Table head={["N.º", "Fecha", "Proveedor", "Factura", "Monto", "Con qué dinero", "Registró"]} empty={!list.isLoading && items.length === 0}>
        {items.map((p) => (
          <tr key={p.id}>
            <td className="whitespace-nowrap">{docNo("pagoProveedor", p.id)}</td>
            <td>{formatDateTime(p.paidAt)}</td>
            <td>
              <Link href={`/compras/proveedores/${p.supplier.id}`} className="hover:text-brand-600">
                {p.supplier.name}
              </Link>
            </td>
            <td>
              {p.purchaseInvoice ? (
                <button type="button" className="text-brand-600 hover:underline" onClick={() => setDetail(p.purchaseInvoice!.id)}>
                  {p.purchaseInvoice.invoiceNumber}
                </button>
              ) : (
                <span className="text-neutral-500">Saldo anterior</span>
              )}
            </td>
            <td className="tabular-nums">{money(p.amount, p.currency === "USD" ? "USD" : "NIO")}</td>
            <td>
              {LABELS.supplierPaymentSource[p.source as keyof typeof LABELS.supplierPaymentSource] ?? p.source}
              {p.purchaseTrip && (
                <div className="text-xs">
                  <Link href={`/compras/viajes/${p.purchaseTrip.id}`} className="text-brand-600 hover:underline">
                    {docNo("viaje", p.purchaseTrip.id)}
                  </Link>
                </div>
              )}
              {p.notes && <div className="text-xs text-neutral-500">{p.notes}</div>}
            </td>
            <td className="text-neutral-400">{p.registeredBy?.staff?.name ?? p.registeredBy?.username ?? "—"}</td>
          </tr>
        ))}
      </Table>
      {list.hasNextPage && (
        <Button variant="secondary" className="mt-3" onClick={() => void list.fetchNextPage()} disabled={list.isFetchingNextPage}>
          Cargar más
        </Button>
      )}
      <PurchaseDetailDialog id={detail} onClose={() => setDetail(null)} />
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
