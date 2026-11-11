"use client";

import Link from "next/link";
import { useState } from "react";

import { CustomerFilterBar, type CustomerFilterState, EMPTY_CUSTOMER_FILTERS } from "~/app/_components/catalog";
import { Alert, Badge, Button, Card, Dialog, PageTitle, SearchField, Table } from "~/app/_components/ui";
import { CustomerForm } from "~/app/(app)/clientes/customer-form";
import { errorMessage } from "~/lib/errors";
import { formatDateTime, money } from "~/lib/format";
import { useDebounced } from "~/lib/use-debounced";
import { api } from "~/trpc/react";

/** CLI-009 — Customers (search by name, phone, cédula or plate) and who owes money. */
export default function CustomersPage() {
  const me = api.auth.me.useQuery();
  const [text, setText] = useState("");
  const [filters, setFilters] = useState<CustomerFilterState>(EMPTY_CUSTOMER_FILTERS);
  const [creating, setCreating] = useState(false);
  const [pages, setPages] = useState(1);
  const q = useDebounced(text.trim(), 200);
  // The database searches and filters (DEC-049); this screen only shows the page.
  const found = api.search.customers.useQuery(
    { q: q || undefined, ...filters, limit: 50 * pages, offset: 0 },
    { placeholderData: (p) => p },
  );
  const items = found.data?.items ?? [];
  const receivables = api.sales.receivables.useQuery();
  return (
    <>
      <PageTitle
        title="Clientes"
        actions={me.data?.permissions.includes("clientes.gestionar") && <Button onClick={() => setCreating(true)}>+ Nuevo cliente</Button>}
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card>
          <div className="mb-3 space-y-3">
            <SearchField
              className="w-full max-w-xl"
              label="Buscar cliente"
              placeholder="Nombre, teléfono, cédula o placa…"
              value={text}
              onValue={(v) => {
                setText(v);
                setPages(1);
              }}
            />
            <CustomerFilterBar
              value={filters}
              onChange={(f) => {
                setFilters(f);
                setPages(1);
              }}
            />
          </div>
          {found.data?.suggestionsOnly && (
            <div className="mb-3">
              <Alert kind="info">Nadie se llama exactamente «{q}». Estos se parecen.</Alert>
            </div>
          )}
          {found.error && <Alert>{errorMessage(found.error)}</Alert>}
          <p className="mb-2 text-xs text-neutral-500">
            {found.isLoading ? "Buscando…" : `${found.data?.total ?? 0} cliente${found.data?.total === 1 ? "" : "s"}`}
          </p>
          <Table head={["Cliente", "Teléfono", "Motos", "Debe", "Atraso", "Última visita"]} empty={!found.isLoading && items.length === 0}>
            {items.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link className="font-medium hover:text-brand-600" href={`/clientes/${c.id}`}>
                    {c.name}
                  </Link>
                  {c.hasCredit && <div className="text-xs text-neutral-500">compra al crédito</div>}
                </td>
                <td className="tabular-nums">{c.phone}</td>
                <td className="text-neutral-400">
                  {c.motorcycles.map((m) => `${m.model.brand.name} ${m.model.name}${m.plate ? ` (${m.plate})` : ""}`).join(", ") ||
                    "—"}
                </td>
                <td className="tabular-nums">{c.balance && Number(c.balance.toString()) > 0 ? money(c.balance) : "—"}</td>
                <td>
                  {c.maxDaysOverdue && c.maxDaysOverdue > 0 ? (
                    <Badge tone={c.maxDaysOverdue > 30 ? "red" : "amber"}>{c.maxDaysOverdue} días</Badge>
                  ) : c.balance && Number(c.balance.toString()) > 0 ? (
                    <Badge tone="green">al día</Badge>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="text-neutral-400">{c.lastVisitAt ? formatDateTime(c.lastVisitAt) : "—"}</td>
              </tr>
            ))}
          </Table>
          {found.data?.nextOffset != null && (
            <Button variant="secondary" className="mt-3" onClick={() => setPages((p) => p + 1)} disabled={found.isFetching}>
              Cargar más
            </Button>
          )}
        </Card>
        <Card title="Cuentas por cobrar">
          {receivables.error && <Alert>{errorMessage(receivables.error)}</Alert>}
          {receivables.data && (
            <>
              <p className="text-sm text-neutral-400">
                Total {money(receivables.data.total)} · <span className="text-bad-fg">vencido {money(receivables.data.overdue)}</span>
              </p>
              {receivables.data.rows.length === 0 && <p className="mt-3 text-sm text-neutral-500">Nadie debe nada.</p>}
              <ul className="mt-3 space-y-2 text-sm">
                {receivables.data.rows.map((r) => (
                  <li key={r.customerId} className="flex justify-between gap-2">
                    <Link className="hover:text-brand-600" href={`/clientes/${r.customerId}`}>
                      {r.name}
                    </Link>
                    <span className={r.overdue.toString() !== "0" ? "text-bad-fg" : ""}>{money(r.balance)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>
      <Dialog open={creating} onClose={() => setCreating(false)} title="Nuevo cliente">
        <CustomerForm onDone={() => setCreating(false)} />
      </Dialog>
    </>
  );
}
