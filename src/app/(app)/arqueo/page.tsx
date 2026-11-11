"use client";

import { useState } from "react";

import { confirmDialog } from "~/app/_components/confirm";
import {
  Alert,
  Badge,
  Button,
  Card,
  Dialog,
  Field,
  Input,
  PageTitle,
  Stat,
  Table,
} from "~/app/_components/ui";
import { errorMessage } from "~/lib/errors";
import {
  addDaysISO,
  dec,
  formatDateTime,
  formatDay,
  money,
  todayISO,
} from "~/lib/format";
import { api, type RouterOutputs } from "~/trpc/react";

/**
 * Apertura y cierre de caja (arqueo) — migración 9c.
 * 1. Al empezar el día: «Abrir caja» con el dinero con que se empieza.
 * 2. Durante el día: se ve cuánto DEBERÍA haber en la gaveta.
 * 3. Al terminar: se cuenta el dinero, el sistema muestra sobrante o faltante
 *    y la caja queda cerrada con ese registro.
 */
export default function CashSessionPage() {
  const me = api.auth.me.useQuery();
  const status = api.cash.status.useQuery();
  const current = api.cash.current.useQuery();
  const canOperate = me.data?.permissions.includes("caja.arqueo") ?? false;

  return (
    <>
      <PageTitle
        title="Apertura y cierre de caja"
        subtitle="Con cuánto se abre la caja, cuánto debería haber y cuánto se contó al cerrar."
      />
      <div className="space-y-4">
        {status.error && <Alert>{errorMessage(status.error)}</Alert>}
        {current.error && <Alert>{errorMessage(current.error)}</Alert>}
        {current.data ? (
          <OpenSession
            data={current.data}
            canOperate={canOperate}
            today={status.data?.today}
          />
        ) : (
          status.data && (
            <OpenForm status={status.data} canOperate={canOperate} />
          )
        )}
        <History />
      </div>
    </>
  );
}

type Status = RouterOutputs["cash"]["status"];
type Current = NonNullable<RouterOutputs["cash"]["current"]>;

function OpenForm({
  status,
  canOperate,
}: {
  status: Status;
  canOperate: boolean;
}) {
  const utils = api.useUtils();
  const [f, setF] = useState({
    nio: status.suggestedOpening.nio,
    usd: status.suggestedOpening.usd,
    notes: "",
  });
  const open = api.cash.open.useMutation({
    onSuccess: () => {
      void utils.cash.invalidate();
    },
  });
  if (status.todayClosed)
    return (
      <Alert kind="ok">
        La caja de hoy ya se cerró. Puede ver el arqueo abajo, en el historial.
      </Alert>
    );
  if (!canOperate)
    return (
      <Alert kind="info">
        La caja de hoy no está abierta. Su rol no puede abrirla.
      </Alert>
    );
  return (
    <Card title="Abrir la caja de hoy">
      <p className="mb-3 text-sm text-neutral-400">
        Cuente el dinero que hay en la gaveta antes de empezar a vender. Se
        sugiere lo que se contó al cerrar la última caja.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Efectivo en córdobas (C$)">
          <Input
            inputMode="decimal"
            value={f.nio}
            onChange={(e) => setF({ ...f, nio: e.target.value })}
            autoFocus
          />
        </Field>
        <Field label="Efectivo en dólares (US$)" hint="0 si no hay dólares">
          <Input
            inputMode="decimal"
            value={f.usd}
            onChange={(e) => setF({ ...f, usd: e.target.value })}
          />
        </Field>
        <Field label="Nota (opcional)">
          <Input
            value={f.notes}
            onChange={(e) => setF({ ...f, notes: e.target.value })}
            maxLength={200}
          />
        </Field>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button
          disabled={open.isPending || f.nio === ""}
          onClick={async () => {
            const ok = await confirmDialog(
              `¿Abrir la caja de hoy con ${money(f.nio)}${dec(f.usd).gt(0) ? ` y ${money(f.usd, "USD")}` : ""}?`,
              { title: "Abrir caja", confirmLabel: "Sí, abrir caja" },
            );
            if (ok)
              open.mutate({
                openingNio: f.nio || "0",
                openingUsd: f.usd || "0",
                notes: f.notes || undefined,
              });
          }}
        >
          Abrir caja
        </Button>
      </div>
      <div className="mt-3">
        <Alert>{open.error && errorMessage(open.error)}</Alert>
      </div>
    </Card>
  );
}

