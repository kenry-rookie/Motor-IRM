import { z } from "zod";

import { normalizePhone } from "~/lib/phone";

/**
 * API-008 — Allowed values of every column with a CHECK ... IN (...).
 * Single source for the API (z.enum in inputs) and the client (selects, labels).
 * Must match prisma/migrations/0_init/migration.sql; if a CHECK changes, change it here.
 */
export const PAYMENT_TERMS = ["CONTADO", "CREDITO"] as const;
/** ck_staff_kind (DEC-041). */
export const STAFF_KINDS = ["DUENO", "MECANICO", "ENCARGADO"] as const;
export const CURRENCIES = ["NIO", "USD"] as const;
export const QUALITY_TIERS = ["ALTA", "MEDIA", "BAJA"] as const;
export const DISCOUNT_TYPES = ["PORCENTAJE", "MONTO"] as const;
export const LINE_TYPES = ["PRODUCTO", "MANO_OBRA", "CARGO_EXTERNO"] as const;
export const SERVICE_ORDER_STATUSES = [
  "RECIBIDA",
  "EN_DIAGNOSTICO",
  "EN_PROCESO",
  "ESPERA_REPUESTO",
  "ESPERA_CLIENTE",
  "TERMINADA",
  "EN_PRUEBA",
  "ENTREGADA",
  "CANCELADA",
] as const;
export const FAULT_DECISIONS = ["PENDIENTE", "ACEPTADA", "RECHAZADA"] as const;
export const WARRANTY_OUTCOMES = ["CUBIERTO", "FALLA_DISTINTA", "FUERA_DE_PLAZO", "REEMBOLSO"] as const;
export const PART_PAID_BY = ["TIENDA", "CLIENTE"] as const;
export const SUPPLIER_RETURN_RESOLUTIONS = ["REPOSICION", "DINERO", "DESCUENTO"] as const;
export const MOVEMENT_TYPES_IN = ["COMPRA", "DEVOLUCION_CLIENTE", "INVENTARIO_INICIAL", "AJUSTE_ENTRADA"] as const;
export const MOVEMENT_TYPES_OUT = ["VENTA", "USO_SERVICIO", "DEVOLUCION_PROVEEDOR", "GARANTIA", "AJUSTE_SALIDA"] as const;
export const MOVEMENT_TYPES = [...MOVEMENT_TYPES_IN, ...MOVEMENT_TYPES_OUT] as const;

export type PaymentTerms = (typeof PAYMENT_TERMS)[number];
export type StaffKind = (typeof STAFF_KINDS)[number];
export type Currency = (typeof CURRENCIES)[number];
export type QualityTier = (typeof QUALITY_TIERS)[number];
export type LineType = (typeof LINE_TYPES)[number];
export type ServiceOrderStatus = (typeof SERVICE_ORDER_STATUSES)[number];
export type MovementType = (typeof MOVEMENT_TYPES)[number];

/** Final states: an order in one of these cannot change any more. */
export const FINAL_SERVICE_STATUSES: readonly ServiceOrderStatus[] = ["ENTREGADA", "CANCELADA"];

