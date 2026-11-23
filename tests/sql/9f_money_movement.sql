-- =====================================================================
--  Prueba SQL de la migración 9f (v_money_movement, devoluciones con
--  reembolso, viajes de compra). Corre dentro de una transacción y al
--  final hace ROLLBACK: no deja nada en la base.
--
--    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/sql/9f_money_movement.sql
--
--  Si una comprobación falla, se detiene con «FALLÓ: …».
--  Úsela en una base de PRUEBAS (motor_irm_test), no en la del negocio.
-- =====================================================================
BEGIN;

CREATE TEMP TABLE ids (k text PRIMARY KEY, v int);
CREATE FUNCTION pg_temp.id(text) RETURNS int LANGUAGE sql AS $$ SELECT v FROM ids WHERE k = $1 $$;
CREATE FUNCTION pg_temp.check_eq(label text, got numeric, want numeric) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN
    RAISE EXCEPTION 'FALLÓ: % — se obtuvo %, se esperaba %', label, got, want;
  END IF;
  RAISE NOTICE 'ok: % = %', label, got;
END $$;

-- ---- Datos mínimos ---------------------------------------------------
WITH r AS (INSERT INTO role (name) VALUES ('Prueba 9f') RETURNING id)
INSERT INTO ids SELECT 'role', id FROM r;
WITH s AS (INSERT INTO staff (name, phone, kind) VALUES ('Dueño prueba', '8888-1111', 'DUENO') RETURNING id)
INSERT INTO ids SELECT 'staff', id FROM s;
WITH u AS (INSERT INTO app_user (role_id, staff_id, username, password_hash)
           VALUES (pg_temp.id('role'), pg_temp.id('staff'), 'prueba9f', 'x') RETURNING id)
INSERT INTO ids SELECT 'user', id FROM u;
WITH m AS (INSERT INTO payment_method (name) VALUES ('Efectivo') RETURNING id) INSERT INTO ids SELECT 'cash', id FROM m;
WITH m AS (INSERT INTO payment_method (name) VALUES ('Transferencia') RETURNING id) INSERT INTO ids SELECT 'transfer', id FROM m;
WITH c AS (INSERT INTO customer (name, phone) VALUES ('Cliente prueba', '8888-2222') RETURNING id)
INSERT INTO ids SELECT 'customer', id FROM c;
WITH c AS (INSERT INTO product_category (name) VALUES ('Cat 9f') RETURNING id) INSERT INTO ids SELECT 'cat', id FROM c;
WITH b AS (INSERT INTO product_brand (name) VALUES ('Marca 9f') RETURNING id) INSERT INTO ids SELECT 'brand', id FROM b;
WITH p AS (INSERT INTO product (product_category_id, product_brand_id, name, quality_tier, list_price)
           VALUES (pg_temp.id('cat'), pg_temp.id('brand'), 'Producto 9f', 'MEDIA', 100) RETURNING id)
INSERT INTO ids SELECT 'product', id FROM p;
-- Inventario inicial: 20 unidades a C$ 60.
INSERT INTO inventory_movement (product_id, movement_type, quantity, unit_cost, registered_by_user_id)
VALUES (pg_temp.id('product'), 'INVENTARIO_INICIAL', 20, 60, pg_temp.id('user'));

-- Venta de contado (C$ 300) y venta al crédito (C$ 200).
WITH i AS (INSERT INTO sale_invoice (customer_id, created_by_user_id, payment_terms)
           VALUES (pg_temp.id('customer'), pg_temp.id('user'), 'CONTADO') RETURNING id)
INSERT INTO ids SELECT 'inv_cash', id FROM i;
WITH l AS (INSERT INTO sale_invoice_line (sale_invoice_id, line_no, line_type, product_id, quantity, unit_price)
           VALUES (pg_temp.id('inv_cash'), 1, 'PRODUCTO', pg_temp.id('product'), 3, 100) RETURNING id)
INSERT INTO ids SELECT 'line_cash', id FROM l;
WITH i AS (INSERT INTO sale_invoice (customer_id, created_by_user_id, payment_terms, due_date, credit_authorized_by_user_id)
           VALUES (pg_temp.id('customer'), pg_temp.id('user'), 'CREDITO', CURRENT_DATE + 30, pg_temp.id('user')) RETURNING id)
