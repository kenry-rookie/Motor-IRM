"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  type ChargeLine,
  type CustomerRef,
  type LaborLine,
  newKey,
  type ProductLine,
  type SaleTab,
  type ServiceTab,
  type Tab,
  type TermsDraft,
  useTabs,
} from "~/app/(app)/ventas/tabs-store";
import { confirmDialog } from "~/app/_components/confirm";
import { CustomerPicker, type Product, ProductPicker, type ProductPickerHandle } from "~/app/_components/pickers";
import { PrintPrompt } from "~/app/_components/print-prompt";
import { ServiceCatalogPicker } from "~/app/_components/service-catalog";
import { cleanTerms, TermsForm } from "~/app/_components/terms-form";
import { Alert, Badge, Button, Card, cx, Dialog, EmptyState, Input, Kbd, PageTitle } from "~/app/_components/ui";
import { errorMessage } from "~/lib/errors";
import { docNumber } from "~/lib/business";
import { dec, formatDay, money } from "~/lib/format";
import { LABELS, type ServiceOrderStatus } from "~/server/domain/constants";
import { api } from "~/trpc/react";

/**
 * CLI-006 — Caja. Several bills in progress at once (one tab each): counter sales
 * and motorcycles from the workshop waiting to be charged. Keyboard first:
 *   F2 search product · F8 new sale · F9 charge the open tab.
 * Prices and totals here are a preview: the API recalculates everything.
 */
export default function CajaPage() {
  const me = api.auth.me.useQuery();
  if (!me.data) return <p className="text-neutral-500">Cargando…</p>;
  return <Caja username={me.data.username} perms={me.data.permissions} />;
}

const toLine = (p: Product): ProductLine => ({
  productId: p.id,
  name: p.name,
  listPrice: p.listPrice.toString(),
  stock: p.stock,
  quantity: 1,
  lastCost: p.lastCost?.toString() ?? null,
});

/** Price per unit actually charged: the agreed one when it was lowered (DEC-052). */
const unitPriceOf = (l: ProductLine) => (l.unitPrice !== undefined && dec(l.unitPrice).lt(dec(l.listPrice)) ? dec(l.unitPrice) : dec(l.listPrice));
const lineTotal = (l: ProductLine) => unitPriceOf(l).times(l.quantity);
const lowered = (l: ProductLine) => unitPriceOf(l).lt(dec(l.listPrice));
const linesTotal = (lines: ProductLine[]) => lines.reduce((a, l) => a.plus(lineTotal(l)), dec(0));

function tabTotal(t: Tab, faults = dec(0)) {
  if (t.kind === "sale") return linesTotal(t.lines);
  return linesTotal(t.parts)
    .plus(t.labor.reduce((a, l) => a.plus(dec(l.price || 0)), dec(0)))
    .plus(t.external.reduce((a, l) => a.plus(dec(l.price || 0)), dec(0)))
    .plus(faults);
}

function addProduct(lines: ProductLine[], p: Product) {
  const i = lines.findIndex((l) => l.productId === p.id);
  if (i >= 0) return lines.map((l, j) => (j === i ? { ...l, quantity: l.quantity + 1, stock: p.stock } : l));
  return [...lines, toLine(p)];
}

