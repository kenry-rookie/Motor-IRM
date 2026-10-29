---
project: "[[Motor IRM]]"
stage: S5
type: stage-product
status: 🟡 Completo y probado (29-oct) — pendiente de revisión del equipo
version: 1
date: 2026-10-28
based_on:
  - "[[S5 - Relational Schema - MIRM]]"
source_of_truth: db/postgres/01_schema.sql (repositorio de GitHub)
source: IA (nota y dos tablas de ejemplo redactadas por Claude a pedido de Kenry; el resto del DDL lo escribe el equipo)
ai_edit: "Claude — 2026-10-28: nota creada con los ejemplos product y billable_document; 2026-10-29: DDL completo (36 tablas), tablas de Kenry corregidas y prueba de 37 rechazos en PostgreSQL 16"
reviewed: true
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
    id_product INTEGER GENERATED ALWAYS AS IDENTITY,
    id_product_category INTEGER NOT NULL,
    id_product_brand INTEGER NOT NULL,
    name VARCHAR(150 NOT NULL,
    barcode VARCHAR(50),
    tier VARCHAR(20) NOT NULL,
    sale_price NUMERIC(12,2) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,

    CONSTRAINT pk_product PRIMARY KEY (id_product),
    
    CONSTRAINT fk_product_category_id FOREIGN KEY (id_product_category) REFERENCES product_category (id_product_category),
    CONSTRAINT fk_product_brand_id FOREIGN KEY (id_product_brand) REFERENCES product_brand (id_product_brand),
    CONSTRAINT uq_product_barcode UNIQUE (barcode),
    CONSTRAINT ck_product_name CHECK (btrim(name) <> ''),
    CONSTRAINT ck_product_barcode CHECK (barcode IS NULL OR btrim(barcode) <> ''),
    CONSTRAINT ck_product_tier CHECK (tier IN ('ALTA', 'MEDIA', 'GENERICO')),
    CONSTRAINT ck_product_sale_price  CHECK (sale_price > 0)
);

CREATE INDEX ix_product_category_id ON product (category_id);
CREATE INDEX ix_product_brand_id    ON product (brand_id);
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
    id_billable_document      INTEGER       GENERATED ALWAYS AS IDENTITY,
    kind                      VARCHAR(20)   NOT NULL,
    customer_id               INTEGER,
    registered_by_id          INTEGER       NOT NULL,
    created_at                TIMESTAMP(0)  NOT NULL DEFAULT LOCALTIMESTAMP(0),
    receipt_number            VARCHAR(20),
    terms                     VARCHAR(20)   NOT NULL,
    discount                  NUMERIC(12,2) NOT NULL DEFAULT 0,
    discount_authorized_by_id INTEGER,
    CONSTRAINT pk_billable_document
        PRIMARY KEY (id_billable_document),
    CONSTRAINT fk_billable_document_customer_id
        FOREIGN KEY (customer_id) REFERENCES customer (id_customer),
    CONSTRAINT fk_billable_document_registered_by_id
        FOREIGN KEY (registered_by_id) REFERENCES staff (id_staff),
    CONSTRAINT fk_billable_document_discount_authorized_by_id
        FOREIGN KEY (discount_authorized_by_id) REFERENCES owner (staff_id),
    CONSTRAINT uq_billable_document_receipt_number
        UNIQUE (receipt_number),
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
CREATE INDEX ix_billable_document_customer_id
    ON billable_document (customer_id);
CREATE INDEX ix_billable_document_registered_by_id
    ON billable_document (registered_by_id);
CREATE INDEX ix_billable_document_discount_authorized_by_id
    ON billable_document (discount_authorized_by_id);
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

## 5. DDL completo

> [!info] Estado (29-oct)
> - **Las 36 tablas corren sin errores en PostgreSQL 16** (script de una sola pasada, en el orden de los niveles).
> - **Probado:** se cargaron datos de los escenarios (inventario inicial, compra al crédito, venta de contado, servicio con falla adicional y crédito, saldo inicial, abono en dólares repartido entre dos documentos, devolución con cambio, pago semanal, adelanto, retiro y ajuste) y la consulta de existencia por producto dio el resultado esperado. Luego se intentó romper el modelo **37 veces**: las 37 fueron rechazadas (§5.3).
> - **Quién:** `product` y `billable_document` (ejemplos del 28-oct); `product_category`, `product_brand`, `motorcycle_brand`, `service_type`, `customer` y `staff` (primera versión de Kenry, corregida: §5.1); el resto redactado por Claude a pedido de Kenry el 29-oct.

### 5.1 Cambios respecto a la primera versión de Kenry

| Tema | Primera versión | Versión final | Por qué |
| --- | --- | --- | --- |
| Nombre de la PK | `id_product_category`, `id_costumer`… | `id` | Convención de §2 del esquema: todas las FK apuntan a `(id)`, y Django usa `id` por defecto. Mezclar los dos estilos rompe las FK entre tablas. |
| Nombres únicos **sin distinguir mayúsculas** | `CREATE UNIQUE INDEX … (LOWER(name))` | **Se conserva** y se aplica a todos los catálogos, al modelo de moto (por marca), a la cédula y a la placa | Buena idea de Kenry: evita "Yamaha" y "yamaha" como dos marcas (criterio 1 de DEC-008). Con este índice, el `UNIQUE` normal sobra. |
| Errores de escritura | `PRIMERY KEY`, `costumer`, `natioanl_id`, `role CODE` | `PRIMARY KEY`, `customer`, `national_id`, `VARCHAR(20)` | `CODE` es un dominio del esquema (§3), no un tipo de PostgreSQL. |
| Restricción con nombre de otra tabla | `ck_product_brand_name_not_blank` en `motorcycle_brand` | `ck_motorcycle_brand_name` | El nombre tiene que decir de qué tabla es: si falla, el error debe señalar la tabla correcta. |
| Cédula | `VARCHAR(15)`, con `UNIQUE` y además un índice con el **mismo nombre** | `VARCHAR(20)` y solo el índice `upper(national_id)` | Una cédula con guiones (`001-010190-0001A`) tiene 16 caracteres. Dos objetos con el mismo nombre hacen fallar el script. |
| `service_type.reference_price` | `NOT NULL` | Opcional | En el modelo el precio de referencia solo orienta y algunos servicios no lo tienen (BR-031). |
| `service_type.active` | Nueva columna | **Se conserva** | Un servicio del catálogo se desactiva, no se borra (T-12). Pasa al esquema al cerrar S5. |
| `staff.phone` | `NOT NULL` | **Se conserva** | Todo el personal tiene teléfono. Pasa al esquema al cerrar S5. |
| `staff.role` | `'PROPIETARIO'` | `'DUENO'` | Es el valor de todo el modelo (esquema, diagramas, restricciones). Si el equipo prefiere `PROPIETARIO`, se cambia en el esquema y aquí a la vez. |

