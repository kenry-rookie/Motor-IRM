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