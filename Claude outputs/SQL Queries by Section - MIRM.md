---
title: SQL Queries by Section - MIRM
project: Motor IRM
type: knowledge
created: 2026-11-11
created_by: ai
reviewed: false
tags: [motor-irm, sql, postgresql, consultas]
---

# Consultas SQL por apartado — Motor IRM

> Nota hecha por IA (`reviewed: false`). Para cada pantalla: **qué procedimiento** del servidor se llama y **qué SQL** termina ejecutando PostgreSQL.
> Contexto general: [[System Guide - MIRM]].

## Cómo leer esta nota

- El código usa **Prisma** (que genera el SQL) y, para lo complejo, **SQL escrito a mano** (`$queryRaw`). Aquí todo está escrito como **SQL de PostgreSQL** para poder correrlo y estudiarlo.
- Las consultas marcadas **(literal)** son las que están tal cual en el código. Las marcadas **(equivalente)** son la traducción a SQL de lo que hace Prisma, simplificada para leerla.
- `:nombre` = un parámetro, lo que llega de la pantalla. Para probarlas en `psql`, reemplázalo por un valor.
- Los días se calculan en hora de Managua: `(columna AT TIME ZONE 'America/Managua')::date`.
- Para abrir la consola de la base: `npm run db:psql`.

---

## 0. Inicio de sesión

**Procedimiento:** `auth.login` · **Tablas:** `app_user`, `role`, `app_session`

```sql
-- 1. Buscar al usuario, sin importar mayúsculas (equivalente)
SELECT u.*, r.name AS role_name, r.active AS role_active
  FROM app_user u JOIN role r ON r.id = u.role_id
 WHERE lower(u.username) = lower(:username)
 LIMIT 1;
-- (La contraseña se verifica en Node comparando con password_hash: el hash no se "descifra".)

-- 2. Crear la sesión; se guarda el HASH del token, no el token (equivalente)
INSERT INTO app_session (app_user_id, token_hash, expires_at)
VALUES (:user_id, :sha256_del_token, now() + interval '14 hours');

UPDATE app_user SET last_login_at = now() WHERE id = :user_id;
DELETE FROM app_session WHERE app_user_id = :user_id AND expires_at < now();
```

**En cada petición** (`trpc.ts`), la cookie se convierte en usuario y permisos:

```sql
SELECT u.id, u.username, r.name AS role, p.code AS permission
  FROM app_session s
  JOIN app_user u        ON u.id = s.app_user_id AND u.active
  JOIN role r            ON r.id = u.role_id AND r.active
  JOIN role_permission rp ON rp.role_id = r.id
  JOIN permission p      ON p.id = rp.permission_id
 WHERE s.token_hash = :sha256_del_token_de_la_cookie
   AND s.expires_at > now();
```

---

## 1. Resumen (`/`)

**Procedimiento:** `reports.period` (todo **literal**, `routers/reports.ts`). Toda venta excluye las facturas **anuladas** con `NOT EXISTS (… sale_invoice_void …)`.

### 1.1 Gráfica de ventas, cobros y motos entregadas por día/semana/mes

```sql
WITH b AS (            -- un "cubo" por cada día/semana/mes del rango, aunque no haya ventas
  SELECT generate_series(date_trunc(:g, :desde::date), date_trunc(:g, :hasta::date), ('1 ' || :g)::interval)::date AS bucket
),
sales AS (
  SELECT date_trunc(:g, (si.created_at AT TIME ZONE 'America/Managua'))::date AS bucket,
         sum(CASE WHEN si.payment_terms = 'CONTADO' THEN l.quantity * l.unit_price - l.discount_amount ELSE 0 END) AS cash,
         sum(CASE WHEN si.payment_terms = 'CREDITO' THEN l.quantity * l.unit_price - l.discount_amount ELSE 0 END) AS credit,
         count(DISTINCT si.id) AS invoices
    FROM sale_invoice si JOIN sale_invoice_line l ON l.sale_invoice_id = si.id
   WHERE (si.created_at AT TIME ZONE 'America/Managua')::date BETWEEN :desde AND :hasta
     AND NOT EXISTS (SELECT 1 FROM sale_invoice_void v WHERE v.sale_invoice_id = si.id)
   GROUP BY 1
),
pay AS (               -- lo cobrado, menos el efectivo devuelto al anular
  SELECT bucket, sum(amount) AS received FROM (
    SELECT date_trunc(:g, (cp.paid_at AT TIME ZONE 'America/Managua'))::date AS bucket,
           CASE WHEN cp.currency = 'USD' THEN round(cp.amount * cp.exchange_rate, 2) ELSE cp.amount END AS amount
      FROM customer_payment cp
     WHERE (cp.paid_at AT TIME ZONE 'America/Managua')::date BETWEEN :desde AND :hasta
    UNION ALL
    SELECT date_trunc(:g, (v.voided_at AT TIME ZONE 'America/Managua'))::date, -v.refund_amount
      FROM sale_invoice_void v
     WHERE (v.voided_at AT TIME ZONE 'America/Managua')::date BETWEEN :desde AND :hasta
  ) x GROUP BY 1
),
delivered AS (
  SELECT date_trunc(:g, (sc.changed_at AT TIME ZONE 'America/Managua'))::date AS bucket, count(*) AS delivered
    FROM service_order_status_change sc
   WHERE sc.status = 'ENTREGADA'
     AND (sc.changed_at AT TIME ZONE 'America/Managua')::date BETWEEN :desde AND :hasta
   GROUP BY 1
)
SELECT b.bucket, coalesce(s.cash,0) AS cash, coalesce(s.credit,0) AS credit,
       coalesce(s.invoices,0) AS invoices, coalesce(p.received,0) AS received, coalesce(d.delivered,0) AS delivered
  FROM b
  LEFT JOIN sales s     ON s.bucket = b.bucket
  LEFT JOIN pay p       ON p.bucket = b.bucket
  LEFT JOIN delivered d ON d.bucket = b.bucket
 ORDER BY b.bucket;
```

