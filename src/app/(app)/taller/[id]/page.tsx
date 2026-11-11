"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { queueServiceBill } from "~/app/(app)/ventas/tabs-store";
import { ResponsibleSelect } from "~/app/_components/pickers";
import { ServiceCatalogPicker } from "~/app/_components/service-catalog";
import { cleanTerms, emptyTerms, type Terms, TermsForm } from "~/app/_components/terms-form";
import { Alert, BackBar, Badge, Button, Card, Dialog, Field, Input, PageTitle, Select, Table, Textarea } from "~/app/_components/ui";
import { errorMessage } from "~/lib/errors";
import { formatDateTime, money } from "~/lib/format";
import { FINISHED_SERVICE_STATUSES, LABELS, type ServiceOrderStatus } from "~/server/domain/constants";
import { api, type RouterInputs } from "~/trpc/react";

type MovableStatus = RouterInputs["service"]["changeStatus"]["status"];
const MOVABLE: MovableStatus[] = ["EN_DIAGNOSTICO", "EN_PROCESO", "ESPERA_REPUESTO", "ESPERA_CLIENTE", "TERMINADA", "EN_PRUEBA"];

/** CLI-007 — Order detail: mechanic, status, diagnosis, additional faults, close & bill, cancel. */
export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const orderId = Number(id);
  const me = api.auth.me.useQuery();
  const utils = api.useUtils();
  const order = api.service.get.useQuery({ id: orderId });
  const refresh = () => void utils.service.invalidate();
  const assign = api.service.assignMechanic.useMutation({ onSuccess: refresh });
  const change = api.service.changeStatus.useMutation({ onSuccess: refresh });
  const diag = api.service.setDiagnosis.useMutation({ onSuccess: refresh });
  const addFault = api.service.addFault.useMutation({ onSuccess: () => { setFault({ description: "", price: "" }); refresh(); } });
  const decide = api.service.decideFault.useMutation({ onSuccess: refresh });
  const setItems = api.service.setItems.useMutation({ onSuccess: () => { setEditingJobs(null); refresh(); } });
  const setKm = api.service.setOdometer.useMutation({ onSuccess: () => { setKmDraft(null); refresh(); } });
  const [editingJobs, setEditingJobs] = useState<{ id: number; name: string }[] | null>(null);
  const [kmDraft, setKmDraft] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState<string | null>(null);
  const [fault, setFault] = useState({ description: "", price: "" });
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);

  const o = order.data;
  if (order.error) return <Alert>{errorMessage(order.error)}</Alert>;
  if (!o) return <p className="text-neutral-400">Cargando…</p>;
  const perms = me.data?.permissions ?? [];
  const open = o.status !== "ENTREGADA" && o.status !== "CANCELADA";
  const canManage = open && perms.includes("taller.gestionar");
  const err = assign.error ?? change.error ?? diag.error ?? addFault.error ?? decide.error ?? setItems.error ?? setKm.error;

  return (
    <>
      <BackBar crumbs={[{ label: "Taller", href: "/taller" }, { label: `Orden #${o.id}` }]} back={{ href: "/taller", label: "Volver al taller" }} />
      <PageTitle
        title={`Orden #${o.id}`}
        subtitle={`${o.motorcycle.customer.name} · ${o.motorcycle.customer.phone} · ${o.motorcycle.model.brand.name} ${o.motorcycle.model.name} ${o.motorcycle.color} · ${o.motorcycle.plate ?? "sin placa"}`}
        actions={
          <div className="flex gap-2">
            <Badge tone={open ? "amber" : o.status === "ENTREGADA" ? "green" : "red"}>{LABELS.serviceStatus[o.status]}</Badge>
            {o.saleInvoice && (
              <a className="text-sm text-brand-600" href={`/ventas/${o.saleInvoice.id}`}>
                Factura #{o.saleInvoice.id} →
              </a>
            )}
          </div>
        }
      />
      {err && <Alert>{errorMessage(err)}</Alert>}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card
          title="Trabajos"
          actions={
            canManage &&
            editingJobs === null && (
              <Button variant="ghost" onClick={() => setEditingJobs(o.items.map((i) => ({ id: i.serviceType.id, name: i.serviceType.name })))}>
                Cambiar trabajos
              </Button>
            )
          }
        >
          {editingJobs ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {editingJobs.map((j) => (
                  <span key={j.id} className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-3 py-1 text-sm text-white">
                    {j.name}
                    <button type="button" aria-label={`Quitar ${j.name}`} className="ml-1 rounded-full px-1 hover:bg-white/20" onClick={() => setEditingJobs(editingJobs.filter((x) => x.id !== j.id))}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <ServiceCatalogPicker
                selected={editingJobs.map((j) => j.id)}
                onToggle={(t) =>
                  setEditingJobs(editingJobs.some((j) => j.id === t.id) ? editingJobs.filter((j) => j.id !== t.id) : [...editingJobs, { id: t.id, name: t.name }])
                }
              />
              <div className="flex gap-2">
                <Button disabled={editingJobs.length === 0 || setItems.isPending} onClick={() => setItems.mutate({ serviceOrderId: o.id, items: editingJobs.map((j) => ({ serviceTypeId: j.id })) })}>
                  Guardar trabajos
                </Button>
                <Button variant="ghost" onClick={() => setEditingJobs(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {o.items.map((i) => (
                <li key={i.id} className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm">
                  <span className="font-medium">{i.serviceType.name}</span>{" "}
                  <span className="text-xs text-neutral-500">{i.serviceType.category.name}</span>
                </li>
              ))}
            </ul>
          )}
          {o.requestedWork && (
            <p className="mt-3 text-sm text-neutral-400">
              Nota del cliente: <span className="text-neutral-200">«{o.requestedWork}»</span>
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-end gap-3 text-sm">
            {kmDraft === null ? (
              <p>
                Kilometraje: <span className="font-medium">{o.odometerKm != null ? `${o.odometerKm.toLocaleString("es-NI")} km` : "no registrado"}</span>{" "}
                {canManage && (
                  <button type="button" className="text-brand-600 hover:underline" onClick={() => setKmDraft(o.odometerKm?.toString() ?? "")}>
                    cambiar
                  </button>
                )}
              </p>
            ) : (
              <>
                <Field label="Kilometraje">
                  <Input inputMode="numeric" className="w-36" value={kmDraft} onChange={(e) => setKmDraft(e.target.value.replace(/\D/g, "").slice(0, 7))} />
                </Field>
                <Button variant="secondary" onClick={() => setKm.mutate({ serviceOrderId: o.id, odometerKm: kmDraft ? Number(kmDraft) : null })}>
                  Guardar
                </Button>
                <Button variant="ghost" onClick={() => setKmDraft(null)}>
                  Cancelar
                </Button>
              </>
            )}
            {o.motorcycle.chassisNumber && <p className="text-neutral-400">Chasis: {o.motorcycle.chassisNumber}</p>}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field
              label="Responsable"
              hint={
                o.mechanic
                  ? o.appliedCommissionRate
                    ? `Cobra ${Math.round(Number(o.appliedCommissionRate.toString()) * 100)} % de la mano de obra`
                    : "Sin comisión"
                  : "Mecánico o dueño"
              }
            >
              <ResponsibleSelect
                disabled={!canManage}
                value={o.mechanicStaffId ?? 0}
                emptyLabel="Sin asignar"
                onChange={(id) => id && assign.mutate({ serviceOrderId: o.id, mechanicStaffId: id })}
              />
            </Field>
            <Field label="Cambiar estado">
              <Select
                disabled={!canManage}
                value=""
                onChange={(e) => e.target.value && change.mutate({ serviceOrderId: o.id, status: e.target.value as MovableStatus })}
              >
                <option value="">Elegir…</option>
                {MOVABLE.filter((s) => s !== o.status).map((s) => (
                  <option key={s} value={s}>
                    {LABELS.serviceStatus[s]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Diagnóstico">
            <Textarea disabled={!canManage} value={diagnosis ?? o.diagnosis ?? ""} onChange={(e) => setDiagnosis(e.target.value)} />
          </Field>
          {canManage && diagnosis !== null && (
            <Button variant="secondary" className="mt-2" onClick={() => diag.mutate({ serviceOrderId: o.id, diagnosis })}>
              Guardar diagnóstico
            </Button>
          )}
          {open && perms.includes("taller.facturar") && (
            <div className="mt-6 flex gap-2">
              <Button
                onClick={() => {
                  if (!me.data) return;
                  queueServiceBill(
                    me.data.username,
                    o.id,
                    `${o.motorcycle.model.brand.name} ${o.motorcycle.model.name}${o.motorcycle.plate ? ` · ${o.motorcycle.plate}` : ""}`,
                    { id: o.motorcycle.customer.id, name: o.motorcycle.customer.name, phone: o.motorcycle.customer.phone },
                  );
                  router.push("/ventas");
                }}
              >
                Cobrar en caja
              </Button>
              {/* A finished order is charged, not cancelled (DEC-051). */}
              {!FINISHED_SERVICE_STATUSES.includes(o.status) && (
                <Button variant="danger" onClick={() => setCancelling(true)}>
                  Cancelar orden
                </Button>
              )}
            </div>
          )}
        </Card>

        <Card title="Fallas adicionales">
          <Table head={["#", "Descripción", "Precio", "Decisión"]} empty={o.additionalFaults.length === 0}>
            {o.additionalFaults.map((f) => (
              <tr key={f.id}>
                <td>{f.faultNo}</td>
                <td>{f.description}</td>
                <td>{f.proposedPrice ? money(f.proposedPrice) : "—"}</td>
                <td>
                  {canManage ? (
                    <Select
                      value={f.decision}
                      onChange={(e) => decide.mutate({ additionalFaultId: f.id, decision: e.target.value as "PENDIENTE" | "ACEPTADA" | "RECHAZADA" })}
                    >
                      <option value="PENDIENTE">Pendiente</option>
                      <option value="ACEPTADA">Aceptada</option>
                      <option value="RECHAZADA">Rechazada</option>
                    </Select>
                  ) : (
                    <Badge>{f.decision}</Badge>
                  )}
                </td>
              </tr>
            ))}
          </Table>
          {canManage && (
            <div className="mt-3 grid grid-cols-[1fr_120px_auto] gap-2">
              <Input placeholder="Nueva falla encontrada" value={fault.description} onChange={(e) => setFault({ ...fault, description: e.target.value })} />
              <Input placeholder="Precio" inputMode="decimal" value={fault.price} onChange={(e) => setFault({ ...fault, price: e.target.value })} />
              <Button
                variant="secondary"
                disabled={!fault.description}
                onClick={() => addFault.mutate({ serviceOrderId: o.id, description: fault.description, proposedPrice: fault.price || undefined })}
              >
                Agregar
              </Button>
            </div>
          )}
        </Card>

        <MotorcycleHistory motorcycleId={o.motorcycle.id} currentOrderId={o.id} />

        <Card title="Cambios de estado de esta orden" className="lg:col-span-2">
          <ul className="space-y-1 text-sm">
            {o.statusChanges.map((s) => (
              <li key={s.id}>
                <span className="text-neutral-500">{formatDateTime(s.changedAt)}</span> · {LABELS.serviceStatus[s.status as ServiceOrderStatus]}{" "}
                <span className="text-neutral-500">({s.registeredBy.username})</span> {s.notes && `— ${s.notes}`}
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <Dialog open={cancelling} onClose={() => setCancelling(false)} title={`Cancelar orden #${o.id}`}>
        <CancelForm orderId={o.id} onDone={() => { setCancelling(false); refresh(); }} />
      </Dialog>
    </>
  );
}

function MotorcycleHistory({ motorcycleId, currentOrderId }: { motorcycleId: number; currentOrderId: number }) {
  const history = api.service.motorcycleHistory.useQuery({ motorcycleId });
  const past = (history.data ?? []).filter((h) => h.id !== currentOrderId);
  return (
    <Card title="Historial de la moto" className="lg:col-span-2">
      {past.length === 0 ? (
        <p className="text-sm text-neutral-500">Es la primera vez que esta moto viene al taller.</p>
      ) : (
        <Table head={["Orden", "Fecha", "Km", "Trabajos", "Repuestos", "Responsable", "Estado"]}>
          {past.map((h) => (
            <tr key={h.id}>
              <td>
                <Link href={`/taller/${h.id}`} className="hover:text-brand-600">
                  #{h.id}
                </Link>
              </td>
              <td>{formatDateTime(h.date)}</td>
              <td className="tabular-nums">{h.odometerKm != null ? h.odometerKm.toLocaleString("es-NI") : "—"}</td>
              <td>{h.jobs.join(", ")}</td>
              <td className="text-neutral-400">{h.parts.join(", ") || "—"}</td>
              <td>{h.responsible ?? "—"}</td>
              <td>
                <Badge tone={h.status === "ENTREGADA" ? "green" : h.status === "CANCELADA" ? "red" : "amber"}>{LABELS.serviceStatus[h.status]}</Badge>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
}

function CancelForm({ orderId, onDone }: { orderId: number; onDone: () => void }) {
  const [notes, setNotes] = useState("");
  const [fee, setFee] = useState("");
  const [terms, setTerms] = useState<Terms>(emptyTerms);
  const cancel = api.service.cancel.useMutation({ onSuccess: onDone });
  return (
    <div className="space-y-3">
      <Field label="Motivo">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <Field label="Cargo por cancelación (opcional, C$)">
        <Input inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} />
      </Field>
      {fee && <TermsForm terms={terms} onChange={setTerms} needsAuthorization={false} />}
      <Alert>{cancel.error && errorMessage(cancel.error)}</Alert>
      <Button
        variant="danger"
        className="w-full"
        disabled={!notes || cancel.isPending}
        onClick={() =>
          cancel.mutate({ serviceOrderId: orderId, notes, cancellationFee: fee || undefined, terms: fee ? cleanTerms(terms) : undefined })
        }
      >
        Cancelar orden
      </Button>
    </div>
  );
}