### 5.2 Script

Se ejecuta completo y en este orden. Es la copia de `db/postgres/01_schema.sql`.

#### Nivel 0

```sql
CREATE TABLE product_category (
    id    INTEGER     GENERATED ALWAYS AS IDENTITY,
    name  VARCHAR(50) NOT NULL,

    CONSTRAINT pk_product_category      PRIMARY KEY (id),
    CONSTRAINT ck_product_category_name CHECK (btrim(name) <> '')
);
CREATE UNIQUE INDEX uq_product_category_name ON product_category (lower(name));

CREATE TABLE product_brand (
    id    INTEGER     GENERATED ALWAYS AS IDENTITY,
    name  VARCHAR(50) NOT NULL,

    CONSTRAINT pk_product_brand      PRIMARY KEY (id),
    CONSTRAINT ck_product_brand_name CHECK (btrim(name) <> '')
);
CREATE UNIQUE INDEX uq_product_brand_name ON product_brand (lower(name));

CREATE TABLE motorcycle_brand (
    id    INTEGER     GENERATED ALWAYS AS IDENTITY,
    name  VARCHAR(50) NOT NULL,

    CONSTRAINT pk_motorcycle_brand      PRIMARY KEY (id),
    CONSTRAINT ck_motorcycle_brand_name CHECK (btrim(name) <> '')
);
CREATE UNIQUE INDEX uq_motorcycle_brand_name ON motorcycle_brand (lower(name));

CREATE TABLE service_type (
    id               INTEGER       GENERATED ALWAYS AS IDENTITY,
    name             VARCHAR(50)   NOT NULL,
    reference_price  NUMERIC(12,2),
    active           BOOLEAN       NOT NULL DEFAULT TRUE,

    CONSTRAINT pk_service_type                 PRIMARY KEY (id),
    CONSTRAINT ck_service_type_name            CHECK (btrim(name) <> ''),
    CONSTRAINT ck_service_type_reference_price CHECK (reference_price >= 0)
);
CREATE UNIQUE INDEX uq_service_type_name ON service_type (lower(name));

CREATE TABLE customer (
    id           INTEGER      GENERATED ALWAYS AS IDENTITY,
    name         VARCHAR(100) NOT NULL,
    phone        VARCHAR(20)  NOT NULL,
    national_id  VARCHAR(20),
    address      VARCHAR(200),

    CONSTRAINT pk_customer             PRIMARY KEY (id),
    CONSTRAINT ck_customer_name        CHECK (btrim(name) <> ''),
    CONSTRAINT ck_customer_phone       CHECK (btrim(phone) <> ''),
    CONSTRAINT ck_customer_national_id CHECK (national_id IS NULL OR btrim(national_id) <> ''),
    CONSTRAINT ck_customer_address     CHECK (address IS NULL OR btrim(address) <> '')
);
CREATE UNIQUE INDEX uq_customer_national_id ON customer (upper(national_id));

CREATE TABLE staff (
    id      INTEGER      GENERATED ALWAYS AS IDENTITY,
    name    VARCHAR(100) NOT NULL,
    phone   VARCHAR(20)  NOT NULL,
    active  BOOLEAN      NOT NULL DEFAULT TRUE,
    role    VARCHAR(20)  NOT NULL,

    CONSTRAINT pk_staff       PRIMARY KEY (id),
    CONSTRAINT ck_staff_name  CHECK (btrim(name) <> ''),
    CONSTRAINT ck_staff_phone CHECK (btrim(phone) <> ''),
    CONSTRAINT ck_staff_role  CHECK (role IN ('DUENO', 'MECANICO', 'ENCARGADO'))
);

CREATE TABLE supplier (
    id               INTEGER       GENERATED ALWAYS AS IDENTITY,
    name             VARCHAR(100)  NOT NULL,
    phone            VARCHAR(20),
    contact_person   VARCHAR(100),
    gives_warranty   BOOLEAN,
    opening_balance  NUMERIC(12,2),
    opening_date     DATE,

    CONSTRAINT pk_supplier                 PRIMARY KEY (id),
    CONSTRAINT ck_supplier_name            CHECK (btrim(name) <> ''),
    CONSTRAINT ck_supplier_opening_balance CHECK (opening_balance >= 0),
    CONSTRAINT ck_supplier_opening_pair    CHECK ((opening_balance IS NULL) = (opening_date IS NULL))
);
```

#### Nivel 1

