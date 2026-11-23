"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { GROUP_LABELS } from "~/app/_components/global-search";
import { Alert, Badge, Card, cx, EmptyState, PageTitle, SearchField } from "~/app/_components/ui";
import { errorMessage } from "~/lib/errors";
import { useDebounced } from "~/lib/use-debounced";
import { api } from "~/trpc/react";

type SearchGroup = keyof typeof GROUP_LABELS;
const GROUPS = Object.keys(GROUP_LABELS) as SearchGroup[];

/**
 * Buscar (Kenry, 23-nov): one box for everything, with big buttons to narrow
 * the results for someone who doesn't know where things live in the system.
 */
export default function SearchPage() {
  const [text, setText] = useState("");
  const [only, setOnly] = useState<SearchGroup | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("q")) setText(p.get("q")!);
  }, []);
  const q = useDebounced(text.trim(), 200);
  // Without a filter: a few of each kind. With a filter: many of that kind.
  const found = api.search.global.useQuery({ q, only: only ?? undefined, limit: only ? 30 : 6 }, { enabled: q.length > 0, placeholderData: (p) => p });
  const counts = api.search.global.useQuery({ q, limit: 1 }, { enabled: q.length > 0 && !!only, placeholderData: (p) => p });
  const allCounts = only ? counts.data?.counts : found.data?.counts;
  const hits = q ? (found.data?.hits ?? []) : [];

  return (
    <>
      <PageTitle title="Buscar" subtitle="Escriba lo que sabe y el sistema lo encuentra. No hace falta saber en qué pantalla está." />
      <Card>
        <SearchField
          className="w-full max-w-2xl"
          label="Buscar en todo el sistema"
          placeholder="Número de factura o recibo, nombre, teléfono, placa, producto…"
          value={text}
          onValue={setText}
          inputProps={{ autoFocus: true }}
        />
        <div className="mt-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Qué buscar">
          <Chip on={!only} onClick={() => setOnly(null)} label="Todo" />
          {GROUPS.map((g) => (
            <Chip key={g} on={only === g} onClick={() => setOnly(g)} label={GROUP_LABELS[g]} count={q ? allCounts?.[g] : undefined} />
          ))}
        </div>
      </Card>

      <div className="mt-4">
        {found.error && <Alert>{errorMessage(found.error)}</Alert>}
        {!q ? (
          <Card title="¿Qué puede escribir?">
            <ul className="grid gap-3 text-sm sm:grid-cols-2">
              <Example text="R-000045" what="un recibo de abono (también F- factura, OS- orden del taller, C- compra, RT- retiro…)" onPick={setText} />
              <Example text="45" what="el número sin letras: busca facturas, órdenes, recibos y compras con ese número" onPick={setText} />
              <Example text="Juan Pérez" what="un cliente por su nombre (aunque esté mal escrito), teléfono o cédula" onPick={setText} />
              <Example text="M 123" what="una moto por su placa o chasis; dice si está en el taller" onPick={setText} />
              <Example text="aceite 20w50" what="un producto, con su precio y lo que hay en stock" onPick={setText} />
              <Example text="Casa Pellas" what="un proveedor" onPick={setText} />
            </ul>
          </Card>
        ) : found.isLoading ? (
          <p className="text-sm text-neutral-500">Buscando…</p>
        ) : hits.length === 0 ? (
          <EmptyState title={`No se encontró nada con «${q}»`}>Revise cómo está escrito o pruebe con menos palabras.{only ? " También puede quitar el filtro y buscar en «Todo»." : ""}</EmptyState>
        ) : (
          <div className="space-y-4">
            {(only ? [only] : GROUPS).map((g) => {
              const of = hits.filter((h) => h.group === g);
              if (!of.length) return null;
              const total = allCounts?.[g] ?? of.length;
              return (
                <Card key={g} title={`${GROUP_LABELS[g]} (${total})`}>
                  <ul className="divide-y divide-neutral-800">
                    {of.map((h) => (
                      <li key={h.key}>
                        <Link href={h.href} className="flex items-center justify-between gap-3 px-1 py-3 hover:bg-neutral-800/40">
                          <span className="min-w-0">
                            <span className="block text-base font-medium text-neutral-100">{h.title}</span>
                            <span className="block text-sm text-neutral-400">{h.subtitle}</span>
                          </span>
                          <span className="flex shrink-0 items-center gap-3">
                            {h.badge && <Badge tone={h.badge === "En el taller" || h.badge === "Agotado" ? "amber" : "neutral"}>{h.badge}</Badge>}
                            <span className="text-sm font-medium text-brand-600">Abrir →</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {!only && total > of.length && (
                    <button type="button" className="mt-2 text-sm font-medium text-brand-600 hover:underline" onClick={() => setOnly(g)}>
                      Ver los {total} →
                    </button>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function Chip({ on, onClick, label, count }: { on: boolean; onClick: () => void; label: string; count?: number }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={cx(
        "min-h-11 rounded-full border px-4 text-sm font-medium transition-colors",
        on ? "border-brand-600 bg-brand-600 text-white" : "border-neutral-700 text-neutral-300 hover:bg-neutral-800",
      )}
    >
      {label}
      {count !== undefined && <span className={cx("ml-1.5", on ? "text-white/80" : "text-neutral-500")}>{count}</span>}
    </button>
  );
}

function Example({ text, what, onPick }: { text: string; what: string; onPick: (t: string) => void }) {
  return (
    <li>
      <button type="button" onClick={() => onPick(text)} className="w-full rounded-lg border border-neutral-800 px-3 py-2 text-left hover:border-neutral-600">
        <span className="font-mono text-base text-neutral-100">{text}</span>
        <span className="block text-neutral-400">{what}</span>
      </button>
    </li>
  );
}
