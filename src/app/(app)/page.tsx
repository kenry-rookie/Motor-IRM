"use client";

import Link from "next/link";

import { Alert, Card, PageTitle, Table } from "~/app/_components/ui";
import { errorMessage } from "~/lib/errors";
import { money } from "~/lib/format";
import { api } from "~/trpc/react";

/** CLI-016 — Summary of the day: sales, money received, cash, open orders, low stock. */
export default function HomePage() {
  const me = api.auth.me.useQuery();
  const canReport = me.data?.permissions.includes("reportes.ver");
  const summary = api.reports.daySummary.useQuery(undefined, { enabled: !!canReport });

  if (me.data && !canReport) {
    return (
      <>
        <PageTitle title={`Hola, ${me.data.staffName ?? me.data.username}`} subtitle="Elija un área en el menú." />
      </>
    );
  }
  const s = summary.data;
  return (
    <>
      <PageTitle title="Resumen del día" subtitle={s ? `Fecha: ${s.day}` : undefined} />
      {summary.error && <Alert>{errorMessage(summary.error)}</Alert>}
      {s && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Ventas" value={money(s.sales.total)} detail={`${s.sales.count} facturas · crédito ${money(s.sales.credit)}`} />
            <Stat label="Cobrado" value={money(s.received.total)} detail={s.received.byMethod.map((m) => `${m.method} ${money(m.amount)}`).join(" · ") || "—"} />
            <Stat label="Caja (cobros − retiros − adelantos)" value={money(s.cashBalance)} detail={`Retiros ${money(s.withdrawals)} · adelantos ${money(s.advances)}`} />
            <Stat label="Órdenes abiertas" value={String(s.openOrders)} detail={<Link className="text-amber-400" href="/taller">Ver taller →</Link>} />
          </div>
          <Card title="Productos con poco stock">
            <Table head={["Producto", "Código", "Stock"]} empty={s.lowStock.length === 0}>
              {s.lowStock.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link className="hover:text-amber-300" href={`/inventario/${p.id}`}>
                      {p.name}
                    </Link>
                  </td>
                  <td className="text-neutral-400">{p.barcode ?? "—"}</td>
                  <td className={p.stock === 0 ? "text-red-400" : "text-amber-300"}>{p.stock}</td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>
      )}
    </>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <p className="text-sm text-neutral-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-neutral-500">{detail}</p>
    </div>
  );
}