```sql
CREATE TABLE owner (
    staff_id  INTEGER NOT NULL,

    CONSTRAINT pk_owner          PRIMARY KEY (staff_id),
    CONSTRAINT fk_owner_staff_id FOREIGN KEY (staff_id) REFERENCES staff (id)
);

CREATE TABLE mechanic (
    staff_id         INTEGER      NOT NULL,
    commission_rate  NUMERIC(5,4) NOT NULL,

    CONSTRAINT pk_mechanic                 PRIMARY KEY (staff_id),
    CONSTRAINT fk_mechanic_staff_id        FOREIGN KEY (staff_id) REFERENCES staff (id),
    CONSTRAINT ck_mechanic_commission_rate CHECK (commission_rate > 0 AND commission_rate <= 1)
);

CREATE TABLE motorcycle_model (
    id        INTEGER     GENERATED ALWAYS AS IDENTITY,
    brand_id  INTEGER     NOT NULL,
    name      VARCHAR(50) NOT NULL,

    CONSTRAINT pk_motorcycle_model          PRIMARY KEY (id),
    CONSTRAINT fk_motorcycle_model_brand_id FOREIGN KEY (brand_id) REFERENCES motorcycle_brand (id),
    CONSTRAINT ck_motorcycle_model_name     CHECK (btrim(name) <> '')
);
CREATE UNIQUE INDEX uq_motorcycle_model_brand_name ON motorcycle_model (brand_id, lower(name));

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

#### Nivel 2

```sql
CREATE TABLE motorcycle (
    id           INTEGER      GENERATED ALWAYS AS IDENTITY,
    customer_id  INTEGER      NOT NULL,
    model_id     INTEGER      NOT NULL,
    color        VARCHAR(30)  NOT NULL,
    plate        VARCHAR(15),
    notes        VARCHAR(200),

    CONSTRAINT pk_motorcycle             PRIMARY KEY (id),
    CONSTRAINT fk_motorcycle_customer_id FOREIGN KEY (customer_id) REFERENCES customer (id),
    CONSTRAINT fk_motorcycle_model_id    FOREIGN KEY (model_id)    REFERENCES motorcycle_model (id),
    CONSTRAINT ck_motorcycle_color       CHECK (btrim(color) <> ''),
    CONSTRAINT ck_motorcycle_plate       CHECK (plate IS NULL OR btrim(plate) <> '')
);
CREATE UNIQUE INDEX uq_motorcycle_plate ON motorcycle (upper(plate));

CREATE TABLE price_history (
    id             INTEGER       GENERATED ALWAYS AS IDENTITY,
    product_id     INTEGER       NOT NULL,
    changed_at     TIMESTAMP     NOT NULL DEFAULT LOCALTIMESTAMP,
    new_price      NUMERIC(12,2) NOT NULL,
    changed_by_id  INTEGER,

    CONSTRAINT pk_price_history               PRIMARY KEY (id),
    CONSTRAINT fk_price_history_product_id    FOREIGN KEY (product_id)    REFERENCES product (id),
    CONSTRAINT fk_price_history_changed_by_id FOREIGN KEY (changed_by_id) REFERENCES owner (staff_id),
    CONSTRAINT uq_price_history_product_time  UNIQUE (product_id, changed_at),
    CONSTRAINT ck_price_history_new_price     CHECK (new_price >= 0)
);

CREATE TABLE purchase (
    id              INTEGER     GENERATED ALWAYS AS IDENTITY,
    supplier_id     INTEGER     NOT NULL,
    invoice_number  VARCHAR(30) NOT NULL,
    purchase_date   DATE        NOT NULL DEFAULT CURRENT_DATE,
    terms           VARCHAR(20) NOT NULL,
    due_date        DATE,
    received_by_id  INTEGER     NOT NULL,

    CONSTRAINT pk_purchase                  PRIMARY KEY (id),
    CONSTRAINT fk_purchase_supplier_id      FOREIGN KEY (supplier_id)    REFERENCES supplier (id),
    CONSTRAINT fk_purchase_received_by_id   FOREIGN KEY (received_by_id) REFERENCES owner (staff_id),
    CONSTRAINT uq_purchase_supplier_invoice UNIQUE (supplier_id, invoice_number),
    CONSTRAINT ck_purchase_invoice_number   CHECK (btrim(invoice_number) <> ''),
    CONSTRAINT ck_purchase_terms            CHECK (terms IN ('CONTADO', 'CREDITO')),
    CONSTRAINT ck_purchase_due_date         CHECK (due_date IS NULL OR (terms = 'CREDITO' AND due_date >= purchase_date))
);

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

CREATE TABLE weekly_payout (
    id           INTEGER GENERATED ALWAYS AS IDENTITY,
    mechanic_id  INTEGER NOT NULL,
    week_start   DATE    NOT NULL,
    week_end     DATE    NOT NULL,
    paid_on      DATE,
    paid_by_id   INTEGER,

    CONSTRAINT pk_weekly_payout             PRIMARY KEY (id),
    CONSTRAINT fk_weekly_payout_mechanic_id FOREIGN KEY (mechanic_id) REFERENCES mechanic (staff_id),
    CONSTRAINT fk_weekly_payout_paid_by_id  FOREIGN KEY (paid_by_id)  REFERENCES owner (staff_id),
    CONSTRAINT uq_weekly_payout_mechanic_week UNIQUE (mechanic_id, week_start),
    CONSTRAINT ck_weekly_payout_week        CHECK (week_end >= week_start),
    CONSTRAINT ck_weekly_payout_paid_pair   CHECK ((paid_on IS NULL) = (paid_by_id IS NULL)),
    CONSTRAINT ck_weekly_payout_paid_on     CHECK (paid_on IS NULL OR paid_on >= week_start)
);

