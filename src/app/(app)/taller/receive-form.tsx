"use client";

import { useEffect, useState } from "react";

import {
  type Customer,
  CustomerPicker,
  type MotorcycleChoice,
  MotorcyclePicker,
  NEW_MOTORCYCLE,
  ResponsibleSelect,
} from "~/app/_components/pickers";
import { ServiceCatalogPicker, type ServiceType } from "~/app/_components/service-catalog";
import { Alert, Button, Field, Input, Kbd, PhoneInput, Textarea } from "~/app/_components/ui";
import { errorMessage, fieldErrors } from "~/lib/errors";
import { formatPhoneInput } from "~/lib/phone";
import { api } from "~/trpc/react";

/**
 * Reception in ONE step. Search the plate, name or phone:
 *  - known customer → pick one of their motorcycles (or add another);
 *  - unknown → "Registrar como cliente nuevo" and fill name + phone right here.
 * Brand and model are chosen from the catalog (DEC-044). The jobs are chosen
 * from the workshop catalog (DEC-048); the customer's words go in an optional
 * note. What is filled in is kept as a draft until the motorcycle is received.
 */
type Draft = {
  customer: Customer | null;
  newCustomer: { name: string; phone: string } | null;
  moto: MotorcycleChoice;
  chassis: string;
  items: { id: number; name: string }[];
  note: string;
  km: string;
  responsible: number;
};
const EMPTY: Draft = {
  customer: null,
  newCustomer: null,
  moto: NEW_MOTORCYCLE,
  chassis: "",
  items: [],
  note: "",
  km: "",
  responsible: 0,
};
const DRAFT_KEY = "motor-irm.recepcion.borrador.v1";

