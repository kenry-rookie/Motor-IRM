"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { BarList, ColumnChart, compact } from "~/app/_components/charts";
import { Alert, Badge, Card, cx, Field, Input, PageTitle, Segmented, Stat } from "~/app/_components/ui";
import { errorMessage } from "~/lib/errors";
import { addDaysISO, money, todayISO } from "~/lib/format";
import { api } from "~/trpc/react";

type Preset = "hoy" | "7d" | "30d" | "mes" | "anio" | "rango";
type Gran = "day" | "week" | "month";

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function rangeOf(preset: Preset, custom: { from: string; to: string }) {
  const today = todayISO();
  switch (preset) {
    case "hoy":
      return { from: today, to: today };
    case "7d":
      return { from: addDaysISO(today, -6), to: today };
    case "30d":
      return { from: addDaysISO(today, -29), to: today };
    case "mes":
      return { from: `${today.slice(0, 8)}01`, to: today };
    case "anio":
      return { from: `${today.slice(0, 5)}01-01`, to: today };
    case "rango":
      return custom;
  }
}

/** Grouping that gives a readable number of columns for the range. */
const autoGran = (from: string, to: string): Gran => {
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1;
  return days <= 31 ? "day" : days <= 120 ? "week" : "month";
};

function bucketLabel(day: string, g: Gran) {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  if (g === "month") return `${MONTHS[m - 1]} ${String(y).slice(2)}`;
  if (g === "week") return `sem ${d} ${MONTHS[m - 1]}`;
  return `${d} ${MONTHS[m - 1]}`;
}

const pct = (cur: string | number, prev: string | number) => {
  const c = Number(cur);
  const p = Number(prev);
  return p === 0 ? null : ((c - p) / p) * 100;
};

