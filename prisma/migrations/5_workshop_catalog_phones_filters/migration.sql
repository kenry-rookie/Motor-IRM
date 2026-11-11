-- =====================================================================
--  Motor IRM — migración 5: catálogo de trabajos del taller, datos de
--  recepción, teléfonos con formato y vistas para los filtros.
--  (prompt v2 §7, §8.2–3, §8.7 y pedidos de Kenry del 10-nov)
--  Escrita a mano (prisma migrate dev --create-only + SQL revisado).
-- =====================================================================

-- ---------------------------------------------------------------------
--  1. Teléfonos con formato (DEC-047)
--     Nicaragua:            8888-1111
--     EE. UU. / Canadá:     +1 305-555-1234
--     Centroamérica:        +506 8888-1111   (502 a 507)
--     Otro país:            +4915123456789   (solo dígitos tras el +)
--  La app da formato mientras se escribe (src/lib/phone.ts, la misma regla);
--  la base lo exige con un CHECK.
-- ---------------------------------------------------------------------

CREATE FUNCTION "mirm_phone_valid"(text) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
    SELECT $1 ~ '^[0-9]{4}-[0-9]{4}$'
        OR $1 ~ '^\+1 [0-9]{3}-[0-9]{3}-[0-9]{4}$'
        OR $1 ~ '^\+50[2-7] [0-9]{4}-[0-9]{4}$'
        OR $1 ~ '^\+[0-9]{7,15}$'
$$;

