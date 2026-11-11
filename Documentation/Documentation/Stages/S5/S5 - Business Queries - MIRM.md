---
project: "[[Motor IRM]]"
stage: S5
type: stage-product
status: 🟡 Lista para la clase — actualizada al DDL v2 (07-nov), pendiente de revisión del equipo
version: 2
date: 2026-10-29
based_on:
  - "[[S5 - DDL PostgreSQL - MIRM]]"
  - "[[S5 - Relational Schema - MIRM]]"
source: IA (consultas redactadas por Claude a pedido de Kenry y probadas en PostgreSQL 16 con datos de los escenarios)
ai_edit: "Claude — 2026-10-29: nota creada (método, patrones y 20 consultas probadas); consultas adaptadas a la convención id_<tabla>; 2026-11-07: DDL v2 — Q16 y Q19 actualizadas, Q21 y Q22 nuevas, las 22 probadas"
reviewed: false
---
**[[Motor IRM|← Hub]]** · **[[S5 - Relational Model and Normalization - MIRM|← S5]]** · **[[S5 - DDL PostgreSQL - MIRM|DDL]]** · **[[S5 - Relational Schema - MIRM|Esquema]]**

# S5 - Business Queries - MIRM

> [!info] Qué es esta nota
> - **22 consultas** que responden preguntas reales del negocio, probadas en PostgreSQL 16 sobre el [[S5 - DDL PostgreSQL - MIRM|DDL]] v2 con datos de los escenarios (07-nov).
> - **Cambios del 07-nov:** Q16 usa `period_start`/`period_end` ([[DEC-030 - Mechanic Pay Period - MIRM|DEC-030]]); Q19 resta el descuento de la factura ([[DEC-031 - Purchase Invoice Discount - MIRM|DEC-031]]); **nuevas** Q21 (lo que un mecánico tiene pendiente: base de BR-103) y Q22 (saldo de cada factura de compra).
> - **Un método** (§1) y **patrones** (§2) para armar en clase las consultas que el docente pida y no estén aquí.
> - Las que tienen un número fijo (`id_product = 2`, `id_customer = 1`, `id_mechanical_service = 2`) se adaptan cambiando ese número.

---

## 1. Método para armar una consulta nueva (en clase)

1. **Escribe la pregunta en palabras del negocio.** "¿Cuánto debe cada cliente?"
2. **¿Qué se cuenta o se muestra, y por qué cosa?** Lo que va después de "cada" es el `GROUP BY` (cada **cliente**). Lo que se suma o se cuenta es el agregado (lo que **debe**).
3. **¿En qué tablas está?** Usa el mapa de §3. Si los datos están en tablas distintas, sigue las FK del [[S5 - Relational Schema - MIRM|diagrama completo]] para unirlas.
4. **¿Qué filas sí y cuáles no?** Eso va en `WHERE` (antes de agrupar) o en `HAVING` (después).
5. **Construye por partes y ejecuta en cada paso:** primero `FROM` + `JOIN` con `SELECT *` para ver las filas, luego los filtros, luego el `GROUP BY`. Si un total sale demasiado grande, se están multiplicando filas (§2, patrón 3).

---

## 2. Patrones que resuelven casi todo

| # | Patrón | Cuándo | Ejemplo |
| --- | --- | --- | --- |
| 1 | **Cadena de JOIN** siguiendo las FK | Datos repartidos en varias tablas | Cliente → `billable_document` → `mechanical_service` → `motorcycle` → `motorcycle_model` (Q11) |
| 2 | **`LEFT JOIN` + `COALESCE(…, 0)`** | Que aparezca aunque no tenga filas relacionadas | Productos sin movimientos con existencia 0 (Q04) |
| 3 | **Agregar antes de unir** | Sumar dos tablas hijas del mismo padre | Total de un servicio: mano de obra y productos por separado (Q07) |
| 4 | **`SUM(CASE WHEN … THEN … ELSE … END)`** | Sumar con signo o por categoría | Entradas − salidas del kárdex (Q04) |
| 5 | **`ROW_NUMBER() OVER (PARTITION BY …)`** | El último o el primero de cada grupo | Estado actual de cada servicio (Q11) |
| 6 | **`NOT EXISTS`** | Lo que **no** tiene algo | Clientes sin servicios (Q20) |
| 7 | **`WITH` (CTE)** | Consultas largas por pasos con nombre | Saldo de créditos (Q17) |
| 8 | **Fechas** | Hoy, este mes, entre dos fechas | `col::date = CURRENT_DATE` · `col >= date_trunc('month', CURRENT_DATE)` · `col BETWEEN '2026-10-01' AND '2026-10-31'` |