function SummaryTable({
  data,
  opening,
}: {
  data: Current["summary"];
  opening: { nio: unknown; usd: unknown };
}) {
  return (
    <Table head={["Concepto", "Movimientos", "C$", "US$"]}>
      <tr>
        <td className="font-medium">Apertura</td>
        <td />
        <td className="text-right tabular-nums">
          {money(opening.nio as string)}
        </td>
        <td className="text-right tabular-nums">
          {money(opening.usd as string, "USD")}
        </td>
      </tr>
      <tr>
        <td>(+) Cobros en efectivo</td>
        <td className="text-neutral-400">
          {data.cashInNio.count + data.cashInUsd.count}
        </td>
        <td className="text-ok-fg text-right tabular-nums">
          {money(data.cashInNio.amount)}
        </td>
        <td className="text-ok-fg text-right tabular-nums">
          {money(data.cashInUsd.amount, "USD")}
        </td>
      </tr>
      {data.outflows.map((o) => (
        <tr key={o.key}>
          <td>(−) {o.label}</td>
          <td className="text-neutral-400">{o.count}</td>
          <td
            className={`text-right tabular-nums ${dec(o.amount).gt(0) ? "text-bad-fg" : "text-neutral-500"}`}
          >
            {money(o.amount)}
          </td>
          <td />
        </tr>
      ))}
    </Table>
  );
}

function Difference({
  value,
  currency = "NIO",
}: {
  value: unknown;
  currency?: "NIO" | "USD";
}) {
  const d = dec(value as string);
  if (d.isZero()) return <Badge tone="green">Cuadra</Badge>;
  return d.gt(0) ? (
    <Badge tone="amber">Sobran {money(d, currency)}</Badge>
  ) : (
    <Badge tone="red">Faltan {money(d.abs(), currency)}</Badge>
  );
}