CREATE TABLE cash_withdrawal (
    id            INTEGER       GENERATED ALWAYS AS IDENTITY,
    owner_id      INTEGER       NOT NULL,
    withdrawn_on  DATE          NOT NULL DEFAULT CURRENT_DATE,
    amount        NUMERIC(12,2) NOT NULL,
    reason        VARCHAR(20)   NOT NULL,
    description   VARCHAR(200),

    CONSTRAINT pk_cash_withdrawal             PRIMARY KEY (id),
    CONSTRAINT fk_cash_withdrawal_owner_id    FOREIGN KEY (owner_id) REFERENCES owner (staff_id),
    CONSTRAINT ck_cash_withdrawal_amount      CHECK (amount > 0),
    CONSTRAINT ck_cash_withdrawal_reason      CHECK (reason IN ('CONSUMO_INTERNO', 'VIAJE', 'IMPUESTO', 'OTRO')),
    CONSTRAINT ck_cash_withdrawal_description CHECK (reason <> 'OTRO' OR btrim(coalesce(description, '')) <> '')
);
```

#### Nivel 3

```sql
CREATE TABLE purchase_detail (
    id           INTEGER       GENERATED ALWAYS AS IDENTITY,
    purchase_id  INTEGER       NOT NULL,
    line_no      SMALLINT      NOT NULL,
    product_id   INTEGER       NOT NULL,
    quantity     INTEGER       NOT NULL,
    unit_cost    NUMERIC(12,2) NOT NULL,

    CONSTRAINT pk_purchase_detail             PRIMARY KEY (id),
    CONSTRAINT fk_purchase_detail_purchase_id FOREIGN KEY (purchase_id) REFERENCES purchase (id),
    CONSTRAINT fk_purchase_detail_product_id  FOREIGN KEY (product_id)  REFERENCES product (id),
    CONSTRAINT uq_purchase_detail_line        UNIQUE (purchase_id, line_no),
    CONSTRAINT ck_purchase_detail_line_no     CHECK (line_no > 0),
    CONSTRAINT ck_purchase_detail_quantity    CHECK (quantity > 0),
    CONSTRAINT ck_purchase_detail_unit_cost   CHECK (unit_cost >= 0)
);

CREATE TABLE supplier_payment (
    id             INTEGER       GENERATED ALWAYS AS IDENTITY,
    supplier_id    INTEGER       NOT NULL,
    purchase_id    INTEGER,
    paid_on        DATE          NOT NULL DEFAULT CURRENT_DATE,
    amount         NUMERIC(12,2) NOT NULL,
    currency       VARCHAR(3)    NOT NULL DEFAULT 'NIO',
    exchange_rate  NUMERIC(10,4),

    CONSTRAINT pk_supplier_payment             PRIMARY KEY (id),
    CONSTRAINT fk_supplier_payment_supplier_id FOREIGN KEY (supplier_id) REFERENCES supplier (id),
    CONSTRAINT fk_supplier_payment_purchase_id FOREIGN KEY (purchase_id) REFERENCES purchase (id),
    CONSTRAINT ck_supplier_payment_amount      CHECK (amount > 0),
    CONSTRAINT ck_supplier_payment_currency    CHECK (currency IN ('NIO', 'USD')),
    CONSTRAINT ck_supplier_payment_exchange    CHECK ((currency = 'NIO' AND exchange_rate IS NULL)
                                                   OR (currency = 'USD' AND exchange_rate IS NOT NULL AND exchange_rate > 0))
);

CREATE TABLE sale (
    document_id  INTEGER NOT NULL,

    CONSTRAINT pk_sale             PRIMARY KEY (document_id),
    CONSTRAINT fk_sale_document_id FOREIGN KEY (document_id) REFERENCES billable_document (id)
);

CREATE TABLE opening_balance (
    document_id  INTEGER       NOT NULL,
    amount       NUMERIC(12,2) NOT NULL,
    description  VARCHAR(200),

    CONSTRAINT pk_opening_balance             PRIMARY KEY (document_id),
    CONSTRAINT fk_opening_balance_document_id FOREIGN KEY (document_id) REFERENCES billable_document (id),
    CONSTRAINT ck_opening_balance_amount      CHECK (amount > 0)
);

CREATE TABLE mechanical_service (
    document_id          INTEGER       NOT NULL,
    motorcycle_id        INTEGER       NOT NULL,
    responsible_id       INTEGER,
    requested_work       VARCHAR(500)  NOT NULL,
    diagnosis            VARCHAR(500),
    cancellation_amount  NUMERIC(12,2),
    applied_rate         NUMERIC(5,4),
    weekly_payout_id     INTEGER,

    CONSTRAINT pk_mechanical_service                  PRIMARY KEY (document_id),
    CONSTRAINT fk_mechanical_service_document_id      FOREIGN KEY (document_id)      REFERENCES billable_document (id),
    CONSTRAINT fk_mechanical_service_motorcycle_id    FOREIGN KEY (motorcycle_id)    REFERENCES motorcycle (id),
    CONSTRAINT fk_mechanical_service_responsible_id   FOREIGN KEY (responsible_id)   REFERENCES staff (id),
    CONSTRAINT fk_mechanical_service_weekly_payout_id FOREIGN KEY (weekly_payout_id) REFERENCES weekly_payout (id),
    CONSTRAINT ck_mechanical_service_requested_work   CHECK (btrim(requested_work) <> ''),
    CONSTRAINT ck_mechanical_service_cancellation     CHECK (cancellation_amount >= 0),
    CONSTRAINT ck_mechanical_service_applied_rate     CHECK (applied_rate > 0 AND applied_rate <= 1),
    CONSTRAINT ck_mechanical_service_payout_rate      CHECK (weekly_payout_id IS NULL OR applied_rate IS NOT NULL)
);

CREATE TABLE credit (
    document_id        INTEGER      NOT NULL,
    authorized_by_id   INTEGER      NOT NULL,
    granted_on         DATE         NOT NULL DEFAULT CURRENT_DATE,
    due_date           DATE         NOT NULL,
    extended_due_date  DATE,
    monthly_interest   NUMERIC(5,4) NOT NULL DEFAULT 0,

    CONSTRAINT pk_credit                  PRIMARY KEY (document_id),
    CONSTRAINT fk_credit_document_id      FOREIGN KEY (document_id)      REFERENCES billable_document (id),
    CONSTRAINT fk_credit_authorized_by_id FOREIGN KEY (authorized_by_id) REFERENCES owner (staff_id),
    CONSTRAINT ck_credit_due_date         CHECK (due_date >= granted_on),
    CONSTRAINT ck_credit_extended_due     CHECK (extended_due_date IS NULL OR extended_due_date > due_date),
    CONSTRAINT ck_credit_monthly_interest CHECK (monthly_interest >= 0 AND monthly_interest < 1)
);

