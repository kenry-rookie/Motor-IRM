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
  useTabs,
} from "~/app/(app)/ventas/tabs-store";
import { CustomerPicker, type Product, ProductPicker, type ProductPickerHandle } from "~/app/_components/pickers";
import { cleanTerms, TermsForm } from "~/app/_components/terms-form";
import { Alert, Badge, Button, Card, cx, EmptyState, Input, Kbd, PageTitle, Select } from "~/app/_components/ui";
import { errorMessage } from "~/lib/errors";
import { dec, money } from "~/lib/format";
import { LABELS, type ServiceOrderStatus } from "~/server/domain/constants";
import { api, type RouterOutputs } from "~/trpc/react";

type Discount = RouterOutputs["admin"]["discounts"][number];

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
});

function lineDiscount(l: ProductLine, discounts: Discount[] | undefined) {
  const gross = dec(l.listPrice).times(l.quantity);
  if (l.discountId) {
    const d = discounts?.find((x) => x.id === l.discountId);
    if (!d) return dec(0);
    return d.discountType === "PORCENTAJE" ? gross.times(dec(d.value)).toDecimalPlaces(2) : dec(d.value);
  }
  return dec(l.discountAmount ?? 0);
}
const linesTotal = (lines: ProductLine[], discounts: Discount[] | undefined) =>
  lines.reduce((a, l) => a.plus(dec(l.listPrice).times(l.quantity).minus(lineDiscount(l, discounts))), dec(0));