function OpenSession({
  data,
  canOperate,
  today,
}: {
  data: Current;
  canOperate: boolean;
  today?: string;
}) {
  const utils = api.useUtils();
  const s = data.session;
  const [f, setF] = useState({ nio: "", usd: "", notes: "" });
  const close = api.cash.close.useMutation({
    onSuccess: () => {
      setF({ nio: "", usd: "", notes: "" });
      void utils.cash.invalidate();
    },
  });
  const counted = f.nio !== "";
  const diffNio = dec(f.nio).minus(dec(data.expected.nio));
  const diffUsd = dec(f.usd || "0").minus(dec(data.expected.usd));
  const hasDiff = counted && (!diffNio.isZero() || !diffUsd.isZero());
  const isOld = today !== undefined && s.day !== today;

  return (
    <>
      {isOld && (
        <Alert>
          Esta caja es del {formatDay(s.businessDay)} y no se cerró. Ciérrela
          con el conteo del dinero para poder abrir la de hoy.
        </Alert>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Debería haber en córdobas"
          value={money(data.expected.nio)}
          detail={`Caja del ${formatDay(s.businessDay)} · abierta ${formatDateTime(s.openedAt)} por ${s.openedBy.staff?.name ?? s.openedBy.username}`}
        />
        <Stat
          label="Debería haber en dólares"
          value={money(data.expected.usd, "USD")}
        />
        <Stat
          label="Cobrado por otros métodos"
          value={money(
            data.summary.otherMethods.reduce(
              (a, m) => a.plus(dec(m.amountNio)),
              dec(0),
            ),
          )}
          detail={
            data.summary.otherMethods.length
              ? data.summary.otherMethods
                  .map((m) => `${m.method}: ${money(m.amountNio)}`)
                  .join(" · ")
              : "Transferencias y tarjeta no entran a la gaveta"
          }
        />
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_380px]">
        <Card
          title="Movimientos de efectivo del día"
          actions={<Badge tone="green">Caja abierta</Badge>}
        >
          <SummaryTable
            data={data.summary}
            opening={{ nio: s.openingNio, usd: s.openingUsd }}
          />
          <p className="mt-3 text-xs text-neutral-500">
            Los pagos a proveedores no se restan aquí: las compras de contado
            salen del retiro «Viaje a Managua». Si sale efectivo por otra razón,
            regístrelo en Retiros de caja para que el arqueo cuadre.
          </p>
          {s.openingNotes && (
            <p className="mt-2 text-xs text-neutral-400">
              Nota de apertura: {s.openingNotes}
            </p>
          )}
          {canOperate && !isOld && (
            <CancelOpening id={s.id} summary={data.summary} />
          )}
        </Card>
        {canOperate ? (
          <Card title="Cerrar caja (arqueo)">
            <div className="space-y-3">
              <Field label="Córdobas contados (C$)">
                <Input
                  inputMode="decimal"
                  value={f.nio}
                  onChange={(e) => setF({ ...f, nio: e.target.value })}
                />
              </Field>
              <Field label="Dólares contados (US$)" hint="Vacío = 0">
                <Input
                  inputMode="decimal"
                  value={f.usd}
                  onChange={(e) => setF({ ...f, usd: e.target.value })}
                />
              </Field>
              {counted && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-neutral-400">Resultado:</span>
                  <Difference value={diffNio.toString()} />
                  {!dec(data.expected.usd).isZero() || dec(f.usd).gt(0) ? (
                    <Difference value={diffUsd.toString()} currency="USD" />
                  ) : null}
                </div>
              )}
              <Field
                label={
                  hasDiff
                    ? "Nota (obligatoria: explique la diferencia)"
                    : "Nota (opcional)"
                }
              >
                <Input
                  value={f.notes}
                  onChange={(e) => setF({ ...f, notes: e.target.value })}
                  maxLength={200}
                />
              </Field>
              <Button
                className="w-full"
                disabled={
                  !counted || close.isPending || (hasDiff && !f.notes.trim())
                }
                onClick={async () => {
                  const ok = await confirmDialog(
                    `¿Cerrar la caja del ${formatDay(s.businessDay)} con ${money(f.nio)}${dec(f.usd).gt(0) ? ` y ${money(f.usd, "USD")}` : ""} contados? Después de cerrar ya no se puede cambiar el conteo.`,
                    { title: "Cerrar caja", confirmLabel: "Sí, cerrar caja" },
                  );
                  if (ok)
                    close.mutate({
                      cashSessionId: s.id,
                      countedNio: f.nio,
                      countedUsd: f.usd || "0",
                      notes: f.notes || undefined,
                    });
                }}
              >
                Cerrar caja
              </Button>
              <Alert>{close.error && errorMessage(close.error)}</Alert>
            </div>
          </Card>
        ) : (
          <Alert kind="info">Su rol puede ver la caja pero no cerrarla.</Alert>
        )}
      </div>
    </>
  );
}

