-- =====================================================================
--  Migración 9f — Dinero que entra y sale, viajes de compra y catálogos
--  (revisión de Kenry, 23-nov-2026 · DEC-057 a DEC-061)
--
--   1. Catálogos con «activo»: marcas y modelos de moto, categorías y
--      marcas de producto, categorías de trabajos. Desactivado = no sale en
--      las listas; se ve con «Ver desactivados» (DEC-061).
--   2. Devolución con reembolso: el dinero que se le devuelve al cliente
--      queda en la misma devolución (ya no es un «retiro de caja») y el
--      saldo de la factura lo descuenta (DEC-057).
--   3. Pagos a proveedores: de dónde salió el dinero (CAJA, FUERA_DE_CAJA,
--      VIAJE), cuándo y quién lo registró (DEC-058).
--   4. Viaje de compras: dinero que se llevó de la caja, facturas, gastos
--      del viaje y vuelto que regresó (DEC-059).
--   5. Retiros de caja: hora, anulación y bitácora de cambios (DEC-060).
--   6. v_money_movement: TODO el dinero que entra o sale, una fila por
--      motivo. El arqueo y la pantalla de Comprobantes leen de aquí (DEC-058).
--
--   Nada se borra y nada de lo anterior cambia de significado: las filas
--   viejas quedan con los valores por defecto (sin reembolso, pagos a
--   proveedor «fuera de caja», sin viaje).
-- =====================================================================

-- ---------------------------------------------------------------------
--  1. Catálogos con «activo» (DEC-061)
-- ---------------------------------------------------------------------
ALTER TABLE "motorcycle_brand" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "motorcycle_model" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "product_category" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "product_brand"    ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "service_category" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

-- ---------------------------------------------------------------------
--  2. Reembolso en la devolución del cliente (DEC-057)
-- ---------------------------------------------------------------------
ALTER TABLE "customer_return"
  ADD COLUMN "refund_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD CONSTRAINT "ck_customer_return_refund_amount" CHECK ("refund_amount" >= 0);

-- El saldo descuenta lo que ya se le devolvió en efectivo: si el cliente
-- pagó C$ 500, devolvió C$ 200 en producto y se le dieron C$ 200, debe 0.
--   balance = total − devuelto − (pagado − reembolsado)
-- La columna nueva «refunded» va al final (CREATE OR REPLACE solo agrega al final).
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
            ELSE t."total" - r."returned" - p."paid" + rf."refunded" END AS "balance",
       CASE WHEN v."sale_invoice_id" IS NULL
             AND t."total" - r."returned" - p."paid" + rf."refunded" > 0
             AND coalesce(si."extended_due_date", si."due_date") < CURRENT_DATE
            THEN CURRENT_DATE - coalesce(si."extended_due_date", si."due_date") END AS "days_overdue",
       v."sale_invoice_id" IS NOT NULL                  AS "voided",
       rf."refunded"
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
        WHERE a."sale_invoice_id" = si."id") p
 CROSS JOIN LATERAL (
       SELECT coalesce(sum(cr."refund_amount"), 0) AS "refunded"
         FROM "customer_return" cr
        WHERE cr."sale_invoice_id" = si."id") rf;