---

## 3. Mapa: qué tabla responde qué

| Si preguntan por… | Tablas |
| --- | --- |
| Productos, precios, marcas, gamas | `product`, `product_brand`, `product_category`, `price_history` |
| Existencia, entradas y salidas | `inventory_movement` (motivo = dirección) |
| Ventas de mostrador | `billable_document` (kind `VENTA`), `sale_detail` |
| Trabajos del taller | `mechanical_service`, `service_labor`, `service_part`, `external_charge`, `status_change`, `additional_fault` |
| Motos y su historial | `motorcycle`, `motorcycle_model`, `motorcycle_brand`, `mechanical_service` |
| Cobros y créditos | `customer_payment`, `payment_application`, `credit` |
| Mecánicos y su pago | `mechanic`, `weekly_payout` (`period_start`, `period_end`), `advance`, `mechanical_service.applied_rate` |
| Proveedores y compras | `supplier`, `purchase` (con `discount`), `purchase_detail`, `supplier_payment`, `supplier_return` |
| Dinero que sale de caja | `cash_withdrawal`, `advance`, pagos a proveedores |

---

## 4. Consultas

### Catálogo e inventario

#### Q01 — Catálogo de productos con su categoría, marca, gama y precio

`JOIN` de tres tablas; filtro con `WHERE`; orden con dos criterios.

```sql
SELECT p.id_product, p.name AS producto, c.name AS categoria, b.name AS marca, p.tier AS gama, p.sale_price AS precio
FROM product p
JOIN product_category c ON c.id_product_category = p.id_product_category
JOIN product_brand    b ON b.id_product_brand = p.id_product_brand
WHERE p.active
ORDER BY p.name, p.sale_price DESC;
```

#### Q02 — Todas las versiones de un repuesto (lo que se le ofrece al cliente, P-01)

`ILIKE` (búsqueda sin distinguir mayúsculas) con `%`. Cambia `pistón` por lo que pida el docente.

```sql
SELECT p.name AS producto, b.name AS marca, p.tier AS gama, p.sale_price AS precio
FROM product p
JOIN product_brand b ON b.id_product_brand = p.id_product_brand
WHERE p.name ILIKE '%pistón%' AND p.active
ORDER BY p.sale_price DESC;
```

#### Q03 — Servicios estándar activos con su precio de referencia

`NULLS LAST`: los servicios sin precio de referencia van al final.

```sql
SELECT name AS servicio, reference_price AS precio_referencia
FROM service_type
WHERE active
ORDER BY reference_price NULLS LAST, name;
```

#### Q04 — Existencia de cada producto (kárdex: entradas − salidas), incluidos los que no tienen movimientos

**Kárdex:** `SUM(CASE …)` suma entradas y resta salidas. `LEFT JOIN` + `COALESCE` para que un producto sin movimientos salga con 0 y no desaparezca.

```sql
SELECT p.id_product, p.name AS producto, b.name AS marca,
       COALESCE(SUM(CASE WHEN m.reason IN ('COMPRA', 'DEVOLUCION_CLIENTE', 'INVENTARIO_INICIAL', 'AJUSTE_ENTRADA')
                         THEN m.quantity ELSE -m.quantity END), 0) AS existencia
FROM product p
JOIN product_brand b ON b.id_product_brand = p.id_product_brand
LEFT JOIN inventory_movement m ON m.id_product = p.id_product
GROUP BY p.id_product, p.name, b.name
ORDER BY p.id_product;
```

#### Q05 — Productos con existencia baja (3 o menos)

`HAVING` filtra **después** de agrupar (`WHERE` filtra antes).

