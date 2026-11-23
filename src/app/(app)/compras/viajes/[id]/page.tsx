"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { PurchaseDetailDialog } from "~/app/(app)/compras/purchase-detail";
import { TripForm } from "~/app/(app)/compras/viajes/trip-form";
import { confirmDialog } from "~/app/_components/confirm";
import { Alert, BackBar, Badge, Button, Card, cx, Dialog, Field, Input, PageTitle, Select, Stat, Table } from "~/app/_components/ui";
import { docNo } from "~/lib/business";
import { errorMessage } from "~/lib/errors";
import { dec, formatDateTime, formatDay, money } from "~/lib/format";
import { api, type RouterOutputs } from "~/trpc/react";

type Trip = RouterOutputs["trips"]["get"];
const who = (u: { username: string; staff: { name: string } | null } | null | undefined) => u?.staff?.name ?? u?.username ?? "—";

/**
 * Viaje de compras (DEC-059): everything of one trip on one screen.
 *  1. Facturas: each supplier invoice is registered like a normal stock entry
 *     (it goes into the inventory and the kardex says which trip).
 *  2. Gastos del viaje: fare, fuel, food, freight… and on what.
 *  3. Cerrar: how much money came back to the drawer; the difference shows.
 */
export default function TripPage() {
  const { id } = useParams<{ id: string }>();
  const tripId = Number(id);
  const me = api.auth.me.useQuery();
  const trip = api.trips.get.useQuery({ id: tripId });
  const [editing, setEditing] = useState(false);
  const [closing, setClosing] = useState(false);
  const [detail, setDetail] = useState<number | null>(null);
  const [paying, setPaying] = useState(false);
  const utils = api.useUtils();
  const reopen = api.trips.reopen.useMutation({
    onSuccess: () => {
      void utils.trips.invalidate();
      void utils.cash.invalidate();
    },
  });
  if (trip.error) return <Alert>{errorMessage(trip.error)}</Alert>;
  const t = trip.data;
  if (!t) return <p className="text-neutral-400">Cargando…</p>;
  const perms = me.data?.permissions ?? [];
  const canManage = perms.includes("compras.gestionar");
  const open = t.status === "ABIERTO";
  const s = t.summary;
  const missing = dec(s.expectedBack).lt(0);

  return (
    <>
      <BackBar
        crumbs={[{ label: "Compras", href: "/compras" }, { label: "Viajes de compras", href: "/compras?ver=viajes" }, { label: docNo("viaje", t.id) }]}
        back={{ href: "/compras?ver=viajes", label: "Volver a viajes" }}
      />
      <PageTitle
        title={`Viaje de compras ${docNo("viaje", t.id)} · ${t.destination}`}
        subtitle={`${formatDay(t.tripDate)}${t.traveler ? ` · viajó ${t.traveler}` : ""} · lo registró ${who(t.createdBy)}${t.notes ? ` · ${t.notes}` : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={open ? "amber" : "green"}>{open ? "En curso" : `Cerrado ${formatDateTime(t.closedAt)}`}</Badge>
            {open && canManage && (
              <>
                <Button variant="secondary" onClick={() => setEditing(true)}>
                  Editar datos
                </Button>
                <Button onClick={() => setClosing(true)}>Cerrar viaje</Button>
              </>
            )}
            {!open && perms.includes("caja.corregir") && (
              <Button
                variant="secondary"
                disabled={reopen.isPending}
                onClick={async () => {
                  if (await confirmDialog("¿Reabrir el viaje? El vuelto vuelve a salir de la caja de hoy hasta que lo cierre otra vez.", { title: "Reabrir viaje", confirmLabel: "Sí, reabrir" }))
                    reopen.mutate({ id: t.id });
                }}
              >
                Reabrir viaje
              </Button>
            )}
          </div>
        }
      />
      {reopen.error && (
        <div className="mb-3">
          <Alert>{errorMessage(reopen.error)}</Alert>
        </div>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat
          label="Se llevó de la caja"
          value={money(s.cashTaken)}
          detail={dec(s.otherFunds).gt(0) ? `+ ${money(s.otherFunds)} de otra parte` : t.takenAt ? `salió ${formatDateTime(t.takenAt)}` : "No salió dinero de la caja"}
        />
        <Stat label="Pagado en compras" value={money(s.paidFromTrip)} detail={`Contado con el dinero del viaje · ${s.invoices} factura(s)`} />
        <Stat label="Gastos del viaje" value={money(s.expenses)} detail={dec(s.purchasesTotal).gt(0) ? `${dec(s.expenses).div(dec(s.purchasesTotal)).times(100).toFixed(1)} % de lo comprado` : undefined} />
        <Stat label={open ? "Debe regresar a la caja" : "Debía regresar"} value={money(dec(s.expectedBack).lt(0) ? 0 : s.expectedBack)} detail={missing ? `Se gastó ${money(dec(s.expectedBack).abs())} más de lo que se llevó` : undefined} />
        <Stat
          label="Regresó a la caja"
          value={s.cashReturned != null ? money(s.cashReturned) : "—"}
          detail={
            s.difference != null
              ? dec(s.difference).isZero()
                ? "Cuadra"
                : `${dec(s.difference).lt(0) ? "Faltaron" : "Sobraron"} ${money(dec(s.difference).abs())}${t.closingNotes ? ` · ${t.closingNotes}` : ""}`
              : "Se registra al cerrar el viaje"
          }
        />
      </div>
      {missing && open && (
        <div className="mb-4">
          <Alert kind="info">Lo pagado y gastado es más de lo que se llevó. Si se usó dinero de otra parte, anótelo en «Editar datos» (dinero de otra parte).</Alert>
        </div>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[1fr_420px]">
        <Card
          title={`Facturas del viaje (${t.invoices.length})`}
          actions={
            open &&
            canManage && (
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setPaying(true)}>
                  Pagar una deuda con este dinero
                </Button>
                <Link
                  href={`/compras/nueva?viaje=${t.id}`}
                  className="inline-flex min-h-10 items-center rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
                >
                  + Agregar factura
                </Link>
              </div>
            )
          }
        >
          <Table head={["N.º", "Proveedor", "Factura", "Tipo", "Productos", "Total", "Saldo", ""]} empty={t.invoices.length === 0}>
            {t.invoices.map((i) => (
              <tr key={i.id} className="cursor-pointer" onClick={() => setDetail(i.id)}>
                <td className="whitespace-nowrap text-brand-600">{docNo("compra", i.id)}</td>
                <td>{i.supplier.name}</td>
                <td>{i.invoiceNumber}</td>
                <td>{i.paymentTerms === "CREDITO" ? <Badge tone="amber">Crédito</Badge> : "Contado"}</td>
                <td className="tabular-nums">
                  {i.lines} · {i.units} u.
                </td>
                <td className="tabular-nums">{money(i.total)}</td>
                <td className="tabular-nums">{dec(i.balance).gt(0) ? money(i.balance) : "—"}</td>
                <td className="text-right">
                  <Button variant="ghost" onClick={() => setDetail(i.id)}>
                    Ver detalle
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
          {t.invoices.length === 0 && open && (
            <p className="mt-2 text-sm text-neutral-500">Agregue cada factura del viaje con «+ Agregar factura»: la mercadería entra al inventario al registrarla.</p>
          )}
          {t.payments.some((p) => !t.invoices.some((i) => i.id === p.purchaseInvoice?.id)) && (
            <div className="mt-4">
              <p className="mb-1 text-sm font-medium">Deudas anteriores pagadas con el dinero del viaje</p>
              <Table head={["N.º", "Proveedor", "Factura", "Monto"]}>
                {t.payments
                  .filter((p) => !t.invoices.some((i) => i.id === p.purchaseInvoice?.id))
                  .map((p) => (
                    <tr key={p.id}>
                      <td>{docNo("pagoProveedor", p.id)}</td>
                      <td>{p.supplier.name}</td>
                      <td>{p.purchaseInvoice?.invoiceNumber ?? "Saldo anterior"}</td>
                      <td className="tabular-nums">{money(p.amount, p.currency === "USD" ? "USD" : "NIO")}</td>
                    </tr>
                  ))}
              </Table>
            </div>
          )}
        </Card>
        <Expenses trip={t} canManage={canManage && open} />
      </div>

      <Dialog open={editing} onClose={() => setEditing(false)} title={`Editar el viaje ${docNo("viaje", t.id)}`}>
        <TripForm trip={t} onDone={() => setEditing(false)} />
      </Dialog>
      <Dialog open={closing} onClose={() => setClosing(false)} title={`Cerrar el viaje ${docNo("viaje", t.id)}`}>
        {closing && <CloseTrip trip={t} onDone={() => setClosing(false)} />}
      </Dialog>
      <Dialog open={paying} onClose={() => setPaying(false)} title="Pagar una deuda con el dinero del viaje">
        {paying && <PayDebt tripId={t.id} onDone={() => setPaying(false)} />}
      </Dialog>
      <PurchaseDetailDialog id={detail} onClose={() => setDetail(null)} />
    </>
  );
}

/** Trip expenses: what was spent and on what (they don't touch the drawer). */
function Expenses({ trip: t, canManage }: { trip: Trip; canManage: boolean }) {
  const utils = api.useUtils();
  const types = api.trips.expenseTypes.useQuery();
  const [f, setF] = useState({ typeId: 0, amount: "", description: "" });
  const refresh = () => void utils.trips.invalidate();
  const add = api.trips.addExpense.useMutation({
    onSuccess: () => {
      setF({ typeId: 0, amount: "", description: "" });
      refresh();
    },
  });
  const save = () => add.mutate({ purchaseTripId: t.id, tripExpenseTypeId: f.typeId, amount: f.amount, description: f.description || undefined });
  const remove = api.trips.removeExpense.useMutation({ onSuccess: refresh });
  const byType = new Map<string, ReturnType<typeof dec>>();
  for (const e of t.expenses) byType.set(e.type.name, (byType.get(e.type.name) ?? dec(0)).plus(dec(e.amount)));
  return (
    <Card title={`Gastos del viaje (${money(t.summary.expenses)})`}>
      <p className="mb-3 text-sm text-neutral-400">
        Combustible, comida, pasajes, fletes… lo que se gastó en el viaje <strong className="text-neutral-200">aunque no tenga factura</strong>. No entra al
        inventario ni al Kardex: solo se anota cuánto y en qué.
      </p>
      {canManage && (
        <div className="mb-3 space-y-3 rounded-md border border-neutral-800 p-3">
          <div>
            <p className="mb-1.5 text-sm font-medium">1. ¿En qué se gastó?</p>
            <div className="grid grid-cols-2 gap-2">
              {types.data
                ?.filter((x) => x.active)
                .map((x) => {
                  const on = f.typeId === x.id;
                  return (
                    <button
                      key={x.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setF({ ...f, typeId: x.id })}
                      className={cx(
                        "min-h-11 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                        on ? "border-brand-600 bg-brand-600/8 font-medium text-neutral-50" : "border-neutral-700 hover:bg-neutral-800/60",
                      )}
                    >
                      {on ? "✓ " : ""}
                      {x.name}
                    </button>
                  );
                })}
            </div>
          </div>
          <Field label="2. ¿Cuánto? (C$)">
            <Input
              inputMode="decimal"
              value={f.amount}
              placeholder="Ej.: 2000"
              onChange={(e) => setF({ ...f, amount: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter" && f.typeId && f.amount && !add.isPending) save();
              }}
            />
          </Field>
          <Field label="Detalle (opcional)">
            <Input value={f.description} maxLength={200} placeholder="Ej.: gasolina ida y vuelta, almuerzo de 2 personas" onChange={(e) => setF({ ...f, description: e.target.value })} />
          </Field>
          <Button className="w-full" disabled={!f.typeId || !f.amount || add.isPending} onClick={save}>
            {!f.typeId ? "Elija en qué se gastó" : !f.amount ? "Escriba el monto" : `+ Agregar gasto de ${money(f.amount)}`}
          </Button>
          <Alert>{(add.error ?? remove.error) && errorMessage(add.error ?? remove.error)}</Alert>
        </div>
      )}
      <Table head={["En qué", "Detalle", "Monto", ""]} empty={t.expenses.length === 0}>
        {t.expenses.map((e) => (
          <tr key={e.id}>
            <td>{e.type.name}</td>
            <td className="text-neutral-400">{e.description ?? "—"}</td>
            <td className="tabular-nums">{money(e.amount)}</td>
            <td className="text-right">
              {canManage && (
                <Button
                  variant="ghost"
                  aria-label={`Quitar gasto ${e.type.name}`}
                  disabled={remove.isPending}
                  onClick={async () => {
                    if (await confirmDialog(`¿Quitar el gasto «${e.type.name}» de ${money(e.amount)}?`, { title: "Quitar gasto", confirmLabel: "Sí, quitar", danger: true }))
                      remove.mutate({ id: e.id });
                  }}
                >
                  ×
                </Button>
              )}
            </td>
          </tr>
        ))}
      </Table>
      {byType.size > 1 && (
        <ul className="mt-3 space-y-0.5 text-sm text-neutral-400">
          {[...byType.entries()].map(([name, v]) => (
            <li key={name} className="flex justify-between">
              <span>{name}</span>
              <span className="tabular-nums">{money(v)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-neutral-500">Los gastos se pagan con el dinero del viaje: no se restan otra vez en el arqueo. No cambian el costo de los productos.</p>
    </Card>
  );
}

/** Closing: the change that came back to the drawer (enters the arqueo today). */
function CloseTrip({ trip: t, onDone }: { trip: Trip; onDone: () => void }) {
  const utils = api.useUtils();
  const expected = dec(t.summary.expectedBack).lt(0) ? dec(0) : dec(t.summary.expectedBack);
  const [returned, setReturned] = useState(expected.toFixed(2));
  const [notes, setNotes] = useState("");
  const close = api.trips.close.useMutation({
    onSuccess: () => {
      void utils.trips.invalidate();
      void utils.cash.invalidate();
      onDone();
    },
  });
  const diff = dec(returned).minus(expected);
  return (
    <div className="space-y-3">
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-neutral-400">Se llevó (caja + otra parte)</dt>
          <dd className="tabular-nums">{money(dec(t.summary.cashTaken).plus(dec(t.summary.otherFunds)))}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-neutral-400">− Pagado en compras de contado</dt>
          <dd className="tabular-nums">{money(t.summary.paidFromTrip)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-neutral-400">− Gastos del viaje</dt>
          <dd className="tabular-nums">{money(t.summary.expenses)}</dd>
        </div>
        <div className="flex justify-between border-t border-neutral-700 pt-1 font-semibold">
          <dt>Debe regresar</dt>
          <dd className="tabular-nums">{money(expected)}</dd>
        </div>
      </dl>
      <Field label="¿Cuánto dinero regresó a la caja? (C$)">
        <Input inputMode="decimal" autoFocus value={returned} onChange={(e) => setReturned(e.target.value)} />
      </Field>
      {!diff.isZero() && returned !== "" && (
        <Alert>
          {diff.lt(0) ? `Faltan ${money(diff.abs())}` : `Sobran ${money(diff)}`}: escriba en la nota qué pasó (se guarda con el viaje).
        </Alert>
      )}
      <Field label={diff.isZero() ? "Nota (opcional)" : "Nota (obligatoria)"}>
        <Input value={notes} maxLength={200} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      {dec(returned).gt(0) && <Alert kind="info">El vuelto entra a la caja de hoy (necesita la caja abierta) como «Vuelto de viajes de compra».</Alert>}
      <Alert>{close.error && errorMessage(close.error)}</Alert>
      <Button
        className="w-full"
        disabled={returned === "" || close.isPending || (!diff.isZero() && !notes.trim())}
        onClick={async () => {
          if (
            await confirmDialog(`Regresan ${money(returned)} a la caja. Después de cerrar ya no se agregan facturas ni gastos al viaje.`, {
              title: "¿Cerrar el viaje?",
              confirmLabel: "Sí, cerrar",
            })
          )
            close.mutate({ id: t.id, cashReturned: returned, notes: notes.trim() || undefined });
        }}
      >
        {close.isPending ? "Cerrando…" : "Cerrar viaje"}
      </Button>
      <p className="text-xs text-neutral-500">Después de cerrar ya no se agregan facturas ni gastos. Un administrador puede reabrirlo el mismo día.</p>
    </div>
  );
}

/** While in Managua the owners often pay an old debt with the trip money. */
function PayDebt({ tripId, onDone }: { tripId: number; onDone: () => void }) {
  const suppliers = api.purchasing.suppliersOverview.useQuery();
  const [supplierId, setSupplierId] = useState(0);
  const account = api.purchasing.supplierAccount.useQuery({ supplierId }, { enabled: supplierId > 0 });
  const [target, setTarget] = useState<{ purchaseInvoiceId?: number; balance: string } | null>(null);
  const utils = api.useUtils();
  const debts = [
    ...(account.data && dec(account.data.openingBalance).gt(0) ? [{ key: "op", label: "Saldo anterior al sistema", purchaseInvoiceId: undefined, balance: account.data.openingBalance.toString() }] : []),
    ...(account.data?.purchases
      .filter((p) => dec(p.balance).gt(0))
      .map((p) => ({ key: String(p.id), label: `Factura ${p.invoiceNumber} · ${formatDay(p.purchaseDate)}`, purchaseInvoiceId: p.id, balance: p.balance.toString() })) ?? []),
  ];
  if (target)
    return (
      <PayWithTrip
        supplierId={supplierId}
        tripId={tripId}
        purchaseInvoiceId={target.purchaseInvoiceId}
        balance={target.balance}
        onDone={() => {
          void utils.trips.invalidate();
          onDone();
        }}
      />
    );
  return (
    <div className="space-y-3">
      <Field label="Proveedor">
        <Select value={supplierId} onChange={(e) => setSupplierId(Number(e.target.value))}>
          <option value={0}>Elegir…</option>
          {suppliers.data
            ?.filter((x) => dec(x.balance).gt(0))
            .map((x) => (
              <option key={x.id} value={x.id}>
                {x.name} · se le debe {money(x.balance)}
              </option>
            ))}
        </Select>
      </Field>
      {supplierId > 0 && (
        <ul className="space-y-1">
          {debts.length === 0 && <li className="text-sm text-neutral-500">No se le debe nada.</li>}
          {debts.map((d) => (
            <li key={d.key}>
              <button
                type="button"
                onClick={() => setTarget({ purchaseInvoiceId: d.purchaseInvoiceId, balance: d.balance })}
                className="flex w-full justify-between rounded-md border border-neutral-700 px-3 py-2 text-left text-sm hover:bg-neutral-800"
              >
                <span>{d.label}</span>
                <span className="tabular-nums">{money(d.balance)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The supplier payment form, with the money fixed to this trip. */
function PayWithTrip(props: { supplierId: number; tripId: number; purchaseInvoiceId?: number; balance: string; onDone: () => void }) {
  const utils = api.useUtils();
  const [amount, setAmount] = useState(props.balance);
  const pay = api.purchasing.registerPayment.useMutation({
    onSuccess: () => {
      void utils.purchasing.invalidate();
      props.onDone();
    },
  });
  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-400">
        Se debe {money(props.balance)}. Se paga con el dinero del viaje {docNo("viaje", props.tripId)}.
      </p>
      <Field label="Monto (C$)">
        <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <Alert>{pay.error && errorMessage(pay.error)}</Alert>
      <Button
        className="w-full"
        disabled={!amount || pay.isPending}
        onClick={async () => {
          if (await confirmDialog(`Pagar ${money(amount)} al proveedor con el dinero del viaje.`, { title: "¿Registrar el pago?", confirmLabel: "Sí, registrar" }))
            pay.mutate({ supplierId: props.supplierId, purchaseInvoiceId: props.purchaseInvoiceId, amount, source: "VIAJE", purchaseTripId: props.tripId });
        }}
      >
        Registrar pago
      </Button>
    </div>
  );
}