CREATE TABLE customer_payment (
    id              INTEGER       GENERATED ALWAYS AS IDENTITY,
    paid_at         TIMESTAMP(0)  NOT NULL DEFAULT LOCALTIMESTAMP(0),
    amount          NUMERIC(12,2) NOT NULL,
    currency        VARCHAR(3)    NOT NULL DEFAULT 'NIO',
    exchange_rate   NUMERIC(10,4),
    method          VARCHAR(20)   NOT NULL,
    received_by_id  INTEGER       NOT NULL,

    CONSTRAINT pk_customer_payment                PRIMARY KEY (id),
    CONSTRAINT fk_customer_payment_received_by_id FOREIGN KEY (received_by_id) REFERENCES staff (id),
    CONSTRAINT ck_customer_payment_amount         CHECK (amount > 0),
    CONSTRAINT ck_customer_payment_currency       CHECK (currency IN ('NIO', 'USD')),
    CONSTRAINT ck_customer_payment_exchange       CHECK ((currency = 'NIO' AND exchange_rate IS NULL)
                                                      OR (currency = 'USD' AND exchange_rate IS NOT NULL AND exchange_rate > 0)),
    CONSTRAINT ck_customer_payment_method         CHECK (method IN ('EFECTIVO', 'TRANSFERENCIA'))
);

CREATE TABLE advance (
    id                INTEGER       GENERATED ALWAYS AS IDENTITY,
    mechanic_id       INTEGER       NOT NULL,
    given_on          DATE          NOT NULL DEFAULT CURRENT_DATE,
    amount            NUMERIC(12,2) NOT NULL,
    given_by_id       INTEGER       NOT NULL,
    weekly_payout_id  INTEGER,

    CONSTRAINT pk_advance                  PRIMARY KEY (id),
    CONSTRAINT fk_advance_mechanic_id      FOREIGN KEY (mechanic_id)      REFERENCES mechanic (staff_id),
    CONSTRAINT fk_advance_given_by_id      FOREIGN KEY (given_by_id)      REFERENCES owner (staff_id),
    CONSTRAINT fk_advance_weekly_payout_id FOREIGN KEY (weekly_payout_id) REFERENCES weekly_payout (id),
    CONSTRAINT ck_advance_amount           CHECK (amount > 0)
);
```

#### Nivel 4

```sql
CREATE TABLE supplier_return (
    id                  INTEGER      GENERATED ALWAYS AS IDENTITY,
    purchase_detail_id  INTEGER      NOT NULL,
    returned_on         DATE         NOT NULL DEFAULT CURRENT_DATE,
    quantity            INTEGER      NOT NULL,
    reason              VARCHAR(200) NOT NULL,
    resolution          VARCHAR(20),

    CONSTRAINT pk_supplier_return                    PRIMARY KEY (id),
    CONSTRAINT fk_supplier_return_purchase_detail_id FOREIGN KEY (purchase_detail_id) REFERENCES purchase_detail (id),
    CONSTRAINT ck_supplier_return_quantity           CHECK (quantity > 0),
    CONSTRAINT ck_supplier_return_reason             CHECK (btrim(reason) <> ''),
    CONSTRAINT ck_supplier_return_resolution         CHECK (resolution IN ('REPOSICION', 'DINERO', 'DESCUENTO'))
);

CREATE TABLE sale_detail (
    id          INTEGER       GENERATED ALWAYS AS IDENTITY,
    sale_id     INTEGER       NOT NULL,
    line_no     SMALLINT      NOT NULL,
    product_id  INTEGER       NOT NULL,
    quantity    INTEGER       NOT NULL,
    unit_price  NUMERIC(12,2) NOT NULL,

    CONSTRAINT pk_sale_detail            PRIMARY KEY (id),
    CONSTRAINT fk_sale_detail_sale_id    FOREIGN KEY (sale_id)    REFERENCES sale (document_id),
    CONSTRAINT fk_sale_detail_product_id FOREIGN KEY (product_id) REFERENCES product (id),
    CONSTRAINT uq_sale_detail_line       UNIQUE (sale_id, line_no),
    CONSTRAINT ck_sale_detail_line_no    CHECK (line_no > 0),
    CONSTRAINT ck_sale_detail_quantity   CHECK (quantity > 0),
    CONSTRAINT ck_sale_detail_unit_price CHECK (unit_price >= 0)
);

CREATE TABLE payment_application (
    payment_id      INTEGER       NOT NULL,
    document_id     INTEGER       NOT NULL,
    applied_amount  NUMERIC(12,2) NOT NULL,

    CONSTRAINT pk_payment_application             PRIMARY KEY (payment_id, document_id),
    CONSTRAINT fk_payment_application_payment_id  FOREIGN KEY (payment_id)  REFERENCES customer_payment (id),
    CONSTRAINT fk_payment_application_document_id FOREIGN KEY (document_id) REFERENCES billable_document (id),
    CONSTRAINT ck_payment_application_amount      CHECK (applied_amount > 0)
);

CREATE TABLE status_change (
    id                INTEGER      GENERATED ALWAYS AS IDENTITY,
    service_id        INTEGER      NOT NULL,
    changed_at        TIMESTAMP    NOT NULL DEFAULT LOCALTIMESTAMP,
    status            VARCHAR(20)  NOT NULL,
    notes             VARCHAR(200),
    registered_by_id  INTEGER      NOT NULL,

    CONSTRAINT pk_status_change                  PRIMARY KEY (id),
    CONSTRAINT fk_status_change_service_id       FOREIGN KEY (service_id)       REFERENCES mechanical_service (document_id),
    CONSTRAINT fk_status_change_registered_by_id FOREIGN KEY (registered_by_id) REFERENCES staff (id),
    CONSTRAINT uq_status_change_service_time     UNIQUE (service_id, changed_at),
    CONSTRAINT ck_status_change_status           CHECK (status IN ('RECIBIDA', 'EN_DIAGNOSTICO', 'EN_PROCESO',
                                                                   'ESPERA_REPUESTO', 'ESPERA_CLIENTE', 'TERMINADA',
                                                                   'EN_PRUEBA', 'ENTREGADA', 'CANCELADA'))
);