> **Conceptos:** `WITH` (CTE), `generate_series`, `date_trunc`, `LEFT JOIN` para que aparezcan los días sin ventas, `CASE` dentro de `sum` (suma condicional), `UNION ALL`.

### 1.2 Productos más vendidos

```sql
SELECT p.id, p.name, sum(l.quantity) AS quantity,
       sum(l.quantity * l.unit_price - l.discount_amount) AS revenue
  FROM sale_invoice_line l
  JOIN sale_invoice si ON si.id = l.sale_invoice_id
  JOIN product p       ON p.id = l.product_id
 WHERE l.line_type = 'PRODUCTO'
   AND (si.created_at AT TIME ZONE 'America/Managua')::date BETWEEN :desde AND :hasta
   AND NOT EXISTS (SELECT 1 FROM sale_invoice_void v WHERE v.sale_invoice_id = si.id)
 GROUP BY p.id, p.name
 ORDER BY revenue DESC
 LIMIT 8;
```

### 1.3 Tarjetas (Ventas, Cobrado, Ticket promedio, Motos entregadas)

Se corre **dos veces**: para el periodo elegido y para el anterior del mismo largo (así salen los "▲ 96 %").

```sql
SELECT
  (SELECT coalesce(sum(l.quantity * l.unit_price - l.discount_amount), 0)
     FROM sale_invoice si JOIN sale_invoice_line l ON l.sale_invoice_id = si.id
    WHERE (si.created_at AT TIME ZONE 'America/Managua')::date BETWEEN :desde AND :hasta
      AND NOT EXISTS (SELECT 1 FROM sale_invoice_void v WHERE v.sale_invoice_id = si.id)) AS sales,
  (SELECT count(*) FROM sale_invoice si
    WHERE (si.created_at AT TIME ZONE 'America/Managua')::date BETWEEN :desde AND :hasta
      AND NOT EXISTS (SELECT 1 FROM sale_invoice_void v WHERE v.sale_invoice_id = si.id)) AS invoices,
  (SELECT coalesce(sum(l.quantity * l.unit_price - l.discount_amount), 0)
     FROM sale_invoice si JOIN sale_invoice_line l ON l.sale_invoice_id = si.id
    WHERE l.line_type = 'MANO_OBRA'
      AND (si.created_at AT TIME ZONE 'America/Managua')::date BETWEEN :desde AND :hasta
      AND NOT EXISTS (SELECT 1 FROM sale_invoice_void v WHERE v.sale_invoice_id = si.id)) AS labor,
  ((SELECT coalesce(sum(CASE WHEN currency = 'USD' THEN round(amount * exchange_rate, 2) ELSE amount END), 0)
      FROM customer_payment WHERE (paid_at AT TIME ZONE 'America/Managua')::date BETWEEN :desde AND :hasta)
   - (SELECT coalesce(sum(refund_amount), 0) FROM sale_invoice_void
      WHERE (voided_at AT TIME ZONE 'America/Managua')::date BETWEEN :desde AND :hasta)) AS received,
  (SELECT count(*) FROM service_order_status_change
    WHERE status = 'ENTREGADA'
      AND (changed_at AT TIME ZONE 'America/Managua')::date BETWEEN :desde AND :hasta) AS delivered;
-- Ticket promedio = sales / invoices (se calcula en la pantalla).
```

### 1.4 Cobros por forma de pago, caja neta, órdenes abiertas y poco stock

```sql
-- Por forma de pago
SELECT pm.name AS method,
       sum(CASE WHEN cp.currency = 'USD' THEN round(cp.amount * cp.exchange_rate, 2) ELSE cp.amount END) AS amount
  FROM customer_payment cp JOIN payment_method pm ON pm.id = cp.payment_method_id
 WHERE (cp.paid_at AT TIME ZONE 'America/Managua')::date BETWEEN :desde AND :hasta
 GROUP BY pm.name ORDER BY 2 DESC;

-- Lo que debería haber en caja: cobrado − retiros − adelantos − reembolsos de anulaciones
WITH m AS (
  SELECT (SELECT coalesce(sum(CASE WHEN currency='USD' THEN round(amount*exchange_rate,2) ELSE amount END),0)
            FROM customer_payment WHERE (paid_at AT TIME ZONE 'America/Managua')::date BETWEEN :desde AND :hasta) AS received,
         (SELECT coalesce(sum(amount),0) FROM cash_withdrawal WHERE withdrawn_on BETWEEN :desde AND :hasta) AS withdrawals,
         (SELECT coalesce(sum(amount),0) FROM staff_advance   WHERE given_on     BETWEEN :desde AND :hasta) AS advances,
         (SELECT coalesce(sum(refund_amount),0) FROM sale_invoice_void
           WHERE (voided_at AT TIME ZONE 'America/Managua')::date BETWEEN :desde AND :hasta) AS refunds
)
SELECT withdrawals, advances, received - withdrawals - advances - refunds AS net FROM m;

-- Órdenes de taller abiertas
SELECT count(*) FROM v_service_order_status WHERE status NOT IN ('ENTREGADA', 'CANCELADA');

-- Productos con poco stock (equivalente)
SELECT id, name, stock, barcode FROM product
 WHERE stock <= :umbral AND active
 ORDER BY stock LIMIT 50;
```

