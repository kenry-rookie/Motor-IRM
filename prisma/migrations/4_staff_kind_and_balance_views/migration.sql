-- =====================================================================
--  Motor IRM — migración 4: limpieza de la Fase 1 (prompt v2, §5.1 y §8.1)
--
--  1. Personal: tipo (DUENO / MECANICO / ENCARGADO) y si repara motos.
--     El responsable de una orden puede ser un mecánico o un dueño; un
--     dueño nunca cobra comisión (DEC-041).
--  2. Saldos y comisiones como VISTAS de la base, no calculados en
--     TypeScript (DEC-042): una sola definición de "cuánto se debe".
--  Escrita a mano (prisma migrate dev --create-only + SQL revisado).
-- =====================================================================

-- ---------------------------------------------------------------------
--  1. Personal: kind + can_repair (DEC-041)
-- ---------------------------------------------------------------------

ALTER TABLE "staff"
  ADD COLUMN "kind"       VARCHAR(20),
  ADD COLUMN "can_repair" BOOLEAN NOT NULL DEFAULT true;

-- Datos que ya existan:
--   * enlazado a un usuario con rol «Dueño…»     → DUENO (y sin comisión)
--   * enlazado a un usuario y sin porcentaje     → ENCARGADO (no repara)
--   * el resto                                   → MECANICO
UPDATE "staff" s
   SET "kind" = CASE
         WHEN EXISTS (SELECT 1 FROM "app_user" u JOIN "role" r ON r."id" = u."role_id"
                       WHERE u."staff_id" = s."id" AND "mirm_norm"(r."name") LIKE 'dueno%') THEN 'DUENO'
         WHEN s."commission_rate" IS NULL
              AND EXISTS (SELECT 1 FROM "app_user" u WHERE u."staff_id" = s."id") THEN 'ENCARGADO'
         ELSE 'MECANICO' END;
UPDATE "staff" SET "commission_rate" = NULL WHERE "kind" = 'DUENO';
UPDATE "staff" SET "can_repair" = false WHERE "kind" = 'ENCARGADO';

ALTER TABLE "staff"
  ALTER COLUMN "kind" SET NOT NULL,
  ALTER COLUMN "kind" SET DEFAULT 'MECANICO';

ALTER TABLE "staff"
  ADD CONSTRAINT "ck_staff_kind" CHECK ("kind" IN ('DUENO', 'MECANICO', 'ENCARGADO')),
  -- NULL = no cobra comisión (dueños y el mecánico «al 100 %», que no se paga por el sistema).
  ADD CONSTRAINT "ck_staff_owner_no_commission" CHECK ("kind" <> 'DUENO' OR "commission_rate" IS NULL);

-- La orden guarda el porcentaje congelado al asignar. Sin responsable no hay porcentaje.
ALTER TABLE "service_order"
  ADD CONSTRAINT "ck_service_order_rate_needs_responsible"
  CHECK ("applied_commission_rate" IS NULL OR "mechanic_staff_id" IS NOT NULL);

-- Reglas que miran OTRA tabla (staff) no caben en un CHECK: van en un trigger.
--   * al asignar responsable: debe estar activo y poder reparar;
--   * si el responsable es un dueño, la orden no lleva porcentaje.
CREATE FUNCTION "fn_service_order_check_responsible"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    r "staff"%ROWTYPE;
BEGIN
    IF NEW."mechanic_staff_id" IS NULL THEN
        RETURN NEW;
    END IF;
    SELECT * INTO r FROM "staff" WHERE "id" = NEW."mechanic_staff_id";
    IF TG_OP = 'INSERT' OR NEW."mechanic_staff_id" IS DISTINCT FROM OLD."mechanic_staff_id" THEN
        IF NOT r."active" OR NOT r."can_repair" THEN
            RAISE EXCEPTION 'El responsable % no está activo o no repara motos', r."name"
                USING ERRCODE = 'check_violation', CONSTRAINT = 'tg_service_order_responsible_can_repair';
        END IF;
    END IF;
    IF r."kind" = 'DUENO' AND NEW."applied_commission_rate" IS NOT NULL THEN
        RAISE EXCEPTION 'Un dueño no cobra comisión'
            USING ERRCODE = 'check_violation', CONSTRAINT = 'tg_service_order_owner_no_commission';
    END IF;
    RETURN NEW;
END
$$;

CREATE TRIGGER "tg_service_order_check_responsible"
BEFORE INSERT OR UPDATE OF "mechanic_staff_id", "applied_commission_rate" ON "service_order"
FOR EACH ROW EXECUTE FUNCTION "fn_service_order_check_responsible"();


-- ---------------------------------------------------------------------
--  2. Vistas (DEC-042). Todo en córdobas (DEC-025); los dólares se pasan
--     con el tipo de cambio de cada pago, redondeado a 2 decimales.
--     CURRENT_DATE usa la zona de la base: America/Managua (DEC-038).
-- ---------------------------------------------------------------------

