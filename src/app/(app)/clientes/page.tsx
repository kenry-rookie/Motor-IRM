"use client";

import Link from "next/link";
import { useState } from "react";

import { Alert, Button, Card, Dialog, PageTitle, Table } from "~/app/_components/ui";
import { CustomerForm } from "~/app/(app)/clientes/customer-form";
import { errorMessage } from "~/lib/errors";
import { money } from "~/lib/format";
import { useDebounced } from "~/lib/use-debounced";
import { SearchField } from "~/app/_components/pickers";
import { api } from "~/trpc/react";

/** CLI-009 — Customers (search by name, phone, cédula or plate) and who owes money. */
export default function CustomersPage() {
  const me = api.auth.me.useQuery();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const dsearch = useDebounced(search.trim(), 200);
  // Without text: browse page by page. With text: the one search service (DEC-043).
  const list = api.customer.list.useInfiniteQuery(
    { limit: 50 },
    { getNextPageParam: (l) => l.nextCursor, initialCursor: null, enabled: !dsearch },
  );
  const found = api.search.customers.useQuery({ q: dsearch, limit: 50 }, { enabled: !!dsearch, placeholderData: (p) => p });
  const receivables = api.sales.receivables.useQuery();
  const items = dsearch ? (found.data?.items ?? []) : (list.data?.pages.flatMap((p) => p.items) ?? []);
  const loading = dsearch ? found.isLoading : list.isLoading;
  return (
    <>
      <PageTitle
        title="Clientes"
        actions={me.data?.permissions.includes("clientes.gestionar") && <Button onClick={() => setCreating(true)}>Nuevo cliente</Button>}
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Card>
          <SearchField
            className="mb-4 w-full max-w-md"
            label="Buscar cliente"
            placeholder="Nombre, teléfono, cédula o placa…"
            value={search}
            onValue={setSearch}
          />
          {dsearch && found.data?.suggestionsOnly && (
            <div className="mb-3">
              <Alert kind="info">Nadie se llama exactamente «{dsearch}». Estos se parecen.</Alert>
            </div>
          )}
          <Table head={["Cliente", "Teléfono", "Motos"]} empty={!loading && items.length === 0}>
            {items.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link className="hover:text-brand-600" href={`/clientes/${c.id}`}>
                    {c.name}
                  </Link>
                </td>
                <td>{c.phone}</td>
                <td className="text-neutral-400">
                  {c.motorcycles.map((m) => `${m.model.name} ${m.plate ?? ""}`).join(", ") || "—"}
                </td>
              </tr>
            ))}
          </Table>
          {!dsearch && list.hasNextPage && (
            <Button variant="secondary" className="mt-3" onClick={() => void list.fetchNextPage()}>
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
