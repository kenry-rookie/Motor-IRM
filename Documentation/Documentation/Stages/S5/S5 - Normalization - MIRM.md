---
project: "[[Motor IRM]]"
stage: S5
type: stage-product
status: ✅ Cerrada (07-nov) — los cinco casos resueltos (DEC-029, DEC-030)
version: 2
date: 2026-11-05
based_on:
  - "[[S5 - DDL PostgreSQL - MIRM]]"
source: IA (normalización redactada por Claude a pedido de Kenry, sobre el DDL, que es la versión más fiel del esquema)
ai_edit: "Claude — 2026-11-05: nota creada (método, DF de las 36 tablas, casos encontrados y cómo resolverlos); 2026-11-07: casos resueltos y aplicados en el DDL v2, cifra de FK corregida, nombres week_* → period_*"
reviewed: false
---
**[[Motor IRM|← Hub]]** · **[[S5 - Relational Model and Normalization - MIRM|← S5]]** · **[[S5 - DDL PostgreSQL - MIRM|DDL]]** · **[[S5 - Relational Schema - MIRM|Esquema]]**

# S5 - Normalization - MIRM

> [!info] Qué es esta nota
> - Reemplaza la §8 del [[S5 - Relational Schema - MIRM|esquema relacional]]. Usa los nombres del **DDL** (`id_<tabla>`), que es la versión más fiel.
> - **§1** explica cómo se lee una dependencia funcional; **§2** revisa las 36 tablas; **§3** son los casos que sí tenían un problema y cómo se resolvieron; **§4** son las decisiones (todas tomadas el 07-nov).

> [!success] 07-nov — Casos resueltos
> Casos 1, 2 y 3 → FK compuestas ([[DEC-029 - Controlled Redundancy with Composite Foreign Keys - MIRM|DEC-029]]). Caso 4 → el periodo de pago es variable, `period_end` no se deduce ([[DEC-030 - Mechanic Pay Period - MIRM|DEC-030]]). Caso 5 → `refund_amount` es dato propio (DEC-029). Aplicado y probado en el [[S5 - DDL PostgreSQL - MIRM|DDL]] v2. *(Redactado por Claude; pendiente de revisión.)*

---

## 1. Cómo se lee esto (lo mínimo)

**Dependencia funcional (DF):** `X → Y` se lee *"si conozco X, conozco Y"*. En `product`, `id_product → name`: con el número de producto sé su nombre.

| Forma normal | La pregunta que hace | Si falla… |
| --- | --- | --- |
| **1FN** | ¿Cada celda tiene **un solo** valor y no hay grupos repetidos? | Hay listas dentro de una celda (dos teléfonos en una columna). |
| **2FN** | Si la llave tiene varias columnas, ¿cada dato depende de **toda** la llave? | Un dato depende de una parte de la llave. |
| **3FN** | ¿Algún dato se deduce de **otra columna que no es llave**? | Dependencia **transitiva**: `llave → A → B`. B está repetido. |

**La pista para encontrar problemas de 3FN:** busca una **FK que apunta a una fila que ya dice algo que esta fila también guarda**. Si apunto a una compra y la compra ya dice el proveedor, guardar aquí el proveedor es repetirlo.

> [!tip] Con llaves sustitutas casi no hay problemas de 2FN
> Todas las tablas tienen `id_<tabla>` de una sola columna ([[DEC-016 - Surrogate Primary Keys - MIRM|DEC-016]]). Una llave de una columna no tiene "partes", así que la 2FN se cumple sola. Hay que revisarla en las **claves candidatas** compuestas (las UQ), y ahí todo depende de la clave completa.

> [!note] El caso especial de los nulos
> La teoría clásica supone que no hay nulos. Cuando la columna que determina (`X`) **puede ser nula**, la DF solo vale en las filas donde X está llena, y no se puede borrar Y porque hace falta cuando X está vacía. En esos casos la solución no es quitar la columna, sino **hacer que la base garantice que coincidan** (§3, patrón A).

---

## 2. Revisión tabla por tabla

✅ = cumple 3FN · 🔁 = redundancia aceptada a propósito, con su DEC (desde la v2, varias **controladas** por una FK compuesta). La columna *Estado* muestra el resultado después del 07-nov; entre paréntesis, el caso de §3.

### Catálogos

