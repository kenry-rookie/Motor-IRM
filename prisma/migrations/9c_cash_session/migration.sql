-- =====================================================================
--  Migración 9c — Apertura, cierre y arqueo de caja (una caja por día)
--   Cada día se ABRE la caja con el dinero con que se empieza (córdobas y
--   dólares) y al final se CIERRA contando el dinero real. El sistema calcula
--   cuánto DEBERÍA haber (apertura + cobros en efectivo − salidas de efectivo
--   del día) y guarda la diferencia (sobrante / faltante).
--
--   - Una sola caja por día de negocio (uq_cash_session_business_day).
--   - Una sola caja abierta a la vez (uq_cash_session_one_open): si ayer no se
--     cerró, hay que cerrarla antes de abrir la de hoy.
--   - Lo esperado y lo contado se guardan al cerrar (foto del momento): si
--     después se registra dinero de ese día, la pantalla lo avisa.
--   - Las demás tablas NO cambian: el arqueo solo LEE pagos, retiros,
--     adelantos, pagos a mecánicos y reembolsos.
-- =====================================================================
CREATE TABLE "cash_session" (
    "id"                SERIAL        NOT NULL,
    "business_day"      DATE          NOT NULL,
    "opened_at"         TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    "opened_by_user_id" INTEGER       NOT NULL,
    "opening_nio"       DECIMAL(12,2) NOT NULL DEFAULT 0,
    "opening_usd"       DECIMAL(12,2) NOT NULL DEFAULT 0,
    "opening_notes"     VARCHAR(200),
    "closed_at"         TIMESTAMPTZ(0),
    "closed_by_user_id" INTEGER,
    "expected_nio"      DECIMAL(12,2),
    "expected_usd"      DECIMAL(12,2),
    "counted_nio"       DECIMAL(12,2),
    "counted_usd"       DECIMAL(12,2),
    "closing_notes"     VARCHAR(200),

    CONSTRAINT "pk_cash_session" PRIMARY KEY ("id"),
    CONSTRAINT "fk_cash_session_opened_by_user_id" FOREIGN KEY ("opened_by_user_id")
        REFERENCES "app_user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fk_cash_session_closed_by_user_id" FOREIGN KEY ("closed_by_user_id")
        REFERENCES "app_user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ck_cash_session_opening" CHECK ("opening_nio" >= 0 AND "opening_usd" >= 0),
    CONSTRAINT "ck_cash_session_counted" CHECK (
        ("counted_nio" IS NULL OR "counted_nio" >= 0) AND ("counted_usd" IS NULL OR "counted_usd" >= 0)),
    -- Abierta: nada del cierre. Cerrada: todo el cierre.
    CONSTRAINT "ck_cash_session_closed_complete" CHECK (
        ("closed_at" IS NULL AND "closed_by_user_id" IS NULL AND "expected_nio" IS NULL
             AND "expected_usd" IS NULL AND "counted_nio" IS NULL AND "counted_usd" IS NULL)
     OR ("closed_at" IS NOT NULL AND "closed_by_user_id" IS NOT NULL AND "expected_nio" IS NOT NULL
             AND "expected_usd" IS NOT NULL AND "counted_nio" IS NOT NULL AND "counted_usd" IS NOT NULL)),
    CONSTRAINT "ck_cash_session_closed_after_opened" CHECK ("closed_at" IS NULL OR "closed_at" >= "opened_at")
);

CREATE UNIQUE INDEX "uq_cash_session_business_day" ON "cash_session" ("business_day");

-- Solo una caja abierta a la vez.
CREATE UNIQUE INDEX "uq_cash_session_one_open" ON "cash_session" ((true)) WHERE "closed_at" IS NULL;

-- Una caja no se borra (es el registro del arqueo, DEC-027).
CREATE FUNCTION "fn_cash_session_no_delete"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Una caja no se borra: queda como registro del arqueo.' USING ERRCODE = 'check_violation';
END $$;
CREATE TRIGGER "tg_cash_session_no_delete" BEFORE DELETE ON "cash_session"
  FOR EACH ROW EXECUTE FUNCTION "fn_cash_session_no_delete"();

-- Permiso nuevo: abrir y cerrar la caja. Lo reciben Dueño y Encargado.
INSERT INTO "permission" ("code", "description")
SELECT 'caja.arqueo', 'Abrir y cerrar la caja del día (arqueo)'
 WHERE NOT EXISTS (SELECT 1 FROM "permission" WHERE "code" = 'caja.arqueo');

INSERT INTO "role_permission" ("role_id", "permission_id")
SELECT r."id", p."id"
  FROM "role" r CROSS JOIN "permission" p
 WHERE p."code" = 'caja.arqueo'
   AND lower(r."name") IN ('dueño', 'encargado')
ON CONFLICT DO NOTHING;
