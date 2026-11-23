"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { MotorcycleModelSelect } from "~/app/_components/pickers";
import { PrintLink } from "~/app/_components/print-link";
import { PrintPrompt } from "~/app/_components/print-prompt";
import { Alert, BackBar, Badge, Button, Card, Dialog, Field, Input, PageTitle, PhoneInput, SearchField, Segmented, Select, Table } from "~/app/_components/ui";
import { docNo, invoiceNo, parseDocNo } from "~/lib/business";
import { errorMessage, fieldErrors } from "~/lib/errors";
import { addDaysISO, dec, formatDateTime, formatDay, money, todayISO } from "~/lib/format";
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
  const [paying, setPaying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [moto, setMoto] = useState<Statement["motorcycles"][number] | "new" | null>(null);
  const [opening, setOpening] = useState(false);
  const [paid, setPaid] = useState<{ id: number; amount: string; currency: string } | null>(null);
  const [f, setF] = useState({ text: "", state: "TODAS" as State, terms: "TODAS" as "TODAS" | "CONTADO" | "CREDITO", origin: "TODAS" as "TODAS" | "MOSTRADOR" | "TALLER", from: "", to: "" });
  if (st.error) return <Alert>{errorMessage(st.error)}</Alert>;
  const d = st.data;
  if (!d) return <p className="text-neutral-400">Cargando…</p>;
  const perms = me.data?.permissions ?? [];
  const canManage = perms.includes("clientes.gestionar");

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
            {d.motorcycles.length} moto(s) · {d.orders.length} orden(es) de taller
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
          title={`Motos (${d.motorcycles.length})`}
          actions={
            canManage && (
              <Button variant="secondary" onClick={() => setMoto("new")}>
                + Agregar moto
              </Button>
            )
          }
        >
          <Table head={["Moto", "Color", "Placa", "Visitas al taller", ""]} empty={d.motorcycles.length === 0}>
            {d.motorcycles.map((m) => (
              <tr key={m.id}>
                <td>
                  {m.model.brand.name} {m.model.name}
                </td>
                <td>{m.color}</td>
                <td>{m.plate ?? "—"}</td>
                <td className="tabular-nums">{d.orders.filter((o) => o.motorcycleId === m.id).length}</td>
                <td className="text-right">
                  {canManage && (
                    <Button variant="ghost" onClick={() => setMoto(m)}>
                      Editar
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
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

      <Dialog open={paying} onClose={() => setPaying(false)} title={`Abono de ${d.customer.name}`}>
        <PaymentForm
          customerId={customerId}
          onDone={(p) => {
            setPaying(false);
            setPaid(p);
          }}
        />
      </Dialog>
      <Dialog open={editing} onClose={() => setEditing(false)} title="Editar datos del cliente">
        {editing && <EditCustomer customer={d.customer} onDone={() => setEditing(false)} />}
      </Dialog>
      <Dialog open={moto !== null} onClose={() => setMoto(null)} title={moto === "new" ? "Agregar moto" : "Editar moto"}>
        {moto !== null && <MotoForm customerId={customerId} moto={moto === "new" ? null : moto} onDone={() => setMoto(null)} />}
      </Dialog>
      <Dialog open={opening} onClose={() => setOpening(false)} title="Saldo inicial (deuda de antes del sistema)">
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
        onClick={() => save.mutate({ customerId, asOfDate: f.asOfDate, amount: f.amount, dueDate: f.dueDate, notes: f.notes || undefined })}
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
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"NIO" | "USD">("NIO");
  const [rate, setRate] = useState("");
  const [methodId, setMethodId] = useState(0);
  const [alloc, setAlloc] = useState<Record<string, string>>({});
  const pay = api.sales.registerPayment.useMutation({
    onSuccess: (p) => {
      void utils.customer.invalidate();
      void utils.sales.invalidate();
      onDone({ id: p.id, amount: p.amount.toString(), currency: p.currency });
    },
  });
  const nio = currency === "USD" ? dec(amount || 0).times(dec(rate || 0)) : dec(amount || 0);
  const allocated = Object.values(alloc).reduce((a, v) => a.plus(dec(v || 0)), dec(0));

  /** Oldest debt first, until the payment runs out. */
  const autoSpread = () => {
    let left = nio;
    const next: Record<string, string> = {};
    for (const p of pending.data ?? []) {
      if (left.lte(0)) break;
      const take = dec(p.balance).lt(left) ? dec(p.balance) : left;
      next[`${p.kind}-${p.id}`] = take.toFixed(2);
      left = left.minus(take);
    }
    setAlloc(next);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Monto recibido">
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Moneda">
          <Select value={currency} onChange={(e) => setCurrency(e.target.value as "NIO" | "USD")}>
            <option value="NIO">Córdobas</option>
            <option value="USD">Dólares</option>
          </Select>
        </Field>
        {currency === "USD" && (
          <Field label="Tipo de cambio">
            <Input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
          </Field>
        )}
        <Field label="Método">
          <Select value={methodId} onChange={(e) => setMethodId(Number(e.target.value))}>
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
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Aplicar a (en córdobas)</h3>
        <Button variant="secondary" onClick={autoSpread} disabled={nio.lte(0)}>
          Repartir de la más vieja a la más nueva
        </Button>
      </div>
      <Table head={["Deuda", "Vence", "Saldo", "Abono"]}>
        {pending.data?.map((p) => {
          const key = `${p.kind}-${p.id}`;
          return (
            <tr key={key}>
              <td>{p.kind === "FACTURA" ? `Factura ${invoiceNo({ id: p.id })}` : `Saldo inicial (${formatDay(p.date)})`}</td>
              <td>{formatDay(p.dueDate)}</td>
              <td>{money(p.balance)}</td>
              <td>
                <Input className="w-28" inputMode="decimal" value={alloc[key] ?? ""} onChange={(e) => setAlloc({ ...alloc, [key]: e.target.value })} />
              </td>
            </tr>
          );
        })}
      </Table>
      <p className="text-sm text-neutral-400">
        Pago: {money(nio)} · repartido: {money(allocated)}
      </p>
      <Alert>{pay.error && errorMessage(pay.error)}</Alert>
      <Button
        className="w-full"
        disabled={!amount || !methodId || allocated.lte(0) || pay.isPending}
        onClick={() =>
          pay.mutate({
            customerId,
            amount,
            currency,
            exchangeRate: currency === "USD" ? rate : undefined,
            paymentMethodId: methodId,
            allocations: Object.entries(alloc)
              .filter(([, v]) => dec(v || 0).gt(0))
              .map(([k, v]) => {
                const [kind, id] = k.split("-");
                return kind === "FACTURA"
                  ? { saleInvoiceId: Number(id), amount: dec(v).toFixed(2) }
                  : { customerOpeningBalanceId: Number(id), amount: dec(v).toFixed(2) };
              }),
          })
        }
      >
        Registrar abono
      </Button>
    </div>
  );
}