| Tabla | Claves candidatas | Otras DF | Estado |
| --- | --- | --- | --- |
| product_category · product_brand · motorcycle_brand | `id_…` · `lower(name)` | — | ✅ |
| service_type | `id_service_type` · `lower(name)` | — | ✅ |
| motorcycle_model | `id_motorcycle_model` · (`id_motorcycle_brand`, `lower(name)`) | — | ✅ |
| product | `id_product` · `barcode` (si no es nulo) | — | 🔁 `sale_price` = último `new_price` ([[DEC-022 - Price History Without Old Price - MIRM\|DEC-022]]) |
| price_history | `id_price_history` · (`id_product`, `changed_at`) | — | ✅ |

### Personas y motos

| Tabla | Claves candidatas | Otras DF | Estado |
| --- | --- | --- | --- |
| customer | `id_customer` · `upper(national_id)` | — | ✅ |
| motorcycle | `id_motorcycle` · `upper(plate)` | — | ✅ La marca no se guarda: saldría de `id_motorcycle_model → id_motorcycle_brand` (sería transitiva). |
| staff | `id_staff` | — | 🔁 `role` coincide con `owner`/`mechanic` ([[DEC-018 - Staff Table Mapping - MIRM\|DEC-018]]) |
| owner · mechanic | `id_owner` · `id_mechanic` | — | ✅ |

### Compras

| Tabla | Claves candidatas | Otras DF | Estado |
| --- | --- | --- | --- |
| supplier | `id_supplier` | — | ✅ |
| purchase | `id_purchase` · (`id_supplier`, `invoice_number`) · (`id_purchase`, `id_supplier`) | — | ✅ (`discount` depende de la factura: DEC-031) |
| purchase_detail | `id_purchase_detail` · (`id_purchase`, `line_no`) | — | ✅ `unit_cost` es histórico: depende de la línea, no del producto. |
| supplier_payment | `id_supplier_payment` | **`id_purchase → id_supplier`** | 🔁 controlada por FK compuesta (caso 1, DEC-029) |
| supplier_return | `id_supplier_return` | — | ✅ |

### Documentos y cobros

| Tabla | Claves candidatas | Otras DF | Estado |
| --- | --- | --- | --- |
| billable_document | `id_billable_document` · `receipt_number` (si no es nulo) | — | 🔁 `kind` coincide con la subclase ([[DEC-017 - Billable Document Table Mapping - MIRM\|DEC-017]]) |
| sale · opening_balance · credit | su PK (= documento) | — | ✅ |
| sale_detail | `id_sale_detail` · (`id_sale`, `line_no`) | — | ✅ `unit_price` es histórico. |
| customer_return | `id_customer_return` | — (`refund_amount` no se deduce: la rebaja general cambia lo pagado) | ✅ (caso 5, DEC-029) |
| customer_payment | `id_customer_payment` | — | ✅ |
| payment_application | `id_payment_application` · (`id_customer_payment`, `id_billable_document`) | — | ✅ `applied_amount` depende de la pareja completa. |

### Taller

| Tabla | Claves candidatas | Otras DF | Estado |
| --- | --- | --- | --- |
| mechanical_service | `id_mechanical_service` | **`id_weekly_payout → id_responsible`** (el pago es de un mecánico) | 🔁 controlada por FK compuesta (caso 2, DEC-029) |
| status_change | `id_status_change` · (`id_mechanical_service`, `changed_at`) | — | ✅ |
| additional_fault | `id_additional_fault` · (`id_mechanical_service`, `fault_no`) | — | ✅ |
| service_labor · service_part | `id_…` · (`id_mechanical_service`, `line_no`) | **`id_additional_fault → id_mechanical_service`** | 🔁 controlada por FK compuesta (caso 2, DEC-029) |
| external_charge | `id_external_charge` · (`id_mechanical_service`, `line_no`) | — | ✅ |
| warranty_claim | `id_warranty_claim` · `id_new_service` · `id_sale` (si no son nulos) | — | ✅ |

### Inventario, mecánicos y caja

| Tabla | Claves candidatas | Otras DF | Estado |
| --- | --- | --- | --- |
| inventory_movement | `id_inventory_movement` · cada origen con UQ (si no es nulo) | El producto (y la cantidad) **ya están en la línea de origen** | 🔁 producto controlado por FK compuesta; cantidad en la aplicación (caso 3, DEC-029) |
| weekly_payout | `id_weekly_payout` · (`id_mechanic`, `period_start`) · (`id_weekly_payout`, `id_mechanic`) | — (`period_end` no se deduce: el periodo es el que el mecánico trabajó) | ✅ (caso 4, DEC-030) |
| advance | `id_advance` | **`id_weekly_payout → id_mechanic`** | 🔁 controlada por FK compuesta (caso 2, DEC-029) |
| cash_withdrawal | `id_cash_withdrawal` | — | ✅ |

