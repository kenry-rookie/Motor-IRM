-- =====================================================================
--  Migración 9 — El código de barras lleva solo números
--   Antes se aceptaba cualquier texto (hasta letras). Un código de barras
--   de producto es numérico: EAN-8, UPC-A (12), EAN-13 o GTIN-14, o sea
--   de 8 a 14 dígitos. Sigue siendo opcional (NULL = sin código).
--   La app aplica la misma regla (zOptBarcode en domain/constants.ts).
-- =====================================================================

-- Códigos que no cumplen (p. ej. con letras, de pruebas): se quitan para
-- que el producto quede "sin código" en vez de bloquear la migración.
UPDATE "product"
   SET "barcode" = NULL
 WHERE "barcode" IS NOT NULL
   AND "barcode" !~ '^[0-9]{8,14}$';

-- 0_init ya tenía un ck_product_barcode (solo "no vacío"): se reemplaza.
ALTER TABLE "product" DROP CONSTRAINT IF EXISTS "ck_product_barcode";
ALTER TABLE "product"
  ADD CONSTRAINT "ck_product_barcode" CHECK ("barcode" IS NULL OR "barcode" ~ '^[0-9]{8,14}$');
