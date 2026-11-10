"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { queueServiceBill } from "~/app/(app)/ventas/tabs-store";
import { cleanTerms, emptyTerms, type Terms, TermsForm } from "~/app/_components/terms-form";
import { Alert, Badge, Button, Card, Dialog, Field, Input, PageTitle, Select, Table, Textarea } from "~/app/_components/ui";
import { errorMessage } from "~/lib/errors";
import { formatDateTime, money } from "~/lib/format";
import { LABELS, type ServiceOrderStatus } from "~/server/domain/constants";
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
  const staff = api.staff.list.useQuery();
  const refresh = () => void utils.service.invalidate();
  const assign = api.service.assignMechanic.useMutation({ onSuccess: refresh });
  const change = api.service.changeStatus.useMutation({ onSuccess: refresh });
  const diag = api.service.setDiagnosis.useMutation({ onSuccess: refresh });
  const addFault = api.service.addFault.useMutation({ onSuccess: () => { setFault({ description: "", price: "" }); refresh(); } });
  const decide = api.service.decideFault.useMutation({ onSuccess: refresh });
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
  const err = assign.error ?? change.error ?? diag.error ?? addFault.error ?? decide.error;

  return (
    <>
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
        <Card title="Trabajo">
          <p className="text-sm">{o.requestedWork}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Mecánico">
              <Select
                disabled={!canManage}
                value={o.mechanicStaffId ?? 0}
                onChange={(e) => assign.mutate({ serviceOrderId: o.id, mechanicStaffId: Number(e.target.value) })}
              >
                <option value={0}>Sin asignar</option>
                {staff.data
                  ?.filter((s) => s.commissionRate)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </Select>
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
              <Button variant="danger" onClick={() => setCancelling(true)}>
                Cancelar orden
              </Button>
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

        <Card title="Historial" className="lg:col-span-2">
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