-- ---------------------------------------------------------------------
--  3. Viaje de compras (DEC-059)
-- ---------------------------------------------------------------------
CREATE TABLE "trip_expense_type" (
    "id"     SERIAL      NOT NULL,
    "name"   VARCHAR(50) NOT NULL,
    "active" BOOLEAN     NOT NULL DEFAULT true,
    CONSTRAINT "pk_trip_expense_type" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_trip_expense_type_name" ON "trip_expense_type" (lower("name"));

INSERT INTO "trip_expense_type" ("name") VALUES
  ('Pasaje / transporte'),
  ('Combustible'),
  ('Comida'),
  ('Flete o encomienda'),
  ('Hospedaje'),
  ('Parqueo / peaje'),
  ('Otro');

CREATE TABLE "purchase_trip" (
    "id"                 SERIAL         NOT NULL,
    "trip_date"          DATE           NOT NULL DEFAULT CURRENT_DATE,
    "destination"        VARCHAR(80)    NOT NULL DEFAULT 'Managua',
    "traveler"           VARCHAR(100),
    -- Dinero que se sacó de la gaveta para el viaje (C$). Sale de la caja el día de taken_at.
    "cash_taken"         DECIMAL(12,2)  NOT NULL DEFAULT 0,
    "taken_at"           TIMESTAMPTZ(0),
    -- Dinero que no salió de la caja (del dueño, del banco): solo informativo.
    "other_funds"        DECIMAL(12,2)  NOT NULL DEFAULT 0,
    "notes"              VARCHAR(200),
    "status"             VARCHAR(20)    NOT NULL DEFAULT 'ABIERTO',
    "created_at"         TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    "created_by_user_id" INTEGER        NOT NULL,
    -- Al cerrar: vuelto que regresó a la gaveta (entra a la caja el día de closed_at).
    "cash_returned"      DECIMAL(12,2),
    "closed_at"          TIMESTAMPTZ(0),
    "closed_by_user_id"  INTEGER,
    "closing_notes"      VARCHAR(200),

    CONSTRAINT "pk_purchase_trip" PRIMARY KEY ("id"),
    CONSTRAINT "fk_purchase_trip_created_by_user_id" FOREIGN KEY ("created_by_user_id")
        REFERENCES "app_user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fk_purchase_trip_closed_by_user_id" FOREIGN KEY ("closed_by_user_id")
        REFERENCES "app_user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ck_purchase_trip_status" CHECK ("status" IN ('ABIERTO', 'CERRADO')),
    CONSTRAINT "ck_purchase_trip_amounts" CHECK (
        "cash_taken" >= 0 AND "other_funds" >= 0 AND ("cash_returned" IS NULL OR "cash_returned" >= 0)),
    -- Si salió dinero de la caja, se sabe cuándo; si no, no hay hora.
    CONSTRAINT "ck_purchase_trip_taken_at" CHECK (("cash_taken" > 0) = ("taken_at" IS NOT NULL)),
    -- Abierto: nada del cierre. Cerrado: todo el cierre.
    CONSTRAINT "ck_purchase_trip_closed_complete" CHECK (
        ("status" = 'ABIERTO' AND "cash_returned" IS NULL AND "closed_at" IS NULL AND "closed_by_user_id" IS NULL)
     OR ("status" = 'CERRADO' AND "cash_returned" IS NOT NULL AND "closed_at" IS NOT NULL AND "closed_by_user_id" IS NOT NULL))
);
CREATE INDEX "ix_purchase_trip_trip_date" ON "purchase_trip" ("trip_date");

CREATE TABLE "purchase_trip_expense" (
    "id"                   SERIAL         NOT NULL,
    "purchase_trip_id"     INTEGER        NOT NULL,
    "trip_expense_type_id" INTEGER        NOT NULL,
    "amount"               DECIMAL(12,2)  NOT NULL,
    "description"          VARCHAR(200),
    "created_at"           TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    "created_by_user_id"   INTEGER        NOT NULL,

    CONSTRAINT "pk_purchase_trip_expense" PRIMARY KEY ("id"),
    CONSTRAINT "fk_purchase_trip_expense_purchase_trip_id" FOREIGN KEY ("purchase_trip_id")
        REFERENCES "purchase_trip" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fk_purchase_trip_expense_trip_expense_type_id" FOREIGN KEY ("trip_expense_type_id")
        REFERENCES "trip_expense_type" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fk_purchase_trip_expense_created_by_user_id" FOREIGN KEY ("created_by_user_id")
        REFERENCES "app_user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ck_purchase_trip_expense_amount" CHECK ("amount" > 0)
);
CREATE INDEX "ix_purchase_trip_expense_purchase_trip_id" ON "purchase_trip_expense" ("purchase_trip_id");

-- La factura de compra puede ser parte de un viaje, y lleva una nota y la hora en que se registró.
ALTER TABLE "purchase_invoice"
  ADD COLUMN "purchase_trip_id" INTEGER,
  ADD COLUMN "notes"            VARCHAR(200),
  ADD COLUMN "created_at"       TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  ADD CONSTRAINT "fk_purchase_invoice_purchase_trip_id" FOREIGN KEY ("purchase_trip_id")
      REFERENCES "purchase_trip" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "ix_purchase_invoice_purchase_trip_id" ON "purchase_invoice" ("purchase_trip_id");

-- Un viaje cerrado ya no recibe facturas ni gastos (lo mismo valida la API, con mensaje).
CREATE FUNCTION "fn_purchase_trip_open_check"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."purchase_trip_id" IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW."purchase_trip_id" IS DISTINCT FROM OLD."purchase_trip_id")
     AND EXISTS (SELECT 1 FROM "purchase_trip" t WHERE t."id" = NEW."purchase_trip_id" AND t."status" <> 'ABIERTO') THEN
    RAISE EXCEPTION 'El viaje de compras ya está cerrado: no se le agregan facturas ni gastos.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "tg_purchase_invoice_trip_open" BEFORE INSERT OR UPDATE OF "purchase_trip_id" ON "purchase_invoice"
  FOR EACH ROW EXECUTE FUNCTION "fn_purchase_trip_open_check"();
