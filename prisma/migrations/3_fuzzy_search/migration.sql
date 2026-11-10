-- =====================================================================
--  Motor IRM — migración 3: búsqueda tolerante a errores de escritura
--
--  pg_trgm compara textos por trigramas (grupos de 3 letras): "bujia",
--  "bujía" y "bugia" comparten la mayoría y salen como parecidos.
--  unaccent quita tildes para que "bujia" encuentre "Bujía".
--  Las extensiones vienen con PostgreSQL (contrib); no se instala nada.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent() no es IMMUTABLE (depende de un diccionario configurable), así que
-- no se puede usar en un índice. Esta envoltura fija el diccionario y sí lo es.
CREATE FUNCTION "mirm_norm"(text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS
$$ SELECT lower(public.unaccent('public.unaccent'::regdictionary, $1)) $$;

-- Índices de trigramas: aceleran LIKE '%…%' y la similitud.
CREATE INDEX "ix_product_name_trgm"  ON "product"  USING gin ("mirm_norm"("name") gin_trgm_ops);
CREATE INDEX "ix_customer_name_trgm" ON "customer" USING gin ("mirm_norm"("name") gin_trgm_ops);