function History() {
  const me = api.auth.me.useQuery();
  const [range, setRange] = useState({
    from: addDaysISO(todayISO(), -29),
    to: todayISO(),
  });
  const list = api.cash.history.useQuery(range);
  const [detailId, setDetailId] = useState<number | null>(null);
  const canReopen = me.data?.permissions.includes("ventas.anular") ?? false;
  return (
    <Card
      title="Cajas anteriores"
      actions={
        <div className="flex items-end gap-2">
          <Field label="Desde">
            <Input
              type="date"
              value={range.from}
              max={range.to}
              onChange={(e) => setRange({ ...range, from: e.target.value })}
            />
          </Field>
          <Field label="Hasta">
            <Input
              type="date"
              value={range.to}
              min={range.from}
              onChange={(e) => setRange({ ...range, to: e.target.value })}
            />
          </Field>
        </div>
      }
    >
      {list.error && <Alert>{errorMessage(list.error)}</Alert>}
      <Table
        head={[
          "Día",
          "Abrió",
          "Apertura",
          "Esperado",
          "Contado",
          "Resultado",
          "Cerró",
          "",
        ]}
        empty={!list.isLoading && list.data?.length === 0}
      >
        {list.data?.map((s) => (
          <tr key={s.id}>
            <td>{formatDay(s.businessDay)}</td>
            <td>{s.openedBy.staff?.name ?? s.openedBy.username}</td>
            <td className="text-right tabular-nums">
              {money(s.openingNio)}
              {dec(s.openingUsd).gt(0) && (
                <span className="block text-xs text-neutral-500">
                  {money(s.openingUsd, "USD")}
                </span>
              )}
            </td>
            <td className="text-right tabular-nums">
              {s.expectedNio ? money(s.expectedNio) : "—"}
              {s.expectedUsd && dec(s.expectedUsd).gt(0) && (
                <span className="block text-xs text-neutral-500">
                  {money(s.expectedUsd, "USD")}
                </span>
              )}
            </td>
            <td className="text-right tabular-nums">
              {s.countedNio ? money(s.countedNio) : "—"}
              {s.countedUsd && dec(s.countedUsd).gt(0) && (
                <span className="block text-xs text-neutral-500">
                  {money(s.countedUsd, "USD")}
                </span>
              )}
            </td>
            <td>
              {s.closedAt ? (
                <div className="flex flex-wrap gap-1">
                  <Difference value={s.diffNio?.toString()} />
                  {s.diffUsd && !dec(s.diffUsd).isZero() && (
                    <Difference value={s.diffUsd.toString()} currency="USD" />
                  )}
                </div>
              ) : (
                <Badge tone="blue">Abierta</Badge>
              )}
            </td>
            <td className="text-neutral-400">
              {s.closedBy
                ? `${s.closedBy.staff?.name ?? s.closedBy.username} · ${formatDateTime(s.closedAt)}`
                : "—"}
            </td>
            <td className="text-right">
              <Button variant="ghost" onClick={() => setDetailId(s.id)}>
                Ver
              </Button>
            </td>
          </tr>
        ))}
      </Table>
      <Dialog
        open={detailId !== null}
        onClose={() => setDetailId(null)}
        title="Detalle de la caja"
        size="lg"
      >
        {detailId !== null && (
          <Detail
            id={detailId}
            canReopen={canReopen}
            onDone={() => setDetailId(null)}
          />
        )}
      </Dialog>
    </Card>
  );
}

