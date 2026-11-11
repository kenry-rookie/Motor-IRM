---
project: "[[Motor IRM]]"
stage: S5
type: stage-product
status: ✅ Versión 2 completa y probada (07-nov) — pendiente de revisión del equipo
version: 2
date: 2026-10-28
based_on:
  - "[[S5 - Relational Schema - MIRM]]"
source_of_truth: db/postgres/01_schema.sql (repositorio de GitHub)
source: IA (nota y dos tablas de ejemplo redactadas por Claude a pedido de Kenry; v1 del DDL escrita por el equipo y Claude; v2 del 07-nov escrita y probada por Claude a pedido de Kenry)
ai_edit: "Claude — 2026-11-07: versión 2 del script (DEC-029 a DEC-035), §1 reordenada, tabla de pruebas con 61 casos, §6 (seed perdido)"
reviewed: false
---
**[[Motor IRM|← Hub]]** · **[[S5 - Relational Model and Normalization - MIRM|← S5]]** · **[[S5 - Relational Schema - MIRM|Esquema relacional]]**

# S5 - DDL PostgreSQL - MIRM

> [!important] Una sola fuente de verdad para el DDL
> - El DDL que **se ejecuta** vive en el repositorio: `db/postgres/01_schema.sql`. Esta nota es su **copia documentada**: el código más el porqué de cada decisión.
> - Regla de trabajo: se escribe y se prueba en el archivo `.sql`; **cuando corre sin errores**, se copia aquí. Si alguien cambia una tabla, cambia el `.sql` **y** esta nota en el mismo momento (regla 5 del Restart Plan).
> - Cada tabla se escribe **desde su ficha** en el [[S5 - Relational Schema - MIRM|esquema relacional]] (§5): ninguna columna, llave o regla sin respaldo en el modelo.
> - El DDL es la **única fuente de verdad** del esquema: el programa (TypeScript + Node.js) no crea ni altera tablas ([[DEC-034 - DDL as Single Source of Truth - MIRM|DEC-034]]).

---

## 1. Antes de escribir

1. **Crear la base** con codificación explícita (tildes y ñ):
   ```bash
   createdb -E UTF8 -T template0 motor_irm
   ```
2. **Zona horaria** del negocio: desde la v2, el propio `01_schema.sql` ejecuta `ALTER DATABASE … SET timezone = 'America/Managua'`, así `LOCALTIMESTAMP` y `CURRENT_DATE` dan la hora y la fecha de Nicaragua en cualquier conexión (también la del programa en Node.js). Nicaragua no tiene horario de verano (UTC−6 fijo).
3. **Convenciones (decisión de Kenry, 29-oct):** la PK de cada tabla se llama `id_<tabla>` (`id_product`); cada FK se llama igual que la PK a la que apunta (`id_product_category`) o, si hay un rol, `id_<rol>` (`id_registered_by`, `id_authorized_by`). Las subclases y `credit` tienen su propio `id_<tabla>`, que es a la vez FK al padre. Restricciones: `pk_<tabla>`, `fk_<tabla>_<columna>` (FK compuesta: `fk_<tabla>_<col1>_<col2>`), `uq_…`, `ck_…`, en minúsculas (PostgreSQL guarda en minúsculas los nombres sin comillas).
4. **Orden de creación** (§9 del esquema): cada tabla solo apunta a tablas ya creadas.
5. **Patrón de cada tabla:** primero las columnas (nombre, tipo, `NOT NULL`, `DEFAULT`); después **todas** las restricciones **con nombre**, en este orden: PK → FK → UQ → CK.
6. **Ejecutar el script completo dentro de una transacción** (`BEGIN;` al inicio y `COMMIT;` al final, **con punto y coma**): se crean las 36 tablas o ninguna.
   ```bash
   psql -d motor_irm -v ON_ERROR_STOP=1 -f db/postgres/01_schema.sql
   ```

---

## 2. Ejemplo 1 — `product`

Ficha en el esquema: §5.1 · Reglas: BR-004, BR-015, BR-089, BR-090, BR-093.

```sql
CREATE TABLE product (
    id_product           INTEGER       GENERATED ALWAYS AS IDENTITY,
    id_product_category  INTEGER       NOT NULL,
    id_product_brand     INTEGER       NOT NULL,
    name                 VARCHAR(150)  NOT NULL,
    barcode              VARCHAR(50),
    tier                 VARCHAR(20)   NOT NULL,
    sale_price           NUMERIC(12,2) NOT NULL,
    active               BOOLEAN       NOT NULL DEFAULT TRUE,

    CONSTRAINT pk_product                     PRIMARY KEY (id_product),
    CONSTRAINT fk_product_id_product_category FOREIGN KEY (id_product_category) REFERENCES product_category (id_product_category),
    CONSTRAINT fk_product_id_product_brand    FOREIGN KEY (id_product_brand)    REFERENCES product_brand (id_product_brand),
    CONSTRAINT uq_product_barcode             UNIQUE (barcode),
    CONSTRAINT ck_product_name                CHECK (btrim(name) <> ''),
    CONSTRAINT ck_product_barcode             CHECK (barcode IS NULL OR btrim(barcode) <> ''),
    CONSTRAINT ck_product_tier                CHECK (tier IN ('ALTA', 'MEDIA', 'BAJA')),
    CONSTRAINT ck_product_sale_price          CHECK (sale_price >= 0)
);
```

**Por qué cada parte:**

