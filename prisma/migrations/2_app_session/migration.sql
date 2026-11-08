-- =====================================================================
--  Motor IRM — migración 2: sesiones de inicio de sesión (API-004)
--  Se guarda el hash SHA-256 del token, nunca el token: si alguien lee la
--  tabla, no puede usar las sesiones. Cerrar sesión = borrar la fila.
-- =====================================================================

CREATE TABLE "app_session" (
    "id"           SERIAL         NOT NULL,
    "app_user_id"  INTEGER        NOT NULL,
    "token_hash"   CHAR(64)       NOT NULL,
    "created_at"   TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    "expires_at"   TIMESTAMPTZ(0) NOT NULL,

    CONSTRAINT "pk_app_session" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uq_app_session_token_hash" ON "app_session"("token_hash");
CREATE INDEX "ix_app_session_app_user_id" ON "app_session"("app_user_id");

ALTER TABLE "app_session"
  ADD CONSTRAINT "fk_app_session_app_user_id" FOREIGN KEY ("app_user_id")
  REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "app_session"
  ADD CONSTRAINT "ck_app_session_expires_at" CHECK ("expires_at" > "created_at");