CREATE TRIGGER "tg_purchase_trip_expense_trip_open" BEFORE INSERT OR UPDATE ON "purchase_trip_expense"
  FOR EACH ROW EXECUTE FUNCTION "fn_purchase_trip_open_check"();

-- ---------------------------------------------------------------------
--  4. Pagos a proveedores: de dónde salió el dinero (DEC-058)
-- ---------------------------------------------------------------------
--   CAJA          efectivo de la gaveta: el arqueo lo resta (pide caja abierta).
--   FUERA_DE_CAJA transferencia, dinero del dueño…: no toca la gaveta.
--   VIAJE         con el dinero del viaje de compras: la gaveta ya lo soltó
--                 como «dinero llevado al viaje».
-- Los pagos que ya existían quedan FUERA_DE_CAJA: el arqueo nunca los contó.
ALTER TABLE "supplier_payment"
  ADD COLUMN "source"                VARCHAR(20)    NOT NULL DEFAULT 'FUERA_DE_CAJA',
  ADD COLUMN "paid_at"               TIMESTAMPTZ(0),
  ADD COLUMN "registered_by_user_id" INTEGER,
  ADD COLUMN "notes"                 VARCHAR(200),
  ADD COLUMN "purchase_trip_id"      INTEGER,
  ADD CONSTRAINT "fk_supplier_payment_registered_by_user_id" FOREIGN KEY ("registered_by_user_id")
      REFERENCES "app_user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "fk_supplier_payment_purchase_trip_id" FOREIGN KEY ("purchase_trip_id")
      REFERENCES "purchase_trip" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ck_supplier_payment_source" CHECK ("source" IN ('CAJA', 'FUERA_DE_CAJA', 'VIAJE')),
  ADD CONSTRAINT "ck_supplier_payment_trip" CHECK (("source" = 'VIAJE') = ("purchase_trip_id" IS NOT NULL));

-- Los pagos viejos solo tenían el día: se toma el mediodía de ese día en Managua.
UPDATE "supplier_payment"
   SET "paid_at" = ("paid_on" + time '12:00') AT TIME ZONE 'America/Managua'
 WHERE "paid_at" IS NULL;
ALTER TABLE "supplier_payment"
  ALTER COLUMN "paid_at" SET DEFAULT CURRENT_TIMESTAMP(0),
  ALTER COLUMN "paid_at" SET NOT NULL;
