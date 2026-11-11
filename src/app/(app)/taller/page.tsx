"use client";

import Link from "next/link";
import { useState } from "react";

import { ReceiveForm } from "~/app/(app)/taller/receive-form";
import { ResponsibleSelect } from "~/app/_components/pickers";
import { Alert, Badge, Button, cx, Dialog, Input, PageTitle, Select } from "~/app/_components/ui";
import { errorMessage } from "~/lib/errors";
import { formatDateTime } from "~/lib/format";
import { LABELS, type ServiceOrderStatus } from "~/server/domain/constants";
import { api, type RouterInputs, type RouterOutputs } from "~/trpc/react";

type MovableStatus = RouterInputs["service"]["changeStatus"]["status"];
type Order = RouterOutputs["service"]["listOrders"]["items"][number];

const COLUMNS: MovableStatus[] = ["EN_DIAGNOSTICO", "EN_PROCESO", "ESPERA_REPUESTO", "ESPERA_CLIENTE", "TERMINADA", "EN_PRUEBA"];
const BOARD: ServiceOrderStatus[] = ["RECIBIDA", ...COLUMNS];
const WAITING: ServiceOrderStatus[] = ["ESPERA_REPUESTO", "ESPERA_CLIENTE"];
const READY: ServiceOrderStatus[] = ["TERMINADA", "EN_PRUEBA"];

/**
 * CLI-007 — Board of open orders by status. The status and the responsible are
 * changed FROM THE CARD (menu) or by dragging the card to another column; there
 * is no need to open the order for that (prompt v2 §6.3).
 */