INSERT INTO ids SELECT 'inv_credit', id FROM i;
INSERT INTO sale_invoice_line (sale_invoice_id, line_no, line_type, product_id, quantity, unit_price)
VALUES (pg_temp.id('inv_credit'), 1, 'PRODUCTO', pg_temp.id('product'), 2, 100);

-- Cobro 1: C$ 300 en efectivo a la venta de contado.
WITH p AS (INSERT INTO customer_payment (amount, currency, payment_method_id, received_by_user_id)
           VALUES (300, 'NIO', pg_temp.id('cash'), pg_temp.id('user')) RETURNING id)
INSERT INTO ids SELECT 'pay1', id FROM p;
INSERT INTO customer_payment_allocation (customer_payment_id, sale_invoice_id, amount)
VALUES (pg_temp.id('pay1'), pg_temp.id('inv_cash'), 300);

-- Cobro 2: US$ 5.00 a 36.6243 = C$ 183.12, repartido: C$ 100 al crédito y C$ 83.12 a un saldo anterior.
WITH o AS (INSERT INTO customer_opening_balance (customer_id, as_of_date, amount, due_date, registered_by_user_id)
           VALUES (pg_temp.id('customer'), CURRENT_DATE - 10, 500, CURRENT_DATE + 20, pg_temp.id('user')) RETURNING id)
INSERT INTO ids SELECT 'opening', id FROM o;
WITH p AS (INSERT INTO customer_payment (amount, currency, exchange_rate, payment_method_id, received_by_user_id)
           VALUES (5, 'USD', 36.6243, pg_temp.id('cash'), pg_temp.id('user')) RETURNING id)
INSERT INTO ids SELECT 'pay2', id FROM p;
INSERT INTO customer_payment_allocation (customer_payment_id, sale_invoice_id, amount)
VALUES (pg_temp.id('pay2'), pg_temp.id('inv_credit'), 100);
INSERT INTO customer_payment_allocation (customer_payment_id, customer_opening_balance_id, amount)
VALUES (pg_temp.id('pay2'), pg_temp.id('opening'), 83.12);

-- Cobro 3: transferencia de C$ 50 al crédito (no entra a la gaveta).
WITH p AS (INSERT INTO customer_payment (amount, currency, payment_method_id, received_by_user_id)
           VALUES (50, 'NIO', pg_temp.id('transfer'), pg_temp.id('user')) RETURNING id)
INSERT INTO ids SELECT 'pay3', id FROM p;
INSERT INTO customer_payment_allocation (customer_payment_id, sale_invoice_id, amount)
VALUES (pg_temp.id('pay3'), pg_temp.id('inv_credit'), 50);

-- Devolución de 1 unidad de la venta de contado, con reembolso de C$ 100.
WITH rr AS (INSERT INTO return_reason (name) VALUES ('Defectuoso 9f') RETURNING id) INSERT INTO ids SELECT 'reason', id FROM rr;
WITH r AS (INSERT INTO customer_return (sale_invoice_id, return_reason_id, registered_by_user_id, refund_amount)
           VALUES (pg_temp.id('inv_cash'), pg_temp.id('reason'), pg_temp.id('user'), 100) RETURNING id)
INSERT INTO ids SELECT 'return', id FROM r;
INSERT INTO customer_return_line (customer_return_id, sale_invoice_id, line_no, sale_invoice_line_id, product_id, quantity)
VALUES (pg_temp.id('return'), pg_temp.id('inv_cash'), 1, pg_temp.id('line_cash'), pg_temp.id('product'), 1);

-- Retiro de caja C$ 70 y otro anulado C$ 999.
WITH r AS (INSERT INTO cash_withdrawal_reason (name) VALUES ('Gasto 9f') RETURNING id) INSERT INTO ids SELECT 'wreason', id FROM r;
INSERT INTO cash_withdrawal (withdrawn_by_user_id, cash_withdrawal_reason_id, amount)
VALUES (pg_temp.id('user'), pg_temp.id('wreason'), 70);
INSERT INTO cash_withdrawal (withdrawn_by_user_id, cash_withdrawal_reason_id, amount, voided_at, voided_by_user_id, void_reason)
VALUES (pg_temp.id('user'), pg_temp.id('wreason'), 999, now(), pg_temp.id('user'), 'Se registró dos veces');