CREATE INDEX "ix_supplier_payment_purchase_trip_id" ON "supplier_payment" ("purchase_trip_id");

-- ---------------------------------------------------------------------
--  5. Retiros de caja: hora, anulación y bitácora (DEC-060)
-- ---------------------------------------------------------------------
ALTER TABLE "cash_withdrawal"
  ADD COLUMN "created_at"        TIMESTAMPTZ(0),
  ADD COLUMN "voided_at"         TIMESTAMPTZ(0),
  ADD COLUMN "voided_by_user_id" INTEGER,
  ADD COLUMN "void_reason"       VARCHAR(200),
  ADD CONSTRAINT "fk_cash_withdrawal_voided_by_user_id" FOREIGN KEY ("voided_by_user_id")
      REFERENCES "app_user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  -- Anulado: se sabe cuándo, quién y por qué. No anulado: nada de eso.
  ADD CONSTRAINT "ck_cash_withdrawal_void_complete" CHECK (
        ("voided_at" IS NULL AND "voided_by_user_id" IS NULL AND "void_reason" IS NULL)
     OR ("voided_at" IS NOT NULL AND "voided_by_user_id" IS NOT NULL AND length(btrim("void_reason")) >= 5));

UPDATE "cash_withdrawal"
   SET "created_at" = ("withdrawn_on" + time '12:00') AT TIME ZONE 'America/Managua'
 WHERE "created_at" IS NULL;
ALTER TABLE "cash_withdrawal"
  ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP(0),
  ALTER COLUMN "created_at" SET NOT NULL;

CREATE TABLE "cash_withdrawal_change" (
    "id"                 SERIAL         NOT NULL,
    "cash_withdrawal_id" INTEGER        NOT NULL,
    "action"             VARCHAR(20)    NOT NULL,
    "changed_at"         TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    "changed_by_user_id" INTEGER        NOT NULL,
    "reason"             VARCHAR(200)   NOT NULL,
    "before"             JSONB          NOT NULL,
    "after"              JSONB          NOT NULL,

    CONSTRAINT "pk_cash_withdrawal_change" PRIMARY KEY ("id"),
    CONSTRAINT "fk_cash_withdrawal_change_cash_withdrawal_id" FOREIGN KEY ("cash_withdrawal_id")
        REFERENCES "cash_withdrawal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fk_cash_withdrawal_change_changed_by_user_id" FOREIGN KEY ("changed_by_user_id")
        REFERENCES "app_user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ck_cash_withdrawal_change_action" CHECK ("action" IN ('EDICION', 'ANULACION')),
    CONSTRAINT "ck_cash_withdrawal_change_reason" CHECK (length(btrim("reason")) >= 5)
);
CREATE INDEX "ix_cash_withdrawal_change_cash_withdrawal_id" ON "cash_withdrawal_change" ("cash_withdrawal_id");

CREATE FUNCTION "fn_cash_withdrawal_change_append_only"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La bitácora de retiros no se modifica ni se borra.' USING ERRCODE = 'check_violation';
END $$;
CREATE TRIGGER "tg_cash_withdrawal_change_append_only" BEFORE UPDATE OR DELETE ON "cash_withdrawal_change"
  FOR EACH ROW EXECUTE FUNCTION "fn_cash_withdrawal_change_append_only"();

-- Un retiro no se borra: se anula (queda en la lista y en la bitácora).
CREATE FUNCTION "fn_cash_withdrawal_no_delete"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Un retiro de caja no se borra: se anula con un motivo.' USING ERRCODE = 'check_violation';
END $$;
CREATE TRIGGER "tg_cash_withdrawal_no_delete" BEFORE DELETE ON "cash_withdrawal"
  FOR EACH ROW EXECUTE FUNCTION "fn_cash_withdrawal_no_delete"();

