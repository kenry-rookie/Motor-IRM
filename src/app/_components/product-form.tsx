"use client";

import { useState } from "react";

import { Alert, Button, Field, Input, Select } from "~/app/_components/ui";
import { errorMessage, fieldErrors } from "~/lib/errors";
import { api } from "~/trpc/react";

/**
 * New product. Used in Inventario and, without initial stock, inside a purchase
 * ("+ Producto nuevo" without leaving the purchase): there the stock comes from
 * the purchase itself.
 */
export function ProductForm({
  onDone,
  withInitialStock = true,
  initialName = "",
}: {
  onDone: (product: { id: number; name: string }) => void;
  withInitialStock?: boolean;
  initialName?: string;
}) {
  const utils = api.useUtils();
  const categories = api.admin.catalog.useQuery({ kind: "productCategory" });
  const brands = api.admin.catalog.useQuery({ kind: "productBrand" });
  const [f, setF] = useState({
    name: initialName,
    barcode: "",
    productCategoryId: 0,
    productBrandId: 0,
    qualityTier: "MEDIA" as "ALTA" | "MEDIA" | "BAJA",
    listPrice: "",
    qty: "",
    unitCost: "",
  });
  const create = api.inventory.create.useMutation({
    onSuccess: (p) => {
      void utils.inventory.invalidate();
      void utils.search.invalidate();
      onDone(p);
    },
  });
  const errs = fieldErrors(create.error);
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate({
          name: f.name,
          barcode: f.barcode || undefined,
          productCategoryId: f.productCategoryId,
          productBrandId: f.productBrandId,
          qualityTier: f.qualityTier,
          listPrice: f.listPrice,
          initialStock: withInitialStock && f.qty ? { quantity: Number(f.qty), unitCost: f.unitCost || "0" } : undefined,
        });
      }}
    >
      <Field label="Nombre" error={errs.name}>
        <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </Field>
      <Field label="Código de barras (opcional)" error={errs.barcode}>
        {/* Only digits: whatever else is typed or pasted is dropped (the scanner sends digits). */}
        <Input
          inputMode="numeric"
          maxLength={14}
          placeholder="Solo números, 8 a 14 dígitos"
          value={f.barcode}
          onChange={(e) => setF({ ...f, barcode: e.target.value.replace(/\D/g, "") })}
        />
      </Field>
      <Field label="Categoría">
        <Select value={f.productCategoryId} onChange={(e) => setF({ ...f, productCategoryId: Number(e.target.value) })}>
          <option value={0}>Elegir…</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Marca">
        <Select value={f.productBrandId} onChange={(e) => setF({ ...f, productBrandId: Number(e.target.value) })}>
          <option value={0}>Elegir…</option>
          {brands.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Calidad">
        <Select value={f.qualityTier} onChange={(e) => setF({ ...f, qualityTier: e.target.value as "ALTA" | "MEDIA" | "BAJA" })}>
          <option value="ALTA">Alta</option>
          <option value="MEDIA">Media</option>
          <option value="BAJA">Baja</option>
        </Select>
      </Field>
      <Field label="Precio de venta (C$)" error={errs.listPrice}>
        <Input inputMode="decimal" value={f.listPrice} onChange={(e) => setF({ ...f, listPrice: e.target.value })} />
      </Field>
      {withInitialStock && (
        <>
          <Field label="Inventario inicial (opcional)" hint="Unidades que hay hoy en la tienda">
            <Input type="number" min={0} value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} />
          </Field>
          <Field label="Costo unitario (C$)">
            <Input inputMode="decimal" value={f.unitCost} onChange={(e) => setF({ ...f, unitCost: e.target.value })} />
          </Field>
        </>
      )}
      <div className="sm:col-span-2">
        <Alert>{create.error && errorMessage(create.error)}</Alert>
      </div>
      <Button type="submit" className="sm:col-span-2" disabled={create.isPending}>
        Guardar producto
      </Button>
    </form>
  );
}
