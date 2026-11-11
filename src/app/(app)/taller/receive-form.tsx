"use client";

import { useState } from "react";

import {
  type Customer,
  CustomerPicker,
  type MotorcycleChoice,
  MotorcyclePicker,
  NEW_MOTORCYCLE,
  ResponsibleSelect,
} from "~/app/_components/pickers";
import { Alert, Button, Field, Input, Kbd, Textarea } from "~/app/_components/ui";
import { errorMessage, fieldErrors } from "~/lib/errors";
import { api } from "~/trpc/react";

/**
 * Reception in ONE step. Search the plate, name or phone:
 *  - known customer → pick one of their motorcycles (or add another);
 *  - unknown → "Registrar como cliente nuevo" and fill name + phone right here.
 * Brand and model are chosen from the catalog, never typed (DEC-044): an owner
 * can register a missing one from the same screen.
 */
export function ReceiveForm({ onDone }: { onDone: (orderId: number) => void }) {
  const utils = api.useUtils();
  const types = api.admin.serviceTypes.useQuery();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [newCustomer, setNewCustomer] = useState<{ name: string; phone: string } | null>(null);
  const [moto, setMoto] = useState<MotorcycleChoice>(NEW_MOTORCYCLE);
  const [requestedWork, setRequestedWork] = useState("");
  const [mechanicStaffId, setMechanicStaffId] = useState(0);

  const receive = api.service.receive.useMutation({
    onSuccess: (o) => {
      void utils.service.invalidate();
      void utils.customer.invalidate();
      void utils.search.invalidate();
      onDone(o.id);
    },
  });
  const errs = fieldErrors(receive.error);

  const hasCustomer = !!customer || !!newCustomer;

  const submit = () => {
    if (!hasCustomer || !requestedWork.trim()) return;
    receive.mutate({
      motorcycleId: moto.kind === "existing" ? moto.motorcycleId : undefined,
      newMotorcycle:
        moto.kind === "new"
          ? {
              customerId: customer?.id,
              newCustomer: newCustomer ?? undefined,
              motorcycleModelId: moto.motorcycleModelId,
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
              const first = c?.motorcycles[0];
              setMoto(first ? { kind: "existing", motorcycleId: first.id } : NEW_MOTORCYCLE);
            }}
            onCreateNew={(typed) => {
              const looksLikePhone = /^[\d\s-]{6,}$/.test(typed);
              setNewCustomer({ name: looksLikePhone ? "" : typed, phone: looksLikePhone ? typed : "" });
              setMoto(NEW_MOTORCYCLE);
            }}
          />
        )}
      </section>

      {hasCustomer && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-neutral-200">Moto</h3>
          <MotorcyclePicker motorcycles={customer?.motorcycles ?? []} value={moto} onChange={setMoto} errors={errs} />
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

      <Field label="Responsable" hint="Mecánico o dueño. Si lo repara un dueño, no hay comisión.">
        <ResponsibleSelect value={mechanicStaffId} onChange={setMechanicStaffId} />
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