-- El viaje a Managua ya no es un retiro: es un «Viaje de compras» (DEC-059).
-- Los retiros viejos con ese motivo se conservan; el motivo deja de ofrecerse.
UPDATE "cash_withdrawal_reason" SET "active" = false WHERE lower("name") LIKE 'viaje a managua%';
INSERT INTO "cash_withdrawal_reason" ("name")
SELECT x.n FROM (VALUES ('Pago de servicios (luz, agua, internet)'), ('Otro')) x(n)
 WHERE NOT EXISTS (SELECT 1 FROM "cash_withdrawal_reason" r WHERE lower(r."name") = lower(x.n));

-- ---------------------------------------------------------------------
--  6. v_money_movement — todo el dinero que entra o sale (DEC-058)
-- ---------------------------------------------------------------------
--   Una fila por motivo. Un cobro que se repartió entre una venta y un
--   abono son dos filas (COBRO_VENTA y ABONO_CLIENTE): así el arqueo dice
--   de dónde vino cada córdoba. Un cobro en dólares se reparte en dólares
--   con redondeo acumulado, para que las partes sumen exactamente el cobro.
--
--   in_drawer = true  → efectivo de la gaveta: entra al arqueo.
--   in_drawer = false → transferencia, tarjeta, dinero del viaje o del dueño:
--                       se ve en Comprobantes, no en el arqueo.
--   amount va en la moneda del movimiento (currency); amount_nio en córdobas.
--   business_day es el día en Managua (DEC-038).
CREATE VIEW "v_money_movement" AS
WITH pay AS (
    SELECT cp."id", cp."paid_at", cp."amount", cp."currency", cp."exchange_rate",
           cp."received_by_user_id", pm."name" AS "method",
           lower(pm."name") = 'efectivo' AS "is_cash",
           CASE WHEN cp."currency" = 'USD' THEN round(cp."amount" * cp."exchange_rate", 2) ELSE cp."amount" END AS "pay_nio"
      FROM "customer_payment" cp
      JOIN "payment_method" pm ON pm."id" = cp."payment_method_id"
),
alloc AS (
    SELECT a."id", a."customer_payment_id", a."amount",
           CASE WHEN a."customer_opening_balance_id" IS NOT NULL THEN 'ABONO_CLIENTE'
                WHEN si."payment_terms" = 'CREDITO'             THEN 'ABONO_CLIENTE'
                WHEN si."service_order_id" IS NOT NULL          THEN 'COBRO_TALLER'
                ELSE 'COBRO_VENTA' END AS "kind",
           coalesce(si."customer_id", ob."customer_id") AS "customer_id",
           a."sale_invoice_id", a."customer_opening_balance_id",
           sum(a."amount") OVER (PARTITION BY a."customer_payment_id" ORDER BY a."id") AS "cum",
           sum(a."amount") OVER (PARTITION BY a."customer_payment_id")                AS "total_alloc"
      FROM "customer_payment_allocation" a
      LEFT JOIN "sale_invoice" si ON si."id" = a."sale_invoice_id"
      LEFT JOIN "customer_opening_balance" ob ON ob."id" = a."customer_opening_balance_id"
),
alloc_share AS (
    -- base: si lo que no se repartió es menos de un centavo de la moneda del cobro,
    -- todo el cobro es de las deudas (evita una fila «sin repartir» de 0.01).
    SELECT al."id" AS "alloc_id", al."customer_payment_id", al."kind", al."customer_id",
           al."sale_invoice_id", al."amount" AS "alloc_amount", al."cum", al."total_alloc",
           p."paid_at", p."amount" AS "pay_amount", p."currency", p."is_cash", p."method",
           p."received_by_user_id", p."pay_nio",
           CASE WHEN p."pay_nio" - al."total_alloc" < coalesce(p."exchange_rate", 1) * 0.01
                THEN al."total_alloc" ELSE p."pay_nio" END AS "base"
      FROM alloc al JOIN pay p ON p."id" = al."customer_payment_id"
),
payout AS (
    SELECT sp."id", sp."staff_id", sp."paid_on", sp."paid_by_user_id",
           greatest(
             (SELECT coalesce(sum(round(lab."labor" * so."applied_commission_rate", 2)), 0)
                FROM "service_order" so
               CROSS JOIN LATERAL (
                     SELECT coalesce(sum(l."quantity" * l."unit_price" - l."discount_amount"), 0) AS "labor"
                       FROM "sale_invoice" si JOIN "sale_invoice_line" l ON l."sale_invoice_id" = si."id"
                      WHERE si."service_order_id" = so."id" AND l."line_type" = 'MANO_OBRA') lab
               WHERE so."staff_payout_id" = sp."id" AND so."applied_commission_rate" IS NOT NULL)
           - (SELECT coalesce(sum(a."amount"), 0) FROM "staff_advance" a WHERE a."staff_payout_id" = sp."id"),
           0) AS "net"
      FROM "staff_payout" sp
     WHERE sp."paid_on" IS NOT NULL
)
-- Cobros a clientes, por motivo (venta, taller, abono)
SELECT (s."paid_at" AT TIME ZONE 'America/Managua')::date AS "business_day",
       s."paid_at"                                       AS "occurred_at",
       s."kind",
       'ENTRADA'                                         AS "direction",
       s."is_cash"                                       AS "in_drawer",
       s."method",
       s."currency",
       -- Redondeo acumulado: las partes suman exactamente lo cobrado.
       round(s."pay_amount" * s."cum" / s."base", 2)
         - round(s."pay_amount" * (s."cum" - s."alloc_amount") / s."base", 2) AS "amount",
       s."alloc_amount"                                  AS "amount_nio",
       'customer_payment'                                AS "ref_table",
       s."customer_payment_id"                           AS "ref_id",
       s."sale_invoice_id",
       s."customer_id",
       NULL::int                                         AS "supplier_id",
       CASE WHEN s."sale_invoice_id" IS NOT NULL THEN 'Factura ' || s."sale_invoice_id" ELSE 'Saldo anterior' END AS "detail",
       s."received_by_user_id"                           AS "user_id"
  FROM alloc_share s
