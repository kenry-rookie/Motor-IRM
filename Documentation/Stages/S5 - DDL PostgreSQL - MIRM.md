---
project: "[[Motor IRM]]"
stage: S5
type: stage-product
status: 🟡 En construcción — DDL de entrega (29-oct)
version: 1
date: 2026-10-28
based_on:
  - "[[S5 - Relational Schema - MIRM]]"
source_of_truth: "db/postgres/01_schema.sql (repositorio de GitHub)"
source: IA (nota y dos tablas de ejemplo redactadas por Claude a pedido de Kenry; el resto del DDL lo escribe el equipo)
ai_edit: "Claude — 2026-10-28: nota creada con los ejemplos product y billable_document, probados en PostgreSQL 16"
reviewed: false
---
**[[Motor IRM|← Hub]]** · **[[S5 - Relational Model and Normalization - MIRM|← S5]]** · **[[S5 - Relational Schema - MIRM|Esquema relacional]]**

# S5 - DDL PostgreSQL - MIRM

> [!important] Una sola fuente de verdad para el DDL
> - El DDL que **se ejecuta** vive en el repositorio: `db/postgres/01_schema.sql`. Esta nota es su **copia documentada**: el código más el porqué de cada decisión.
> - Regla de trabajo: se escribe y se prueba en el archivo `.sql`; **cuando corre sin errores**, se copia aquí. Si alguien cambia una tabla, cambia el `.sql` **y** esta nota en el mismo momento (regla 5 del Restart Plan).
> - Cada tabla se escribe **desde su ficha** en el [[S5 - Relational Schema - MIRM|esquema relacional]] (§5): ninguna columna, llave o regla sin respaldo en el modelo.

---

## 1. Antes de escribir

1. **Base de datos en UTF8** (tildes y ñ). Al crearla: codificación `UTF8`.
2. **Zona horaria** del negocio, para que `LOCALTIMESTAMP` dé la hora de Nicaragua: investiguen `ALTER DATABASE … SET timezone`, con el valor `'America/Managua'`.
3. **Convenciones** (§2 del esquema). En PostgreSQL los nombres sin comillas se guardan en **minúsculas**, por eso las restricciones se escriben `pk_`, `fk_`, `uq_`, `ck_` (y no `PK_`).
4. **Orden de creación** (§9 del esquema): cada tabla solo apunta a tablas ya creadas.
5. **Patrón de cada tabla:** primero las columnas (nombre, tipo, `NOT NULL`, `DEFAULT`); después **todas** las restricciones **con nombre**, en este orden: PK → FK → UQ → CK.

---

## 2. Ejemplo 1 — `product`

Ficha en el esquema: §5.1 · Reglas: BR-004, BR-015, BR-089, BR-090, BR-093.

```sql
CREATE TABLE product (
    id           INTEGER       GENERATED ALWAYS AS IDENTITY,
    category_id  INTEGER       NOT NULL,
    brand_id     INTEGER       NOT NULL,
    name         VARCHAR(150)  NOT NULL,
    barcode      VARCHAR(50),
    tier         VARCHAR(20)   NOT NULL,
    sale_price   NUMERIC(12,2) NOT NULL,
    active       BOOLEAN       NOT NULL DEFAULT TRUE,

    CONSTRAINT pk_product             PRIMARY KEY (id),
    CONSTRAINT fk_product_category_id FOREIGN KEY (category_id) REFERENCES product_category (id),
    CONSTRAINT fk_product_brand_id    FOREIGN KEY (brand_id)    REFERENCES product_brand (id),
    CONSTRAINT uq_product_barcode     UNIQUE (barcode),
    CONSTRAINT ck_product_name        CHECK (btrim(name) <> ''),
    CONSTRAINT ck_product_barcode     CHECK (barcode IS NULL OR btrim(barcode) <> ''),
    CONSTRAINT ck_product_tier        CHECK (tier IN ('ALTA', 'MEDIA', 'BAJA')),
    CONSTRAINT ck_product_sale_price  CHECK (sale_price >= 0)
);
```

**Por qué cada parte:**

