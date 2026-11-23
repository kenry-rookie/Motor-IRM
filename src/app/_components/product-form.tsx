"use client";

import { useState } from "react";

import { Alert, Button, Field, FormActions, FormSection, Input, Select } from "~/app/_components/ui";
import { errorMessage, fieldErrors } from "~/lib/errors";
import { dec } from "~/lib/format";
import { api } from "~/trpc/react";

/**
 * New product. Used in Inventario and, without initial stock, inside a purchase
 * ("+ Producto nuevo" without leaving the purchase): there the stock comes from
 * the purchase itself.
 */
export function ProductForm({
  onDone,
  onCancel,
  withInitialStock = true,
  initialName = "",
}: {
  onDone: (product: { id: number; name: string }) => void;
  onCancel?: () => void;
  withInitialStock?: boolean;
  initialName?: string;
}) {
  const utils = api.useUtils();
  const categories = api.admin.catalog.useQuery({ kind: "productCategory", onlyActive: true });
  const brands = api.admin.catalog.useQuery({ kind: "productBrand", onlyActive: true });
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
  const missing = !f.name.trim()
    ? "Falta el nombre"
    : !f.productCategoryId
      ? "Falta la categoría"
      : !f.productBrandId
        ? "Falta la marca"
        : !f.listPrice
          ? "Falta el precio de venta"
          : null;
  const margin = dec(f.listPrice).gt(0) && dec(f.unitCost).gt(0) ? dec(f.listPrice).minus(f.unitCost).div(f.listPrice).times(100) : null;
  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (missing || create.isPending) return;
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
      <FormSection title="¿Qué producto es?" description="El nombre como lo piden los clientes. Si tiene código de barras, escanéelo aquí.">
        <Field label="Nombre" error={errs.name}>
          <Input className="h-11" autoFocus placeholder="Ej.: Aceite 20W-50 1 litro" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Código de barras (opcional)" error={errs.barcode}>
          {/* Only digits: whatever else is typed or pasted is dropped (the scanner sends digits). */}
          <Input
            className="h-11"
            inputMode="numeric"
            maxLength={14}
            placeholder="Solo números, 8 a 14 dígitos"
            value={f.barcode}
            onChange={(e) => setF({ ...f, barcode: e.target.value.replace(/\D/g, "") })}
          />
        </Field>
        <Field label="Categoría" error={errs.productCategoryId}>
          <Select className="h-11" value={f.productCategoryId} onChange={(e) => setF({ ...f, productCategoryId: Number(e.target.value) })}>
            <option value={0}>Elegir…</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Marca" error={errs.productBrandId}>
          <Select className="h-11" value={f.productBrandId} onChange={(e) => setF({ ...f, productBrandId: Number(e.target.value) })}>
            <option value={0}>Elegir…</option>
            {brands.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Calidad" hint="Para ofrecer opciones al cliente: original, genérico, económico…">
          <Select className="h-11" value={f.qualityTier} onChange={(e) => setF({ ...f, qualityTier: e.target.value as "ALTA" | "MEDIA" | "BAJA" })}>
            <option value="ALTA">Alta</option>
            <option value="MEDIA">Media</option>
            <option value="BAJA">Baja</option>
          </Select>
        </Field>
      </FormSection>

      <FormSection
        title={withInitialStock ? "Precio y lo que hay hoy" : "Precio"}
        description={
          withInitialStock
            ? "El precio al que se vende. Si ya tiene unidades en la tienda, escriba cuántas y cuánto le costó cada una."
            : "El precio al que se vende. Las unidades entran con esta compra."
        }
      >
        <Field label="Precio de venta (C$)" error={errs.listPrice}>
          <Input className="h-11 text-base" inputMode="decimal" placeholder="0.00" value={f.listPrice} onChange={(e) => setF({ ...f, listPrice: e.target.value })} />
        </Field>
        {withInitialStock && (
          <>
            <Field label="Unidades que hay hoy (opcional)">
              <Input className="h-11" inputMode="numeric" placeholder="0" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} />
            </Field>
            <Field
              label="Costo de cada unidad (C$)"
              hint={margin ? `Ganancia: ${margin.toFixed(0)} % del precio de venta` : "Lo que le costó; sirve para saber cuánto se gana"}
            >
              <Input className="h-11" inputMode="decimal" placeholder="0.00" value={f.unitCost} onChange={(e) => setF({ ...f, unitCost: e.target.value })} />
            </Field>
          </>
        )}
      </FormSection>

      {create.error && <Alert>{errorMessage(create.error)}</Alert>}
      <FormActions onCancel={onCancel} note={missing}>
        <Button type="submit" className="h-11 px-6" disabled={!!missing || create.isPending}>
          {create.isPending ? "Guardando…" : "Guardar producto"}
        </Button>
      </FormActions>
    </form>
  );
}