```sql
SELECT p.name AS producto, b.name AS marca,
       COALESCE(SUM(CASE WHEN m.reason IN ('COMPRA', 'DEVOLUCION_CLIENTE', 'INVENTARIO_INICIAL', 'AJUSTE_ENTRADA')
                         THEN m.quantity ELSE -m.quantity END), 0) AS existencia
FROM product p
JOIN product_brand b ON b.id_product_brand = p.id_product_brand
LEFT JOIN inventory_movement m ON m.id_product = p.id_product
WHERE p.active
GROUP BY p.id_product, p.name, b.name
HAVING COALESCE(SUM(CASE WHEN m.reason IN ('COMPRA', 'DEVOLUCION_CLIENTE', 'INVENTARIO_INICIAL', 'AJUSTE_ENTRADA')
                         THEN m.quantity ELSE -m.quantity END), 0) <= 3
ORDER BY existencia;
```

#### Q06 — Movimientos (kárdex) de un producto, en orden

El kárdex de un solo producto. Cambia `m.id_product = 2`.

```sql
SELECT m.moved_at, m.reason AS motivo,
       CASE WHEN m.reason IN ('COMPRA', 'DEVOLUCION_CLIENTE', 'INVENTARIO_INICIAL', 'AJUSTE_ENTRADA')
            THEN m.quantity ELSE -m.quantity END AS cantidad,
       m.unit_cost AS costo_unitario, s.name AS registrado_por, m.notes
FROM inventory_movement m
JOIN staff s ON s.id_staff = m.id_registered_by
WHERE m.id_product = 2
ORDER BY m.moved_at, m.id_inventory_movement;
```

### Ventas y cobros

#### Q07 — Total de cada documento cobrable según su tipo (líneas − rebaja; monto por cancelación; saldo inicial)

**Agregar antes de unir:** cada tipo de línea se suma en su subconsulta y después se une. Si se unieran `service_labor` y `service_part` directo, las filas se multiplicarían y los totales saldrían inflados.

```sql
SELECT d.id_billable_document, d.kind AS tipo, cu.name AS cliente, d.terms AS condicion,
       CASE
           WHEN d.kind = 'SALDO_INICIAL' THEN ob.amount
           WHEN ms.cancellation_amount IS NOT NULL THEN ms.cancellation_amount
           ELSE COALESCE(sd.total, 0) + COALESCE(sl.total, 0) + COALESCE(sp.total, 0) + COALESCE(ec.total, 0) - d.discount
       END AS total
FROM billable_document d
LEFT JOIN customer cu           ON cu.id_customer = d.id_customer
LEFT JOIN opening_balance ob    ON ob.id_opening_balance = d.id_billable_document
LEFT JOIN mechanical_service ms ON ms.id_mechanical_service = d.id_billable_document
LEFT JOIN (SELECT id_sale, SUM(quantity * unit_price) AS total FROM sale_detail GROUP BY id_sale) sd ON sd.id_sale = d.id_billable_document
LEFT JOIN (SELECT id_mechanical_service, SUM(amount) AS total FROM service_labor GROUP BY id_mechanical_service) sl ON sl.id_mechanical_service = d.id_billable_document
LEFT JOIN (SELECT id_mechanical_service, SUM(quantity * unit_price) AS total FROM service_part GROUP BY id_mechanical_service) sp ON sp.id_mechanical_service = d.id_billable_document
LEFT JOIN (SELECT id_mechanical_service, SUM(amount) AS total FROM external_charge GROUP BY id_mechanical_service) ec ON ec.id_mechanical_service = d.id_billable_document
ORDER BY d.id_billable_document;
```

#### Q08 — Ventas del día (solo ventas de mostrador)

Filtro por fecha: `created_at::date = CURRENT_DATE` convierte la fecha y hora a solo fecha.

```sql
SELECT d.id_billable_document, d.receipt_number AS comprobante, d.created_at,
       SUM(sd.quantity * sd.unit_price) - d.discount AS total
FROM billable_document d
JOIN sale_detail sd ON sd.id_sale = d.id_billable_document
WHERE d.kind = 'VENTA' AND d.created_at::date = CURRENT_DATE
GROUP BY d.id_billable_document, d.receipt_number, d.created_at, d.discount
ORDER BY d.created_at;
```

#### Q09 — Dinero recibido hoy por método de pago, convertido a córdobas

Conversión de moneda: `amount * COALESCE(exchange_rate, 1)` (en córdobas el tipo de cambio es nulo, se usa 1).

