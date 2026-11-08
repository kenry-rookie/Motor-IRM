-- =====================================================================
--  Motor IRM — migración 1: decisiones API-001, API-002 y API-003
--  (DEC-037, DEC-038, DEC-039). Escrita a mano: Prisma no puede expresar
--  triggers ni el cambio de zona horaria de la base.
-- =====================================================================

-- ---------------------------------------------------------------------
--  API-002 / DEC-038 — Fechas con zona horaria
--
--  Prisma interpreta TIMESTAMP (sin zona) como si fuera UTC: una venta
--  hecha a las 17:00 en Managua se mostraría a las 11:00. Con TIMESTAMPTZ
--  se guarda el instante exacto y cada quien lo ve en su hora.
--  Los datos que ya existan se interpretan como hora de Managua.
-- ---------------------------------------------------------------------

DO $$
BEGIN
    EXECUTE format('ALTER DATABASE %I SET timezone = %L', current_database(), 'America/Managua');
END
$$;
SET timezone = 'America/Managua';

ALTER TABLE "app_user"
  ALTER COLUMN "created_at"    TYPE TIMESTAMPTZ(0) USING "created_at"    AT TIME ZONE 'America/Managua',
  ALTER COLUMN "created_at"    SET DEFAULT CURRENT_TIMESTAMP(0),
  ALTER COLUMN "last_login_at" TYPE TIMESTAMPTZ(0) USING "last_login_at" AT TIME ZONE 'America/Managua';

ALTER TABLE "product_price_history"
  ALTER COLUMN "changed_at" TYPE TIMESTAMPTZ(6) USING "changed_at" AT TIME ZONE 'America/Managua';

-- CHECK que convierte created_at a fecha: se reescribe con la zona explícita
-- para que no dependa de la configuración de la conexión.
ALTER TABLE "sale_invoice" DROP CONSTRAINT "ck_sale_invoice_due_date";
ALTER TABLE "sale_invoice"
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(0) USING "created_at" AT TIME ZONE 'America/Managua',
  ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP(0);
ALTER TABLE "sale_invoice"
  ADD CONSTRAINT "ck_sale_invoice_due_date"
  CHECK ("due_date" >= ("created_at" AT TIME ZONE 'America/Managua')::date);

ALTER TABLE "customer_return"
  ALTER COLUMN "returned_at" TYPE TIMESTAMPTZ(0) USING "returned_at" AT TIME ZONE 'America/Managua',
  ALTER COLUMN "returned_at" SET DEFAULT CURRENT_TIMESTAMP(0);

ALTER TABLE "service_order_status_change"
  ALTER COLUMN "changed_at" TYPE TIMESTAMPTZ(6) USING "changed_at" AT TIME ZONE 'America/Managua';

ALTER TABLE "customer_payment"
  ALTER COLUMN "paid_at" TYPE TIMESTAMPTZ(0) USING "paid_at" AT TIME ZONE 'America/Managua',
  ALTER COLUMN "paid_at" SET DEFAULT CURRENT_TIMESTAMP(0);

ALTER TABLE "inventory_movement"
  ALTER COLUMN "moved_at" TYPE TIMESTAMPTZ(0) USING "moved_at" AT TIME ZONE 'America/Managua',
  ALTER COLUMN "moved_at" SET DEFAULT CURRENT_TIMESTAMP(0);


-- ---------------------------------------------------------------------
--  API-001 / DEC-037 — La orden de servicio tiene id propio
--
--  Antes: service_order.id = sale_invoice.id (había que crear la factura
--  para recibir la moto). Ahora la orden existe sola y la factura apunta a
--  ella cuando se cobra: sale_invoice.service_order_id (0..1 por orden).
-- ---------------------------------------------------------------------

ALTER TABLE "service_order" DROP CONSTRAINT "fk_service_order_id";

CREATE SEQUENCE "service_order_id_seq" AS INTEGER OWNED BY "service_order"."id";
ALTER TABLE "service_order" ALTER COLUMN "id" SET DEFAULT nextval('service_order_id_seq');
SELECT setval('service_order_id_seq', coalesce((SELECT max("id") FROM "service_order"), 0) + 1, false);

ALTER TABLE "sale_invoice" ADD COLUMN "service_order_id" INTEGER;
-- Datos anteriores: la factura de una orden tenía su mismo id.
UPDATE "sale_invoice" si SET "service_order_id" = si."id"
 WHERE EXISTS (SELECT 1 FROM "service_order" so WHERE so."id" = si."id");

CREATE UNIQUE INDEX "uq_sale_invoice_service_order_id" ON "sale_invoice"("service_order_id");
CREATE UNIQUE INDEX "uq_sale_invoice_id_service_order_id" ON "sale_invoice"("id", "service_order_id");
ALTER TABLE "sale_invoice"
  ADD CONSTRAINT "fk_sale_invoice_service_order_id" FOREIGN KEY ("service_order_id")
  REFERENCES "service_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- La línea que cobra una falla adicional debe estar en la factura de la