UNION ALL
-- Parte de un cobro que no se repartió a ninguna deuda (no debería pasar; se muestra si pasa)
SELECT (p."paid_at" AT TIME ZONE 'America/Managua')::date, p."paid_at", 'COBRO_SIN_REPARTIR', 'ENTRADA', p."is_cash",
       p."method", p."currency",
       p."amount" - coalesce(round(p."amount" * t."total_alloc" / nullif(t."base", 0), 2), 0),
       p."pay_nio" - coalesce(t."total_alloc", 0),
       'customer_payment', p."id", NULL::int, NULL::int, NULL::int, 'Cobro sin repartir', p."received_by_user_id"
  FROM pay p
  LEFT JOIN (SELECT DISTINCT "customer_payment_id", "total_alloc", "base" FROM alloc_share) t
         ON t."customer_payment_id" = p."id"
 WHERE p."amount" - coalesce(round(p."amount" * t."total_alloc" / nullif(t."base", 0), 2), 0) > 0
UNION ALL
-- Vuelto del viaje de compras que regresó a la gaveta
SELECT (t."closed_at" AT TIME ZONE 'America/Managua')::date, t."closed_at", 'VUELTO_VIAJE', 'ENTRADA', true,
       'Efectivo', 'NIO', t."cash_returned", t."cash_returned",
       'purchase_trip', t."id", NULL, NULL, NULL, 'Viaje a ' || t."destination", t."closed_by_user_id"
  FROM "purchase_trip" t
 WHERE t."status" = 'CERRADO' AND t."cash_returned" > 0