---

## 2. Caja (`/ventas`)

### 2.1 Buscar producto (lector de código de barras o texto)

**Procedimientos:** `inventory.byBarcode` y `search.products`.

```sql
-- Lector de código de barras (equivalente)
SELECT p.*, b.name AS brand, c.name AS category
  FROM product p
  JOIN product_brand b    ON b.id = p.product_brand_id
  JOIN product_category c ON c.id = p.product_category_id
 WHERE p.barcode = :codigo AND p.active
 LIMIT 1;
```

La búsqueda por texto es la de **Inventario** (ver 5.1): tolera errores de escritura ("bugia" encuentra "Bujía").

### 2.2 Cobrar (crear factura de mostrador)

**Procedimiento:** `sales.create` → `domain/billing.ts › createInvoice`. **Todo en una transacción**: si un paso falla, no se guarda nada.

```sql
BEGIN;

-- 1. Precio y stock de la BASE (nunca se confía en el precio que manda la pantalla)
SELECT id, name, list_price, stock FROM product WHERE id IN (:ids_productos);

-- 2. La factura
INSERT INTO sale_invoice (customer_id, created_by_user_id, payment_terms, due_date, credit_authorized_by_user_id)
VALUES (:cliente_o_null, :usuario, :'CONTADO'|'CREDITO', :vence_o_null, :autorizo_o_null)
RETURNING id;

-- 3. Una línea por producto
INSERT INTO sale_invoice_line (sale_invoice_id, line_no, line_type, product_id, quantity, unit_price, discount_amount)
VALUES (:factura, 1, 'PRODUCTO', :producto, :cantidad, :precio_lista, :rebaja);

-- 4. La salida del kardex (el TRIGGER baja product.stock y no deja que quede negativo)
INSERT INTO inventory_movement (product_id, movement_type, quantity, unit_cost, registered_by_user_id, sale_invoice_line_id)
VALUES (:producto, 'VENTA', :cantidad, :ultimo_costo, :usuario, :linea);

-- 5. Si es de CONTADO: el pago y a qué factura se aplica
INSERT INTO customer_payment (amount, currency, exchange_rate, payment_method_id, received_by_user_id)
VALUES (:total, 'NIO', NULL, :forma_pago, :usuario) RETURNING id;
INSERT INTO customer_payment_allocation (customer_payment_id, sale_invoice_id, amount)
VALUES (:pago, :factura, :total);

COMMIT;
```

**Triggers que actúan solos:** `tg_inventory_movement_apply_stock` (resta el stock), `tg_product_guard_stock` (si no alcanza, error "stock insuficiente" y se deshace todo), `tg_sale_invoice_line_min_price` (una rebaja no puede dejar el producto bajo su costo).

---

## 3. Facturas (`/facturas` y `/ventas/[id]`)

### 3.1 Lista con filtros y totales

**Procedimiento:** `sales.searchInvoices` (**literal**, armado según los filtros). La vista `v_invoice_balance` ya trae total, pagado y saldo de cada factura.

```sql
SELECT si.id, si.invoice_number, b.created_at, b.payment_terms, b.due_date,
       c.name AS customer_name, si.service_order_id, u.username AS created_by,
       b.total, b.returned, b.paid, b.balance, b.days_overdue, b.voided,
       count(*)     OVER () AS count,        -- cuántas hay en total (para las tarjetas)
       sum(b.total) OVER () AS sum_total,
       sum(b.paid)  OVER () AS sum_paid,
       sum(b.balance) OVER () AS sum_balance
  FROM v_invoice_balance b
  JOIN sale_invoice si ON si.id = b.sale_invoice_id
  LEFT JOIN customer c ON c.id = b.customer_id
  JOIN app_user u      ON u.id = si.created_by_user_id
 WHERE (si.created_at AT TIME ZONE 'America/Managua')::date BETWEEN :desde AND :hasta  -- Hoy / 7 días / mes
   -- Condición:  AND b.payment_terms = 'CREDITO'
   -- Pendientes: AND b.balance > 0      Pagadas: AND b.balance <= 0 AND NOT b.voided
   -- Vencidas:   AND b.days_overdue > 0  Anuladas: AND b.voided
   -- Taller:     AND si.service_order_id IS NOT NULL   Mostrador: … IS NULL
   -- Texto:      AND (si.invoice_number = :texto OR mirm_norm(c.name) LIKE '%' || mirm_norm(:texto) || '%')
 ORDER BY si.id DESC
 LIMIT 50 OFFSET :offset;
```

> **Conceptos:** **funciones de ventana** (`count(*) OVER ()`) para tener el total sin otra consulta; `mirm_norm` es una función propia que quita tildes y pasa a minúsculas.

