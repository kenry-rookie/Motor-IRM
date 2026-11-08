"use client";

import Link from "next/link";
import { useState } from "react";

import { CustomerPicker } from "~/app/_components/pickers";
import { Alert, Badge, Button, Dialog, Field, PageTitle, Select, Textarea } from "~/app/_components/ui";
import { errorMessage } from "~/lib/errors";
import { formatDateTime } from "~/lib/format";
import { LABELS, type ServiceOrderStatus } from "~/server/domain/constants";
import { api, type RouterOutputs } from "~/trpc/react";

type Customer = RouterOutputs["customer"]["list"]["items"][number];

const COLUMNS: ServiceOrderStatus[] = [
  "RECIBIDA",
  "EN_DIAGNOSTICO",
  "EN_PROCESO",
  "ESPERA_REPUESTO",
  "ESPERA_CLIENTE",
  "TERMINADA",
  "EN_PRUEBA",
];

/** CLI-007 — Board of open orders by status + reception of a motorcycle. */
export default function WorkshopPage() {
  const me = api.auth.me.useQuery();
  const orders = api.service.listOrders.useQuery({ limit: 100 });
  const [receiving, setReceiving] = useState(false);
  const items = orders.data?.items ?? [];
  return (
    <>
      <PageTitle
        title="Taller"
        subtitle="Órdenes abiertas por estado"
        actions={me.data?.permissions.includes("taller.gestionar") && <Button onClick={() => setReceiving(true)}>Recibir moto</Button>}
      />
      {orders.error && <Alert>{errorMessage(orders.error)}</Alert>}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map((status) => {
          const col = items.filter((o) => o.status === status);
          return (
            <div key={status} className="w-64 shrink-0 rounded-xl border border-neutral-800 bg-neutral-900/40 p-2">
              <h3 className="mb-2 flex items-center justify-between px-1 text-sm font-semibold">
                {LABELS.serviceStatus[status]} <Badge>{col.length}</Badge>
              </h3>
              <ul className="space-y-2">
                {col.map((o) => (
                  <li key={o.id}>
                    <Link href={`/taller/${o.id}`} className="block rounded-lg border border-neutral-800 bg-neutral-950 p-3 text-sm hover:border-amber-600">
                      <div className="flex justify-between">
                        <span className="font-semibold">#{o.id}</span>
                        <span className="text-xs text-neutral-500">{o.motorcycle.plate ?? "sin placa"}</span>
                      </div>
                      <p className="mt-1">{o.motorcycle.customer.name}</p>
                      <p className="text-xs text-neutral-400">
                        {o.motorcycle.model.brand.name} {o.motorcycle.model.name} · {o.motorcycle.color}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-neutral-400">{o.requestedWork}</p>
                      <p className="mt-1 text-xs text-amber-300/80">{o.mechanic?.name ?? "Sin mecánico"}</p>
                      <p className="text-xs text-neutral-600">{formatDateTime(o.statusChanges[0]?.changedAt)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <Dialog open={receiving} onClose={() => setReceiving(false)} title="Recibir moto">
        <ReceiveForm onDone={() => setReceiving(false)} />
      </Dialog>
    </>
  );
}

function ReceiveForm({ onDone }: { onDone: () => void }) {
  const utils = api.useUtils();
  const mechanics = api.staff.list.useQuery();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [motorcycleId, setMotorcycleId] = useState(0);
  const [requestedWork, setRequestedWork] = useState("");
  const [mechanicStaffId, setMechanicStaffId] = useState(0);
  const receive = api.service.receive.useMutation({
    onSuccess: () => {
      void utils.service.invalidate();
      onDone();
    },
  });
  return (
    <div className="space-y-3">
      <Field label="Cliente" hint="Si es nuevo, regístrelo primero en Clientes (con su moto).">
        <CustomerPicker
          value={customer}
          onChange={(c) => {
            setCustomer(c);
            setMotorcycleId(c?.motorcycles[0]?.id ?? 0);
          }}
        />
      </Field>
      {customer && (
        <Field label="Moto">
          <Select value={motorcycleId} onChange={(e) => setMotorcycleId(Number(e.target.value))}>
            {customer.motorcycles.map((m) => (
              <option key={m.id} value={m.id}>
                {m.model.brand.name} {m.model.name} · {m.color} · {m.plate ?? "sin placa"}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="Trabajo solicitado">
        <Textarea value={requestedWork} onChange={(e) => setRequestedWork(e.target.value)} />
      </Field>
      <Field label="Mecánico (opcional)">
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
      <Button
        className="w-full"
        disabled={!motorcycleId || !requestedWork || receive.isPending}
        onClick={() => receive.mutate({ motorcycleId, requestedWork, mechanicStaffId: mechanicStaffId || undefined })}
      >
        Registrar recepción
      </Button>
    </div>
  );
}