| Parte | Por qué |
| --- | --- |
| `GENERATED ALWAYS AS IDENTITY` | La base genera `id_product` y **no deja** que nadie lo escriba a mano (T-01). `ALWAYS` es más estricto que `BY DEFAULT`. |
| `id_product` · `id_product_category` · `id_product_brand` | La PK se llama `id_<tabla>` y cada FK se llama igual que la PK a la que apunta: al leer `id_product_category` se sabe a qué tabla lleva (convención de §1). |
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
    id_billable_document       INTEGER       GENERATED ALWAYS AS IDENTITY,
    kind                       VARCHAR(20)   NOT NULL,
    id_customer                INTEGER,
    id_registered_by           INTEGER       NOT NULL,
    created_at                 TIMESTAMP(0)  NOT NULL DEFAULT LOCALTIMESTAMP(0),
    receipt_number             VARCHAR(20),
    terms                      VARCHAR(20)   NOT NULL,
    discount                   NUMERIC(12,2) NOT NULL DEFAULT 0,
    id_discount_authorized_by  INTEGER,

    CONSTRAINT pk_billable_document                PRIMARY KEY (id_billable_document),
    CONSTRAINT fk_billable_document_id_customer
        FOREIGN KEY (id_customer) REFERENCES customer (id_customer),
    CONSTRAINT fk_billable_document_id_registered_by
        FOREIGN KEY (id_registered_by) REFERENCES staff (id_staff),
    CONSTRAINT fk_billable_document_id_discount_authorized_by
        FOREIGN KEY (id_discount_authorized_by) REFERENCES owner (id_owner),
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
        CHECK (id_customer IS NOT NULL OR (kind = 'VENTA' AND terms = 'CONTADO')),
    CONSTRAINT ck_billable_document_discount_authorized
        CHECK (discount = 0 OR id_discount_authorized_by IS NOT NULL),
    CONSTRAINT ck_billable_document_opening_balance
        CHECK (kind <> 'SALDO_INICIAL' OR (terms = 'CREDITO' AND discount = 0))
);
```

**Por qué cada parte:**

| Parte | Por qué |
| --- | --- |
| `id_customer` sin `NOT NULL` | Una venta rápida de contado no identifica al cliente (BR-038). Cuándo es obligatorio lo decide la CK de abajo. |
| `ck_billable_document_customer` (C-01) | Se lee: "hay cliente, **o** es una venta de contado". Así, un servicio, un saldo inicial o cualquier crédito **siempre** tienen cliente (BR-062). Compara dos columnas: por eso es restricción **de tabla**. |
| `id_discount_authorized_by` → `owner` | Apunta a `owner`, no a `staff`: **solo un dueño** puede autorizar una rebaja (BR-010), y lo garantiza la FK sin una línea de código (T-03). |
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
| Producto con una marca que no existe | `fk_product_id_product_brand` |
| Código de barras de puros espacios | `ck_product_barcode` |
| Venta **al crédito** sin cliente | `ck_billable_document_customer` |
| Servicio sin cliente | `ck_billable_document_customer` |
| Rebaja sin quién la autorizó | `ck_billable_document_discount_authorized` |
| Rebaja autorizada por el **encargado** | `fk_billable_document_id_discount_authorized_by` (no está en `owner`) |
| Saldo inicial de contado | `ck_billable_document_opening_balance` |
| Escribir `id_product` a mano | `GENERATED ALWAYS` |

> Hagan la misma tabla para cada tabla que escriban: **una fila válida que entra y al menos un intento que la base rechaza**. Esa es la prueba de que la restricción existe y hace lo que dice el modelo.

---

## 5. DDL completo

> [!info] Estado (07-nov) — versión 2
> - **Las 36 tablas corren sin errores en PostgreSQL 16**, en una sola pasada y dentro de `BEGIN; … COMMIT;`.
> - **Cambios de la v2:** FK compuestas ([[DEC-029 - Controlled Redundancy with Composite Foreign Keys - MIRM|DEC-029]]), periodo de pago `period_start`/`period_end` ([[DEC-030 - Mechanic Pay Period - MIRM|DEC-030]]), `purchase.discount` ([[DEC-031 - Purchase Invoice Discount - MIRM|DEC-031]]), `clock_timestamp()`, vencimiento obligatorio en compras al crédito y un nombre corregido ([[DEC-032 - Integrity Fixes From S5 Review - MIRM|DEC-032]]), usuario y hash en `staff` ([[DEC-035 - Staff Login Credentials - MIRM|DEC-035]]) y zona horaria de la base.
> - **Probado (07-nov):** se cargaron datos de los escenarios (compra al crédito con descuento, abono al saldo de apertura, venta de contado y a crédito, servicio con falla adicional y cinco cambios de estado **en la misma transacción**, abono en dólares, devolución con cambio, pago de un mecánico de miércoles a sábado con adelanto, ajuste y retiro). Después **61 casos**: 54 intentos de romper el modelo (los 54 rechazados por la restricción esperada) y 7 casos válidos (los 7 entran) — §5.2. Las 20 consultas de [[S5 - Business Queries - MIRM|Business Queries]] más Q21 y Q22 corren sin errores.
> - **Quién:** v1 (29-oct) escrita por el equipo y Claude; **v2 (07-nov) escrita y probada por Claude a pedido de Kenry** (el equipo no tenía tiempo de probarla). Pendiente de revisión del equipo.

### 5.1 Script

Es la copia exacta de `db/postgres/01_schema.sql` (v2). Se ejecuta completo, como dice §1.

```sql
-- =====================================================================
-- Motor IRM — 01_schema.sql
-- Esquema relacional en PostgreSQL (36 tablas), versión 2 — 2026-11-07
--
-- Fuente de verdad del esquema (DEC-034). Copia documentada en Obsidian:
-- "S5 - DDL PostgreSQL - MIRM".
--
-- Cambios de la versión 2 (cierre de S5, 07-nov):
--   DEC-029  FK compuestas (redundancias controladas): supplier_payment,
--            mechanical_service, advance, service_labor, service_part e
--            inventory_movement (+ sus UQ de pareja en las tablas padre).
--   DEC-030  Pago a mecánicos por periodo trabajado: weekly_payout usa
--            period_start / period_end (antes week_start / week_end).
--   DEC-031  purchase.discount (descuento de la factura de compra).
--   DEC-032  Integridad: hora real en status_change y price_history
--            (clock_timestamp), compra al crédito exige vencimiento.
--   DEC-035  Inicio de sesión: staff.username y staff.password_hash.
--
-- Cómo ejecutarlo (en una base vacía, creada con UTF8):
--   createdb -E UTF8 -T template0 motor_irm
--   psql -d motor_irm -v ON_ERROR_STOP=1 -f 01_schema.sql
-- Se crean las 36 tablas o ninguna (BEGIN … COMMIT).
-- =====================================================================

BEGIN;

-- Zona horaria del negocio: Nicaragua (UTC-6, sin horario de verano).
-- Queda guardada en la base, así LOCALTIMESTAMP y CURRENT_DATE dan la hora
-- y la fecha de Managua en cualquier conexión (también la de Node.js).
DO $$
BEGIN
    EXECUTE format('ALTER DATABASE %I SET timezone = %L', current_database(), 'America/Managua');
END
$$;
SET timezone = 'America/Managua';

-- ---------------------------------------------------------------------
-- Nivel 0
-- ---------------------------------------------------------------------

CREATE TABLE product_category (
    id_product_category  INTEGER     GENERATED ALWAYS AS IDENTITY,
    name                 VARCHAR(50) NOT NULL,

    CONSTRAINT pk_product_category      PRIMARY KEY (id_product_category),
    CONSTRAINT ck_product_category_name CHECK (btrim(name) <> '')
);
CREATE UNIQUE INDEX uq_product_category_name ON product_category (lower(name));

CREATE TABLE product_brand (
    id_product_brand  INTEGER     GENERATED ALWAYS AS IDENTITY,
    name              VARCHAR(50) NOT NULL,

    CONSTRAINT pk_product_brand      PRIMARY KEY (id_product_brand),
    CONSTRAINT ck_product_brand_name CHECK (btrim(name) <> '')
);
CREATE UNIQUE INDEX uq_product_brand_name ON product_brand (lower(name));

CREATE TABLE motorcycle_brand (
    id_motorcycle_brand  INTEGER     GENERATED ALWAYS AS IDENTITY,
    name                 VARCHAR(50) NOT NULL,

    CONSTRAINT pk_motorcycle_brand      PRIMARY KEY (id_motorcycle_brand),
    CONSTRAINT ck_motorcycle_brand_name CHECK (btrim(name) <> '')
);
CREATE UNIQUE INDEX uq_motorcycle_brand_name ON motorcycle_brand (lower(name));

CREATE TABLE service_type (
    id_service_type  INTEGER       GENERATED ALWAYS AS IDENTITY,
    name             VARCHAR(50)   NOT NULL,
    reference_price  NUMERIC(12,2),
    active           BOOLEAN       NOT NULL DEFAULT TRUE,

    CONSTRAINT pk_service_type                 PRIMARY KEY (id_service_type),
    CONSTRAINT ck_service_type_name            CHECK (btrim(name) <> ''),
    CONSTRAINT ck_service_type_reference_price CHECK (reference_price >= 0)
);
CREATE UNIQUE INDEX uq_service_type_name ON service_type (lower(name));

CREATE TABLE customer (
    id_customer  INTEGER      GENERATED ALWAYS AS IDENTITY,
    name         VARCHAR(100) NOT NULL,
    phone        VARCHAR(20)  NOT NULL,
    national_id  VARCHAR(20),
    address      VARCHAR(200),

    CONSTRAINT pk_customer             PRIMARY KEY (id_customer),
    CONSTRAINT ck_customer_name        CHECK (btrim(name) <> ''),
    CONSTRAINT ck_customer_phone       CHECK (btrim(phone) <> ''),
    CONSTRAINT ck_customer_national_id CHECK (national_id IS NULL OR btrim(national_id) <> ''),
    CONSTRAINT ck_customer_address     CHECK (address IS NULL OR btrim(address) <> '')
);
CREATE UNIQUE INDEX uq_customer_national_id ON customer (upper(national_id));

-- DEC-035: usuario y contraseña (hash) para iniciar sesión.
-- Solo dueños y encargado inician sesión; los mecánicos no.
CREATE TABLE staff (
    id_staff       INTEGER      GENERATED ALWAYS AS IDENTITY,
    name           VARCHAR(100) NOT NULL,
    phone          VARCHAR(20)  NOT NULL,
    active         BOOLEAN      NOT NULL DEFAULT TRUE,
    role           VARCHAR(20)  NOT NULL,
    username       VARCHAR(30),
    password_hash  VARCHAR(255),

    CONSTRAINT pk_staff            PRIMARY KEY (id_staff),
    CONSTRAINT ck_staff_name       CHECK (btrim(name) <> ''),
    CONSTRAINT ck_staff_phone      CHECK (btrim(phone) <> ''),
    CONSTRAINT ck_staff_role       CHECK (role IN ('DUENO', 'MECANICO', 'ENCARGADO')),
    CONSTRAINT ck_staff_username   CHECK (username IS NULL OR btrim(username) <> ''),
    CONSTRAINT ck_staff_login_pair CHECK ((username IS NULL) = (password_hash IS NULL)),
    CONSTRAINT ck_staff_login_role CHECK (username IS NULL OR role <> 'MECANICO')
);
CREATE UNIQUE INDEX uq_staff_username ON staff (lower(username));

CREATE TABLE supplier (
    id_supplier      INTEGER       GENERATED ALWAYS AS IDENTITY,
    name             VARCHAR(100)  NOT NULL,
    phone            VARCHAR(20),
    contact_person   VARCHAR(100),
    gives_warranty   BOOLEAN,
    opening_balance  NUMERIC(12,2),
    opening_date     DATE,

    CONSTRAINT pk_supplier                 PRIMARY KEY (id_supplier),
    CONSTRAINT ck_supplier_name            CHECK (btrim(name) <> ''),
    CONSTRAINT ck_supplier_opening_balance CHECK (opening_balance >= 0),
    CONSTRAINT ck_supplier_opening_pair    CHECK ((opening_balance IS NULL) = (opening_date IS NULL))
);