| Parte | Por qué |
| --- | --- |
| `GENERATED ALWAYS AS IDENTITY` | La base genera el `id` y **no deja** que nadie lo escriba a mano (T-01). `ALWAYS` es más estricto que `BY DEFAULT`. |
| `NUMERIC(12,2)` | Dinero exacto. Con `REAL` o `FLOAT`, C$ 0.10 + 0.20 no da exactamente 0.30. |
| `barcode` sin `NOT NULL` + `UNIQUE` | No todo producto tiene código, pero dos productos no pueden compartirlo. En PostgreSQL, `UNIQUE` admite varios nulos (§10 del esquema). |
| `ck_product_barcode` y `ck_product_name` | `NOT NULL` no impide guardar un texto **vacío** o con solo espacios. Sin esta CK, dos códigos `''` chocarían en la `UNIQUE`, y un producto sin nombre visible pasaría. |
| `ck_product_tier` | La gama solo puede ser uno de tres valores (T-11, BR-090). |
| `active DEFAULT TRUE` | Un producto no se borra: se desactiva (T-12). |
| FK sin `ON DELETE` | Por defecto es `NO ACTION`: no se puede borrar una categoría o marca que tiene productos. |

---

## 3. Ejemplo 2 — `billable_document`

Ficha en el esquema: §5.4 · Reglas: BR-010, BR-038, BR-056, BR-060, BR-062 · Restricciones C-01 y C-05. Es la superclase de G-1: después vienen `sale`, `mechanical_service` y `opening_balance`, cuya PK es una FK a esta tabla.

```sql
CREATE TABLE billable_document (
    id                        INTEGER       GENERATED ALWAYS AS IDENTITY,
    kind                      VARCHAR(20)   NOT NULL,
    customer_id               INTEGER,
    registered_by_id          INTEGER       NOT NULL,
    created_at                TIMESTAMP(0)  NOT NULL DEFAULT LOCALTIMESTAMP(0),
    receipt_number            VARCHAR(20),
    terms                     VARCHAR(20)   NOT NULL,
    discount                  NUMERIC(12,2) NOT NULL DEFAULT 0,
    discount_authorized_by_id INTEGER,

    CONSTRAINT pk_billable_document PRIMARY KEY (id),
    CONSTRAINT fk_billable_document_customer_id
        FOREIGN KEY (customer_id) REFERENCES customer (id),
    CONSTRAINT fk_billable_document_registered_by_id
        FOREIGN KEY (registered_by_id) REFERENCES staff (id),
    CONSTRAINT fk_billable_document_discount_authorized_by_id
        FOREIGN KEY (discount_authorized_by_id) REFERENCES owner (staff_id),
    CONSTRAINT uq_billable_document_receipt_number UNIQUE (receipt_number),
    CONSTRAINT ck_billable_document_kind
        CHECK (kind IN ('VENTA', 'SERVICIO', 'SALDO_INICIAL')),
    CONSTRAINT ck_billable_document_terms
        CHECK (terms IN ('CONTADO', 'CREDITO')),
    CONSTRAINT ck_billable_document_receipt_number
        CHECK (receipt_number IS NULL OR btrim(receipt_number) <> ''),
    CONSTRAINT ck_billable_document_discount
        CHECK (discount >= 0),
    CONSTRAINT ck_billable_document_customer
        CHECK (customer_id IS NOT NULL OR (kind = 'VENTA' AND terms = 'CONTADO')),
    CONSTRAINT ck_billable_document_discount_authorized
        CHECK (discount = 0 OR discount_authorized_by_id IS NOT NULL),
    CONSTRAINT ck_billable_document_opening_balance
        CHECK (kind <> 'SALDO_INICIAL' OR (terms = 'CREDITO' AND discount = 0))
);
```

**Por qué cada parte:**

| Parte | Por qué |
| --- | --- |
| `customer_id` sin `NOT NULL` | Una venta rápida de contado no identifica al cliente (BR-038). Cuándo es obligatorio lo decide la CK de abajo. |
| `ck_billable_document_customer` (C-01) | Se lee: "hay cliente, **o** es una venta de contado". Así, un servicio, un saldo inicial o cualquier crédito **siempre** tienen cliente (BR-062). Compara dos columnas: por eso es restricción **de tabla**. |
| `fk_…_discount_authorized_by_id` → `owner` | Apunta a `owner`, no a `staff`: **solo un dueño** puede autorizar una rebaja (BR-010), y lo garantiza la FK sin una línea de código (T-03). |
| `ck_billable_document_discount_authorized` (C-05) | Si hay rebaja, tiene que haber quién la autorizó. |
| `ck_billable_document_opening_balance` | Una deuda anterior al sistema siempre es crédito y no tiene rebaja (decisión 6). |
| `discount NOT NULL DEFAULT 0` | Sin rebaja es 0, no vacío: así los totales se calculan sin tratar nulos. |
| `created_at DEFAULT LOCALTIMESTAMP(0)` | La fecha y hora la pone la base, sin segundos fraccionarios. |