CREATE TABLE additional_fault (
    id              INTEGER       GENERATED ALWAYS AS IDENTITY,
    service_id      INTEGER       NOT NULL,
    fault_no        SMALLINT      NOT NULL,
    reported_on     DATE          NOT NULL DEFAULT CURRENT_DATE,
    description     VARCHAR(500)  NOT NULL,
    proposed_price  NUMERIC(12,2),
    decision        VARCHAR(20)   NOT NULL DEFAULT 'PENDIENTE',

    CONSTRAINT pk_additional_fault                PRIMARY KEY (id),
    CONSTRAINT fk_additional_fault_service_id     FOREIGN KEY (service_id) REFERENCES mechanical_service (document_id),
    CONSTRAINT uq_additional_fault_number         UNIQUE (service_id, fault_no),
    CONSTRAINT ck_additional_fault_fault_no       CHECK (fault_no > 0),
    CONSTRAINT ck_additional_fault_description    CHECK (btrim(description) <> ''),
    CONSTRAINT ck_additional_fault_proposed_price CHECK (proposed_price >= 0),
    CONSTRAINT ck_additional_fault_decision       CHECK (decision IN ('PENDIENTE', 'ACEPTADA', 'RECHAZADA'))
);

CREATE TABLE external_charge (
    id           INTEGER       GENERATED ALWAYS AS IDENTITY,
    service_id   INTEGER       NOT NULL,
    line_no      SMALLINT      NOT NULL,
    description  VARCHAR(200)  NOT NULL,
    amount       NUMERIC(12,2) NOT NULL,

    CONSTRAINT pk_external_charge             PRIMARY KEY (id),
    CONSTRAINT fk_external_charge_service_id  FOREIGN KEY (service_id) REFERENCES mechanical_service (document_id),
    CONSTRAINT uq_external_charge_line        UNIQUE (service_id, line_no),
    CONSTRAINT ck_external_charge_line_no     CHECK (line_no > 0),
    CONSTRAINT ck_external_charge_description CHECK (btrim(description) <> ''),
    CONSTRAINT ck_external_charge_amount      CHECK (amount >= 0)
);

CREATE TABLE warranty_claim (
    id                   INTEGER       GENERATED ALWAYS AS IDENTITY,
    original_service_id  INTEGER       NOT NULL,
    claimed_on           DATE          NOT NULL DEFAULT CURRENT_DATE,
    description          VARCHAR(500)  NOT NULL,
    outcome              VARCHAR(20)   NOT NULL,
    part_paid_by         VARCHAR(20),
    refund_amount        NUMERIC(12,2),
    attended_by_id       INTEGER       NOT NULL,
    new_service_id       INTEGER,
    sale_id              INTEGER,

    CONSTRAINT pk_warranty_claim                     PRIMARY KEY (id),
    CONSTRAINT fk_warranty_claim_original_service_id FOREIGN KEY (original_service_id) REFERENCES mechanical_service (document_id),
    CONSTRAINT fk_warranty_claim_attended_by_id      FOREIGN KEY (attended_by_id)      REFERENCES owner (staff_id),
    CONSTRAINT fk_warranty_claim_new_service_id      FOREIGN KEY (new_service_id)      REFERENCES mechanical_service (document_id),
    CONSTRAINT fk_warranty_claim_sale_id             FOREIGN KEY (sale_id)             REFERENCES sale (document_id),
    CONSTRAINT uq_warranty_claim_new_service_id      UNIQUE (new_service_id),
    CONSTRAINT uq_warranty_claim_sale_id             UNIQUE (sale_id),
    CONSTRAINT ck_warranty_claim_description         CHECK (btrim(description) <> ''),
    CONSTRAINT ck_warranty_claim_outcome             CHECK (outcome IN ('CUBIERTO', 'FALLA_DISTINTA', 'FUERA_DE_PLAZO', 'REEMBOLSO')),
    CONSTRAINT ck_warranty_claim_part_paid_by        CHECK (part_paid_by IN ('TIENDA', 'CLIENTE')),
    CONSTRAINT ck_warranty_claim_refund              CHECK ((outcome = 'REEMBOLSO') = (refund_amount IS NOT NULL)),
    CONSTRAINT ck_warranty_claim_refund_amount       CHECK (refund_amount > 0),
    CONSTRAINT ck_warranty_claim_new_service         CHECK (new_service_id IS NULL OR (outcome = 'FALLA_DISTINTA'
                                                                                    AND new_service_id <> original_service_id)),
    CONSTRAINT ck_warranty_claim_sale                CHECK (sale_id IS NULL OR coalesce(part_paid_by, '') = 'CLIENTE')
);
```

#### Nivel 5

```sql
CREATE TABLE service_labor (
    id                   INTEGER       GENERATED ALWAYS AS IDENTITY,
    service_id           INTEGER       NOT NULL,
    line_no              SMALLINT      NOT NULL,
    description          VARCHAR(200)  NOT NULL,
    amount               NUMERIC(12,2) NOT NULL,
    service_type_id      INTEGER,
    additional_fault_id  INTEGER,

    CONSTRAINT pk_service_labor                     PRIMARY KEY (id),
    CONSTRAINT fk_service_labor_service_id          FOREIGN KEY (service_id)          REFERENCES mechanical_service (document_id),
    CONSTRAINT fk_service_labor_service_type_id     FOREIGN KEY (service_type_id)     REFERENCES service_type (id),
    CONSTRAINT fk_service_labor_additional_fault_id FOREIGN KEY (additional_fault_id) REFERENCES additional_fault (id),
    CONSTRAINT uq_service_labor_line                UNIQUE (service_id, line_no),
    CONSTRAINT ck_service_labor_line_no             CHECK (line_no > 0),
    CONSTRAINT ck_service_labor_description         CHECK (btrim(description) <> ''),
    CONSTRAINT ck_service_labor_amount              CHECK (amount >= 0)
);