```sql
SELECT method AS metodo, currency AS moneda,
       COUNT(*) AS pagos,
       SUM(amount) AS monto_en_su_moneda,
       ROUND(SUM(amount * COALESCE(exchange_rate, 1)), 2) AS monto_en_cordobas
FROM customer_payment
WHERE paid_at::date = CURRENT_DATE
GROUP BY method, currency
ORDER BY method, currency;
```

#### Q10 — Productos más vendidos (mostrador + taller)

`UNION ALL` junta los productos vendidos en mostrador y los usados en el taller antes de agrupar.

```sql
SELECT p.name AS producto, b.name AS marca, SUM(x.quantity) AS unidades
FROM (SELECT id_product, quantity FROM sale_detail
      UNION ALL
      SELECT id_product, quantity FROM service_part) x
JOIN product p       ON p.id_product = x.id_product
JOIN product_brand b ON b.id_product_brand = p.id_product_brand
GROUP BY p.id_product, p.name, b.name
ORDER BY unidades DESC;
```

### Taller

#### Q11 — Motos que están en el taller y su estado actual (último cambio de estado)

**El último por grupo:** `ROW_NUMBER() OVER (PARTITION BY … ORDER BY … DESC)` numera los cambios de cada servicio y nos quedamos con el 1.

```sql
SELECT ms.id_mechanical_service AS servicio, cu.name AS cliente, mm.name AS modelo, mo.color,
       st.status AS estado_actual, st.changed_at AS desde, s.name AS responsable
FROM mechanical_service ms
JOIN billable_document d ON d.id_billable_document = ms.id_mechanical_service
JOIN customer cu         ON cu.id_customer = d.id_customer
JOIN motorcycle mo       ON mo.id_motorcycle = ms.id_motorcycle
JOIN motorcycle_model mm ON mm.id_motorcycle_model = mo.id_motorcycle_model
LEFT JOIN staff s        ON s.id_staff = ms.id_responsible
JOIN (SELECT id_mechanical_service, status, changed_at,
             ROW_NUMBER() OVER (PARTITION BY id_mechanical_service ORDER BY changed_at DESC) AS rn
      FROM status_change) st ON st.id_mechanical_service = ms.id_mechanical_service AND st.rn = 1
WHERE st.status NOT IN ('ENTREGADA', 'CANCELADA')
ORDER BY st.changed_at;
```

#### Q12 — Historial de las motos de un cliente

`LEFT JOIN`: también aparecen las motos que nunca han tenido servicio. Cambia `mo.id_customer = 1`.

```sql
SELECT mo.id_motorcycle AS moto, mm.name AS modelo, mo.color, mo.plate AS placa,
       ms.id_mechanical_service AS servicio, d.created_at AS ingreso, ms.requested_work AS pedido, ms.diagnosis AS diagnostico
FROM motorcycle mo
JOIN motorcycle_model mm         ON mm.id_motorcycle_model = mo.id_motorcycle_model
LEFT JOIN mechanical_service ms  ON ms.id_motorcycle = mo.id_motorcycle
LEFT JOIN billable_document d    ON d.id_billable_document = ms.id_mechanical_service
WHERE mo.id_customer = 1
ORDER BY mo.id_motorcycle, d.created_at;
```

#### Q13 — Línea de tiempo de un servicio (todos sus cambios de estado)

La historia completa que guarda `status_change`. Cambia `sc.id_mechanical_service = 2`.

```sql
SELECT sc.changed_at, sc.status, s.name AS registrado_por, sc.notes
FROM status_change sc
JOIN staff s ON s.id_staff = sc.id_registered_by
WHERE sc.id_mechanical_service = 2
ORDER BY sc.changed_at;
```

#### Q14 — Fallas adicionales rechazadas: prueba de que se le advirtió al cliente (BR-028)

La evidencia de BR-028: lo que se ofreció y el cliente no aceptó.

```sql
SELECT af.id_mechanical_service AS servicio, cu.name AS cliente, cu.phone, af.reported_on, af.description, af.proposed_price
FROM additional_fault af
JOIN billable_document d ON d.id_billable_document = af.id_mechanical_service
JOIN customer cu         ON cu.id_customer = d.id_customer
WHERE af.decision = 'RECHAZADA'
ORDER BY af.reported_on DESC;
```

