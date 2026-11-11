"use client";

import { useState } from "react";

import { Alert, Button, Card, Input, PageTitle, SearchField } from "~/app/_components/ui";
import { errorMessage } from "~/lib/errors";
import { api } from "~/trpc/react";

/**
 * Motorcycle brands and models (DEC-044): at reception they are CHOSEN from
 * here, so "Bajaj", "bajaj " and "Bajah" can't become three brands. Check the
 * list before adding: a misspelled name becomes a different brand.
 */
export default function MotorcyclesPage() {
  const utils = api.useUtils();
  const brands = api.admin.catalog.useQuery({ kind: "motorcycleBrand" });
  const models = api.admin.motorcycleModels.useQuery();
  const [text, setText] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [newModel, setNewModel] = useState<Record<number, string>>({});
  const refresh = () => {
    void utils.admin.catalog.invalidate();
    void utils.admin.motorcycleModels.invalidate();
  };
  const createBrand = api.admin.createCatalogItem.useMutation({ onSuccess: () => { setNewBrand(""); refresh(); } });
  const saveModel = api.admin.saveMotorcycleModel.useMutation({ onSuccess: (m) => { setNewModel((x) => ({ ...x, [m.motorcycleBrandId]: "" })); refresh(); } });
  const q = text.trim().toLowerCase();
  const err = createBrand.error ?? saveModel.error;

  return (
    <>
      <PageTitle title="Marcas y modelos de moto" subtitle="Lo que se elige al recibir una moto en el taller" />
      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <SearchField className="min-w-72 flex-1" label="Buscar marca o modelo" placeholder="Buscar marca o modelo…" value={text} onValue={setText} />
          <div className="flex gap-2">
            <Input className="h-11 w-56" placeholder="Marca nueva" value={newBrand} onChange={(e) => setNewBrand(e.target.value)} />
            <Button className="h-11" disabled={!newBrand.trim() || createBrand.isPending} onClick={() => createBrand.mutate({ kind: "motorcycleBrand", name: newBrand })}>
              + Agregar marca
            </Button>
          </div>
        </div>
        {err && <Alert>{errorMessage(err)}</Alert>}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {brands.data
            ?.filter((b) => !q || b.name.toLowerCase().includes(q) || models.data?.some((m) => m.motorcycleBrandId === b.id && m.name.toLowerCase().includes(q)))
            .map((b) => {
              const own = models.data?.filter((m) => m.motorcycleBrandId === b.id) ?? [];
              return (
                <section key={b.id} className="rounded-lg border border-neutral-800 p-3">
                  <h3 className="font-display text-lg font-semibold">
                    {b.name} <span className="text-sm font-normal text-neutral-500">· {own.length} modelo{own.length === 1 ? "" : "s"}</span>
                  </h3>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {own.map((m) => (
                      <li key={m.id} className="rounded bg-neutral-800 px-2 py-1 text-sm">
                        {m.name}
                      </li>
                    ))}
                    {own.length === 0 && <li className="text-sm text-neutral-500">Sin modelos</li>}
                  </ul>
                  <div className="mt-3 flex gap-2">
                    <Input
                      placeholder="Modelo nuevo"
                      value={newModel[b.id] ?? ""}
                      onChange={(e) => setNewModel({ ...newModel, [b.id]: e.target.value })}
                    />
                    <Button
                      variant="secondary"
                      disabled={!newModel[b.id]?.trim() || saveModel.isPending}
                      onClick={() => saveModel.mutate({ motorcycleBrandId: b.id, name: newModel[b.id]! })}
                    >
                      Agregar
                    </Button>
                  </div>
                </section>
              );
            })}
        </div>
      </Card>
    </>
  );
}