-- MISMA orden. Antes lo probaba la FK (falla, factura) porque los ids
-- coincidían; ahora la línea copia service_order_id (redundancia
-- controlada, como DEC-029) y dos FK compuestas lo garantizan:
--   (factura, orden) existe en sale_invoice  y  (falla, orden) en additional_fault.
ALTER TABLE "sale_invoice_line" DROP CONSTRAINT "fk_sale_invoice_line_additional_fault_id_sale_invoice_id";
ALTER TABLE "sale_invoice_line" ADD COLUMN "service_order_id" INTEGER;
UPDATE "sale_invoice_line" l SET "service_order_id" = si."service_order_id"
  FROM "sale_invoice" si WHERE si."id" = l."sale_invoice_id" AND si."service_order_id" IS NOT NULL;

ALTER TABLE "sale_invoice_line"
  ADD CONSTRAINT "fk_sale_invoice_line_sale_invoice_id_service_order_id"
  FOREIGN KEY ("sale_invoice_id", "service_order_id")
  REFERENCES "sale_invoice"("id", "service_order_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sale_invoice_line"
  ADD CONSTRAINT "fk_sale_invoice_line_additional_fault_id_service_order_id"
  FOREIGN KEY ("additional_fault_id", "service_order_id")
  REFERENCES "additional_fault"("id", "service_order_id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- MATCH SIMPLE no revisa una FK con algún NULL: si hay falla, la orden es obligatoria.
ALTER TABLE "sale_invoice_line"
  ADD CONSTRAINT "ck_sale_invoice_line_additional_fault"
  CHECK ("additional_fault_id" IS NULL OR "service_order_id" IS NOT NULL);


-- ---------------------------------------------------------------------
--  API-003 / DEC-039 — product.stock lo mantiene la base con un trigger
--
--  product.stock es una copia de la suma de inventory_movement. Un solo
--  lugar la cambia: el trigger al insertar un movimiento. Así no se
--  desincroniza aunque la API tenga un error, y ck_product_stock (>= 0)
--  rechaza cualquier salida sin existencias.
--  El kardex es de solo inserción: un error se corrige con un ajuste.
-- ---------------------------------------------------------------------

CREATE FUNCTION "fn_inventory_movement_apply_stock"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    PERFORM set_config('motor_irm.stock_from_movement', 'on', true);
    UPDATE "product"
       SET "stock" = "stock" + CASE
             WHEN NEW."movement_type" IN ('COMPRA', 'DEVOLUCION_CLIENTE', 'INVENTARIO_INICIAL', 'AJUSTE_ENTRADA')
             THEN NEW."quantity" ELSE -NEW."quantity" END
     WHERE "id" = NEW."product_id";
    PERFORM set_config('motor_irm.stock_from_movement', 'off', true);
    RETURN NEW;
END
$$;

CREATE TRIGGER "tg_inventory_movement_apply_stock"
AFTER INSERT ON "inventory_movement"
FOR EACH ROW EXECUTE FUNCTION "fn_inventory_movement_apply_stock"();

CREATE FUNCTION "fn_inventory_movement_append_only"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'inventory_movement es de solo inserción; corrige con un ajuste (AJUSTE_ENTRADA/AJUSTE_SALIDA)'
        USING ERRCODE = 'restrict_violation', CONSTRAINT = 'tg_inventory_movement_append_only';
END
$$;

CREATE TRIGGER "tg_inventory_movement_append_only"
BEFORE UPDATE OR DELETE ON "inventory_movement"
FOR EACH ROW EXECUTE FUNCTION "fn_inventory_movement_append_only"();

CREATE FUNCTION "fn_product_guard_stock"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW."stock" <> 0 THEN
        RAISE EXCEPTION 'Un producto nuevo empieza con stock 0; registra un movimiento INVENTARIO_INICIAL'
            USING ERRCODE = 'check_violation', CONSTRAINT = 'tg_product_guard_stock';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW."stock" IS DISTINCT FROM OLD."stock"
       AND coalesce(current_setting('motor_irm.stock_from_movement', true), 'off') <> 'on' THEN
        RAISE EXCEPTION 'product.stock solo cambia con movimientos de inventario'
            USING ERRCODE = 'check_violation', CONSTRAINT = 'tg_product_guard_stock';
    END IF;
    RETURN NEW;
END
$$;

CREATE TRIGGER "tg_product_guard_stock"
BEFORE INSERT OR UPDATE ON "product"
FOR EACH ROW EXECUTE FUNCTION "fn_product_guard_stock"();

-- Para revisar que la copia coincide con el kardex (debe devolver 0 filas).
CREATE VIEW "v_product_stock_mismatch" AS
SELECT p."id" AS "product_id", p."stock",
       coalesce(sum(CASE
             WHEN m."movement_type" IN ('COMPRA', 'DEVOLUCION_CLIENTE', 'INVENTARIO_INICIAL', 'AJUSTE_ENTRADA')
             THEN m."quantity" ELSE -m."quantity" END), 0)::int AS "ledger_stock"
  FROM "product" p
  LEFT JOIN "inventory_movement" m ON m."product_id" = p."id"
 GROUP BY p."id", p."stock"
HAVING p."stock" <> coalesce(sum(CASE
             WHEN m."movement_type" IN ('COMPRA', 'DEVOLUCION_CLIENTE', 'INVENTARIO_INICIAL', 'AJUSTE_ENTRADA')
             THEN m."quantity" ELSE -m."quantity" END), 0);