-- Viaje: se llevan C$ 5 000 de la caja. Factura de contado C$ 3 000 (pagada con el viaje),
-- factura al crédito C$ 2 000, gastos C$ 400 + C$ 150. Regresan C$ 1 440 (faltan C$ 10).
WITH s AS (INSERT INTO supplier (name) VALUES ('Proveedor 9f') RETURNING id) INSERT INTO ids SELECT 'supplier', id FROM s;
WITH t AS (INSERT INTO purchase_trip (cash_taken, taken_at, created_by_user_id, traveler)
           VALUES (5000, now(), pg_temp.id('user'), 'Dueño') RETURNING id)
INSERT INTO ids SELECT 'trip', id FROM t;
WITH pi AS (INSERT INTO purchase_invoice (supplier_id, invoice_number, payment_terms, received_by_user_id, purchase_trip_id)
            VALUES (pg_temp.id('supplier'), 'A-1', 'CONTADO', pg_temp.id('user'), pg_temp.id('trip')) RETURNING id)
INSERT INTO ids SELECT 'pi_cash', id FROM pi;
INSERT INTO purchase_invoice_line (purchase_invoice_id, line_no, product_id, quantity, unit_cost)
VALUES (pg_temp.id('pi_cash'), 1, pg_temp.id('product'), 50, 60);
INSERT INTO supplier_payment (supplier_id, purchase_invoice_id, amount, source, purchase_trip_id, registered_by_user_id)
VALUES (pg_temp.id('supplier'), pg_temp.id('pi_cash'), 3000, 'VIAJE', pg_temp.id('trip'), pg_temp.id('user'));
WITH pi AS (INSERT INTO purchase_invoice (supplier_id, invoice_number, payment_terms, due_date, received_by_user_id, purchase_trip_id)
            VALUES (pg_temp.id('supplier'), 'A-2', 'CREDITO', CURRENT_DATE + 30, pg_temp.id('user'), pg_temp.id('trip')) RETURNING id)
INSERT INTO ids SELECT 'pi_credit', id FROM pi;
INSERT INTO purchase_invoice_line (purchase_invoice_id, line_no, product_id, quantity, unit_cost)
VALUES (pg_temp.id('pi_credit'), 1, pg_temp.id('product'), 40, 50);
INSERT INTO purchase_trip_expense (purchase_trip_id, trip_expense_type_id, amount, created_by_user_id)
SELECT pg_temp.id('trip'), id, 400, pg_temp.id('user') FROM trip_expense_type WHERE name = 'Pasaje / transporte';
INSERT INTO purchase_trip_expense (purchase_trip_id, trip_expense_type_id, amount, description, created_by_user_id)
SELECT pg_temp.id('trip'), id, 150, 'Almuerzo', pg_temp.id('user') FROM trip_expense_type WHERE name = 'Comida';

SELECT pg_temp.check_eq('viaje: debe regresar', expected_back, 1450) FROM v_purchase_trip_summary WHERE purchase_trip_id = pg_temp.id('trip');
SELECT pg_temp.check_eq('viaje: compras de contado', purchases_cash, 3000) FROM v_purchase_trip_summary WHERE purchase_trip_id = pg_temp.id('trip');
SELECT pg_temp.check_eq('viaje: compras al crédito', purchases_credit, 2000) FROM v_purchase_trip_summary WHERE purchase_trip_id = pg_temp.id('trip');

UPDATE purchase_trip SET status = 'CERRADO', cash_returned = 1440, closed_at = now(), closed_by_user_id = pg_temp.id('user')
 WHERE id = pg_temp.id('trip');
SELECT pg_temp.check_eq('viaje: diferencia al cerrar', difference, -10) FROM v_purchase_trip_summary WHERE purchase_trip_id = pg_temp.id('trip');

-- Un viaje cerrado no recibe más gastos.
DO $$
BEGIN
  INSERT INTO purchase_trip_expense (purchase_trip_id, trip_expense_type_id, amount, created_by_user_id)
  SELECT pg_temp.id('trip'), min(id), 10, pg_temp.id('user') FROM trip_expense_type;
  RAISE EXCEPTION 'FALLÓ: se agregó un gasto a un viaje cerrado';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: viaje cerrado rechaza gastos';