-- ---------------------------------------------------------------------
-- Nivel 1
-- ---------------------------------------------------------------------

CREATE TABLE owner (
    id_owner  INTEGER NOT NULL,

    CONSTRAINT pk_owner          PRIMARY KEY (id_owner),
    CONSTRAINT fk_owner_id_owner FOREIGN KEY (id_owner) REFERENCES staff (id_staff)
);

CREATE TABLE mechanic (
    id_mechanic      INTEGER      NOT NULL,
    commission_rate  NUMERIC(5,4) NOT NULL,

    CONSTRAINT pk_mechanic                 PRIMARY KEY (id_mechanic),
    CONSTRAINT fk_mechanic_id_mechanic     FOREIGN KEY (id_mechanic) REFERENCES staff (id_staff),
    CONSTRAINT ck_mechanic_commission_rate CHECK (commission_rate > 0 AND commission_rate <= 1)
);

CREATE TABLE motorcycle_model (
    id_motorcycle_model  INTEGER     GENERATED ALWAYS AS IDENTITY,
    id_motorcycle_brand  INTEGER     NOT NULL,
    name                 VARCHAR(50) NOT NULL,

    CONSTRAINT pk_motorcycle_model                     PRIMARY KEY (id_motorcycle_model),
    CONSTRAINT fk_motorcycle_model_id_motorcycle_brand FOREIGN KEY (id_motorcycle_brand) REFERENCES motorcycle_brand (id_motorcycle_brand),
    CONSTRAINT ck_motorcycle_model_name                CHECK (btrim(name) <> '')
);
CREATE UNIQUE INDEX uq_motorcycle_model_brand_name ON motorcycle_model (id_motorcycle_brand, lower(name));

CREATE TABLE product (
    id_product           INTEGER       GENERATED ALWAYS AS IDENTITY,
    id_product_category  INTEGER       NOT NULL,
    id_product_brand     INTEGER       NOT NULL,
    name                 VARCHAR(150)  NOT NULL,
    barcode              VARCHAR(50),
    tier                 VARCHAR(20)   NOT NULL,
    sale_price           NUMERIC(12,2) NOT NULL,
    active               BOOLEAN       NOT NULL DEFAULT TRUE,

    CONSTRAINT pk_product                     PRIMARY KEY (id_product),
    CONSTRAINT fk_product_id_product_category FOREIGN KEY (id_product_category) REFERENCES product_category (id_product_category),
    CONSTRAINT fk_product_id_product_brand    FOREIGN KEY (id_product_brand)    REFERENCES product_brand (id_product_brand),
    CONSTRAINT uq_product_barcode             UNIQUE (barcode),
    CONSTRAINT ck_product_name                CHECK (btrim(name) <> ''),
    CONSTRAINT ck_product_barcode             CHECK (barcode IS NULL OR btrim(barcode) <> ''),
    CONSTRAINT ck_product_tier                CHECK (tier IN ('ALTA', 'MEDIA', 'BAJA')),
    CONSTRAINT ck_product_sale_price          CHECK (sale_price >= 0)
);

-- ---------------------------------------------------------------------
-- Nivel 2
-- ---------------------------------------------------------------------

CREATE TABLE motorcycle (
    id_motorcycle        INTEGER      GENERATED ALWAYS AS IDENTITY,
    id_customer          INTEGER      NOT NULL,
    id_motorcycle_model  INTEGER      NOT NULL,
    color                VARCHAR(30)  NOT NULL,
    plate                VARCHAR(15),
    notes                VARCHAR(200),

    CONSTRAINT pk_motorcycle                     PRIMARY KEY (id_motorcycle),
    CONSTRAINT fk_motorcycle_id_customer         FOREIGN KEY (id_customer)         REFERENCES customer (id_customer),
    CONSTRAINT fk_motorcycle_id_motorcycle_model FOREIGN KEY (id_motorcycle_model) REFERENCES motorcycle_model (id_motorcycle_model),
    CONSTRAINT ck_motorcycle_color               CHECK (btrim(color) <> ''),
    CONSTRAINT ck_motorcycle_plate               CHECK (plate IS NULL OR btrim(plate) <> '')
);
CREATE UNIQUE INDEX uq_motorcycle_plate ON motorcycle (upper(plate));

-- DEC-032: clock_timestamp() da la hora real de cada fila (LOCALTIMESTAMP
-- da la del inicio de la transacción y dos filas chocaban en la UQ).
CREATE TABLE price_history (
    id_price_history  INTEGER       GENERATED ALWAYS AS IDENTITY,
    id_product        INTEGER       NOT NULL,
    changed_at        TIMESTAMP     NOT NULL DEFAULT clock_timestamp()::timestamp,
    new_price         NUMERIC(12,2) NOT NULL,
    id_changed_by     INTEGER,

    CONSTRAINT pk_price_history                     PRIMARY KEY (id_price_history),
    CONSTRAINT fk_price_history_id_product          FOREIGN KEY (id_product)    REFERENCES product (id_product),
    CONSTRAINT fk_price_history_id_changed_by       FOREIGN KEY (id_changed_by) REFERENCES owner (id_owner),
    CONSTRAINT uq_price_history_id_product_changed_at UNIQUE (id_product, changed_at),
    CONSTRAINT ck_price_history_new_price           CHECK (new_price >= 0)
);

-- DEC-031: discount (descuento de la factura). DEC-032: crédito ⇔ vencimiento.
-- DEC-029: UQ de la pareja (id_purchase, id_supplier) para la FK compuesta de supplier_payment.
CREATE TABLE purchase (
    id_purchase     INTEGER       GENERATED ALWAYS AS IDENTITY,
    id_supplier     INTEGER       NOT NULL,
    invoice_number  VARCHAR(30)   NOT NULL,
    purchase_date   DATE          NOT NULL DEFAULT CURRENT_DATE,
    terms           VARCHAR(20)   NOT NULL,
    due_date        DATE,
    discount        NUMERIC(12,2) NOT NULL DEFAULT 0,
    id_received_by  INTEGER       NOT NULL,

    CONSTRAINT pk_purchase                         PRIMARY KEY (id_purchase),
    CONSTRAINT fk_purchase_id_supplier             FOREIGN KEY (id_supplier)    REFERENCES supplier (id_supplier),
    CONSTRAINT fk_purchase_id_received_by          FOREIGN KEY (id_received_by) REFERENCES owner (id_owner),
    CONSTRAINT uq_purchase_supplier_invoice        UNIQUE (id_supplier, invoice_number),
    CONSTRAINT uq_purchase_id_purchase_id_supplier UNIQUE (id_purchase, id_supplier),
    CONSTRAINT ck_purchase_invoice_number          CHECK (btrim(invoice_number) <> ''),
    CONSTRAINT ck_purchase_terms                   CHECK (terms IN ('CONTADO', 'CREDITO')),
    CONSTRAINT ck_purchase_due_date                CHECK ((terms = 'CREDITO') = (due_date IS NOT NULL)
                                                          AND (due_date IS NULL OR due_date >= purchase_date)),
    CONSTRAINT ck_purchase_discount                CHECK (discount >= 0)
);

CREATE TABLE billable_document (
    id_billable_document       INTEGER       GENERATED ALWAYS AS IDENTITY,
    kind                       VARCHAR(20)   NOT NULL,
    id_customer                INTEGER,
    id_registered_by           INTEGER       NOT NULL,
    created_at                 TIMESTAMP(0)  NOT NULL DEFAULT LOCALTIMESTAMP(0),
    receipt_number             VARCHAR(20),
    terms                      VARCHAR(20)   NOT NULL,
    discount                   NUMERIC(12,2) NOT NULL DEFAULT 0,
    id_discount_authorized_by  INTEGER,

    CONSTRAINT pk_billable_document                PRIMARY KEY (id_billable_document),
    CONSTRAINT fk_billable_document_id_customer
        FOREIGN KEY (id_customer) REFERENCES customer (id_customer),
    CONSTRAINT fk_billable_document_id_registered_by
        FOREIGN KEY (id_registered_by) REFERENCES staff (id_staff),
    CONSTRAINT fk_billable_document_id_discount_authorized_by
        FOREIGN KEY (id_discount_authorized_by) REFERENCES owner (id_owner),
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
        CHECK (id_customer IS NOT NULL OR (kind = 'VENTA' AND terms = 'CONTADO')),
    CONSTRAINT ck_billable_document_discount_authorized
        CHECK (discount = 0 OR id_discount_authorized_by IS NOT NULL),
    CONSTRAINT ck_billable_document_opening_balance
        CHECK (kind <> 'SALDO_INICIAL' OR (terms = 'CREDITO' AND discount = 0))
);

