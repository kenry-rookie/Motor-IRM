"use client";

import { useState } from "react";

import { MotorcycleModelSelect } from "~/app/_components/pickers";
import { Alert, Button, Field, Input, PhoneInput } from "~/app/_components/ui";
import { errorMessage, fieldErrors } from "~/lib/errors";
import { api } from "~/trpc/react";

/** New customer, optionally with their motorcycle in the same step. */
export function CustomerForm({ onDone }: { onDone: () => void }) {
  const utils = api.useUtils();
  const [f, setF] = useState({ name: "", phone: "", nationalId: "", address: "" });
  const [moto, setMoto] = useState({ motorcycleModelId: 0, color: "", plate: "" });
  const create = api.customer.create.useMutation({
    onSuccess: () => {
      void utils.customer.invalidate();
      onDone();
    },
  });
  const errs = fieldErrors(create.error);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Nombre" error={errs.name}>
        <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </Field>
      <Field label="Teléfono" error={errs.phone}>
        <PhoneInput value={f.phone} onValue={(v) => setF({ ...f, phone: v })} />
      </Field>
      <Field label="Cédula (opcional)">
        <Input value={f.nationalId} onChange={(e) => setF({ ...f, nationalId: e.target.value })} />
      </Field>
      <Field label="Dirección (opcional)">
        <Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
      </Field>
      <h3 className="mt-2 text-sm font-semibold sm:col-span-2">Moto (opcional)</h3>
      <p className="text-xs text-neutral-500 sm:col-span-2">
        No todos los clientes traen moto: deje la marca sin elegir si solo compra repuestos.
      </p>
      <MotorcycleModelSelect value={moto.motorcycleModelId} onChange={(id) => setMoto({ ...moto, motorcycleModelId: id })} />
      <Field label="Color">
        <Input value={moto.color} onChange={(e) => setMoto({ ...moto, color: e.target.value })} />
      </Field>
      <Field label="Placa (opcional)">
        <Input value={moto.plate} onChange={(e) => setMoto({ ...moto, plate: e.target.value })} />
      </Field>
      <div className="sm:col-span-2">
        <Alert>{create.error && errorMessage(create.error)}</Alert>
      </div>
      <Button
        className="sm:col-span-2"
        disabled={create.isPending}
        onClick={() =>
          create.mutate({
            name: f.name,
            phone: f.phone,
            nationalId: f.nationalId || undefined,
            address: f.address || undefined,
            motorcycle: moto.motorcycleModelId
              ? { motorcycleModelId: moto.motorcycleModelId, color: moto.color, plate: moto.plate || undefined }
              : undefined,
          })
        }
      >
        Guardar
      </Button>
    </div>
  );
}
