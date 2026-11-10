"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { Alert, Badge, Button, Card, Dialog, Field, Input, PageTitle, Select, Table } from "~/app/_components/ui";
import { errorMessage } from "~/lib/errors";
import { dec, formatDateTime, formatDay, money } from "~/lib/format";
import { api } from "~/trpc/react";

/** CLI-009 account statement · CLI-010 register a payment and spread it. */
export default function CustomerPage() {
  const { id } = useParams<{ id: string }>();
  const customerId = Number(id);
  const me = api.auth.me.useQuery();
  const st = api.customer.statement.useQuery({ customerId });
  const [paying, setPaying] = useState(false);
  if (st.error) return <Alert>{errorMessage(st.error)}</Alert>;
  const d = st.data;
  if (!d) return <p className="text-neutral-400">Cargando…</p>;
  return (
    <>
      <PageTitle
        title={d.customer.name}
        subtitle={`${d.customer.phone}${d.customer.nationalId ? ` · ${d.customer.nationalId}` : ""}${d.customer.address ? ` · ${d.customer.address}` : ""}`}
        actions={
          me.data?.permissions.includes("cobros.registrar") &&
          dec(d.totalBalance).gt(0) && <Button onClick={() => setPaying(true)}>Registrar abono</Button>
        }
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-sm text-neutral-400">Saldo total</p>
          <p className="text-3xl font-bold">{money(d.totalBalance)}</p>
        </Card>
        <Card>
          <p className="text-sm text-neutral-400">Interés estimado (provisional, Q-009/Q-021)</p>
          <p className="text-3xl font-bold">{money(d.totalInterest)}</p>
        </Card>
      </div>
      <Card title="Facturas">
        <Table head={["Factura", "Fecha", "Tipo", "Vence", "Total", "Devuelto", "Pagado", "Saldo"]} empty={d.invoices.length === 0}>
          {d.invoices.map((i) => (
            <tr key={i.id}>
              <td>
                <Link className="hover:text-brand-600" href={`/ventas/${i.id}`}>
                  #{i.id}
                </Link>
              </td>
              <td>{formatDateTime(i.createdAt)}</td>
              <td>{i.paymentTerms === "CREDITO" ? "Crédito" : "Contado"}</td>
              <td>
                {formatDay(i.dueDate)} {i.overdue && <Badge tone="red">vencida</Badge>}
              </td>
              <td>{money(i.total)}</td>
              <td>{money(i.returned)}</td>
              <td>{money(i.paid)}</td>
              <td className="font-semibold">{money(i.balance)}</td>
            </tr>
          ))}
        </Table>
      </Card>
      {d.openingBalances.length > 0 && (
        <Card title="Saldos iniciales (deudas anteriores al sistema)" className="mt-4">
          <Table head={["Desde", "Vence", "Monto", "Saldo", "Nota"]}>
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
      )}
      <Dialog open={paying} onClose={() => setPaying(false)} title={`Abono de ${d.customer.name}`}>
        <PaymentForm customerId={customerId} onDone={() => setPaying(false)} />
      </Dialog>
    </>
  );
}

function PaymentForm({ customerId, onDone }: { customerId: number; onDone: () => void }) {
  const utils = api.useUtils();
  const pending = api.sales.pendingForCustomer.useQuery({ customerId });
  const methods = api.admin.catalog.useQuery({ kind: "paymentMethod" });
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"NIO" | "USD">("NIO");
  const [rate, setRate] = useState("");
  const [methodId, setMethodId] = useState(0);
  const [alloc, setAlloc] = useState<Record<string, string>>({});
  const pay = api.sales.registerPayment.useMutation({
    onSuccess: () => {
      void utils.customer.invalidate();
      void utils.sales.invalidate();
      onDone();
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
              <td>{p.kind === "FACTURA" ? `Factura #${p.id}` : `Saldo inicial (${formatDay(p.date)})`}</td>
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