-- DEC-030: el pago cubre el periodo que el mecánico realmente trabajó
-- (de lunes a sábado casi siempre, pero puede ser más corto).
-- DEC-029: UQ de la pareja (id_weekly_payout, id_mechanic) para las FK compuestas.
CREATE TABLE weekly_payout (
    id_weekly_payout  INTEGER GENERATED ALWAYS AS IDENTITY,
    id_mechanic       INTEGER NOT NULL,
    period_start      DATE    NOT NULL,
    period_end        DATE    NOT NULL,
    paid_on           DATE,
    id_paid_by        INTEGER,

    CONSTRAINT pk_weekly_payout                          PRIMARY KEY (id_weekly_payout),
    CONSTRAINT fk_weekly_payout_id_mechanic              FOREIGN KEY (id_mechanic) REFERENCES mechanic (id_mechanic),
    CONSTRAINT fk_weekly_payout_id_paid_by               FOREIGN KEY (id_paid_by)  REFERENCES owner (id_owner),
    CONSTRAINT uq_weekly_payout_id_mechanic_period_start UNIQUE (id_mechanic, period_start),
    CONSTRAINT uq_weekly_payout_id_weekly_payout_id_mechanic UNIQUE (id_weekly_payout, id_mechanic),
    CONSTRAINT ck_weekly_payout_period                   CHECK (period_end >= period_start),
    CONSTRAINT ck_weekly_payout_paid_pair                CHECK ((paid_on IS NULL) = (id_paid_by IS NULL)),
    CONSTRAINT ck_weekly_payout_paid_on                  CHECK (paid_on IS NULL OR paid_on >= period_start)
);

CREATE TABLE cash_withdrawal (
    id_cash_withdrawal  INTEGER       GENERATED ALWAYS AS IDENTITY,
    id_owner            INTEGER       NOT NULL,
    withdrawn_on        DATE          NOT NULL DEFAULT CURRENT_DATE,
    amount              NUMERIC(12,2) NOT NULL,
    reason              VARCHAR(20)   NOT NULL,
    description         VARCHAR(200),

    CONSTRAINT pk_cash_withdrawal             PRIMARY KEY (id_cash_withdrawal),
    CONSTRAINT fk_cash_withdrawal_id_owner    FOREIGN KEY (id_owner) REFERENCES owner (id_owner),
    CONSTRAINT ck_cash_withdrawal_amount      CHECK (amount > 0),
    CONSTRAINT ck_cash_withdrawal_reason      CHECK (reason IN ('CONSUMO_INTERNO', 'VIAJE', 'IMPUESTO', 'OTRO')),
    CONSTRAINT ck_cash_withdrawal_description CHECK (reason <> 'OTRO' OR btrim(coalesce(description, '')) <> '')
);

-- ---------------------------------------------------------------------
-- Nivel 3
-- ---------------------------------------------------------------------

-- DEC-029: UQ (id_purchase_detail, id_product) para la FK compuesta de inventory_movement.
CREATE TABLE purchase_detail (
    id_purchase_detail  INTEGER       GENERATED ALWAYS AS IDENTITY,
    id_purchase         INTEGER       NOT NULL,
    line_no             SMALLINT      NOT NULL,
    id_product          INTEGER       NOT NULL,
    quantity            INTEGER       NOT NULL,
    unit_cost           NUMERIC(12,2) NOT NULL,

    CONSTRAINT pk_purchase_detail                           PRIMARY KEY (id_purchase_detail),
    CONSTRAINT fk_purchase_detail_id_purchase               FOREIGN KEY (id_purchase) REFERENCES purchase (id_purchase),
    CONSTRAINT fk_purchase_detail_id_product                FOREIGN KEY (id_product)  REFERENCES product (id_product),
    CONSTRAINT uq_purchase_detail_line                      UNIQUE (id_purchase, line_no),
    CONSTRAINT uq_purchase_detail_id_purchase_detail_id_product UNIQUE (id_purchase_detail, id_product),
    CONSTRAINT ck_purchase_detail_line_no                   CHECK (line_no > 0),
    CONSTRAINT ck_purchase_detail_quantity                  CHECK (quantity > 0),
    CONSTRAINT ck_purchase_detail_unit_cost                 CHECK (unit_cost >= 0)
);

-- DEC-029 (caso 1): si el pago es de una compra, la compra es del mismo proveedor.
-- MATCH SIMPLE: con id_purchase nulo (pago del saldo de apertura) la FK no se revisa.
CREATE TABLE supplier_payment (
    id_supplier_payment  INTEGER       GENERATED ALWAYS AS IDENTITY,
    id_supplier          INTEGER       NOT NULL,
    id_purchase          INTEGER,
    paid_on              DATE          NOT NULL DEFAULT CURRENT_DATE,
    amount               NUMERIC(12,2) NOT NULL,
    currency             VARCHAR(3)    NOT NULL DEFAULT 'NIO',
    exchange_rate        NUMERIC(10,4),

    CONSTRAINT pk_supplier_payment                         PRIMARY KEY (id_supplier_payment),
    CONSTRAINT fk_supplier_payment_id_supplier             FOREIGN KEY (id_supplier) REFERENCES supplier (id_supplier),
    CONSTRAINT fk_supplier_payment_id_purchase_id_supplier FOREIGN KEY (id_purchase, id_supplier)
                                                           REFERENCES purchase (id_purchase, id_supplier) MATCH SIMPLE,
    CONSTRAINT ck_supplier_payment_amount                  CHECK (amount > 0),
    CONSTRAINT ck_supplier_payment_currency                CHECK (currency IN ('NIO', 'USD')),
    CONSTRAINT ck_supplier_payment_exchange                CHECK ((currency = 'NIO' AND exchange_rate IS NULL)
                                                               OR (currency = 'USD' AND exchange_rate IS NOT NULL AND exchange_rate > 0))
);

CREATE TABLE sale (
    id_sale  INTEGER NOT NULL,

    CONSTRAINT pk_sale         PRIMARY KEY (id_sale),
    CONSTRAINT fk_sale_id_sale FOREIGN KEY (id_sale) REFERENCES billable_document (id_billable_document)
);

CREATE TABLE opening_balance (
    id_opening_balance  INTEGER       NOT NULL,
    amount              NUMERIC(12,2) NOT NULL,
    description         VARCHAR(200),

    CONSTRAINT pk_opening_balance                    PRIMARY KEY (id_opening_balance),
    CONSTRAINT fk_opening_balance_id_opening_balance FOREIGN KEY (id_opening_balance) REFERENCES billable_document (id_billable_document),
    CONSTRAINT ck_opening_balance_amount             CHECK (amount > 0)
);

-- DEC-029 (caso 2): el servicio solo se liquida en el pago de SU responsable.
CREATE TABLE mechanical_service (
    id_mechanical_service  INTEGER       NOT NULL,
    id_motorcycle          INTEGER       NOT NULL,
    id_responsible         INTEGER,
    requested_work         VARCHAR(500)  NOT NULL,
    diagnosis              VARCHAR(500),
    cancellation_amount    NUMERIC(12,2),
    applied_rate           NUMERIC(5,4),
    id_weekly_payout       INTEGER,

    CONSTRAINT pk_mechanical_service                       PRIMARY KEY (id_mechanical_service),
    CONSTRAINT fk_mechanical_service_id_mechanical_service FOREIGN KEY (id_mechanical_service) REFERENCES billable_document (id_billable_document),
    CONSTRAINT fk_mechanical_service_id_motorcycle         FOREIGN KEY (id_motorcycle)         REFERENCES motorcycle (id_motorcycle),
    CONSTRAINT fk_mechanical_service_id_responsible        FOREIGN KEY (id_responsible)        REFERENCES staff (id_staff),
    CONSTRAINT fk_mechanical_service_id_weekly_payout_id_responsible
        FOREIGN KEY (id_weekly_payout, id_responsible) REFERENCES weekly_payout (id_weekly_payout, id_mechanic) MATCH SIMPLE,
    CONSTRAINT ck_mechanical_service_requested_work        CHECK (btrim(requested_work) <> ''),
    CONSTRAINT ck_mechanical_service_cancellation          CHECK (cancellation_amount >= 0),
    CONSTRAINT ck_mechanical_service_applied_rate          CHECK (applied_rate > 0 AND applied_rate <= 1),
    CONSTRAINT ck_mechanical_service_payout_rate           CHECK (id_weekly_payout IS NULL
                                                                  OR (applied_rate IS NOT NULL AND id_responsible IS NOT NULL))
);

