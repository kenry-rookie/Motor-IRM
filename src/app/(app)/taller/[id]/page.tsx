"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

import { ProductSearch } from "~/app/_components/pickers";
import { cleanTerms, emptyTerms, type Terms, TermsForm } from "~/app/_components/terms-form";
import { Alert, Badge, Button, Card, Dialog, Field, Input, PageTitle, Select, Table, Textarea } from "~/app/_components/ui";
import { errorMessage } from "~/lib/errors";
import { dec, formatDateTime, money } from "~/lib/format";
import { LABELS, type ServiceOrderStatus } from "~/server/domain/constants";
import { api, type RouterInputs, type RouterOutputs } from "~/trpc/react";

type Product = RouterOutputs["inventory"]["listProducts"]["items"][number];
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
  const [closing, setClosing] = useState(false);
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
              <a className="text-sm text-amber-400" href={`/ventas/${o.saleInvoice.id}`}>
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
              <Button onClick={() => setClosing(true)}>Cerrar y cobrar</Button>
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
      <Dialog open={closing} onClose={() => setClosing(false)} title={`Cerrar y cobrar orden #${o.id}`}>
        <CloseForm
          orderId={o.id}
          acceptedFaults={o.additionalFaults.filter((f) => f.decision === "ACEPTADA").map((f) => ({ label: f.description, price: f.proposedPrice?.toString() ?? "0" }))}
          onDone={() => {
            setClosing(false);
            refresh();
          }}
        />
      </Dialog>
      <Dialog open={cancelling} onClose={() => setCancelling(false)} title={`Cancelar orden #${o.id}`}>
        <CancelForm orderId={o.id} onDone={() => { setCancelling(false); refresh(); }} />
      </Dialog>
    </>
  );
}

function CloseForm({ orderId, acceptedFaults, onDone }: { orderId: number; acceptedFaults: { label: string; price: string }[]; onDone: () => void }) {
  const me = api.auth.me.useQuery();
  const types = api.admin.serviceTypes.useQuery();
  const [labor, setLabor] = useState<{ serviceTypeId?: number; description: string; price: string }[]>([]);
  const [parts, setParts] = useState<{ product: Product; quantity: number }[]>([]);
  const [external, setExternal] = useState<{ description: string; price: string }[]>([]);
  const [terms, setTerms] = useState<Terms>(emptyTerms);
  const close = api.service.close.useMutation({ onSuccess: onDone });
  const perms = me.data?.permissions ?? [];
  const total = [
    ...labor.map((l) => dec(l.price || 0)),
    ...acceptedFaults.map((f) => dec(f.price)),
    ...parts.map((p) => dec(p.product.listPrice).times(p.quantity)),
    ...external.map((e) => dec(e.price || 0)),
  ].reduce((a, b) => a.plus(b), dec(0));

  return (
    <div className="space-y-4">
      <section>
        <h3 className="mb-2 text-sm font-semibold">Mano de obra</h3>
        {labor.map((l, i) => (
          <div key={i} className="mb-2 grid grid-cols-[1fr_110px_auto] gap-2">
            <Input value={l.description} onChange={(e) => setLabor(labor.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
            <Input inputMode="decimal" value={l.price} onChange={(e) => setLabor(labor.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />
            <Button variant="ghost" onClick={() => setLabor(labor.filter((_, j) => j !== i))}>
              ✕
            </Button>
          </div>
        ))}
        <Select
          value=""
          onChange={(e) => {
            const t = types.data?.find((x) => x.id === Number(e.target.value));
            setLabor([...labor, { serviceTypeId: t?.id, description: t?.name ?? "Mano de obra", price: t?.referencePrice?.toString() ?? "" }]);
          }}
        >
          <option value="">+ Agregar servicio…</option>
          {types.data
            ?.filter((t) => t.active)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} {t.referencePrice ? `(${money(t.referencePrice)})` : ""}
              </option>
            ))}
          <option value="0">Otro (escribir)</option>
        </Select>
        {acceptedFaults.length > 0 && (
          <p className="mt-2 text-xs text-neutral-400">
            Se cobran también las fallas aceptadas: {acceptedFaults.map((f) => `${f.label} (${money(f.price)})`).join(", ")}
          </p>
        )}
      </section>
      <section>
        <h3 className="mb-2 text-sm font-semibold">Repuestos usados</h3>
        <ProductSearch placeholder="Buscar repuesto…" onPick={(p) => setParts([...parts, { product: p, quantity: 1 }])} />
        {parts.map((p, i) => (
          <div key={i} className="mt-2 flex items-center gap-2 text-sm">
            <span className="flex-1">{p.product.name}</span>
            <Input type="number" min={1} className="w-20" value={p.quantity} onChange={(e) => setParts(parts.map((x, j) => (j === i ? { ...x, quantity: Math.max(1, Number(e.target.value) || 1) } : x)))} />
            <span className="w-24 text-right">{money(dec(p.product.listPrice).times(p.quantity))}</span>
            <Button variant="ghost" onClick={() => setParts(parts.filter((_, j) => j !== i))}>
              ✕
            </Button>
          </div>
        ))}
      </section>
      <section>
        <h3 className="mb-2 text-sm font-semibold">Cargos externos (torno, soldadura…)</h3>
        {external.map((x, i) => (
          <div key={i} className="mb-2 grid grid-cols-[1fr_110px_auto] gap-2">
            <Input value={x.description} onChange={(e) => setExternal(external.map((y, j) => (j === i ? { ...y, description: e.target.value } : y)))} />
            <Input inputMode="decimal" value={x.price} onChange={(e) => setExternal(external.map((y, j) => (j === i ? { ...y, price: e.target.value } : y)))} />
            <Button variant="ghost" onClick={() => setExternal(external.filter((_, j) => j !== i))}>
              ✕
            </Button>
          </div>
        ))}
        <Button variant="secondary" onClick={() => setExternal([...external, { description: "", price: "" }])}>
          + Cargo externo
        </Button>
      </section>
      <TermsForm
        terms={terms}
        onChange={setTerms}
        customer={null}
        lockCustomer
        needsAuthorization={terms.paymentTerms === "CREDITO" && !perms.includes("ventas.autorizar_credito")}
      />
      <div className="flex items-baseline justify-between border-t border-neutral-800 pt-3">
        <span className="text-neutral-400">Total estimado</span>
        <span className="text-2xl font-bold">{money(total)}</span>
      </div>
      <Alert>{close.error && errorMessage(close.error)}</Alert>
      <Button
        className="w-full"
        disabled={close.isPending}
        onClick={() =>
          close.mutate({
            serviceOrderId: orderId,
            terms: cleanTerms(terms),
            labor: labor.filter((l) => l.description && l.price).map((l) => ({ serviceTypeId: l.serviceTypeId, description: l.description, price: l.price })),
            parts: parts.map((p) => ({ productId: p.product.id, quantity: p.quantity })),
            externalCharges: external.filter((x) => x.description && x.price),
          })
        }
      >
        Facturar y entregar
      </Button>
    </div>
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
      {fee && <TermsForm terms={terms} onChange={setTerms} customer={null} lockCustomer needsAuthorization={false} />}
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
