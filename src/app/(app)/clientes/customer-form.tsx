"use client";

import { useState } from "react";

import { MotorcycleModelSelect } from "~/app/_components/pickers";
import { Alert, Button, Field, FormActions, FormSection, Input, PhoneInput } from "~/app/_components/ui";
import { errorMessage, fieldErrors } from "~/lib/errors";
import { api } from "~/trpc/react";

/**
 * New customer, optionally with their motorcycle in the same step.
 * Kenry, 23-nov: a roomy window in two clear parts (who the customer is, and
 * their motorcycle if they bring one), with «Cancelar» and «Guardar» always visible.
 */
export function CustomerForm({ onDone, onCancel }: { onDone: () => void; onCancel?: () => void }) {
  const utils = api.useUtils();
  const [f, setF] = useState({ name: "", phone: "", nationalId: "", address: "" });
  const [moto, setMoto] = useState({ motorcycleModelId: 0, color: "", plate: "" });
  const create = api.customer.create.useMutation({
    onSuccess: () => {
      void utils.customer.invalidate();
      void utils.search.invalidate();
      onDone();
    },
  });
  const errs = fieldErrors(create.error);
  const missing = !f.name.trim() ? "Falta el nombre" : !f.phone.trim() ? "Falta el teléfono" : moto.motorcycleModelId && !moto.color.trim() ? "Falta el color de la moto" : null;
  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (missing || create.isPending) return;
        create.mutate({
          name: f.name,
          phone: f.phone,
          nationalId: f.nationalId || undefined,
          address: f.address || undefined,
          motorcycle: moto.motorcycleModelId
            ? { motorcycleModelId: moto.motorcycleModelId, color: moto.color, plate: moto.plate || undefined }
            : undefined,
        });
      }}
    >
      <FormSection title="Datos del cliente" description="Con el nombre y el teléfono basta. La cédula ayuda a no registrar dos veces a la misma persona.">
        <Field label="Nombre completo" error={errs.name}>
          <Input className="h-11" autoFocus placeholder="Ej.: Juan Pérez López" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Teléfono" error={errs.phone} hint="8 dígitos; si es de otro país, empiece con +">
          <PhoneInput className="h-11" value={f.phone} onValue={(v) => setF({ ...f, phone: v })} />
        </Field>
        <Field label="Cédula (opcional)" error={errs.nationalId}>
          <Input className="h-11" placeholder="001-010190-0001A" value={f.nationalId} onChange={(e) => setF({ ...f, nationalId: e.target.value })} />
        </Field>
        <Field label="Dirección (opcional)">
          <Input className="h-11" placeholder="Barrio, comunidad o referencia" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
        </Field>
      </FormSection>

      <FormSection
        title="Su moto (opcional)"
        description="Si el cliente solo compra repuestos, deje esta parte en blanco. Puede agregarle motos después desde su página."
      >
        <MotorcycleModelSelect value={moto.motorcycleModelId} onChange={(id) => setMoto({ ...moto, motorcycleModelId: id })} />
        <Field label="Color" error={errs.color}>
          <Input className="h-11" placeholder="Ej.: rojo" value={moto.color} onChange={(e) => setMoto({ ...moto, color: e.target.value })} />
        </Field>
        <Field label="Placa (opcional)" error={errs.plate}>
          <Input className="h-11" placeholder="M 123456" value={moto.plate} onChange={(e) => setMoto({ ...moto, plate: e.target.value.toUpperCase() })} />
        </Field>
      </FormSection>

      {create.error && <Alert>{errorMessage(create.error)}</Alert>}
      <FormActions onCancel={onCancel} note={missing}>
        <Button type="submit" className="h-11 px-6" disabled={!!missing || create.isPending}>
          {create.isPending ? "Guardando…" : "Guardar cliente"}
        </Button>
      </FormActions>
    </form>
  );
}