/** Spanish labels for the UI. */
export const LABELS = {
  paymentTerms: { CONTADO: "Contado", CREDITO: "Crédito" },
  staffKind: { DUENO: "Dueño", MECANICO: "Mecánico", ENCARGADO: "Encargado" },
  qualityTier: { ALTA: "Alta", MEDIA: "Media", BAJA: "Baja" },
  lineType: { PRODUCTO: "Producto", MANO_OBRA: "Mano de obra", CARGO_EXTERNO: "Cargo externo" },
  serviceStatus: {
    RECIBIDA: "Recibida",
    EN_DIAGNOSTICO: "En diagnóstico",
    EN_PROCESO: "En proceso",
    ESPERA_REPUESTO: "Espera repuesto",
    ESPERA_CLIENTE: "Espera cliente",
    TERMINADA: "Terminada",
    EN_PRUEBA: "En prueba",
    ENTREGADA: "Entregada",
    CANCELADA: "Cancelada",
  },
  movementType: {
    COMPRA: "Compra",
    DEVOLUCION_CLIENTE: "Devolución de cliente",
    INVENTARIO_INICIAL: "Inventario inicial",
    AJUSTE_ENTRADA: "Ajuste (entrada)",
    VENTA: "Venta",
    USO_SERVICIO: "Uso en servicio",
    DEVOLUCION_PROVEEDOR: "Devolución a proveedor",
    GARANTIA: "Garantía",
    AJUSTE_SALIDA: "Ajuste (salida)",
  },
  faultDecision: { PENDIENTE: "Pendiente", ACEPTADA: "Aceptada", RECHAZADA: "Rechazada" },
  warrantyOutcome: {
    CUBIERTO: "Cubierto",
    FALLA_DISTINTA: "Falla distinta",
    FUERA_DE_PLAZO: "Fuera de plazo",
    REEMBOLSO: "Reembolso",
  },
} as const;

// ---- Zod building blocks shared by every router -----------------------------

/** Money travels as a string ("150.50") so it never becomes a float (CLI-004). */
export const zMoney = z
  .string()
  .trim()
  .regex(/^\d{1,10}(\.\d{1,2})?$/, "Monto inválido (use números con hasta 2 decimales)");
export const zPositiveMoney = zMoney.refine((v) => Number(v) > 0, "El monto debe ser mayor que 0");
/** Rates such as interest or commission, 0–1 with up to 4 decimals ("0.0500" = 5 %). */
export const zRate = z
  .string()
  .trim()
  .regex(/^(0(\.\d{1,4})?|1(\.0{1,4})?)$/, "Tasa inválida (entre 0 y 1, p. ej. 0.05 = 5 %)");
export const zExchangeRate = z
  .string()
  .trim()
  .regex(/^\d{1,6}(\.\d{1,4})?$/, "Tipo de cambio inválido");
export const zId = z.number().int().positive();
export const zQty = z.number().int().positive("La cantidad debe ser mayor que 0");
export const zText = (max: number) => z.string().trim().min(1, "Requerido").max(max);
export const zOptText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === "" ? undefined : v));
/** Phone in the shop's format (DEC-047): 8888-1111, +1 305-555-1234, +506 8888-1111… */
const PHONE_MSG = "Teléfono incompleto: 8 dígitos (8888-1111) o + código del país";
export const zPhone = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const n = normalizePhone(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: PHONE_MSG });
      return z.NEVER;
    }
    return n;
  });
export const zOptPhone = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return undefined;
    const n = normalizePhone(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: PHONE_MSG });
      return z.NEVER;
    }
    return n;
  });
/** Chassis (VIN) number: letters, digits and dashes, stored in capitals (ck_motorcycle_chassis_number). */
export const zOptChassis = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v.toUpperCase().replace(/\s+/g, "") : undefined))
  .refine((v) => v === undefined || /^[A-Z0-9-]{5,30}$/.test(v), "Chasis: de 5 a 30 letras o números");
/** Calendar day "YYYY-MM-DD" (DATE columns). */
export const zDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (AAAA-MM-DD)");

/** Converts a "YYYY-MM-DD" day to the Date Prisma expects for a DATE column. */
export const dayToDate = (day: string) => new Date(`${day}T00:00:00.000Z`);
/** Today's calendar day in Managua, as "YYYY-MM-DD". */
export const todayInManagua = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Managua" }).format(new Date());

/**
 * Pagination fields (API-022), spread into a query input: `{ ...pageFields }`.
 * `cursor` must be top-level so tRPC's useInfiniteQuery can drive it.
 * cursor = id of the last row received.
 */
export const pageFields = {
  cursor: zId.nullish(),
  limit: z.number().int().min(1).max(100).default(50),
};
