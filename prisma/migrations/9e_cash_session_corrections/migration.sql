-- =====================================================================
--  Migración 9e — Reabrir y corregir cajas (solo administradores)
--   - Permiso nuevo «caja.corregir»: reabrir la caja de hoy, corregir el
--     cierre de cualquier caja ya cerrada y eliminar la caja de hoy.
--     Lo reciben los perfiles que administran el sistema (admin.usuarios)
--     y el perfil «Dueño».
--   - Bitácora cash_session_change: cada reapertura, corrección o
--     eliminación guarda quién, cuándo, por qué y los valores antes/después.
--     Es de solo agregar: no se edita ni se borra.
--     Si se elimina la caja, la bitácora se conserva (cash_session_id = NULL)
--     y el día queda en business_day.
-- =====================================================================
CREATE TABLE "cash_session_change" (
    "id"                 SERIAL         NOT NULL,
    "cash_session_id"    INTEGER,
    "business_day"       DATE           NOT NULL,
    "action"             VARCHAR(20)    NOT NULL,
    "changed_at"         TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    "changed_by_user_id" INTEGER        NOT NULL,
    "reason"             VARCHAR(200)   NOT NULL,
    "before"             JSONB          NOT NULL,
    "after"              JSONB,

    CONSTRAINT "pk_cash_session_change" PRIMARY KEY ("id"),
    CONSTRAINT "fk_cash_session_change_cash_session_id" FOREIGN KEY ("cash_session_id")
        REFERENCES "cash_session" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "fk_cash_session_change_changed_by_user_id" FOREIGN KEY ("changed_by_user_id")
        REFERENCES "app_user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ck_cash_session_change_action" CHECK ("action" IN ('REAPERTURA', 'CORRECCION', 'ELIMINACION')),
    CONSTRAINT "ck_cash_session_change_reason" CHECK (length(btrim("reason")) >= 5)
);

CREATE INDEX "ix_cash_session_change_cash_session_id" ON "cash_session_change" ("cash_session_id");

-- Solo agregar: lo único que se permite es que el FK quede en NULL al eliminar la caja.
CREATE FUNCTION "fn_cash_session_change_append_only"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW."cash_session_id" IS NULL AND OLD."cash_session_id" IS NOT NULL
     AND NEW."id" = OLD."id" AND NEW."business_day" = OLD."business_day"
     AND NEW."action" = OLD."action" AND NEW."changed_at" = OLD."changed_at"
     AND NEW."changed_by_user_id" = OLD."changed_by_user_id" AND NEW."reason" = OLD."reason"
     AND NEW."before" = OLD."before" AND NEW."after" IS NOT DISTINCT FROM OLD."after" THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'La bitácora de caja no se modifica ni se borra.' USING ERRCODE = 'check_violation';
END $$;
CREATE TRIGGER "tg_cash_session_change_append_only" BEFORE UPDATE OR DELETE ON "cash_session_change"
  FOR EACH ROW EXECUTE FUNCTION "fn_cash_session_change_append_only"();

-- Permiso nuevo.
INSERT INTO "permission" ("code", "description")
SELECT 'caja.corregir', 'Reabrir, corregir y eliminar cajas (solo administradores)'
 WHERE NOT EXISTS (SELECT 1 FROM "permission" WHERE "code" = 'caja.corregir');

INSERT INTO "role_permission" ("role_id", "permission_id")
SELECT DISTINCT r."id", p."id"
  FROM "role" r
 CROSS JOIN "permission" p
 WHERE p."code" = 'caja.corregir'
   AND (lower(r."name") = 'dueño'
        OR EXISTS (SELECT 1 FROM "role_permission" rp JOIN "permission" pa ON pa."id" = rp."permission_id"
                    WHERE rp."role_id" = r."id" AND pa."code" = 'admin.usuarios'))
   AND NOT EXISTS (SELECT 1 FROM "role_permission" x WHERE x."role_id" = r."id" AND x."permission_id" = p."id");
