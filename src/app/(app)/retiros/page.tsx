"use client";

import { useState } from "react";

import { Alert, Button, Card, Field, Input, PageTitle, Select, Table } from "~/app/_components/ui";
import { errorMessage } from "~/lib/errors";
import { addDaysISO, dec, formatDay, money, todayISO } from "~/lib/format";
import { api } from "~/trpc/react";

/**
 * Cash withdrawals (DEC-005, DEC-007): money that leaves the drawer for the
 * business (trip to Managua, expenses, owner's withdrawal). Its own option,
 * apart from staff pay (Kenry, 10-nov).
 */
export default function WithdrawalsPage() {
  const me = api.auth.me.useQuery();
  const [range, setRange] = useState({ from: addDaysISO(todayISO(), -29), to: todayISO() });
  const list = api.staff.cashWithdrawals.useQuery(range);
  const total = (list.data ?? []).reduce((a, w) => a.plus(dec(w.amount)), dec(0));
  return (
    <>
      <PageTitle title="Retiros de caja" subtitle="Dinero que sale de la caja para gastos del negocio" />
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
          <Table head={["Fecha", "Motivo", "Detalle", "Registró", "Monto"]} empty={!list.isLoading && list.data?.length === 0}>
            {list.data?.map((w) => (
              <tr key={w.id}>
                <td>{formatDay(w.withdrawnOn)}</td>
                <td>{w.reason.name}</td>
                <td className="text-neutral-400">{w.description ?? "—"}</td>
                <td>{w.withdrawnBy.username}</td>
                <td className="text-right tabular-nums">{money(w.amount)}</td>
              </tr>
            ))}
          </Table>
          <p className="mt-3 text-right text-sm">
            Total del periodo: <span className="font-semibold tabular-nums">{money(total)}</span>
          </p>
        </Card>
        {me.data?.permissions.includes("caja.retiros") && <CashWithdrawal />}
      </div>
    </>
  );
}

function CashWithdrawal() {
  const utils = api.useUtils();
  const reasons = api.admin.catalog.useQuery({ kind: "cashWithdrawalReason" });
  const [f, setF] = useState({ reasonId: 0, amount: "", description: "" });
  const w = api.staff.withdrawCash.useMutation({
    onSuccess: () => {
      setF({ reasonId: 0, amount: "", description: "" });
      void utils.reports.invalidate();
      void utils.staff.cashWithdrawals.invalidate();
    },
  });
  return (
    <Card title="Registrar un retiro">
      <div className="space-y-2">
        <Select value={f.reasonId} onChange={(e) => setF({ ...f, reasonId: Number(e.target.value) })}>
          <option value={0}>Motivo…</option>
          {reasons.data
            ?.filter((r) => r.active)
            .map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
        </Select>
        <Input inputMode="decimal" placeholder="Monto C$" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        <Input placeholder="Detalle (opcional)" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <Button
          className="w-full"
          disabled={!f.reasonId || !f.amount || w.isPending}
          onClick={() => w.mutate({ cashWithdrawalReasonId: f.reasonId, amount: f.amount, description: f.description || undefined })}
        >
          Registrar retiro
        </Button>
        <Alert>{w.error && errorMessage(w.error)}</Alert>
        {w.isSuccess && <Alert kind="ok">Retiro registrado.</Alert>}
      </div>
    </Card>
  );
}
