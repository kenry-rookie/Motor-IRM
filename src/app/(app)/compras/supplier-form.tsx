"use client";

import { useState } from "react";

import { Alert, Button, Field, Input, PhoneInput } from "~/app/_components/ui";
import { errorMessage, fieldErrors } from "~/lib/errors";
import { money } from "~/lib/format";
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

/** Payment to a supplier, for one purchase. The API checks it is not more than what is owed. */
export function SupplierPayment({ supplierId, purchaseInvoiceId, balance, onDone }: { supplierId: number; purchaseInvoiceId: number; balance: string; onDone: () => void }) {
  const utils = api.useUtils();
  const [amount, setAmount] = useState(balance);
  const pay = api.purchasing.registerPayment.useMutation({
    onSuccess: () => {
      void utils.purchasing.invalidate();
      onDone();
    },
  });
  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-400">Saldo: {money(balance)}</p>
      <Field label="Monto (C$)">
        <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <Alert>{pay.error && errorMessage(pay.error)}</Alert>
      <Button className="w-full" disabled={!amount || pay.isPending} onClick={() => pay.mutate({ supplierId, purchaseInvoiceId, amount })}>
        Registrar pago
      </Button>
    </div>
  );
}
