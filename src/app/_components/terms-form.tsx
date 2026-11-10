"use client";

import { useEffect } from "react";

import { type TermsDraft } from "~/app/(app)/ventas/tabs-store";
import { Field, Input, Segmented, Select } from "~/app/_components/ui";
import { addDaysISO, todayISO } from "~/lib/format";
import { api, type RouterInputs } from "~/trpc/react";

export type Terms = TermsDraft;
export const emptyTerms = (): Terms => ({ paymentTerms: "CONTADO", payment: { paymentMethodId: 0, currency: "NIO" } });

/**
 * How the customer pays: cash (method, currency) or credit (due date, interest).
 * When the user lacks the permission, an owner types their user/password here.
 */
export function TermsForm({
  terms,
  onChange,
  needsAuthorization,
  creditBlockedReason,
}: {
  terms: Terms;
  onChange: (t: Terms) => void;
  needsAuthorization: boolean;
  /** e.g. "Elija un cliente para vender al crédito". */
  creditBlockedReason?: string | null;
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
      <Segmented
        label="Forma de pago"
        className="w-full [&>button]:flex-1"
        value={terms.paymentTerms}
        onChange={(t) =>
          onChange(
            t === "CONTADO"
              ? { paymentTerms: "CONTADO", payment: { paymentMethodId: firstMethod ?? 0, currency: "NIO" }, authorizer: terms.authorizer }
              : { paymentTerms: "CREDITO", dueDate: addDaysISO(todayISO(), 30), monthlyInterest: "0", authorizer: terms.authorizer },
          )
        }
        options={[
          { value: "CONTADO", label: "Contado" },
          { value: "CREDITO", label: "Crédito" },
        ]}
      />

      {terms.paymentTerms === "CONTADO" && terms.payment && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Método">
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
              onChange={(e) => onChange({ ...terms, payment: { ...terms.payment!, currency: e.target.value as "NIO" | "USD" } })}
            >
              <option value="NIO">Córdobas</option>
              <option value="USD">Dólares</option>
            </Select>
          </Field>
          {terms.payment.currency === "USD" && (
            <Field label="Tipo de cambio" hint="Córdobas por dólar">
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
        <>
          {creditBlockedReason && <p className="text-warn-fg text-sm">{creditBlockedReason}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vence">
              <Input type="date" value={terms.dueDate ?? ""} onChange={(e) => onChange({ ...terms, dueDate: e.target.value })} />
            </Field>
            <Field label="Interés mensual" hint="0.05 = 5 %">
              <Input inputMode="decimal" value={terms.monthlyInterest ?? "0"} onChange={(e) => onChange({ ...terms, monthlyInterest: e.target.value })} />
            </Field>
          </div>
        </>
      )}

      {needsAuthorization && (
        <div className="border-warn-line bg-warn-bg rounded-lg border p-3">
          <p className="text-warn-fg mb-2 text-sm">Esto necesita la clave de un dueño (crédito o descuento manual).</p>
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Usuario del dueño"
              autoComplete="off"
              value={terms.authorizer?.username ?? ""}
              onChange={(e) => onChange({ ...terms, authorizer: { username: e.target.value, password: terms.authorizer?.password ?? "" } })}
            />
            <Input
              type="password"
              placeholder="Contraseña"
              autoComplete="off"
              value={terms.authorizer?.password ?? ""}
              onChange={(e) => onChange({ ...terms, authorizer: { username: terms.authorizer?.username ?? "", password: e.target.value } })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

type ApiTerms = RouterInputs["sales"]["create"]["terms"];

/** Draft → API input: drops a blank authorizer and the payment block on credit. */
export function cleanTerms(t: Terms, customerId?: number): ApiTerms {
  const authorizer = t.authorizer?.username && t.authorizer.password ? t.authorizer : undefined;
  return t.paymentTerms === "CONTADO"
    ? { paymentTerms: "CONTADO", payment: t.payment, customerId, authorizer }
    : { paymentTerms: "CREDITO", dueDate: t.dueDate, monthlyInterest: (t.monthlyInterest ?? "").trim() === "" ? "0" : t.monthlyInterest, customerId, authorizer };
}
