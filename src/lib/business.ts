/**
 * Datos del negocio que salen en la factura y en los comprobantes (DEC-053).
 *
 * Provisional: son genéricos hasta que la Fase 6 los pase a `app_setting`
 * (pantalla de Ajustes), donde los dueños los podrán cambiar sin tocar código.
 */
export const BUSINESS = {
  name: "Motoservicios y Repuestos Rivera",
  tagline: "Repuestos, accesorios, lubricantes y taller de motos",
  address: "Managua, Nicaragua",
  phone: "2250-0000 · 8888-0000",
  thanks: "¡Gracias por su preferencia!",
} as const;

/** Internal consecutive number shown on printed documents, e.g. 31 → "000031". */
export const docNumber = (id: number) => String(id).padStart(6, "0");

/**
 * Every document carries a PREFIX that says what it is (Kenry, 23-nov: «difícil
 * saber qué es el número de recibo»): a receipt R-000045 can no longer be
 * mistaken for an invoice F-000045. Search accepts the prefix or only the digits.
 */
export const DOC_PREFIX = {
  factura: "F",
  recibo: "R",
  devolucion: "D",
  retiro: "RT",
  pagoProveedor: "PP",
  compra: "C",
  viaje: "V",
  orden: "OS",
  adelanto: "AD",
  pagoMecanico: "PM",
  garantia: "G",
} as const;
export type DocKind = keyof typeof DOC_PREFIX;

/** e.g. docNo("recibo", 45) → "R-000045". */
export const docNo = (kind: DocKind, id: number) => `${DOC_PREFIX[kind]}-${docNumber(id)}`;

/** The invoice's own number if it has one (printed pad), else F-000123. */
export const invoiceNo = (inv: { id: number; invoiceNumber?: string | null }) => inv.invoiceNumber ?? docNo("factura", inv.id);

/** Which document kind each table of v_money_movement is. */
export const REF_DOC: Record<string, DocKind> = {
  customer_payment: "recibo",
  cash_withdrawal: "retiro",
  supplier_payment: "pagoProveedor",
  purchase_trip: "viaje",
  purchase_trip_expense: "viaje",
  sale_invoice_void: "factura",
  customer_return: "devolucion",
  staff_advance: "adelanto",
  staff_payout: "pagoMecanico",
  warranty_claim: "garantia",
};

/**
 * Reads what someone typed as a document number: "R-45", "r 000045", "#45", "45".
 * Returns the digits and, if a known prefix came, its kind.
 */
export function parseDocNo(text: string): { id: number; kind?: DocKind } | null {
  const m = /^\s*#?\s*([a-zA-Z]{1,2})?\s*-?\s*0*(\d{1,9})\s*$/.exec(text);
  if (!m) return null;
  const prefix = m[1]?.toUpperCase();
  const kind = prefix ? (Object.entries(DOC_PREFIX).find(([, v]) => v === prefix)?.[0] as DocKind | undefined) : undefined;
  if (prefix && !kind) return null;
  return { id: Number(m[2]), kind };
}
