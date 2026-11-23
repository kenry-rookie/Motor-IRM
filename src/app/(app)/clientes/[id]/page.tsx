"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { MotorcycleModelSelect } from "~/app/_components/pickers";
import { PrintLink } from "~/app/_components/print-link";
import { confirmDialog } from "~/app/_components/confirm";
import { PrintPrompt } from "~/app/_components/print-prompt";
import { Alert, BackBar, Badge, Button, Card, Dialog, Field, Input, PageTitle, PhoneInput, SearchField, Segmented, Select, Table } from "~/app/_components/ui";
import { docNo, invoiceNo, parseDocNo } from "~/lib/business";
import { errorMessage, fieldErrors } from "~/lib/errors";
import { useExchangeRate } from "~/lib/exchange-rate";
import { addDaysISO, dec, formatDateTime, formatDay, money, todayISO, usdOf } from "~/lib/format";
import { LABELS, type ServiceOrderStatus } from "~/server/domain/constants";
import { api, type RouterOutputs } from "~/trpc/react";

/**
 * CLI-009 account statement · CLI-010 register a payment and spread it.
 * Kenry, 23-nov: search INSIDE the customer (number, product, job, plate,
 * dates, state), plus their motorcycles, workshop orders and editing.
 */
type Statement = RouterOutputs["customer"]["statement"];
type InvoiceRow = Statement["invoices"][number];
type State = "TODAS" | "PENDIENTES" | "PAGADAS" | "VENCIDAS";