**La vista `v_invoice_balance` (simplificada):**

```sql
SELECT si.id AS sale_invoice_id, si.customer_id, si.payment_terms, si.created_at,
       coalesce(si.extended_due_date, si.due_date) AS due_date,
       t.total, r.returned, p.paid,
       CASE WHEN v.sale_invoice_id IS NOT NULL THEN 0 ELSE t.total - r.returned - p.paid END AS balance,
       v.sale_invoice_id IS NOT NULL AS voided
  FROM sale_invoice si
  LEFT JOIN sale_invoice_void v ON v.sale_invoice_id = si.id
  CROSS JOIN LATERAL (SELECT coalesce(sum(quantity*unit_price - discount_amount),0) AS total
                        FROM sale_invoice_line WHERE sale_invoice_id = si.id) t
  CROSS JOIN LATERAL (/* lo devuelto, proporcional al precio neto */ SELECT … AS returned) r
  CROSS JOIN LATERAL (SELECT coalesce(sum(amount),0) AS paid
                        FROM customer_payment_allocation WHERE sale_invoice_id = si.id) p;
```

### 3.2 Detalle de una factura (y lo que se imprime)

**Procedimiento:** `sales.getInvoice` (equivalente):

```sql
SELECT si.*, c.*, u.username AS created_by, v.reason AS void_reason, vu.username AS voided_by
  FROM sale_invoice si
  LEFT JOIN customer c           ON c.id = si.customer_id
  JOIN app_user u                ON u.id = si.created_by_user_id
  LEFT JOIN sale_invoice_void v  ON v.sale_invoice_id = si.id
  LEFT JOIN app_user vu          ON vu.id = v.voided_by_user_id
 WHERE si.id = :id;

SELECT l.*, p.name AS product, st.name AS service_type
  FROM sale_invoice_line l
  LEFT JOIN product p       ON p.id = l.product_id
  LEFT JOIN service_type st ON st.id = l.service_type_id
 WHERE l.sale_invoice_id = :id ORDER BY l.line_no;

SELECT a.amount, cp.paid_at, pm.name AS method
  FROM customer_payment_allocation a
  JOIN customer_payment cp ON cp.id = a.customer_payment_id
  JOIN payment_method pm   ON pm.id = cp.payment_method_id
 WHERE a.sale_invoice_id = :id;
```

### 3.3 Anular factura (solo dueño, máximo 3 días)

**Procedimiento:** `sales.voidInvoice`.

```sql
BEGIN;
SELECT id FROM sale_invoice WHERE id = :factura FOR UPDATE;      -- bloquea la fila: nadie más la toca mientras tanto
-- Si tiene productos: una devolución por todo (regresan al inventario)
INSERT INTO customer_return (sale_invoice_id, return_reason_id, registered_by_user_id)
VALUES (:factura, (SELECT id FROM return_reason WHERE lower(name) = lower('Anulación de factura')), :usuario)
RETURNING id;
INSERT INTO customer_return_line (…);                             -- una por línea de producto
INSERT INTO inventory_movement (product_id, movement_type, quantity, …) VALUES (…, 'DEVOLUCION_CLIENTE', …);
-- El registro de la anulación (el TRIGGER valida dueño, 3 días y comisión no pagada)
INSERT INTO sale_invoice_void (sale_invoice_id, voided_by_user_id, reason, refund_amount, customer_return_id)
VALUES (:factura, :usuario, :motivo, :efectivo_devuelto, :devolucion);
COMMIT;
```

### 3.4 Devolución parcial

**Procedimiento:** `sales.createReturn`. Igual que arriba, pero solo las cantidades elegidas, con validación "vendido − ya devuelto".

---

## 4. Taller (`/taller` y `/taller/[id]`)

### 4.1 Tablero de órdenes abiertas

**Procedimiento:** `service.listOrders` (equivalente). El estado actual es **el último cambio** registrado:

```sql
SELECT so.id, c.name AS customer, mb.name || ' ' || mm.name AS moto, m.plate,
       st.name AS mechanic, s.status, s.status_since
  FROM service_order so
  JOIN motorcycle m        ON m.id = so.motorcycle_id
  JOIN customer c          ON c.id = m.customer_id
  JOIN motorcycle_model mm ON mm.id = m.motorcycle_model_id
  JOIN motorcycle_brand mb ON mb.id = mm.motorcycle_brand_id
  LEFT JOIN staff st       ON st.id = so.mechanic_staff_id
  JOIN v_service_order_status s ON s.service_order_id = so.id
 WHERE s.status NOT IN ('ENTREGADA', 'CANCELADA')
 ORDER BY so.id DESC;
```

**La vista `v_service_order_status` (literal):**

```sql
SELECT DISTINCT ON (sc.service_order_id)
       sc.service_order_id, sc.status, sc.changed_at AS status_since
  FROM service_order_status_change sc
 ORDER BY sc.service_order_id, sc.changed_at DESC, sc.id DESC;
```

> **Concepto:** `DISTINCT ON` (propio de PostgreSQL) se queda con la **primera fila de cada grupo** según el `ORDER BY`, o sea, el último cambio de cada orden.

### 4.2 Recibir una moto

**Procedimiento:** `service.receive` (transacción). Puede crear cliente y moto en el mismo paso:

