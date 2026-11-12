-- =====================================================================
--  Migración 8 — El mecánico "al 100 %" no se paga por el sistema
--   Regla del dueño: quien se queda con el 100 % de la mano de obra es
--   igual que un dueño: no tiene comisión ni aparece en «Pago a mecánicos».
--   Antes se podía registrar con tasa 1 (100 %) y el sistema le calculaba
--   comisión. Ahora "sin comisión" se guarda siempre como NULL y la tasa
--   de un mecánico pagado por el sistema queda entre 0 y 1 (sin incluir 1).
-- =====================================================================

-- Órdenes todavía sin pagar de un mecánico al 100 %: dejan de generar comisión.
-- (Las que ya se pagaron no se tocan: son historia.)
UPDATE "service_order"
   SET "applied_commission_rate" = NULL
 WHERE "applied_commission_rate" >= 1
   AND "staff_payout_id" IS NULL;

UPDATE "staff" SET "commission_rate" = NULL WHERE "commission_rate" >= 1;

ALTER TABLE "staff" DROP CONSTRAINT "ck_staff_commission_rate";
ALTER TABLE "staff"
  ADD CONSTRAINT "ck_staff_commission_rate" CHECK ("commission_rate" > 0 AND "commission_rate" < 1);