function Caja({ username, perms }: { username: string; perms: string[] }) {
  const t = useTabs(username);
  const searchRef = useRef<ProductPickerHandle>(null);
  const chargeRef = useRef<() => void>(() => undefined);
  const [receipt, setReceipt] = useState<{ id: number; total: string; label: string } | null>(null);
  const [askPrint, setAskPrint] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  // Always have one ticket open.
  useEffect(() => {
    if (mounted && t.tabs.length === 0) t.newSale();
  }, [mounted, t]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "F8") {
        e.preventDefault();
        t.newSale();
      } else if (e.key === "F9") {
        e.preventDefault();
        chargeRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [t]);

  const onCharged = useCallback(
    (tab: Tab, invoiceId: number, total: string) => {
      setReceipt({ id: invoiceId, total, label: tab.kind === "sale" ? `Venta ${tab.number}` : `Orden #${tab.orderId}` });
      setAskPrint(true);
      t.close(tab.id);
      setTimeout(() => searchRef.current?.focus(), 50);
    },
    [t],
  );

  const active = t.active;

  return (
    <>
      <PageTitle
        title="Caja"
        actions={
          <div className="flex items-center gap-2">
            <PendingOrders onOpen={(orderId, title, customer) => t.openService(orderId, title, customer)} />
            <Button onClick={() => t.newSale()}>
              Nueva venta <Kbd>F8</Kbd>
            </Button>
          </div>
        }
      />

      <div role="tablist" aria-label="Cobros en curso" className="mb-4 flex gap-1 overflow-x-auto border-b border-neutral-700">
        {mounted &&
          t.tabs.map((tab) => {
            const selected = tab.id === active?.id;
            const total = tabTotal(tab);
            const items = tab.kind === "sale" ? tab.lines.length : tab.labor.length + tab.parts.length + tab.external.length;
            return (
              <div
                key={tab.id}
                className={cx(
                  "ticket-tab group flex shrink-0 items-stretch rounded-t-lg border border-b-0",
                  selected ? "-mb-px border-neutral-700 bg-neutral-900" : "border-transparent bg-neutral-800/40 hover:bg-neutral-800/70",
                )}
                aria-selected={selected}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => t.select(tab.id)}
                  className="min-w-36 px-3 py-2 text-left"
                >
                  <span className="flex items-center gap-1.5 text-sm font-medium text-neutral-100">
                    {tab.kind === "service" && <span className="bg-info-fg h-1.5 w-1.5 rounded-full" aria-hidden="true" />}
                    {tab.kind === "sale" ? `Venta ${tab.number}` : `Orden #${tab.orderId}`}
                  </span>
                  <span className="block max-w-44 truncate text-xs text-neutral-500">
                    {tab.kind === "service" ? tab.title : (tab.customer?.name ?? "Cliente de contado")}
                  </span>
                  <span className="font-display block text-base font-semibold text-neutral-50 tabular-nums">
                    {items > 0 ? money(total) : "—"}
                  </span>
                </button>
                {/* The only tab, and empty: closing it would just open another one. */}
                {(t.tabs.length > 1 || items > 0 || tab.kind === "service") && (
                  <button
                    type="button"
                    aria-label={`Cerrar ${tab.kind === "sale" ? `venta ${tab.number}` : `orden ${tab.orderId}`}`}
                    onClick={async () => {
                      if (items > 0 && !(await confirmDialog("Esta pestaña tiene productos. ¿Descartarla sin cobrar?", { title: "Cerrar pestaña", confirmLabel: "Sí, descartar", danger: true }))) return;
                      t.close(tab.id);
                    }}
                    className="px-2 text-neutral-500 opacity-60 hover:text-neutral-100 group-hover:opacity-100"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
      </div>

      {receipt && (
        <div className="mb-4">
          <Alert kind="ok">
            {receipt.label} cobrada: {money(receipt.total)}.{" "}
            <Link className="font-medium underline" href={`/ventas/${receipt.id}`}>
              Ver la factura N.º {docNumber(receipt.id)}
            </Link>
          </Alert>
        </div>
      )}
      <PrintPrompt
        open={askPrint && !!receipt}
        title="Cobro registrado"
        message={receipt ? `${receipt.label} cobrada: ${money(receipt.total)}. ¿El cliente quiere factura impresa?` : ""}
        printLabel="Imprimir factura"
        href={receipt ? `/imprimir/factura/${receipt.id}?imprimir=1` : ""}
        onClose={() => {
          setAskPrint(false);
          setTimeout(() => searchRef.current?.focus(), 50);
        }}
      />

      {mounted && active?.kind === "sale" && (
        <SaleTicket
          key={active.id}
          tab={active}
          perms={perms}
          searchRef={searchRef}
          chargeRef={chargeRef}
          update={(patch) => t.update(active.id, (x) => ({ ...(x as SaleTab), ...patch }))}
          onCharged={onCharged}
        />
      )}
      {mounted && active?.kind === "service" && (
        <ServiceTicket
          key={active.id}
          tab={active}
          perms={perms}
          searchRef={searchRef}
          chargeRef={chargeRef}
          update={(patch) => t.update(active.id, (x) => ({ ...(x as ServiceTab), ...patch }))}
          onCharged={onCharged}
        />
      )}
    </>
  );
}

/* ───────────── Motos esperando cobro ───────────── */

const READY: ServiceOrderStatus[] = ["TERMINADA", "EN_PRUEBA"];

function PendingOrders({ onOpen }: { onOpen: (orderId: number, title: string, customer: CustomerRef) => void }) {
  const [open, setOpen] = useState(false);
  const orders = api.service.listOrders.useQuery({ limit: 100 });
  const items = [...(orders.data?.items ?? [])].sort(
    (a, b) => Number(READY.includes(b.status)) - Number(READY.includes(a.status)) || a.id - b.id,
  );
  const ready = items.filter((o) => READY.includes(o.status)).length;
  return (
    <div className="relative">
      <Button variant="secondary" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        Cobrar moto del taller {ready > 0 && <Badge tone="green">{ready} lista{ready > 1 ? "s" : ""}</Badge>}
      </Button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-[min(420px,calc(100vw-2rem))] rounded-xl border border-neutral-700 bg-neutral-900 p-2 shadow-xl shadow-neutral-50/10">
          {items.length === 0 && <p className="p-3 text-sm text-neutral-500">No hay motos abiertas en el taller.</p>}
          <ul className="max-h-96 overflow-y-auto">
            {items.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-neutral-800/60"
                  onClick={() => {
                    onOpen(
                      o.id,
                      `${o.motorcycle.model.brand.name} ${o.motorcycle.model.name}${o.motorcycle.plate ? ` · ${o.motorcycle.plate}` : ""}`,
                      { id: o.motorcycle.customer.id, name: o.motorcycle.customer.name, phone: o.motorcycle.customer.phone },
                    );
                    setOpen(false);
                  }}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      #{o.id} · {o.motorcycle.customer.name}
                    </span>
                    <span className="block truncate text-xs text-neutral-500">
                      {o.motorcycle.model.brand.name} {o.motorcycle.model.name} · {o.mechanic?.name ?? "sin mecánico"}
                    </span>
                  </span>
                  <Badge tone={READY.includes(o.status) ? "green" : "neutral"}>{LABELS.serviceStatus[o.status]}</Badge>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ───────────── Piezas compartidas de un ticket ───────────── */

type TicketProps<T extends Tab> = {
  tab: T;
  perms: string[];
  searchRef: React.RefObject<ProductPickerHandle | null>;
  chargeRef: React.RefObject<() => void>;
  update: (patch: Partial<T>) => void;
  onCharged: (tab: Tab, invoiceId: number, total: string) => void;
};

function ProductLines({
  lines,
  canSeeCost,
  onChange,
}: {
  lines: ProductLine[];
  canSeeCost: boolean;
  onChange: (lines: ProductLine[]) => void;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const set = (i: number, patch: Partial<ProductLine>) => onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  if (lines.length === 0) return null;
  return (
    <ul className="divide-y divide-neutral-800">
      {lines.map((l, i) => {
        const low = lowered(l);
        return (
          <li key={l.productId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_7rem]">
            <div className="min-w-0">
              <p className="text-base leading-tight font-semibold text-neutral-50">{l.name}</p>
              <p className={cx("mt-0.5 text-xs", l.quantity > l.stock ? "text-bad-fg" : "text-neutral-500")}>
                {l.quantity > l.stock ? `Solo hay ${l.stock} en stock` : `${l.stock} en stock`}
              </p>
            </div>
            <div className="flex items-center gap-1" aria-label={`Cantidad de ${l.name}`}>
              <button
                type="button"
                className="grid h-8 w-8 place-items-center rounded-md border border-neutral-700 hover:bg-neutral-800"
                aria-label="Quitar uno"
                onClick={() => (l.quantity > 1 ? set(i, { quantity: l.quantity - 1 }) : onChange(lines.filter((_, j) => j !== i)))}
              >
                −
              </button>
              <input
                type="number"
                min={1}
                aria-label="Cantidad"
                className="focus:border-brand-500 h-8 w-12 rounded-md border border-neutral-700 bg-neutral-900 text-center text-sm tabular-nums focus:outline-none"
                value={l.quantity}
                onChange={(e) => set(i, { quantity: Math.max(1, Number(e.target.value) || 1) })}
              />
              <button
                type="button"
                className="grid h-8 w-8 place-items-center rounded-md border border-neutral-700 hover:bg-neutral-800"
                aria-label="Agregar uno"
                onClick={() => set(i, { quantity: l.quantity + 1 })}
              >
                +
              </button>
            </div>
            <div className="relative">
              <button
                type="button"
                title="Doble clic para cambiar el precio"
                aria-label={`Precio de ${l.name}: ${money(unitPriceOf(l))}. Doble clic para cambiarlo.`}
                onDoubleClick={() => setEditing(i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setEditing(i);
                }}
                className={cx(
                  "flex h-10 min-w-28 flex-col items-end justify-center rounded-md border px-2.5 text-right tabular-nums select-none",
                  low ? "border-ok-line bg-ok-bg" : "border-neutral-700 bg-neutral-900 hover:border-neutral-600",
                )}
              >
                {low && <span className="text-[11px] leading-none text-neutral-500 line-through">{money(l.listPrice)}</span>}
                <span className={cx("text-sm leading-tight font-medium", low && "text-ok-fg")}>{money(unitPriceOf(l))}</span>
              </button>
              {editing === i && (
                <PriceEditor
                  line={l}
                  canSeeCost={canSeeCost}
                  onClose={() => setEditing(null)}
                  onApply={(unitPrice) => {
                    set(i, { unitPrice });
                    setEditing(null);
                  }}
                />
              )}
            </div>
            <p className="col-span-2 text-right text-base font-semibold tabular-nums sm:col-span-1">{money(lineTotal(l))}</p>
          </li>
        );
      })}
    </ul>
  );
}

const SUGGESTED_DISCOUNTS = [2, 3, 5] as const;

/**
 * DEC-052 — Small panel to lower the price of one line: 2 %, 3 % or 5 % as
 * suggestions, or a price typed by hand. Never more than the list price, never
 * below the last cost (the server and trigger tg_sale_invoice_line_min_price
 * check it again).
 */
function PriceEditor({
  line,
  canSeeCost,
  onApply,
  onClose,
}: {
  line: ProductLine;
  canSeeCost: boolean;
  onApply: (unitPrice: string | undefined) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const list = dec(line.listPrice);
  const floor = dec(line.lastCost ?? 0);
  const [typed, setTyped] = useState(lowered(line) ? unitPriceOf(line).toFixed(2) : "");
  const typedValue = dec(typed);
  const typedError = !typed
    ? null
    : typedValue.gt(list)
      ? "No puede ser mayor que el precio normal."
      : typedValue.lt(floor)
        ? canSeeCost
          ? `No puede bajar de ${money(floor)} (costo).`
          : "Ese precio queda por debajo del costo."
        : typedValue.lte(0)
          ? "Escriba un precio."
          : null;

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const apply = (v: ReturnType<typeof dec>) => onApply(v.gte(list) ? undefined : v.toFixed(2));

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Cambiar el precio de ${line.name}`}
      className="absolute right-0 z-30 mt-2 w-72 space-y-3 rounded-xl border border-neutral-700 bg-neutral-900 p-3 shadow-xl shadow-neutral-50/10"
    >
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-neutral-400">Precio normal</span>
        <span className="font-medium tabular-nums">{money(list)}</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {SUGGESTED_DISCOUNTS.map((pct) => {
          const v = list.times(100 - pct).div(100).toDecimalPlaces(2);
          const blocked = v.lt(floor);
          return (
            <button
              key={pct}
              type="button"
              disabled={blocked}
              onClick={() => apply(v)}
              title={blocked ? "Quedaría por debajo del costo" : undefined}
              className="hover:border-brand-500 flex flex-col items-center rounded-lg border border-neutral-700 px-1 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="font-semibold">−{pct} %</span>
              <span className="text-xs text-neutral-400 tabular-nums">{money(v)}</span>
            </button>
          );
        })}
      </div>
      <form
        className="flex items-start gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (typed && !typedError) apply(typedValue);
        }}
      >
        <div className="flex-1">
          <Input autoFocus aria-label="Otro precio" placeholder="Otro precio C$" inputMode="decimal" className="h-9" value={typed} onChange={(e) => setTyped(e.target.value)} />
          {typedError && <p className="text-bad-fg mt-1 text-xs">{typedError}</p>}
        </div>
        <Button type="submit" className="h-9" disabled={!typed || !!typedError}>
          Aplicar
        </Button>
      </form>
      {canSeeCost && floor.gt(0) && <p className="text-xs text-neutral-500">Mínimo: {money(floor)} (último costo)</p>}
      {lowered(line) && (
        <button type="button" className="text-brand-600 text-xs font-medium hover:underline" onClick={() => onApply(undefined)}>
          Volver al precio normal
        </button>
      )}
    </div>
  );
}

function ChargePanel({
  title,
  total,
  children,
  error,
  pending,
  disabled,
  onCharge,
  cta,
  confirm,
}: {
  title: string;
  total: ReturnType<typeof dec>;
  children: React.ReactNode;
  error: unknown;
  pending: boolean;
  disabled: boolean;
  /** Opens the «Realizar cobro» confirmation (the invoice is only created there). */
  onCharge: () => void;
  cta: string;
  confirm: ConfirmProps;
}) {
  return (
    <Card title={title} className="lg:sticky lg:top-20">
      <div className="space-y-4">
        {children}
        <div className="flex items-end justify-between border-t border-dashed border-neutral-700 pt-4">
          <span className="text-sm text-neutral-400">Total a cobrar</span>
          <span className="font-display text-4xl font-semibold tracking-tight text-neutral-50 tabular-nums">{money(total)}</span>
        </div>
        <Alert>{error && !confirm.open ? errorMessage(error) : null}</Alert>
        <Button className="h-12 w-full text-base" disabled={disabled || pending} onClick={onCharge}>
          {cta} <Kbd>F9</Kbd>
        </Button>
      </div>
      <ConfirmCharge {...confirm} total={total} pending={pending} error={error} />
    </Card>
  );
}

type ConfirmProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  customer: string;
  terms: TermsDraft;
  items: number;
};

/**
 * DEC-054 — «Realizar cobro»: nothing is billed until the person confirms.
 * «Cancelar» goes back to the ticket as it was, to keep adding or editing.
 */
function ConfirmCharge({
  open,
  onCancel,
  onConfirm,
  customer,
  terms,
  items,
  total,
  pending,
  error,
}: ConfirmProps & { total: ReturnType<typeof dec>; pending: boolean; error: unknown }) {
  const methods = api.admin.catalog.useQuery({ kind: "paymentMethod" });
  const method = methods.data?.find((m) => m.id === terms.payment?.paymentMethodId)?.name;
  const how =
    terms.paymentTerms === "CREDITO"
      ? `Crédito${terms.dueDate ? ` · vence ${formatDay(terms.dueDate)}` : ""}`
      : `Contado${method ? ` · ${method}` : ""}${terms.payment?.currency === "USD" ? " · en dólares" : ""}`;
  return (
    <Dialog open={open} onClose={() => !pending && onCancel()} title="Realizar cobro">
      <dl className="space-y-2 text-base">
        <div className="flex justify-between gap-4">
          <dt className="text-neutral-400">Cliente</dt>
          <dd className="text-right font-medium">{customer}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-neutral-400">Forma de pago</dt>
          <dd className="text-right font-medium">{how}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-neutral-400">Líneas</dt>
          <dd className="text-right font-medium">{items}</dd>
        </div>
        <div className="flex items-end justify-between gap-4 border-t border-dashed border-neutral-700 pt-3">
          <dt className="text-neutral-400">Total</dt>
          <dd className="font-display text-4xl font-semibold tabular-nums">{money(total)}</dd>
        </div>
      </dl>
      {error ? (
        <div className="mt-3">
          <Alert>{errorMessage(error)}</Alert>
        </div>
      ) : null}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" className="h-11 px-5" disabled={pending} onClick={onCancel}>
          Cancelar
        </Button>
        <Button autoFocus className="h-11 px-6" disabled={pending} onClick={onConfirm}>
          {pending ? "Cobrando…" : "Cobrar"}
        </Button>
      </div>
    </Dialog>
  );
}

const anyLowered = (lines: ProductLine[]) => lines.some(lowered);
/** Only the agreed price travels, and only when lowered; the server recomputes everything. */
const productInput = (lines: ProductLine[]) =>
  lines.map((l) => ({
    productId: l.productId,
    quantity: l.quantity,
    unitPrice: lowered(l) ? unitPriceOf(l).toFixed(2) : undefined,
  }));

/* ───────────── Venta de mostrador ───────────── */

function SaleTicket({ tab, perms, searchRef, chargeRef, update, onCharged }: TicketProps<SaleTab>) {
  const utils = api.useUtils();
  const create = api.sales.create.useMutation({
    onSuccess: (r) => {
      void utils.inventory.invalidate();
      void utils.reports.invalidate();
      onCharged(tab, r.id, r.total.toString());
    },
  });
  const total = linesTotal(tab.lines);
  const needsAuthorization =
    (tab.terms.paymentTerms === "CREDITO" && !perms.includes("ventas.autorizar_credito")) ||
    (anyLowered(tab.lines) && !perms.includes("ventas.autorizar_descuento"));
  const creditWithoutCustomer = tab.terms.paymentTerms === "CREDITO" && !tab.customer;

  const [confirming, setConfirming] = useState(false);
  const charge = () => {
    if (tab.lines.length === 0 || creditWithoutCustomer || create.isPending) return;
    create.reset();
    setConfirming(true);
  };
  const doCharge = () => create.mutate({ terms: cleanTerms(tab.terms, tab.customer?.id), lines: productInput(tab.lines) });
  chargeRef.current = charge;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[1fr_400px]">
      <Card>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <ProductPicker ref={searchRef} onPick={(p) => update({ lines: addProduct(tab.lines, p) })} />
          </div>
          <span className="hidden text-xs text-neutral-500 sm:inline">
            <Kbd>F2</Kbd> buscar
          </span>
        </div>
        <div className="mt-2">
          {tab.lines.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="Ticket vacío">
                Escanee un código de barras o escriba el nombre del producto. Si se equivoca al escribir, el sistema sugiere el más parecido.
              </EmptyState>
            </div>
          ) : (
            <ProductLines lines={tab.lines} canSeeCost={perms.includes("compras.ver")} onChange={(lines) => update({ lines })} />
          )}
        </div>
      </Card>

      <ChargePanel
        title="Cobro"
        total={total}
        error={create.error}
        pending={create.isPending}
        disabled={tab.lines.length === 0 || creditWithoutCustomer}
        onCharge={charge}
        cta="Cobrar"
        confirm={{
          open: confirming,
          onCancel: () => setConfirming(false),
          onConfirm: doCharge,
          customer: tab.customer?.name ?? "Cliente de contado",
          terms: tab.terms,
          items: tab.lines.reduce((a, l) => a + l.quantity, 0),
        }}
      >
        <div>
          <p className="mb-1 text-sm font-medium text-neutral-300">Cliente {tab.terms.paymentTerms === "CONTADO" && <span className="font-normal text-neutral-500">(opcional)</span>}</p>
          <CustomerPicker
            value={tab.customer}
            onChange={(c) => update({ customer: c ? { id: c.id, name: c.name, phone: c.phone } : null })}
          />
        </div>
        <TermsForm
          terms={tab.terms}
          onChange={(terms) => update({ terms })}
          needsAuthorization={needsAuthorization}
          creditBlockedReason={creditWithoutCustomer ? "Elija el cliente para vender al crédito." : null}
        />
      </ChargePanel>
    </div>
  );
}

/* ───────────── Cobro de una orden del taller ───────────── */

function ServiceTicket({ tab, perms, searchRef, chargeRef, update, onCharged }: TicketProps<ServiceTab>) {
  const utils = api.useUtils();
  const order = api.service.get.useQuery({ id: tab.orderId });
  const types = api.admin.serviceTypes.useQuery();
  const close = api.service.close.useMutation({
    onSuccess: (r) => {
      void utils.inventory.invalidate();
      void utils.service.invalidate();
      void utils.reports.invalidate();
      onCharged(tab, r.id, r.total.toString());
    },
  });
  const accepted = order.data?.additionalFaults.filter((f) => f.decision === "ACEPTADA") ?? [];
  const pendingFaults = order.data?.additionalFaults.filter((f) => f.decision === "PENDIENTE") ?? [];
  const faultsTotal = accepted.reduce((a, f) => a.plus(dec(f.proposedPrice ?? 0)), dec(0));
  const total = tabTotal(tab, faultsTotal);
  const closed = order.data && (order.data.status === "ENTREGADA" || order.data.status === "CANCELADA");
  const needsAuthorization =
    (tab.terms.paymentTerms === "CREDITO" && !perms.includes("ventas.autorizar_credito")) ||
    (anyLowered(tab.parts) && !perms.includes("ventas.autorizar_descuento"));
  const empty = tab.labor.length + tab.parts.length + tab.external.length + accepted.length === 0;
  const [addingJob, setAddingJob] = useState(false);
  const typeById = new Map((types.data ?? []).map((t) => [t.id, t]));
  const untyped = tab.labor.some((l) => !l.serviceTypeId);
  // A job without price would be left out of the bill without notice: ask for it instead.
  const unpriced = tab.labor.filter((l) => !dec(l.price).gt(0));

  // The jobs chosen at reception become the labor lines, with their reference price (once).
  useEffect(() => {
    if (!order.data || tab.laborLoaded) return;
    update({
      laborLoaded: true,
      labor: tab.labor.length
        ? tab.labor
        : order.data.items.map((i) => ({
            key: newKey(),
            serviceTypeId: i.serviceType.id,
            description: i.serviceType.name,
            price: i.serviceType.referencePrice?.toString() ?? "",
          })),
    });
  }, [order.data, tab.laborLoaded, tab.labor, update]);

  const setLabor = (labor: LaborLine[]) => update({ labor });
  const setExternal = (external: ChargeLine[]) => update({ external });

  const [confirming, setConfirming] = useState(false);
  const charge = () => {
    if (empty || close.isPending || closed || untyped || unpriced.length > 0) return;
    close.reset();
    setConfirming(true);
  };
  const doCharge = () =>
    close.mutate({
      serviceOrderId: tab.orderId,
      terms: cleanTerms(tab.terms, tab.customer?.id),
      labor: tab.labor.flatMap((l) => (l.serviceTypeId && l.price ? [{ serviceTypeId: l.serviceTypeId, description: l.description, price: l.price }] : [])),
      parts: productInput(tab.parts),
      externalCharges: tab.external.filter((x) => x.description && x.price).map(({ description, price }) => ({ description, price })),
    });
  chargeRef.current = charge;

  const o = order.data;
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[1fr_400px]">
      <div className="space-y-4">
        <Card>
          {o ? (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-display text-2xl font-semibold text-neutral-50">
                  {o.motorcycle.model.brand.name} {o.motorcycle.model.name}{" "}
                  <span className="text-neutral-400">
                    {o.motorcycle.color}
                    {o.motorcycle.plate ? ` · ${o.motorcycle.plate}` : ""}
                  </span>
                </p>
                <p className="text-sm text-neutral-400">
                  {o.motorcycle.customer.name} · {o.motorcycle.customer.phone} · Responsable: {o.mechanic?.name ?? "sin asignar"}
                </p>
                <p className="mt-2 text-sm">{o.requestedWork}</p>
                {o.diagnosis && <p className="mt-1 text-sm text-neutral-400">Diagnóstico: {o.diagnosis}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={READY.includes(o.status) ? "green" : "neutral"}>{LABELS.serviceStatus[o.status]}</Badge>
                <Link href={`/taller/${o.id}`} className="text-sm text-brand-600 hover:underline">
                  Ver orden
                </Link>
              </div>
            </div>
          ) : (
            <p className="text-sm text-neutral-500">Cargando la orden…</p>
          )}
          {closed && <div className="mt-3"><Alert>Esta orden ya está {o?.status === "ENTREGADA" ? "entregada" : "cancelada"}. Cierre la pestaña.</Alert></div>}
          {!o?.mechanicStaffId && o && !closed && (
            <div className="mt-3"><Alert>Asigne un responsable (mecánico o dueño) en la orden antes de cobrarla.</Alert></div>
          )}
          {pendingFaults.length > 0 && (
            <div className="mt-3"><Alert>Hay {pendingFaults.length} falla(s) adicional(es) sin respuesta del cliente. Decídalas en la orden antes de cobrar.</Alert></div>
          )}
        </Card>

        <Card
          title="Mano de obra"
          actions={
            <Button variant="secondary" onClick={() => setAddingJob(true)}>
              + Agregar trabajo
            </Button>
          }
        >
          <ul className="space-y-2">
            {tab.labor.map((l, i) => {
              const t = l.serviceTypeId ? typeById.get(l.serviceTypeId) : undefined;
              const range =
                t?.minPrice || t?.maxPrice
                  ? `Rango: ${t.minPrice ? money(t.minPrice) : "—"} a ${t.maxPrice ? money(t.maxPrice) : "—"} (fuera de él pide clave de dueño)`
                  : null;
              return (
                <li key={l.key} className="grid grid-cols-[1fr_130px_auto] items-start gap-2">
                  <div className="min-h-10 rounded-md border border-neutral-800 bg-neutral-800/30 px-3 py-2 text-sm">
                    <p className="font-medium">{l.description || "Trabajo sin catálogo"}</p>
                    {!l.serviceTypeId && <p className="text-bad-fg text-xs">Quítelo y elíjalo de la lista de trabajos.</p>}
                    {range && <p className="text-xs text-neutral-500">{range}</p>}
                  </div>
                  <Input
                    aria-label={`Precio de ${l.description}`}
                    aria-invalid={!dec(l.price).gt(0)}
                    inputMode="decimal"
                    placeholder="C$"
                    value={l.price} onChange={(e) => setLabor(tab.labor.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />
                  <Button variant="ghost" aria-label={`Quitar ${l.description}`} onClick={() => setLabor(tab.labor.filter((_, j) => j !== i))}>
                    ×
                  </Button>
                </li>
              );
            })}
            {accepted.map((f) => (
              <li key={f.id} className="flex items-center justify-between rounded-md bg-neutral-800/40 px-3 py-2 text-sm">
                <span>Falla adicional aceptada: {f.description}</span>
                <span className="tabular-nums">{money(f.proposedPrice)}</span>
              </li>
            ))}
            {tab.labor.length === 0 && accepted.length === 0 && (
              <li className="text-sm text-neutral-500">Sin mano de obra. Use «+ Agregar trabajo».</li>
            )}
          </ul>
          {unpriced.length > 0 && (
            <p className="text-bad-fg mt-2 text-sm">
              Ponga el precio de {unpriced.map((l) => `«${l.description}»`).join(", ")} antes de cobrar.
            </p>
          )}
        </Card>

        <Dialog open={addingJob} onClose={() => setAddingJob(false)} title={`Trabajos de la orden #${tab.orderId}`} size="xl">
          <ServiceCatalogPicker
            selected={tab.labor.flatMap((l) => (l.serviceTypeId ? [l.serviceTypeId] : []))}
            onToggle={(ty) =>
              setLabor(
                tab.labor.some((l) => l.serviceTypeId === ty.id)
                  ? tab.labor.filter((l) => l.serviceTypeId !== ty.id)
                  : [...tab.labor, { key: newKey(), serviceTypeId: ty.id, description: ty.name, price: ty.referencePrice?.toString() ?? "" }],
              )
            }
          />
          <div className="sticky bottom-0 -mx-4 -mb-4 mt-4 flex items-center justify-between gap-3 border-t border-neutral-800 bg-neutral-900 px-4 py-3">
            <span className="text-sm text-neutral-400">
              {tab.labor.length} trabajo{tab.labor.length === 1 ? "" : "s"} en la cuenta
            </span>
            <Button className="h-11 px-6" onClick={() => setAddingJob(false)}>
              Listo
            </Button>
          </div>
        </Dialog>

        <Card title="Repuestos e insumos">
          <ProductPicker ref={searchRef} autoFocus={false} placeholder="Buscar repuesto o insumo…" onPick={(p) => update({ parts: addProduct(tab.parts, p) })} />
          <ProductLines lines={tab.parts} canSeeCost={perms.includes("compras.ver")} onChange={(parts) => update({ parts })} />
        </Card>

        <Card title="Cargos externos" actions={<Button variant="ghost" onClick={() => setExternal([...tab.external, { key: newKey(), description: "", price: "" }])}>+ Agregar</Button>}>
          {tab.external.length === 0 ? (
            <p className="text-sm text-neutral-500">Torno, soldadura u otro trabajo que se mandó a hacer afuera.</p>
          ) : (
            <ul className="space-y-2">
              {tab.external.map((x, i) => (
                <li key={x.key} className="grid grid-cols-[1fr_120px_auto] gap-2">
                  <Input aria-label="Descripción" value={x.description} onChange={(e) => setExternal(tab.external.map((y, j) => (j === i ? { ...y, description: e.target.value } : y)))} />
                  <Input aria-label="Precio" inputMode="decimal" placeholder="C$" value={x.price} onChange={(e) => setExternal(tab.external.map((y, j) => (j === i ? { ...y, price: e.target.value } : y)))} />
                  <Button variant="ghost" aria-label="Quitar" onClick={() => setExternal(tab.external.filter((_, j) => j !== i))}>
                    ×
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <ChargePanel
        title={`Cobro de la orden #${tab.orderId}`}
        total={total}
        error={close.error}
        pending={close.isPending}
        disabled={empty || !!closed || untyped || unpriced.length > 0}
        onCharge={charge}
        cta="Cobrar y entregar"
        confirm={{
          open: confirming,
          onCancel: () => setConfirming(false),
          onConfirm: doCharge,
          customer: tab.customer?.name ?? "",
          terms: tab.terms,
          items: tab.labor.length + accepted.length + tab.external.length + tab.parts.reduce((a, l) => a + l.quantity, 0),
        }}
      >
        <p className="text-sm text-neutral-400">
          Cliente: <span className="font-medium text-neutral-100">{tab.customer?.name}</span>
        </p>
        <TermsForm terms={tab.terms} onChange={(terms) => update({ terms })} needsAuthorization={needsAuthorization} />
      </ChargePanel>
    </div>
  );
}
