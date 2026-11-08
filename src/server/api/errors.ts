import { TRPCError } from "@trpc/server";

/**
 * API-009 — Turns PostgreSQL / Prisma errors into TRPCErrors with messages a
 * person at the counter understands. The business rules live in the database
 * (CHECK, composite FKs, triggers); this is where their violations get words.
 *
 * Unknown constraints still get a readable message that names the constraint,
 * so a missing translation is easy to spot and add here.
 */
const MESSAGES: Record<string, string> = {
  // Inventory (DEC-039)
  ck_product_stock: "No hay existencias suficientes de este producto.",
  tg_product_guard_stock: "Las existencias solo cambian con movimientos de inventario.",
  tg_inventory_movement_append_only: "Un movimiento de inventario no se edita ni se borra; registre un ajuste.",
  ck_inventory_movement_notes: "Los ajustes de inventario necesitan una nota que explique el motivo.",
  uq_product_barcode: "Ya existe un producto con ese código de barras.",
  ck_product_list_price: "El precio no puede ser negativo.",
  // Uniques with names
  uq_product_category_name: "Ya existe una categoría con ese nombre.",
  uq_product_brand_name: "Ya existe una marca con ese nombre.",
  uq_motorcycle_brand_name: "Ya existe una marca de moto con ese nombre.",
  uq_motorcycle_model_motorcycle_brand_id_name: "Esa marca ya tiene un modelo con ese nombre.",
  uq_service_type_name: "Ya existe un tipo de servicio con ese nombre.",
  uq_payment_method_name: "Ya existe un método de pago con ese nombre.",
  uq_return_reason_name: "Ya existe un motivo de devolución con ese nombre.",
  uq_cash_withdrawal_reason_name: "Ya existe un motivo de retiro con ese nombre.",
  uq_discount_name: "Ya existe un descuento con ese nombre.",
  uq_role_name: "Ya existe un rol con ese nombre.",
  uq_app_user_username: "Ese nombre de usuario ya está en uso.",
  uq_app_user_staff_id: "Esa persona ya tiene un usuario.",
  uq_customer_national_id: "Ya existe un cliente con esa cédula.",
  uq_motorcycle_plate: "Ya existe una moto con esa placa.",
  uq_permission_code: "Ese código de permiso ya existe.",
  // Sales
  uq_sale_invoice_invoice_number: "Ya existe una factura con ese número.",
  uq_sale_invoice_service_order_id: "Esta orden de servicio ya fue facturada.",
  ck_sale_invoice_customer: "Las ventas al crédito necesitan un cliente.",
  ck_sale_invoice_credit: "Una venta al crédito necesita fecha de vencimiento y autorización.",
  ck_sale_invoice_due_date: "El vencimiento no puede ser anterior a la fecha de la factura.",
  ck_sale_invoice_extended_due: "La prórroga debe ser posterior al vencimiento original.",
  ck_sale_invoice_line_discount: "El descuento no puede ser mayor que el total de la línea y debe estar autorizado.",
  ck_sale_invoice_line_by_type: "La línea no tiene los datos que pide su tipo (producto, mano de obra o cargo externo).",
  ck_sale_invoice_line_additional_fault: "Una falla adicional solo se cobra en la factura de su orden.",
  fk_sale_invoice_line_additional_fault_id_service_order_id: "La falla adicional no pertenece a esta orden.",
  uq_customer_return_credit_note_number: "Ya existe una nota de crédito con ese número.",
  uq_customer_return_line_return_id_invoice_line_id: "Esa línea ya está en esta devolución.",
  fk_customer_return_line_sale_invoice_line: "La línea devuelta no es un producto de esa factura.",
  // Payments
  ck_customer_payment_exchange: "Los pagos en dólares necesitan tipo de cambio; en córdobas no.",
  ck_supplier_payment_exchange: "Los pagos en dólares necesitan tipo de cambio; en córdobas no.",
  ck_customer_payment_allocation_target: "Cada abono se aplica a una factura o a un saldo inicial (uno solo).",
  // Service
  ck_service_order_payout_rate: "Para pagar la comisión, la orden necesita mecánico y porcentaje.",
  ck_warranty_claim_refund: "El reembolso solo se registra cuando el resultado es REEMBOLSO (y entonces es obligatorio).",
  ck_warranty_claim_new_service_order: "La nueva orden solo aplica cuando es otra falla, y no puede ser la misma orden.",
  uq_staff_payout_staff_id_period_start: "Ese mecánico ya tiene un pago que empieza en esa fecha.",
  ck_staff_payout_period: "El fin del periodo no puede ser antes del inicio.",
  // Purchasing
  uq_purchase_invoice_supplier_id_invoice_number: "Ese proveedor ya tiene una factura con ese número.",
  ck_purchase_invoice_due_date: "Una compra al crédito necesita vencimiento (y no puede ser antes de la compra).",
  fk_supplier_return_line_purchase_invoice_line: "La línea devuelta no es de esa factura de compra.",
};

type DbLikeError = { name?: string; code?: string; message?: string; meta?: Record<string, unknown> };

function constraintName(err: DbLikeError): string | null {
  const haystack = `${err.message ?? ""} ${JSON.stringify(err.meta ?? {})}`;
  const known = Object.keys(MESSAGES).find((name) => haystack.includes(name));
  if (known) return known;
  const m = /constraint "?([a-z0-9_]+)"?/i.exec(haystack) ?? /\b((?:ck|uq|fk|pk|tg)_[a-z0-9_]+)\b/.exec(haystack);
  return m?.[1] ?? null;
}

export function mapDatabaseError(error: unknown): TRPCError | null {
  if (!error || typeof error !== "object") return null;
  const err = error as DbLikeError;
  if (!err.name?.startsWith("PrismaClient")) return null;

  if (err.code === "P2025") {
    return new TRPCError({ code: "NOT_FOUND", message: "El registro no existe.", cause: error });
  }

  const name = constraintName(err);
  const known = name ? MESSAGES[name] : undefined;
  if (known) return new TRPCError({ code: name?.startsWith("uq_") ? "CONFLICT" : "BAD_REQUEST", message: known, cause: error });

  if (err.code === "P2002" || name?.startsWith("uq_")) {
    return new TRPCError({ code: "CONFLICT", message: `Ya existe un registro con ese valor (${name ?? "único"}).`, cause: error });
  }
  if (err.code === "P2003" || name?.startsWith("fk_")) {
    return new TRPCError({
      code: "BAD_REQUEST",
      message: `El registro relacionado no existe o todavía se usa en otro lado (${name ?? "relación"}).`,
      cause: error,
    });
  }
  if (name?.startsWith("ck_") || name?.startsWith("tg_")) {
    return new TRPCError({ code: "BAD_REQUEST", message: `Dato no permitido por la regla ${name}.`, cause: error });
  }
  return null;
}

/** Shorthand for business-rule errors raised by the API itself. */
export const fail = (message: string, code: "BAD_REQUEST" | "NOT_FOUND" | "CONFLICT" | "FORBIDDEN" = "BAD_REQUEST") =>
  new TRPCError({ code, message });
