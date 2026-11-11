"use client";

import { useState } from "react";

import { Alert, Button, Card, Input, PageTitle, Select } from "~/app/_components/ui";
import { errorMessage } from "~/lib/errors";
import { api } from "~/trpc/react";

/** Small catalogs that fill the selects. Nothing is deleted: rows are deactivated (DEC-027). */
const CATALOGS = [
  { kind: "productCategory", label: "Categorías de producto" },
  { kind: "productBrand", label: "Marcas de producto" },
  { kind: "paymentMethod", label: "Métodos de pago" },
  { kind: "returnReason", label: "Motivos de devolución" },
  { kind: "cashWithdrawalReason", label: "Motivos de retiro de caja" },
] as const;
type Kind = (typeof CATALOGS)[number]["kind"];
const WITH_ACTIVE = new Set<Kind>(["paymentMethod", "returnReason", "cashWithdrawalReason"]);

export default function CatalogsPage() {
  return (
    <>
      <PageTitle title="Otros catálogos" subtitle="Lo que aparece en las listas de las demás pantallas" />
      <Catalogs />
    </>
  );
}

function Catalogs() {
  const [kind, setKind] = useState<Kind>("productCategory");
  const [name, setName] = useState("");
  const utils = api.useUtils();
  const list = api.admin.catalog.useQuery({ kind });
  const refresh = () => void utils.admin.catalog.invalidate();
  const create = api.admin.createCatalogItem.useMutation({ onSuccess: () => { setName(""); refresh(); } });
  const toggle = api.admin.setCatalogItemActive.useMutation({ onSuccess: refresh });
  return (
    <Card
      title={
        <Select value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
          {CATALOGS.map((c) => (
            <option key={c.kind} value={c.kind}>
              {c.label}
            </option>
          ))}
        </Select>
      }
    >
      <div className="mb-3 flex max-w-md gap-2">
        <Input placeholder="Nuevo nombre" value={name} onChange={(e) => setName(e.target.value)} />
        <Button disabled={!name || create.isPending} onClick={() => create.mutate({ kind, name })}>
          Agregar
        </Button>
      </div>
      <Alert>{(create.error ?? toggle.error) && errorMessage(create.error ?? toggle.error)}</Alert>
      <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {list.data?.map((r) => (
          <li key={r.id} className="flex items-center justify-between rounded-lg border border-neutral-800 px-3 py-1.5">
            <span className={r.active ? "" : "text-neutral-500 line-through"}>{r.name}</span>
            {WITH_ACTIVE.has(kind) && (
              <button
                className="text-xs text-neutral-400 hover:text-neutral-100"
                onClick={() =>
                  toggle.mutate({ kind: kind as "paymentMethod" | "returnReason" | "cashWithdrawalReason", id: r.id, active: !r.active })
                }
              >
                {r.active ? "Desactivar" : "Activar"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

