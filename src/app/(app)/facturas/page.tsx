"use client";

import Link from "next/link";
import { useState } from "react";

import { PrintLink } from "~/app/_components/print-link";
import { Badge, Button, Card, Field, Input, PageTitle, SearchField, Segmented, Select, Stat, Table } from "~/app/_components/ui";
import { docNumber } from "~/lib/business";
import { addDaysISO, formatDateTime, formatDay, money, todayISO } from "~/lib/format";
import { useDebounced } from "~/lib/use-debounced";
import { api } from "~/trpc/react";

/**
 * DEC-054 — Facturas: the record of everything that was billed (counter and
 * workshop), with the period, customer, condition and state filtered by the
 * database. Every row opens the invoice or prints it again.
 */
type Period = "hoy" | "7d" | "mes" | "todo" | "otro";
const PAGE = 50;

function rangeOf(p: Period): { from?: string; to?: string } {
  const today = todayISO();
  if (p === "hoy") return { from: today, to: today };
  if (p === "7d") return { from: addDaysISO(today, -6), to: today };
  if (p === "mes") return { from: `${today.slice(0, 8)}01`, to: today };
  return {};
}

export default function InvoicesPage() {
  const [period, setPeriod] = useState<Period>("hoy");
  const [custom, setCustom] = useState({ from: todayISO(), to: todayISO() });
  const [text, setText] = useState("");
  const [paymentTerms, setPaymentTerms] = useState<"" | "CONTADO" | "CREDITO">("");
  const [state, setState] = useState<"TODAS" | "PENDIENTES" | "PAGADAS" | "VENCIDAS" | "ANULADAS">("TODAS");
  const [origin, setOrigin] = useState<"TODAS" | "MOSTRADOR" | "TALLER">("TODAS");
  const [page, setPage] = useState(0);
  const q = useDebounced(text.trim(), 250);

  const range = period === "otro" ? custom : rangeOf(period);
  const list = api.sales.searchInvoices.useQuery({
    ...range,
    text: q || undefined,
    paymentTerms: paymentTerms || undefined,
    state,
    origin,
    offset: page * PAGE,
    limit: PAGE,
  });
  const d = list.data;
  const pages = d ? Math.max(1, Math.ceil(d.count / PAGE)) : 1;
  // Any filter change goes back to the first page.
  const reset = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    setPage(0);
  };

  return (
    <>
      <PageTitle title="Facturas" />

      <Card>
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <Segmented
              label="Periodo"
              value={period}
              onChange={reset(setPeriod)}
              options={[
                { value: "hoy", label: "Hoy" },
                { value: "7d", label: "Últimos 7 días" },
                { value: "mes", label: "Este mes" },
                { value: "todo", label: "Todo" },
                { value: "otro", label: "Elegir fechas" },
              ]}
            />
            {period === "otro" && (
              <div className="flex items-end gap-2">
                <Field label="Desde">
                  <Input type="date" value={custom.from} max={custom.to} onChange={(e) => reset(setCustom)({ ...custom, from: e.target.value })} />
                </Field>
                <Field label="Hasta">
                  <Input type="date" value={custom.to} min={custom.from} onChange={(e) => reset(setCustom)({ ...custom, to: e.target.value })} />
                </Field>
              </div>
            )}
          </div>
          <SearchField
            className="w-full max-w-xl"
            label="Buscar factura"
            placeholder="Cliente o número de factura…"
            value={text}
            onValue={reset(setText)}
          />
          <div className="grid gap-3 sm:grid-cols-3 lg:max-w-3xl">
            <Field label="Condición">
              <Select value={paymentTerms} onChange={(e) => reset(setPaymentTerms)(e.target.value as typeof paymentTerms)}>
                <option value="">Contado y crédito</option>
                <option value="CONTADO">Contado</option>
                <option value="CREDITO">Crédito</option>
              </Select>
            </Field>
            <Field label="Estado">
              <Select value={state} onChange={(e) => reset(setState)(e.target.value as typeof state)}>
                <option value="TODAS">Todas</option>
                <option value="PENDIENTES">Con saldo pendiente</option>
                <option value="VENCIDAS">Vencidas</option>
                <option value="PAGADAS">Pagadas</option>
                <option value="ANULADAS">Anuladas</option>
              </Select>
            </Field>
            <Field label="Origen">
              <Select value={origin} onChange={(e) => reset(setOrigin)(e.target.value as typeof origin)}>
                <option value="TODAS">Mostrador y taller</option>
                <option value="MOSTRADOR">Ventas de mostrador</option>
                <option value="TALLER">Motos del taller</option>
              </Select>
            </Field>
          </div>
        </div>
      </Card>

      <div className="my-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Facturas" value={d ? d.count : "—"} />
        <Stat label="Total facturado" value={d ? money(d.sumTotal) : "—"} />
        <Stat label="Cobrado" value={d ? money(d.sumPaid) : "—"} />
        <Stat label="Por cobrar" value={d ? money(d.sumBalance) : "—"} />
      </div>

      <Card>
        {list.isLoading ? (
          <p className="py-8 text-center text-sm text-neutral-500">Buscando…</p>
        ) : (
          <Table
            head={["N.º", "Fecha", "Cliente", "Origen", "Condición", "Total", "Pagado", "Saldo", ""]}
            empty={!d || d.items.length === 0}
          >
            {d?.items.map((i) => (
              <tr key={i.id} className={i.voided ? "text-neutral-500" : undefined}>
                <td className="font-medium tabular-nums">
                  <Link className="hover:text-brand-600 hover:underline" href={`/ventas/${i.id}`}>
                    {i.invoiceNumber ?? docNumber(i.id)}
                  </Link>
                </td>
                <td className="whitespace-nowrap">{formatDateTime(i.createdAt)}</td>
                <td>
                  {i.customer ? (
                    <Link className="hover:text-brand-600 hover:underline" href={`/clientes/${i.customer.id}`}>
                      {i.customer.name}
                    </Link>
                  ) : (
                    <span className="text-neutral-500">Cliente de contado</span>
                  )}
                </td>
                <td>{i.serviceOrderId ? <Badge tone="blue">Orden #{i.serviceOrderId}</Badge> : "Mostrador"}</td>
                <td>
                  {i.paymentTerms === "CREDITO" ? (
                    <span>
                      Crédito <span className="text-xs text-neutral-500">· vence {formatDay(i.dueDate)}</span>
                    </span>
                  ) : (
                    "Contado"
                  )}
                </td>
                <td className="tabular-nums">{money(i.total)}</td>
                <td className="tabular-nums">{money(i.paid)}</td>
                <td className="tabular-nums">
                  {i.voided ? (
                    <Badge tone="red">Anulada</Badge>
                  ) : Number(i.balance) > 0 ? (
                    <span className="font-semibold">
                      {money(i.balance)} {i.overdue && <Badge tone="red">vencida</Badge>}
                    </span>
                  ) : (
                    <Badge tone="green">Pagada</Badge>
                  )}
                </td>
                <td className="text-right whitespace-nowrap">
                  <PrintLink className="text-brand-600 text-sm hover:underline" href={`/imprimir/factura/${i.id}?imprimir=1`}>
                    Imprimir
                  </PrintLink>
                </td>
              </tr>
            ))}
          </Table>
        )}
        {d && d.count > PAGE && (
          <div className="mt-3 flex items-center justify-end gap-2 text-sm">
            <Button variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              ← Anteriores
            </Button>
            <span className="text-neutral-400">
              Página {page + 1} de {pages}
            </span>
            <Button variant="secondary" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
              Siguientes →
            </Button>
          </div>
        )}
      </Card>
    </>
  );
}
