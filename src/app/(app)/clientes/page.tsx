"use client";

import Link from "next/link";
import { useState } from "react";

import { Alert, Button, Card, Dialog, PageTitle, Table } from "~/app/_components/ui";
import { CustomerForm } from "~/app/(app)/clientes/customer-form";
import { errorMessage } from "~/lib/errors";
import { money } from "~/lib/format";
import { api } from "~/trpc/react";

/** CLI-009 — Customers (search by name, phone, cédula or plate) and who owes money. */
export default function CustomersPage() {
  const me = api.auth.me.useQuery();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const list = api.customer.list.useInfiniteQuery(
    { search: search || undefined, limit: 50 },
    { getNextPageParam: (l) => l.nextCursor, initialCursor: null },
  );
  const receivables = api.sales.receivables.useQuery();
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <>
      <PageTitle
        title="Clientes"
        actions={me.data?.permissions.includes("clientes.gestionar") && <Button onClick={() => setCreating(true)}>Nuevo cliente</Button>}
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Card>
          <input
            className="mb-4 w-full max-w-sm rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2"
            placeholder="Nombre, teléfono, cédula o placa…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Table head={["Cliente", "Teléfono", "Motos"]} empty={!list.isLoading && items.length === 0}>
            {items.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link className="hover:text-amber-300" href={`/clientes/${c.id}`}>
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
          {list.hasNextPage && (
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
                Total {money(receivables.data.total)} · <span className="text-red-300">vencido {money(receivables.data.overdue)}</span>
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {receivables.data.rows.map((r) => (
                  <li key={r.customerId} className="flex justify-between gap-2">
                    <Link className="hover:text-amber-300" href={`/clientes/${r.customerId}`}>
                      {r.name}
                    </Link>
                    <span className={r.overdue.toString() !== "0" ? "text-red-300" : ""}>{money(r.balance)}</span>
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