function Detail({
  id,
  canReopen,
  onDone,
}: {
  id: number;
  canReopen: boolean;
  onDone: () => void;
}) {
  const utils = api.useUtils();
  const q = api.cash.detail.useQuery({ cashSessionId: id });
  const reopen = api.cash.reopen.useMutation({
    onSuccess: () => {
      void utils.cash.invalidate();
      onDone();
    },
  });
  if (q.error) return <Alert>{errorMessage(q.error)}</Alert>;
  if (!q.data) return <p className="text-sm text-neutral-500">Cargando…</p>;
  const { session: s, summary, changedAfterClose, expectedNow } = q.data;
  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-400">
        Caja del {formatDay(s.businessDay)} · abierta{" "}
        {formatDateTime(s.openedAt)} por{" "}
        {s.openedBy.staff?.name ?? s.openedBy.username}
        {s.closedAt && (
          <>
            {" "}
            · cerrada {formatDateTime(s.closedAt)} por{" "}
            {s.closedBy?.staff?.name ?? s.closedBy?.username}
          </>
        )}
      </p>
      <SummaryTable
        data={summary}
        opening={{ nio: s.openingNio, usd: s.openingUsd }}
      />
      {s.closedAt ? (
        <div className="grid gap-2 text-sm sm:grid-cols-3">
          <p>
            Esperado al cerrar:{" "}
            <b className="tabular-nums">{money(s.expectedNio)}</b>
            {dec(s.expectedUsd).gt(0) && <> · {money(s.expectedUsd, "USD")}</>}
          </p>
          <p>
            Contado: <b className="tabular-nums">{money(s.countedNio)}</b>
            {dec(s.countedUsd).gt(0) && <> · {money(s.countedUsd, "USD")}</>}
          </p>
          <div className="flex flex-wrap gap-1">
            <Difference
              value={dec(s.countedNio).minus(dec(s.expectedNio)).toString()}
            />
            {!dec(s.countedUsd).minus(dec(s.expectedUsd)).isZero() && (
              <Difference
                value={dec(s.countedUsd).minus(dec(s.expectedUsd)).toString()}
                currency="USD"
              />
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm">
          Debería haber ahora: <b>{money(expectedNow.nio)}</b> ·{" "}
          {money(expectedNow.usd, "USD")}
        </p>
      )}
      {s.closingNotes && (
        <p className="text-sm text-neutral-400">
          Nota del cierre: {s.closingNotes}
        </p>
      )}
      {s.openingNotes && (
        <p className="text-sm text-neutral-400">
          Nota de apertura: {s.openingNotes}
        </p>
      )}
      {changedAfterClose && (
        <Alert>
          Después del cierre se registró dinero de este día: hoy lo esperado
          sería {money(expectedNow.nio)}
          {dec(expectedNow.usd).gt(0) && (
            <> y {money(expectedNow.usd, "USD")}</>
          )}
          . Revise los cobros y retiros registrados tarde.
        </Alert>
      )}
      {canReopen && s.closedAt && s.day === todayISO() && (
        <div>
          <Button
            variant="secondary"
            disabled={reopen.isPending}
            onClick={async () => {
              const ok = await confirmDialog(
                "¿Reabrir la caja de hoy? Se borra el conteo y habrá que cerrarla otra vez.",
                {
                  title: "Reabrir caja",
                  confirmLabel: "Sí, reabrir",
                  danger: true,
                },
              );
              if (ok) reopen.mutate({ cashSessionId: s.id });
            }}
          >
            Reabrir caja (dueño)
          </Button>
          <Alert>{reopen.error && errorMessage(reopen.error)}</Alert>
        </div>
      )}
    </div>
  );
}

/** Cancelar una apertura hecha por error: solo si todavía no se movió dinero hoy. */
function CancelOpening({
  id,
  summary,
}: {
  id: number;
  summary: Current["summary"];
}) {
  const utils = api.useUtils();
  const cancel = api.cash.cancelOpening.useMutation({
    onSuccess: () => {
      void utils.cash.invalidate();
    },
  });
  const moved =
    summary.cashInNio.count +
      summary.cashInUsd.count +
      summary.outflows.reduce((a, o) => a + o.count, 0) +
      summary.otherMethods.reduce((a, m) => a + m.count, 0) >
    0;
  return (
    <div className="mt-4 border-t border-neutral-800 pt-3">
      {moved ? (
        <p className="text-xs text-neutral-500">
          Ya hay cobros o salidas de dinero hoy: la apertura no se puede
          cancelar. Si el monto de apertura estaba mal, explíquelo en la nota al
          cerrar.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            disabled={cancel.isPending}
            onClick={async () => {
              const ok = await confirmDialog(
                "¿Cancelar la apertura de hoy? Se borra como si no se hubiera abierto y puede abrirla otra vez con el monto correcto.",
                {
                  title: "Cancelar apertura",
                  confirmLabel: "Sí, cancelar apertura",
                  cancelLabel: "No",
                  danger: true,
                },
              );
              if (ok) cancel.mutate({ cashSessionId: id });
            }}
          >
            Cancelar apertura
          </Button>
          <span className="text-xs text-neutral-500">
            Solo mientras no se haya cobrado ni sacado dinero.
          </span>
        </div>
      )}
      <div className="mt-2">
        <Alert>{cancel.error && errorMessage(cancel.error)}</Alert>
      </div>
    </div>
  );
}
