"use client";

import { useState } from "react";

import { confirmDialog } from "~/app/_components/confirm";
import { Alert, Badge, Button, Card, Dialog, Field, Input, PageTitle, Select, Table } from "~/app/_components/ui";
import { docNo } from "~/lib/business";
import { errorMessage } from "~/lib/errors";
import { addDaysISO, dec, formatDateTime, money, todayISO } from "~/lib/format";
import { api, type RouterOutputs } from "~/trpc/react";

/**
 * Cash withdrawals (DEC-007, DEC-060): money that leaves the drawer for the
 * business (expenses, services, owner's withdrawal). The trip to Managua is a
 * «Viaje de compras» now (DEC-059) and supplier payments have their own place
 * (DEC-058), so a withdrawal is only what has no other home.
 * A withdrawal is never deleted: it is corrected or voided, with a reason, and
 * the change stays in its log.
 */
export default function WithdrawalsPage() {
  const me = api.auth.me.useQuery();
  const [range, setRange] = useState({ from: addDaysISO(todayISO(), -29), to: todayISO() });
  const list = api.staff.cashWithdrawals.useQuery(range);
  const [detail, setDetail] = useState<number | null>(null);
  const valid = (list.data ?? []).filter((w) => !w.voidedAt);
  const total = valid.reduce((a, w) => a.plus(dec(w.amount)), dec(0));
  const byReason = new Map<string, ReturnType<typeof dec>>();
  for (const w of valid) byReason.set(w.reason.name, (byReason.get(w.reason.name) ?? dec(0)).plus(dec(w.amount)));
  return (
    <>
      <PageTitle title="Retiros de caja" subtitle="Dinero que sale de la caja para gastos del negocio. Los viajes de compra y los pagos a proveedores van en Compras." />
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_360px]">
        <Card
          title="Retiros registrados"
          actions={
            <div className="flex items-end gap-2">
              <Field label="Desde">
                <Input type="date" value={range.from} max={range.to} onChange={(e) => setRange({ ...range, from: e.target.value })} />
              </Field>
              <Field label="Hasta">
                <Input type="date" value={range.to} min={range.from} onChange={(e) => setRange({ ...range, to: e.target.value })} />
              </Field>
            </div>
          }
        >
          {list.error && <Alert>{errorMessage(list.error)}</Alert>}
          <Table head={["N.º", "Fecha y hora", "Motivo", "Detalle", "Registró", "Monto", ""]} empty={!list.isLoading && list.data?.length === 0}>
            {list.data?.map((w) => (
              <tr key={w.id} className={w.voidedAt ? "text-neutral-500" : "cursor-pointer"} onClick={() => setDetail(w.id)}>
                <td className="whitespace-nowrap">{docNo("retiro", w.id)}</td>
                <td>{formatDateTime(w.createdAt)}</td>
                <td>
                  {w.reason.name}
                  <div className="flex gap-1">
                    {w.voidedAt && <Badge tone="red">Anulado</Badge>}
                    {w._count.changes > 0 && !w.voidedAt && <Badge tone="blue">Corregido</Badge>}
                  </div>
                </td>
                <td className="text-neutral-400">{w.description ?? "—"}</td>
                <td>{w.withdrawnBy.staff?.name ?? w.withdrawnBy.username}</td>
                <td className={`text-right tabular-nums ${w.voidedAt ? "line-through" : ""}`}>{money(w.amount)}</td>
                <td className="text-right">
                  <Button variant="ghost" onClick={() => setDetail(w.id)}>
                    Ver
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
          <div className="mt-3 flex flex-wrap justify-between gap-3 text-sm">
            <ul className="space-y-0.5 text-neutral-400">
              {[...byReason.entries()].map(([name, v]) => (
                <li key={name}>
                  {name}: <span className="tabular-nums">{money(v)}</span>
                </li>
              ))}
            </ul>
            <p>
              Total del periodo (sin anulados): <span className="font-semibold tabular-nums">{money(total)}</span>
            </p>
          </div>
        </Card>
        {me.data?.permissions.includes("caja.retiros") && <CashWithdrawal />}
      </div>
      <Dialog open={detail !== null} onClose={() => setDetail(null)} title={detail ? `Retiro ${docNo("retiro", detail)}` : "Retiro"} size="lg">
        {detail !== null && <WithdrawalDetail id={detail} onDone={() => setDetail(null)} />}
      </Dialog>
    </>
  );
}

function CashWithdrawal() {
  const utils = api.useUtils();
  const reasons = api.admin.catalog.useQuery({ kind: "cashWithdrawalReason", onlyActive: true });
  const [f, setF] = useState({ reasonId: 0, amount: "", description: "" });
  const w = api.staff.withdrawCash.useMutation({
    onSuccess: () => {
      setF({ reasonId: 0, amount: "", description: "" });
      void utils.reports.invalidate();
      void utils.staff.cashWithdrawals.invalidate();
      void utils.cash.invalidate();
    },
  });
  return (
    <Card title="Registrar un retiro">
      <div className="space-y-2">
        <Field label="Motivo">
          <Select value={f.reasonId} onChange={(e) => setF({ ...f, reasonId: Number(e.target.value) })}>
            <option value={0}>Elegir…</option>
            {reasons.data?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Monto (C$)">
          <Input inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        </Field>
        <Field label="Detalle (opcional)">
          <Input value={f.description} maxLength={200} placeholder="Ej.: recibo de la luz de noviembre" onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
        <Button
          className="w-full"
          disabled={!f.reasonId || !f.amount || w.isPending}
          onClick={async () => {
            const reason = reasons.data?.find((r) => r.id === f.reasonId)?.name ?? "";
            if (
              await confirmDialog(`Sacar ${money(f.amount)} de la caja por «${reason}»${f.description ? ` (${f.description})` : ""}.\nEl arqueo de hoy lo va a restar.`, {
                title: "¿Registrar el retiro?",
                confirmLabel: "Sí, registrar",
              })
            )
              w.mutate({ cashWithdrawalReasonId: f.reasonId, amount: f.amount, description: f.description || undefined });
          }}
        >
          Registrar retiro
        </Button>
        <Alert>{w.error && errorMessage(w.error)}</Alert>
        {w.isSuccess && <Alert kind="ok">Retiro {docNo("retiro", w.data.id)} registrado.</Alert>}
        <p className="text-xs text-neutral-500">¿Es una compra en Managua? Use Compras → Ingreso de mercadería → Viaje de compras. ¿Un pago a un proveedor? Páguelo desde su factura.</p>
      </div>
    </Card>
  );
}

type Detail = RouterOutputs["staff"]["withdrawal"];
const who = (u: { username: string; staff: { name: string } | null } | null | undefined) => u?.staff?.name ?? u?.username ?? "—";

/** A withdrawal with its log; correct or void it (with a reason). */
function WithdrawalDetail({ id, onDone }: { id: number; onDone: () => void }) {
  const q = api.staff.withdrawal.useQuery({ id });
  const reasons = api.admin.catalog.useQuery({ kind: "cashWithdrawalReason" });
  const utils = api.useUtils();
  const [mode, setMode] = useState<null | "edit" | "void">(null);
  const [f, setF] = useState<{ reasonId: number; amount: string; description: string } | null>(null);
  const [why, setWhy] = useState("");
  const done = () => {
    void utils.staff.invalidate();
    void utils.cash.invalidate();
    void utils.money.invalidate();
    onDone();
  };
  const update = api.staff.updateWithdrawal.useMutation({ onSuccess: done });
  const voidIt = api.staff.voidWithdrawal.useMutation({ onSuccess: done });
  if (q.error) return <Alert>{errorMessage(q.error)}</Alert>;
  const w = q.data;
  if (!w) return <p className="text-sm text-neutral-500">Cargando…</p>;
  const form = f ?? { reasonId: w.cashWithdrawalReasonId, amount: dec(w.amount).toFixed(2), description: w.description ?? "" };
  const reasonName = (rid: number) => reasons.data?.find((r) => r.id === rid)?.name ?? `#${rid}`;
  const busy = update.isPending || voidIt.isPending;
  const err = update.error ?? voidIt.error;
  return (
    <div className="space-y-3">
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-neutral-400">Monto</dt>
          <dd className={`font-display text-2xl font-semibold tabular-nums ${w.voidedAt ? "line-through" : ""}`}>{money(w.amount)}</dd>
        </div>
        <div>
          <dt className="text-neutral-400">Motivo</dt>
          <dd>{w.reason.name}</dd>
        </div>
        <div>
          <dt className="text-neutral-400">Registrado</dt>
          <dd>
            {formatDateTime(w.createdAt)} por {who(w.withdrawnBy)}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-400">Detalle</dt>
          <dd>{w.description ?? "—"}</dd>
        </div>
      </dl>
      {w.voidedAt && (
        <Alert>
          Anulado el {formatDateTime(w.voidedAt)} por {who(w.voidedBy)}. Motivo: {w.voidReason}. Ya no cuenta en el arqueo.
        </Alert>
      )}
      <ChangeLog changes={w.changes} reasonName={reasonName} />

      {w.canEdit ? (
        <div className="space-y-3 border-t border-neutral-800 pt-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => setMode(mode === "edit" ? null : "edit")}>
              Corregir retiro
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => setMode(mode === "void" ? null : "void")}>
              Anular retiro
            </Button>
          </div>
          {mode === "edit" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Motivo">
                <Select value={form.reasonId} onChange={(e) => setF({ ...form, reasonId: Number(e.target.value) })}>
                  {reasons.data
                    ?.filter((r) => r.active || r.id === w.cashWithdrawalReasonId)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Monto (C$)">
                <Input inputMode="decimal" value={form.amount} onChange={(e) => setF({ ...form, amount: e.target.value })} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Detalle">
                  <Input value={form.description} maxLength={200} onChange={(e) => setF({ ...form, description: e.target.value })} />
                </Field>
              </div>
            </div>
          )}
          {mode && (
            <>
              <Field label="¿Por qué se cambia? (obligatorio, queda registrado)">
                <Input value={why} maxLength={200} onChange={(e) => setWhy(e.target.value)} placeholder="Ej.: se escribió 500 en vez de 50" />
              </Field>
              <Button
                variant={mode === "void" ? "danger" : "primary"}
                disabled={busy || why.trim().length < 5 || (mode === "edit" && !form.amount)}
                onClick={async () => {
                  if (mode === "void") {
                    if (await confirmDialog(`¿Anular el retiro ${docNo("retiro", w.id)} de ${money(w.amount)}? Deja de contar en el arqueo.`, { title: "Anular retiro", confirmLabel: "Sí, anular", danger: true }))
                      voidIt.mutate({ id: w.id, reason: why.trim() });
                  } else {
                    update.mutate({
                      id: w.id,
                      cashWithdrawalReasonId: form.reasonId,
                      amount: form.amount,
                      description: form.description.trim() || undefined,
                      reason: why.trim(),
                    });
                  }
                }}
              >
                {mode === "void" ? "Sí, anular retiro" : "Guardar corrección"}
              </Button>
            </>
          )}
          <Alert>{err && errorMessage(err)}</Alert>
          <p className="text-xs text-neutral-500">
            {w.isAdmin
              ? "Si la caja de ese día ya se cerró, después de corregir revise «Apertura y cierre»: avisará la diferencia y podrá corregir el cierre."
              : "Puede corregir sus retiros de hoy mientras la caja esté abierta. Después, solo un administrador."}
          </p>
        </div>
      ) : (
        w.blockedReason && !w.voidedAt && <p className="border-t border-neutral-800 pt-3 text-sm text-neutral-400">{w.blockedReason}</p>
      )}
    </div>
  );
}

function ChangeLog({ changes, reasonName }: { changes: Detail["changes"]; reasonName: (id: number) => string }) {
  if (changes.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-sm font-medium">Cambios</p>
      <ul className="space-y-2 text-sm">
        {changes.map((c) => {
          const b = c.before as Record<string, string | number | null>;
          const a = c.after as Record<string, string | number | null>;
          const diffs: string[] = [];
          if (b.amount !== a.amount) diffs.push(`Monto: ${money(String(b.amount))} → ${money(String(a.amount))}`);
          if (b.cashWithdrawalReasonId !== a.cashWithdrawalReasonId)
            diffs.push(`Motivo: ${reasonName(Number(b.cashWithdrawalReasonId))} → ${reasonName(Number(a.cashWithdrawalReasonId))}`);
          if (b.description !== a.description) diffs.push(`Detalle: ${b.description ?? "—"} → ${a.description ?? "—"}`);
          return (
            <li key={c.id} className="rounded-md border border-neutral-800 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={c.action === "ANULACION" ? "red" : "blue"}>{c.action === "ANULACION" ? "Anulado" : "Corregido"}</Badge>
                <span className="text-neutral-400">
                  {formatDateTime(c.changedAt)} por {who(c.changedBy)}
                </span>
              </div>
              <p className="mt-1">Motivo: {c.reason}</p>
              {diffs.length > 0 && <p className="mt-1 text-xs text-neutral-400">{diffs.join(" · ")}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
