"use client";

import { useState } from "react";

import { Alert, Button, Field, Input, Select } from "~/app/_components/ui";
import { errorMessage, fieldErrors } from "~/lib/errors";
import { api } from "~/trpc/react";

/** New customer, optionally with their motorcycle in the same step. */
export function CustomerForm({ onDone }: { onDone: () => void }) {
  const utils = api.useUtils();
  const models = api.admin.motorcycleModels.useQuery();
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
        <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
      </Field>
      <Field label="Cédula (opcional)">
        <Input value={f.nationalId} onChange={(e) => setF({ ...f, nationalId: e.target.value })} />
      </Field>
      <Field label="Dirección (opcional)">
        <Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
      </Field>
      <h3 className="mt-2 text-sm font-semibold sm:col-span-2">Moto (opcional)</h3>
      <Field label="Modelo">
        <Select value={moto.motorcycleModelId} onChange={(e) => setMoto({ ...moto, motorcycleModelId: Number(e.target.value) })}>
          <option value={0}>Sin moto</option>
          {models.data?.map((m) => (
            <option key={m.id} value={m.id}>
              {m.brand.name} {m.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Color">
        <Input value={moto.color} onChange={(e) => setMoto({ ...moto, color: e.target.value })} />
      </Field>
      <Field label="Placa">
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