### Mecánicos

#### Q15 — Comisión de cada servicio (mano de obra − rebaja, o monto por cancelación, × porcentaje)

La regla de BR-045, BR-050 y BR-083 en SQL: solo la mano de obra (menos la rebaja) cuenta para la comisión.

```sql
SELECT ms.id_mechanical_service AS servicio, s.name AS responsable, ms.applied_rate AS porcentaje,
       CASE WHEN ms.cancellation_amount IS NOT NULL THEN ms.cancellation_amount
            ELSE COALESCE(sl.total, 0) - d.discount END AS base_comision,
       ROUND((CASE WHEN ms.cancellation_amount IS NOT NULL THEN ms.cancellation_amount
                   ELSE COALESCE(sl.total, 0) - d.discount END) * COALESCE(ms.applied_rate, 0), 2) AS comision
FROM mechanical_service ms
JOIN billable_document d ON d.id_billable_document = ms.id_mechanical_service
LEFT JOIN staff s        ON s.id_staff = ms.id_responsible
LEFT JOIN (SELECT id_mechanical_service, SUM(amount) AS total FROM service_labor GROUP BY id_mechanical_service) sl ON sl.id_mechanical_service = ms.id_mechanical_service
ORDER BY ms.id_mechanical_service;
```

#### Q16 — Pago semanal de cada mecánico: comisiones − adelantos

Dos subconsultas agregadas (comisiones y adelantos) unidas al pago semanal: BR-049. El periodo es el que el mecánico trabajó (`period_start`–`period_end`, DEC-030).

```sql
SELECT wp.id_weekly_payout, s.name AS mecanico, wp.period_start, wp.period_end,
       COALESCE(c.comisiones, 0) AS comisiones,
       COALESCE(a.adelantos, 0)  AS adelantos,
       COALESCE(c.comisiones, 0) - COALESCE(a.adelantos, 0) AS neto
FROM weekly_payout wp
JOIN staff s ON s.id_staff = wp.id_mechanic
LEFT JOIN (SELECT ms.id_weekly_payout,
                  SUM(ROUND((COALESCE(ms.cancellation_amount, sl.total - d.discount)) * ms.applied_rate, 2)) AS comisiones
           FROM mechanical_service ms
           JOIN billable_document d ON d.id_billable_document = ms.id_mechanical_service
           LEFT JOIN (SELECT id_mechanical_service, SUM(amount) AS total FROM service_labor GROUP BY id_mechanical_service) sl
                  ON sl.id_mechanical_service = ms.id_mechanical_service
           WHERE ms.id_weekly_payout IS NOT NULL
           GROUP BY ms.id_weekly_payout) c ON c.id_weekly_payout = wp.id_weekly_payout
LEFT JOIN (SELECT id_weekly_payout, SUM(amount) AS adelantos FROM advance
           WHERE id_weekly_payout IS NOT NULL GROUP BY id_weekly_payout) a ON a.id_weekly_payout = wp.id_weekly_payout
ORDER BY wp.period_start, s.name;
```

### Créditos y proveedores

#### Q17 — Créditos: monto, lo pagado, saldo y si está vencido (sin interés: falta definir la fórmula de BR-068)

`WITH` (CTE): se arma la consulta en pasos con nombre. El interés de BR-068 no se aplica todavía: falta definir su fórmula.