function tabTotal(t: Tab, discounts: Discount[] | undefined, faults = dec(0)) {
  if (t.kind === "sale") return linesTotal(t.lines, discounts);
  return linesTotal(t.parts, discounts)
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
  const discounts = api.admin.discounts.useQuery();
  const searchRef = useRef<ProductPickerHandle>(null);
  const chargeRef = useRef<() => void>(() => undefined);
  const [receipt, setReceipt] = useState<{ id: number; total: string; label: string } | null>(null);
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
        subtitle="Cada pestaña es un cobro en curso: atienda a varios clientes sin perder lo que lleva cada uno."
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
            const total = tabTotal(tab, discounts.data);
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
                <button
                  type="button"
                  aria-label={`Cerrar ${tab.kind === "sale" ? `venta ${tab.number}` : `orden ${tab.orderId}`}`}
                  onClick={() => {
                    if (items > 0 && !window.confirm("Esta pestaña tiene productos. ¿Descartarla sin cobrar?")) return;
                    t.close(tab.id);
                  }}
                  className="px-2 text-neutral-500 opacity-60 hover:text-neutral-100 group-hover:opacity-100"
                >
                  ×
                </button>
              </div>
            );
          })}
      </div>

      {receipt && (
        <div className="mb-4">
          <Alert kind="ok">
            {receipt.label} cobrada: {money(receipt.total)}.{" "}
            <Link className="font-medium underline" href={`/ventas/${receipt.id}`}>
              Ver o imprimir la factura #{receipt.id}
            </Link>
          </Alert>
        </div>
      )}

      {mounted && active?.kind === "sale" && (
        <SaleTicket
          key={active.id}
          tab={active}
          perms={perms}
          discounts={discounts.data}
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
          discounts={discounts.data}
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
  discounts: Discount[] | undefined;
  searchRef: React.RefObject<ProductPickerHandle | null>;
  chargeRef: React.RefObject<() => void>;
  update: (patch: Partial<T>) => void;
  onCharged: (tab: Tab, invoiceId: number, total: string) => void;
};

function ProductLines({
  lines,
  discounts,
  onChange,
}: {
  lines: ProductLine[];
  discounts: Discount[] | undefined;
  onChange: (lines: ProductLine[]) => void;
}) {
  const set = (i: number, patch: Partial<ProductLine>) => onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  if (lines.length === 0) return null;
  return (
    <ul className="divide-y divide-neutral-800">
      {lines.map((l, i) => {
        const disc = lineDiscount(l, discounts);
        return (
          <li key={l.productId} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 py-3 sm:grid-cols-[1fr_auto_auto_auto]">
            <div className="min-w-0">
              <p className="truncate font-medium text-neutral-100">{l.name}</p>
              <p className={cx("text-xs", l.quantity > l.stock ? "text-bad-fg" : "text-neutral-500")}>
                {money(l.listPrice)} c/u · {l.quantity > l.stock ? `solo hay ${l.stock} en stock` : `${l.stock} en stock`}
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
              <Input
                type="number"
                min={1}
                className="h-8 w-14 px-1 text-center"
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
            <div className="col-span-2 flex items-center gap-1 sm:col-span-1">
              <Select
                aria-label="Descuento"
                className="h-8 w-36 py-0 text-xs"
                value={l.discountId ?? (l.discountAmount !== undefined ? "manual" : "")}
                onChange={(e) =>
                  set(i, {
                    discountId: e.target.value && e.target.value !== "manual" ? Number(e.target.value) : undefined,
                    discountAmount: e.target.value === "manual" ? "" : undefined,
                  })
                }
              >
                <option value="">Sin descuento</option>
                {discounts
                  ?.filter((d) => d.active)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                <option value="manual">Monto manual…</option>
              </Select>
              {l.discountAmount !== undefined && !l.discountId && (
                <Input
                  aria-label="Descuento en córdobas"
                  className="h-8 w-20 text-xs"
                  placeholder="C$"
                  inputMode="decimal"
                  value={l.discountAmount}
                  onChange={(e) => set(i, { discountAmount: e.target.value })}
                />
              )}
            </div>
            <div className="text-right">
              <p className="font-medium tabular-nums">{money(dec(l.listPrice).times(l.quantity).minus(disc))}</p>
              {disc.gt(0) && <p className="text-ok-fg text-xs tabular-nums">−{money(disc)}</p>}
            </div>
          </li>
        );
      })}
    </ul>
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
}: {
  title: string;
  total: ReturnType<typeof dec>;
  children: React.ReactNode;
  error: unknown;
  pending: boolean;
  disabled: boolean;
  onCharge: () => void;
  cta: string;
}) {
  return (
    <Card title={title} className="lg:sticky lg:top-20">
      <div className="space-y-4">
        {children}
        <div className="flex items-end justify-between border-t border-dashed border-neutral-700 pt-4">
          <span className="text-sm text-neutral-400">Total a cobrar</span>
          <span className="font-display text-4xl font-semibold tracking-tight text-neutral-50 tabular-nums">{money(total)}</span>
        </div>
        <Alert>{error ? errorMessage(error) : null}</Alert>
        <Button className="h-12 w-full text-base" disabled={disabled || pending} onClick={onCharge}>
          {pending ? "Guardando…" : cta} <Kbd>F9</Kbd>
        </Button>
      </div>
    </Card>
  );
}

const manualDiscount = (lines: ProductLine[]) => lines.some((l) => !l.discountId && dec(l.discountAmount ?? 0).gt(0));
const productInput = (lines: ProductLine[]) =>
  lines.map((l) => ({
    productId: l.productId,
    quantity: l.quantity,
    discountId: l.discountId,
    discountAmount: !l.discountId && l.discountAmount ? l.discountAmount : undefined,
  }));

/* ───────────── Venta de mostrador ───────────── */

function SaleTicket({ tab, perms, discounts, searchRef, chargeRef, update, onCharged }: TicketProps<SaleTab>) {
  const utils = api.useUtils();
  const create = api.sales.create.useMutation({
    onSuccess: (r) => {
      void utils.inventory.invalidate();
      void utils.reports.invalidate();
      onCharged(tab, r.id, r.total.toString());
    },
  });
  const total = linesTotal(tab.lines, discounts);
  const needsAuthorization =
    (tab.terms.paymentTerms === "CREDITO" && !perms.includes("ventas.autorizar_credito")) ||
    (manualDiscount(tab.lines) && !perms.includes("ventas.autorizar_descuento"));
  const creditWithoutCustomer = tab.terms.paymentTerms === "CREDITO" && !tab.customer;

  const charge = () => {
    if (tab.lines.length === 0 || creditWithoutCustomer || create.isPending) return;
    create.mutate({ terms: cleanTerms(tab.terms, tab.customer?.id), lines: productInput(tab.lines) });
  };
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
            <ProductLines lines={tab.lines} discounts={discounts} onChange={(lines) => update({ lines })} />
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
      >
        <div>
          <p className="mb-1 text-sm font-medium text-neutral-300">Cliente {tab.terms.paymentTerms === "CONTADO" && <span className="font-normal text-neutral-500">(opcional)</span>}</p>
          <CustomerPicker
            value={tab.customer ? { ...tab.customer, motorcycles: [], nationalId: null, address: null, exact: true, score: 0 } : null}
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

function ServiceTicket({ tab, perms, discounts, searchRef, chargeRef, update, onCharged }: TicketProps<ServiceTab>) {
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
  const total = tabTotal(tab, discounts, faultsTotal);
  const closed = order.data && (order.data.status === "ENTREGADA" || order.data.status === "CANCELADA");
  const needsAuthorization =
    (tab.terms.paymentTerms === "CREDITO" && !perms.includes("ventas.autorizar_credito")) ||
    (manualDiscount(tab.parts) && !perms.includes("ventas.autorizar_descuento"));
  const empty = tab.labor.length + tab.parts.length + tab.external.length + accepted.length === 0;

  const setLabor = (labor: LaborLine[]) => update({ labor });
  const setExternal = (external: ChargeLine[]) => update({ external });

  const charge = () => {
    if (empty || close.isPending || closed) return;
    close.mutate({
      serviceOrderId: tab.orderId,
      terms: cleanTerms(tab.terms, tab.customer?.id),
      labor: tab.labor.filter((l) => l.description && l.price).map(({ serviceTypeId, description, price }) => ({ serviceTypeId, description, price })),
      parts: productInput(tab.parts),
      externalCharges: tab.external.filter((x) => x.description && x.price).map(({ description, price }) => ({ description, price })),
    });
  };
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
                  {o.motorcycle.customer.name} · {o.motorcycle.customer.phone} · Mecánico: {o.mechanic?.name ?? "sin asignar"}
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
            <div className="mt-3"><Alert>Asigne un mecánico en la orden antes de cobrarla.</Alert></div>
          )}
          {pendingFaults.length > 0 && (
            <div className="mt-3"><Alert>Hay {pendingFaults.length} falla(s) adicional(es) sin respuesta del cliente. Decídalas en la orden antes de cobrar.</Alert></div>
          )}
        </Card>

        <Card title="Mano de obra">
          <ul className="space-y-2">
            {tab.labor.map((l, i) => (
              <li key={l.key} className="grid grid-cols-[1fr_120px_auto] gap-2">
                <Input aria-label="Descripción" value={l.description} onChange={(e) => setLabor(tab.labor.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
                <Input aria-label="Precio" inputMode="decimal" placeholder="C$" value={l.price} onChange={(e) => setLabor(tab.labor.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />
                <Button variant="ghost" aria-label="Quitar" onClick={() => setLabor(tab.labor.filter((_, j) => j !== i))}>
                  ×
                </Button>
              </li>
            ))}
            {accepted.map((f) => (
              <li key={f.id} className="flex items-center justify-between rounded-md bg-neutral-800/40 px-3 py-2 text-sm">
                <span>
                  Falla adicional aceptada: {f.description}
                </span>
                <span className="tabular-nums">{money(f.proposedPrice)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            {types.data
              ?.filter((ty) => ty.active)
              .map((ty) => (
                <Button
                  key={ty.id}
                  variant="secondary"
                  className="py-1.5"
                  onClick={() =>
                    setLabor([...tab.labor, { key: newKey(), serviceTypeId: ty.id, description: ty.name, price: ty.referencePrice?.toString() ?? "" }])
                  }
                >
                  + {ty.name} {ty.referencePrice ? <span className="text-neutral-500">{money(ty.referencePrice)}</span> : null}
                </Button>
              ))}
            <Button variant="ghost" className="py-1.5" onClick={() => setLabor([...tab.labor, { key: newKey(), description: "", price: "" }])}>
              + Otro trabajo
            </Button>
          </div>
        </Card>

        <Card title="Repuestos e insumos">
          <ProductPicker ref={searchRef} autoFocus={false} placeholder="Buscar repuesto o insumo…" onPick={(p) => update({ parts: addProduct(tab.parts, p) })} />
          <ProductLines lines={tab.parts} discounts={discounts} onChange={(parts) => update({ parts })} />
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
        disabled={empty || !!closed}
        onCharge={charge}
        cta="Cobrar y entregar"
      >
        <p className="text-sm text-neutral-400">
          Cliente: <span className="font-medium text-neutral-100">{tab.customer?.name}</span>
        </p>
        <TermsForm terms={tab.terms} onChange={(terms) => update({ terms })} needsAuthorization={needsAuthorization} />
      </ChargePanel>
    </div>
  );
}