/** CLI-016 + reports — the day and any period, with charts and comparisons. */
export default function HomePage() {
  const me = api.auth.me.useQuery();
  const canReport = me.data?.permissions.includes("reportes.ver");
  const [preset, setPreset] = useState<Preset>("7d");
  const [custom, setCustom] = useState({ from: addDaysISO(todayISO(), -29), to: todayISO() });
  const range = rangeOf(preset, custom);
  const [granChoice, setGranChoice] = useState<Gran | "auto">("auto");
  const gran = granChoice === "auto" ? autoGran(range.from, range.to) : granChoice;

  const report = api.reports.period.useQuery(
    { ...range, granularity: gran },
    { enabled: !!canReport && range.from <= range.to, placeholderData: (p) => p },
  );
  const today = api.reports.daySummary.useQuery(undefined, { enabled: !!canReport });

  const rows = useMemo(
    () =>
      (report.data?.series ?? []).map((r) => ({
        label: bucketLabel(r.bucket, report.data!.granularity),
        values: { cash: Number(r.cash), credit: Number(r.credit), received: Number(r.received), delivered: r.delivered },
      })),
    [report.data],
  );

  if (me.data && !canReport) {
    return (
      <PageTitle title={`Hola, ${me.data.staffName ?? me.data.username}`} subtitle="Elija un área en el menú de la izquierda para empezar." />
    );
  }

  const cur = report.data?.current;
  const prev = report.data?.previous;
  const vs = "periodo anterior";
  const avgTicket = cur && cur.invoices > 0 ? Number(cur.sales) / cur.invoices : 0;
  const prevAvg = prev && prev.invoices > 0 ? Number(prev.sales) / prev.invoices : 0;
  const t = today.data;

  return (
    <>
      <PageTitle title="Resumen" subtitle="Cómo va el negocio: ventas, cobros y taller en el periodo que elija." />

      {/* Filtros: una fila, arriba de todo lo que afectan */}
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <Segmented
          label="Periodo"
          value={preset}
          onChange={setPreset}
          options={[
            { value: "hoy", label: "Hoy" },
            { value: "7d", label: "7 días" },
            { value: "30d", label: "30 días" },
            { value: "mes", label: "Este mes" },
            { value: "anio", label: "Este año" },
            { value: "rango", label: "Rango" },
          ]}
        />
        {preset === "rango" && (
          <div className="flex items-end gap-2">
            <Field label="Desde">
              <Input type="date" value={custom.from} max={custom.to} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
            </Field>
            <Field label="Hasta">
              <Input type="date" value={custom.to} min={custom.from} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
            </Field>
          </div>
        )}
        <Segmented
          label="Agrupar por"
          value={granChoice}
          onChange={setGranChoice}
          options={[
            { value: "auto", label: "Automático" },
            { value: "day", label: "Día" },
            { value: "week", label: "Semana" },
            { value: "month", label: "Mes" },
          ]}
        />
      </div>

      {report.error && <Alert>{errorMessage(report.error)}</Alert>}

      <div className={cx("space-y-4 transition-opacity", report.isFetching && "opacity-60")}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Ventas" value={money(cur?.sales)} delta={cur && prev ? { pct: pct(cur.sales, prev.sales), vs } : undefined} detail={cur ? `${cur.invoices} facturas` : undefined} />
          <Stat label="Cobrado" value={money(cur?.received)} delta={cur && prev ? { pct: pct(cur.received, prev.received), vs } : undefined} detail="contado + abonos de crédito" />
          <Stat label="Ticket promedio" value={money(avgTicket)} delta={cur && prev ? { pct: pct(avgTicket, prevAvg), vs } : undefined} />
          <Stat
            label="Motos entregadas"
            value={cur?.delivered ?? "—"}
            delta={cur && prev ? { pct: pct(cur.delivered, prev.delivered), vs } : undefined}
            detail={cur ? `Mano de obra ${money(cur.labor)}` : undefined}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
          <Card>
            <ColumnChart
              title="Ventas"
              caption={`Por ${gran === "day" ? "día" : gran === "week" ? "semana (de lunes a domingo)" : "mes"}, en córdobas`}
              rows={rows}
              series={[
                { key: "cash", label: "Contado", color: "var(--color-series-1)" },
                { key: "credit", label: "Crédito", color: "var(--color-series-2)" },
              ]}
              format={(n) => money(n)}
            />
          </Card>
          <Card>
            <BarList
              title="Productos más vendidos"
              caption="Por monto vendido en el periodo"
              items={(report.data?.topProducts ?? []).map((p) => ({ label: p.name, value: Number(p.revenue), detail: `${p.quantity} u.` }))}
              format={(n) => `C$ ${compact(n)}`}
            />
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
          <Card>
            <ColumnChart
              title="Cobrado"
              caption="Dinero que entró: ventas de contado y abonos de clientes"
              rows={rows}
              series={[{ key: "received", label: "Cobrado", color: "var(--color-series-1)" }]}
              format={(n) => money(n)}
              height={160}
            />
          </Card>
          <Card>
            <ColumnChart
              title="Motos entregadas"
              caption="Órdenes de taller cerradas"
              rows={rows}
              series={[{ key: "delivered", label: "Entregadas", color: "var(--color-series-1)" }]}
              format={(n) => String(n)}
              height={160}
            />
          </Card>
        </div>
      </div>

      {t && (
        <section className="mt-8">
          <h2 className="font-display mb-3 text-xl font-semibold text-neutral-50">Hoy en el negocio</h2>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Caja de hoy">
              <dl className="space-y-1.5 text-sm">
                {t.received.byMethod.map((m) => (
                  <div key={m.method} className="flex justify-between">
                    <dt className="text-neutral-400">{m.method}</dt>
                    <dd className="tabular-nums">{money(m.amount)}</dd>
                  </div>
                ))}
                <div className="flex justify-between">
                  <dt className="text-neutral-400">Retiros</dt>
                  <dd className="tabular-nums">−{money(t.withdrawals)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-neutral-400">Adelantos</dt>
                  <dd className="tabular-nums">−{money(t.advances)}</dd>
                </div>
                <div className="flex justify-between border-t border-neutral-800 pt-1.5 font-semibold">
                  <dt>Debe haber en caja</dt>
                  <dd className="tabular-nums">{money(t.cashBalance)}</dd>
                </div>
              </dl>
            </Card>
            <Card title="Taller" actions={<Link href="/taller" className="text-sm text-brand-600 hover:underline">Abrir tablero</Link>}>
              <p className="font-display text-4xl font-semibold text-neutral-50">{t.openOrders}</p>
              <p className="text-sm text-neutral-400">motos en el taller ahora</p>
            </Card>
            <Card title="Poco stock" actions={<Link href="/inventario" className="text-sm text-brand-600 hover:underline">Ver inventario</Link>}>
              {t.lowStock.length === 0 ? (
                <p className="text-sm text-neutral-500">Nada por reponer.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {t.lowStock.slice(0, 6).map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2">
                      <Link href={`/inventario/${p.id}`} className="truncate hover:underline">
                        {p.name}
                      </Link>
                      {p.stock === 0 ? <Badge tone="red">Agotado</Badge> : <Badge tone="amber">{p.stock} en stock</Badge>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </section>
      )}
    </>
  );
}
