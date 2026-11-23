"use client";

import { useState } from "react";

import { CatalogTable } from "~/app/(app)/admin/catalog-table";
import { Alert, Button, Card, Input, PageTitle, Select } from "~/app/_components/ui";
import { errorMessage } from "~/lib/errors";
import { api } from "~/trpc/react";

/**
 * Small catalogs that fill the selects (DEC-061): add, rename, deactivate,
 * delete what was never used, merge a wrong one into the right one.
 */
const CATALOGS = [
  { kind: "productCategory", label: "Categorías de producto", uses: "Productos" },
  { kind: "productBrand", label: "Marcas de producto", uses: "Productos" },
  { kind: "paymentMethod", label: "Métodos de pago", uses: "Cobros" },
  { kind: "returnReason", label: "Motivos de devolución", uses: "Devoluciones" },
  { kind: "cashWithdrawalReason", label: "Motivos de retiro de caja", uses: "Retiros" },
  { kind: "tripExpenseType", label: "Tipos de gasto de viaje", uses: "Gastos" },
] as const;
type Kind = (typeof CATALOGS)[number]["kind"];

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
  const refresh = () => {
    void utils.admin.catalog.invalidate();
    void utils.trips.expenseTypes.invalidate();
  };
  const create = api.admin.createCatalogItem.useMutation({
    onSuccess: () => {
      setName("");
      refresh();
    },
  });
  const rename = api.admin.renameCatalogItem.useMutation({ onSuccess: refresh });
  const toggle = api.admin.setCatalogItemActive.useMutation({ onSuccess: refresh });
  const remove = api.admin.deleteCatalogItem.useMutation({ onSuccess: refresh });
  const merge = api.admin.mergeCatalogItem.useMutation({
    onSuccess: () => {
      refresh();
      void utils.search.invalidate();
      void utils.inventory.invalidate();
    },
  });
  const meta = CATALOGS.find((c) => c.kind === kind)!;
  const reset = () => [create, rename, toggle, remove, merge].forEach((m) => m.reset());
  return (
    <Card
      title={
        <Select
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as Kind);
            reset();
          }}
        >
          {CATALOGS.map((c) => (
            <option key={c.kind} value={c.kind}>
              {c.label}
            </option>
          ))}
        </Select>
      }
    >
      <form
        className="mb-4 flex max-w-md gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) create.mutate({ kind, name });
        }}
      >
        <Input placeholder="Nuevo nombre" value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" disabled={!name.trim() || create.isPending}>
          Agregar
        </Button>
      </form>
      {create.error && <Alert>{errorMessage(create.error)}</Alert>}
      <CatalogTable
        rows={list.data ?? []}
        loading={list.isLoading}
        usesLabel={meta.uses}
        error={rename.error ?? toggle.error ?? remove.error ?? merge.error}
        pending={rename.isPending || toggle.isPending || remove.isPending || merge.isPending}
        onRename={(id, n) => rename.mutate({ kind, id, name: n })}
        onToggle={(id, active) => toggle.mutate({ kind, id, active })}
        onDelete={(id) => remove.mutate({ kind, id })}
        onMerge={(fromId, intoId) => merge.mutate({ kind, fromId, intoId })}
      />
    </Card>
  );
}