UNION ALL
-- Dinero que se llevó al viaje de compras
SELECT (t."taken_at" AT TIME ZONE 'America/Managua')::date, t."taken_at", 'DINERO_VIAJE', 'SALIDA', true,
       'Efectivo', 'NIO', t."cash_taken", t."cash_taken",
       'purchase_trip', t."id", NULL, NULL, NULL, 'Viaje a ' || t."destination", t."created_by_user_id"
  FROM "purchase_trip" t
 WHERE t."cash_taken" > 0
UNION ALL
-- Gastos del viaje (con el dinero del viaje: no tocan la gaveta)
SELECT t."trip_date", e."created_at", 'GASTO_VIAJE', 'SALIDA', false,
       'Dinero del viaje', 'NIO', e."amount", e."amount",
       'purchase_trip_expense', e."id", NULL, NULL, NULL,
       et."name" || coalesce(' · ' || e."description", ''), e."created_by_user_id"
  FROM "purchase_trip_expense" e
  JOIN "purchase_trip" t ON t."id" = e."purchase_trip_id"
  JOIN "trip_expense_type" et ON et."id" = e."trip_expense_type_id"
UNION ALL
-- Retiros de caja (los anulados no cuentan)
SELECT w."withdrawn_on", w."created_at", 'RETIRO', 'SALIDA', true,
       'Efectivo', 'NIO', w."amount", w."amount",
       'cash_withdrawal', w."id", NULL, NULL, NULL,
       r."name" || coalesce(' · ' || w."description", ''), w."withdrawn_by_user_id"
  FROM "cash_withdrawal" w
  JOIN "cash_withdrawal_reason" r ON r."id" = w."cash_withdrawal_reason_id"
 WHERE w."voided_at" IS NULL
UNION ALL
-- Adelantos a mecánicos
SELECT a."given_on", NULL::timestamptz, 'ADELANTO_MECANICO', 'SALIDA', true,
       'Efectivo', 'NIO', a."amount", a."amount",
       'staff_advance', a."id", NULL, NULL, NULL, st."name", a."given_by_user_id"
  FROM "staff_advance" a JOIN "staff" st ON st."id" = a."staff_id"
UNION ALL
-- Pago del periodo a mecánicos (comisiones − adelantos)
SELECT p."paid_on", NULL::timestamptz, 'PAGO_MECANICO', 'SALIDA', true,
       'Efectivo', 'NIO', p."net", p."net",
       'staff_payout', p."id", NULL, NULL, NULL, st."name", p."paid_by_user_id"
  FROM payout p JOIN "staff" st ON st."id" = p."staff_id"
 WHERE p."net" > 0
UNION ALL
-- Reembolso al anular una factura
SELECT (v."voided_at" AT TIME ZONE 'America/Managua')::date, v."voided_at", 'REEMBOLSO_ANULACION', 'SALIDA', true,
       'Efectivo', 'NIO', v."refund_amount", v."refund_amount",
       'sale_invoice_void', v."sale_invoice_id", v."sale_invoice_id", si."customer_id", NULL,
       'Factura ' || v."sale_invoice_id", v."voided_by_user_id"
  FROM "sale_invoice_void" v JOIN "sale_invoice" si ON si."id" = v."sale_invoice_id"
 WHERE v."refund_amount" > 0
UNION ALL
-- Reembolso de una devolución de productos
SELECT (cr."returned_at" AT TIME ZONE 'America/Managua')::date, cr."returned_at", 'REEMBOLSO_DEVOLUCION', 'SALIDA', true,
       'Efectivo', 'NIO', cr."refund_amount", cr."refund_amount",
       'customer_return', cr."id", cr."sale_invoice_id", si."customer_id", NULL,
       'Factura ' || cr."sale_invoice_id", cr."registered_by_user_id"
  FROM "customer_return" cr JOIN "sale_invoice" si ON si."id" = cr."sale_invoice_id"
 WHERE cr."refund_amount" > 0
