"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { responsibleLabel } from "~/app/_components/pickers";
import { Alert, Card, Select, Table } from "~/app/_components/ui";
import { errorMessage } from "~/lib/errors";
import { formatDay, money } from "~/lib/format";
import { api, type RouterOutputs } from "~/trpc/react";

/**
 * Pago a mecánicos (DEC-056): the summary, «Dar adelanto» and «Pagar periodo
 * trabajado» are three screens of the same area. The chosen mechanic travels in
 * the address (?mecanico=ID), so it stays the same when moving between them.
 * Only people with commission are paid here; owners and the "100 %" mechanic
 * without a rate are not (DEC-041).
 */
export function useMechanic() {
  const staff = api.staff.list.useQuery();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const mechanics = staff.data?.filter((s) => s.kind === "MECANICO" && s.commissionRate && s.active) ?? [];
  const wanted = Number(params.get("mecanico") ?? 0);
  const selected = mechanics.find((m) => m.id === wanted) ?? mechanics[0];
  return {
    loading: staff.isLoading,
    mechanics,
    selected,
    /** Same screen, another mechanic. */
    choose: (id: number) => router.replace(`${pathname}?mecanico=${id}`),
    /** Link to another screen of the area keeping the mechanic. */
    href: (path: string) => (selected ? `${path}?mecanico=${selected.id}` : path),
  };
}

export function MechanicSelect({ m }: { m: ReturnType<typeof useMechanic> }) {
  if (m.loading) return <p className="text-sm text-neutral-500">Cargando…</p>;
  if (m.mechanics.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        No hay mecánicos con comisión.{" "}
        <Link className="text-brand-600 hover:underline" href="/admin/personas">
          Regístrelos en Personas del negocio
        </Link>
        .
      </p>
    );
  }
  return (
    <Select aria-label="Mecánico" className="h-11 max-w-md text-base font-medium" value={m.selected?.id ?? 0} onChange={(e) => m.choose(Number(e.target.value))}>
      {m.mechanics.map((x) => (
        <option key={x.id} value={x.id}>
          {responsibleLabel(x)}
        </option>
      ))}
    </Select>
  );
}

type Pending = RouterOutputs["staff"]["pending"];

/** Orders with commission and advances not yet discounted, with the totals. */
export function PendingSummary({ p, error, title = "Lo que tiene ganado sin cobrar" }: { p?: Pending; error?: unknown; title?: string }) {
  if (error) return <Alert>{errorMessage(error)}</Alert>;
  if (!p) return <p className="text-sm text-neutral-500">Cargando…</p>;
  return (
    <Card title={title}>
      <Table head={["Orden", "Cliente", "Entregada", "Mano de obra", "Comisión"]} empty={p.orders.length === 0}>
        {p.orders.map((o) => (
          <tr key={o.serviceOrderId}>
            <td>
              <Link className="hover:text-brand-600" href={`/taller/${o.serviceOrderId}`}>
                #{o.serviceOrderId}
              </Link>
            </td>
            <td>{o.customer}</td>
            <td>{o.deliveredAt ? new Date(o.deliveredAt).toLocaleDateString("es-NI") : "—"}</td>
            <td className="tabular-nums">{money(o.labor)}</td>
            <td className="tabular-nums">{money(o.commission)}</td>
          </tr>
        ))}
      </Table>
      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold">Adelantos sin descontar</h3>
          <ul className="text-sm text-neutral-300">
            {p.advances.map((a) => (
              <li key={a.id} className="tabular-nums">
                {formatDay(a.givenOn)} · {money(a.amount)}
              </li>
            ))}
            {p.advances.length === 0 && <li className="text-neutral-500">Ninguno</li>}
          </ul>
        </div>
        <dl className="grid grid-cols-2 gap-1 self-end text-sm">
          <dt className="text-neutral-400">Comisiones</dt>
          <dd className="text-right tabular-nums">{money(p.commission)}</dd>
          <dt className="text-neutral-400">Adelantos</dt>
          <dd className="text-right tabular-nums">− {money(p.advanced)}</dd>
          <dt className="border-t border-neutral-700 pt-1 text-base font-semibold">A pagar</dt>
          <dd className="border-t border-neutral-700 pt-1 text-right text-base font-semibold tabular-nums">{money(p.net)}</dd>
        </dl>
      </div>
    </Card>
  );
}