```sql
WITH total_doc AS (
    SELECT d.id_billable_document,
           CASE WHEN d.kind = 'SALDO_INICIAL' THEN ob.amount
                WHEN ms.cancellation_amount IS NOT NULL THEN ms.cancellation_amount
                ELSE COALESCE((SELECT SUM(quantity * unit_price) FROM sale_detail  WHERE id_sale    = d.id_billable_document), 0)
                   + COALESCE((SELECT SUM(amount)               FROM service_labor WHERE id_mechanical_service = d.id_billable_document), 0)
                   + COALESCE((SELECT SUM(quantity * unit_price) FROM service_part  WHERE id_mechanical_service = d.id_billable_document), 0)
                   + COALESCE((SELECT SUM(amount)               FROM external_charge WHERE id_mechanical_service = d.id_billable_document), 0)
                   - d.discount
           END AS total
    FROM billable_document d
    LEFT JOIN opening_balance ob    ON ob.id_opening_balance = d.id_billable_document
    LEFT JOIN mechanical_service ms ON ms.id_mechanical_service = d.id_billable_document
), pagado AS (
    SELECT id_billable_document, SUM(applied_amount) AS pagado FROM payment_application GROUP BY id_billable_document
)
SELECT cr.id_credit AS documento, cu.name AS cliente, t.total AS monto,
       COALESCE(p.pagado, 0) AS pagado,
       t.total - COALESCE(p.pagado, 0) AS saldo,
       COALESCE(cr.extended_due_date, cr.due_date) AS vence,
       CASE WHEN t.total - COALESCE(p.pagado, 0) <= 0 THEN 'PAGADO'
            WHEN COALESCE(cr.extended_due_date, cr.due_date) < CURRENT_DATE THEN 'VENCIDO'
            ELSE 'VIGENTE' END AS estado
FROM credit cr
JOIN billable_document d ON d.id_billable_document = cr.id_credit
JOIN customer cu         ON cu.id_customer = d.id_customer
JOIN total_doc t         ON t.id_billable_document = cr.id_credit
LEFT JOIN pagado p       ON p.id_billable_document = cr.id_credit
ORDER BY vence;
```

#### Q18 — Pagos que se repartieron entre varios documentos (Aplicación de pago)

Subconsulta con `HAVING COUNT(*) > 1`: los pagos repartidos entre varios documentos.

```sql
SELECT cp.id_customer_payment AS pago, cp.paid_at, cp.amount, cp.currency, pa.id_billable_document AS documento, pa.applied_amount AS aplicado
FROM customer_payment cp
JOIN payment_application pa ON pa.id_customer_payment = cp.id_customer_payment
WHERE cp.id_customer_payment IN (SELECT id_customer_payment FROM payment_application GROUP BY id_customer_payment HAVING COUNT(*) > 1)
ORDER BY cp.id_customer_payment, pa.id_billable_document;
```

#### Q19 — Saldo con cada proveedor: saldo de apertura + compras al crédito − pagos

Saldo con proveedores: apertura + compras al crédito (líneas − **descuento**) − pagos (Q-078 provisional). **Agregar antes de unir** (patrón 3): primero se suma cada factura y después se le resta su descuento; si se restara después de unir con las líneas, el descuento se restaría una vez por cada línea.

```sql
SELECT su.name AS proveedor,
       COALESCE(su.opening_balance, 0) AS apertura,
       COALESCE(c.compras, 0) AS compras_credito,
       COALESCE(pg.pagos, 0)  AS pagos,
       COALESCE(su.opening_balance, 0) + COALESCE(c.compras, 0) - COALESCE(pg.pagos, 0) AS saldo
FROM supplier su
LEFT JOIN (SELECT pu.id_supplier, SUM(l.subtotal - pu.discount) AS compras
           FROM purchase pu
           JOIN (SELECT id_purchase, SUM(quantity * unit_cost) AS subtotal
                 FROM purchase_detail GROUP BY id_purchase) l ON l.id_purchase = pu.id_purchase
           WHERE pu.terms = 'CREDITO'
           GROUP BY pu.id_supplier) c ON c.id_supplier = su.id_supplier
LEFT JOIN (SELECT id_supplier, ROUND(SUM(amount * COALESCE(exchange_rate, 1)), 2) AS pagos
           FROM supplier_payment GROUP BY id_supplier) pg ON pg.id_supplier = su.id_supplier
ORDER BY saldo DESC;
```

#### Q20 — Clientes que nunca han traído una moto al taller (NOT EXISTS)

`NOT EXISTS`: lo que **no** tiene una fila relacionada.

```sql
SELECT cu.name, cu.phone
FROM customer cu
WHERE NOT EXISTS (SELECT 1 FROM billable_document d
                  WHERE d.id_customer = cu.id_customer AND d.kind = 'SERVICIO')
ORDER BY cu.name;
```

### Mecánicos y proveedores (nuevas, 07-nov)

#### Q21 — Lo que cada mecánico tiene pendiente: comisión sin liquidar, adelantos sin descontar y disponible para un adelanto (BR-103, BR-104)