```sql
BEGIN;
INSERT INTO customer (name, phone) VALUES (:nombre, :telefono) RETURNING id;                      -- si es nuevo
INSERT INTO motorcycle (customer_id, motorcycle_model_id, color, plate) VALUES (…) RETURNING id;  -- si es nueva
INSERT INTO service_order (motorcycle_id, requested_work, odometer_km, mechanic_staff_id, applied_commission_rate)
VALUES (:moto, :nota_cliente, :km, :responsable, :comision_del_responsable) RETURNING id;
INSERT INTO service_order_item (service_order_id, service_type_id) VALUES (:orden, :trabajo);       -- uno por trabajo
INSERT INTO service_order_status_change (service_order_id, status, registered_by_user_id)
VALUES (:orden, 'RECIBIDA', :usuario);
COMMIT;
```

### 4.3 Cambiar estado, asignar responsable, fallas adicionales

```sql
-- Estado (el TRIGGER impide agregar algo después de ENTREGADA/CANCELADA)
INSERT INTO service_order_status_change (service_order_id, status, registered_by_user_id)
VALUES (:orden, 'EN_PROCESO', :usuario);

-- Responsable: se COPIA su comisión a la orden (instantánea)
UPDATE service_order
   SET mechanic_staff_id = :staff,
       applied_commission_rate = (SELECT CASE WHEN kind = 'DUENO' THEN NULL ELSE commission_rate END FROM staff WHERE id = :staff)
 WHERE id = :orden;

-- Falla adicional encontrada
INSERT INTO additional_fault (service_order_id, fault_no, description, proposed_price, decision)
VALUES (:orden, (SELECT coalesce(max(fault_no),0)+1 FROM additional_fault WHERE service_order_id = :orden),
        :descripcion, :precio_o_null, 'PENDIENTE');
```

### 4.4 Historial de la moto

```sql
SELECT so.id, s.status, so.odometer_km, st.name AS responsable,
       string_agg(DISTINCT t.name, ', ') AS trabajos
  FROM service_order so
  JOIN v_service_order_status s ON s.service_order_id = so.id
  LEFT JOIN staff st ON st.id = so.mechanic_staff_id
  JOIN service_order_item i ON i.service_order_id = so.id
  JOIN service_type t ON t.id = i.service_type_id
 WHERE so.motorcycle_id = :moto
 GROUP BY so.id, s.status, so.odometer_km, st.name
 ORDER BY so.id DESC;
```

### 4.5 Cobrar en caja (cerrar la orden)

**Procedimiento:** `service.close`. Valida que haya responsable y que no queden fallas sin decisión, y luego hace lo mismo que la venta de mostrador (2.2) con `service_order_id` y líneas de `MANO_OBRA`. Las salidas de stock son `USO_SERVICIO`. Al final agrega el estado `ENTREGADA`.

---

## 5. Inventario (`/inventario` y `/inventario/[id]`)

### 5.1 Lista, búsqueda y filtros

**Procedimiento:** `search.products` → `domain/search.ts` (**literal**, armado según filtros). Pide **30 por página** (`LIMIT 30 OFFSET 0`, luego `OFFSET 30`…), así funciona igual con 70 o con 5,000 productos.

```sql
WITH d AS (   -- todo el texto buscable de cada producto, sin tildes ni mayúsculas
  SELECT p.id, mirm_norm(p.name || ' ' || b.name || ' ' || c.name || ' ' || coalesce(p.barcode, '')) AS all_n
    FROM product p
    JOIN product_brand b    ON b.id = p.product_brand_id
    JOIN product_category c ON c.id = p.product_category_id
)
SELECT p.id,
       ( CASE WHEN p.barcode = :texto THEN 3 ELSE 0 END                 -- código exacto: lo más importante
       + CASE WHEN mirm_norm(p.name) LIKE mirm_norm(:texto) || '%' THEN 1 ELSE 0 END
       + CASE WHEN d.all_n LIKE '%' || mirm_norm(:texto) || '%' THEN 0.6 ELSE 0 END
       + word_similarity(mirm_norm(:texto), d.all_n)                     -- tolera errores ("bugia")
       + 0.5 * similarity(mirm_norm(:texto), mirm_norm(p.name))
       + CASE WHEN p.stock > 0 THEN 0.05 ELSE 0 END )::float8 AS score,
       count(*) OVER () AS total
  FROM product p
  JOIN d ON d.id = p.id
  JOIN v_product_overview o ON o.product_id = p.id
 WHERE p.active                                   -- (Administración usa NOT p.active)
   AND (p.barcode = :texto OR d.all_n LIKE '%' || mirm_norm(:texto) || '%'
        OR word_similarity(mirm_norm(:texto), d.all_n) >= :similitud_minima)
   -- Filtros:  AND p.product_category_id = :categoria   AND p.product_brand_id = :marca
   --           AND p.quality_tier = :calidad            AND :proveedor = ANY(o.supplier_ids)
   --           Agotado: AND p.stock = 0   Poco: AND p.stock BETWEEN 1 AND 2   Disponible: AND p.stock > 0
 ORDER BY score DESC, p.id            -- u otro: p.list_price, o.sold_90d DESC, o.margin_pct DESC…
 LIMIT 30 OFFSET :offset;
```

