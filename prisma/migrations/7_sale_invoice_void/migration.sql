-- =====================================================================
--  Migración 7 — Anulación de facturas (DEC-055)
--   Una factura anulada NO se borra: queda con su anulación (motivo,
--   quién, cuándo, cuánto efectivo se devolvió). Los productos vuelven al
--   inventario con una devolución (movimiento de signo contrario) creada
--   en la misma transacción, y su saldo pasa a 0.
--   Reglas en la base: solo un dueño, máximo 3 días, sin comisión pagada,
--   y nada nuevo (abonos, devoluciones) sobre una factura anulada.
-- =====================================================================

CREATE TABLE "sale_invoice_void" (
    "sale_invoice_id"    integer       NOT NULL,
    "voided_at"          timestamptz(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    "voided_by_user_id"  integer       NOT NULL,
    "reason"             varchar(200)  NOT NULL,
    "refund_amount"      numeric(12,2) NOT NULL DEFAULT 0,
    "customer_return_id" integer,
    CONSTRAINT "pk_sale_invoice_void" PRIMARY KEY ("sale_invoice_id"),
    CONSTRAINT "fk_sale_invoice_void_sale_invoice_id" FOREIGN KEY ("sale_invoice_id")
        REFERENCES "sale_invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fk_sale_invoice_void_voided_by_user_id" FOREIGN KEY ("voided_by_user_id")
        REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    -- La devolución que regresó los productos es de ESTA factura (FK compuesta).
    CONSTRAINT "fk_sale_invoice_void_customer_return" FOREIGN KEY ("customer_return_id", "sale_invoice_id")
        REFERENCES "customer_return"("id", "sale_invoice_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ck_sale_invoice_void_reason" CHECK (length(btrim("reason")) >= 5),
    CONSTRAINT "ck_sale_invoice_void_refund" CHECK ("refund_amount" >= 0)
);
-- Una devolución es de una sola anulación (la factura es la PK, así que el par también es único).
CREATE UNIQUE INDEX "uq_sale_invoice_void_customer_return_id_sale_invoice_id" ON "sale_invoice_void"("customer_return_id", "sale_invoice_id");

-- Motivo de devolución que usan las anulaciones.
INSERT INTO "return_reason" ("name")
SELECT 'Anulación de factura'
 WHERE NOT EXISTS (SELECT 1 FROM "return_reason" WHERE lower("name") = lower('Anulación de factura'));


-- ---------------------------------------------------------------------
--  Reglas de la anulación
-- ---------------------------------------------------------------------
CREATE FUNCTION "fn_sale_invoice_void_check"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_created timestamptz;
    v_order   integer;
BEGIN
    IF TG_OP <> 'INSERT' THEN
        RAISE EXCEPTION 'Una anulación no se edita ni se borra'
            USING ERRCODE = 'check_violation', CONSTRAINT = 'tg_sale_invoice_void_append_only';
    END IF;

    SELECT si."created_at", si."service_order_id" INTO v_created, v_order
      FROM "sale_invoice" si WHERE si."id" = NEW."sale_invoice_id";

    IF v_created < now() - interval '3 days' THEN
        RAISE EXCEPTION 'La factura % tiene más de 3 días: ya no se puede anular', NEW."sale_invoice_id"
            USING ERRCODE = 'check_violation', CONSTRAINT = 'tg_sale_invoice_void_deadline';
    END IF;

    IF NOT EXISTS (SELECT 1
                     FROM "app_user" u
                     JOIN "staff" s ON s."id" = u."staff_id"
                    WHERE u."id" = NEW."voided_by_user_id" AND u."active" AND s."active" AND s."kind" = 'DUENO') THEN
        RAISE EXCEPTION 'Solo un dueño puede anular facturas'
            USING ERRCODE = 'check_violation', CONSTRAINT = 'tg_sale_invoice_void_owner';
    END IF;

    IF v_order IS NOT NULL AND EXISTS (SELECT 1 FROM "service_order"
                                        WHERE "id" = v_order AND "staff_payout_id" IS NOT NULL) THEN
        RAISE EXCEPTION 'La comisión de esta orden ya se pagó: no se puede anular la factura'
            USING ERRCODE = 'check_violation', CONSTRAINT = 'tg_sale_invoice_void_commission_paid';
    END IF;
    RETURN NEW;
END
$$;

CREATE TRIGGER "tg_sale_invoice_void_check"
BEFORE INSERT OR UPDATE OR DELETE ON "sale_invoice_void"
FOR EACH ROW EXECUTE FUNCTION "fn_sale_invoice_void_check"();

-- Sobre una factura anulada no se aplican abonos ni devoluciones nuevas.
CREATE FUNCTION "fn_sale_invoice_not_voided"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW."sale_invoice_id" IS NOT NULL
       AND EXISTS (SELECT 1 FROM "sale_invoice_void" v WHERE v."sale_invoice_id" = NEW."sale_invoice_id") THEN
        RAISE EXCEPTION 'La factura % está anulada', NEW."sale_invoice_id"
            USING ERRCODE = 'check_violation', CONSTRAINT = 'tg_sale_invoice_voided';
    END IF;
    RETURN NEW;
END
$$;

CREATE TRIGGER "tg_customer_payment_allocation_not_voided"
BEFORE INSERT ON "customer_payment_allocation"
FOR EACH ROW EXECUTE FUNCTION "fn_sale_invoice_not_voided"();

CREATE TRIGGER "tg_customer_return_not_voided"
BEFORE INSERT ON "customer_return"
FOR EACH ROW EXECUTE FUNCTION "fn_sale_invoice_not_voided"();


-- ---------------------------------------------------------------------
--  Vistas: una factura anulada no se debe (saldo 0, sin vencimiento) y su
--  mano de obra no genera comisión. Mismas columnas + "voided" al final.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW "v_invoice_balance" AS
SELECT si."id"                                         AS "sale_invoice_id",
       si."customer_id",
       si."payment_terms",
       si."created_at",
       coalesce(si."extended_due_date", si."due_date") AS "due_date",
       t."total",
       r."returned",
       p."paid",
       CASE WHEN v."sale_invoice_id" IS NOT NULL THEN 0
            ELSE t."total" - r."returned" - p."paid" END AS "balance",
       CASE WHEN v."sale_invoice_id" IS NULL
             AND t."total" - r."returned" - p."paid" > 0
             AND coalesce(si."extended_due_date", si."due_date") < CURRENT_DATE
            THEN CURRENT_DATE - coalesce(si."extended_due_date", si."due_date") END AS "days_overdue",
       v."sale_invoice_id" IS NOT NULL                  AS "voided"
  FROM "sale_invoice" si
  LEFT JOIN "sale_invoice_void" v ON v."sale_invoice_id" = si."id"
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

CREATE OR REPLACE VIEW "v_mechanic_unpaid_commission" AS
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
   AND d."delivered_at" IS NOT NULL
   AND NOT EXISTS (SELECT 1
                     FROM "sale_invoice" si
                     JOIN "sale_invoice_void" v ON v."sale_invoice_id" = si."id"
                    WHERE si."service_order_id" = so."id");