Base del aviso de BR-103: antes de dar un adelanto, se compara con `disponible_para_adelanto`. Cuenta los servicios **terminados o entregados** (o cobrados por cancelación) que todavía no están en un pago, aunque sean de semanas anteriores (BR-104). Dos CTE (patrón 7) y `EXISTS`.

```sql
WITH trabajo AS (            -- servicios terminados (o cobrados por cancelación) que aún no se liquidan
    SELECT ms.id_responsible AS id_mechanic,
           ROUND(COALESCE(ms.cancellation_amount, COALESCE(sl.total, 0) - d.discount)
                 * COALESCE(ms.applied_rate, m.commission_rate), 2) AS comision
    FROM mechanical_service ms
    JOIN mechanic m          ON m.id_mechanic = ms.id_responsible
    JOIN billable_document d ON d.id_billable_document = ms.id_mechanical_service
    LEFT JOIN (SELECT id_mechanical_service, SUM(amount) AS total
               FROM service_labor GROUP BY id_mechanical_service) sl ON sl.id_mechanical_service = ms.id_mechanical_service
    WHERE ms.id_weekly_payout IS NULL
      AND (ms.cancellation_amount IS NOT NULL
           OR EXISTS (SELECT 1 FROM status_change sc
                      WHERE sc.id_mechanical_service = ms.id_mechanical_service
                        AND sc.status IN ('TERMINADA', 'ENTREGADA')))
), adelantos AS (            -- adelantos que aún no se descuentan
    SELECT id_mechanic, SUM(amount) AS adelantos
    FROM advance WHERE id_weekly_payout IS NULL GROUP BY id_mechanic
)
SELECT s.name AS mecanico,
       COALESCE(SUM(t.comision), 0) AS comision_pendiente,
       COALESCE(a.adelantos, 0)     AS adelantos_pendientes,
       COALESCE(SUM(t.comision), 0) - COALESCE(a.adelantos, 0) AS disponible_para_adelanto
FROM mechanic m
JOIN staff s          ON s.id_staff = m.id_mechanic
LEFT JOIN trabajo t   ON t.id_mechanic = m.id_mechanic
LEFT JOIN adelantos a ON a.id_mechanic = m.id_mechanic
WHERE s.active
GROUP BY s.name, a.adelantos
ORDER BY s.name;
```

#### Q22 — Saldo de cada factura de compra (subtotal − descuento − pagos)

Una fila por factura: lo que falta pagarle al proveedor por esa compra (BR-101, BR-105). Base de `v_purchase_balance`.

```sql
SELECT pu.id_purchase, su.name AS proveedor, pu.invoice_number AS factura, pu.terms AS condicion,
       l.subtotal, pu.discount AS descuento,
       l.subtotal - pu.discount AS total,
       COALESCE(pg.pagado, 0) AS pagado,
       l.subtotal - pu.discount - COALESCE(pg.pagado, 0) AS saldo,
       pu.due_date AS vence
FROM purchase pu
JOIN supplier su ON su.id_supplier = pu.id_supplier
JOIN (SELECT id_purchase, SUM(quantity * unit_cost) AS subtotal
      FROM purchase_detail GROUP BY id_purchase) l ON l.id_purchase = pu.id_purchase
LEFT JOIN (SELECT id_purchase, ROUND(SUM(amount * COALESCE(exchange_rate, 1)), 2) AS pagado
           FROM supplier_payment WHERE id_purchase IS NOT NULL GROUP BY id_purchase) pg ON pg.id_purchase = pu.id_purchase
ORDER BY pu.due_date NULLS LAST, pu.id_purchase;
```

---

## 5. Para practicar (si el docente pide más)

Cada una se arma con los patrones de §2:

1. Ventas de este mes por día (patrón 8 + `GROUP BY` por fecha).
2. El mecánico que más mano de obra generó este mes (Q15 + `ORDER BY … LIMIT 1`).
8. Facturas de compra que vencen en los próximos 7 días (Q22 + patrón 8).
3. Productos que nunca se han vendido (patrón 6 sobre `sale_detail` y `service_part`).
4. Cuántas motos de cada modelo han entrado al taller.
5. Retiros de caja del mes por motivo.
6. Cambios de precio de un producto, con el precio anterior obtenido con `LAG()` (función de ventana, como Q11).
7. Ganancia de las ventas del día: precio de venta − costo del movimiento de cada línea.
