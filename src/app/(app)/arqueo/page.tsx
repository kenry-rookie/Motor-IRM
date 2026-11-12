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
  /** Administrador: reabre la caja de hoy, corrige cierres y elimina la de hoy. */
  const canFix = me.data?.permissions.includes("caja.corregir") ?? false;

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
        ) : status.data?.todayClosed && status.data.todaySessionId ? (
          <TodayClosed id={status.data.todaySessionId} canFix={canFix} />
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

/** Se muestran dólares si la caja tuvo dólares en algún momento (apertura, esperado o contado). */
function hasUsd(...values: unknown[]) {
  return values.some((v) => dec(v as string).gt(0));
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
  /** Si la gaveta debería tener dólares, hay que contarlos (vacío no es 0). */
  const needsUsd = dec(data.expected.usd).gt(0);
  const counted = f.nio !== "" && (!needsUsd || f.usd !== "");
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
      {canOperate && !isOld && (
        <CancelOpening id={s.id} blockedReason={data.cancelBlockedReason} />
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
              <Field
                label="Dólares contados (US$)"
                hint={
                  needsUsd
                    ? `Debería haber ${money(data.expected.usd, "USD")}: cuéntelos`
                    : "Vacío = 0"
                }
              >
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
                  {hasUsd(data.expected.usd, f.usd) ? (
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
                    `¿Cerrar la caja del ${formatDay(s.businessDay)} con ${money(f.nio)}${dec(f.usd).gt(0) ? ` y ${money(f.usd, "USD")}` : ""} contados? Después de cerrar, solo un administrador puede reabrir la caja o corregir el conteo.`,
                    { title: "Cerrar caja", confirmLabel: "Sí, cerrar caja" },
                  );
                  if (ok)
                    close.mutate({
                      cashSessionId: s.id,
                      countedNio: f.nio,
                      countedUsd: f.usd === "" ? undefined : f.usd,
                      notes: f.notes.trim() || undefined,
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
  const canFix = me.data?.permissions.includes("caja.corregir") ?? false;
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
              {s.closedAt && hasUsd(s.expectedUsd, s.countedUsd) && (
                <span className="block text-xs text-neutral-500">
                  {money(s.expectedUsd, "USD")}
                </span>
              )}
            </td>
            <td className="text-right tabular-nums">
              {s.countedNio ? money(s.countedNio) : "—"}
              {s.closedAt && hasUsd(s.expectedUsd, s.countedUsd) && (
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
                  {s.changes > 0 && (
                    <Badge tone="blue">
                      Corregida{s.changes > 1 ? ` (${s.changes})` : ""}
                    </Badge>
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
            canFix={canFix}
            onDone={() => setDetailId(null)}
          />
        )}
      </Dialog>
    </Card>
  );
}

function Detail({
  id,
  canFix,
  onDone,
}: {
  id: number;
  canFix: boolean;
  onDone: () => void;
}) {
  const q = api.cash.detail.useQuery({ cashSessionId: id });
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
            {hasUsd(s.expectedUsd, s.countedUsd) && (
              <> · {money(s.expectedUsd, "USD")}</>
            )}
          </p>
          <p>
            Contado: <b className="tabular-nums">{money(s.countedNio)}</b>
            {hasUsd(s.expectedUsd, s.countedUsd) && (
              <> · {money(s.countedUsd, "USD")}</>
            )}
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
          . Revise los cobros y retiros registrados tarde
          {canFix && <>; con «Corregir cierre» se recalcula lo esperado</>}.
        </Alert>
      )}
      <ChangeLog changes={s.changes} />
      {canFix && s.closedAt && (
        <div className="border-t border-neutral-800 pt-3">
          <FixActions
            session={s}
            isToday={s.day === todayISO()}
            onDone={onDone}
          />
        </div>
      )}
    </div>
  );
}

type DetailData = RouterOutputs["cash"]["detail"];

const ACTION_LABEL: Record<string, string> = {
  REAPERTURA: "Reabierta",
  CORRECCION: "Cierre corregido",
  ELIMINACION: "Eliminada",
};

/** Bitácora: quién reabrió o corrigió la caja, cuándo, por qué y qué cambió. */
function ChangeLog({ changes }: { changes: DetailData["session"]["changes"] }) {
  if (changes.length === 0) return null;
  const fields: [string, string, "NIO" | "USD"][] = [
    ["openingNio", "Apertura C$", "NIO"],
    ["openingUsd", "Apertura US$", "USD"],
    ["countedNio", "Contado C$", "NIO"],
    ["countedUsd", "Contado US$", "USD"],
    ["expectedNio", "Esperado C$", "NIO"],
    ["expectedUsd", "Esperado US$", "USD"],
  ];
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Cambios hechos por administradores</p>
      <ul className="space-y-2 text-sm">
        {changes.map((c) => {
          const before = (c.before ?? {}) as Record<string, string | null>;
          const after = (c.after ?? {}) as Record<string, string | null>;
          const diffs =
            c.action === "CORRECCION"
              ? fields.filter(([k]) => before[k] !== after[k])
              : [];
          return (
            <li
              key={c.id}
              className="rounded-md border border-neutral-800 px-3 py-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={c.action === "ELIMINACION" ? "red" : "blue"}>
                  {ACTION_LABEL[c.action] ?? c.action}
                </Badge>
                <span className="text-neutral-400">
                  {formatDateTime(c.changedAt)} por{" "}
                  {c.changedBy.staff?.name ?? c.changedBy.username}
                </span>
              </div>
              <p className="mt-1">Motivo: {c.reason}</p>
              {diffs.length > 0 && (
                <p className="mt-1 text-xs text-neutral-400">
                  {diffs
                    .map(
                      ([k, label, cur]) =>
                        `${label}: ${money(before[k] ?? "0", cur)} → ${money(after[k] ?? "0", cur)}`,
                    )
                    .join(" · ")}
                </p>
              )}
              {c.action === "REAPERTURA" && before.countedNio && (
                <p className="mt-1 text-xs text-neutral-400">
                  Cierre que se deshizo: contado {money(before.countedNio)}
                  {hasUsd(before.countedUsd, before.expectedUsd) &&
                    ` y ${money(before.countedUsd ?? "0", "USD")}`}
                  , esperado {money(before.expectedNio ?? "0")}
                  {before.closingNotes ? ` · nota: ${before.closingNotes}` : ""}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Cancelar una apertura hecha por error. Dueño: siempre (la caja de hoy).
 * Encargado: en los primeros 30 minutos y si no se ha cobrado desde que abrió.
 * No se pierde nada: el arqueo se calcula con todos los movimientos del día.
 */
function CancelOpening({
  id,
  blockedReason,
}: {
  id: number;
  blockedReason: string | null;
}) {
  const utils = api.useUtils();
  const cancel = api.cash.cancelOpening.useMutation({
    onSuccess: () => {
      void utils.cash.invalidate();
    },
  });
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-neutral-800 bg-neutral-900 px-4 py-3">
      <span className="text-sm text-neutral-400">
        {blockedReason ??
          "¿Abrió la caja por error o con el monto equivocado? Puede cancelar la apertura y abrirla de nuevo."}
      </span>
      {!blockedReason && (
        <Button
          variant="danger"
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
          {cancel.isPending ? "Cancelando…" : "Cancelar apertura"}
        </Button>
      )}
      {cancel.error && (
        <div className="w-full">
          <Alert>{errorMessage(cancel.error)}</Alert>
        </div>
      )}
    </div>
  );
}

/**
 * La caja de hoy ya se cerró: muestra el resultado del arqueo y, para un
 * dueño, cómo deshacerlo. Encargado: solo lo ve.
 */
function TodayClosed({ id, canFix }: { id: number; canFix: boolean }) {
  const q = api.cash.detail.useQuery({ cashSessionId: id });
  if (q.error) return <Alert>{errorMessage(q.error)}</Alert>;
  if (!q.data) return null;
  const s = q.data.session;
  const diffNio = dec(s.countedNio).minus(dec(s.expectedNio));
  const diffUsd = dec(s.countedUsd).minus(dec(s.expectedUsd));
  const usd = hasUsd(s.openingUsd, s.expectedUsd, s.countedUsd);
  return (
    <Card
      title="Caja de hoy cerrada"
      actions={
        <div className="flex flex-wrap gap-1">
          <Difference value={diffNio.toString()} />
          {!diffUsd.isZero() && (
            <Difference value={diffUsd.toString()} currency="USD" />
          )}
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Apertura"
          value={money(s.openingNio)}
          detail={usd ? money(s.openingUsd, "USD") : undefined}
        />
        <Stat
          label="Debía haber"
          value={money(s.expectedNio)}
          detail={usd ? money(s.expectedUsd, "USD") : undefined}
        />
        <Stat
          label="Se contó"
          value={money(s.countedNio)}
          detail={usd ? money(s.countedUsd, "USD") : undefined}
        />
      </div>
      <p className="mt-3 text-sm text-neutral-400">
        Cerrada {formatDateTime(s.closedAt)} por{" "}
        {s.closedBy?.staff?.name ?? s.closedBy?.username}
        {s.closingNotes && <> · Nota: {s.closingNotes}</>}
      </p>
      <div className="mt-3">
        <ChangeLog changes={s.changes} />
      </div>
      {q.data.changedAfterClose && (
        <div className="mt-3">
          <Alert>
            Después del cierre se registró dinero de hoy: ahora debería haber{" "}
            {money(q.data.expectedNow.nio)}
            {canFix
              ? ". Reabra la caja y vuelva a contar, o corrija el cierre."
              : ". Avise a un administrador para que corrija el cierre."}
          </Alert>
        </div>
      )}
      <div className="mt-4 border-t border-neutral-800 pt-4">
        {canFix ? (
          <FixActions session={s} isToday />
        ) : (
          <p className="text-sm text-neutral-400">
            Mientras la caja esté cerrada no se puede cobrar ni sacar dinero. Si
            se cerró por error, un administrador puede reabrirla o corregir el
            conteo.
          </p>
        )}
      </div>
    </Card>
  );
}

/**
 * Lo que un ADMINISTRADOR puede hacer con una caja ya cerrada:
 *  - Corregir cierre (cualquier día): apertura, conteo y nota; lo esperado se
 *    recalcula. Queda en la bitácora con el motivo.
 *  - Reabrir (solo hoy): deshace el cierre y la caja vuelve a quedar abierta.
 *  - Eliminar (solo hoy): borra la caja, como si no se hubiera abierto; los
 *    cobros y salidas del día no se tocan y se suman a la próxima caja de hoy.
 * Todo pide un motivo (mínimo 5 letras). Los formularios van dentro de la
 * misma tarjeta (no en otra ventana) para que funcionen también desde el detalle.
 */
function FixActions({
  session: s,
  isToday,
  onDone,
}: {
  session: DetailData["session"];
  isToday: boolean;
  onDone?: () => void;
}) {
  const utils = api.useUtils();
  const [mode, setMode] = useState<null | "reopen" | "correct" | "discard">(
    null,
  );
  const [reason, setReason] = useState("");
  const [f, setF] = useState({
    openingNio: dec(s.openingNio).toFixed(2),
    openingUsd: dec(s.openingUsd).toFixed(2),
    countedNio: dec(s.countedNio).toFixed(2),
    countedUsd: dec(s.countedUsd).toFixed(2),
    notes: s.closingNotes ?? "",
  });
  const done = () => {
    setMode(null);
    setReason("");
    void utils.cash.invalidate();
    onDone?.();
  };
  const reopen = api.cash.reopen.useMutation({ onSuccess: done });
  const correct = api.cash.correct.useMutation({ onSuccess: done });
  const discard = api.cash.discardToday.useMutation({ onSuccess: done });
  const busy = reopen.isPending || correct.isPending || discard.isPending;
  const error = reopen.error ?? correct.error ?? discard.error;
  const reasonOk = reason.trim().length >= 5;
  const choose = (m: typeof mode) => {
    reopen.reset();
    correct.reset();
    discard.reset();
    setMode(mode === m ? null : m);
  };

  const reasonField = (
    <Field label="Motivo (obligatorio, queda registrado)">
      <Input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={200}
        placeholder="Ej.: se contó mal el dinero / faltó registrar un cobro"
      />
    </Field>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => choose("correct")}
        >
          Corregir cierre
        </Button>
        {isToday && (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => choose("reopen")}
          >
            Reabrir caja
          </Button>
        )}
        {isToday && (
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => choose("discard")}
          >
            Eliminar caja de hoy
          </Button>
        )}
      </div>

      {mode === null && (
        <p className="text-xs text-neutral-500">
          Corregir: se contó mal o se puso mal la apertura (cualquier día).
          {isToday &&
            " Reabrir: se cerró antes de tiempo y hay que seguir cobrando. Eliminar: fue una prueba o se abrió por error."}{" "}
          Solo administradores; todo queda registrado con el motivo.
        </p>
      )}

      {mode === "correct" && (
        <div className="space-y-3 rounded-md border border-neutral-800 p-3">
          <p className="text-sm text-neutral-400">
            Corrija lo que se puso mal. Lo esperado se vuelve a calcular con los
            movimientos registrados de ese día.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Apertura en córdobas (C$)">
              <Input
                inputMode="decimal"
                value={f.openingNio}
                onChange={(e) => setF({ ...f, openingNio: e.target.value })}
              />
            </Field>
            <Field label="Apertura en dólares (US$)">
              <Input
                inputMode="decimal"
                value={f.openingUsd}
                onChange={(e) => setF({ ...f, openingUsd: e.target.value })}
              />
            </Field>
            <Field label="Córdobas contados (C$)">
              <Input
                inputMode="decimal"
                value={f.countedNio}
                onChange={(e) => setF({ ...f, countedNio: e.target.value })}
              />
            </Field>
            <Field label="Dólares contados (US$)">
              <Input
                inputMode="decimal"
                value={f.countedUsd}
                onChange={(e) => setF({ ...f, countedUsd: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Nota del cierre (obligatoria si no cuadra)">
            <Input
              value={f.notes}
              onChange={(e) => setF({ ...f, notes: e.target.value })}
              maxLength={200}
            />
          </Field>
          {reasonField}
          <div className="flex gap-2">
            <Button
              disabled={
                busy ||
                !reasonOk ||
                [f.openingNio, f.openingUsd, f.countedNio, f.countedUsd].some(
                  (v) => v.trim() === "",
                )
              }
              onClick={async () => {
                const ok = await confirmDialog(
                  `¿Guardar la corrección de la caja del ${formatDay(s.businessDay)}? Queda registrada con su usuario y el motivo.`,
                  { title: "Corregir cierre", confirmLabel: "Sí, corregir" },
                );
                if (ok)
                  correct.mutate({
                    cashSessionId: s.id,
                    openingNio: f.openingNio,
                    openingUsd: f.openingUsd,
                    countedNio: f.countedNio,
                    countedUsd: f.countedUsd,
                    closingNotes: f.notes.trim() || undefined,
                    reason: reason.trim(),
                  });
              }}
            >
              {correct.isPending ? "Guardando…" : "Guardar corrección"}
            </Button>
            <Button variant="ghost" onClick={() => setMode(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {mode === "reopen" && (
        <div className="space-y-3 rounded-md border border-neutral-800 p-3">
          <p className="text-sm text-neutral-400">
            Se borra el conteo del cierre y la caja vuelve a quedar abierta con
            la misma apertura. Después hay que cerrarla otra vez. El cierre
            anterior queda en la bitácora.
          </p>
          {reasonField}
          <div className="flex gap-2">
            <Button
              disabled={busy || !reasonOk}
              onClick={() =>
                reopen.mutate({ cashSessionId: s.id, reason: reason.trim() })
              }
            >
              {reopen.isPending ? "Reabriendo…" : "Sí, reabrir caja"}
            </Button>
            <Button variant="ghost" onClick={() => setMode(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {mode === "discard" && (
        <div className="space-y-3 rounded-md border border-neutral-800 p-3">
          <p className="text-sm text-neutral-400">
            Se borran la apertura y el cierre, como si no se hubiera abierto.
            Los cobros y retiros de hoy NO se borran: se suman cuando vuelva a
            abrir la caja.
          </p>
          {reasonField}
          <div className="flex gap-2">
            <Button
              variant="danger"
              disabled={busy || !reasonOk}
              onClick={async () => {
                const ok = await confirmDialog(
                  "¿Eliminar la caja de hoy? Esta acción no se puede deshacer.",
                  {
                    title: "Eliminar caja de hoy",
                    confirmLabel: "Sí, eliminar",
                    cancelLabel: "No",
                    danger: true,
                  },
                );
                if (ok)
                  discard.mutate({
                    cashSessionId: s.id,
                    reason: reason.trim(),
                  });
              }}
            >
              {discard.isPending ? "Eliminando…" : "Sí, eliminar"}
            </Button>
            <Button variant="ghost" onClick={() => setMode(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {error && <Alert>{errorMessage(error)}</Alert>}
    </div>
  );
}