> **Conceptos:** `similarity` y `word_similarity` son de la extensión **pg_trgm** (trigramas): comparan textos por pedazos de 3 letras, por eso encuentra palabras mal escritas. `= ANY(array)` busca dentro de un arreglo.

Luego, con los `id` encontrados:

```sql
SELECT product_id, last_cost, margin_pct, sold_90d FROM v_product_overview WHERE product_id IN (:ids);
```

### 5.2 Ficha del producto y kardex

```sql
SELECT p.*, b.name, c.name FROM product p JOIN product_brand b ON … JOIN product_category c ON … WHERE p.id = :id;

-- Último costo: el de la última ENTRADA
SELECT unit_cost FROM inventory_movement
 WHERE product_id = :id AND movement_type IN ('COMPRA','DEVOLUCION_CLIENTE','INVENTARIO_INICIAL','AJUSTE_ENTRADA')
 ORDER BY moved_at DESC, id DESC LIMIT 1;

-- Kardex, de 30 en 30 por "cursor" (el id de la última fila recibida)
SELECT m.*, u.username FROM inventory_movement m JOIN app_user u ON u.id = m.registered_by_user_id
 WHERE m.product_id = :id AND (:cursor IS NULL OR m.id < :cursor)
 ORDER BY m.id DESC LIMIT 31;

-- Historial de precios
SELECT h.changed_at, h.new_price, u.username FROM product_price_history h
  LEFT JOIN app_user u ON u.id = h.changed_by_user_id
 WHERE h.product_id = :id ORDER BY h.changed_at DESC LIMIT 20;
```

### 5.3 Acciones sobre el producto

```sql
-- Nuevo producto (+ inventario inicial opcional)
INSERT INTO product (name, barcode, product_category_id, product_brand_id, quality_tier, list_price) VALUES (…) RETURNING id;
INSERT INTO product_price_history (product_id, new_price, changed_by_user_id) VALUES (:id, :precio, :usuario);
INSERT INTO inventory_movement (product_id, movement_type, quantity, unit_cost, registered_by_user_id)
VALUES (:id, 'INVENTARIO_INICIAL', :cantidad, :costo, :usuario);

-- Editar datos (nombre, código, categoría, marca, calidad)
UPDATE product SET name = :nombre, barcode = :codigo, product_category_id = :cat, product_brand_id = :marca, quality_tier = :calidad
 WHERE id = :id;

-- Cambiar precio (precio + historial, en una transacción)
UPDATE product SET list_price = :nuevo WHERE id = :id;
INSERT INTO product_price_history (product_id, new_price, changed_by_user_id) VALUES (:id, :nuevo, :usuario);

-- Ajuste de inventario (pérdida, daño, sobrante): nota obligatoria (CHECK)
INSERT INTO inventory_movement (product_id, movement_type, quantity, unit_cost, notes, registered_by_user_id)
VALUES (:id, 'AJUSTE_SALIDA', :cantidad, :ultimo_costo, :motivo, :usuario);

-- Desactivar / activar
UPDATE product SET active = false WHERE id = :id;
```

---

## 6. Clientes y abonos (`/clientes` y `/clientes/[id]`)

### 6.1 Lista con filtros

**Procedimiento:** `search.customers`. Misma técnica que productos (5.1), sobre nombre, teléfono, cédula y placas, unida a la vista `v_customer_overview`:

```sql
SELECT c.id, o.motorcycles, o.balance, o.overdue, o.max_days_overdue, o.has_credit, o.last_visit_at
  FROM customer c
  JOIN v_customer_overview o ON o.customer_id = c.id
 WHERE /* texto tolerante */ …
   -- Con deuda: AND o.balance > 0      Vencida: AND o.overdue > 0
   -- Con moto:  AND o.motorcycles > 0  Marca: AND :marca = ANY(o.motorcycle_brand_ids)
 ORDER BY c.name LIMIT 50 OFFSET :offset;   -- o: o.balance DESC, o.max_days_overdue DESC, o.last_visit_at DESC
```

**`v_customer_balance` (literal):** une las facturas con saldo y las deudas de antes del sistema.

```sql
WITH debts AS (
  SELECT customer_id, balance, due_date, days_overdue FROM v_invoice_balance
   WHERE customer_id IS NOT NULL AND balance > 0
  UNION ALL
  SELECT customer_id, balance, due_date, days_overdue FROM v_opening_balance_remaining
   WHERE balance > 0
)
SELECT customer_id,
       sum(balance) AS balance,
       coalesce(sum(balance) FILTER (WHERE days_overdue > 0), 0) AS overdue,
       min(due_date) AS oldest_due_date,
       max(days_overdue) AS max_days_overdue,
       count(*) AS open_items
  FROM debts GROUP BY customer_id;
```

> **Concepto:** `FILTER (WHERE …)` suma solo algunas filas dentro de un `GROUP BY`.

### 6.2 Estado de cuenta y abono

**Procedimientos:** `customer.statement` y `sales.registerPayment`.

