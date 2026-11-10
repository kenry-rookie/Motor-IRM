"use client";

import { useId, useState } from "react";

import { type Customer, CustomerPicker } from "~/app/_components/pickers";
import { Alert, Button, cx, Field, Input, Kbd, Select, Textarea } from "~/app/_components/ui";
import { errorMessage, fieldErrors } from "~/lib/errors";
import { api } from "~/trpc/react";

/**
 * Reception in ONE step. Search the plate, name or phone:
 *  - known customer → pick one of their motorcycles (or add another);
 *  - unknown → "Registrar como cliente nuevo" and fill name + phone right here.
 * Brand and model are typed (with suggestions); new ones are created on save.
 */
export function ReceiveForm({ onDone }: { onDone: (orderId: number) => void }) {
  const utils = api.useUtils();
  const mechanics = api.staff.list.useQuery();
  const models = api.admin.motorcycleModels.useQuery();
  const types = api.admin.serviceTypes.useQuery();
  const listId = useId();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [newCustomer, setNewCustomer] = useState<{ name: string; phone: string } | null>(null);
  const [motoId, setMotoId] = useState<number | "new">("new");
  const [moto, setMoto] = useState({ brandName: "", modelName: "", color: "", plate: "" });
  const [requestedWork, setRequestedWork] = useState("");
  const [mechanicStaffId, setMechanicStaffId] = useState(0);

  const receive = api.service.receive.useMutation({
    onSuccess: (o) => {
      void utils.service.invalidate();
      void utils.customer.invalidate();
      void utils.admin.motorcycleModels.invalidate();
      onDone(o.id);
    },
  });
  const errs = fieldErrors(receive.error);

  const brands = [...new Set((models.data ?? []).map((m) => m.brand.name))].sort();
  const modelNames = (models.data ?? [])
    .filter((m) => !moto.brandName || m.brand.name.toLowerCase() === moto.brandName.trim().toLowerCase())
    .map((m) => m.name);
  const hasCustomer = !!customer || !!newCustomer;
  const usingNewMoto = !customer || motoId === "new";

  const submit = () => {
    if (!hasCustomer || !requestedWork.trim()) return;
    receive.mutate({
      motorcycleId: !usingNewMoto && typeof motoId === "number" ? motoId : undefined,
      newMotorcycle: usingNewMoto
        ? {
            customerId: customer?.id,
            newCustomer: newCustomer ?? undefined,
            brandName: moto.brandName,
            modelName: moto.modelName,
            color: moto.color,
            plate: moto.plate || undefined,
          }
        : undefined,
      requestedWork,
      mechanicStaffId: mechanicStaffId || undefined,
    });
  };

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
      }}
    >
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-neutral-200">Cliente</h3>
        {newCustomer ? (
          <div className="grid gap-3 rounded-lg border border-dashed border-neutral-700 p-3 sm:grid-cols-[1fr_1fr_auto]">
            <Field label="Nombre" error={errs.name}>
              <Input autoFocus value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} />
            </Field>
            <Field label="Teléfono" error={errs.phone}>
              <Input inputMode="tel" value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} />
            </Field>
            <Button type="button" variant="ghost" className="self-end" onClick={() => setNewCustomer(null)}>
              Buscar otro
            </Button>
          </div>
        ) : (
          <CustomerPicker
            autoFocus
            value={customer}
            onChange={(c) => {
              setCustomer(c);
              setMotoId(c?.motorcycles[0]?.id ?? "new");
            }}
            onCreateNew={(typed) => {
              const looksLikePhone = /^[\d\s-]{6,}$/.test(typed);
              setNewCustomer({ name: looksLikePhone ? "" : typed, phone: looksLikePhone ? typed : "" });
              setMotoId("new");
            }}
          />
        )}
      </section>

      {hasCustomer && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-neutral-200">Moto</h3>
          {customer && customer.motorcycles.length > 0 && (
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Moto del cliente">
              {customer.motorcycles.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={motoId === m.id}
                  onClick={() => setMotoId(m.id)}
                  className={cx(
                    "rounded-lg border px-3 py-2 text-left text-sm",
                    motoId === m.id ? "border-brand-600 bg-brand-600/8" : "border-neutral-700 hover:bg-neutral-800/50",
                  )}
                >
                  <span className="block font-medium">
                    {m.model.brand.name} {m.model.name}
                  </span>
                  <span className="block text-xs text-neutral-500">
                    {m.color} · {m.plate ?? "sin placa"}
                  </span>
                </button>
              ))}
              <button
                type="button"
                role="radio"
                aria-checked={motoId === "new"}
                onClick={() => setMotoId("new")}
                className={cx(
                  "rounded-lg border border-dashed px-3 py-2 text-sm",
                  motoId === "new" ? "border-brand-600 bg-brand-600/8" : "border-neutral-700 hover:bg-neutral-800/50",
                )}
              >
                + Otra moto
              </button>
            </div>
          )}
          {usingNewMoto && (
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Marca" error={errs.brandName}>
                <Input list={`${listId}-brands`} placeholder="Bajaj" value={moto.brandName} onChange={(e) => setMoto({ ...moto, brandName: e.target.value })} />
                <datalist id={`${listId}-brands`}>
                  {brands.map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              </Field>
              <Field label="Modelo" error={errs.modelName}>
                <Input list={`${listId}-models`} placeholder="Pulsar 150" value={moto.modelName} onChange={(e) => setMoto({ ...moto, modelName: e.target.value })} />
                <datalist id={`${listId}-models`}>
                  {modelNames.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </Field>
              <Field label="Color" error={errs.color}>
                <Input value={moto.color} onChange={(e) => setMoto({ ...moto, color: e.target.value })} />
              </Field>
              <Field label="Placa (opcional)">
                <Input value={moto.plate} onChange={(e) => setMoto({ ...moto, plate: e.target.value.toUpperCase() })} />
              </Field>
            </div>
          )}
        </section>
      )}

      <section className="space-y-2">
        <Field label="Trabajo solicitado" error={errs.requestedWork}>
          <Textarea value={requestedWork} onChange={(e) => setRequestedWork(e.target.value)} placeholder="Qué pide el cliente, en sus palabras" />
        </Field>
        <div className="flex flex-wrap gap-1.5">
          {types.data
            ?.filter((t) => t.active)
            .map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setRequestedWork((w) => (w.trim() ? `${w.trim()}, ${t.name.toLowerCase()}` : t.name))}
                className="rounded-full border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 hover:bg-neutral-800/60"
              >
                + {t.name}
              </button>
            ))}
        </div>
      </section>

      <Field label="Mecánico">
        <Select value={mechanicStaffId} onChange={(e) => setMechanicStaffId(Number(e.target.value))}>
          <option value={0}>Asignar después</option>
          {mechanics.data
            ?.filter((s) => s.commissionRate)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </Select>
      </Field>

      <Alert>{receive.error && errorMessage(receive.error)}</Alert>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-neutral-500">
          <Kbd>Ctrl</Kbd> + <Kbd>Enter</Kbd> para guardar
        </span>
        <Button type="submit" disabled={!hasCustomer || !requestedWork.trim() || receive.isPending}>
          {receive.isPending ? "Guardando…" : "Recibir moto"}
        </Button>
      </div>
    </form>
  );
}
