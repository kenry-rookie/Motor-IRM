"use client";

/**
 * Small hand-built charts (no chart library) following one set of rules:
 * thin marks (≤ 24px), 4px rounded data-end, 2px surface gap between stacked
 * segments, hairline grid, one y-axis, legend for ≥ 2 series, tooltip on hover
 * AND keyboard focus, and a table view so no value depends on hovering.
 * Colors: validated categorical slots --color-series-1/2 (blue, orange).
 */
import { type ReactNode, useState } from "react";

import { cx } from "~/app/_components/ui";

export type Series = { key: string; label: string; color: string };
type Row = { label: string; values: Record<string, number> };

/** Clean axis maximum and ticks (0, 2.5K, 5K…). */
function niceScale(max: number, ticks = 4) {
  if (max <= 0) return { max: 1, step: 0.25 };
  const raw = max / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  return { max: step * Math.ceil(max / step), step };
}

export const compact = (n: number) =>
  Math.abs(n) >= 1_000_000
    ? `${(n / 1_000_000).toLocaleString("es-NI", { maximumFractionDigits: 1 })} M`
    : Math.abs(n) >= 10_000
      ? `${(n / 1000).toLocaleString("es-NI", { maximumFractionDigits: 1 })} K`
      : n.toLocaleString("es-NI", { maximumFractionDigits: 0 });

function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <ul className="flex flex-wrap gap-4 text-xs text-neutral-400">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} aria-hidden="true" />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

