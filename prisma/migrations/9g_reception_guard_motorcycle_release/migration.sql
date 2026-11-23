-- =====================================================================
--  Migración 9g — Revisión de Kenry (23-nov-2026) · DEC-063 y DEC-064
--
--   1. Una moto que ya está en el taller no se recibe otra vez (DEC-063).
--      Antes se podía «Recibir moto» con la misma moto mientras su orden
--      seguía abierta (Recibida, En proceso, Terminada…): quedaban dos
--      órdenes abiertas de la misma moto. Ahora la base lo impide con un
--      trigger: el estado vive en otra tabla (historial), así que un
--      índice único parcial no alcanza.
--
--   2. Motos que ya no son del cliente (DEC-064). Si el cliente vende su
--      moto, la moto se «suelta»: deja de salir en sus listas y en la
--      recepción, pero su historial (órdenes, facturas) se queda con él,
--      porque esos trabajos sí fueron suyos. La placa y el chasis quedan
--      libres para registrar la moto con el dueño nuevo.
--      Una moto que nunca entró al taller se puede eliminar del todo.
--
--   Nada se borra y nada de lo anterior cambia de significado.
-- =====================================================================


-- ---------------------------------------------------------------------
--  2. Moto soltada (va primero: el trigger de la parte 1 la usa)
-- ---------------------------------------------------------------------
ALTER TABLE "motorcycle"
  ADD COLUMN "released_at"   TIMESTAMPTZ(0),
  ADD COLUMN "released_note" VARCHAR(200);

-- La placa y el chasis son únicos solo entre las motos que todavía son
-- de alguien: la moto vendida libera su placa para el dueño nuevo.
DROP INDEX "uq_motorcycle_plate";
CREATE UNIQUE INDEX "uq_motorcycle_plate" ON "motorcycle" (upper("plate")) WHERE "released_at" IS NULL;
DROP INDEX "uq_motorcycle_chassis_number";
CREATE UNIQUE INDEX "uq_motorcycle_chassis_number" ON "motorcycle" (upper("chassis_number")) WHERE "released_at" IS NULL;


-- ---------------------------------------------------------------------
--  1. Una sola orden abierta por moto
--     Abierta = su último estado no es ENTREGADA ni CANCELADA
--     (igual que v_service_order_status).
--     El FOR UPDATE sobre la moto pone en fila dos recepciones de la misma
--     moto hechas al mismo tiempo desde dos pestañas.
-- ---------------------------------------------------------------------
CREATE FUNCTION "fn_service_order_one_open_per_motorcycle"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_released timestamptz;
    v_open     integer;
BEGIN
    SELECT m."released_at" INTO v_released
      FROM "motorcycle" m
     WHERE m."id" = NEW."motorcycle_id"
       FOR UPDATE;

    IF v_released IS NOT NULL THEN
        RAISE EXCEPTION 'La moto % ya no es de ese cliente: regístrela con su dueño nuevo', NEW."motorcycle_id"
            USING ERRCODE = 'check_violation', CONSTRAINT = 'tg_service_order_motorcycle_released';
    END IF;

    SELECT so."id" INTO v_open
      FROM "service_order" so
     WHERE so."motorcycle_id" = NEW."motorcycle_id"
       AND so."id" IS DISTINCT FROM NEW."id"
       AND coalesce((SELECT sc."status"
                       FROM "service_order_status_change" sc
                      WHERE sc."service_order_id" = so."id"
                      ORDER BY sc."changed_at" DESC, sc."id" DESC
                      LIMIT 1), 'RECIBIDA') NOT IN ('ENTREGADA', 'CANCELADA')
     LIMIT 1;

    IF v_open IS NOT NULL THEN
        RAISE EXCEPTION 'Esa moto ya está en el taller (orden %): no se recibe dos veces', v_open
            USING ERRCODE = 'check_violation', CONSTRAINT = 'tg_service_order_one_open_per_motorcycle';
    END IF;
    RETURN NEW;
END
$$;

CREATE TRIGGER "tg_service_order_one_open_per_motorcycle"
BEFORE INSERT OR UPDATE OF "motorcycle_id" ON "service_order"
FOR EACH ROW EXECUTE FUNCTION "fn_service_order_one_open_per_motorcycle"();


-- ---------------------------------------------------------------------
--  3. v_customer_overview cuenta solo las motos que todavía son del cliente
--     (mismas columnas y en el mismo orden: CREATE OR REPLACE lo exige).
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW "v_customer_overview" AS
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
        WHERE m."customer_id" = c."id" AND m."released_at" IS NULL) mo ON true
  LEFT JOIN "v_customer_balance" b ON b."customer_id" = c."id";