**Resultado (05-nov):** 1FN y 2FN se cumplen en las 36 tablas. En 3FN: 25 tablas bien, 3 con redundancias aceptadas con su DEC, 6 con un caso real (casos 1 a 3) y 2 que dependían de una pregunta (casos 4 y 5).

**Resultado (07-nov, DDL v2):** 1FN y 2FN en las 36 tablas. En 3FN: **27 tablas cumplen** (las 25 más `weekly_payout` y `customer_return`) y **9 tienen una redundancia aceptada con su DEC**: 3 controladas por la aplicación (`product.sale_price`, `staff.role`, `billable_document.kind`) y 6 controladas por la base con FK compuestas (`supplier_payment`, `mechanical_service`, `advance`, `service_labor`, `service_part`, `inventory_movement`). No queda ninguna violación sin decisión.

---

## 3. Los casos y cómo se resuelven

### Patrón A — "FK compuesta": la base obliga a que coincidan

Sirve cuando la columna que determina **puede ser nula** y por eso no se puede borrar la otra.

**La idea:** en vez de una FK de una columna, una FK de **dos** columnas que apunta a la pareja en la tabla padre. Si la pareja no existe allá, la base rechaza la fila.

- En el padre: una `UNIQUE` sobre la pareja (por ejemplo, `purchase (id_purchase, id_supplier)`). Es necesaria porque una FK solo puede apuntar a columnas con PK o UNIQUE.
- En el hijo: `FOREIGN KEY (id_purchase, id_supplier) REFERENCES purchase (id_purchase, id_supplier)`.
- **Con nulos:** por defecto (`MATCH SIMPLE`), si una de las dos columnas es nula, la FK **no se revisa**. Por eso funciona para "pago a la cuenta, sin compra".

**Qué se gana:** la redundancia sigue ahí, pero **ya no puede contradecirse**. Se registra como redundancia controlada (DEC). Es lo que la §10 del esquema llamaba *"subtype discriminator foreign key"*, aplicado a otros casos.

**Investiga:** *PostgreSQL — Foreign Keys* (columnas múltiples y `MATCH SIMPLE`): https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK

### Caso 1 — `supplier_payment`: el proveedor se repite

- **DF:** `id_purchase → id_supplier` (la compra ya dice de qué proveedor es).
- ✅ **Resuelto (07-nov):** Q-070 respondida ("sacamos una al crédito, entonces esa pagamos") → fila **No** de la tabla: patrón A.
- **Por qué no se borra `id_supplier`:** un pago puede ser "a la cuenta", sin compra (`id_purchase` nulo); entonces hace falta saber el proveedor.
- **Depende de Q-070** (*¿un pago puede cubrir varias facturas?*):

| Respuesta de los dueños | Solución | Cambio en el DDL |
| --- | --- | --- |
| **No** (un pago, una compra o a la cuenta) | Patrón A | UQ `(id_purchase, id_supplier)` en `purchase` · FK compuesta en `supplier_payment` (reemplaza C-08) |
| **Sí** | Mismo diseño que con los clientes: el pago apunta solo al proveedor y una tabla **`supplier_payment_application`** (pago, compra, monto aplicado) reparte el pago | Quitar `id_purchase` de `supplier_payment` y crear la tabla nueva |

### Caso 2 — Mismo patrón en el taller y los mecánicos

| Tabla | DF | Regla que protege | Solución |
| --- | --- | --- | --- |
| `mechanical_service` | `id_weekly_payout → id_responsible` | C-10: el servicio se liquida en el pago **de su mecánico** | Patrón A: FK `(id_weekly_payout, id_responsible)` → `weekly_payout (id_weekly_payout, id_mechanic)` |
| `advance` | `id_weekly_payout → id_mechanic` | C-10: el adelanto se descuenta en el pago **del mismo mecánico** | Patrón A: FK `(id_weekly_payout, id_mechanic)` → `weekly_payout (id_weekly_payout, id_mechanic)` |
| `service_labor` · `service_part` | `id_additional_fault → id_mechanical_service` | §6: la falla es **del mismo servicio** | Patrón A: FK `(id_additional_fault, id_mechanical_service)` → `additional_fault (id_additional_fault, id_mechanical_service)` |