CREATE TABLE credit (
    id_credit          INTEGER      NOT NULL,
    id_authorized_by   INTEGER      NOT NULL,
    granted_on         DATE         NOT NULL DEFAULT CURRENT_DATE,
    due_date           DATE         NOT NULL,
    extended_due_date  DATE,
    monthly_interest   NUMERIC(5,4) NOT NULL DEFAULT 0,

    CONSTRAINT pk_credit                  PRIMARY KEY (id_credit),
    CONSTRAINT fk_credit_id_credit        FOREIGN KEY (id_credit)        REFERENCES billable_document (id_billable_document),
    CONSTRAINT fk_credit_id_authorized_by FOREIGN KEY (id_authorized_by) REFERENCES owner (id_owner),
    CONSTRAINT ck_credit_due_date         CHECK (due_date >= granted_on),
    CONSTRAINT ck_credit_extended_due     CHECK (extended_due_date IS NULL OR extended_due_date > due_date),
    CONSTRAINT ck_credit_monthly_interest CHECK (monthly_interest >= 0 AND monthly_interest < 1)
);

CREATE TABLE customer_payment (
    id_customer_payment  INTEGER       GENERATED ALWAYS AS IDENTITY,
    paid_at              TIMESTAMP(0)  NOT NULL DEFAULT LOCALTIMESTAMP(0),
    amount               NUMERIC(12,2) NOT NULL,
    currency             VARCHAR(3)    NOT NULL DEFAULT 'NIO',
    exchange_rate        NUMERIC(10,4),
    method               VARCHAR(20)   NOT NULL,
    id_received_by       INTEGER       NOT NULL,

    CONSTRAINT pk_customer_payment                PRIMARY KEY (id_customer_payment),
    CONSTRAINT fk_customer_payment_id_received_by FOREIGN KEY (id_received_by) REFERENCES staff (id_staff),
    CONSTRAINT ck_customer_payment_amount         CHECK (amount > 0),
    CONSTRAINT ck_customer_payment_currency       CHECK (currency IN ('NIO', 'USD')),
    CONSTRAINT ck_customer_payment_exchange       CHECK ((currency = 'NIO' AND exchange_rate IS NULL)
                                                      OR (currency = 'USD' AND exchange_rate IS NOT NULL AND exchange_rate > 0)),
    CONSTRAINT ck_customer_payment_method         CHECK (method IN ('EFECTIVO', 'TRANSFERENCIA'))
);

-- DEC-029 (caso 2): el adelanto solo se descuenta en el pago del mismo mecánico.
CREATE TABLE advance (
    id_advance        INTEGER       GENERATED ALWAYS AS IDENTITY,
    id_mechanic       INTEGER       NOT NULL,
    given_on          DATE          NOT NULL DEFAULT CURRENT_DATE,
    amount            NUMERIC(12,2) NOT NULL,
    id_given_by       INTEGER       NOT NULL,
    id_weekly_payout  INTEGER,

    CONSTRAINT pk_advance                              PRIMARY KEY (id_advance),
    CONSTRAINT fk_advance_id_mechanic                  FOREIGN KEY (id_mechanic) REFERENCES mechanic (id_mechanic),
    CONSTRAINT fk_advance_id_given_by                  FOREIGN KEY (id_given_by) REFERENCES owner (id_owner),
    CONSTRAINT fk_advance_id_weekly_payout_id_mechanic FOREIGN KEY (id_weekly_payout, id_mechanic)
                                                       REFERENCES weekly_payout (id_weekly_payout, id_mechanic) MATCH SIMPLE,
    CONSTRAINT ck_advance_amount                       CHECK (amount > 0)
);

-- ---------------------------------------------------------------------
-- Nivel 4
-- ---------------------------------------------------------------------

CREATE TABLE supplier_return (
    id_supplier_return  INTEGER      GENERATED ALWAYS AS IDENTITY,
    id_purchase_detail  INTEGER      NOT NULL,
    returned_on         DATE         NOT NULL DEFAULT CURRENT_DATE,
    quantity            INTEGER      NOT NULL,
    reason              VARCHAR(200) NOT NULL,
    resolution          VARCHAR(20),

    CONSTRAINT pk_supplier_return                    PRIMARY KEY (id_supplier_return),
    CONSTRAINT fk_supplier_return_id_purchase_detail FOREIGN KEY (id_purchase_detail) REFERENCES purchase_detail (id_purchase_detail),
    CONSTRAINT ck_supplier_return_quantity           CHECK (quantity > 0),
    CONSTRAINT ck_supplier_return_reason             CHECK (btrim(reason) <> ''),
    CONSTRAINT ck_supplier_return_resolution         CHECK (resolution IN ('REPOSICION', 'DINERO', 'DESCUENTO'))
);

-- DEC-029: UQ (id_sale_detail, id_product) para la FK compuesta de inventory_movement.
CREATE TABLE sale_detail (
    id_sale_detail  INTEGER       GENERATED ALWAYS AS IDENTITY,
    id_sale         INTEGER       NOT NULL,
    line_no         SMALLINT      NOT NULL,
    id_product      INTEGER       NOT NULL,
    quantity        INTEGER       NOT NULL,
    unit_price      NUMERIC(12,2) NOT NULL,

    CONSTRAINT pk_sale_detail                        PRIMARY KEY (id_sale_detail),
    CONSTRAINT fk_sale_detail_id_sale                FOREIGN KEY (id_sale)    REFERENCES sale (id_sale),
    CONSTRAINT fk_sale_detail_id_product             FOREIGN KEY (id_product) REFERENCES product (id_product),
    CONSTRAINT uq_sale_detail_line                   UNIQUE (id_sale, line_no),
    CONSTRAINT uq_sale_detail_id_sale_detail_id_product UNIQUE (id_sale_detail, id_product),
    CONSTRAINT ck_sale_detail_line_no                CHECK (line_no > 0),
    CONSTRAINT ck_sale_detail_quantity               CHECK (quantity > 0),
    CONSTRAINT ck_sale_detail_unit_price             CHECK (unit_price >= 0)
);

CREATE TABLE payment_application (
    id_payment_application  INTEGER       GENERATED ALWAYS AS IDENTITY,
    id_customer_payment     INTEGER       NOT NULL,
    id_billable_document    INTEGER       NOT NULL,
    applied_amount          NUMERIC(12,2) NOT NULL,

    CONSTRAINT pk_payment_application                      PRIMARY KEY (id_payment_application),
    CONSTRAINT fk_payment_application_id_customer_payment  FOREIGN KEY (id_customer_payment)  REFERENCES customer_payment (id_customer_payment),
    CONSTRAINT fk_payment_application_id_billable_document FOREIGN KEY (id_billable_document) REFERENCES billable_document (id_billable_document),
    CONSTRAINT uq_payment_application_payment_document     UNIQUE (id_customer_payment, id_billable_document),
    CONSTRAINT ck_payment_application_amount               CHECK (applied_amount > 0)
);

-- DEC-032: clock_timestamp() — dos cambios de estado en la misma transacción
-- ya no chocan en la UQ (servicio, fecha y hora).
CREATE TABLE status_change (
    id_status_change       INTEGER      GENERATED ALWAYS AS IDENTITY,
    id_mechanical_service  INTEGER      NOT NULL,
    changed_at             TIMESTAMP    NOT NULL DEFAULT clock_timestamp()::timestamp,
    status                 VARCHAR(20)  NOT NULL,
    notes                  VARCHAR(200),
    id_registered_by       INTEGER      NOT NULL,

    CONSTRAINT pk_status_change                       PRIMARY KEY (id_status_change),
    CONSTRAINT fk_status_change_id_mechanical_service FOREIGN KEY (id_mechanical_service) REFERENCES mechanical_service (id_mechanical_service),
    CONSTRAINT fk_status_change_id_registered_by      FOREIGN KEY (id_registered_by)      REFERENCES staff (id_staff),
    CONSTRAINT uq_status_change_service_time          UNIQUE (id_mechanical_service, changed_at),
    CONSTRAINT ck_status_change_status                CHECK (status IN ('RECIBIDA', 'EN_DIAGNOSTICO', 'EN_PROCESO',
                                                                         'ESPERA_REPUESTO', 'ESPERA_CLIENTE', 'TERMINADA',
                                                                         'EN_PRUEBA', 'ENTREGADA', 'CANCELADA'))
);