function loadDraft(): Draft {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<Draft>) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function ReceiveForm({ onDone }: { onDone: (orderId: number) => void }) {
  const utils = api.useUtils();
  const [d, setD] = useState<Draft>(EMPTY);
  const [restored, setRestored] = useState(false);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));

  useEffect(() => {
    const draft = loadDraft();
    if (draft !== EMPTY) {
      setD(draft);
      setRestored(draft.items.length > 0 || !!draft.customer || !!draft.newCustomer);
    }
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    } catch {
      /* without storage the form still works; it just isn't kept */
    }
  }, [d]);

  const receive = api.service.receive.useMutation({
    onSuccess: (o) => {
      try {
        window.localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* nothing to clear */
      }
      void utils.service.invalidate();
      void utils.search.invalidate();
      onDone(o.id);
    },
  });
  const errs = fieldErrors(receive.error);
  const hasCustomer = !!d.customer || !!d.newCustomer;
  const ready = hasCustomer && d.items.length > 0;

  const toggle = (t: ServiceType) =>
    set({ items: d.items.some((i) => i.id === t.id) ? d.items.filter((i) => i.id !== t.id) : [...d.items, { id: t.id, name: t.name }] });

  const submit = () => {
    if (!ready || receive.isPending) return;
    receive.mutate({
      motorcycleId: d.moto.kind === "existing" ? d.moto.motorcycleId : undefined,
      newMotorcycle:
        d.moto.kind === "new"
          ? {
              customerId: d.customer?.id,
              newCustomer: d.newCustomer ?? undefined,
              motorcycleModelId: d.moto.motorcycleModelId,
              color: d.moto.color,
              plate: d.moto.plate || undefined,
              chassisNumber: d.chassis || undefined,
            }
          : undefined,
      items: d.items.map((i) => ({ serviceTypeId: i.id })),
      requestedWork: d.note || undefined,
      odometerKm: d.km ? Number(d.km) : undefined,
      mechanicStaffId: d.responsible || undefined,
    });
  };

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
      }}
    >
      {restored && (
        <Alert kind="info">
          Se recuperó lo que había llenado antes.{" "}
          <button
            type="button"
            className="font-medium underline"
            onClick={() => {
              setD(EMPTY);
              setRestored(false);
            }}
          >
            Empezar de cero
          </button>
        </Alert>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-neutral-200">1. Cliente</h3>
        {d.newCustomer ? (
          <div className="grid gap-3 rounded-lg border border-dashed border-neutral-700 p-3 sm:grid-cols-[1fr_1fr_auto]">
            <Field label="Nombre" error={errs.name}>
              <Input autoFocus value={d.newCustomer.name} onChange={(e) => set({ newCustomer: { ...d.newCustomer!, name: e.target.value } })} />
            </Field>
            <Field label="Teléfono" error={errs.phone}>
              <PhoneInput value={d.newCustomer.phone} onValue={(v) => set({ newCustomer: { ...d.newCustomer!, phone: v } })} />
            </Field>
            <Button type="button" variant="ghost" className="self-start sm:mt-6" onClick={() => set({ newCustomer: null })}>
              Buscar otro
            </Button>
          </div>
        ) : (
          <CustomerPicker
            autoFocus
            value={d.customer}
            onChange={(c) => {
              const first = c?.motorcycles[0];
              set({ customer: c, moto: first ? { kind: "existing", motorcycleId: first.id } : NEW_MOTORCYCLE });
            }}
            onCreateNew={(typed) => {
              const looksLikePhone = /^[+\d\s-]{6,}$/.test(typed);
              set({
                newCustomer: { name: looksLikePhone ? "" : typed, phone: looksLikePhone ? formatPhoneInput(typed) : "" },
                moto: NEW_MOTORCYCLE,
              });
            }}
          />
        )}
      </section>

      {hasCustomer && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-neutral-200">2. Moto</h3>
          <MotorcyclePicker motorcycles={d.customer?.motorcycles ?? []} value={d.moto} onChange={(moto) => set({ moto })} errors={errs} />
          <div className="grid gap-3 sm:grid-cols-2">
            {d.moto.kind === "new" && (
              <Field label="Número de chasis (opcional)" error={errs.chassisNumber}>
                <Input value={d.chassis} onChange={(e) => set({ chassis: e.target.value.toUpperCase() })} />
              </Field>
            )}
            <Field label="Kilometraje (opcional)" error={errs.odometerKm}>
              <Input inputMode="numeric" value={d.km} onChange={(e) => set({ km: e.target.value.replace(/\D/g, "").slice(0, 7) })} />
            </Field>
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-neutral-200">3. Trabajos</h3>
        {d.items.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {d.items.map((i) => (
              <span key={i.id} className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-3 py-1 text-sm text-white">
                {i.name}
                <button
                  type="button"
                  aria-label={`Quitar ${i.name}`}
                  className="ml-1 rounded-full px-1 hover:bg-white/20"
                  onClick={() => set({ items: d.items.filter((x) => x.id !== i.id) })}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-neutral-500">Elija uno o varios trabajos de la lista.</p>
        )}
        {errs.items && <p className="text-bad-fg text-xs">{errs.items}</p>}
        <ServiceCatalogPicker selected={d.items.map((i) => i.id)} onToggle={toggle} />
        <Field label="Nota del cliente (opcional)">
          <Textarea value={d.note} onChange={(e) => set({ note: e.target.value })} />
        </Field>
      </section>

      <Field label="4. Responsable">
        <ResponsibleSelect value={d.responsible} onChange={(responsible) => set({ responsible })} />
      </Field>

      {receive.error && <Alert>{errorMessage(receive.error)}</Alert>}
      <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t border-neutral-800 bg-neutral-900 px-4 py-3">
        <span className="text-xs text-neutral-500">
          {!hasCustomer ? "Falta el cliente" : d.items.length === 0 ? "Falta elegir el trabajo" : "Listo para recibir"} ·{" "}
          <Kbd>Ctrl</Kbd> + <Kbd>Enter</Kbd>
        </span>
        <Button type="submit" className="h-11 px-6" disabled={!ready || receive.isPending}>
          {receive.isPending ? "Guardando…" : "Recibir moto"}
        </Button>
      </div>
    </form>
  );
}