export default function CustomerPage() {
  const { id } = useParams<{ id: string }>();
  const customerId = Number(id);
  const me = api.auth.me.useQuery();
  const st = api.customer.statement.useQuery({ customerId });
  const utils = api.useUtils();
  const [paying, setPaying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [moto, setMoto] = useState<Statement["motorcycles"][number] | "new" | null>(null);
  const [opening, setOpening] = useState(false);
  const [paid, setPaid] = useState<{ id: number; amount: string; currency: string } | null>(null);
  const [f, setF] = useState({ text: "", state: "TODAS" as State, terms: "TODAS" as "TODAS" | "CONTADO" | "CREDITO", origin: "TODAS" as "TODAS" | "MOSTRADOR" | "TALLER", from: "", to: "" });
  const removeMoto = api.customer.removeMotorcycle.useMutation({ onSuccess: () => void utils.customer.invalidate() });
  const restoreMoto = api.customer.restoreMotorcycle.useMutation({ onSuccess: () => void utils.customer.invalidate() });
  if (st.error) return <Alert>{errorMessage(st.error)}</Alert>;
  const d = st.data;
  if (!d) return <p className="text-neutral-400">Cargando…</p>;
  const perms = me.data?.permissions ?? [];
  const canManage = perms.includes("clientes.gestionar");
  const activeMotos = d.motorcycles.filter((m) => !m.releasedAt);
  const oldMotos = d.motorcycles.filter((m) => m.releasedAt);

  const q = norm(f.text);
  const doc = parseDocNo(f.text);
  const motoText = (motorcycleId: number) => {
    const m = d.motorcycles.find((x) => x.id === motorcycleId);
    return m ? `${m.model.brand.name} ${m.model.name} ${m.color} ${m.plate ?? ""}` : "";
  };
  const orderOf = (inv: InvoiceRow) => (inv.serviceOrderId ? d.orders.find((o) => o.id === inv.serviceOrderId) : undefined);
  const day = (x: Date | string) => new Date(x).toISOString().slice(0, 10);
  const inRange = (x: Date | string | null) => !x || ((!f.from || day(x) >= f.from) && (!f.to || day(x) <= f.to));
  const invoices = d.invoices.filter((i) => {
    if (f.state === "PENDIENTES" && !dec(i.balance).gt(0)) return false;
    if (f.state === "PAGADAS" && (dec(i.balance).gt(0) || i.voided)) return false;
    if (f.state === "VENCIDAS" && !i.overdue) return false;
    if (f.terms !== "TODAS" && i.paymentTerms !== f.terms) return false;
    if (f.origin === "TALLER" && !i.serviceOrderId) return false;
    if (f.origin === "MOSTRADOR" && i.serviceOrderId) return false;
    if (!inRange(i.createdAt)) return false;
    if (!q) return true;
    if (doc && (!doc.kind || doc.kind === "factura") && doc.id === i.id) return true;
    const o = orderOf(i);
    return norm(`${invoiceNo(i)} ${i.items} ${o ? `${docNo("orden", o.id)} ${o.jobs} ${motoText(o.motorcycleId)}` : ""}`).includes(q);
  });
  const payments = d.payments.filter(
    (p) =>
      inRange(p.paidAt) &&
      (!q ||
        (!!doc && (!doc.kind || doc.kind === "recibo") && doc.id === p.id) ||
        norm(`${docNo("recibo", p.id)} ${p.method} ${p.invoiceIds.map((x) => invoiceNo({ id: x })).join(" ")}`).includes(q)),
  );
  const orders = d.orders.filter(
    (o) =>
      inRange(o.receivedAt) &&
      (f.origin !== "MOSTRADOR") &&
      (!q || (!!doc && (!doc.kind || doc.kind === "orden") && doc.id === o.id) || norm(`${docNo("orden", o.id)} ${o.jobs} ${motoText(o.motorcycleId)}`).includes(q)),
  );
  const filtering = f.text || f.state !== "TODAS" || f.terms !== "TODAS" || f.origin !== "TODAS" || f.from || f.to;

  return (
    <>
      <BackBar crumbs={[{ label: "Clientes", href: "/clientes" }, { label: d.customer.name }]} back={{ href: "/clientes", label: "Volver a clientes" }} />
      <PageTitle
        title={d.customer.name}
        subtitle={`${d.customer.phone}${d.customer.nationalId ? ` · ${d.customer.nationalId}` : ""}${d.customer.address ? ` · ${d.customer.address}` : ""}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {canManage && (
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Editar datos
              </Button>
            )}
            {perms.includes("cobros.registrar") && dec(d.totalBalance).gt(0) && <Button onClick={() => setPaying(true)}>Registrar abono</Button>}
          </div>
        }
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-neutral-400">Saldo total</p>
          <p className="text-3xl font-bold">{money(d.totalBalance)}</p>
        </Card>
        <Card>
          <p className="text-sm text-neutral-400">Interés estimado</p>
          <p className="text-3xl font-bold">{money(d.totalInterest)}</p>
        </Card>
        <Card>
          <p className="text-sm text-neutral-400">Compras y visitas</p>
          <p className="text-3xl font-bold">{d.invoices.length}</p>
          <p className="text-xs text-neutral-500">
            {d.motorcycles.filter((m) => !m.releasedAt).length} moto(s) · {d.orders.length} orden(es) de taller
          </p>
        </Card>
      </div>

      <Card className="mb-4" title="Buscar en este cliente">
        <div className="flex flex-wrap items-end gap-3">
          <SearchField
            className="min-w-72 flex-1"
            label="Buscar en este cliente"
            placeholder="N.º de factura o recibo (F-12, R-5), producto, trabajo, placa…"
            value={f.text}
            onValue={(text) => setF({ ...f, text })}
          />
          <Field label="Desde">
            <Input type="date" value={f.from} max={f.to || undefined} onChange={(e) => setF({ ...f, from: e.target.value })} />
          </Field>
          <Field label="Hasta">
            <Input type="date" value={f.to} min={f.from || undefined} onChange={(e) => setF({ ...f, to: e.target.value })} />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          <Segmented
            label="Estado de la factura"
            value={f.state}
            onChange={(state) => setF({ ...f, state })}
            options={[
              { value: "TODAS", label: "Todas" },
              { value: "PENDIENTES", label: "Con saldo" },
              { value: "PAGADAS", label: "Pagadas" },
              { value: "VENCIDAS", label: "Vencidas" },
            ]}
          />
          <Segmented
            label="Contado o crédito"
            value={f.terms}
            onChange={(terms) => setF({ ...f, terms })}
            options={[
              { value: "TODAS", label: "Contado y crédito" },
              { value: "CONTADO", label: "Contado" },
              { value: "CREDITO", label: "Crédito" },
            ]}
          />
          <Segmented
            label="Mostrador o taller"
            value={f.origin}
            onChange={(origin) => setF({ ...f, origin })}
            options={[
              { value: "TODAS", label: "Todo" },
              { value: "MOSTRADOR", label: "Mostrador" },
              { value: "TALLER", label: "Taller" },
            ]}
          />
          {filtering && (
            <Button variant="ghost" onClick={() => setF({ text: "", state: "TODAS", terms: "TODAS", origin: "TODAS", from: "", to: "" })}>
              Quitar filtros
            </Button>
          )}
        </div>
      </Card>

      <Card title={`Facturas${filtering ? ` (${invoices.length} de ${d.invoices.length})` : ""}`}>
        <Table head={["Factura", "Fecha", "Tipo", "Qué fue", "Vence", "Total", "Devuelto", "Pagado", "Saldo"]} empty={invoices.length === 0}>
          {invoices.map((i) => (
            <tr key={i.id}>
              <td className="whitespace-nowrap">
                <Link className="text-brand-600 hover:underline" href={`/ventas/${i.id}`}>
                  {invoiceNo(i)}
                </Link>
                {i.voided && (
                  <div>
                    <Badge tone="red">Anulada</Badge>
                  </div>
                )}
              </td>
              <td>{formatDateTime(i.createdAt)}</td>
              <td>
                {i.paymentTerms === "CREDITO" ? "Crédito" : "Contado"}
                {i.serviceOrderId && <div className="text-xs text-neutral-500">Taller · {docNo("orden", i.serviceOrderId)}</div>}
              </td>
              <td className="max-w-72 truncate text-neutral-400" title={i.items}>
                {i.items || "—"}
              </td>
              <td>
                {formatDay(i.dueDate)} {i.overdue && <Badge tone="red">vencida</Badge>}
              </td>
              <td>{money(i.total)}</td>
              <td>{money(i.returned)}</td>
              <td>
                {money(i.paid)}
                {dec(i.refunded).gt(0) && <div className="text-xs text-neutral-500">− {money(i.refunded)} devuelto</div>}
              </td>
              <td className="font-semibold">{money(i.balance)}</td>
            </tr>
          ))}
        </Table>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title={`Abonos recibidos (${payments.length})`}>
          <Table head={["Recibo", "Fecha", "Pagó", "Forma de pago", "Monto", ""]} empty={payments.length === 0}>
            {payments.map((p) => (
              <tr key={p.id}>
                <td className="whitespace-nowrap font-medium">{docNo("recibo", p.id)}</td>
                <td>{formatDateTime(p.paidAt)}</td>
                <td className="text-neutral-400">
                  {[...p.invoiceIds.map((x) => invoiceNo({ id: x })), ...(p.toOpeningBalance ? ["Saldo anterior"] : [])].join(", ")}
                </td>
                <td>{p.method}</td>
                <td>{money(p.amount, p.currency === "USD" ? "USD" : "NIO")}</td>
                <td className="text-right">
                  <PrintLink className="text-brand-600 hover:underline" href={`/imprimir/abono/${p.id}?imprimir=1`}>
                    Imprimir recibo
                  </PrintLink>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
        <Card
          title={`Motos (${activeMotos.length})`}
          actions={
            canManage && (
              <Button variant="secondary" onClick={() => setMoto("new")}>
                + Agregar moto
              </Button>
            )
          }
        >
          <Table head={["Moto", "Color", "Placa", "Visitas al taller", ""]} empty={activeMotos.length === 0}>
            {activeMotos.map((m) => {
              const visits = d.orders.filter((o) => o.motorcycleId === m.id);
              const inShop = visits.some((o) => o.status !== "ENTREGADA" && o.status !== "CANCELADA");
              return (
                <tr key={m.id}>
                  <td>
                    {m.model.brand.name} {m.model.name}
                    {inShop && (
                      <span className="ml-2">
                        <Badge tone="amber">en el taller</Badge>
                      </span>
                    )}
                  </td>
                  <td>{m.color}</td>
                  <td>{m.plate ?? "—"}</td>
                  <td className="tabular-nums">{visits.length}</td>
                  <td className="text-right whitespace-nowrap">
                    {canManage && (
                      <>
                        <Button variant="ghost" onClick={() => setMoto(m)}>
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={inShop || removeMoto.isPending}
                          title={inShop ? "Está en el taller: entréguela o cancele la orden primero" : undefined}
                          onClick={async () => {
                            const name = `${m.model.brand.name} ${m.model.name}${m.plate ? ` (${m.plate})` : ""}`;
                            const msg =
                              visits.length === 0
                                ? `La ${name} nunca entró al taller: se elimina del cliente.`
                                : `La ${name} deja de salir en las motos de ${d.customer.name} y al recibir motos.\n\n` +
                                  `Sus ${visits.length} visita(s) al taller y sus facturas se quedan en su historial, porque ese trabajo sí fue suyo.\n` +
                                  "La placa queda libre para registrarla con su dueño nuevo.";
                            if (await confirmDialog(msg, { title: "¿Quitar la moto?", confirmLabel: "Sí, quitarla", danger: true }))
                              removeMoto.mutate({ id: m.id, note: "Ya no es del cliente" });
                          }}
                        >
                          Quitar
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
          {removeMoto.error && (
            <div className="mt-2">
              <Alert>{errorMessage(removeMoto.error)}</Alert>
            </div>
          )}
          {oldMotos.length > 0 && (
            <div className="mt-4">
              <p className="mb-1 text-sm font-medium text-neutral-400">Motos que ya no son suyas (su historial se conserva)</p>
              <ul className="space-y-1 text-sm">
                {oldMotos.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-neutral-800/30 px-3 py-1.5">
                    <span className="text-neutral-400">
                      {m.model.brand.name} {m.model.name} · {m.color} · {m.plate ?? "sin placa"} · quitada el {formatDateTime(m.releasedAt)}
                    </span>
                    {canManage && (
                      <Button
                        variant="ghost"
                        disabled={restoreMoto.isPending}
                        onClick={async () => {
                          if (await confirmDialog("¿Volver a poner esta moto como del cliente? Úselo solo si se quitó por error.", { title: "Devolver la moto", confirmLabel: "Sí, es suya" }))
                            restoreMoto.mutate({ id: m.id });
                        }}
                      >
                        Es suya otra vez
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
              {restoreMoto.error && <Alert>{errorMessage(restoreMoto.error)}</Alert>}
            </div>
          )}
        </Card>
      </div>

      {d.orders.length > 0 && (
        <Card title={`Órdenes del taller (${orders.length})`} className="mt-4">
          <Table head={["Orden", "Recibida", "Moto", "Trabajos", "Estado", "Factura"]} empty={orders.length === 0}>
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="whitespace-nowrap">
                  <Link className="text-brand-600 hover:underline" href={`/taller/${o.id}`}>
                    {docNo("orden", o.id)}
                  </Link>
                </td>
                <td>{formatDateTime(o.receivedAt)}</td>
                <td>{motoText(o.motorcycleId)}</td>
                <td className="max-w-72 text-neutral-400">{o.jobs || "—"}</td>
                <td>{o.status ? (LABELS.serviceStatus[o.status as ServiceOrderStatus] ?? o.status) : "—"}</td>
                <td>
                  {o.saleInvoiceId ? (
                    <Link className="hover:text-brand-600" href={`/ventas/${o.saleInvoiceId}`}>
                      {invoiceNo({ id: o.saleInvoiceId })}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      <Card
        title="Saldos iniciales (deudas anteriores al sistema)"
        className="mt-4"
        collapsible
        defaultOpen={d.openingBalances.length > 0}
        actions={
          canManage && (
            <Button variant="secondary" onClick={() => setOpening(true)}>
              + Agregar saldo inicial
            </Button>
          )
        }
      >
        <Table head={["Desde", "Vence", "Monto", "Saldo", "Nota"]} empty={d.openingBalances.length === 0}>
          {d.openingBalances.map((o) => (
            <tr key={o.id}>
              <td>{formatDay(o.asOfDate)}</td>
              <td>
                {formatDay(o.dueDate)} {o.overdue && <Badge tone="red">vencido</Badge>}
              </td>
              <td>{money(o.amount)}</td>
              <td className="font-semibold">{money(o.balance)}</td>
              <td className="text-neutral-400">{o.notes}</td>
            </tr>
          ))}
        </Table>
      </Card>

      <Dialog open={paying} onClose={() => setPaying(false)} title={`Abono de ${d.customer.name}`} size="lg">
        <PaymentForm
          customerId={customerId}
          onDone={(p) => {
            setPaying(false);
            setPaid(p);
          }}
        />
      </Dialog>
      <Dialog open={editing} onClose={() => setEditing(false)} title="Editar datos del cliente" size="lg">
        {editing && <EditCustomer customer={d.customer} onDone={() => setEditing(false)} />}
      </Dialog>
      <Dialog open={moto !== null} onClose={() => setMoto(null)} title={moto === "new" ? "Agregar moto" : "Editar moto"} size="lg">
        {moto !== null && <MotoForm customerId={customerId} moto={moto === "new" ? null : moto} onDone={() => setMoto(null)} />}
      </Dialog>
      <Dialog open={opening} onClose={() => setOpening(false)} title="Saldo inicial (deuda de antes del sistema)" size="lg">
        {opening && <OpeningBalanceForm customerId={customerId} onDone={() => setOpening(false)} />}
      </Dialog>
      <PrintPrompt
        open={!!paid}
        title="Abono registrado"
        message={paid ? `Se registró el abono ${docNo("recibo", paid.id)} de ${money(paid.amount, paid.currency === "USD" ? "USD" : "NIO")}. ¿Imprimir el recibo para el cliente?` : ""}
        printLabel="Imprimir recibo"
        href={paid ? `/imprimir/abono/${paid.id}?imprimir=1` : ""}
        onClose={() => setPaid(null)}
      />
    </>
  );
}

/** Accent- and case-insensitive text for the in-customer search. */
const norm = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

function EditCustomer({ customer, onDone }: { customer: Statement["customer"]; onDone: () => void }) {
  const utils = api.useUtils();
  const [f, setF] = useState({
    name: customer.name,
    phone: customer.phone,
    nationalId: customer.nationalId ?? "",
    address: customer.address ?? "",
  });
  const save = api.customer.update.useMutation({
    onSuccess: () => {
      void utils.customer.invalidate();
      void utils.search.invalidate();
      onDone();
    },
  });
  const errs = fieldErrors(save.error);
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
      <div className="sm:col-span-2">
        <Alert>{save.error && errorMessage(save.error)}</Alert>
      </div>
      <Button
        className="sm:col-span-2"
        disabled={save.isPending || !f.name.trim()}
        onClick={() =>
          save.mutate({ id: customer.id, name: f.name, phone: f.phone, nationalId: f.nationalId || undefined, address: f.address || undefined })
        }
      >
        Guardar
      </Button>
    </div>
  );
}

function MotoForm({ customerId, moto, onDone }: { customerId: number; moto: Statement["motorcycles"][number] | null; onDone: () => void }) {
  const utils = api.useUtils();
  const [f, setF] = useState({
    motorcycleModelId: moto?.motorcycleModelId ?? 0,
    color: moto?.color ?? "",
    plate: moto?.plate ?? "",
    notes: moto?.notes ?? "",
  });
  const ok = () => {
    void utils.customer.invalidate();
    onDone();
  };
  const add = api.customer.addMotorcycle.useMutation({ onSuccess: ok });
  const update = api.customer.updateMotorcycle.useMutation({ onSuccess: ok });
  const err = add.error ?? update.error;
  const errs = fieldErrors(err);
  const data = { customerId, motorcycleModelId: f.motorcycleModelId, color: f.color, plate: f.plate || undefined, notes: f.notes || undefined };
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <MotorcycleModelSelect value={f.motorcycleModelId} onChange={(motorcycleModelId) => setF({ ...f, motorcycleModelId })} error={errs.motorcycleModelId} />
      <Field label="Color" error={errs.color}>
        <Input value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} />
      </Field>
      <Field label="Placa (opcional)" error={errs.plate}>
        <Input value={f.plate} onChange={(e) => setF({ ...f, plate: e.target.value })} />
      </Field>
      <Field label="Nota (opcional)">
        <Input value={f.notes} maxLength={200} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      </Field>
      <div className="sm:col-span-2">
        <Alert>{err && errorMessage(err)}</Alert>
      </div>
      <Button
        className="sm:col-span-2"
        disabled={!f.motorcycleModelId || !f.color.trim() || add.isPending || update.isPending}
        onClick={() => (moto ? update.mutate({ id: moto.id, ...data }) : add.mutate(data))}
      >
        Guardar moto
      </Button>
    </div>
  );
}

/** A debt the customer had before the system (paper or phone notes). */
function OpeningBalanceForm({ customerId, onDone }: { customerId: number; onDone: () => void }) {
  const utils = api.useUtils();
  const [f, setF] = useState({ asOfDate: todayISO(), amount: "", dueDate: addDaysISO(todayISO(), 30), notes: "" });
  const save = api.customer.addOpeningBalance.useMutation({
    onSuccess: () => {
      void utils.customer.invalidate();
      void utils.sales.invalidate();
      onDone();
    },
  });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Monto que debe (C$)">
        <Input inputMode="decimal" autoFocus value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
      </Field>
      <Field label="Debía desde">
        <Input type="date" value={f.asOfDate} max={todayISO()} onChange={(e) => setF({ ...f, asOfDate: e.target.value })} />
      </Field>
      <Field label="Vence">
        <Input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
      </Field>
      <Field label="Nota (opcional)">
        <Input value={f.notes} maxLength={200} placeholder="Ej.: cuaderno de 2025" onChange={(e) => setF({ ...f, notes: e.target.value })} />
      </Field>
      <div className="sm:col-span-2">
        <Alert>{save.error && errorMessage(save.error)}</Alert>
      </div>
      <Button
        className="sm:col-span-2"
        disabled={!f.amount || save.isPending}
        onClick={async () => {
          if (await confirmDialog(`El cliente queda debiendo ${money(f.amount)} más (deuda de antes del sistema).`, { title: "¿Agregar el saldo inicial?", confirmLabel: "Sí, agregar" }))
            save.mutate({ customerId, asOfDate: f.asOfDate, amount: f.amount, dueDate: f.dueDate, notes: f.notes || undefined });
        }}
      >
        Guardar saldo inicial
      </Button>
    </div>
  );
}

function PaymentForm({
  customerId,
  onDone,
}: {
  customerId: number;
  onDone: (payment: { id: number; amount: string; currency: string }) => void;
}) {
  const utils = api.useUtils();
  const pending = api.sales.pendingForCustomer.useQuery({ customerId });
  const methods = api.admin.catalog.useQuery({ kind: "paymentMethod", onlyActive: true });
  const [received, setReceived] = useState("");
  const [currency, setCurrency] = useState<"NIO" | "USD">("NIO");
  const [rate, setRate] = useExchangeRate();
  const [methodId, setMethodId] = useState(0);
  // Automatic: the oldest debt first, until the money runs out. Typing an amount by hand turns it off.
  const [manual, setManual] = useState<Record<string, string> | null>(null);
  const pay = api.sales.registerPayment.useMutation({
    onSuccess: (p) => {
      void utils.customer.invalidate();
      void utils.sales.invalidate();
      onDone({ id: p.id, amount: p.amount.toString(), currency: p.currency });
    },
  });
  const firstCash = methods.data?.find((m) => m.active && m.name.toLowerCase() === "efectivo")?.id;
  const method = methodId > 0 ? methodId : (firstCash ?? 0);

  const debts = pending.data ?? [];
  const owed = debts.reduce((a, p) => a.plus(dec(p.balance)), dec(0));
  const usdRate = currency === "USD" ? dec(rate) : null;
  const rateMissing = currency === "USD" && !usdRate?.gt(0);
  /** What the customer handed over, in córdobas. */
  const receivedNio = rateMissing ? dec(0) : currency === "USD" ? dec(received).times(usdRate!).toDecimalPlaces(2) : dec(received);
  /** What pays debts: never more than what is owed (DEC-065). */
  const toApply = receivedNio.gt(owed) ? owed : receivedNio;

  const auto: Record<string, string> = {};
  {
    let left = toApply;
    for (const p of debts) {
      if (left.lte(0)) break;
      const take = dec(p.balance).lt(left) ? dec(p.balance) : left;
      auto[`${p.kind}-${p.id}`] = take.toFixed(2);
      left = left.minus(take);
    }
  }
  const alloc = manual ?? auto;
  const allocated = Object.values(alloc).reduce((a, v) => a.plus(dec(v || 0)), dec(0));
  /** What is recorded as the payment: exactly what is applied (in dollars, rounded up to the cent like a sale). */
  const recorded = currency === "USD" ? (usdOf(allocated, rate) ?? dec(0)) : allocated;
  const change = currency === "USD" ? dec(received).minus(recorded) : receivedNio.minus(allocated);
  const changeNio = currency === "USD" && usdRate?.gt(0) ? change.times(usdRate).toDecimalPlaces(2) : change;
  const overAllocated = allocated.gt(receivedNio) && !rateMissing;
  const tooMuchOnOne = debts.some((p) => dec(alloc[`${p.kind}-${p.id}`] ?? 0).gt(dec(p.balance)));
  const owedAfter = owed.minus(allocated);
  const cur = currency === "USD" ? "USD" : "NIO";

  const submit = async () => {
    const lines = Object.entries(alloc)
      .filter(([, v]) => dec(v || 0).gt(0))
      .map(([k, v]) => {
        const [kind, id] = k.split("-");
        return kind === "FACTURA"
          ? { saleInvoiceId: Number(id), amount: dec(v).toFixed(2) }
          : { customerOpeningBalanceId: Number(id), amount: dec(v).toFixed(2) };
      });
    const text =
      `Abono de ${money(recorded, cur)}${currency === "USD" ? ` (= ${money(allocated)})` : ""} a ${lines.length} deuda${lines.length === 1 ? "" : "s"}.\n` +
      `Después del abono debe: ${money(owedAfter)}.` +
      (change.gt(0) ? `\n\nVuelto para el cliente: ${money(change, cur)}${currency === "USD" ? ` (= ${money(changeNio)} en córdobas)` : ""}.` : "");
    if (!(await confirmDialog(text, { title: "¿Registrar el abono?", confirmLabel: "Sí, registrar" }))) return;
    pay.mutate({
      customerId,
      amount: recorded.toFixed(2),
      currency,
      exchangeRate: currency === "USD" ? rate : undefined,
      paymentMethodId: method,
      allocations: lines,
    });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-lg bg-neutral-800/40 px-4 py-3">
        <p className="text-sm text-neutral-400">Este cliente debe</p>
        <p className="font-display text-3xl font-semibold tabular-nums">{money(owed)}</p>
        {debts.length === 0 && !pending.isLoading && <p className="text-sm text-neutral-400">No tiene deudas pendientes.</p>}
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-neutral-200">1. ¿Cuánto entrega el cliente?</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-sm font-medium text-neutral-300">Moneda</p>
            <Segmented
              label="Moneda"
              className="w-full [&>button]:flex-1 [&>button]:py-2"
              value={currency}
              onChange={(c) => {
                setCurrency(c);
                setManual(null);
              }}
              options={[
                { value: "NIO", label: "Córdobas" },
                { value: "USD", label: "Dólares" },
              ]}
            />
          </div>
          {currency === "USD" && (
            <Field label="Tipo de cambio" hint="Córdobas por dólar (se recuerda el último)">
              <Input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
            </Field>
          )}
          <Field label={`Monto que entrega (${currency === "USD" ? "US$" : "C$"})`}>
            <Input
              autoFocus
              inputMode="decimal"
              className="h-12 text-lg"
              value={received}
              onChange={(e) => {
                setReceived(e.target.value);
                setManual(null);
              }}
            />
          </Field>
          <Field label="Cómo paga">
            <Select value={method} onChange={(e) => setMethodId(Number(e.target.value))}>
              <option value={0}>Elegir…</option>
              {methods.data
                ?.filter((m) => m.active)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </Select>
          </Field>
        </div>
        {rateMissing && <p className="text-warn-fg text-sm">Escriba el tipo de cambio para calcular cuánto son esos dólares en córdobas.</p>}
        {currency === "USD" && !rateMissing && dec(received).gt(0) && (
          <p className="text-sm text-neutral-400">
            {money(received, "USD")} = <span className="font-medium text-neutral-100">{money(receivedNio)}</span>
          </p>
        )}
        {receivedNio.gt(owed) && owed.gt(0) && (
          <Alert kind="info">
            El cliente entrega más de lo que debe. Se cobran solo {money(owed)}
            {currency === "USD" ? ` (${money(usdOf(owed, rate), "USD")})` : ""} y el resto es su vuelto.
          </Alert>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-neutral-200">2. A qué deudas se aplica (en córdobas)</h3>
          {manual ? (
            <Button variant="ghost" onClick={() => setManual(null)}>
              Repartir solo (la más vieja primero)
            </Button>
          ) : (
            <span className="text-xs text-neutral-500">Se reparte solo, de la más vieja a la más nueva. Puede cambiar los montos.</span>
          )}
        </div>
        <Table head={["Deuda", "Vence", "Saldo", "Se aplica"]}>
          {debts.map((p) => {
            const key = `${p.kind}-${p.id}`;
            const over = dec(alloc[key] ?? 0).gt(dec(p.balance));
            return (
              <tr key={key}>
                <td>{p.kind === "FACTURA" ? `Factura ${invoiceNo({ id: p.id })}` : `Saldo inicial (${formatDay(p.date)})`}</td>
                <td>{formatDay(p.dueDate)}</td>
                <td className="tabular-nums">{money(p.balance)}</td>
                <td>
                  <Input
                    className="w-32"
                    inputMode="decimal"
                    aria-invalid={over}
                    value={alloc[key] ?? ""}
                    onChange={(e) => setManual({ ...alloc, [key]: e.target.value })}
                  />
                  {over && <p className="text-bad-fg text-xs">Solo debe {money(p.balance)}</p>}
                </td>
              </tr>
            );
          })}
        </Table>
      </section>

      <dl className="grid gap-2 rounded-lg border border-neutral-800 p-4 text-base sm:grid-cols-3">
        <div>
          <dt className="text-sm text-neutral-400">Se registra como abono</dt>
          <dd className="font-display text-2xl font-semibold tabular-nums">{money(recorded, cur)}</dd>
          {currency === "USD" && <dd className="text-sm text-neutral-400 tabular-nums">= {money(allocated)}</dd>}
        </div>
        <div>
          <dt className="text-sm text-neutral-400">Vuelto para el cliente</dt>
          <dd className="font-display text-2xl font-semibold tabular-nums">{change.gt(0) ? money(change, cur) : money(0, cur)}</dd>
          {currency === "USD" && change.gt(0) && <dd className="text-sm text-neutral-400 tabular-nums">= {money(changeNio)} en córdobas</dd>}
        </div>
        <div>
          <dt className="text-sm text-neutral-400">Después del abono debe</dt>
          <dd className="font-display text-2xl font-semibold tabular-nums">{money(owedAfter.gt(0) ? owedAfter : 0)}</dd>
        </div>
      </dl>
      {overAllocated && <Alert>Se aplican {money(allocated)} pero el cliente solo entrega {money(receivedNio)}.</Alert>}
      <Alert>{pay.error && errorMessage(pay.error)}</Alert>
      <Button
        className="h-12 w-full text-base"
        disabled={!method || rateMissing || allocated.lte(0) || overAllocated || tooMuchOnOne || pay.isPending}
        onClick={() => void submit()}
      >
        {pay.isPending ? "Registrando…" : `Registrar abono de ${money(recorded, cur)}`}
      </Button>
    </div>
  );
}