-- DEC-029: UQ (id_additional_fault, id_mechanical_service) para las FK compuestas
-- de service_labor y service_part (la falla es del mismo servicio).
CREATE TABLE additional_fault (
    id_additional_fault    INTEGER       GENERATED ALWAYS AS IDENTITY,
    id_mechanical_service  INTEGER       NOT NULL,
    fault_no               SMALLINT      NOT NULL,
    reported_on            DATE          NOT NULL DEFAULT CURRENT_DATE,
    description            VARCHAR(500)  NOT NULL,
    proposed_price         NUMERIC(12,2),
    decision               VARCHAR(20)   NOT NULL DEFAULT 'PENDIENTE',

    CONSTRAINT pk_additional_fault                       PRIMARY KEY (id_additional_fault),
    CONSTRAINT fk_additional_fault_id_mechanical_service FOREIGN KEY (id_mechanical_service) REFERENCES mechanical_service (id_mechanical_service),
    CONSTRAINT uq_additional_fault_number                UNIQUE (id_mechanical_service, fault_no),
    CONSTRAINT uq_additional_fault_id_additional_fault_id_mechanical_service
                                                         UNIQUE (id_additional_fault, id_mechanical_service),
    CONSTRAINT ck_additional_fault_fault_no              CHECK (fault_no > 0),
    CONSTRAINT ck_additional_fault_description           CHECK (btrim(description) <> ''),
    CONSTRAINT ck_additional_fault_proposed_price        CHECK (proposed_price >= 0),
    CONSTRAINT ck_additional_fault_decision              CHECK (decision IN ('PENDIENTE', 'ACEPTADA', 'RECHAZADA'))
);

CREATE TABLE external_charge (
    id_external_charge     INTEGER       GENERATED ALWAYS AS IDENTITY,
    id_mechanical_service  INTEGER       NOT NULL,
    line_no                SMALLINT      NOT NULL,
    description            VARCHAR(200)  NOT NULL,
    amount                 NUMERIC(12,2) NOT NULL,

    CONSTRAINT pk_external_charge                       PRIMARY KEY (id_external_charge),
    CONSTRAINT fk_external_charge_id_mechanical_service FOREIGN KEY (id_mechanical_service) REFERENCES mechanical_service (id_mechanical_service),
    CONSTRAINT uq_external_charge_line                  UNIQUE (id_mechanical_service, line_no),
    CONSTRAINT ck_external_charge_line_no               CHECK (line_no > 0),
    CONSTRAINT ck_external_charge_description           CHECK (btrim(description) <> ''),
    CONSTRAINT ck_external_charge_amount                CHECK (amount >= 0)
);

CREATE TABLE warranty_claim (
    id_warranty_claim    INTEGER       GENERATED ALWAYS AS IDENTITY,
    id_original_service  INTEGER       NOT NULL,
    claimed_on           DATE          NOT NULL DEFAULT CURRENT_DATE,
    description          VARCHAR(500)  NOT NULL,
    outcome              VARCHAR(20)   NOT NULL,
    part_paid_by         VARCHAR(20),
    refund_amount        NUMERIC(12,2),
    id_attended_by       INTEGER       NOT NULL,
    id_new_service       INTEGER,
    id_sale              INTEGER,

    CONSTRAINT pk_warranty_claim                     PRIMARY KEY (id_warranty_claim),
    CONSTRAINT fk_warranty_claim_id_original_service FOREIGN KEY (id_original_service) REFERENCES mechanical_service (id_mechanical_service),
    CONSTRAINT fk_warranty_claim_id_attended_by      FOREIGN KEY (id_attended_by)      REFERENCES owner (id_owner),
    CONSTRAINT fk_warranty_claim_id_new_service      FOREIGN KEY (id_new_service)      REFERENCES mechanical_service (id_mechanical_service),
    CONSTRAINT fk_warranty_claim_id_sale             FOREIGN KEY (id_sale)             REFERENCES sale (id_sale),
    CONSTRAINT uq_warranty_claim_id_new_service      UNIQUE (id_new_service),
    CONSTRAINT uq_warranty_claim_id_sale             UNIQUE (id_sale),
    CONSTRAINT ck_warranty_claim_description         CHECK (btrim(description) <> ''),
    CONSTRAINT ck_warranty_claim_outcome             CHECK (outcome IN ('CUBIERTO', 'FALLA_DISTINTA', 'FUERA_DE_PLAZO', 'REEMBOLSO')),
    CONSTRAINT ck_warranty_claim_part_paid_by        CHECK (part_paid_by IN ('TIENDA', 'CLIENTE')),
    CONSTRAINT ck_warranty_claim_refund              CHECK ((outcome = 'REEMBOLSO') = (refund_amount IS NOT NULL)),
    CONSTRAINT ck_warranty_claim_refund_amount       CHECK (refund_amount > 0),
    CONSTRAINT ck_warranty_claim_new_service         CHECK (id_new_service IS NULL OR (outcome = 'FALLA_DISTINTA'
                                                                                    AND id_new_service <> id_original_service)),
    CONSTRAINT ck_warranty_claim_sale                CHECK (id_sale IS NULL OR coalesce(part_paid_by, '') = 'CLIENTE')
);

-- ---------------------------------------------------------------------
-- Nivel 5
-- ---------------------------------------------------------------------

-- DEC-029 (caso 2): si la línea viene de una falla adicional, es una falla de ESTE servicio.
CREATE TABLE service_labor (
    id_service_labor       INTEGER       GENERATED ALWAYS AS IDENTITY,
    id_mechanical_service  INTEGER       NOT NULL,
    line_no                SMALLINT      NOT NULL,
    description            VARCHAR(200)  NOT NULL,
    amount                 NUMERIC(12,2) NOT NULL,
    id_service_type        INTEGER,
    id_additional_fault    INTEGER,

    CONSTRAINT pk_service_labor                       PRIMARY KEY (id_service_labor),
    CONSTRAINT fk_service_labor_id_mechanical_service FOREIGN KEY (id_mechanical_service) REFERENCES mechanical_service (id_mechanical_service),
    CONSTRAINT fk_service_labor_id_service_type       FOREIGN KEY (id_service_type)       REFERENCES service_type (id_service_type),
    CONSTRAINT fk_service_labor_id_additional_fault_id_mechanical_service
        FOREIGN KEY (id_additional_fault, id_mechanical_service)
        REFERENCES additional_fault (id_additional_fault, id_mechanical_service) MATCH SIMPLE,
    CONSTRAINT uq_service_labor_line                  UNIQUE (id_mechanical_service, line_no),
    CONSTRAINT ck_service_labor_line_no               CHECK (line_no > 0),
    CONSTRAINT ck_service_labor_description           CHECK (btrim(description) <> ''),
    CONSTRAINT ck_service_labor_amount                CHECK (amount >= 0)
);

-- DEC-029: la falla es del mismo servicio (caso 2) y UQ (id_service_part, id_product)
-- para la FK compuesta de inventory_movement (caso 3).
CREATE TABLE service_part (
    id_service_part        INTEGER       GENERATED ALWAYS AS IDENTITY,
    id_mechanical_service  INTEGER       NOT NULL,
    line_no                SMALLINT      NOT NULL,
    id_product             INTEGER       NOT NULL,
    quantity               INTEGER       NOT NULL,
    unit_price             NUMERIC(12,2) NOT NULL,
    id_additional_fault    INTEGER,

    CONSTRAINT pk_service_part                       PRIMARY KEY (id_service_part),
    CONSTRAINT fk_service_part_id_mechanical_service FOREIGN KEY (id_mechanical_service) REFERENCES mechanical_service (id_mechanical_service),
    CONSTRAINT fk_service_part_id_product            FOREIGN KEY (id_product)            REFERENCES product (id_product),
    CONSTRAINT fk_service_part_id_additional_fault_id_mechanical_service
        FOREIGN KEY (id_additional_fault, id_mechanical_service)
        REFERENCES additional_fault (id_additional_fault, id_mechanical_service) MATCH SIMPLE,
    CONSTRAINT uq_service_part_line                  UNIQUE (id_mechanical_service, line_no),
    CONSTRAINT uq_service_part_id_service_part_id_product UNIQUE (id_service_part, id_product),
    CONSTRAINT ck_service_part_line_no               CHECK (line_no > 0),
    CONSTRAINT ck_service_part_quantity              CHECK (quantity > 0),
    CONSTRAINT ck_service_part_unit_price            CHECK (unit_price >= 0)
);