UNION ALL
-- Reembolso de garantía
SELECT w."claimed_on", NULL::timestamptz, 'REEMBOLSO_GARANTIA', 'SALIDA', true,
       'Efectivo', 'NIO', w."refund_amount", w."refund_amount",
       'warranty_claim', w."id", NULL, NULL, NULL, 'Orden ' || w."original_service_order_id", w."attended_by_user_id"
  FROM "warranty_claim" w
 WHERE w."outcome" = 'REEMBOLSO' AND w."refund_amount" > 0
UNION ALL
-- Pagos a proveedores (solo los de CAJA tocan la gaveta)
SELECT (sp."paid_at" AT TIME ZONE 'America/Managua')::date, sp."paid_at", 'PAGO_PROVEEDOR', 'SALIDA',
       sp."source" = 'CAJA',
       CASE sp."source" WHEN 'CAJA' THEN 'Efectivo' WHEN 'VIAJE' THEN 'Dinero del viaje' ELSE 'Fuera de caja' END,
       sp."currency", sp."amount",
       CASE WHEN sp."currency" = 'USD' THEN round(sp."amount" * sp."exchange_rate", 2) ELSE sp."amount" END,
       'supplier_payment', sp."id", NULL, NULL, sp."supplier_id",
       s."name" || CASE WHEN pi."invoice_number" IS NOT NULL THEN ' · factura ' || pi."invoice_number" ELSE ' · saldo anterior' END,
       sp."registered_by_user_id"
  FROM "supplier_payment" sp
  JOIN "supplier" s ON s."id" = sp."supplier_id"
  LEFT JOIN "purchase_invoice" pi ON pi."id" = sp."purchase_invoice_id";

-- Resumen de cada viaje: lo llevado, lo comprado, lo gastado y lo que debe regresar.
CREATE VIEW "v_purchase_trip_summary" AS
SELECT t."id" AS "purchase_trip_id",
       t."cash_taken",
       t."other_funds",
       coalesce(inv."invoices", 0)::int       AS "invoices",
       coalesce(inv."total", 0)              AS "purchases_total",
       coalesce(inv."cash_total", 0)         AS "purchases_cash",
       coalesce(inv."credit_total", 0)       AS "purchases_credit",
       coalesce(pp."paid_from_trip", 0)      AS "paid_from_trip",
       coalesce(ex."expenses", 0)            AS "expenses",
       coalesce(ex."expense_lines", 0)::int  AS "expense_lines",
       -- Lo que debería regresar a la caja: lo llevado − lo pagado con el viaje − gastos.
       t."cash_taken" + t."other_funds" - coalesce(pp."paid_from_trip", 0) - coalesce(ex."expenses", 0) AS "expected_back",
       t."cash_returned",
       CASE WHEN t."status" = 'CERRADO'
            THEN t."cash_returned" - (t."cash_taken" + t."other_funds" - coalesce(pp."paid_from_trip", 0) - coalesce(ex."expenses", 0))
       END AS "difference"
  FROM "purchase_trip" t
  LEFT JOIN LATERAL (
       SELECT count(*) AS "invoices",
              sum(b."total") AS "total",
              sum(b."total") FILTER (WHERE b."payment_terms" = 'CONTADO') AS "cash_total",
              sum(b."total") FILTER (WHERE b."payment_terms" = 'CREDITO') AS "credit_total"
         FROM "purchase_invoice" pi JOIN "v_purchase_invoice_balance" b ON b."purchase_invoice_id" = pi."id"
        WHERE pi."purchase_trip_id" = t."id") inv ON true
  LEFT JOIN LATERAL (
       SELECT sum(CASE WHEN sp."currency" = 'USD' THEN round(sp."amount" * sp."exchange_rate", 2) ELSE sp."amount" END) AS "paid_from_trip"
         FROM "supplier_payment" sp WHERE sp."purchase_trip_id" = t."id") pp ON true
  LEFT JOIN LATERAL (
       SELECT sum(e."amount") AS "expenses", count(*) AS "expense_lines"
         FROM "purchase_trip_expense" e WHERE e."purchase_trip_id" = t."id") ex ON true;