/** Columns over time; with 2+ series they stack (parts of one total). */
export function ColumnChart({
  rows,
  series,
  format,
  height = 220,
  title,
  caption,
}: {
  rows: Row[];
  series: Series[];
  format: (n: number) => string;
  height?: number;
  title: string;
  caption?: ReactNode;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);
  const totals = rows.map((r) => series.reduce((a, s) => a + (r.values[s.key] ?? 0), 0));
  const { max, step } = niceScale(Math.max(0, ...totals));
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
  const every = Math.max(1, Math.ceil(rows.length / 12));
  const h = rows[hover ?? -1];

  return (
    <figure className="space-y-3">
      <figcaption className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-medium text-neutral-100">{title}</p>
          {caption && <p className="text-xs text-neutral-500">{caption}</p>}
        </div>
        <div className="flex items-center gap-4">
          <Legend series={series} />
          <button type="button" className="text-xs text-neutral-500 underline-offset-2 hover:underline" onClick={() => setAsTable((t) => !t)}>
            {asTable ? "Ver gráfica" : "Ver tabla"}
          </button>
        </div>
      </figcaption>

      {asTable ? (
        <DataTable rows={rows} series={series} format={format} />
      ) : (
        <div className="flex gap-2">
          {/* y axis */}
          <div className="relative w-12 shrink-0 text-right text-[11px] text-neutral-500 tabular-nums" style={{ height }}>
            {ticks.map((t) => (
              <span key={t} className="absolute right-0 -translate-y-1/2" style={{ bottom: `${(t / max) * 100}%` }}>
                {compact(t)}
              </span>
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <div className="relative" style={{ height }} onMouseLeave={() => setHover(null)}>
              {ticks.map((t) => (
                <div key={t} className="absolute inset-x-0 h-px bg-[var(--color-grid)]" style={{ bottom: `${(t / max) * 100}%` }} aria-hidden="true" />
              ))}
              <div className="absolute inset-0 flex items-end">
                {rows.map((r, i) => {
                  const nonZero = series.filter((s) => (r.values[s.key] ?? 0) > 0);
                  const top = nonZero[nonZero.length - 1]?.key;
                  return (
                    <div
                      key={r.label}
                      tabIndex={0}
                      role="img"
                      aria-label={`${r.label}: ${series.map((s) => `${s.label} ${format(r.values[s.key] ?? 0)}`).join(", ")}`}
                      onMouseEnter={() => setHover(i)}
                      onFocus={() => setHover(i)}
                      onBlur={() => setHover(null)}
                      className={cx("flex h-full flex-1 flex-col items-center justify-end outline-none", hover === i && "bg-neutral-800/40")}
                    >
                      <div className="flex w-full max-w-6 flex-col-reverse" style={{ height: `${(totals[i]! / max) * 100}%` }}>
                        {series.map((s) => {
                          const v = r.values[s.key] ?? 0;
                          if (v <= 0) return null;
                          return (
                            <div
                              key={s.key}
                              className={cx(s.key === top ? "rounded-t-[4px]" : "", "border-b-2 border-[var(--color-neutral-900)] first:border-b-0")}
                              style={{ height: `${(v / totals[i]!) * 100}%`, background: s.color }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              {h && (
                <div
                  className="pointer-events-none absolute top-0 z-10 min-w-36 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs shadow-lg"
                  style={{
                    left: `${((hover! + 0.5) / rows.length) * 100}%`,
                    transform: hover! > rows.length / 2 ? "translateX(calc(-100% - 8px))" : "translateX(8px)",
                  }}
                >
                  <p className="mb-1 text-neutral-500">{h.label}</p>
                  {series.map((s) => (
                    <p key={s.key} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5 text-neutral-400">
                        <span className="h-0.5 w-3" style={{ background: s.color }} aria-hidden="true" />
                        {s.label}
                      </span>
                      <span className="font-semibold text-neutral-50 tabular-nums">{format(h.values[s.key] ?? 0)}</span>
                    </p>
                  ))}
                  {series.length > 1 && (
                    <p className="mt-1 flex justify-between gap-3 border-t border-neutral-800 pt-1">
                      <span className="text-neutral-400">Total</span>
                      <span className="font-semibold text-neutral-50 tabular-nums">{format(totals[hover!]!)}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="mt-1 flex text-[11px] text-neutral-500">
              {rows.map((r, i) => (
                <span key={r.label} className="flex-1 truncate text-center">
                  {i % every === 0 ? r.label : ""}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </figure>
  );
}

/** Horizontal bars for a ranking (one series): label left, value at the tip. */
export function BarList({
  items,
  format,
  color = "var(--color-series-1)",
  title,
  caption,
}: {
  items: { label: string; value: number; detail?: string }[];
  format: (n: number) => string;
  color?: string;
  title: string;
  caption?: ReactNode;
}) {
  const max = Math.max(0, ...items.map((i) => i.value)) || 1;
  return (
    <figure className="space-y-3">
      <figcaption>
        <p className="font-medium text-neutral-100">{title}</p>
        {caption && <p className="text-xs text-neutral-500">{caption}</p>}
      </figcaption>
      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">Sin ventas de productos en este periodo.</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((it) => (
            <li key={it.label} className="grid grid-cols-[minmax(0,10rem)_1fr] items-center gap-3 text-sm" title={it.detail}>
              <span className="truncate text-neutral-300">{it.label}</span>
              <span className="flex items-center gap-2">
                <span className="h-3 rounded-r-[4px]" style={{ width: `${Math.max(2, (it.value / max) * 85)}%`, background: color }} aria-hidden="true" />
                <span className="text-xs whitespace-nowrap text-neutral-100 tabular-nums">
                  {format(it.value)}
                  {it.detail && <span className="text-neutral-500"> · {it.detail}</span>}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}

function DataTable({ rows, series, format }: { rows: Row[]; series: Series[]; format: (n: number) => string }) {
  return (
    <div className="max-h-72 overflow-auto rounded-lg border border-neutral-800">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-neutral-900 text-xs text-neutral-400">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Periodo</th>
            {series.map((s) => (
              <th key={s.key} className="px-3 py-2 text-right font-medium">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-neutral-800">
              <td className="px-3 py-1.5">{r.label}</td>
              {series.map((s) => (
                <td key={s.key} className="px-3 py-1.5 text-right tabular-nums">
                  {format(r.values[s.key] ?? 0)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