---

## 4. Prueba de los ejemplos (28-oct, PostgreSQL 16)

Se probaron con las tablas padre mínimas. **Lo que entra:** dos productos sin código de barras (los dos nulos no chocan); una venta de contado sin cliente; un servicio a crédito con rebaja autorizada por un dueño.

**Lo que la base rechaza:**

| Intento | Lo detiene |
| --- | --- |
| Producto con gama `'ALTO'` | `ck_product_tier` |
| Precio de venta negativo | `ck_product_sale_price` |
| Producto con una marca que no existe | `fk_product_brand_id` |
| Código de barras de puros espacios | `ck_product_barcode` |
| Venta **al crédito** sin cliente | `ck_billable_document_customer` |
| Servicio sin cliente | `ck_billable_document_customer` |
| Rebaja sin quién la autorizó | `ck_billable_document_discount_authorized` |
| Rebaja autorizada por el **encargado** | `fk_billable_document_discount_authorized_by_id` (no está en `owner`) |
| Saldo inicial de contado | `ck_billable_document_opening_balance` |
| Escribir el `id` a mano | `GENERATED ALWAYS` |

> Hagan la misma tabla para cada tabla que escriban: **una fila válida que entra y al menos un intento que la base rechaza**. Esa es la prueba de que la restricción existe y hace lo que dice el modelo.

---

## 5. DDL del equipo

Se llena a medida que cada tabla **corre sin errores**, siguiendo el orden de §9 del esquema. La tabla más difícil es `inventory_movement`: su CK del origen sigue la misma idea que `ck_billable_document_customer`, pero con una condición por cada motivo (la tabla de motivos está en §5.1 del esquema).

| Nivel | Tabla | Quién | ¿Corre? | ¿Probada (entra / se rechaza)? |
| --- | --- | --- | --- | --- |
| 0 | product_category | | | |
| 0 | product_brand | | | |
| 0 | motorcycle_brand | | | |
| 0 | service_type | | | |
| 0 | customer | | | |
| 0 | staff | | | |
| 0 | supplier | | | |
| 1 | owner | | | |
| 1 | mechanic | | | |
| 1 | motorcycle_model | | | |
| 1 | product | Ejemplo | ✅ | ✅ |
| 2 | motorcycle | | | |
| 2 | price_history | | | |
| 2 | purchase | | | |
| 2 | billable_document | Ejemplo | ✅ | ✅ |
| 2 | weekly_payout | | | |
| 2 | cash_withdrawal | | | |
| 3 | purchase_detail | | | |
| 3 | supplier_payment | | | |
| 3 | sale | | | |
| 3 | opening_balance | | | |
| 3 | mechanical_service | | | |
| 3 | credit | | | |
| 3 | customer_payment | | | |
| 3 | advance | | | |
| 4 | supplier_return | | | |
| 4 | sale_detail | | | |
| 4 | payment_application | | | |
| 4 | status_change | | | |
| 4 | additional_fault | | | |
| 4 | external_charge | | | |
| 4 | warranty_claim | | | |
| 5 | service_labor | | | |
| 5 | service_part | | | |
| 5 | customer_return | | | |
| 6 | inventory_movement | | | |

### Tablas

*(Aquí se pega cada `CREATE TABLE` cuando ya corre, en el orden de la tabla de arriba.)*

---

## 6. Para la clase del 29-oct

- **Datos de prueba en orden:** `product_category` y `product_brand` → `product` (con las tres gamas del kit de pistón XTZ 125: Yamaha, Vini, genérico) → `service_type` (engrase, cambio de aceite, trabajo de motor…) → personas → documentos.
- **Consultas para mostrar:** productos de un mismo repuesto con su marca, gama y precio; servicios estándar con su precio de referencia; y, cuando haya movimientos, la existencia por producto.
- **Probar delante del docente que la base resiste:** intentar uno o dos de los rechazos de §4. Muestra que las reglas del negocio están **en la base de datos**, no solo en la documentación.
