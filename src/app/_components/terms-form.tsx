"use client";

import { useEffect } from "react";

import { CustomerPicker } from "~/app/_components/pickers";
import { Field, Input, Select } from "~/app/_components/ui";
import { addDaysISO, todayISO } from "~/lib/format";
import { api, type RouterInputs, type RouterOutputs } from "~/trpc/react";

export type Terms = RouterInputs["sales"]["create"]["terms"];
type Customer = RouterOutputs["customer"]["list"]["items"][number];

export const emptyTerms = (): Terms => ({ paymentTerms: "CONTADO", payment: { paymentMethodId: 0, currency: "NIO" } });

/**
 * Cash or credit, customer, payment method and — when the user lacks the
 * permission — the owner's username/password to authorize (credit/discount).
 */
export function TermsForm({
  terms,
  onChange,
  customer,
  onCustomer,
  needsAuthorization,
  lockCustomer,
}: {
  terms: Terms;
  onChange: (t: Terms) => void;
  customer: Customer | null;
  onCustomer?: (c: Customer | null) => void;
  needsAuthorization: boolean;
  lockCustomer?: boolean;
}) {
  const methods = api.admin.catalog.useQuery({ kind: "paymentMethod" });
  const active = methods.data?.filter((m) => m.active) ?? [];
  const firstMethod = active[0]?.id;
  useEffect(() => {
    if (terms.payment && !terms.payment.paymentMethodId && firstMethod) {
      onChange({ ...terms, payment: { ...terms.payment, paymentMethodId: firstMethod } });
    }
  }, [firstMethod, terms, onChange]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(["CONTADO", "CREDITO"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() =>
              onChange(
                t === "CONTADO"
                  ? { paymentTerms: "CONTADO", payment: { paymentMethodId: firstMethod ?? 0, currency: "NIO" }, authorizer: terms.authorizer }
                  : { paymentTerms: "CREDITO", dueDate: addDaysISO(todayISO(), 30), monthlyInterest: "0", authorizer: terms.authorizer },
              )
            }
            className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
              terms.paymentTerms === t ? "border-amber-500 bg-amber-500/10 text-amber-300" : "border-neutral-700 text-neutral-300"
            }`}
          >
            {t === "CONTADO" ? "Contado" : "Crédito"}
          </button>
        ))}
      </div>

      {!lockCustomer && onCustomer && (
        <Field label={terms.paymentTerms === "CREDITO" ? "Cliente (obligatorio)" : "Cliente (opcional)"}>
          <CustomerPicker value={customer} onChange={onCustomer} />
        </Field>
      )}

      {terms.paymentTerms === "CONTADO" && terms.payment && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Método de pago">
            <Select
              value={terms.payment.paymentMethodId}
              onChange={(e) => onChange({ ...terms, payment: { ...terms.payment!, paymentMethodId: Number(e.target.value) } })}
            >
              {active.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Moneda">
            <Select
              value={terms.payment.currency}
              onChange={(e) =>
                onChange({ ...terms, payment: { ...terms.payment!, currency: e.target.value as "NIO" | "USD" } })
              }
            >
              <option value="NIO">Córdobas</option>
              <option value="USD">Dólares</option>
            </Select>
          </Field>
          {terms.payment.currency === "USD" && (
            <Field label="Tipo de cambio (C$ por US$)">
              <Input
                inputMode="decimal"
                value={terms.payment.exchangeRate ?? ""}
                onChange={(e) => onChange({ ...terms, payment: { ...terms.payment!, exchangeRate: e.target.value } })}
              />
            </Field>
          )}
        </div>
      )}

      {terms.paymentTerms === "CREDITO" && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Vence">
            <Input type="date" value={terms.dueDate ?? ""} onChange={(e) => onChange({ ...terms, dueDate: e.target.value })} />
          </Field>
          <Field label="Interés mensual" hint="0.05 = 5 %">
            <Input
              inputMode="decimal"
              value={terms.monthlyInterest ?? "0"}
              onChange={(e) => onChange({ ...terms, monthlyInterest: e.target.value })}
            />
          </Field>
        </div>
      )}

      {needsAuthorization && (
        <div className="rounded-lg border border-amber-900 bg-amber-950/30 p-3">
          <p className="mb-2 text-xs text-amber-200">Necesita autorización de un dueño (crédito o descuento manual).</p>
          <div className="grid grid-cols-2 gap-3">
            <Input
              placeholder="Usuario"
              value={terms.authorizer?.username ?? ""}
              onChange={(e) => onChange({ ...terms, authorizer: { username: e.target.value, password: terms.authorizer?.password ?? "" } })}
            />
            <Input
              type="password"
              placeholder="Contraseña"
              value={terms.authorizer?.password ?? ""}
              onChange={(e) => onChange({ ...terms, authorizer: { username: terms.authorizer?.username ?? "", password: e.target.value } })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** Drops an empty authorizer so the API doesn't receive blank credentials. */
export function cleanTerms(t: Terms, customerId?: number): Terms {
  const authorizer = t.authorizer?.username && t.authorizer.password ? t.authorizer : undefined;
  return { ...t, customerId: customerId ?? t.customerId, authorizer };
}
