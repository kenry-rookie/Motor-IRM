"use client";

import { useState } from "react";

import { Alert, Button, Field, Input } from "~/app/_components/ui";
import { errorMessage, fieldErrors } from "~/lib/errors";
import { dec, money, todayISO } from "~/lib/format";
import { api } from "~/trpc/react";

type Trip = {
  id: number;
  tripDate: Date;
  destination: string;
  traveler: string | null;
  cashTaken: unknown;
  otherFunds: unknown;
  notes: string | null;
};

/**
 * Start (or edit) a purchase trip (DEC-059). The money taken from the drawer
 * leaves the cash now and shows in the arqueo as «Dinero llevado a viajes de compra».
 */
export function TripForm({ trip, onDone }: { trip?: Trip; onDone: (id: number) => void }) {
  const utils = api.useUtils();
  const [f, setF] = useState({
    tripDate: trip ? new Date(trip.tripDate).toISOString().slice(0, 10) : todayISO(),
    destination: trip?.destination ?? "Managua",
    traveler: trip?.traveler ?? "",
    cashTaken: trip ? dec(trip.cashTaken as string).toFixed(2) : "",
    otherFunds: trip && dec(trip.otherFunds as string).gt(0) ? dec(trip.otherFunds as string).toFixed(2) : "",
    notes: trip?.notes ?? "",
  });
  const done = (t: { id: number }) => {
    void utils.trips.invalidate();
    void utils.cash.invalidate();
    onDone(t.id);
  };
  const create = api.trips.create.useMutation({ onSuccess: done });
  const update = api.trips.update.useMutation({ onSuccess: done });
  const err = create.error ?? update.error;
  const errs = fieldErrors(err);
  const pending = create.isPending || update.isPending;
  const data = {
    destination: f.destination,
    traveler: f.traveler || undefined,
    cashTaken: f.cashTaken || "0",
    otherFunds: f.otherFunds || "0",
    notes: f.notes || undefined,
  };
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {!trip && (
          <Field label="Fecha del viaje">
            <Input type="date" value={f.tripDate} max={todayISO()} onChange={(e) => setF({ ...f, tripDate: e.target.value })} />
          </Field>
        )}
        <Field label="A dónde" error={errs.destination}>
          <Input value={f.destination} maxLength={80} onChange={(e) => setF({ ...f, destination: e.target.value })} />
        </Field>
        <Field label="Quién viaja (opcional)">
          <Input value={f.traveler} maxLength={100} onChange={(e) => setF({ ...f, traveler: e.target.value })} />
        </Field>
        <Field label="Dinero que se lleva DE LA CAJA (C$)" hint="Sale de la gaveta ahora. 0 si no se saca de la caja.">
          <Input inputMode="decimal" autoFocus={!trip} value={f.cashTaken} onChange={(e) => setF({ ...f, cashTaken: e.target.value })} />
        </Field>
        <Field label="Dinero de otra parte (C$, opcional)" hint="Del dueño o del banco: no toca la caja">
          <Input inputMode="decimal" value={f.otherFunds} onChange={(e) => setF({ ...f, otherFunds: e.target.value })} />
        </Field>
        <Field label="Nota (opcional)">
          <Input value={f.notes} maxLength={200} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
      </div>
      {dec(f.cashTaken).gt(0) && (
        <Alert kind="info">Se sacan {money(f.cashTaken)} de la caja (necesita la caja de hoy abierta). Al volver, el vuelto se devuelve a la caja al cerrar el viaje.</Alert>
      )}
      <Alert>{err && errorMessage(err)}</Alert>
      <Button
        className="w-full"
        disabled={pending || !f.destination.trim()}
        onClick={() => (trip ? update.mutate({ id: trip.id, ...data }) : create.mutate({ ...data, tripDate: f.tripDate }))}
      >
        {pending ? "Guardando…" : trip ? "Guardar cambios" : "Empezar el viaje"}
      </Button>
    </div>
  );
}