-- Estado actual de cada orden = el último cambio de estado.
CREATE VIEW "v_service_order_status" AS
SELECT DISTINCT ON (sc."service_order_id")
       sc."service_order_id",
       sc."status",
       sc."changed_at" AS "status_since"
  FROM "service_order_status_change" sc
 ORDER BY sc."service_order_id", sc."changed_at" DESC, sc."id" DESC;

-- Saldo de cada factura de venta: total − devoluciones − abonos.
-- Una unidad devuelta vale su precio neto (el descuento se reparte por unidad).
CREATE VIEW "v_invoice_balance" AS
SELECT si."id"                                         AS "sale_invoice_id",
       si."customer_id",
       si."payment_terms",
       si."created_at",
       coalesce(si."extended_due_date", si."due_date") AS "due_date",
       t."total",
       r."returned",
       p."paid",
       t."total" - r."returned" - p."paid"             AS "balance",
       CASE WHEN t."total" - r."returned" - p."paid" > 0
             AND coalesce(si."extended_due_date", si."due_date") < CURRENT_DATE
            THEN CURRENT_DATE - coalesce(si."extended_due_date", si."due_date") END AS "days_overdue"
  FROM "sale_invoice" si
 CROSS JOIN LATERAL (
       SELECT coalesce(sum(l."quantity" * l."unit_price" - l."discount_amount"), 0) AS "total"
         FROM "sale_invoice_line" l
        WHERE l."sale_invoice_id" = si."id") t
 CROSS JOIN LATERAL (
       SELECT coalesce(sum(round((l."quantity" * l."unit_price" - l."discount_amount") / l."quantity" * rl."quantity", 2)), 0) AS "returned"
         FROM "customer_return_line" rl
         JOIN "sale_invoice_line" l ON l."id" = rl."sale_invoice_line_id"
        WHERE rl."sale_invoice_id" = si."id") r
 CROSS JOIN LATERAL (
       SELECT coalesce(sum(a."amount"), 0) AS "paid"
         FROM "customer_payment_allocation" a
        WHERE a."sale_invoice_id" = si."id") p;

-- Saldo de cada deuda anterior al sistema (saldo inicial).
CREATE VIEW "v_opening_balance_remaining" AS
SELECT ob."id"          AS "customer_opening_balance_id",
       ob."customer_id",
       ob."as_of_date",
       ob."due_date",
       ob."amount",
       p."paid",
       ob."amount" - p."paid" AS "balance",
       CASE WHEN ob."amount" - p."paid" > 0 AND ob."due_date" < CURRENT_DATE
            THEN CURRENT_DATE - ob."due_date" END AS "days_overdue"
  FROM "customer_opening_balance" ob
 CROSS JOIN LATERAL (
       SELECT coalesce(sum(a."amount"), 0) AS "paid"
         FROM "customer_payment_allocation" a
        WHERE a."customer_opening_balance_id" = ob."id") p;

-- Lo que debe cada cliente (solo deudas con saldo > 0).
CREATE VIEW "v_customer_balance" AS
WITH debts AS (
    SELECT "customer_id", "balance", "due_date", "days_overdue"
      FROM "v_invoice_balance"
     WHERE "customer_id" IS NOT NULL AND "balance" > 0
    UNION ALL
    SELECT "customer_id", "balance", "due_date", "days_overdue"
      FROM "v_opening_balance_remaining"
     WHERE "balance" > 0
)
SELECT "customer_id",
       sum("balance")                                            AS "balance",
       coalesce(sum("balance") FILTER (WHERE "days_overdue" > 0), 0) AS "overdue",
       min("due_date")                                           AS "oldest_due_date",
       max("days_overdue")                                       AS "max_days_overdue",
       count(*)::int                                             AS "open_items"
  FROM debts
 GROUP BY "customer_id";