CREATE TABLE customer_return (
    id_customer_return   INTEGER       GENERATED ALWAYS AS IDENTITY,
    id_sale_detail       INTEGER       NOT NULL,
    returned_on          DATE          NOT NULL DEFAULT CURRENT_DATE,
    quantity             INTEGER       NOT NULL,
    outcome              VARCHAR(20)   NOT NULL,
    id_exchange_product  INTEGER,
    refund_amount        NUMERIC(12,2),

    CONSTRAINT pk_customer_return                     PRIMARY KEY (id_customer_return),
    CONSTRAINT fk_customer_return_id_sale_detail      FOREIGN KEY (id_sale_detail)      REFERENCES sale_detail (id_sale_detail),
    CONSTRAINT fk_customer_return_id_exchange_product FOREIGN KEY (id_exchange_product) REFERENCES product (id_product),
    CONSTRAINT ck_customer_return_quantity            CHECK (quantity > 0),
    CONSTRAINT ck_customer_return_refund_amount       CHECK (refund_amount > 0),
    CONSTRAINT ck_customer_return_outcome             CHECK (
           (outcome = 'CAMBIO'    AND id_exchange_product IS NOT NULL AND refund_amount IS NULL)
        OR (outcome = 'REEMBOLSO' AND refund_amount IS NOT NULL AND id_exchange_product IS NULL))
);

-- ---------------------------------------------------------------------
-- Nivel 6
-- ---------------------------------------------------------------------

-- DEC-029 (caso 3): cuando el origen es una línea de compra, de venta o de
-- servicio, el producto del movimiento es el mismo de esa línea.
CREATE TABLE inventory_movement (
    id_inventory_movement  INTEGER       GENERATED ALWAYS AS IDENTITY,
    id_product             INTEGER       NOT NULL,
    moved_at               TIMESTAMP(0)  NOT NULL DEFAULT LOCALTIMESTAMP(0),
    reason                 VARCHAR(25)   NOT NULL,
    quantity               INTEGER       NOT NULL,
    unit_cost              NUMERIC(12,2) NOT NULL,
    notes                  VARCHAR(200),
    id_registered_by       INTEGER       NOT NULL,
    id_purchase_detail     INTEGER,
    id_sale_detail         INTEGER,
    id_service_part        INTEGER,
    id_customer_return     INTEGER,
    id_supplier_return     INTEGER,
    id_warranty_claim      INTEGER,

    CONSTRAINT pk_inventory_movement                    PRIMARY KEY (id_inventory_movement),
    CONSTRAINT fk_inventory_movement_id_product         FOREIGN KEY (id_product)         REFERENCES product (id_product),
    CONSTRAINT fk_inventory_movement_id_registered_by   FOREIGN KEY (id_registered_by)   REFERENCES staff (id_staff),
    CONSTRAINT fk_inventory_movement_id_purchase_detail_id_product
        FOREIGN KEY (id_purchase_detail, id_product) REFERENCES purchase_detail (id_purchase_detail, id_product) MATCH SIMPLE,
    CONSTRAINT fk_inventory_movement_id_sale_detail_id_product
        FOREIGN KEY (id_sale_detail, id_product)     REFERENCES sale_detail (id_sale_detail, id_product)         MATCH SIMPLE,
    CONSTRAINT fk_inventory_movement_id_service_part_id_product
        FOREIGN KEY (id_service_part, id_product)    REFERENCES service_part (id_service_part, id_product)       MATCH SIMPLE,
    CONSTRAINT fk_inventory_movement_id_customer_return FOREIGN KEY (id_customer_return) REFERENCES customer_return (id_customer_return),
    CONSTRAINT fk_inventory_movement_id_supplier_return FOREIGN KEY (id_supplier_return) REFERENCES supplier_return (id_supplier_return),
    CONSTRAINT fk_inventory_movement_id_warranty_claim  FOREIGN KEY (id_warranty_claim)  REFERENCES warranty_claim (id_warranty_claim),
    CONSTRAINT uq_inventory_movement_id_purchase_detail UNIQUE (id_purchase_detail),
    CONSTRAINT uq_inventory_movement_id_sale_detail     UNIQUE (id_sale_detail),
    CONSTRAINT uq_inventory_movement_id_service_part    UNIQUE (id_service_part),
    CONSTRAINT uq_inventory_movement_id_supplier_return UNIQUE (id_supplier_return),
    CONSTRAINT uq_inventory_movement_customer_return    UNIQUE (id_customer_return, reason),
    CONSTRAINT ck_inventory_movement_quantity           CHECK (quantity > 0),
    CONSTRAINT ck_inventory_movement_unit_cost          CHECK (unit_cost >= 0),
    CONSTRAINT ck_inventory_movement_reason             CHECK (reason IN (
        'COMPRA', 'DEVOLUCION_CLIENTE', 'INVENTARIO_INICIAL', 'AJUSTE_ENTRADA',
        'VENTA', 'USO_SERVICIO', 'CAMBIO_CLIENTE', 'DEVOLUCION_PROVEEDOR', 'GARANTIA', 'AJUSTE_SALIDA')),
    CONSTRAINT ck_inventory_movement_notes              CHECK (
        reason NOT IN ('AJUSTE_ENTRADA', 'AJUSTE_SALIDA') OR btrim(coalesce(notes, '')) <> ''),
    CONSTRAINT ck_inventory_movement_origin             CHECK (
        num_nonnulls(id_purchase_detail, id_sale_detail, id_service_part,
                     id_customer_return, id_supplier_return, id_warranty_claim)
            = CASE WHEN reason IN ('INVENTARIO_INICIAL', 'AJUSTE_ENTRADA', 'AJUSTE_SALIDA') THEN 0 ELSE 1 END
        AND (id_purchase_detail IS NULL OR reason = 'COMPRA')
        AND (id_sale_detail     IS NULL OR reason = 'VENTA')
        AND (id_service_part    IS NULL OR reason = 'USO_SERVICIO')
        AND (id_customer_return IS NULL OR reason IN ('DEVOLUCION_CLIENTE', 'CAMBIO_CLIENTE'))
        AND (id_supplier_return IS NULL OR reason = 'DEVOLUCION_PROVEEDOR')
        AND (id_warranty_claim  IS NULL OR reason = 'GARANTIA'))
);

