-- =====================================================================
--  Migración 9b — Productos activos e inactivos
--   Un producto no se borra (tiene ventas, compras y kardex): se DESACTIVA.
--   Desactivado no aparece en Inventario, Caja ni Compras; se ve y se
--   vuelve a activar en Administración → Productos desactivados.
--
--   Nombres de las migraciones: Prisma las ordena como texto ("10" va antes
--   que "9"), por eso las nuevas siguen como 9a, 9b, 9c… hasta renombrar.
-- =====================================================================
ALTER TABLE "product" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

-- La búsqueda filtra por activos casi siempre.
CREATE INDEX "ix_product_active" ON "product" ("active");