END $$;

-- Pago a proveedor desde la CAJA: C$ 500 al crédito.
INSERT INTO supplier_payment (supplier_id, purchase_invoice_id, amount, source, registered_by_user_id)
VALUES (pg_temp.id('supplier'), pg_temp.id('pi_credit'), 500, 'CAJA', pg_temp.id('user'));
-- VIAJE sin viaje: rechazado.
DO $$
BEGIN
  INSERT INTO supplier_payment (supplier_id, purchase_invoice_id, amount, source)
  VALUES (pg_temp.id('supplier'), pg_temp.id('pi_credit'), 1, 'VIAJE');
  RAISE EXCEPTION 'FALLÓ: pago VIAJE sin viaje';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: pago VIAJE exige viaje';
END $$;

-- ---- Comprobaciones del dinero de HOY ---------------------------------
-- Partes del cobro en dólares: suman exactamente US$ 5.00.
SELECT pg_temp.check_eq('cobro en dólares: partes suman el cobro', sum(amount), 5)
  FROM v_money_movement WHERE ref_table = 'customer_payment' AND ref_id = pg_temp.id('pay2');
SELECT pg_temp.check_eq('cobro en dólares: sin fila «sin repartir»', count(*), 0)
  FROM v_money_movement WHERE kind = 'COBRO_SIN_REPARTIR';

-- Entradas a la gaveta, por motivo.
SELECT pg_temp.check_eq('gaveta: ventas C$', coalesce(sum(amount) FILTER (WHERE kind = 'COBRO_VENTA' AND currency = 'NIO'), 0), 300),
       pg_temp.check_eq('gaveta: abonos US$', coalesce(sum(amount) FILTER (WHERE kind = 'ABONO_CLIENTE' AND currency = 'USD'), 0), 5),
       pg_temp.check_eq('gaveta: vuelto del viaje', coalesce(sum(amount) FILTER (WHERE kind = 'VUELTO_VIAJE'), 0), 1440)
  FROM v_money_movement WHERE in_drawer AND direction = 'ENTRADA' AND business_day = CURRENT_DATE;

-- La transferencia no entra a la gaveta, pero sí está en los comprobantes.
SELECT pg_temp.check_eq('transferencia fuera de la gaveta', count(*), 1)
  FROM v_money_movement WHERE ref_id = pg_temp.id('pay3') AND ref_table = 'customer_payment' AND NOT in_drawer;

-- Salidas de la gaveta: retiro 70 (el anulado no), reembolso 100, viaje 5000, proveedor 500.
SELECT pg_temp.check_eq('gaveta: total de salidas', sum(amount), 70 + 100 + 5000 + 500)
  FROM v_money_movement WHERE in_drawer AND direction = 'SALIDA' AND business_day = CURRENT_DATE;
-- Gastos y pago con dinero del viaje: fuera de la gaveta.
SELECT pg_temp.check_eq('viaje: gastos y pagos fuera de la gaveta', sum(amount), 400 + 150 + 3000)
  FROM v_money_movement WHERE NOT in_drawer AND direction = 'SALIDA';

-- Saldo de la factura de contado: total 300 − devuelto 100 − (pagado 300 − reembolsado 100) = 0.
SELECT pg_temp.check_eq('devolución con reembolso: saldo 0', balance, 0),
       pg_temp.check_eq('devolución con reembolso: reembolsado', refunded, 100)
  FROM v_invoice_balance WHERE sale_invoice_id = pg_temp.id('inv_cash');
-- Saldo del crédito: 200 − 100 − 50 = 50.
SELECT pg_temp.check_eq('crédito: saldo', balance, 50) FROM v_invoice_balance WHERE sale_invoice_id = pg_temp.id('inv_credit');

-- Un retiro no se borra.
DO $$
BEGIN
  DELETE FROM cash_withdrawal WHERE withdrawn_by_user_id = pg_temp.id('user');
  RAISE EXCEPTION 'FALLÓ: se borró un retiro';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: los retiros no se borran';
END $$;

-- El kardex sigue cuadrando con el stock (DEC-039).
SELECT pg_temp.check_eq('stock = kardex', count(*), 0) FROM v_product_stock_mismatch;

ROLLBACK;
