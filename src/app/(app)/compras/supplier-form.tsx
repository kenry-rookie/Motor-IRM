"use client";

import { useState } from "react";

import { Alert, Button, cx, Field, Input, PhoneInput, Select } from "~/app/_components/ui";
import { docNo } from "~/lib/business";
import { errorMessage, fieldErrors } from "~/lib/errors";
import { formatDay, money } from "~/lib/format";
import { api } from "~/trpc/react";

/** New supplier (or edit one). Returns the saved supplier so the caller can select it. */
export function SupplierForm({
  supplier,
  onDone,
}: {
  supplier?: { id: number; name: string; phone: string | null; contactPerson: string | null; givesWarranty: boolean | null };
  onDone: (s?: { id: number; name: string }) => void;
}) {
  const utils = api.useUtils();
  const [f, setF] = useState({
    name: supplier?.name ?? "",
    phone: supplier?.phone ?? "",
    contactPerson: supplier?.contactPerson ?? "",
    givesWarranty: supplier?.givesWarranty ?? false,
  });
  const save = api.purchasing.saveSupplier.useMutation({
    onSuccess: (s) => {
      void utils.purchasing.invalidate();
      onDone(s);
    },
  });
  const errs = fieldErrors(save.error);
  return (
    <div className="space-y-3">
      <Field label="Nombre" error={errs.name}>
        <Input autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </Field>
      <Field label="Teléfono (opcional)" error={errs.phone} hint="8 dígitos; extranjero con +">
        <PhoneInput value={f.phone} onValue={(v) => setF({ ...f, phone: v })} />
      </Field>
      <Field label="Persona de contacto (opcional)">
        <Input value={f.contactPerson} onChange={(e) => setF({ ...f, contactPerson: e.target.value })} />
      </Field>
      <label className="flex min-h-10 items-center gap-2 text-sm">
        <input type="checkbox" className="h-5 w-5" checked={f.givesWarranty} onChange={(e) => setF({ ...f, givesWarranty: e.target.checked })} /> Da
        garantía en sus productos
      </label>
      {save.error && <Alert>{errorMessage(save.error)}</Alert>}
      <Button
        className="w-full"
        disabled={!f.name.trim() || save.isPending}
        onClick={() =>
          save.mutate({
            id: supplier?.id,
            name: f.name,
            phone: f.phone || undefined,
            contactPerson: f.contactPerson || undefined,
            givesWarranty: f.givesWarranty,
          })
        }
      >
        Guardar proveedor
      </Button>
    </div>
  );
}

export type MoneySource = "CAJA" | "FUERA_DE_CAJA" | "VIAJE";

/**
 * ¿Con qué dinero se pagó? (DEC-058). Botones grandes, uno por opción:
 *  - De la caja: sale de la gaveta hoy y el arqueo lo resta.
 *  - Fuera de la caja: dinero del dueño o transferencia; no toca el arqueo.
 *  - Dinero de un viaje: se pagó con lo que se llevó a un viaje de compras abierto.
 */
export function MoneySourcePicker({
  value,
  onChange,
  tripId,
  onTrip,
  allowTrip = true,
}: {
  value: MoneySource | null;
  onChange: (v: MoneySource) => void;
  tripId?: number;
  onTrip?: (id: number) => void;
  allowTrip?: boolean;
}) {
  const trips = api.trips.list.useQuery({ status: "ABIERTO" }, { enabled: allowTrip });
  const open = trips.data ?? [];
  const options: { v: MoneySource; label: string; hint: string }[] = [
    { v: "CAJA", label: "De la caja", hint: "Efectivo de la gaveta: el arqueo lo resta" },
    { v: "FUERA_DE_CAJA", label: "Fuera de la caja", hint: "Dinero del dueño o transferencia" },
    ...(allowTrip && open.length > 0 ? [{ v: "VIAJE" as const, label: "Dinero de un viaje", hint: "Lo que se llevó a un viaje de compras" }] : []),
  ];
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-neutral-300">¿Con qué dinero se pagó?</p>
      <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Con qué dinero se pagó">
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={value === o.v}
            onClick={() => onChange(o.v)}
            className={cx(
              "flex min-h-14 flex-col items-start rounded-lg border px-3 py-2 text-left text-sm",
              value === o.v ? "border-brand-600 bg-brand-600 text-white" : "border-neutral-700 hover:bg-neutral-800",
            )}
          >
            <span className="font-medium">{o.label}</span>
            <span className={cx("text-xs", value === o.v ? "text-white/80" : "text-neutral-500")}>{o.hint}</span>
          </button>
        ))}
      </div>
      {value === "VIAJE" && (
        <Select aria-label="Viaje de compras" value={tripId ?? 0} onChange={(e) => onTrip?.(Number(e.target.value))}>
          <option value={0}>Elegir el viaje…</option>
          {open.map((t) => (
            <option key={t.id} value={t.id}>
              {docNo("viaje", t.id)} · {t.destination} · {formatDay(t.tripDate)}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}

/**
 * Payment to a supplier: for one purchase, or (without purchase) to the
 * supplier's balance from before the system. The API checks it is not more
 * than what is owed, and records where the money came from.
 */
export function SupplierPayment({
  supplierId,
  purchaseInvoiceId,
  balance,
  onDone,
}: {
  supplierId: number;
  purchaseInvoiceId?: number;
  balance: string;
  onDone: () => void;
}) {
  const utils = api.useUtils();
  const [amount, setAmount] = useState(balance);
  const [source, setSource] = useState<MoneySource | null>(null);
  const [tripId, setTripId] = useState(0);
  const [notes, setNotes] = useState("");
  const pay = api.purchasing.registerPayment.useMutation({
    onSuccess: () => {
      void utils.purchasing.invalidate();
      void utils.trips.invalidate();
      void utils.cash.invalidate();
      onDone();
    },
  });
  const missing = !amount ? "Escriba el monto" : !source ? "Diga con qué dinero se pagó" : source === "VIAJE" && !tripId ? "Elija el viaje" : null;
  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-400">
        {purchaseInvoiceId ? "Saldo de la factura" : "Saldo anterior al sistema"}: <b className="tabular-nums">{money(balance)}</b>
      </p>
      <Field label="Monto (C$)">
        <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <MoneySourcePicker value={source} onChange={setSource} tripId={tripId} onTrip={setTripId} />
      {source === "CAJA" && <Alert kind="info">Sale de la gaveta hoy: necesita la caja abierta y aparece en el arqueo como «Pagos a proveedores».</Alert>}
      <Field label="Nota (opcional)">
        <Input value={notes} maxLength={200} onChange={(e) => setNotes(e.target.value)} placeholder="Ej.: recibo N.º 123 del proveedor" />
      </Field>
      <Alert>{pay.error && errorMessage(pay.error)}</Alert>
      <Button
        className="w-full"
        disabled={!!missing || pay.isPending}
        onClick={() =>
          source &&
          pay.mutate({
            supplierId,
            purchaseInvoiceId,
            amount,
            source,
            purchaseTripId: source === "VIAJE" ? tripId : undefined,
            notes: notes.trim() || undefined,
          })
        }
      >
        {pay.isPending ? "Registrando…" : "Registrar pago"}
      </Button>
      {missing && <p className="text-center text-xs text-neutral-500">{missing}</p>}
    </div>
  );
}