CREATE TABLE service_part (
    id                   INTEGER       GENERATED ALWAYS AS IDENTITY,
    service_id           INTEGER       NOT NULL,
    line_no              SMALLINT      NOT NULL,
    product_id           INTEGER       NOT NULL,
    quantity             INTEGER       NOT NULL,
    unit_price           NUMERIC(12,2) NOT NULL,
    additional_fault_id  INTEGER,

    CONSTRAINT pk_service_part                     PRIMARY KEY (id),
    CONSTRAINT fk_service_part_service_id          FOREIGN KEY (service_id)          REFERENCES mechanical_service (document_id),
    CONSTRAINT fk_service_part_product_id          FOREIGN KEY (product_id)          REFERENCES product (id),
    CONSTRAINT fk_service_part_additional_fault_id FOREIGN KEY (additional_fault_id) REFERENCES additional_fault (id),
    CONSTRAINT uq_service_part_line                UNIQUE (service_id, line_no),
    CONSTRAINT ck_service_part_line_no             CHECK (line_no > 0),
    CONSTRAINT ck_service_part_quantity            CHECK (quantity > 0),
    CONSTRAINT ck_service_part_unit_price          CHECK (unit_price >= 0)
);

CREATE TABLE customer_return (
    id                   INTEGER       GENERATED ALWAYS AS IDENTITY,
    sale_detail_id       INTEGER       NOT NULL,
    returned_on          DATE          NOT NULL DEFAULT CURRENT_DATE,
    quantity             INTEGER       NOT NULL,
    outcome              VARCHAR(20)   NOT NULL,
    exchange_product_id  INTEGER,
    refund_amount        NUMERIC(12,2),

    CONSTRAINT pk_customer_return                     PRIMARY KEY (id),
    CONSTRAINT fk_customer_return_sale_detail_id      FOREIGN KEY (sale_detail_id)      REFERENCES sale_detail (id),
    CONSTRAINT fk_customer_return_exchange_product_id FOREIGN KEY (exchange_product_id) REFERENCES product (id),
    CONSTRAINT ck_customer_return_quantity            CHECK (quantity > 0),
    CONSTRAINT ck_customer_return_refund_amount       CHECK (refund_amount > 0),
    CONSTRAINT ck_customer_return_outcome             CHECK (
           (outcome = 'CAMBIO'    AND exchange_product_id IS NOT NULL AND refund_amount IS NULL)
        OR (outcome = 'REEMBOLSO' AND refund_amount IS NOT NULL AND exchange_product_id IS NULL))
);
```

#### Nivel 6

```sql
CREATE TABLE inventory_movement (
    id                  INTEGER       GENERATED ALWAYS AS IDENTITY,
    product_id          INTEGER       NOT NULL,
    moved_at            TIMESTAMP(0)  NOT NULL DEFAULT LOCALTIMESTAMP(0),
    reason              VARCHAR(25)   NOT NULL,
    quantity            INTEGER       NOT NULL,
    unit_cost           NUMERIC(12,2) NOT NULL,
    notes               VARCHAR(200),
    registered_by_id    INTEGER       NOT NULL,
    purchase_detail_id  INTEGER,
    sale_detail_id      INTEGER,
    service_part_id     INTEGER,
    customer_return_id  INTEGER,
    supplier_return_id  INTEGER,
    warranty_claim_id   INTEGER,

    CONSTRAINT pk_inventory_movement PRIMARY KEY (id),
    CONSTRAINT fk_inventory_movement_product_id         FOREIGN KEY (product_id)         REFERENCES product (id),
    CONSTRAINT fk_inventory_movement_registered_by_id   FOREIGN KEY (registered_by_id)   REFERENCES staff (id),
    CONSTRAINT fk_inventory_movement_purchase_detail_id FOREIGN KEY (purchase_detail_id) REFERENCES purchase_detail (id),
    CONSTRAINT fk_inventory_movement_sale_detail_id     FOREIGN KEY (sale_detail_id)     REFERENCES sale_detail (id),
    CONSTRAINT fk_inventory_movement_service_part_id    FOREIGN KEY (service_part_id)    REFERENCES service_part (id),
    CONSTRAINT fk_inventory_movement_customer_return_id FOREIGN KEY (customer_return_id) REFERENCES customer_return (id),
    CONSTRAINT fk_inventory_movement_supplier_return_id FOREIGN KEY (supplier_return_id) REFERENCES supplier_return (id),
    CONSTRAINT fk_inventory_movement_warranty_claim_id  FOREIGN KEY (warranty_claim_id)  REFERENCES warranty_claim (id),
    CONSTRAINT uq_inventory_movement_purchase_detail_id UNIQUE (purchase_detail_id),
    CONSTRAINT uq_inventory_movement_sale_detail_id     UNIQUE (sale_detail_id),
    CONSTRAINT uq_inventory_movement_service_part_id    UNIQUE (service_part_id),
    CONSTRAINT uq_inventory_movement_supplier_return_id UNIQUE (supplier_return_id),
    CONSTRAINT uq_inventory_movement_customer_return    UNIQUE (customer_return_id, reason),
    CONSTRAINT ck_inventory_movement_quantity  CHECK (quantity > 0),
    CONSTRAINT ck_inventory_movement_unit_cost CHECK (unit_cost >= 0),
    CONSTRAINT ck_inventory_movement_reason    CHECK (reason IN (
        'COMPRA', 'DEVOLUCION_CLIENTE', 'INVENTARIO_INICIAL', 'AJUSTE_ENTRADA',
        'VENTA', 'USO_SERVICIO', 'CAMBIO_CLIENTE', 'DEVOLUCION_PROVEEDOR', 'GARANTIA', 'AJUSTE_SALIDA')),
    CONSTRAINT ck_inventory_movement_notes     CHECK (
        reason NOT IN ('AJUSTE_ENTRADA', 'AJUSTE_SALIDA') OR btrim(coalesce(notes, '')) <> ''),
    CONSTRAINT ck_inventory_movement_origin    CHECK (
        num_nonnulls(purchase_detail_id, sale_detail_id, service_part_id,
                     customer_return_id, supplier_return_id, warranty_claim_id)
            = CASE WHEN reason IN ('INVENTARIO_INICIAL', 'AJUSTE_ENTRADA', 'AJUSTE_SALIDA') THEN 0 ELSE 1 END
        AND (purchase_detail_id IS NULL OR reason = 'COMPRA')
        AND (sale_detail_id     IS NULL OR reason = 'VENTA')
        AND (service_part_id    IS NULL OR reason = 'USO_SERVICIO')
        AND (customer_return_id IS NULL OR reason IN ('DEVOLUCION_CLIENTE', 'CAMBIO_CLIENTE'))
        AND (supplier_return_id IS NULL OR reason = 'DEVOLUCION_PROVEEDOR')
        AND (warranty_claim_id  IS NULL OR reason = 'GARANTIA'))
);
```

### 5.3 Prueba: lo que la base rechaza

| # | Intento | Lo detiene |
| --- | --- | --- |
| 1 | Marca duplicada en minúsculas | `uq_product_brand_name` |
| 2 | Cédula repetida en minúscula | `uq_customer_national_id` |
| 3 | Nombre vacío | `ck_customer_name` |
| 4 | Rol inválido | `ck_staff_role` |
| 5 | Porcentaje 150 | `ck_mechanic_commission_rate` |
| 6 | Modelo repetido en la misma marca | `uq_motorcycle_model_brand_name` |
| 7 | Placa repetida | `uq_motorcycle_plate` |
| 8 | Factura repetida del mismo proveedor | `uq_purchase_supplier_invoice` |
| 9 | Compra de contado con vencimiento | `ck_purchase_due_date` |
| 10 | Compra recibida por el encargado | `fk_purchase_received_by_id` |
| 11 | Crédito autorizado por el encargado | `fk_credit_authorized_by_id` |
| 12 | Pago en dólares sin tipo de cambio | `ck_customer_payment_exchange` |
| 13 | Pago en córdobas con tipo de cambio | `ck_customer_payment_exchange` |
| 14 | Mismo pago aplicado dos veces al mismo documento | `pk_payment_application` |
| 15 | Línea de venta repetida | `uq_sale_detail_line` |
| 16 | Cantidad cero | `ck_sale_detail_quantity` |
| 17 | Línea de venta colgada de un servicio | `fk_sale_detail_sale_id` |
| 18 | Estado inexistente | `ck_status_change_status` |
| 19 | Decisión inválida de falla | `ck_additional_fault_decision` |
| 20 | Movimiento de VENTA sin línea de venta | `ck_inventory_movement_origin` |
| 21 | Movimiento con dos orígenes | `ck_inventory_movement_origin` |
| 22 | Movimiento COMPRA apuntando a una línea de venta | `ck_inventory_movement_origin` |
| 23 | Segundo movimiento para la misma línea de venta | `uq_inventory_movement_sale_detail_id` |
| 24 | Inventario inicial con origen | `ck_inventory_movement_origin` |
| 25 | Ajuste sin observación | `ck_inventory_movement_notes` |
| 26 | Devolución con cambio y reembolso a la vez | `ck_customer_return_outcome` |
| 27 | Reclamo REEMBOLSO sin monto | `ck_warranty_claim_refund` |
| 28 | Reclamo cubierto que crea nuevo servicio | `ck_warranty_claim_new_service` |
| 29 | Retiro OTRO sin descripción | `ck_cash_withdrawal_description` |
| 30 | Pago semanal pagado sin quién pagó | `ck_weekly_payout_paid_pair` |
| 31 | Pago semanal duplicado misma semana | `uq_weekly_payout_mechanic_week` |
| 32 | Adelanto al encargado | `fk_advance_mechanic_id` |
| 33 | Borrar un producto con historia | `fk_sale_detail_product_id` |
| 34 | Saldo de apertura de proveedor sin fecha | `ck_supplier_opening_pair` |
| 35 | Servicio liquidado sin porcentaje | `ck_mechanical_service_payout_rate` |
| 36 | Pago a proveedor en dólares sin tipo de cambio | `ck_supplier_payment_exchange` |
| 37 | Reclamo con venta pero sin decir quién paga la pieza | `ck_warranty_claim_sale` |

> **La trampa del nulo (intento 12, encontrada en la prueba).** La primera versión de `ck_customer_payment_exchange` decía `currency = 'USD' AND exchange_rate > 0`. Con `exchange_rate` nulo, `exchange_rate > 0` no da *falso* sino **desconocido**, y un `CHECK` **solo rechaza lo que da falso**: el pago en dólares sin tipo de cambio entraba. Se corrigió con `exchange_rate IS NOT NULL AND …`, y lo mismo en `supplier_payment` y `warranty_claim` (`coalesce`). **Regla para mantener el DDL:** en todo `CHECK` con una columna que puede ser nula, pregúntate qué pasa si es nula.

### 5.4 Diferencias con el esquema (llevar al esquema al cerrar S5)

- `service_type.active` (nueva) y `staff.phone` obligatoria.
- Unicidad sin distinguir mayúsculas (índices `lower()` / `upper()`) en catálogos, modelo de moto, cédula y placa.
- `status_change.changed_at` y `price_history.changed_at` sin redondear a segundos: son parte de una UQ, y dos cambios en el mismo segundo chocarían.
- Reglas extra: vencimiento de compra no anterior a la compra; interés mensual menor que 1; pago semanal no antes de la semana; un servicio solo se liquida si tiene porcentaje aplicado; un reclamo no puede crear como "nuevo servicio" el mismo servicio original; una devolución con cambio tiene como máximo un movimiento de cada motivo.

## 6. Para la clase del 29-oct

- **Datos de prueba en orden:** `product_category` y `product_brand` → `product` (con las tres gamas del kit de pistón XTZ 125: Yamaha, Vini, genérico) → `service_type` (engrase, cambio de aceite, trabajo de motor…) → personas → documentos.
- **Consultas para mostrar:** productos de un mismo repuesto con su marca, gama y precio; servicios estándar con su precio de referencia; y, cuando haya movimientos, la existencia por producto.
- **Probar delante del docente que la base resiste:** intentar uno o dos de los rechazos de §4. Muestra que las reglas del negocio están **en la base de datos**, no solo en la documentación.