```sql
-- Facturas del cliente con su saldo
SELECT * FROM v_invoice_balance WHERE customer_id = :cliente ORDER BY created_at;
SELECT * FROM v_opening_balance_remaining WHERE customer_id = :cliente;

-- Abono repartido entre varias facturas (transacción, filas bloqueadas)
BEGIN;
SELECT id FROM sale_invoice WHERE id IN (:facturas) FOR UPDATE;
INSERT INTO customer_payment (amount, currency, exchange_rate, payment_method_id, received_by_user_id)
VALUES (:monto, :moneda, :tc, :forma, :usuario) RETURNING id;
INSERT INTO customer_payment_allocation (customer_payment_id, sale_invoice_id, amount) VALUES (:pago, :f1, :m1), (:pago, :f2, :m2);
COMMIT;
```

---

## 7. Compras (`/compras`, `/compras/[id]`, proveedores)

### 7.1 Lista (con filtro Contado / Crédito)

**Procedimiento:** `purchasing.listInvoices` (equivalente), 50 por página con cursor:

```sql
SELECT pi.id, s.name AS supplier, pi.invoice_number, pi.purchase_date, pi.payment_terms, pi.due_date,
       b.total, b.returned, b.paid, b.balance
  FROM purchase_invoice pi
  JOIN supplier s ON s.id = pi.supplier_id
  JOIN v_purchase_invoice_balance b ON b.purchase_invoice_id = pi.id
 WHERE (:tipo IS NULL OR pi.payment_terms = :tipo)
   AND (:cursor IS NULL OR pi.id < :cursor)
 ORDER BY pi.id DESC LIMIT 51;
```

### 7.2 Detalle de una compra

**Procedimiento:** `purchasing.getInvoice`:

```sql
SELECT pi.*, s.name, u.username AS received_by FROM purchase_invoice pi
  JOIN supplier s ON s.id = pi.supplier_id JOIN app_user u ON u.id = pi.received_by_user_id WHERE pi.id = :id;
SELECT l.*, p.name FROM purchase_invoice_line l JOIN product p ON p.id = l.product_id
 WHERE l.purchase_invoice_id = :id ORDER BY l.line_no;
SELECT * FROM supplier_payment WHERE purchase_invoice_id = :id ORDER BY paid_on;
SELECT r.*, rr.name AS reason FROM supplier_return r JOIN return_reason rr ON rr.id = r.return_reason_id
 WHERE r.purchase_invoice_id = :id;
SELECT * FROM v_purchase_invoice_balance WHERE purchase_invoice_id = :id;
```

### 7.3 Registrar compra (sube el stock)

**Procedimiento:** `purchasing.createInvoice` (transacción):

```sql
BEGIN;
INSERT INTO purchase_invoice (supplier_id, invoice_number, purchase_date, payment_terms, due_date, discount_amount, received_by_user_id)
VALUES (…) RETURNING id;
INSERT INTO purchase_invoice_line (purchase_invoice_id, line_no, product_id, quantity, unit_cost) VALUES (…);
INSERT INTO inventory_movement (product_id, movement_type, quantity, unit_cost, registered_by_user_id, purchase_invoice_line_id)
VALUES (:producto, 'COMPRA', :cantidad, :costo, :usuario, :linea);          -- el TRIGGER sube el stock
-- (opcional) nuevo precio de venta:
UPDATE product SET list_price = :nuevo WHERE id = :producto;
INSERT INTO product_price_history (…);
-- Si es de CONTADO: queda pagada en el acto (migración 9a)
INSERT INTO supplier_payment (supplier_id, purchase_invoice_id, amount, paid_on)
VALUES (:proveedor, :compra, :total_menos_descuento, :fecha_compra);
COMMIT;
```

### 7.4 Pagar a proveedor y cuánto se le debe

```sql
BEGIN;
SELECT id FROM supplier WHERE id = :proveedor FOR UPDATE;
SELECT balance FROM v_purchase_invoice_balance WHERE purchase_invoice_id = :compra;   -- no se paga de más
INSERT INTO supplier_payment (supplier_id, purchase_invoice_id, amount, currency, exchange_rate, paid_on) VALUES (…);
COMMIT;

-- Deuda por proveedor (vista v_supplier_balance)
SELECT s.name, b.opening_balance, b.purchases_balance, b.balance, b.overdue
  FROM supplier s JOIN v_supplier_balance b ON b.supplier_id = s.id ORDER BY b.balance DESC;
```

---

## 8. Retiros de caja (`/retiros`)

**Procedimientos:** `staff.cashWithdrawals` y `staff.withdrawCash`:

```sql
SELECT w.withdrawn_on, w.amount, w.description, r.name AS reason, u.username
  FROM cash_withdrawal w
  JOIN cash_withdrawal_reason r ON r.id = w.cash_withdrawal_reason_id
  JOIN app_user u ON u.id = w.withdrawn_by_user_id
 ORDER BY w.id DESC LIMIT 50;

INSERT INTO cash_withdrawal (cash_withdrawal_reason_id, amount, description, withdrawn_by_user_id)
VALUES (:motivo, :monto, :descripcion, :usuario);
```

---

## 9. Pago a mecánicos (`/pagos`)

### 9.1 Lo ganado sin cobrar

**Procedimiento:** `staff.pending` → vista `v_mechanic_unpaid_commission` (**literal**, simplificada):

