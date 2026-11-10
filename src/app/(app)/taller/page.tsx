"use client";

import Link from "next/link";
import { useState } from "react";

import { ReceiveForm } from "~/app/(app)/taller/receive-form";
import { Alert, Badge, Button, cx, Dialog, Input, PageTitle } from "~/app/_components/ui";
import { errorMessage } from "~/lib/errors";
import { formatDateTime } from "~/lib/format";
import { LABELS, type ServiceOrderStatus } from "~/server/domain/constants";
import { api } from "~/trpc/react";

const COLUMNS: ServiceOrderStatus[] = ["RECIBIDA", "EN_DIAGNOSTICO", "EN_PROCESO", "ESPERA_REPUESTO", "ESPERA_CLIENTE", "TERMINADA", "EN_PRUEBA"];
const WAITING: ServiceOrderStatus[] = ["ESPERA_REPUESTO", "ESPERA_CLIENTE"];
const READY: ServiceOrderStatus[] = ["TERMINADA", "EN_PRUEBA"];

/** CLI-007 — Board of open orders by status, and one-step reception. */
export default function WorkshopPage() {
  const me = api.auth.me.useQuery();
  const orders = api.service.listOrders.useQuery({ limit: 100 });
  const [receiving, setReceiving] = useState(false);
  const [filter, setFilter] = useState("");
  const [justCreated, setJustCreated] = useState<number | null>(null);
  const f = filter.trim().toLowerCase();
  const items = (orders.data?.items ?? []).filter(
    (o) =>
      !f ||
      `${o.id} ${o.motorcycle.customer.name} ${o.motorcycle.plate ?? ""} ${o.motorcycle.model.name} ${o.mechanic?.name ?? ""}`
        .toLowerCase()
        .includes(f),
  );

  return (
    <>
      <PageTitle
        title="Taller"
        subtitle={`${orders.data?.items.length ?? 0} motos en el taller · ${orders.data?.items.filter((o) => READY.includes(o.status)).length ?? 0} listas para cobrar`}
        actions={
          <div className="flex items-center gap-2">
            <Input className="w-56" placeholder="Filtrar por placa, cliente…" value={filter} onChange={(e) => setFilter(e.target.value)} />
            {me.data?.permissions.includes("taller.gestionar") && <Button onClick={() => setReceiving(true)}>Recibir moto</Button>}
          </div>
        }
      />
      {orders.error && <Alert>{errorMessage(orders.error)}</Alert>}
      {justCreated && (
        <div className="mb-4">
          <Alert kind="ok">
            Moto recibida: orden #{justCreated}.{" "}
            <Link href={`/taller/${justCreated}`} className="font-medium underline">
              Abrir la orden
            </Link>
          </Alert>
        </div>
      )}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map((status) => {
          const col = items.filter((o) => o.status === status);
          return (
            <section
              key={status}
              aria-label={LABELS.serviceStatus[status]}
              className={cx(
                "w-64 shrink-0 rounded-xl border p-2",
                READY.includes(status) ? "border-ok-line bg-ok-bg/50" : "border-neutral-800 bg-neutral-800/30",
              )}
            >
              <h2 className="mb-2 flex items-center justify-between px-1 pt-1 text-sm font-semibold text-neutral-200">
                {LABELS.serviceStatus[status]}
                <span className="text-xs font-normal text-neutral-500 tabular-nums">{col.length}</span>
              </h2>
              <ul className="space-y-2">
                {col.map((o) => (
                  <li key={o.id}>
                    <Link
                      href={`/taller/${o.id}`}
                      className={cx(
                        "block rounded-lg border bg-neutral-900 p-3 text-sm shadow-sm transition-colors hover:border-neutral-600",
                        o.id === justCreated ? "border-brand-600" : "border-neutral-800",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-base font-semibold text-neutral-50">#{o.id}</span>
                        <span className="rounded border border-neutral-700 px-1.5 text-xs font-medium tracking-wide text-neutral-300">
                          {o.motorcycle.plate ?? "sin placa"}
                        </span>
                      </div>
                      <p className="mt-1 font-medium text-neutral-100">{o.motorcycle.customer.name}</p>
                      <p className="text-xs text-neutral-500">
                        {o.motorcycle.model.brand.name} {o.motorcycle.model.name} · {o.motorcycle.color}
                      </p>
                      <p className="mt-1.5 line-clamp-2 text-xs text-neutral-400">{o.requestedWork}</p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        {o.mechanic ? (
                          <span className="text-xs text-neutral-300">{o.mechanic.name}</span>
                        ) : (
                          <Badge tone="amber">Sin mecánico</Badge>
                        )}
                        <span className="text-[11px] text-neutral-500">{formatDateTime(o.statusChanges[0]?.changedAt)}</span>
                      </div>
                      {WAITING.includes(o.status) && o.statusChanges[0]?.notes && (
                        <p className="text-warn-fg mt-1 text-xs">{o.statusChanges[0].notes}</p>
                      )}
                    </Link>
                  </li>
                ))}
                {col.length === 0 && <li className="px-1 pb-2 text-xs text-neutral-500">Ninguna</li>}
              </ul>
            </section>
          );
        })}
      </div>
      <Dialog open={receiving} onClose={() => setReceiving(false)} title="Recibir moto" size="lg">
        <ReceiveForm
          onDone={(id) => {
            setReceiving(false);
            setJustCreated(id);
          }}
        />
      </Dialog>
    </>
  );
}