export default function WorkshopPage() {
  const me = api.auth.me.useQuery();
  const utils = api.useUtils();
  const orders = api.service.listOrders.useQuery({ limit: 100 });
  const [receiving, setReceiving] = useState(false);
  const [filter, setFilter] = useState("");
  const [notice, setNotice] = useState<{ text: string; orderId: number } | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<ServiceOrderStatus | null>(null);
  const canManage = !!me.data?.permissions.includes("taller.gestionar");

  const refresh = () => void utils.service.invalidate();
  const change = api.service.changeStatus.useMutation({ onSuccess: refresh });
  const assign = api.service.assignMechanic.useMutation({ onSuccess: refresh });

  const moveTo = (o: Order, status: MovableStatus) => {
    if (o.status === status) return;
    change.mutate(
      { serviceOrderId: o.id, status },
      { onSuccess: () => setNotice({ text: `Orden #${o.id} pasó a «${LABELS.serviceStatus[status]}».`, orderId: o.id }) },
    );
  };

  const f = filter.trim().toLowerCase();
  const items = (orders.data?.items ?? []).filter(
    (o) =>
      !f ||
      `${o.id} ${o.motorcycle.customer.name} ${o.motorcycle.plate ?? ""} ${o.motorcycle.model.name} ${o.mechanic?.name ?? ""} ${o.items
        .map((i) => i.serviceType.name)
        .join(" ")}`
        .toLowerCase()
        .includes(f),
  );
  const err = orders.error ?? change.error ?? assign.error;

  return (
    <>
      <PageTitle
        title="Taller"
        subtitle={`${orders.data?.items.length ?? 0} motos en el taller · ${orders.data?.items.filter((o) => READY.includes(o.status)).length ?? 0} listas para cobrar`}
        actions={
          <div className="flex items-center gap-2">
            <Input className="h-11 w-64" placeholder="Filtrar por placa, cliente, trabajo…" value={filter} onChange={(e) => setFilter(e.target.value)} />
            {canManage && (
              <Button className="h-11" onClick={() => setReceiving(true)}>
                + Recibir moto
              </Button>
            )}
          </div>
        }
      />
      {err && <Alert>{errorMessage(err)}</Alert>}
      {notice && (
        <div className="mb-4">
          <Alert kind="ok">
            {notice.text}{" "}
            <Link href={`/taller/${notice.orderId}`} className="font-medium underline">
              Abrir la orden
            </Link>
          </Alert>
        </div>
      )}
      {canManage && (
        <p className="mb-3 text-xs text-neutral-500">
          Cambie el estado desde el menú de cada tarjeta, o arrástrela a otra columna.
        </p>
      )}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {BOARD.map((status) => {
          const col = items.filter((o) => o.status === status);
          const droppable = canManage && status !== "RECIBIDA";
          return (
            <section
              key={status}
              aria-label={LABELS.serviceStatus[status]}
              onDragOver={(e) => {
                if (!droppable || dragging === null) return;
                e.preventDefault();
                setOver(status);
              }}
              onDragLeave={() => setOver((s) => (s === status ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const o = items.find((x) => x.id === dragging);
                if (o && droppable) moveTo(o, status as MovableStatus);
                setDragging(null);
              }}
              className={cx(
                "flex min-h-[60vh] w-72 shrink-0 flex-col rounded-xl border p-2 transition-colors",
                READY.includes(status) ? "border-ok-line bg-ok-bg/50" : "border-neutral-800 bg-neutral-800/30",
                over === status && "border-brand-600 bg-brand-600/8",
              )}
            >
              <h2 className="mb-2 flex items-center justify-between px-1 pt-1 text-sm font-semibold text-neutral-200">
                {LABELS.serviceStatus[status]}
                <span className="text-xs font-normal text-neutral-500 tabular-nums">{col.length}</span>
              </h2>
              <ul className="flex-1 space-y-2">
                {col.map((o) => (
                  <li
                    key={o.id}
                    draggable={canManage}
                    onDragStart={(e) => {
                      setDragging(o.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                    className={cx(
                      "rounded-lg border bg-neutral-900 p-3 text-sm shadow-sm",
                      canManage && "cursor-grab active:cursor-grabbing",
                      dragging === o.id ? "opacity-50" : "",
                      notice?.orderId === o.id ? "border-brand-600" : "border-neutral-800",
                    )}
                  >
                    <Link href={`/taller/${o.id}`} className="block rounded hover:opacity-80">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-base font-semibold text-neutral-50">#{o.id}</span>
                        <span className="rounded border border-neutral-700 px-1.5 text-xs font-medium tracking-wide text-neutral-300">
                          {o.motorcycle.plate ?? "sin placa"}
                        </span>
                      </div>
                      <p className="mt-1 font-medium text-neutral-100">{o.motorcycle.customer.name}</p>
                      <p className="text-xs text-neutral-500">
                        {o.motorcycle.model.brand.name} {o.motorcycle.model.name} · {o.motorcycle.color}
                        {o.odometerKm != null && ` · ${o.odometerKm.toLocaleString("es-NI")} km`}
                      </p>
                      <ul className="mt-1.5 flex flex-wrap gap-1">
                        {o.items.map((i) => (
                          <li key={i.id} className="rounded bg-neutral-800 px-1.5 py-0.5 text-[11px] text-neutral-300">
                            {i.serviceType.name}
                          </li>
                        ))}
                      </ul>
                      {o.requestedWork && <p className="mt-1 line-clamp-2 text-xs text-neutral-500">«{o.requestedWork}»</p>}
                      {WAITING.includes(o.status) && o.statusChanges[0]?.notes && (
                        <p className="text-warn-fg mt-1 text-xs">{o.statusChanges[0].notes}</p>
                      )}
                    </Link>
                    {canManage ? (
                      <div className="mt-2 space-y-1.5 border-t border-neutral-800 pt-2">
                        <Select
                          aria-label={`Estado de la orden ${o.id}`}
                          className="h-9 py-1 text-xs"
                          value={o.status}
                          disabled={change.isPending}
                          onChange={(e) => moveTo(o, e.target.value as MovableStatus)}
                        >
                          {o.status === "RECIBIDA" && <option value="RECIBIDA">Recibida</option>}
                          {COLUMNS.map((s) => (
                            <option key={s} value={s}>
                              {LABELS.serviceStatus[s]}
                            </option>
                          ))}
                        </Select>
                        <ResponsibleSelect
                          compact
                          value={o.mechanicStaffId ?? 0}
                          emptyLabel="Sin responsable"
                          disabled={assign.isPending}
                          onChange={(id) => id && assign.mutate({ serviceOrderId: o.id, mechanicStaffId: id })}
                        />
                      </div>
                    ) : (
                      <div className="mt-2">
                        {o.mechanic ? <span className="text-xs text-neutral-300">{o.mechanic.name}</span> : <Badge tone="amber">Sin responsable</Badge>}
                      </div>
                    )}
                    <p className="mt-1.5 text-right text-[11px] text-neutral-500">{formatDateTime(o.statusChanges[0]?.changedAt)}</p>
                  </li>
                ))}
                {col.length === 0 && <li className="px-1 pb-2 text-xs text-neutral-500">{dragging ? "Suelte aquí" : "Ninguna"}</li>}
              </ul>
            </section>
          );
        })}
      </div>
      <Dialog open={receiving} onClose={() => setReceiving(false)} title="Recibir moto" size="xl">
        <ReceiveForm
          onDone={(id) => {
            setReceiving(false);
            setNotice({ text: `Moto recibida: orden #${id}.`, orderId: id });
          }}
        />
      </Dialog>
    </>
  );
}