COMMIT;
```

### 5.2 Prueba: lo que la base rechaza y lo que acepta

Cada caso se ejecutó en su propia transacción (`BEGIN; … ROLLBACK;`) sobre los datos de prueba. Del 1 al 37 son las pruebas de la v1, repetidas; del 38 al 61, las nuevas de la v2.

| # | Intento | Resultado | Lo detiene |
| --- | --- | --- | --- |
| 1 | Marca duplicada en minúsculas | ❌ rechazado | `uq_product_brand_name` |
| 2 | Cédula repetida en minúscula | ❌ rechazado | `uq_customer_national_id` |
| 3 | Nombre vacío | ❌ rechazado | `ck_customer_name` |
| 4 | Rol inválido | ❌ rechazado | `ck_staff_role` |
| 5 | Porcentaje 150 | ❌ rechazado | `ck_mechanic_commission_rate` |
| 6 | Modelo repetido en la misma marca | ❌ rechazado | `uq_motorcycle_model_brand_name` |
| 7 | Placa repetida | ❌ rechazado | `uq_motorcycle_plate` |
| 8 | Factura repetida del mismo proveedor | ❌ rechazado | `uq_purchase_supplier_invoice` |
| 9 | Compra de contado con vencimiento | ❌ rechazado | `ck_purchase_due_date` |
| 10 | Compra recibida por el encargado | ❌ rechazado | `fk_purchase_id_received_by` |
| 11 | Crédito autorizado por el encargado | ❌ rechazado | `fk_credit_id_authorized_by` |
| 12 | Pago en dólares sin tipo de cambio | ❌ rechazado | `ck_customer_payment_exchange` |
| 13 | Pago en córdobas con tipo de cambio | ❌ rechazado | `ck_customer_payment_exchange` |
| 14 | Mismo pago aplicado dos veces al mismo documento | ❌ rechazado | `uq_payment_application_payment_document` |
| 15 | Línea de venta repetida | ❌ rechazado | `uq_sale_detail_line` |
| 16 | Cantidad cero | ❌ rechazado | `ck_sale_detail_quantity` |
| 17 | Línea de venta colgada de un servicio | ❌ rechazado | `fk_sale_detail_id_sale` |
| 18 | Estado inexistente | ❌ rechazado | `ck_status_change_status` |
| 19 | Decisión inválida de falla | ❌ rechazado | `ck_additional_fault_decision` |
| 20 | Movimiento de VENTA sin línea de venta | ❌ rechazado | `ck_inventory_movement_origin` |
| 21 | Movimiento con dos orígenes | ❌ rechazado | `ck_inventory_movement_origin` |
| 22 | Movimiento COMPRA apuntando a una línea de venta | ❌ rechazado | `ck_inventory_movement_origin` |
| 23 | Segundo movimiento para la misma línea de venta | ❌ rechazado | `uq_inventory_movement_id_sale_detail` |
| 24 | Inventario inicial con origen | ❌ rechazado | `ck_inventory_movement_origin` |
| 25 | Ajuste sin observación | ❌ rechazado | `ck_inventory_movement_notes` |
| 26 | Devolución con cambio y reembolso a la vez | ❌ rechazado | `ck_customer_return_outcome` |
| 27 | Reclamo REEMBOLSO sin monto | ❌ rechazado | `ck_warranty_claim_refund` |
| 28 | Reclamo cubierto que crea nuevo servicio | ❌ rechazado | `ck_warranty_claim_new_service` |
| 29 | Retiro OTRO sin descripción | ❌ rechazado | `ck_cash_withdrawal_description` |
| 30 | Pago al mecánico pagado sin quién pagó | ❌ rechazado | `ck_weekly_payout_paid_pair` |
| 31 | Dos pagos del mismo mecánico que empiezan el mismo día | ❌ rechazado | `uq_weekly_payout_id_mechanic_period_start` |
| 32 | Adelanto al encargado | ❌ rechazado | `fk_advance_id_mechanic` |
| 33 | Borrar un producto con historia | ❌ rechazado | `fk_price_history_id_product` |
| 34 | Saldo de apertura de proveedor sin fecha | ❌ rechazado | `ck_supplier_opening_pair` |
| 35 | Servicio liquidado sin porcentaje | ❌ rechazado | `ck_mechanical_service_payout_rate` |
| 36 | Pago a proveedor en dólares sin tipo de cambio | ❌ rechazado | `ck_supplier_payment_exchange` |
| 37 | Reclamo con venta pero sin decir quién paga la pieza | ❌ rechazado | `ck_warranty_claim_sale` |
| 38 | Pago a proveedor de una factura de OTRO proveedor (DEC-029, caso 1) | ❌ rechazado | `fk_supplier_payment_id_purchase_id_supplier` |
| 39 | Servicio del mecánico B liquidado en el pago del mecánico A (caso 2) | ❌ rechazado | `fk_mechanical_service_id_weekly_payout_id_responsible` |
| 40 | Servicio liquidado sin responsable (hueco del MATCH SIMPLE cerrado con la CK) | ❌ rechazado | `ck_mechanical_service_payout_rate` |
| 41 | Adelanto del mecánico B descontado en el pago del mecánico A (caso 2) | ❌ rechazado | `fk_advance_id_weekly_payout_id_mechanic` |
| 42 | Mano de obra del servicio 4 que apunta a una falla del servicio 3 (caso 2) | ❌ rechazado | `fk_service_labor_id_additional_fault_id_mechanical_service` |
| 43 | Producto del servicio 4 que apunta a una falla del servicio 3 (caso 2) | ❌ rechazado | `fk_service_part_id_additional_fault_id_mechanical_service` |
| 44 | Movimiento COMPRA con un producto distinto al de su línea (caso 3) | ❌ rechazado | `fk_inventory_movement_id_purchase_detail_id_product` |
| 45 | Movimiento VENTA con un producto distinto al de su línea (caso 3) | ❌ rechazado | `fk_inventory_movement_id_sale_detail_id_product` |
| 46 | Movimiento USO_SERVICIO con un producto distinto al de su línea (caso 3) | ❌ rechazado | `fk_inventory_movement_id_service_part_id_product` |
| 47 | Compra AL CRÉDITO sin vencimiento (DEC-032) | ❌ rechazado | `ck_purchase_due_date` |
| 48 | Vencimiento anterior a la compra | ❌ rechazado | `ck_purchase_due_date` |
| 49 | Descuento negativo en una compra (DEC-031) | ❌ rechazado | `ck_purchase_discount` |
| 50 | Periodo de pago que termina antes de empezar (DEC-030) | ❌ rechazado | `ck_weekly_payout_period` |
| 51 | Pago al mecánico antes de que empiece el periodo | ❌ rechazado | `ck_weekly_payout_paid_on` |
| 52 | Usuario de inicio de sesión para un mecánico (DEC-035) | ❌ rechazado | `ck_staff_login_role` |
| 53 | Usuario sin contraseña | ❌ rechazado | `ck_staff_login_pair` |
| 54 | Usuario repetido en mayúsculas | ❌ rechazado | `uq_staff_username` |
| 55 | Pago al saldo de apertura del proveedor (sin compra) | ✅ entra (válido) | — |
| 56 | Periodo corto de martes a jueves, pagado el jueves (DEC-030) | ✅ entra (válido) | — |
| 57 | Servicio pendiente de la semana pasada liquidado en el pago de esta semana | ✅ entra (válido) | — |
| 58 | Servicio hecho por un dueño, sin pago al mecánico | ✅ entra (válido) | — |
| 59 | Dos cambios de estado en la misma transacción (DEC-032) | ✅ entra (válido) | — |
| 60 | Inventario inicial sin origen | ✅ entra (válido) | — |
| 61 | Venta rápida de contado sin cliente | ✅ entra (válido) | — |

> **El hueco del `MATCH SIMPLE` (prueba 40, encontrado al escribir la v2).** Con `MATCH SIMPLE`, una FK compuesta **no se revisa** si alguna de sus columnas es nula. Un servicio liquidado (`id_weekly_payout` lleno) **sin responsable** (`id_responsible` nulo) habría pasado sin revisar de quién es el pago. Por eso `ck_mechanical_service_payout_rate` ahora exige también el responsable cuando hay pago.

> 	**La trampa del nulo (intento 12, encontrada en la prueba).** La primera versión de `ck_customer_payment_exchange` decía `currency = 'USD' AND exchange_rate > 0`. Con `exchange_rate` nulo, `exchange_rate > 0` no da *falso* sino **desconocido**, y un `CHECK` **solo rechaza lo que da falso**: el pago en dólares sin tipo de cambio entraba. Se corrigió con `exchange_rate IS NOT NULL AND …`, y lo mismo en `supplier_payment` y `warranty_claim` (`coalesce`).

## 6. Datos de demostración

> [!warning] 07-nov: el archivo `03_seed_demo.sql` se perdió
> Se rehace cuando Kenry pase otra vez la factura de compra. Debe incluir el **descuento de C$ 6,525** en la compra (`purchase.discount`) y el pago del mecánico con `period_start`/`period_end`. Lo de abajo es cómo se armó la v1 y sirve de guía.

Script: `db/postgres/03_seed_demo.sql`. Se ejecuta **después** de `01_schema.sql`, dentro de `BEGIN; … COMMIT;`.

**Qué es real y qué es inventado:**
- **Real:** los 63 productos, sus costos y sus precios de venta, tomados de una **factura de compra** de 64 líneas que suma **C$ 93,212.00**; el script la reproduce exacta.
- **Inventado para la demostración:** el personal, el proveedor, el número de factura (`FAC-000123`), los clientes, las motos y las operaciones.

**Cómo se leyó la factura:**

| Columna de la factura | Dónde va | Nota |
| --- | --- | --- |
| Código (`P0083`…) | **No se guarda** | Es el código **del proveedor**, no el nuestro: otro proveedor puede usar otro código para el mismo producto. |
| Repuesto | `product.name` | |
| Cantidad + Unidad | `purchase_detail.quantity` | `EA` (*each*) = unidad. `Bol` = bolsa: la bujía de pide vía viene en bolsas de 20, así que se registra **por pieza** (8 bolsas = 160 unidades). Es un caso real para Q-079. |
| P. Unit | `purchase_detail.unit_cost` | En la bolsa: 247 / 20 = 12.35 por pieza. |
| P. Total | No se guarda | Se calcula: cantidad × costo. |
| **Anotación manual** | `product.sale_price` | Es el **precio de venta** que el dueño anota sobre la factura (BR-015). Los "Mangos UFO-#3012" aparecen dos veces con dos precios anotados (160 y 190): un caso real de **cambio de precio** para `price_history`. |

**Orden de carga (el mismo de los niveles, porque cada FK necesita que exista su padre):**
1. Catálogos: categorías, marcas de producto y de moto, tipos de servicio.
2. Personal → `owner` y `mechanic`.
3. Proveedor → productos.
4. Compra (encabezado) → sus 64 líneas → un movimiento `COMPRA` por línea (así nace la existencia).
5. Historial de precio inicial.
6. Clientes → modelos → motos.
7. Operaciones de demostración:
   - venta de contado sin cliente;
   - servicio entregado, con mano de obra, el producto usado, cinco cambios de estado y una falla rechazada;
   - servicio que sigue en el taller, con una falla pendiente;
   - venta a crédito con un abono;
   - adelanto y pago semanal;
   - retiro de caja.

