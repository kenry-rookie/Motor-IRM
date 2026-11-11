-- =====================================================================
--  Migración 6 — DEC-051 y DEC-052
--   1. El historial de estados de una orden respeta el fin del trabajo:
--      - después de ENTREGADA o CANCELADA no se agrega ningún estado;
--      - una orden TERMINADA o EN_PRUEBA ya no se puede cancelar.
--   2. Un producto no se vende con rebaja por debajo de su último costo.
--  Solo triggers: no cambia tablas ni datos guardados.
-- =====================================================================


-- ---------------------------------------------------------------------
--  1. Estados de la orden (DEC-051)
--     El estado actual es el último cambio (igual que v_service_order_status).
--     Mira OTRAS filas de la misma tabla: un CHECK no puede, va en trigger.
-- ---------------------------------------------------------------------
CREATE FUNCTION "fn_service_order_status_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_current varchar(20);
BEGIN
    SELECT sc."status" INTO v_current
      FROM "service_order_status_change" sc
     WHERE sc."service_order_id" = NEW."service_order_id"
     ORDER BY sc."changed_at" DESC, sc."id" DESC
     LIMIT 1;

    IF v_current IN ('ENTREGADA', 'CANCELADA') THEN
        RAISE EXCEPTION 'La orden % ya está cerrada (%): no cambia de estado', NEW."service_order_id", v_current
            USING ERRCODE = 'check_violation', CONSTRAINT = 'tg_service_order_status_closed';
    END IF;

    IF NEW."status" = 'CANCELADA' AND v_current IN ('TERMINADA', 'EN_PRUEBA') THEN
        RAISE EXCEPTION 'La orden % ya está terminada: no se puede cancelar', NEW."service_order_id"
            USING ERRCODE = 'check_violation', CONSTRAINT = 'tg_service_order_cancel_finished';
    END IF;
    RETURN NEW;
END
$$;

CREATE TRIGGER "tg_service_order_status_guard"
BEFORE INSERT ON "service_order_status_change"
FOR EACH ROW EXECUTE FUNCTION "fn_service_order_status_guard"();


-- ---------------------------------------------------------------------
--  2. Precio mínimo de venta (DEC-052)
--     Si una línea de PRODUCTO lleva rebaja (discount_amount > 0), lo que
--     se cobra por unidad no puede quedar por debajo del último costo
--     (DEC-024: la entrada de inventario más reciente). Sin rebaja, la
--     línea sale al precio de lista y no se revisa aquí.
-- ---------------------------------------------------------------------
CREATE FUNCTION "fn_sale_invoice_line_min_price"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_cost numeric(12, 2);
BEGIN
    IF NEW."line_type" <> 'PRODUCTO' OR NEW."discount_amount" <= 0 THEN
        RETURN NEW;
    END IF;

    SELECT m."unit_cost" INTO v_cost
      FROM "inventory_movement" m
     WHERE m."product_id" = NEW."product_id"
       AND m."movement_type" IN ('COMPRA', 'DEVOLUCION_CLIENTE', 'INVENTARIO_INICIAL', 'AJUSTE_ENTRADA')
     ORDER BY m."moved_at" DESC, m."id" DESC
     LIMIT 1;

    IF v_cost IS NOT NULL
       AND NEW."quantity" * NEW."unit_price" - NEW."discount_amount" < NEW."quantity" * v_cost THEN
        RAISE EXCEPTION 'El producto % no se puede rebajar por debajo de su costo', NEW."product_id"
            USING ERRCODE = 'check_violation', CONSTRAINT = 'tg_sale_invoice_line_min_price';
    END IF;
    RETURN NEW;
END
$$;

CREATE TRIGGER "tg_sale_invoice_line_min_price"
BEFORE INSERT OR UPDATE OF "quantity", "unit_price", "discount_amount", "product_id" ON "sale_invoice_line"
FOR EACH ROW EXECUTE FUNCTION "fn_sale_invoice_line_min_price"();
