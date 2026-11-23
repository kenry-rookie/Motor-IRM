"use client";

import Link from "next/link";
import { type ReactNode, useMemo, useState } from "react";

import { BarList, ColumnChart, compact } from "~/app/_components/charts";
import { Alert, Badge, Card, cx, Field, Input, PageTitle, Segmented, Stat } from "~/app/_components/ui";
import { errorMessage } from "~/lib/errors";
import { addDaysISO, dec, money, todayISO } from "~/lib/format";
import { api, type RouterOutputs } from "~/trpc/react";

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

  const rows = useMemo(
    () =>
      (report.data?.series ?? []).map((r) => ({
        label: bucketLabel(r.bucket, report.data!.granularity),
        // A day with more returned than sold would draw below zero: the chart starts at 0.
        values: { cash: Math.max(0, Number(r.cash)), credit: Math.max(0, Number(r.credit)), received: Math.max(0, Number(r.received)), delivered: r.delivered },
      })),
    [report.data],
  );

  if (me.data && !canReport) {
    return (
      <>
        <PageTitle title={`Hola, ${me.data.staffName ?? me.data.username}`} subtitle="Elija un área en el menú de la izquierda para empezar." />
        <Notices />
      </>
    );
  }

  const cur = report.data?.current;
  const prev = report.data?.previous;
  const vs = "periodo anterior";
  const avgTicket = cur && cur.invoices > 0 ? Number(cur.sales) / cur.invoices : 0;
  const prevAvg = prev && prev.invoices > 0 ? Number(prev.sales) / prev.invoices : 0;
  const t = report.data;

  return (
    <>
      <PageTitle title="Resumen" subtitle="Cómo está el negocio: lo que necesita atención, cuánto se ganó, cuánto nos deben y cuánto debemos." />

      <Notices />

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
          <Stat
            label="Ganancia"
            value={money(cur?.profit.total)}
            delta={cur && prev ? { pct: pct(cur.profit.total, prev.profit.total), vs } : undefined}
            detail="Taller + productos (abajo el detalle)"
          />
          <Stat
            label="Ventas"
            value={money(cur?.sales)}
            delta={cur && prev ? { pct: pct(cur.sales, prev.sales), vs } : undefined}
            detail={cur ? `${cur.invoices} facturas${dec(cur.returns).gt(0) ? ` · ya se restaron ${money(cur.returns)} devueltos` : ""}` : undefined}
          />
          <Stat
            label="Cobrado"
            value={money(cur?.received)}
            delta={cur && prev ? { pct: pct(cur.received, prev.received), vs } : undefined}
            detail="Contado + abonos, menos lo devuelto al cliente"
          />
          <Stat
            label="Gastos de viajes de compra"
            value={money(cur?.tripExpenses)}
            delta={cur && prev ? { pct: pct(cur.tripExpenses, prev.tripExpenses), goodWhenUp: false, vs } : undefined}
            detail="Pasaje, comida, flete… de los viajes del periodo"
          />
        </div>

        {cur && t && (
          <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
            <ProfitCard cur={cur} />
            <DebtsCard debts={t.debts} />
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
          <Card>
            <ColumnChart
              title="Ventas"
              caption={`Por ${gran === "day" ? "día" : gran === "week" ? "semana (de lunes a domingo)" : "mes"}, en córdobas, ya restadas las devoluciones · ticket promedio ${money(avgTicket)}${prevAvg ? ` (antes ${money(prevAvg)})` : ""}`}
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
              caption="Dinero que entró de los clientes (contado y abonos), menos lo que se les devolvió"
              rows={rows}
              series={[{ key: "received", label: "Cobrado", color: "var(--color-series-1)" }]}
              format={(n) => money(n)}
              height={160}
            />
          </Card>
          <Card>
            <ColumnChart
              title="Motos entregadas"
              caption={cur ? `Órdenes de taller cerradas · mano de obra ${money(cur.labor)}` : "Órdenes de taller cerradas"}
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
          <h2 className="font-display mb-3 text-xl font-semibold text-neutral-50">
            {preset === "hoy" ? "El dinero de hoy y el taller ahora" : "El dinero del periodo y el taller ahora"}
          </h2>
          <div className="grid gap-4 lg:grid-cols-3">
            <MoneyCard money={t.money} today={preset === "hoy"} />
            <Card title="Taller" actions={<Link href="/taller" className="text-sm text-brand-600 hover:underline">Abrir tablero</Link>}>
              <p className="font-display text-4xl font-semibold text-neutral-50">{t.openOrders}</p>
              <p className="text-sm text-neutral-400">motos en el taller ahora</p>
            </Card>
            <Card title="Poco stock" actions={<Link href="/inventario?stock=poco" className="text-sm text-brand-600 hover:underline">Ver inventario</Link>}>
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

type Report = RouterOutputs["reports"]["period"];

/** A row «label ……… amount» that adds up in a column. */
function Row({ label, value, sign, strong, hint }: { label: ReactNode; value: ReactNode; sign?: "+" | "−" | "="; strong?: boolean; hint?: string }) {
  return (
    <div className={cx("flex items-baseline justify-between gap-3", strong && "border-t border-neutral-800 pt-1.5 font-semibold")}>
      <dt className={strong ? "text-neutral-100" : "text-neutral-400"}>
        {label}
        {hint && <span className="block text-xs font-normal text-neutral-500">{hint}</span>}
      </dt>
      <dd className="whitespace-nowrap tabular-nums">
        {sign && sign !== "=" ? `${sign} ` : ""}
        {value}
      </dd>
    </div>
  );
}

/**
 * Kenry, 23-nov: «¿cuánto ganamos?», in two parts the owners can check by hand:
 * the workshop (labor minus the mechanics' part; an owner's job is all profit)
 * and the shelves (what products were sold for minus what they cost).
 */
function ProfitCard({ cur }: { cur: Report["current"] }) {
  const p = cur.profit;
  const trips = dec(cur.tripExpenses);
  return (
    <Card title="¿Cuánto se ganó?">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <p className="font-display text-base font-semibold text-neutral-100">Del taller</p>
          <dl className="mt-2 space-y-1.5 text-sm">
            <Row label="Mano de obra cobrada" value={money(p.workshop.labor)} />
            <Row label="Parte de los mecánicos" hint="Su comisión; el mecánico «al 100 %» se lleva toda la suya" value={money(p.workshop.mechanics)} sign="−" />
            <Row label="Ganancia del taller" value={money(p.workshop.total)} strong />
          </dl>
          {dec(p.workshop.external).gt(0) && (
            <p className="mt-2 text-xs text-neutral-500">
              Además se cobraron {money(p.workshop.external)} de trabajos hechos afuera (torno, soldadura): ese dinero es para quien hizo el trabajo, no es ganancia.
            </p>
          )}
        </div>
        <div>
          <p className="font-display text-base font-semibold text-neutral-100">De los estantes (productos)</p>
          <dl className="mt-2 space-y-1.5 text-sm">
            <Row label="Vendido en mostrador" value={money(p.shelf.counterSales)} />
            <Row label="Lo que costó" value={money(p.shelf.counterCost)} sign="−" />
            <Row label="Repuestos usados en el taller" value={money(p.shelf.partsSales)} sign="+" />
            <Row label="Lo que costaron" value={money(p.shelf.partsCost)} sign="−" />
            <Row label="Ganancia de productos" value={money(p.shelf.total)} strong />
          </dl>
        </div>
      </div>
      <dl className="mt-5 space-y-1.5 rounded-lg bg-neutral-800/40 px-4 py-3 text-base">
        <Row label="Ganancia del periodo (taller + productos)" value={money(p.total)} />
        {trips.gt(0) && <Row label="Gastos de viajes de compra" value={money(cur.tripExpenses)} sign="−" />}
        {trips.gt(0) && <Row label="Queda" value={money(p.afterTrips)} strong />}
      </dl>
      <p className="mt-2 text-xs text-neutral-500">
        Cuenta las ventas de contado y al crédito del periodo (aunque el crédito no se haya cobrado), sin las anuladas y restando lo devuelto. El costo es el último costo
        de compra de cada producto. No incluye gastos que no están en el sistema (luz, alquiler, sueldos).
      </p>
    </Card>
  );
}

/** «¿Cuánto nos deben? ¿Cuánto debemos?» — right now. */
function DebtsCard({ debts }: { debts: Report["debts"] }) {
  return (
    <Card title="Deudas ahora">
      <div className="space-y-4">
        <Link href="/clientes?deuda=con_deuda" className="block rounded-lg border border-neutral-800 px-4 py-3 transition-colors hover:border-neutral-600">
          <p className="text-sm text-neutral-400">Nos deben (clientes)</p>
          <p className="font-display text-3xl font-semibold tabular-nums">{money(debts.customers.total)}</p>
          <p className="text-xs text-neutral-500">
            {debts.customers.count} cliente{debts.customers.count === 1 ? "" : "s"}
            {dec(debts.customers.overdue).gt(0) && <span className="text-bad-fg font-medium"> · {money(debts.customers.overdue)} ya vencidos</span>}
          </p>
        </Link>
        <Link href="/compras?ver=proveedores" className="block rounded-lg border border-neutral-800 px-4 py-3 transition-colors hover:border-neutral-600">
          <p className="text-sm text-neutral-400">Debemos (proveedores)</p>
          <p className="font-display text-3xl font-semibold tabular-nums">{money(debts.suppliers.total)}</p>
          <p className="text-xs text-neutral-500">
            {debts.suppliers.count} proveedor{debts.suppliers.count === 1 ? "" : "es"}
            {dec(debts.suppliers.overdue).gt(0) && <span className="text-bad-fg font-medium"> · {money(debts.suppliers.overdue)} ya vencidos</span>}
          </p>
        </Link>
        <Link href="/pagos" className="block rounded-lg border border-neutral-800 px-4 py-3 transition-colors hover:border-neutral-600">
          <p className="text-sm text-neutral-400">Por pagar a mecánicos</p>
          <p className="font-display text-2xl font-semibold tabular-nums">{money(dec(debts.mechanics.net).gt(0) ? debts.mechanics.net : 0)}</p>
          <p className="text-xs text-neutral-500">
            Comisiones ganadas {money(debts.mechanics.commissions)}
            {dec(debts.mechanics.advances).gt(0) && ` − adelantos ya dados ${money(debts.mechanics.advances)}`}
          </p>
        </Link>
      </div>
    </Card>
  );
}

/**
 * Kenry, 23-nov: the lines must add up to the total, with the same reasons as the
 * arqueo. The drawer (cash) first; transfers and money that never touched the
 * drawer go apart, below, so nobody adds them by mistake.
 */
function MoneyCard({ money: m, today }: { money: Report["money"]; today: boolean }) {
  return (
    <Card title={today ? "Caja de hoy" : "Dinero del periodo"}>
      <p className="mb-2 text-xs font-medium tracking-wide text-neutral-500 uppercase">Efectivo de la gaveta</p>
      <dl className="space-y-1.5 text-sm">
        {m.drawerIn.length === 0 && m.drawerOut.length === 0 && <p className="text-neutral-500">No entró ni salió efectivo.</p>}
        {m.drawerIn.map((l) => (
          <Row key={l.kind} label={l.label} value={money(l.amount)} sign="+" />
        ))}
        {m.drawerOut.map((l) => (
          <Row key={l.kind} label={l.label} value={money(l.amount)} sign="−" />
        ))}
        <Row label={today ? "Efectivo que entró − salió hoy" : "Efectivo neto del periodo"} value={money(m.drawerNet)} strong />
      </dl>
      {(m.otherIn.length > 0 || m.otherOut.length > 0) && (
        <>
          <p className="mt-4 mb-2 text-xs font-medium tracking-wide text-neutral-500 uppercase">Aparte (no está en la gaveta)</p>
          <dl className="space-y-1.5 text-sm">
            {m.otherIn.map((l) => (
              <Row key={l.method} label={`Cobrado por ${l.method.toLowerCase()}`} value={money(l.amount)} />
            ))}
            {m.otherOut.map((l) => (
              <Row key={l.kind} label={`${l.label} (fuera de la caja)`} value={money(l.amount)} />
            ))}
          </dl>
        </>
      )}
      <p className="mt-2 text-xs text-neutral-500">
        Los dólares van convertidos al tipo de cambio de cada cobro. Lo que debe haber en la caja (con la apertura) está en{" "}
        <Link href="/arqueo" className="text-brand-600 hover:underline">
          Apertura y cierre
        </Link>
        .
      </p>
    </Card>
  );
}

/**
 * «Lo que necesita atención» (Kenry, 23-nov): yesterday's cash still open,
 * motorcycles ready and not delivered, open trips, overdue credits, low stock…
 * each with a button to where it is solved. Nothing to do = nothing shown.
 */
function Notices() {
  const notices = api.reports.attention.useQuery(undefined, { refetchInterval: 120_000 });
  const list = notices.data ?? [];
  if (list.length === 0) return null;
  const tone = {
    red: "border-bad-line bg-bad-bg",
    amber: "border-warn-line bg-warn-bg",
    info: "border-neutral-800 bg-neutral-900",
  } as const;
  const label = { red: "Urgente", amber: "Pendiente", info: "Para hoy" } as const;
  return (
    <section aria-label="Lo que necesita atención" className="mb-6">
      <h2 className="font-display mb-2 text-lg font-semibold text-neutral-50">Necesita atención</h2>
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {list.map((n) => (
          <li key={n.key} className={cx("flex flex-col justify-between gap-3 rounded-xl border p-4", tone[n.tone])}>
            <div>
              <p className="text-xs font-medium tracking-wide text-neutral-400 uppercase">{label[n.tone]}</p>
              <p className="mt-0.5 font-semibold text-neutral-50">{n.title}</p>
              <p className="mt-1 text-sm text-neutral-300">{n.detail}</p>
            </div>
            <Link href={n.href} className="bg-brand-600 hover:bg-brand-700 self-start rounded-md px-3 py-2 text-sm font-medium text-white shadow-sm">
              {n.action} →
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