```sql
SELECT so.id AS service_order_id, so.mechanic_staff_id AS staff_id, d.delivered_at,
       so.applied_commission_rate AS rate, lab.labor,
       round(lab.labor * so.applied_commission_rate, 2) AS commission
  FROM service_order so
  CROSS JOIN LATERAL (SELECT min(changed_at) AS delivered_at FROM service_order_status_change
                       WHERE service_order_id = so.id AND status = 'ENTREGADA') d
  CROSS JOIN LATERAL (SELECT coalesce(sum(l.quantity*l.unit_price - l.discount_amount),0) AS labor
                        FROM sale_invoice si JOIN sale_invoice_line l ON l.sale_invoice_id = si.id
                       WHERE si.service_order_id = so.id AND l.line_type = 'MANO_OBRA') lab
 WHERE so.staff_payout_id IS NULL                 -- todavía no pagada
   AND so.applied_commission_rate IS NOT NULL     -- dueños y "100 %" no tienen tasa
   AND so.mechanic_staff_id IS NOT NULL
   AND d.delivered_at IS NOT NULL                 -- solo motos ENTREGADAS
   AND NOT EXISTS (SELECT 1 FROM sale_invoice si JOIN sale_invoice_void v ON v.sale_invoice_id = si.id
                    WHERE si.service_order_id = so.id);   -- factura anulada = sin comisión

-- Adelantos sin descontar
SELECT * FROM staff_advance WHERE staff_id = :mecanico AND staff_payout_id IS NULL;
```

> **Concepto:** `CROSS JOIN LATERAL` = una subconsulta que se calcula **por cada fila** de la tabla de la izquierda.

### 9.2 Dar adelanto y pagar el periodo

```sql
-- Adelanto: no más de lo ganado − adelantos previos (se valida antes en el servidor)
INSERT INTO staff_advance (staff_id, amount, given_by_user_id) VALUES (:mecanico, :monto, :usuario);

-- Pagar periodo: un "recibo" y se le cuelgan las órdenes y adelantos
BEGIN;
SELECT id FROM staff WHERE id = :mecanico FOR UPDATE;
INSERT INTO staff_payout (staff_id, period_start, period_end, paid_on, paid_by_user_id)
VALUES (:mecanico, :desde, :hasta, current_date, :usuario) RETURNING id;
UPDATE service_order SET staff_payout_id = :recibo WHERE id IN (:ordenes_pendientes);
UPDATE staff_advance SET staff_payout_id = :recibo WHERE id IN (:adelantos_pendientes);
COMMIT;
```

---

## 10. Administración (`/admin`)

```sql
-- Personas del negocio (staff.list / staff.save): nunca se borran, se desactivan
SELECT * FROM staff ORDER BY kind, name;
UPDATE staff SET name=:n, phone=:t, kind=:tipo, can_repair=:r, commission_rate=:tasa_o_null, active=:activo WHERE id=:id;

-- Usuarios y perfiles (admin.users / admin.roles)
SELECT u.id, u.username, u.active, r.name AS role, s.name AS person
  FROM app_user u JOIN role r ON r.id = u.role_id LEFT JOIN staff s ON s.id = u.staff_id;
SELECT r.name, p.code FROM role r JOIN role_permission rp ON rp.role_id = r.id JOIN permission p ON p.id = rp.permission_id;

-- Catálogos (categorías, marcas, formas de pago, motivos…): el mismo patrón para todos
SELECT id, name, active FROM payment_method ORDER BY name;
INSERT INTO payment_method (name) VALUES (:nombre);
UPDATE payment_method SET active = false WHERE id = :id;

-- Marcas y modelos de moto
SELECT mb.name AS brand, mm.name AS model FROM motorcycle_model mm
  JOIN motorcycle_brand mb ON mb.id = mm.motorcycle_brand_id ORDER BY mb.name, mm.name;

-- Productos desactivados
SELECT id, name, stock FROM product WHERE NOT active ORDER BY name;
UPDATE product SET active = true WHERE id = :id;
```

---

## 11. Consultas útiles para practicar en `psql`

```sql
-- ¿Coincide el stock con el kardex? (vista de control; debe salir vacía)
SELECT * FROM v_product_stock_mismatch;

-- Ventas por categoría este mes
SELECT c.name, sum(l.quantity * l.unit_price - l.discount_amount) AS vendido
  FROM sale_invoice_line l
  JOIN sale_invoice si ON si.id = l.sale_invoice_id
  JOIN product p ON p.id = l.product_id
  JOIN product_category c ON c.id = p.product_category_id
 WHERE date_trunc('month', si.created_at AT TIME ZONE 'America/Managua') = date_trunc('month', now() AT TIME ZONE 'America/Managua')
   AND NOT EXISTS (SELECT 1 FROM sale_invoice_void v WHERE v.sale_invoice_id = si.id)
 GROUP BY c.name ORDER BY vendido DESC;

-- Clientes que más deben
SELECT c.name, b.balance, b.max_days_overdue FROM v_customer_balance b
  JOIN customer c ON c.id = b.customer_id ORDER BY b.balance DESC LIMIT 10;

-- Mecánico con más motos entregadas
SELECT st.name, count(*) FROM service_order so
  JOIN v_service_order_status s ON s.service_order_id = so.id AND s.status = 'ENTREGADA'
  JOIN staff st ON st.id = so.mechanic_staff_id
 GROUP BY st.name ORDER BY 2 DESC;
```

**Reto:** escribe tú la consulta "productos que no se han vendido en 60 días pero tienen stock". Pista: `inventory_movement`, `movement_type IN ('VENTA','USO_SERVICIO')` y `NOT EXISTS`.