En los tres casos hace falta la UQ de la pareja en el padre (`weekly_payout`, `additional_fault`). **Ventaja extra:** tres reglas que estaban como "va en la aplicación" pasan a cumplirse en la base.

### Caso 3 — `inventory_movement`: el producto se repite con su origen

- **DF entre tablas:** el movimiento de una línea de venta guarda `id_product`, y la línea de venta ya lo dice. Dentro de la tabla **no** es una violación de 3FN (el origen tiene UQ, es clave candidata), pero sí es un dato repetido en dos tablas que puede contradecirse.
- **Por qué no se borra `id_product`:** el inventario inicial y los ajustes **no tienen origen**, y la vista de existencia necesita el producto en todas las filas.
- **Solución:**

| Origen | Cómo se garantiza que el producto coincida |
| --- | --- |
| `purchase_detail`, `sale_detail`, `service_part` | Patrón A: FK `(id_<origen>, id_product)` → la línea `(id_<origen>, id_product)` |
| `customer_return` | Va en la aplicación: el producto depende del motivo (el devuelto o el entregado a cambio) |
| `supplier_return`, `warranty_claim` | Va en la aplicación (el producto está a dos tablas de distancia) |
| La **cantidad** en todos los casos | Va en la aplicación (C-13), en la misma transacción que la línea |

### Caso 4 — `weekly_payout`: ¿el fin de semana se deduce? (resuelto 07-nov: no, DEC-030)

- Si la semana de pago **siempre** dura lo mismo (por ejemplo, lunes a sábado), entonces `week_start → week_end`: `week_end` está repetido.
- BR-046 dice que el **día de pago** puede moverse por un feriado, pero eso es `paid_on`, no la semana.
- **Si la semana es fija:** quitar `week_end` y calcularlo (`week_start + 5`). **Si puede variar:** queda como está (✅).
- ✅ **Resuelto:** SRC-07 dijo "de lunes a sábado", pero SRC-08 (Kenry) muestra que el periodo depende de los días trabajados (de miércoles a sábado, de martes a jueves, pagado el jueves…). El fin **no** se deduce → se queda, con el nombre `period_end` (y `period_start`).

### Caso 5 — `customer_return.refund_amount`: ¿se deduce? (resuelto 07-nov: no, DEC-029)

- Si al devolver **siempre** se reembolsa lo que se pagó, entonces `refund_amount` = `quantity` × `sale_detail.unit_price` y está repetido.
- Si el dueño puede devolver otra cantidad (por ejemplo, descontar algo), es un dato propio y está bien (✅).
- ✅ **Resuelto:** aunque se devuelve "lo mismo que pagó" (BR-102), lo que pagó por **esa línea** no siempre es cantidad × precio: si la venta tuvo una rebaja general (`billable_document.discount`), habría que repartirla. El monto devuelto es el dinero que salió de caja: dato propio. La aplicación lo propone y valida que no pase de cantidad × precio.

---

## 4. Qué queda por decidir

| # | Decisión | Depende de | Cuándo |
| --- | --- | --- | --- |
| N-1 | Caso 1: patrón A o tabla de aplicación | Q-070 (entrevista) | ✅ 07-nov — patrón A (Q-070: una factura por pago) · DEC-029 |
| N-2 | Caso 2 y caso 3: aplicar el patrón A (**7** FK compuestas + sus UQ; la nota decía 5 por error) | Equipo | ✅ 07-nov — aplicado, sin incluir la cantidad · DEC-029 |
| N-3 | Caso 4: quitar o dejar `week_end` | Entrevista | ✅ 07-nov — se deja, renombrado `period_end`: el periodo es variable (SRC-08) · DEC-030 |
| N-4 | Caso 5: `refund_amount` propio o calculado | Entrevista | ✅ 07-nov — propio (la rebaja general cambia lo pagado) · DEC-029 |

- Registrado en **DEC-029** (redundancias controladas) y **DEC-030** (periodo de pago), con su cambio en el DDL (regla 6). En total: 8 FK compuestas (1 del caso 1, 4 del caso 2, 3 del caso 3) y 6 UQ de pareja.
- Se aplicó **antes de programar** (07-nov), para no tocar después el DDL y el programa a la vez.

## Lecturas

- Elmasri y Navathe, *Fundamentals of Database Systems*: capítulo de **normalización** (DF, 2FN, 3FN, FNBC) y la sección sobre **nulos** en el diseño relacional.
- PostgreSQL — *Constraints* (FK de varias columnas, `MATCH SIMPLE`): https://www.postgresql.org/docs/current/ddl-constraints.html