-- Saldo de cada compra: líneas − descuento de la factura − devoluciones que
-- se arreglaron con dinero o descuento (REPOSICION trae mercadería: la deuda sigue)
-- − pagos.
CREATE VIEW "v_purchase_invoice_balance" AS
SELECT pi."id"            AS "purchase_invoice_id",
       pi."supplier_id",
       pi."purchase_date",
       pi."payment_terms",
       pi."due_date",
       g."gross" - pi."discount_amount"                         AS "total",
       r."returned",
       p."paid",
       g."gross" - pi."discount_amount" - r."returned" - p."paid" AS "balance",
       CASE WHEN g."gross" - pi."discount_amount" - r."returned" - p."paid" > 0
             AND pi."due_date" < CURRENT_DATE
            THEN CURRENT_DATE - pi."due_date" END                AS "days_overdue"
  FROM "purchase_invoice" pi
 CROSS JOIN LATERAL (
       SELECT coalesce(sum(l."quantity" * l."unit_cost"), 0) AS "gross"
         FROM "purchase_invoice_line" l
        WHERE l."purchase_invoice_id" = pi."id") g
 CROSS JOIN LATERAL (
       SELECT coalesce(sum(l."unit_cost" * rl."quantity"), 0) AS "returned"
         FROM "supplier_return_line" rl
         JOIN "supplier_return" sr ON sr."id" = rl."supplier_return_id"
         JOIN "purchase_invoice_line" l ON l."id" = rl."purchase_invoice_line_id"
        WHERE rl."purchase_invoice_id" = pi."id" AND sr."resolution" <> 'REPOSICION') r
 CROSS JOIN LATERAL (
       SELECT coalesce(sum(CASE WHEN sp."currency" = 'USD' THEN round(sp."amount" * sp."exchange_rate", 2)
                                ELSE sp."amount" END), 0) AS "paid"
         FROM "supplier_payment" sp
        WHERE sp."purchase_invoice_id" = pi."id") p;

-- Lo que se le debe a cada proveedor: saldo inicial pendiente + compras.
CREATE VIEW "v_supplier_balance" AS
SELECT s."id"                                     AS "supplier_id",
       coalesce(s."opening_balance", 0) - op."paid" AS "opening_balance",
       pu."balance"                               AS "purchases_balance",
       coalesce(s."opening_balance", 0) - op."paid" + pu."balance" AS "balance",
       pu."overdue"
  FROM "supplier" s
 CROSS JOIN LATERAL (
       SELECT coalesce(sum(CASE WHEN sp."currency" = 'USD' THEN round(sp."amount" * sp."exchange_rate", 2)
                                ELSE sp."amount" END), 0) AS "paid"
         FROM "supplier_payment" sp
        WHERE sp."supplier_id" = s."id" AND sp."purchase_invoice_id" IS NULL) op
 CROSS JOIN LATERAL (
       SELECT coalesce(sum(b."balance"), 0) AS "balance",
              coalesce(sum(b."balance") FILTER (WHERE b."days_overdue" > 0), 0) AS "overdue"
         FROM "v_purchase_invoice_balance" b
        WHERE b."supplier_id" = s."id") pu;

-- Comisión ganada y no pagada, orden por orden (DEC-030, BR-104).
-- Solo órdenes ENTREGADAS con porcentaje: las de un dueño o del mecánico
-- «al 100 %» no tienen porcentaje y no aparecen.
CREATE VIEW "v_mechanic_unpaid_commission" AS
SELECT so."id"                      AS "service_order_id",
       so."mechanic_staff_id"       AS "staff_id",
       d."delivered_at",
       so."applied_commission_rate" AS "rate",
       lab."labor",
       round(lab."labor" * so."applied_commission_rate", 2) AS "commission"
  FROM "service_order" so
 CROSS JOIN LATERAL (
       SELECT min(sc."changed_at") AS "delivered_at"
         FROM "service_order_status_change" sc
        WHERE sc."service_order_id" = so."id" AND sc."status" = 'ENTREGADA') d
 CROSS JOIN LATERAL (
       SELECT coalesce(sum(l."quantity" * l."unit_price" - l."discount_amount"), 0) AS "labor"
         FROM "sale_invoice" si
         JOIN "sale_invoice_line" l ON l."sale_invoice_id" = si."id"
        WHERE si."service_order_id" = so."id" AND l."line_type" = 'MANO_OBRA') lab
 WHERE so."staff_payout_id" IS NULL
   AND so."applied_commission_rate" IS NOT NULL
   AND so."mechanic_staff_id" IS NOT NULL
   AND d."delivered_at" IS NOT NULL;

-- Último costo (DEC-024: la entrada más reciente) y margen sobre el precio de venta.
CREATE VIEW "v_product_margin" AS
SELECT p."id"          AS "product_id",
       p."list_price",
       lc."unit_cost"  AS "last_cost",
       p."list_price" - lc."unit_cost" AS "margin",
       CASE WHEN p."list_price" > 0 AND lc."unit_cost" IS NOT NULL
            THEN round((p."list_price" - lc."unit_cost") / p."list_price" * 100, 1) END AS "margin_pct"
  FROM "product" p
  LEFT JOIN LATERAL (
       SELECT m."unit_cost"
         FROM "inventory_movement" m
        WHERE m."product_id" = p."id"
          AND m."movement_type" IN ('COMPRA', 'DEVOLUCION_CLIENTE', 'INVENTARIO_INICIAL', 'AJUSTE_ENTRADA')
        ORDER BY m."moved_at" DESC, m."id" DESC
        LIMIT 1) lc ON true;