-- Normaliza lo que ya estaba escrito ("85687080" → "8568-7080"). Lo que no se
-- pueda entender se deja igual (y el CHECK queda NOT VALID: ver abajo).
CREATE FUNCTION "mirm_phone_format"(text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
    WITH d AS (SELECT regexp_replace($1, '[^0-9]', '', 'g') AS n, btrim($1) LIKE '+%' AS intl)
    SELECT CASE
             WHEN length(n) = 8 AND NOT intl              THEN substr(n, 1, 4) || '-' || substr(n, 5, 4)
             WHEN length(n) = 11 AND n LIKE '505%'        THEN substr(n, 4, 4) || '-' || substr(n, 8, 4)
             WHEN length(n) = 11 AND n ~ '^50[2-7]'       THEN '+' || substr(n, 1, 3) || ' ' || substr(n, 4, 4) || '-' || substr(n, 8, 4)
             WHEN length(n) = 11 AND n LIKE '1%'          THEN '+1 ' || substr(n, 2, 3) || '-' || substr(n, 5, 3) || '-' || substr(n, 8, 4)
             WHEN intl AND length(n) BETWEEN 7 AND 15     THEN '+' || n
             ELSE $1 END
      FROM d
$$;

UPDATE "customer" SET "phone" = "mirm_phone_format"("phone") WHERE NOT "mirm_phone_valid"("phone");
UPDATE "staff"    SET "phone" = "mirm_phone_format"("phone") WHERE NOT "mirm_phone_valid"("phone");
UPDATE "supplier" SET "phone" = "mirm_phone_format"("phone") WHERE "phone" IS NOT NULL AND NOT "mirm_phone_valid"("phone");

-- NOT VALID: las filas nuevas o editadas se revisan siempre; las viejas que no
-- se pudieron normalizar no hacen fallar la migración. Si todas quedaron bien,
-- se validan aquí mismo.
ALTER TABLE "customer" ADD CONSTRAINT "ck_customer_phone_format" CHECK ("mirm_phone_valid"("phone")) NOT VALID;
ALTER TABLE "staff"    ADD CONSTRAINT "ck_staff_phone_format"    CHECK ("mirm_phone_valid"("phone")) NOT VALID;
ALTER TABLE "supplier" ADD CONSTRAINT "ck_supplier_phone_format" CHECK ("phone" IS NULL OR "mirm_phone_valid"("phone")) NOT VALID;
DO $$
BEGIN
    BEGIN ALTER TABLE "customer" VALIDATE CONSTRAINT "ck_customer_phone_format";
    EXCEPTION WHEN check_violation THEN RAISE NOTICE 'Hay teléfonos de clientes sin formato: corríjalos desde la app'; END;
    BEGIN ALTER TABLE "staff" VALIDATE CONSTRAINT "ck_staff_phone_format";
    EXCEPTION WHEN check_violation THEN RAISE NOTICE 'Hay teléfonos del personal sin formato'; END;
    BEGIN ALTER TABLE "supplier" VALIDATE CONSTRAINT "ck_supplier_phone_format";
    EXCEPTION WHEN check_violation THEN RAISE NOTICE 'Hay teléfonos de proveedores sin formato'; END;
END
$$;


-- ---------------------------------------------------------------------
--  2. Catálogo de trabajos del taller (DEC-048, prompt §7)
--     Los trabajos se ELIGEN de la lista; no hay "Otro" de texto libre.
--     Las categorías son una tabla (no texto) por la misma razón que las
--     marcas de moto: "Frenos" y "frenos " no deben ser dos categorías.
-- ---------------------------------------------------------------------

CREATE TABLE "service_category" (
    "id"   SERIAL      NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "sort_order" SMALLINT NOT NULL DEFAULT 100,
    CONSTRAINT "pk_service_category" PRIMARY KEY ("id"),
    CONSTRAINT "ck_service_category_name" CHECK (btrim("name") <> '')
);
CREATE UNIQUE INDEX "uq_service_category_name" ON "service_category" (lower("name"));

INSERT INTO "service_category" ("name", "sort_order") VALUES
    ('Mantenimiento', 10), ('Frenos', 20), ('Motor', 30), ('Sistema eléctrico', 40),
    ('Suspensión y dirección', 50), ('Transmisión', 60), ('Llantas', 70),
    ('Accesorios', 80), ('Diagnóstico', 90), ('Otros cargos', 200);

ALTER TABLE "service_type"
  ADD COLUMN "service_category_id" INTEGER,
  ADD COLUMN "min_price" DECIMAL(12, 2),
  ADD COLUMN "max_price" DECIMAL(12, 2);

-- Los tipos que ya existen van a la categoría que corresponde por su nombre.
UPDATE "service_type" st SET "service_category_id" = (
    SELECT c."id" FROM "service_category" c WHERE c."name" = CASE
        WHEN "mirm_norm"(st."name") ~ 'aceite|engrase|mantenimiento|lavado' THEN 'Mantenimiento'
        WHEN "mirm_norm"(st."name") ~ 'freno'                               THEN 'Frenos'
        WHEN "mirm_norm"(st."name") ~ 'motor|carbur|valvul'                 THEN 'Motor'
        WHEN "mirm_norm"(st."name") ~ 'electr|bateria|luz|luces'            THEN 'Sistema eléctrico'
        WHEN "mirm_norm"(st."name") ~ 'accesorio'                           THEN 'Accesorios'
        WHEN "mirm_norm"(st."name") ~ 'diagnost|revision'                   THEN 'Diagnóstico'
        ELSE 'Mantenimiento' END);

ALTER TABLE "service_type" ALTER COLUMN "service_category_id" SET NOT NULL;
ALTER TABLE "service_type"
  ADD CONSTRAINT "fk_service_type_service_category_id" FOREIGN KEY ("service_category_id")
  REFERENCES "service_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  -- Rango de precio permitido: cobrar fuera de él pide la clave de un dueño.
  ADD CONSTRAINT "ck_service_type_price_range" CHECK (
        ("min_price" IS NULL OR "min_price" >= 0)
    AND ("max_price" IS NULL OR "max_price" >= coalesce("min_price", 0))
    AND ("reference_price" IS NULL OR (
            "reference_price" >= coalesce("min_price", "reference_price")
        AND "reference_price" <= coalesce("max_price", "reference_price"))));

CREATE INDEX "ix_service_type_name_trgm" ON "service_type" USING gin ("mirm_norm"("name") gin_trgm_ops);

-- Lo necesita la cancelación con cargo (ahora toda mano de obra tiene tipo).
INSERT INTO "service_type" ("name", "reference_price", "service_category_id")
SELECT 'Cargo por cancelación', NULL, c."id" FROM "service_category" c WHERE c."name" = 'Otros cargos'
ON CONFLICT DO NOTHING;


-- ---------------------------------------------------------------------
--  3. Servicios de cada orden (DEC-048)
--     Toda orden tiene al menos UN trabajo del catálogo. La nota del cliente
--     ("dice que suena al frenar") queda en service_order.requested_work,
--     que pasa a ser opcional: la nota nunca reemplaza al servicio.
-- ---------------------------------------------------------------------

CREATE TABLE "service_order_item" (
    "id"               SERIAL       NOT NULL,
    "service_order_id" INTEGER      NOT NULL,
    "service_type_id"  INTEGER      NOT NULL,
    "notes"            VARCHAR(200),
    CONSTRAINT "pk_service_order_item" PRIMARY KEY ("id"),
    CONSTRAINT "ck_service_order_item_notes" CHECK ("notes" IS NULL OR btrim("notes") <> '')
);
CREATE UNIQUE INDEX "uq_service_order_item_order_type" ON "service_order_item" ("service_order_id", "service_type_id");
CREATE INDEX "ix_service_order_item_service_type_id" ON "service_order_item" ("service_type_id");
ALTER TABLE "service_order_item"
  ADD CONSTRAINT "fk_service_order_item_service_order_id" FOREIGN KEY ("service_order_id")
  REFERENCES "service_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "fk_service_order_item_service_type_id" FOREIGN KEY ("service_type_id")
  REFERENCES "service_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Órdenes que ya existían: se les asignan los trabajos cuyo nombre aparece en
-- el texto que se escribió; si ninguno aparece, "Diagnóstico".
INSERT INTO "service_order_item" ("service_order_id", "service_type_id")
SELECT so."id", st."id"
  FROM "service_order" so
  JOIN "service_type" st ON "mirm_norm"(so."requested_work") LIKE '%' || "mirm_norm"(st."name") || '%'
ON CONFLICT DO NOTHING;
INSERT INTO "service_order_item" ("service_order_id", "service_type_id")
SELECT so."id", (SELECT "id" FROM "service_type" ORDER BY ("mirm_norm"("name") = 'diagnostico') DESC, "id" LIMIT 1)
  FROM "service_order" so
 WHERE NOT EXISTS (SELECT 1 FROM "service_order_item" i WHERE i."service_order_id" = so."id")
   AND EXISTS (SELECT 1 FROM "service_type");

ALTER TABLE "service_order" DROP CONSTRAINT "ck_service_order_requested_work";
ALTER TABLE "service_order" ALTER COLUMN "requested_work" DROP NOT NULL;
ALTER TABLE "service_order"
  ADD CONSTRAINT "ck_service_order_requested_work" CHECK ("requested_work" IS NULL OR btrim("requested_work") <> '');

-- "Al menos un servicio" mira OTRA tabla: un CHECK no puede. Es un trigger de
-- restricción DIFERIDO: se revisa al confirmar la transacción (COMMIT), cuando
-- la orden y sus servicios ya se insertaron juntos.
CREATE FUNCTION "fn_service_order_has_items"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_order integer;
BEGIN
    IF TG_TABLE_NAME = 'service_order' THEN
        v_order := NEW."id";
    ELSE
        v_order := OLD."service_order_id";
    END IF;
    IF EXISTS (SELECT 1 FROM "service_order" WHERE "id" = v_order)
       AND NOT EXISTS (SELECT 1 FROM "service_order_item" WHERE "service_order_id" = v_order) THEN
        RAISE EXCEPTION 'La orden % necesita al menos un trabajo del catálogo', v_order
            USING ERRCODE = 'check_violation', CONSTRAINT = 'tg_service_order_has_items';
    END IF;
    RETURN NULL;
END
$$;

CREATE CONSTRAINT TRIGGER "tg_service_order_has_items"
AFTER INSERT ON "service_order"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "fn_service_order_has_items"();

CREATE CONSTRAINT TRIGGER "tg_service_order_item_keep_one"
AFTER DELETE OR UPDATE OF "service_order_id" ON "service_order_item"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "fn_service_order_has_items"();

-- Mano de obra siempre con tipo de servicio (salvo las fallas adicionales,
-- que apuntan a su falla). NOT VALID: las facturas viejas no se tocan.
ALTER TABLE "sale_invoice_line"
  ADD CONSTRAINT "ck_sale_invoice_line_labor_service_type" CHECK (
    "line_type" <> 'MANO_OBRA' OR "service_type_id" IS NOT NULL OR "additional_fault_id" IS NOT NULL) NOT VALID;


-- ---------------------------------------------------------------------
--  4. Lo que de verdad se mira al recibir (prompt §8.2)
-- ---------------------------------------------------------------------

ALTER TABLE "motorcycle" ADD COLUMN "chassis_number" VARCHAR(30);
ALTER TABLE "motorcycle"
  ADD CONSTRAINT "ck_motorcycle_chassis_number" CHECK ("chassis_number" IS NULL OR "chassis_number" ~ '^[A-Z0-9-]{5,30}$');
CREATE UNIQUE INDEX "uq_motorcycle_chassis_number" ON "motorcycle" (upper("chassis_number"));

-- Opcional: las motos nuevas sin circular no tienen kilometraje.
ALTER TABLE "service_order" ADD COLUMN "odometer_km" INTEGER;
ALTER TABLE "service_order" ADD CONSTRAINT "ck_service_order_odometer_km" CHECK ("odometer_km" IS NULL OR "odometer_km" >= 0);


-- ---------------------------------------------------------------------
--  5. Vistas para los filtros (DEC-049)
-- ---------------------------------------------------------------------

-- Qué nos vende cada proveedor (de sus facturas): último costo y fecha.
-- Es también el "último costo pagado a ese proveedor" de la pantalla de compras.
CREATE VIEW "v_supplier_product" AS
SELECT DISTINCT ON (pi."supplier_id", l."product_id")
       pi."supplier_id",
       l."product_id",
       l."unit_cost"      AS "last_unit_cost",
       pi."purchase_date" AS "last_purchase_date",
       count(*)        OVER (PARTITION BY pi."supplier_id", l."product_id") AS "times_bought",
       sum(l."quantity") OVER (PARTITION BY pi."supplier_id", l."product_id") AS "total_quantity"
  FROM "purchase_invoice_line" l
  JOIN "purchase_invoice" pi ON pi."id" = l."purchase_invoice_id"
 ORDER BY pi."supplier_id", l."product_id", pi."purchase_date" DESC, pi."id" DESC, l."id" DESC;

-- Un producto con todo lo que se usa para filtrarlo y ordenarlo.
CREATE VIEW "v_product_overview" AS
SELECT p."id"                  AS "product_id",
       p."product_category_id",
       p."product_brand_id",
       p."quality_tier",
       p."list_price",
       p."stock",
       m."last_cost",
       m."margin_pct",
       s."last_sold_at",
       coalesce(s."sold_90d", 0)::int AS "sold_90d",
       coalesce(sp."supplier_ids", '{}') AS "supplier_ids"
  FROM "product" p
  JOIN "v_product_margin" m ON m."product_id" = p."id"
  LEFT JOIN LATERAL (
       SELECT max(mv."moved_at") AS "last_sold_at",
              sum(mv."quantity") FILTER (WHERE mv."moved_at" >= now() - interval '90 days') AS "sold_90d"
         FROM "inventory_movement" mv
        WHERE mv."product_id" = p."id" AND mv."movement_type" IN ('VENTA', 'USO_SERVICIO')) s ON true
  LEFT JOIN LATERAL (
       SELECT array_agg(DISTINCT x."supplier_id") AS "supplier_ids"
         FROM "v_supplier_product" x WHERE x."product_id" = p."id") sp ON true;

-- Un cliente con lo que se usa para filtrarlo: motos, deuda, crédito, última visita.
CREATE VIEW "v_customer_overview" AS
SELECT c."id"                                AS "customer_id",
       coalesce(mo."motorcycles", 0)::int    AS "motorcycles",
       coalesce(mo."brand_ids", '{}')        AS "motorcycle_brand_ids",
       coalesce(b."balance", 0)              AS "balance",
       coalesce(b."overdue", 0)              AS "overdue",
       b."max_days_overdue",
       b."oldest_due_date",
       EXISTS (SELECT 1 FROM "sale_invoice" si
                WHERE si."customer_id" = c."id" AND si."payment_terms" = 'CREDITO') AS "has_credit",
       greatest(
         (SELECT max(si."created_at") FROM "sale_invoice" si WHERE si."customer_id" = c."id"),
         (SELECT max(sc."changed_at") FROM "service_order_status_change" sc
            JOIN "service_order" so ON so."id" = sc."service_order_id"
            JOIN "motorcycle" m ON m."id" = so."motorcycle_id"
           WHERE m."customer_id" = c."id")) AS "last_visit_at"
  FROM "customer" c
  LEFT JOIN LATERAL (
       SELECT count(*) AS "motorcycles", array_agg(DISTINCT mm."motorcycle_brand_id") AS "brand_ids"
         FROM "motorcycle" m JOIN "motorcycle_model" mm ON mm."id" = m."motorcycle_model_id"
        WHERE m."customer_id" = c."id") mo ON true
  LEFT JOIN "v_customer_balance" b ON b."customer_id" = c."id";
