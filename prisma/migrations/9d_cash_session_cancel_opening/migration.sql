-- =====================================================================
--  Migración 9d — Cancelar una apertura de caja
--   Una caja ABIERTA por error se puede cancelar (borrar) si todavía no se
--   movió dinero ese día; la API lo revisa (cash.cancelOpening). Una caja
--   CERRADA sigue sin poder borrarse: es el registro del arqueo.
-- =====================================================================
CREATE OR REPLACE FUNCTION "fn_cash_session_no_delete"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."closed_at" IS NOT NULL THEN
    RAISE EXCEPTION 'Una caja cerrada no se borra: queda como registro del arqueo.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END $$;
