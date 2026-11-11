-- =====================================================================
--  Migración 9a — Una compra de CONTADO ya está pagada
--   Al registrar una compra de contado no se guardaba su pago, así que
--   aparecía como deuda con el proveedor (con botón «Pagar»). Desde ahora
--   la app registra el pago en la misma operación (purchasing.ts); aquí se
--   completan las compras de contado que ya existían: se paga el saldo que
--   les quede, con fecha del día de la compra.
-- =====================================================================
INSERT INTO "supplier_payment" ("supplier_id", "purchase_invoice_id", "paid_on", "amount", "currency")
SELECT b."supplier_id", b."purchase_invoice_id", b."purchase_date", b."balance", 'NIO'
  FROM "v_purchase_invoice_balance" b
 WHERE b."payment_terms" = 'CONTADO'
   AND b."balance" > 0;
