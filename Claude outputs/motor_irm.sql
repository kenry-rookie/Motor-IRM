-- =====================================================================
--  MOTOR IRM — Base de datos completa (PostgreSQL 17)
--  Sistema de inventario, ventas y taller para un negocio de motocicletas
--
--  Contenido:
--    1. Extensiones: pg_trgm (búsqueda tolerante a errores) y unaccent.
--    2. 43 tablas con llaves primarias, foráneas (incluidas FK compuestas),
--       restricciones CHECK y UNIQUE.
--    3. 12 funciones y 11 triggers: stock por kardex, reglas del taller,
--       precio mínimo de venta, anulación de facturas, etc.
--    4. 12 vistas de saldos, comisiones, margen y búsqueda.
--    5. Catálogos iniciales: permisos, perfiles (Dueño, Encargado), métodos
--       de pago, motivos, categorías y el catálogo de trabajos del taller.
--
--  Generado el 10-nov-2026 con pg_dump a partir de las migraciones
--  prisma/migrations/0_init … 7_sale_invoice_void (fuente única del
--  esquema, DEC-040). NO incluye usuarios ni contraseñas: el primer
--  usuario dueño lo crea `npm run db:seed`.
--
--  Uso (base vacía):
--    createdb -U motor_irm motor_irm
--    psql -U motor_irm -d motor_irm -f motor_irm.sql
--  La base trabaja con la zona horaria America/Managua:
--    ALTER DATABASE motor_irm SET timezone TO 'America/Managua';
-- =====================================================================

--
-- PostgreSQL database dump
--


-- Dumped from database version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: unaccent; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;


--
-- Name: fn_inventory_movement_append_only(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_inventory_movement_append_only() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'inventory_movement es de solo inserción; corrige con un ajuste (AJUSTE_ENTRADA/AJUSTE_SALIDA)'
        USING ERRCODE = 'restrict_violation', CONSTRAINT = 'tg_inventory_movement_append_only';
END
$$;


--
-- Name: fn_inventory_movement_apply_stock(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_inventory_movement_apply_stock() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM set_config('motor_irm.stock_from_movement', 'on', true);
    UPDATE "product"
       SET "stock" = "stock" + CASE
             WHEN NEW."movement_type" IN ('COMPRA', 'DEVOLUCION_CLIENTE', 'INVENTARIO_INICIAL', 'AJUSTE_ENTRADA')
             THEN NEW."quantity" ELSE -NEW."quantity" END
     WHERE "id" = NEW."product_id";
    PERFORM set_config('motor_irm.stock_from_movement', 'off', true);
    RETURN NEW;
END
$$;


--
-- Name: fn_product_guard_stock(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_product_guard_stock() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW."stock" <> 0 THEN
        RAISE EXCEPTION 'Un producto nuevo empieza con stock 0; registra un movimiento INVENTARIO_INICIAL'
            USING ERRCODE = 'check_violation', CONSTRAINT = 'tg_product_guard_stock';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW."stock" IS DISTINCT FROM OLD."stock"
       AND coalesce(current_setting('motor_irm.stock_from_movement', true), 'off') <> 'on' THEN
        RAISE EXCEPTION 'product.stock solo cambia con movimientos de inventario'
            USING ERRCODE = 'check_violation', CONSTRAINT = 'tg_product_guard_stock';
    END IF;
    RETURN NEW;
END
$$;


--
-- Name: fn_sale_invoice_line_min_price(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_sale_invoice_line_min_price() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: fn_sale_invoice_not_voided(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_sale_invoice_not_voided() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW."sale_invoice_id" IS NOT NULL
       AND EXISTS (SELECT 1 FROM "sale_invoice_void" v WHERE v."sale_invoice_id" = NEW."sale_invoice_id") THEN
        RAISE EXCEPTION 'La factura % está anulada', NEW."sale_invoice_id"
            USING ERRCODE = 'check_violation', CONSTRAINT = 'tg_sale_invoice_voided';
    END IF;
    RETURN NEW;
END
$$;


--
-- Name: fn_sale_invoice_void_check(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_sale_invoice_void_check() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_created timestamptz;
    v_order   integer;
BEGIN
    IF TG_OP <> 'INSERT' THEN
        RAISE EXCEPTION 'Una anulación no se edita ni se borra'
            USING ERRCODE = 'check_violation', CONSTRAINT = 'tg_sale_invoice_void_append_only';
    END IF;

    SELECT si."created_at", si."service_order_id" INTO v_created, v_order
      FROM "sale_invoice" si WHERE si."id" = NEW."sale_invoice_id";

    IF v_created < now() - interval '3 days' THEN
        RAISE EXCEPTION 'La factura % tiene más de 3 días: ya no se puede anular', NEW."sale_invoice_id"
            USING ERRCODE = 'check_violation', CONSTRAINT = 'tg_sale_invoice_void_deadline';
    END IF;

    IF NOT EXISTS (SELECT 1
                     FROM "app_user" u
                     JOIN "staff" s ON s."id" = u."staff_id"
                    WHERE u."id" = NEW."voided_by_user_id" AND u."active" AND s."active" AND s."kind" = 'DUENO') THEN
        RAISE EXCEPTION 'Solo un dueño puede anular facturas'
            USING ERRCODE = 'check_violation', CONSTRAINT = 'tg_sale_invoice_void_owner';
    END IF;

    IF v_order IS NOT NULL AND EXISTS (SELECT 1 FROM "service_order"
                                        WHERE "id" = v_order AND "staff_payout_id" IS NOT NULL) THEN
        RAISE EXCEPTION 'La comisión de esta orden ya se pagó: no se puede anular la factura'
            USING ERRCODE = 'check_violation', CONSTRAINT = 'tg_sale_invoice_void_commission_paid';
    END IF;
    RETURN NEW;
END
$$;


--
-- Name: fn_service_order_check_responsible(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_service_order_check_responsible() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    r "staff"%ROWTYPE;
BEGIN
    IF NEW."mechanic_staff_id" IS NULL THEN
        RETURN NEW;
    END IF;
    SELECT * INTO r FROM "staff" WHERE "id" = NEW."mechanic_staff_id";
    IF TG_OP = 'INSERT' OR NEW."mechanic_staff_id" IS DISTINCT FROM OLD."mechanic_staff_id" THEN
        IF NOT r."active" OR NOT r."can_repair" THEN
            RAISE EXCEPTION 'El responsable % no está activo o no repara motos', r."name"
                USING ERRCODE = 'check_violation', CONSTRAINT = 'tg_service_order_responsible_can_repair';
        END IF;
    END IF;
    IF r."kind" = 'DUENO' AND NEW."applied_commission_rate" IS NOT NULL THEN
        RAISE EXCEPTION 'Un dueño no cobra comisión'
            USING ERRCODE = 'check_violation', CONSTRAINT = 'tg_service_order_owner_no_commission';
    END IF;
    RETURN NEW;
END
$$;


--
-- Name: fn_service_order_has_items(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_service_order_has_items() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_order integer;
BEGIN
    IF TG_TABLE_NAME = 'service_order' THEN
        v_order := NEW."id";
    ELSE
        v_order := OLD."service_order_id";
    END IF;
    IF EXISTS (SELECT 1 FROM "service_order" WHERE "id" = v_order)
       AND NOT EXISTS (SELECT 1 FROM "service_order_item" WHERE "service_order_id" = v_order) THEN
        RAISE EXCEPTION 'La orden % necesita al menos un trabajo del catálogo', v_order
            USING ERRCODE = 'check_violation', CONSTRAINT = 'tg_service_order_has_items';
    END IF;
    RETURN NULL;
END
$$;


--
-- Name: fn_service_order_status_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_service_order_status_guard() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: mirm_norm(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mirm_norm(text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $_$ SELECT lower(public.unaccent('public.unaccent'::regdictionary, $1)) $_$;


--
-- Name: mirm_phone_format(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mirm_phone_format(text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $_$
    WITH d AS (SELECT regexp_replace($1, '[^0-9]', '', 'g') AS n, btrim($1) LIKE '+%' AS intl)
    SELECT CASE
             WHEN length(n) = 8 AND NOT intl              THEN substr(n, 1, 4) || '-' || substr(n, 5, 4)
             WHEN length(n) = 11 AND n LIKE '505%'        THEN substr(n, 4, 4) || '-' || substr(n, 8, 4)
             WHEN length(n) = 11 AND n ~ '^50[2-7]'       THEN '+' || substr(n, 1, 3) || ' ' || substr(n, 4, 4) || '-' || substr(n, 8, 4)
             WHEN length(n) = 11 AND n LIKE '1%'          THEN '+1 ' || substr(n, 2, 3) || '-' || substr(n, 5, 3) || '-' || substr(n, 8, 4)
             WHEN intl AND length(n) BETWEEN 7 AND 15     THEN '+' || n
             ELSE $1 END
      FROM d
$_$;


--
-- Name: mirm_phone_valid(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mirm_phone_valid(text) RETURNS boolean
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $_$
    SELECT $1 ~ '^[0-9]{4}-[0-9]{4}$'
        OR $1 ~ '^\+1 [0-9]{3}-[0-9]{3}-[0-9]{4}$'
        OR $1 ~ '^\+50[2-7] [0-9]{4}-[0-9]{4}$'
        OR $1 ~ '^\+[0-9]{7,15}$'
$_$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: additional_fault; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.additional_fault (
    id integer NOT NULL,
    service_order_id integer NOT NULL,
    fault_no smallint NOT NULL,
    reported_on date DEFAULT CURRENT_DATE NOT NULL,
    description character varying(500) NOT NULL,
    proposed_price numeric(12,2),
    decision character varying(20) DEFAULT 'PENDIENTE'::character varying NOT NULL,
    CONSTRAINT ck_additional_fault_decision CHECK (((decision)::text = ANY ((ARRAY['PENDIENTE'::character varying, 'ACEPTADA'::character varying, 'RECHAZADA'::character varying])::text[]))),
    CONSTRAINT ck_additional_fault_description CHECK ((btrim((description)::text) <> ''::text)),
    CONSTRAINT ck_additional_fault_fault_no CHECK ((fault_no > 0)),
    CONSTRAINT ck_additional_fault_proposed_price CHECK ((proposed_price >= (0)::numeric))
);


--
-- Name: additional_fault_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.additional_fault_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: additional_fault_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.additional_fault_id_seq OWNED BY public.additional_fault.id;


--
-- Name: app_session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_session (
    id integer NOT NULL,
    app_user_id integer NOT NULL,
    token_hash character(64) NOT NULL,
    created_at timestamp(0) with time zone DEFAULT CURRENT_TIMESTAMP(0) NOT NULL,
    expires_at timestamp(0) with time zone NOT NULL,
    CONSTRAINT ck_app_session_expires_at CHECK ((expires_at > created_at))
);


--
-- Name: app_session_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.app_session_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: app_session_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.app_session_id_seq OWNED BY public.app_session.id;


--
-- Name: app_user; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_user (
    id integer NOT NULL,
    role_id integer NOT NULL,
    staff_id integer,
    username character varying(30) NOT NULL,
    password_hash character varying(255) NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp(0) with time zone DEFAULT CURRENT_TIMESTAMP(0) NOT NULL,
    last_login_at timestamp(0) with time zone,
    CONSTRAINT ck_app_user_username CHECK ((btrim((username)::text) <> ''::text))
);


--
-- Name: app_user_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.app_user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: app_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.app_user_id_seq OWNED BY public.app_user.id;


--
-- Name: cash_withdrawal; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cash_withdrawal (
    id integer NOT NULL,
    withdrawn_by_user_id integer NOT NULL,
    cash_withdrawal_reason_id integer NOT NULL,
    withdrawn_on date DEFAULT CURRENT_DATE NOT NULL,
    amount numeric(12,2) NOT NULL,
    description character varying(200),
    CONSTRAINT ck_cash_withdrawal_amount CHECK ((amount > (0)::numeric)),
    CONSTRAINT ck_cash_withdrawal_description CHECK (((description IS NULL) OR (btrim((description)::text) <> ''::text)))
);


--
-- Name: cash_withdrawal_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cash_withdrawal_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cash_withdrawal_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cash_withdrawal_id_seq OWNED BY public.cash_withdrawal.id;


--
-- Name: cash_withdrawal_reason; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cash_withdrawal_reason (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    active boolean DEFAULT true NOT NULL,
    CONSTRAINT ck_cash_withdrawal_reason_name CHECK ((btrim((name)::text) <> ''::text))
);


--
-- Name: cash_withdrawal_reason_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cash_withdrawal_reason_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cash_withdrawal_reason_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cash_withdrawal_reason_id_seq OWNED BY public.cash_withdrawal_reason.id;


--
-- Name: customer; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    phone character varying(20) NOT NULL,
    national_id character varying(20),
    address character varying(200),
    CONSTRAINT ck_customer_address CHECK (((address IS NULL) OR (btrim((address)::text) <> ''::text))),
    CONSTRAINT ck_customer_name CHECK ((btrim((name)::text) <> ''::text)),
    CONSTRAINT ck_customer_national_id CHECK (((national_id IS NULL) OR (btrim((national_id)::text) <> ''::text))),
    CONSTRAINT ck_customer_phone CHECK ((btrim((phone)::text) <> ''::text)),
    CONSTRAINT ck_customer_phone_format CHECK (public.mirm_phone_valid((phone)::text))
);


--
-- Name: customer_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customer_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customer_id_seq OWNED BY public.customer.id;


--
-- Name: customer_opening_balance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_opening_balance (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    as_of_date date NOT NULL,
    amount numeric(12,2) NOT NULL,
    due_date date NOT NULL,
    monthly_interest numeric(5,4) DEFAULT 0 NOT NULL,
    registered_by_user_id integer NOT NULL,
    notes character varying(200),
    CONSTRAINT ck_customer_opening_balance_amount CHECK ((amount > (0)::numeric)),
    CONSTRAINT ck_customer_opening_balance_monthly_interest CHECK (((monthly_interest >= (0)::numeric) AND (monthly_interest < (1)::numeric))),
    CONSTRAINT ck_customer_opening_balance_notes CHECK (((notes IS NULL) OR (btrim((notes)::text) <> ''::text)))
);


--
-- Name: customer_opening_balance_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_opening_balance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customer_opening_balance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customer_opening_balance_id_seq OWNED BY public.customer_opening_balance.id;


--
-- Name: customer_payment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_payment (
    id integer NOT NULL,
    paid_at timestamp(0) with time zone DEFAULT CURRENT_TIMESTAMP(0) NOT NULL,
    amount numeric(12,2) NOT NULL,
    currency character varying(3) DEFAULT 'NIO'::character varying NOT NULL,
    exchange_rate numeric(10,4),
    payment_method_id integer NOT NULL,
    received_by_user_id integer NOT NULL,
    CONSTRAINT ck_customer_payment_amount CHECK ((amount > (0)::numeric)),
    CONSTRAINT ck_customer_payment_currency CHECK (((currency)::text = ANY ((ARRAY['NIO'::character varying, 'USD'::character varying])::text[]))),
    CONSTRAINT ck_customer_payment_exchange CHECK (((((currency)::text = 'NIO'::text) AND (exchange_rate IS NULL)) OR (((currency)::text = 'USD'::text) AND (exchange_rate IS NOT NULL) AND (exchange_rate > (0)::numeric))))
);


--
-- Name: customer_payment_allocation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_payment_allocation (
    id integer NOT NULL,
    customer_payment_id integer NOT NULL,
    sale_invoice_id integer,
    customer_opening_balance_id integer,
    amount numeric(12,2) NOT NULL,
    CONSTRAINT ck_customer_payment_allocation_amount CHECK ((amount > (0)::numeric)),
    CONSTRAINT ck_customer_payment_allocation_target CHECK ((num_nonnulls(sale_invoice_id, customer_opening_balance_id) = 1))
);


--
-- Name: customer_payment_allocation_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_payment_allocation_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customer_payment_allocation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customer_payment_allocation_id_seq OWNED BY public.customer_payment_allocation.id;


--
-- Name: customer_payment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_payment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customer_payment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customer_payment_id_seq OWNED BY public.customer_payment.id;


--
-- Name: customer_return; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_return (
    id integer NOT NULL,
    sale_invoice_id integer NOT NULL,
    returned_at timestamp(0) with time zone DEFAULT CURRENT_TIMESTAMP(0) NOT NULL,
    credit_note_number character varying(20),
    return_reason_id integer NOT NULL,
    registered_by_user_id integer NOT NULL,
    notes character varying(200),
    CONSTRAINT ck_customer_return_credit_note_number CHECK (((credit_note_number IS NULL) OR (btrim((credit_note_number)::text) <> ''::text))),
    CONSTRAINT ck_customer_return_notes CHECK (((notes IS NULL) OR (btrim((notes)::text) <> ''::text)))
);


--
-- Name: customer_return_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_return_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customer_return_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customer_return_id_seq OWNED BY public.customer_return.id;


--
-- Name: customer_return_line; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_return_line (
    id integer NOT NULL,
    customer_return_id integer NOT NULL,
    sale_invoice_id integer NOT NULL,
    line_no smallint NOT NULL,
    sale_invoice_line_id integer NOT NULL,
    product_id integer NOT NULL,
    quantity integer NOT NULL,
    CONSTRAINT ck_customer_return_line_line_no CHECK ((line_no > 0)),
    CONSTRAINT ck_customer_return_line_quantity CHECK ((quantity > 0))
);


--
-- Name: customer_return_line_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customer_return_line_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customer_return_line_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customer_return_line_id_seq OWNED BY public.customer_return_line.id;


--
-- Name: discount; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.discount (
    id integer NOT NULL,
    name character varying(80) NOT NULL,
    discount_type character varying(20) NOT NULL,
    value numeric(12,4) NOT NULL,
    active boolean DEFAULT true NOT NULL,
    CONSTRAINT ck_discount_discount_type CHECK (((discount_type)::text = ANY ((ARRAY['PORCENTAJE'::character varying, 'MONTO'::character varying])::text[]))),
    CONSTRAINT ck_discount_name CHECK ((btrim((name)::text) <> ''::text)),
    CONSTRAINT ck_discount_value CHECK (((value > (0)::numeric) AND (((discount_type)::text = 'MONTO'::text) OR (value <= (1)::numeric))))
);


--
-- Name: discount_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.discount_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: discount_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.discount_id_seq OWNED BY public.discount.id;


--
-- Name: inventory_movement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_movement (
    id integer NOT NULL,
    product_id integer NOT NULL,
    moved_at timestamp(0) with time zone DEFAULT CURRENT_TIMESTAMP(0) NOT NULL,
    movement_type character varying(25) NOT NULL,
    quantity integer NOT NULL,
    unit_cost numeric(12,2) NOT NULL,
    notes character varying(200),
    registered_by_user_id integer NOT NULL,
    sale_invoice_line_id integer,
    customer_return_line_id integer,
    purchase_invoice_line_id integer,
    supplier_return_line_id integer,
    warranty_claim_id integer,
    CONSTRAINT ck_inventory_movement_movement_type CHECK (((movement_type)::text = ANY ((ARRAY['COMPRA'::character varying, 'DEVOLUCION_CLIENTE'::character varying, 'INVENTARIO_INICIAL'::character varying, 'AJUSTE_ENTRADA'::character varying, 'VENTA'::character varying, 'USO_SERVICIO'::character varying, 'DEVOLUCION_PROVEEDOR'::character varying, 'GARANTIA'::character varying, 'AJUSTE_SALIDA'::character varying])::text[]))),
    CONSTRAINT ck_inventory_movement_notes CHECK ((((movement_type)::text <> ALL ((ARRAY['AJUSTE_ENTRADA'::character varying, 'AJUSTE_SALIDA'::character varying])::text[])) OR (btrim((COALESCE(notes, ''::character varying))::text) <> ''::text))),
    CONSTRAINT ck_inventory_movement_origin CHECK (((num_nonnulls(sale_invoice_line_id, customer_return_line_id, purchase_invoice_line_id, supplier_return_line_id, warranty_claim_id) =
CASE
    WHEN ((movement_type)::text = ANY ((ARRAY['INVENTARIO_INICIAL'::character varying, 'AJUSTE_ENTRADA'::character varying, 'AJUSTE_SALIDA'::character varying])::text[])) THEN 0
    ELSE 1
END) AND ((sale_invoice_line_id IS NULL) OR ((movement_type)::text = ANY ((ARRAY['VENTA'::character varying, 'USO_SERVICIO'::character varying])::text[]))) AND ((customer_return_line_id IS NULL) OR ((movement_type)::text = 'DEVOLUCION_CLIENTE'::text)) AND ((purchase_invoice_line_id IS NULL) OR ((movement_type)::text = 'COMPRA'::text)) AND ((supplier_return_line_id IS NULL) OR ((movement_type)::text = 'DEVOLUCION_PROVEEDOR'::text)) AND ((warranty_claim_id IS NULL) OR ((movement_type)::text = 'GARANTIA'::text)))),
    CONSTRAINT ck_inventory_movement_quantity CHECK ((quantity > 0)),
    CONSTRAINT ck_inventory_movement_unit_cost CHECK ((unit_cost >= (0)::numeric))
);


--
-- Name: inventory_movement_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_movement_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_movement_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_movement_id_seq OWNED BY public.inventory_movement.id;


--
-- Name: motorcycle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.motorcycle (
    id integer NOT NULL,
    customer_id integer NOT NULL,
    motorcycle_model_id integer NOT NULL,
    color character varying(30) NOT NULL,
    plate character varying(15),
    notes character varying(200),
    chassis_number character varying(30),
    CONSTRAINT ck_motorcycle_chassis_number CHECK (((chassis_number IS NULL) OR ((chassis_number)::text ~ '^[A-Z0-9-]{5,30}$'::text))),
    CONSTRAINT ck_motorcycle_color CHECK ((btrim((color)::text) <> ''::text)),
    CONSTRAINT ck_motorcycle_plate CHECK (((plate IS NULL) OR (btrim((plate)::text) <> ''::text)))
);


--
-- Name: motorcycle_brand; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.motorcycle_brand (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    CONSTRAINT ck_motorcycle_brand_name CHECK ((btrim((name)::text) <> ''::text))
);


--
-- Name: motorcycle_brand_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.motorcycle_brand_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: motorcycle_brand_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.motorcycle_brand_id_seq OWNED BY public.motorcycle_brand.id;


--
-- Name: motorcycle_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.motorcycle_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: motorcycle_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.motorcycle_id_seq OWNED BY public.motorcycle.id;


--
-- Name: motorcycle_model; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.motorcycle_model (
    id integer NOT NULL,
    motorcycle_brand_id integer NOT NULL,
    name character varying(50) NOT NULL,
    CONSTRAINT ck_motorcycle_model_name CHECK ((btrim((name)::text) <> ''::text))
);


--
-- Name: motorcycle_model_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.motorcycle_model_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: motorcycle_model_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.motorcycle_model_id_seq OWNED BY public.motorcycle_model.id;


--
-- Name: payment_method; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_method (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    active boolean DEFAULT true NOT NULL,
    CONSTRAINT ck_payment_method_name CHECK ((btrim((name)::text) <> ''::text))
);


--
-- Name: payment_method_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payment_method_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payment_method_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payment_method_id_seq OWNED BY public.payment_method.id;


--
-- Name: permission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permission (
    id integer NOT NULL,
    code character varying(60) NOT NULL,
    description character varying(200),
    CONSTRAINT ck_permission_code CHECK (((code)::text ~ '^[a-z_]+(\.[a-z_]+)*$'::text))
);


--
-- Name: permission_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.permission_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: permission_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.permission_id_seq OWNED BY public.permission.id;


--
-- Name: product; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product (
    id integer NOT NULL,
    product_category_id integer NOT NULL,
    product_brand_id integer NOT NULL,
    name character varying(150) NOT NULL,
    barcode character varying(50),
    quality_tier character varying(20) NOT NULL,
    list_price numeric(12,2) NOT NULL,
    stock integer DEFAULT 0 NOT NULL,
    CONSTRAINT ck_product_barcode CHECK (((barcode IS NULL) OR (btrim((barcode)::text) <> ''::text))),
    CONSTRAINT ck_product_list_price CHECK ((list_price >= (0)::numeric)),
    CONSTRAINT ck_product_name CHECK ((btrim((name)::text) <> ''::text)),
    CONSTRAINT ck_product_quality_tier CHECK (((quality_tier)::text = ANY ((ARRAY['ALTA'::character varying, 'MEDIA'::character varying, 'BAJA'::character varying])::text[]))),
    CONSTRAINT ck_product_stock CHECK ((stock >= 0))
);


--
-- Name: product_brand; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_brand (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    CONSTRAINT ck_product_brand_name CHECK ((btrim((name)::text) <> ''::text))
);


--
-- Name: product_brand_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_brand_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_brand_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_brand_id_seq OWNED BY public.product_brand.id;


--
-- Name: product_category; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_category (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    CONSTRAINT ck_product_category_name CHECK ((btrim((name)::text) <> ''::text))
);


--
-- Name: product_category_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_category_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_category_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_category_id_seq OWNED BY public.product_category.id;


--
-- Name: product_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_id_seq OWNED BY public.product.id;


--
-- Name: product_price_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_price_history (
    id integer NOT NULL,
    product_id integer NOT NULL,
    changed_at timestamp(6) with time zone DEFAULT clock_timestamp() NOT NULL,
    new_price numeric(12,2) NOT NULL,
    changed_by_user_id integer,
    CONSTRAINT ck_product_price_history_new_price CHECK ((new_price >= (0)::numeric))
);


--
-- Name: product_price_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_price_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_price_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_price_history_id_seq OWNED BY public.product_price_history.id;


--
-- Name: purchase_invoice; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_invoice (
    id integer NOT NULL,
    supplier_id integer NOT NULL,
    invoice_number character varying(30) NOT NULL,
    purchase_date date DEFAULT CURRENT_DATE NOT NULL,
    payment_terms character varying(20) NOT NULL,
    due_date date,
    discount_amount numeric(12,2) DEFAULT 0 NOT NULL,
    received_by_user_id integer NOT NULL,
    CONSTRAINT ck_purchase_invoice_discount_amount CHECK ((discount_amount >= (0)::numeric)),
    CONSTRAINT ck_purchase_invoice_due_date CHECK (((((payment_terms)::text = 'CREDITO'::text) = (due_date IS NOT NULL)) AND ((due_date IS NULL) OR (due_date >= purchase_date)))),
    CONSTRAINT ck_purchase_invoice_invoice_number CHECK ((btrim((invoice_number)::text) <> ''::text)),
    CONSTRAINT ck_purchase_invoice_payment_terms CHECK (((payment_terms)::text = ANY ((ARRAY['CONTADO'::character varying, 'CREDITO'::character varying])::text[])))
);


--
-- Name: purchase_invoice_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchase_invoice_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchase_invoice_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchase_invoice_id_seq OWNED BY public.purchase_invoice.id;


--
-- Name: purchase_invoice_line; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_invoice_line (
    id integer NOT NULL,
    purchase_invoice_id integer NOT NULL,
    line_no smallint NOT NULL,
    product_id integer NOT NULL,
    quantity integer NOT NULL,
    unit_cost numeric(12,2) NOT NULL,
    CONSTRAINT ck_purchase_invoice_line_line_no CHECK ((line_no > 0)),
    CONSTRAINT ck_purchase_invoice_line_quantity CHECK ((quantity > 0)),
    CONSTRAINT ck_purchase_invoice_line_unit_cost CHECK ((unit_cost >= (0)::numeric))
);


--
-- Name: purchase_invoice_line_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.purchase_invoice_line_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: purchase_invoice_line_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.purchase_invoice_line_id_seq OWNED BY public.purchase_invoice_line.id;


--
-- Name: return_reason; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.return_reason (
    id integer NOT NULL,
    name character varying(80) NOT NULL,
    active boolean DEFAULT true NOT NULL,
    CONSTRAINT ck_return_reason_name CHECK ((btrim((name)::text) <> ''::text))
);


--
-- Name: return_reason_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.return_reason_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: return_reason_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.return_reason_id_seq OWNED BY public.return_reason.id;


--
-- Name: role; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    description character varying(200),
    active boolean DEFAULT true NOT NULL,
    CONSTRAINT ck_role_name CHECK ((btrim((name)::text) <> ''::text))
);


--
-- Name: role_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.role_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: role_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.role_id_seq OWNED BY public.role.id;


--
-- Name: role_permission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permission (
    role_id integer NOT NULL,
    permission_id integer NOT NULL
);


--
-- Name: sale_invoice; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sale_invoice (
    id integer NOT NULL,
    customer_id integer,
    created_by_user_id integer NOT NULL,
    created_at timestamp(0) with time zone DEFAULT CURRENT_TIMESTAMP(0) NOT NULL,
    invoice_number character varying(20),
    payment_terms character varying(20) NOT NULL,
    due_date date,
    extended_due_date date,
    monthly_interest numeric(5,4) DEFAULT 0 NOT NULL,
    credit_authorized_by_user_id integer,
    notes character varying(200),
    service_order_id integer,
    CONSTRAINT ck_sale_invoice_credit CHECK (((((payment_terms)::text = 'CREDITO'::text) = (due_date IS NOT NULL)) AND (((payment_terms)::text = 'CREDITO'::text) = (credit_authorized_by_user_id IS NOT NULL)) AND (((payment_terms)::text = 'CREDITO'::text) OR ((extended_due_date IS NULL) AND (monthly_interest = (0)::numeric))))),
    CONSTRAINT ck_sale_invoice_customer CHECK (((customer_id IS NOT NULL) OR ((payment_terms)::text = 'CONTADO'::text))),
    CONSTRAINT ck_sale_invoice_due_date CHECK ((due_date >= ((created_at AT TIME ZONE 'America/Managua'::text))::date)),
    CONSTRAINT ck_sale_invoice_extended_due CHECK ((extended_due_date > due_date)),
    CONSTRAINT ck_sale_invoice_invoice_number CHECK (((invoice_number IS NULL) OR (btrim((invoice_number)::text) <> ''::text))),
    CONSTRAINT ck_sale_invoice_monthly_interest CHECK (((monthly_interest >= (0)::numeric) AND (monthly_interest < (1)::numeric))),
    CONSTRAINT ck_sale_invoice_notes CHECK (((notes IS NULL) OR (btrim((notes)::text) <> ''::text))),
    CONSTRAINT ck_sale_invoice_payment_terms CHECK (((payment_terms)::text = ANY ((ARRAY['CONTADO'::character varying, 'CREDITO'::character varying])::text[])))
);


--
-- Name: sale_invoice_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sale_invoice_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sale_invoice_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sale_invoice_id_seq OWNED BY public.sale_invoice.id;


--
-- Name: sale_invoice_line; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sale_invoice_line (
    id integer NOT NULL,
    sale_invoice_id integer NOT NULL,
    line_no smallint NOT NULL,
    line_type character varying(20) NOT NULL,
    product_id integer,
    service_type_id integer,
    description character varying(200),
    quantity integer DEFAULT 1 NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    discount_id integer,
    discount_amount numeric(12,2) DEFAULT 0 NOT NULL,
    discount_authorized_by_user_id integer,
    additional_fault_id integer,
    service_order_id integer,
    CONSTRAINT ck_sale_invoice_line_additional_fault CHECK (((additional_fault_id IS NULL) OR (service_order_id IS NOT NULL))),
    CONSTRAINT ck_sale_invoice_line_by_type CHECK (((((line_type)::text = 'PRODUCTO'::text) AND (product_id IS NOT NULL) AND (service_type_id IS NULL)) OR (((line_type)::text = 'MANO_OBRA'::text) AND (product_id IS NULL) AND (description IS NOT NULL)) OR (((line_type)::text = 'CARGO_EXTERNO'::text) AND (product_id IS NULL) AND (service_type_id IS NULL) AND (description IS NOT NULL) AND (quantity = 1)))),
    CONSTRAINT ck_sale_invoice_line_description CHECK (((description IS NULL) OR (btrim((description)::text) <> ''::text))),
    CONSTRAINT ck_sale_invoice_line_discount CHECK (((discount_amount >= (0)::numeric) AND (discount_amount <= ((quantity)::numeric * unit_price)) AND ((discount_id IS NULL) OR (discount_amount > (0)::numeric)) AND ((discount_amount = (0)::numeric) OR (discount_id IS NOT NULL) OR (discount_authorized_by_user_id IS NOT NULL)))),
    CONSTRAINT ck_sale_invoice_line_line_no CHECK ((line_no > 0)),
    CONSTRAINT ck_sale_invoice_line_line_type CHECK (((line_type)::text = ANY ((ARRAY['PRODUCTO'::character varying, 'MANO_OBRA'::character varying, 'CARGO_EXTERNO'::character varying])::text[]))),
    CONSTRAINT ck_sale_invoice_line_quantity CHECK ((quantity > 0)),
    CONSTRAINT ck_sale_invoice_line_unit_price CHECK ((unit_price >= (0)::numeric))
);


--
-- Name: sale_invoice_line_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sale_invoice_line_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sale_invoice_line_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sale_invoice_line_id_seq OWNED BY public.sale_invoice_line.id;


--
-- Name: sale_invoice_void; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sale_invoice_void (
    sale_invoice_id integer NOT NULL,
    voided_at timestamp(0) with time zone DEFAULT CURRENT_TIMESTAMP(0) NOT NULL,
    voided_by_user_id integer NOT NULL,
    reason character varying(200) NOT NULL,
    refund_amount numeric(12,2) DEFAULT 0 NOT NULL,
    customer_return_id integer,
    CONSTRAINT ck_sale_invoice_void_reason CHECK ((length(btrim((reason)::text)) >= 5)),
    CONSTRAINT ck_sale_invoice_void_refund CHECK ((refund_amount >= (0)::numeric))
);


--
-- Name: service_category; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_category (
    id integer NOT NULL,
    name character varying(40) NOT NULL,
    sort_order smallint DEFAULT 100 NOT NULL,
    CONSTRAINT ck_service_category_name CHECK ((btrim((name)::text) <> ''::text))
);


--
-- Name: service_category_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.service_category_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: service_category_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.service_category_id_seq OWNED BY public.service_category.id;


--
-- Name: service_order; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_order (
    id integer NOT NULL,
    motorcycle_id integer NOT NULL,
    mechanic_staff_id integer,
    requested_work character varying(500),
    diagnosis character varying(500),
    cancellation_fee numeric(12,2),
    applied_commission_rate numeric(5,4),
    staff_payout_id integer,
    odometer_km integer,
    CONSTRAINT ck_service_order_applied_commission_rate CHECK (((applied_commission_rate > (0)::numeric) AND (applied_commission_rate <= (1)::numeric))),
    CONSTRAINT ck_service_order_cancellation_fee CHECK ((cancellation_fee >= (0)::numeric)),
    CONSTRAINT ck_service_order_odometer_km CHECK (((odometer_km IS NULL) OR (odometer_km >= 0))),
    CONSTRAINT ck_service_order_payout_rate CHECK (((staff_payout_id IS NULL) OR ((applied_commission_rate IS NOT NULL) AND (mechanic_staff_id IS NOT NULL)))),
    CONSTRAINT ck_service_order_rate_needs_responsible CHECK (((applied_commission_rate IS NULL) OR (mechanic_staff_id IS NOT NULL))),
    CONSTRAINT ck_service_order_requested_work CHECK (((requested_work IS NULL) OR (btrim((requested_work)::text) <> ''::text)))
);


--
-- Name: service_order_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.service_order_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: service_order_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.service_order_id_seq OWNED BY public.service_order.id;


--
-- Name: service_order_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_order_item (
    id integer NOT NULL,
    service_order_id integer NOT NULL,
    service_type_id integer NOT NULL,
    notes character varying(200),
    CONSTRAINT ck_service_order_item_notes CHECK (((notes IS NULL) OR (btrim((notes)::text) <> ''::text)))
);


--
-- Name: service_order_item_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.service_order_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: service_order_item_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.service_order_item_id_seq OWNED BY public.service_order_item.id;


--
-- Name: service_order_status_change; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_order_status_change (
    id integer NOT NULL,
    service_order_id integer NOT NULL,
    changed_at timestamp(6) with time zone DEFAULT clock_timestamp() NOT NULL,
    status character varying(20) NOT NULL,
    notes character varying(200),
    registered_by_user_id integer NOT NULL,
    CONSTRAINT ck_service_order_status_change_status CHECK (((status)::text = ANY ((ARRAY['RECIBIDA'::character varying, 'EN_DIAGNOSTICO'::character varying, 'EN_PROCESO'::character varying, 'ESPERA_REPUESTO'::character varying, 'ESPERA_CLIENTE'::character varying, 'TERMINADA'::character varying, 'EN_PRUEBA'::character varying, 'ENTREGADA'::character varying, 'CANCELADA'::character varying])::text[])))
);


--
-- Name: service_order_status_change_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.service_order_status_change_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: service_order_status_change_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.service_order_status_change_id_seq OWNED BY public.service_order_status_change.id;


--
-- Name: service_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_type (
    id integer NOT NULL,
    name character varying(50) NOT NULL,
    reference_price numeric(12,2),
    active boolean DEFAULT true NOT NULL,
    service_category_id integer NOT NULL,
    min_price numeric(12,2),
    max_price numeric(12,2),
    CONSTRAINT ck_service_type_name CHECK ((btrim((name)::text) <> ''::text)),
    CONSTRAINT ck_service_type_price_range CHECK ((((min_price IS NULL) OR (min_price >= (0)::numeric)) AND ((max_price IS NULL) OR (max_price >= COALESCE(min_price, (0)::numeric))) AND ((reference_price IS NULL) OR ((reference_price >= COALESCE(min_price, reference_price)) AND (reference_price <= COALESCE(max_price, reference_price)))))),
    CONSTRAINT ck_service_type_reference_price CHECK ((reference_price >= (0)::numeric))
);


--
-- Name: service_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.service_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: service_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.service_type_id_seq OWNED BY public.service_type.id;


--
-- Name: staff; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    phone character varying(20) NOT NULL,
    commission_rate numeric(5,4),
    active boolean DEFAULT true NOT NULL,
    kind character varying(20) DEFAULT 'MECANICO'::character varying NOT NULL,
    can_repair boolean DEFAULT true NOT NULL,
    CONSTRAINT ck_staff_commission_rate CHECK (((commission_rate > (0)::numeric) AND (commission_rate <= (1)::numeric))),
    CONSTRAINT ck_staff_kind CHECK (((kind)::text = ANY ((ARRAY['DUENO'::character varying, 'MECANICO'::character varying, 'ENCARGADO'::character varying])::text[]))),
    CONSTRAINT ck_staff_name CHECK ((btrim((name)::text) <> ''::text)),
    CONSTRAINT ck_staff_owner_no_commission CHECK ((((kind)::text <> 'DUENO'::text) OR (commission_rate IS NULL))),
    CONSTRAINT ck_staff_phone CHECK ((btrim((phone)::text) <> ''::text)),
    CONSTRAINT ck_staff_phone_format CHECK (public.mirm_phone_valid((phone)::text))
);


--
-- Name: staff_advance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_advance (
    id integer NOT NULL,
    staff_id integer NOT NULL,
    given_on date DEFAULT CURRENT_DATE NOT NULL,
    amount numeric(12,2) NOT NULL,
    given_by_user_id integer NOT NULL,
    staff_payout_id integer,
    CONSTRAINT ck_staff_advance_amount CHECK ((amount > (0)::numeric))
);


--
-- Name: staff_advance_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.staff_advance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: staff_advance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.staff_advance_id_seq OWNED BY public.staff_advance.id;


--
-- Name: staff_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.staff_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: staff_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.staff_id_seq OWNED BY public.staff.id;


--
-- Name: staff_payout; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_payout (
    id integer NOT NULL,
    staff_id integer NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    paid_on date,
    paid_by_user_id integer,
    CONSTRAINT ck_staff_payout_paid_on CHECK (((paid_on IS NULL) OR (paid_on >= period_start))),
    CONSTRAINT ck_staff_payout_paid_pair CHECK (((paid_on IS NULL) = (paid_by_user_id IS NULL))),
    CONSTRAINT ck_staff_payout_period CHECK ((period_end >= period_start))
);


--
-- Name: staff_payout_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.staff_payout_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: staff_payout_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.staff_payout_id_seq OWNED BY public.staff_payout.id;


--
-- Name: supplier; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    phone character varying(20),
    contact_person character varying(100),
    gives_warranty boolean,
    opening_balance numeric(12,2),
    opening_date date,
    CONSTRAINT ck_supplier_name CHECK ((btrim((name)::text) <> ''::text)),
    CONSTRAINT ck_supplier_opening_balance CHECK ((opening_balance >= (0)::numeric)),
    CONSTRAINT ck_supplier_opening_pair CHECK (((opening_balance IS NULL) = (opening_date IS NULL))),
    CONSTRAINT ck_supplier_phone_format CHECK (((phone IS NULL) OR public.mirm_phone_valid((phone)::text)))
);


--
-- Name: supplier_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.supplier_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: supplier_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.supplier_id_seq OWNED BY public.supplier.id;


--
-- Name: supplier_payment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier_payment (
    id integer NOT NULL,
    supplier_id integer NOT NULL,
    purchase_invoice_id integer,
    paid_on date DEFAULT CURRENT_DATE NOT NULL,
    amount numeric(12,2) NOT NULL,
    currency character varying(3) DEFAULT 'NIO'::character varying NOT NULL,
    exchange_rate numeric(10,4),
    CONSTRAINT ck_supplier_payment_amount CHECK ((amount > (0)::numeric)),
    CONSTRAINT ck_supplier_payment_currency CHECK (((currency)::text = ANY ((ARRAY['NIO'::character varying, 'USD'::character varying])::text[]))),
    CONSTRAINT ck_supplier_payment_exchange CHECK (((((currency)::text = 'NIO'::text) AND (exchange_rate IS NULL)) OR (((currency)::text = 'USD'::text) AND (exchange_rate IS NOT NULL) AND (exchange_rate > (0)::numeric))))
);


--
-- Name: supplier_payment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.supplier_payment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: supplier_payment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.supplier_payment_id_seq OWNED BY public.supplier_payment.id;


--
-- Name: supplier_return; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier_return (
    id integer NOT NULL,
    purchase_invoice_id integer NOT NULL,
    returned_on date DEFAULT CURRENT_DATE NOT NULL,
    return_reason_id integer NOT NULL,
    resolution character varying(20) NOT NULL,
    registered_by_user_id integer NOT NULL,
    CONSTRAINT ck_supplier_return_resolution CHECK (((resolution)::text = ANY ((ARRAY['REPOSICION'::character varying, 'DINERO'::character varying, 'DESCUENTO'::character varying])::text[])))
);


--
-- Name: supplier_return_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.supplier_return_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: supplier_return_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.supplier_return_id_seq OWNED BY public.supplier_return.id;


--
-- Name: supplier_return_line; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supplier_return_line (
    id integer NOT NULL,
    supplier_return_id integer NOT NULL,
    purchase_invoice_id integer NOT NULL,
    line_no smallint NOT NULL,
    purchase_invoice_line_id integer NOT NULL,
    product_id integer NOT NULL,
    quantity integer NOT NULL,
    CONSTRAINT ck_supplier_return_line_line_no CHECK ((line_no > 0)),
    CONSTRAINT ck_supplier_return_line_quantity CHECK ((quantity > 0))
);


--
-- Name: supplier_return_line_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.supplier_return_line_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: supplier_return_line_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.supplier_return_line_id_seq OWNED BY public.supplier_return_line.id;


--
-- Name: v_invoice_balance; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_invoice_balance AS
 SELECT si.id AS sale_invoice_id,
    si.customer_id,
    si.payment_terms,
    si.created_at,
    COALESCE(si.extended_due_date, si.due_date) AS due_date,
    t.total,
    r.returned,
    p.paid,
        CASE
            WHEN (v.sale_invoice_id IS NOT NULL) THEN (0)::numeric
            ELSE ((t.total - r.returned) - p.paid)
        END AS balance,
        CASE
            WHEN ((v.sale_invoice_id IS NULL) AND (((t.total - r.returned) - p.paid) > (0)::numeric) AND (COALESCE(si.extended_due_date, si.due_date) < CURRENT_DATE)) THEN (CURRENT_DATE - COALESCE(si.extended_due_date, si.due_date))
            ELSE NULL::integer
        END AS days_overdue,
    (v.sale_invoice_id IS NOT NULL) AS voided
   FROM ((((public.sale_invoice si
     LEFT JOIN public.sale_invoice_void v ON ((v.sale_invoice_id = si.id)))
     CROSS JOIN LATERAL ( SELECT COALESCE(sum((((l.quantity)::numeric * l.unit_price) - l.discount_amount)), (0)::numeric) AS total
           FROM public.sale_invoice_line l
          WHERE (l.sale_invoice_id = si.id)) t)
     CROSS JOIN LATERAL ( SELECT COALESCE(sum(round((((((l.quantity)::numeric * l.unit_price) - l.discount_amount) / (l.quantity)::numeric) * (rl.quantity)::numeric), 2)), (0)::numeric) AS returned
           FROM (public.customer_return_line rl
             JOIN public.sale_invoice_line l ON ((l.id = rl.sale_invoice_line_id)))
          WHERE (rl.sale_invoice_id = si.id)) r)
     CROSS JOIN LATERAL ( SELECT COALESCE(sum(a.amount), (0)::numeric) AS paid
           FROM public.customer_payment_allocation a
          WHERE (a.sale_invoice_id = si.id)) p);


--
-- Name: v_opening_balance_remaining; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_opening_balance_remaining AS
 SELECT ob.id AS customer_opening_balance_id,
    ob.customer_id,
    ob.as_of_date,
    ob.due_date,
    ob.amount,
    p.paid,
    (ob.amount - p.paid) AS balance,
        CASE
            WHEN (((ob.amount - p.paid) > (0)::numeric) AND (ob.due_date < CURRENT_DATE)) THEN (CURRENT_DATE - ob.due_date)
            ELSE NULL::integer
        END AS days_overdue
   FROM (public.customer_opening_balance ob
     CROSS JOIN LATERAL ( SELECT COALESCE(sum(a.amount), (0)::numeric) AS paid
           FROM public.customer_payment_allocation a
          WHERE (a.customer_opening_balance_id = ob.id)) p);


--
-- Name: v_customer_balance; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_customer_balance AS
 WITH debts AS (
         SELECT v_invoice_balance.customer_id,
            v_invoice_balance.balance,
            v_invoice_balance.due_date,
            v_invoice_balance.days_overdue
           FROM public.v_invoice_balance
          WHERE ((v_invoice_balance.customer_id IS NOT NULL) AND (v_invoice_balance.balance > (0)::numeric))
        UNION ALL
         SELECT v_opening_balance_remaining.customer_id,
            v_opening_balance_remaining.balance,
            v_opening_balance_remaining.due_date,
            v_opening_balance_remaining.days_overdue
           FROM public.v_opening_balance_remaining
          WHERE (v_opening_balance_remaining.balance > (0)::numeric)
        )
 SELECT customer_id,
    sum(balance) AS balance,
    COALESCE(sum(balance) FILTER (WHERE (days_overdue > 0)), (0)::numeric) AS overdue,
    min(due_date) AS oldest_due_date,
    max(days_overdue) AS max_days_overdue,
    (count(*))::integer AS open_items
   FROM debts
  GROUP BY customer_id;


--
-- Name: v_customer_overview; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_customer_overview AS
 SELECT c.id AS customer_id,
    (COALESCE(mo.motorcycles, (0)::bigint))::integer AS motorcycles,
    COALESCE(mo.brand_ids, '{}'::integer[]) AS motorcycle_brand_ids,
    COALESCE(b.balance, (0)::numeric) AS balance,
    COALESCE(b.overdue, (0)::numeric) AS overdue,
    b.max_days_overdue,
    b.oldest_due_date,
    (EXISTS ( SELECT 1
           FROM public.sale_invoice si
          WHERE ((si.customer_id = c.id) AND ((si.payment_terms)::text = 'CREDITO'::text)))) AS has_credit,
    GREATEST(( SELECT max(si.created_at) AS max
           FROM public.sale_invoice si
          WHERE (si.customer_id = c.id)), ( SELECT max(sc.changed_at) AS max
           FROM ((public.service_order_status_change sc
             JOIN public.service_order so ON ((so.id = sc.service_order_id)))
             JOIN public.motorcycle m ON ((m.id = so.motorcycle_id)))
          WHERE (m.customer_id = c.id))) AS last_visit_at
   FROM ((public.customer c
     LEFT JOIN LATERAL ( SELECT count(*) AS motorcycles,
            array_agg(DISTINCT mm.motorcycle_brand_id) AS brand_ids
           FROM (public.motorcycle m
             JOIN public.motorcycle_model mm ON ((mm.id = m.motorcycle_model_id)))
          WHERE (m.customer_id = c.id)) mo ON (true))
     LEFT JOIN public.v_customer_balance b ON ((b.customer_id = c.id)));


--
-- Name: v_mechanic_unpaid_commission; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_mechanic_unpaid_commission AS
 SELECT so.id AS service_order_id,
    so.mechanic_staff_id AS staff_id,
    d.delivered_at,
    so.applied_commission_rate AS rate,
    lab.labor,
    round((lab.labor * so.applied_commission_rate), 2) AS commission
   FROM ((public.service_order so
     CROSS JOIN LATERAL ( SELECT min(sc.changed_at) AS delivered_at
           FROM public.service_order_status_change sc
          WHERE ((sc.service_order_id = so.id) AND ((sc.status)::text = 'ENTREGADA'::text))) d)
     CROSS JOIN LATERAL ( SELECT COALESCE(sum((((l.quantity)::numeric * l.unit_price) - l.discount_amount)), (0)::numeric) AS labor
           FROM (public.sale_invoice si
             JOIN public.sale_invoice_line l ON ((l.sale_invoice_id = si.id)))
          WHERE ((si.service_order_id = so.id) AND ((l.line_type)::text = 'MANO_OBRA'::text))) lab)
  WHERE ((so.staff_payout_id IS NULL) AND (so.applied_commission_rate IS NOT NULL) AND (so.mechanic_staff_id IS NOT NULL) AND (d.delivered_at IS NOT NULL) AND (NOT (EXISTS ( SELECT 1
           FROM (public.sale_invoice si
             JOIN public.sale_invoice_void v ON ((v.sale_invoice_id = si.id)))
          WHERE (si.service_order_id = so.id)))));


--
-- Name: v_product_margin; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_product_margin AS
 SELECT p.id AS product_id,
    p.list_price,
    lc.unit_cost AS last_cost,
    (p.list_price - lc.unit_cost) AS margin,
        CASE
            WHEN ((p.list_price > (0)::numeric) AND (lc.unit_cost IS NOT NULL)) THEN round((((p.list_price - lc.unit_cost) / p.list_price) * (100)::numeric), 1)
            ELSE NULL::numeric
        END AS margin_pct
   FROM (public.product p
     LEFT JOIN LATERAL ( SELECT m.unit_cost
           FROM public.inventory_movement m
          WHERE ((m.product_id = p.id) AND ((m.movement_type)::text = ANY ((ARRAY['COMPRA'::character varying, 'DEVOLUCION_CLIENTE'::character varying, 'INVENTARIO_INICIAL'::character varying, 'AJUSTE_ENTRADA'::character varying])::text[])))
          ORDER BY m.moved_at DESC, m.id DESC
         LIMIT 1) lc ON (true));


--
-- Name: v_supplier_product; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_supplier_product AS
 SELECT DISTINCT ON (pi.supplier_id, l.product_id) pi.supplier_id,
    l.product_id,
    l.unit_cost AS last_unit_cost,
    pi.purchase_date AS last_purchase_date,
    count(*) OVER (PARTITION BY pi.supplier_id, l.product_id) AS times_bought,
    sum(l.quantity) OVER (PARTITION BY pi.supplier_id, l.product_id) AS total_quantity
   FROM (public.purchase_invoice_line l
     JOIN public.purchase_invoice pi ON ((pi.id = l.purchase_invoice_id)))
  ORDER BY pi.supplier_id, l.product_id, pi.purchase_date DESC, pi.id DESC, l.id DESC;


--
-- Name: v_product_overview; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_product_overview AS
 SELECT p.id AS product_id,
    p.product_category_id,
    p.product_brand_id,
    p.quality_tier,
    p.list_price,
    p.stock,
    m.last_cost,
    m.margin_pct,
    s.last_sold_at,
    (COALESCE(s.sold_90d, (0)::bigint))::integer AS sold_90d,
    COALESCE(sp.supplier_ids, '{}'::integer[]) AS supplier_ids
   FROM (((public.product p
     JOIN public.v_product_margin m ON ((m.product_id = p.id)))
     LEFT JOIN LATERAL ( SELECT max(mv.moved_at) AS last_sold_at,
            sum(mv.quantity) FILTER (WHERE (mv.moved_at >= (now() - '90 days'::interval))) AS sold_90d
           FROM public.inventory_movement mv
          WHERE ((mv.product_id = p.id) AND ((mv.movement_type)::text = ANY ((ARRAY['VENTA'::character varying, 'USO_SERVICIO'::character varying])::text[])))) s ON (true))
     LEFT JOIN LATERAL ( SELECT array_agg(DISTINCT x.supplier_id) AS supplier_ids
           FROM public.v_supplier_product x
          WHERE (x.product_id = p.id)) sp ON (true));


--
-- Name: v_product_stock_mismatch; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_product_stock_mismatch AS
 SELECT p.id AS product_id,
    p.stock,
    (COALESCE(sum(
        CASE
            WHEN ((m.movement_type)::text = ANY ((ARRAY['COMPRA'::character varying, 'DEVOLUCION_CLIENTE'::character varying, 'INVENTARIO_INICIAL'::character varying, 'AJUSTE_ENTRADA'::character varying])::text[])) THEN m.quantity
            ELSE (- m.quantity)
        END), (0)::bigint))::integer AS ledger_stock
   FROM (public.product p
     LEFT JOIN public.inventory_movement m ON ((m.product_id = p.id)))
  GROUP BY p.id, p.stock
 HAVING (p.stock <> COALESCE(sum(
        CASE
            WHEN ((m.movement_type)::text = ANY ((ARRAY['COMPRA'::character varying, 'DEVOLUCION_CLIENTE'::character varying, 'INVENTARIO_INICIAL'::character varying, 'AJUSTE_ENTRADA'::character varying])::text[])) THEN m.quantity
            ELSE (- m.quantity)
        END), (0)::bigint));


--
-- Name: v_purchase_invoice_balance; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_purchase_invoice_balance AS
 SELECT pi.id AS purchase_invoice_id,
    pi.supplier_id,
    pi.purchase_date,
    pi.payment_terms,
    pi.due_date,
    (g.gross - pi.discount_amount) AS total,
    r.returned,
    p.paid,
    (((g.gross - pi.discount_amount) - r.returned) - p.paid) AS balance,
        CASE
            WHEN (((((g.gross - pi.discount_amount) - r.returned) - p.paid) > (0)::numeric) AND (pi.due_date < CURRENT_DATE)) THEN (CURRENT_DATE - pi.due_date)
            ELSE NULL::integer
        END AS days_overdue
   FROM (((public.purchase_invoice pi
     CROSS JOIN LATERAL ( SELECT COALESCE(sum(((l.quantity)::numeric * l.unit_cost)), (0)::numeric) AS gross
           FROM public.purchase_invoice_line l
          WHERE (l.purchase_invoice_id = pi.id)) g)
     CROSS JOIN LATERAL ( SELECT COALESCE(sum((l.unit_cost * (rl.quantity)::numeric)), (0)::numeric) AS returned
           FROM ((public.supplier_return_line rl
             JOIN public.supplier_return sr ON ((sr.id = rl.supplier_return_id)))
             JOIN public.purchase_invoice_line l ON ((l.id = rl.purchase_invoice_line_id)))
          WHERE ((rl.purchase_invoice_id = pi.id) AND ((sr.resolution)::text <> 'REPOSICION'::text))) r)
     CROSS JOIN LATERAL ( SELECT COALESCE(sum(
                CASE
                    WHEN ((sp.currency)::text = 'USD'::text) THEN round((sp.amount * sp.exchange_rate), 2)
                    ELSE sp.amount
                END), (0)::numeric) AS paid
           FROM public.supplier_payment sp
          WHERE (sp.purchase_invoice_id = pi.id)) p);


--
-- Name: v_service_order_status; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_service_order_status AS
 SELECT DISTINCT ON (service_order_id) service_order_id,
    status,
    changed_at AS status_since
   FROM public.service_order_status_change sc
  ORDER BY service_order_id, changed_at DESC, id DESC;


--
-- Name: v_supplier_balance; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_supplier_balance AS
 SELECT s.id AS supplier_id,
    (COALESCE(s.opening_balance, (0)::numeric) - op.paid) AS opening_balance,
    pu.balance AS purchases_balance,
    ((COALESCE(s.opening_balance, (0)::numeric) - op.paid) + pu.balance) AS balance,
    pu.overdue
   FROM ((public.supplier s
     CROSS JOIN LATERAL ( SELECT COALESCE(sum(
                CASE
                    WHEN ((sp.currency)::text = 'USD'::text) THEN round((sp.amount * sp.exchange_rate), 2)
                    ELSE sp.amount
                END), (0)::numeric) AS paid
           FROM public.supplier_payment sp
          WHERE ((sp.supplier_id = s.id) AND (sp.purchase_invoice_id IS NULL))) op)
     CROSS JOIN LATERAL ( SELECT COALESCE(sum(b.balance), (0)::numeric) AS balance,
            COALESCE(sum(b.balance) FILTER (WHERE (b.days_overdue > 0)), (0)::numeric) AS overdue
           FROM public.v_purchase_invoice_balance b
          WHERE (b.supplier_id = s.id)) pu);


--
-- Name: warranty_claim; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.warranty_claim (
    id integer NOT NULL,
    original_service_order_id integer NOT NULL,
    claimed_on date DEFAULT CURRENT_DATE NOT NULL,
    description character varying(500) NOT NULL,
    outcome character varying(20) NOT NULL,
    part_paid_by character varying(20),
    refund_amount numeric(12,2),
    attended_by_user_id integer NOT NULL,
    new_service_order_id integer,
    part_sale_invoice_id integer,
    CONSTRAINT ck_warranty_claim_description CHECK ((btrim((description)::text) <> ''::text)),
    CONSTRAINT ck_warranty_claim_new_service_order CHECK (((new_service_order_id IS NULL) OR (((outcome)::text = 'FALLA_DISTINTA'::text) AND (new_service_order_id <> original_service_order_id)))),
    CONSTRAINT ck_warranty_claim_outcome CHECK (((outcome)::text = ANY ((ARRAY['CUBIERTO'::character varying, 'FALLA_DISTINTA'::character varying, 'FUERA_DE_PLAZO'::character varying, 'REEMBOLSO'::character varying])::text[]))),
    CONSTRAINT ck_warranty_claim_part_paid_by CHECK (((part_paid_by)::text = ANY ((ARRAY['TIENDA'::character varying, 'CLIENTE'::character varying])::text[]))),
    CONSTRAINT ck_warranty_claim_part_sale_invoice CHECK (((part_sale_invoice_id IS NULL) OR ((COALESCE(part_paid_by, ''::character varying))::text = 'CLIENTE'::text))),
    CONSTRAINT ck_warranty_claim_refund CHECK ((((outcome)::text = 'REEMBOLSO'::text) = (refund_amount IS NOT NULL))),
    CONSTRAINT ck_warranty_claim_refund_amount CHECK ((refund_amount > (0)::numeric))
);


--
-- Name: warranty_claim_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.warranty_claim_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: warranty_claim_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.warranty_claim_id_seq OWNED BY public.warranty_claim.id;


--
-- Name: additional_fault id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.additional_fault ALTER COLUMN id SET DEFAULT nextval('public.additional_fault_id_seq'::regclass);


--
-- Name: app_session id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_session ALTER COLUMN id SET DEFAULT nextval('public.app_session_id_seq'::regclass);


--
-- Name: app_user id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_user ALTER COLUMN id SET DEFAULT nextval('public.app_user_id_seq'::regclass);


--
-- Name: cash_withdrawal id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_withdrawal ALTER COLUMN id SET DEFAULT nextval('public.cash_withdrawal_id_seq'::regclass);


--
-- Name: cash_withdrawal_reason id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_withdrawal_reason ALTER COLUMN id SET DEFAULT nextval('public.cash_withdrawal_reason_id_seq'::regclass);


--
-- Name: customer id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer ALTER COLUMN id SET DEFAULT nextval('public.customer_id_seq'::regclass);


--
-- Name: customer_opening_balance id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_opening_balance ALTER COLUMN id SET DEFAULT nextval('public.customer_opening_balance_id_seq'::regclass);


--
-- Name: customer_payment id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_payment ALTER COLUMN id SET DEFAULT nextval('public.customer_payment_id_seq'::regclass);


--
-- Name: customer_payment_allocation id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_payment_allocation ALTER COLUMN id SET DEFAULT nextval('public.customer_payment_allocation_id_seq'::regclass);


--
-- Name: customer_return id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_return ALTER COLUMN id SET DEFAULT nextval('public.customer_return_id_seq'::regclass);


--
-- Name: customer_return_line id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_return_line ALTER COLUMN id SET DEFAULT nextval('public.customer_return_line_id_seq'::regclass);


--
-- Name: discount id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discount ALTER COLUMN id SET DEFAULT nextval('public.discount_id_seq'::regclass);


--
-- Name: inventory_movement id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movement ALTER COLUMN id SET DEFAULT nextval('public.inventory_movement_id_seq'::regclass);


--
-- Name: motorcycle id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.motorcycle ALTER COLUMN id SET DEFAULT nextval('public.motorcycle_id_seq'::regclass);


--
-- Name: motorcycle_brand id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.motorcycle_brand ALTER COLUMN id SET DEFAULT nextval('public.motorcycle_brand_id_seq'::regclass);


--
-- Name: motorcycle_model id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.motorcycle_model ALTER COLUMN id SET DEFAULT nextval('public.motorcycle_model_id_seq'::regclass);


--
-- Name: payment_method id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_method ALTER COLUMN id SET DEFAULT nextval('public.payment_method_id_seq'::regclass);


--
-- Name: permission id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission ALTER COLUMN id SET DEFAULT nextval('public.permission_id_seq'::regclass);


--
-- Name: product id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product ALTER COLUMN id SET DEFAULT nextval('public.product_id_seq'::regclass);


--
-- Name: product_brand id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_brand ALTER COLUMN id SET DEFAULT nextval('public.product_brand_id_seq'::regclass);


--
-- Name: product_category id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_category ALTER COLUMN id SET DEFAULT nextval('public.product_category_id_seq'::regclass);


--
-- Name: product_price_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_price_history ALTER COLUMN id SET DEFAULT nextval('public.product_price_history_id_seq'::regclass);


--
-- Name: purchase_invoice id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_invoice ALTER COLUMN id SET DEFAULT nextval('public.purchase_invoice_id_seq'::regclass);


--
-- Name: purchase_invoice_line id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_invoice_line ALTER COLUMN id SET DEFAULT nextval('public.purchase_invoice_line_id_seq'::regclass);


--
-- Name: return_reason id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.return_reason ALTER COLUMN id SET DEFAULT nextval('public.return_reason_id_seq'::regclass);


--
-- Name: role id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role ALTER COLUMN id SET DEFAULT nextval('public.role_id_seq'::regclass);


--
-- Name: sale_invoice id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_invoice ALTER COLUMN id SET DEFAULT nextval('public.sale_invoice_id_seq'::regclass);


--
-- Name: sale_invoice_line id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_invoice_line ALTER COLUMN id SET DEFAULT nextval('public.sale_invoice_line_id_seq'::regclass);


--
-- Name: service_category id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_category ALTER COLUMN id SET DEFAULT nextval('public.service_category_id_seq'::regclass);


--
-- Name: service_order id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order ALTER COLUMN id SET DEFAULT nextval('public.service_order_id_seq'::regclass);


--
-- Name: service_order_item id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_item ALTER COLUMN id SET DEFAULT nextval('public.service_order_item_id_seq'::regclass);


--
-- Name: service_order_status_change id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_status_change ALTER COLUMN id SET DEFAULT nextval('public.service_order_status_change_id_seq'::regclass);


--
-- Name: service_type id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_type ALTER COLUMN id SET DEFAULT nextval('public.service_type_id_seq'::regclass);


--
-- Name: staff id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff ALTER COLUMN id SET DEFAULT nextval('public.staff_id_seq'::regclass);


--
-- Name: staff_advance id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_advance ALTER COLUMN id SET DEFAULT nextval('public.staff_advance_id_seq'::regclass);


--
-- Name: staff_payout id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_payout ALTER COLUMN id SET DEFAULT nextval('public.staff_payout_id_seq'::regclass);


--
-- Name: supplier id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier ALTER COLUMN id SET DEFAULT nextval('public.supplier_id_seq'::regclass);


--
-- Name: supplier_payment id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_payment ALTER COLUMN id SET DEFAULT nextval('public.supplier_payment_id_seq'::regclass);


--
-- Name: supplier_return id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_return ALTER COLUMN id SET DEFAULT nextval('public.supplier_return_id_seq'::regclass);


--
-- Name: supplier_return_line id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_return_line ALTER COLUMN id SET DEFAULT nextval('public.supplier_return_line_id_seq'::regclass);


--
-- Name: warranty_claim id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warranty_claim ALTER COLUMN id SET DEFAULT nextval('public.warranty_claim_id_seq'::regclass);


--
-- Data for Name: additional_fault; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: app_session; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: app_user; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: cash_withdrawal; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: cash_withdrawal_reason; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.cash_withdrawal_reason (id, name, active) VALUES (1, 'Viaje a Managua (compras)', true);
INSERT INTO public.cash_withdrawal_reason (id, name, active) VALUES (2, 'Gastos del negocio', true);
INSERT INTO public.cash_withdrawal_reason (id, name, active) VALUES (3, 'Retiro de dueño', true);


--
-- Data for Name: customer; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: customer_opening_balance; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: customer_payment; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: customer_payment_allocation; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: customer_return; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: customer_return_line; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: discount; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: inventory_movement; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: motorcycle; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: motorcycle_brand; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: motorcycle_model; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: payment_method; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.payment_method (id, name, active) VALUES (1, 'Efectivo', true);
INSERT INTO public.payment_method (id, name, active) VALUES (2, 'Transferencia', true);
INSERT INTO public.payment_method (id, name, active) VALUES (3, 'Tarjeta', true);


--
-- Data for Name: permission; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.permission (id, code, description) VALUES (1, 'clientes.ver', 'Ver clientes, motos y estados de cuenta');
INSERT INTO public.permission (id, code, description) VALUES (2, 'clientes.gestionar', 'Crear y editar clientes y motos; saldos iniciales');
INSERT INTO public.permission (id, code, description) VALUES (3, 'inventario.ver', 'Ver productos, existencias y kardex');
INSERT INTO public.permission (id, code, description) VALUES (4, 'inventario.gestionar', 'Crear y editar productos; inventario inicial');
INSERT INTO public.permission (id, code, description) VALUES (5, 'inventario.ajustar', 'Registrar ajustes de inventario (entrada/salida)');
INSERT INTO public.permission (id, code, description) VALUES (6, 'inventario.precios', 'Cambiar precios de venta');
INSERT INTO public.permission (id, code, description) VALUES (7, 'ventas.ver', 'Ver facturas de venta');
INSERT INTO public.permission (id, code, description) VALUES (8, 'ventas.crear', 'Vender en mostrador');
INSERT INTO public.permission (id, code, description) VALUES (9, 'ventas.autorizar_descuento', 'Autorizar descuentos');
INSERT INTO public.permission (id, code, description) VALUES (10, 'ventas.autorizar_credito', 'Autorizar ventas al crédito y prórrogas');
INSERT INTO public.permission (id, code, description) VALUES (11, 'ventas.devoluciones', 'Registrar devoluciones de clientes');
INSERT INTO public.permission (id, code, description) VALUES (12, 'ventas.anular', 'Anular facturas (solo dueños, hasta 3 días)');
INSERT INTO public.permission (id, code, description) VALUES (13, 'cobros.registrar', 'Registrar abonos y pagos de clientes');
INSERT INTO public.permission (id, code, description) VALUES (14, 'taller.ver', 'Ver órdenes de servicio');
INSERT INTO public.permission (id, code, description) VALUES (15, 'taller.gestionar', 'Recibir motos, asignar mecánico, cambiar estados, fallas adicionales');
INSERT INTO public.permission (id, code, description) VALUES (16, 'taller.facturar', 'Cerrar y cobrar órdenes de servicio');
INSERT INTO public.permission (id, code, description) VALUES (17, 'taller.precio_especial', 'Cobrar un trabajo fuera de su rango de precio');
INSERT INTO public.permission (id, code, description) VALUES (18, 'garantias.gestionar', 'Registrar reclamos de garantía');
INSERT INTO public.permission (id, code, description) VALUES (19, 'compras.ver', 'Ver proveedores y compras');
INSERT INTO public.permission (id, code, description) VALUES (20, 'compras.gestionar', 'Registrar compras, devoluciones y pagos a proveedores');
INSERT INTO public.permission (id, code, description) VALUES (21, 'personal.ver', 'Ver personal, comisiones y adelantos');
INSERT INTO public.permission (id, code, description) VALUES (22, 'personal.pagos', 'Dar adelantos y pagar la semana a los mecánicos');
INSERT INTO public.permission (id, code, description) VALUES (23, 'caja.retiros', 'Registrar retiros de caja');
INSERT INTO public.permission (id, code, description) VALUES (24, 'reportes.ver', 'Ver reportes y cierre de caja');
INSERT INTO public.permission (id, code, description) VALUES (25, 'catalogos.gestionar', 'Mantener catálogos (marcas, categorías, motivos, métodos de pago…)');
INSERT INTO public.permission (id, code, description) VALUES (26, 'admin.usuarios', 'Administrar usuarios, roles y permisos');


--
-- Data for Name: product; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: product_brand; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.product_brand (id, name) VALUES (1, 'Genérico');


--
-- Data for Name: product_category; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.product_category (id, name) VALUES (1, 'Repuestos');
INSERT INTO public.product_category (id, name) VALUES (2, 'Accesorios');
INSERT INTO public.product_category (id, name) VALUES (3, 'Lubricantes');
INSERT INTO public.product_category (id, name) VALUES (4, 'Iluminación');
INSERT INTO public.product_category (id, name) VALUES (5, 'Protectores');
INSERT INTO public.product_category (id, name) VALUES (6, 'Rodamientos');


--
-- Data for Name: product_price_history; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: purchase_invoice; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: purchase_invoice_line; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: return_reason; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.return_reason (id, name, active) VALUES (1, 'Anulación de factura', true);
INSERT INTO public.return_reason (id, name, active) VALUES (2, 'Producto defectuoso', true);
INSERT INTO public.return_reason (id, name, active) VALUES (3, 'No es compatible con la moto', true);
INSERT INTO public.return_reason (id, name, active) VALUES (4, 'El cliente cambió de opinión', true);
INSERT INTO public.return_reason (id, name, active) VALUES (5, 'Error en el pedido', true);


--
-- Data for Name: role; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.role (id, name, description, active) VALUES (1, 'Dueño', 'Dueño del negocio: acceso completo', true);
INSERT INTO public.role (id, name, description, active) VALUES (2, 'Encargado', 'Atiende mostrador y taller', true);


--
-- Data for Name: role_permission; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.role_permission (role_id, permission_id) VALUES (1, 1);
INSERT INTO public.role_permission (role_id, permission_id) VALUES (1, 2);
INSERT INTO public.role_permission (role_id, permission_id) VALUES (1, 3);
INSERT INTO public.role_permission (role_id, permission_id) VALUES (1, 4);
INSERT INTO public.role_permission (role_id, permission_id) VALUES (1, 5);
INSERT INTO public.role_permission (role_id, permission_id) VALUES (1, 6);
INSERT INTO public.role_permission (role_id, permission_id) VALUES (1, 7);
INSERT INTO public.role_permission (role_id, permission_id) VALUES (1, 8);
INSERT INTO public.role_permission (role_id, permission_id) VALUES (1, 9);
INSERT INTO public.role_permission (role_id, permission_id) VALUES (1, 10);
INSERT INTO public.role_permission (role_id, permission_id) VALUES (1, 11);
INSERT INTO public.role_permission (role_id, permission_id) VALUES (1, 12);
INSERT INTO public.role_permission (role_id, permission_id) VALUES (1, 13);
INSERT INTO public.role_permission (role_id, permission_id) VALUES (1, 14);
INSERT INTO public.role_permission (role_id, permission_id) VALUES (1, 15);
INSERT INTO public.role_permission (role_id, permission_id) VALUES (1, 16);
INSERT INTO public.role_permission (role_id, permission_id) VALUES (1, 17);
INSERT INTO public.role_permission (role_id, permission_id) VALUES (1, 18);
INSERT INTO public.role_permission (role_id, permission_id) VALUES (1, 19);
INSERT INTO public.role_permission (role_id, permission_id) VALUES (1, 20);
INSERT INTO public.role_permission (role_id, permission_id) VALUES (1, 21);
INSERT INTO public.role_permission (role_id, permission_id) VALUES (1, 22);
INSERT INTO public.role_permission (role_id, permission_id) VALUES (1, 23);
INSERT INTO public.role_permission (role_id, permission_id) VALUES (1, 24);
INSERT INTO public.role_permission (role_id, permission_id) VALUES (1, 25);
INSERT INTO public.role_permission (role_id, permission_id) VALUES (1, 26);
INSERT INTO public.role_permission (role_id, permission_id) VALUES (2, 1);
INSERT INTO public.role_permission (role_id, permission_id) VALUES (2, 2);
INSERT INTO public.role_permission (role_id, permission_id) VALUES (2, 3);
INSERT INTO public.role_permission (role_id, permission_id) VALUES (2, 7);
INSERT INTO public.role_permission (role_id, permission_id) VALUES (2, 8);
INSERT INTO public.role_permission (role_id, permission_id) VALUES (2, 11);
INSERT INTO public.role_permission (role_id, permission_id) VALUES (2, 13);
INSERT INTO public.role_permission (role_id, permission_id) VALUES (2, 14);
INSERT INTO public.role_permission (role_id, permission_id) VALUES (2, 15);
INSERT INTO public.role_permission (role_id, permission_id) VALUES (2, 16);
INSERT INTO public.role_permission (role_id, permission_id) VALUES (2, 18);
INSERT INTO public.role_permission (role_id, permission_id) VALUES (2, 19);
INSERT INTO public.role_permission (role_id, permission_id) VALUES (2, 20);
INSERT INTO public.role_permission (role_id, permission_id) VALUES (2, 21);


--
-- Data for Name: sale_invoice; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: sale_invoice_line; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: sale_invoice_void; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: service_category; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.service_category (id, name, sort_order) VALUES (1, 'Mantenimiento', 10);
INSERT INTO public.service_category (id, name, sort_order) VALUES (2, 'Frenos', 20);
INSERT INTO public.service_category (id, name, sort_order) VALUES (3, 'Motor', 30);
INSERT INTO public.service_category (id, name, sort_order) VALUES (4, 'Sistema eléctrico', 40);
INSERT INTO public.service_category (id, name, sort_order) VALUES (5, 'Suspensión y dirección', 50);
INSERT INTO public.service_category (id, name, sort_order) VALUES (6, 'Transmisión', 60);
INSERT INTO public.service_category (id, name, sort_order) VALUES (7, 'Llantas', 70);
INSERT INTO public.service_category (id, name, sort_order) VALUES (8, 'Accesorios', 80);
INSERT INTO public.service_category (id, name, sort_order) VALUES (9, 'Diagnóstico', 90);
INSERT INTO public.service_category (id, name, sort_order) VALUES (10, 'Otros cargos', 200);


--
-- Data for Name: service_order; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: service_order_item; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: service_order_status_change; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: service_type; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.service_type (id, name, reference_price, active, service_category_id, min_price, max_price) VALUES (1, 'Cargo por cancelación', NULL, true, 10, NULL, NULL);
INSERT INTO public.service_type (id, name, reference_price, active, service_category_id, min_price, max_price) VALUES (2, 'Cambio de bujía', 80.00, true, 1, 50.00, 150.00);
INSERT INTO public.service_type (id, name, reference_price, active, service_category_id, min_price, max_price) VALUES (3, 'Cambio de filtro de aire', 100.00, true, 1, 50.00, 200.00);
INSERT INTO public.service_type (id, name, reference_price, active, service_category_id, min_price, max_price) VALUES (4, 'Ajuste de cadena', 100.00, true, 1, 50.00, 200.00);
INSERT INTO public.service_type (id, name, reference_price, active, service_category_id, min_price, max_price) VALUES (5, 'Lavado y lubricación de cadena', 150.00, true, 1, 100.00, 250.00);
INSERT INTO public.service_type (id, name, reference_price, active, service_category_id, min_price, max_price) VALUES (6, 'Mantenimiento general', 800.00, true, 1, 600.00, 1500.00);
INSERT INTO public.service_type (id, name, reference_price, active, service_category_id, min_price, max_price) VALUES (7, 'Engrase', 400.00, true, 1, 300.00, 600.00);
INSERT INTO public.service_type (id, name, reference_price, active, service_category_id, min_price, max_price) VALUES (8, 'Cambio de aceite', 150.00, true, 1, 100.00, 250.00);
INSERT INTO public.service_type (id, name, reference_price, active, service_category_id, min_price, max_price) VALUES (9, 'Rectificado de disco', 300.00, true, 2, NULL, NULL);
INSERT INTO public.service_type (id, name, reference_price, active, service_category_id, min_price, max_price) VALUES (10, 'Purga de frenos', 200.00, true, 2, 150.00, 350.00);
INSERT INTO public.service_type (id, name, reference_price, active, service_category_id, min_price, max_price) VALUES (11, 'Cambio de zapatas', 250.00, true, 2, 150.00, 400.00);
INSERT INTO public.service_type (id, name, reference_price, active, service_category_id, min_price, max_price) VALUES (12, 'Cambio de pastillas de freno', 250.00, true, 2, 150.00, 400.00);
INSERT INTO public.service_type (id, name, reference_price, active, service_category_id, min_price, max_price) VALUES (13, 'Cambio de empaques', 600.00, true, 3, NULL, NULL);
INSERT INTO public.service_type (id, name, reference_price, active, service_category_id, min_price, max_price) VALUES (14, 'Calibración de válvulas', 400.00, true, 3, 300.00, 600.00);
INSERT INTO public.service_type (id, name, reference_price, active, service_category_id, min_price, max_price) VALUES (15, 'Limpieza de carburador', 500.00, true, 3, 350.00, 800.00);
INSERT INTO public.service_type (id, name, reference_price, active, service_category_id, min_price, max_price) VALUES (16, 'Trabajo de motor', NULL, true, 3, NULL, NULL);
INSERT INTO public.service_type (id, name, reference_price, active, service_category_id, min_price, max_price) VALUES (17, 'Instalación de luces', 250.00, true, 4, 150.00, 500.00);
INSERT INTO public.service_type (id, name, reference_price, active, service_category_id, min_price, max_price) VALUES (18, 'Cambio de batería', 100.00, true, 4, 50.00, 200.00);
INSERT INTO public.service_type (id, name, reference_price, active, service_category_id, min_price, max_price) VALUES (19, 'Revisión eléctrica', 300.00, true, 4, 200.00, 600.00);
INSERT INTO public.service_type (id, name, reference_price, active, service_category_id, min_price, max_price) VALUES (20, 'Cambio de rodamientos de dirección', 450.00, true, 5, 300.00, 700.00);
INSERT INTO public.service_type (id, name, reference_price, active, service_category_id, min_price, max_price) VALUES (21, 'Cambio de aceite de barras', 500.00, true, 5, 400.00, 800.00);
INSERT INTO public.service_type (id, name, reference_price, active, service_category_id, min_price, max_price) VALUES (22, 'Cambio de cable de clutch', 150.00, true, 6, 100.00, 250.00);
INSERT INTO public.service_type (id, name, reference_price, active, service_category_id, min_price, max_price) VALUES (23, 'Ajuste de clutch', 150.00, true, 6, 100.00, 250.00);
INSERT INTO public.service_type (id, name, reference_price, active, service_category_id, min_price, max_price) VALUES (24, 'Cambio de kit de arrastre', 350.00, true, 6, 250.00, 500.00);
INSERT INTO public.service_type (id, name, reference_price, active, service_category_id, min_price, max_price) VALUES (25, 'Cambio de rodamientos de rueda', 300.00, true, 7, 200.00, 450.00);
INSERT INTO public.service_type (id, name, reference_price, active, service_category_id, min_price, max_price) VALUES (26, 'Reparación de neumático', 80.00, true, 7, 50.00, 150.00);
INSERT INTO public.service_type (id, name, reference_price, active, service_category_id, min_price, max_price) VALUES (27, 'Cambio de llanta', 100.00, true, 7, 50.00, 200.00);
INSERT INTO public.service_type (id, name, reference_price, active, service_category_id, min_price, max_price) VALUES (28, 'Instalación de accesorio', 200.00, true, 8, 100.00, 500.00);
INSERT INTO public.service_type (id, name, reference_price, active, service_category_id, min_price, max_price) VALUES (29, 'Diagnóstico', NULL, true, 9, NULL, NULL);


--
-- Data for Name: staff; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: staff_advance; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: staff_payout; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: supplier; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: supplier_payment; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: supplier_return; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: supplier_return_line; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: warranty_claim; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Name: additional_fault_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.additional_fault_id_seq', 1, false);


--
-- Name: app_session_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.app_session_id_seq', 1, false);


--
-- Name: app_user_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.app_user_id_seq', 1, false);


--
-- Name: cash_withdrawal_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.cash_withdrawal_id_seq', 1, false);


--
-- Name: cash_withdrawal_reason_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.cash_withdrawal_reason_id_seq', 3, true);


--
-- Name: customer_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.customer_id_seq', 1, false);


--
-- Name: customer_opening_balance_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.customer_opening_balance_id_seq', 1, false);


--
-- Name: customer_payment_allocation_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.customer_payment_allocation_id_seq', 1, false);


--
-- Name: customer_payment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.customer_payment_id_seq', 1, false);


--
-- Name: customer_return_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.customer_return_id_seq', 1, false);


--
-- Name: customer_return_line_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.customer_return_line_id_seq', 1, false);


--
-- Name: discount_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.discount_id_seq', 1, false);


--
-- Name: inventory_movement_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.inventory_movement_id_seq', 1, false);


--
-- Name: motorcycle_brand_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.motorcycle_brand_id_seq', 1, false);


--
-- Name: motorcycle_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.motorcycle_id_seq', 1, false);


--
-- Name: motorcycle_model_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.motorcycle_model_id_seq', 1, false);


--
-- Name: payment_method_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.payment_method_id_seq', 3, true);


--
-- Name: permission_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.permission_id_seq', 26, true);


--
-- Name: product_brand_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.product_brand_id_seq', 1, true);


--
-- Name: product_category_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.product_category_id_seq', 6, true);


--
-- Name: product_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.product_id_seq', 1, false);


--
-- Name: product_price_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.product_price_history_id_seq', 1, false);


--
-- Name: purchase_invoice_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.purchase_invoice_id_seq', 1, false);


--
-- Name: purchase_invoice_line_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.purchase_invoice_line_id_seq', 1, false);


--
-- Name: return_reason_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.return_reason_id_seq', 5, true);


--
-- Name: role_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.role_id_seq', 2, true);


--
-- Name: sale_invoice_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.sale_invoice_id_seq', 1, false);


--
-- Name: sale_invoice_line_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.sale_invoice_line_id_seq', 1, false);


--
-- Name: service_category_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.service_category_id_seq', 10, true);


--
-- Name: service_order_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.service_order_id_seq', 1, false);


--
-- Name: service_order_item_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.service_order_item_id_seq', 1, false);


--
-- Name: service_order_status_change_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.service_order_status_change_id_seq', 1, false);


--
-- Name: service_type_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.service_type_id_seq', 29, true);


--
-- Name: staff_advance_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.staff_advance_id_seq', 1, false);


--
-- Name: staff_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.staff_id_seq', 1, false);


--
-- Name: staff_payout_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.staff_payout_id_seq', 1, false);


--
-- Name: supplier_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.supplier_id_seq', 1, false);


--
-- Name: supplier_payment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.supplier_payment_id_seq', 1, false);


--
-- Name: supplier_return_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.supplier_return_id_seq', 1, false);


--
-- Name: supplier_return_line_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.supplier_return_line_id_seq', 1, false);


--
-- Name: warranty_claim_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.warranty_claim_id_seq', 1, false);


--
-- Name: sale_invoice_line ck_sale_invoice_line_labor_service_type; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.sale_invoice_line
    ADD CONSTRAINT ck_sale_invoice_line_labor_service_type CHECK ((((line_type)::text <> 'MANO_OBRA'::text) OR (service_type_id IS NOT NULL) OR (additional_fault_id IS NOT NULL))) NOT VALID;


--
-- Name: additional_fault pk_additional_fault; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.additional_fault
    ADD CONSTRAINT pk_additional_fault PRIMARY KEY (id);


--
-- Name: app_session pk_app_session; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_session
    ADD CONSTRAINT pk_app_session PRIMARY KEY (id);


--
-- Name: app_user pk_app_user; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT pk_app_user PRIMARY KEY (id);


--
-- Name: cash_withdrawal pk_cash_withdrawal; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_withdrawal
    ADD CONSTRAINT pk_cash_withdrawal PRIMARY KEY (id);


--
-- Name: cash_withdrawal_reason pk_cash_withdrawal_reason; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_withdrawal_reason
    ADD CONSTRAINT pk_cash_withdrawal_reason PRIMARY KEY (id);


--
-- Name: customer pk_customer; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer
    ADD CONSTRAINT pk_customer PRIMARY KEY (id);


--
-- Name: customer_opening_balance pk_customer_opening_balance; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_opening_balance
    ADD CONSTRAINT pk_customer_opening_balance PRIMARY KEY (id);


--
-- Name: customer_payment pk_customer_payment; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_payment
    ADD CONSTRAINT pk_customer_payment PRIMARY KEY (id);


--
-- Name: customer_payment_allocation pk_customer_payment_allocation; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_payment_allocation
    ADD CONSTRAINT pk_customer_payment_allocation PRIMARY KEY (id);


--
-- Name: customer_return pk_customer_return; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_return
    ADD CONSTRAINT pk_customer_return PRIMARY KEY (id);


--
-- Name: customer_return_line pk_customer_return_line; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_return_line
    ADD CONSTRAINT pk_customer_return_line PRIMARY KEY (id);


--
-- Name: discount pk_discount; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.discount
    ADD CONSTRAINT pk_discount PRIMARY KEY (id);


--
-- Name: inventory_movement pk_inventory_movement; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movement
    ADD CONSTRAINT pk_inventory_movement PRIMARY KEY (id);


--
-- Name: motorcycle pk_motorcycle; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.motorcycle
    ADD CONSTRAINT pk_motorcycle PRIMARY KEY (id);


--
-- Name: motorcycle_brand pk_motorcycle_brand; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.motorcycle_brand
    ADD CONSTRAINT pk_motorcycle_brand PRIMARY KEY (id);


--
-- Name: motorcycle_model pk_motorcycle_model; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.motorcycle_model
    ADD CONSTRAINT pk_motorcycle_model PRIMARY KEY (id);


--
-- Name: payment_method pk_payment_method; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_method
    ADD CONSTRAINT pk_payment_method PRIMARY KEY (id);


--
-- Name: permission pk_permission; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permission
    ADD CONSTRAINT pk_permission PRIMARY KEY (id);


--
-- Name: product pk_product; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT pk_product PRIMARY KEY (id);


--
-- Name: product_brand pk_product_brand; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_brand
    ADD CONSTRAINT pk_product_brand PRIMARY KEY (id);


--
-- Name: product_category pk_product_category; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_category
    ADD CONSTRAINT pk_product_category PRIMARY KEY (id);


--
-- Name: product_price_history pk_product_price_history; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_price_history
    ADD CONSTRAINT pk_product_price_history PRIMARY KEY (id);


--
-- Name: purchase_invoice pk_purchase_invoice; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_invoice
    ADD CONSTRAINT pk_purchase_invoice PRIMARY KEY (id);


--
-- Name: purchase_invoice_line pk_purchase_invoice_line; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_invoice_line
    ADD CONSTRAINT pk_purchase_invoice_line PRIMARY KEY (id);


--
-- Name: return_reason pk_return_reason; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.return_reason
    ADD CONSTRAINT pk_return_reason PRIMARY KEY (id);


--
-- Name: role pk_role; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role
    ADD CONSTRAINT pk_role PRIMARY KEY (id);


--
-- Name: role_permission pk_role_permission; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permission
    ADD CONSTRAINT pk_role_permission PRIMARY KEY (role_id, permission_id);


--
-- Name: sale_invoice pk_sale_invoice; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_invoice
    ADD CONSTRAINT pk_sale_invoice PRIMARY KEY (id);


--
-- Name: sale_invoice_line pk_sale_invoice_line; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_invoice_line
    ADD CONSTRAINT pk_sale_invoice_line PRIMARY KEY (id);


--
-- Name: sale_invoice_void pk_sale_invoice_void; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_invoice_void
    ADD CONSTRAINT pk_sale_invoice_void PRIMARY KEY (sale_invoice_id);


--
-- Name: service_category pk_service_category; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_category
    ADD CONSTRAINT pk_service_category PRIMARY KEY (id);


--
-- Name: service_order pk_service_order; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order
    ADD CONSTRAINT pk_service_order PRIMARY KEY (id);


--
-- Name: service_order_item pk_service_order_item; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_item
    ADD CONSTRAINT pk_service_order_item PRIMARY KEY (id);


--
-- Name: service_order_status_change pk_service_order_status_change; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_status_change
    ADD CONSTRAINT pk_service_order_status_change PRIMARY KEY (id);


--
-- Name: service_type pk_service_type; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_type
    ADD CONSTRAINT pk_service_type PRIMARY KEY (id);


--
-- Name: staff pk_staff; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT pk_staff PRIMARY KEY (id);


--
-- Name: staff_advance pk_staff_advance; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_advance
    ADD CONSTRAINT pk_staff_advance PRIMARY KEY (id);


--
-- Name: staff_payout pk_staff_payout; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_payout
    ADD CONSTRAINT pk_staff_payout PRIMARY KEY (id);


--
-- Name: supplier pk_supplier; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier
    ADD CONSTRAINT pk_supplier PRIMARY KEY (id);


--
-- Name: supplier_payment pk_supplier_payment; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_payment
    ADD CONSTRAINT pk_supplier_payment PRIMARY KEY (id);


--
-- Name: supplier_return pk_supplier_return; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_return
    ADD CONSTRAINT pk_supplier_return PRIMARY KEY (id);


--
-- Name: supplier_return_line pk_supplier_return_line; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_return_line
    ADD CONSTRAINT pk_supplier_return_line PRIMARY KEY (id);


--
-- Name: warranty_claim pk_warranty_claim; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warranty_claim
    ADD CONSTRAINT pk_warranty_claim PRIMARY KEY (id);


--
-- Name: ix_app_session_app_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_app_session_app_user_id ON public.app_session USING btree (app_user_id);


--
-- Name: ix_customer_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_customer_name_trgm ON public.customer USING gin (public.mirm_norm((name)::text) public.gin_trgm_ops);


--
-- Name: ix_product_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_product_name_trgm ON public.product USING gin (public.mirm_norm((name)::text) public.gin_trgm_ops);


--
-- Name: ix_service_order_item_service_type_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_service_order_item_service_type_id ON public.service_order_item USING btree (service_type_id);


--
-- Name: ix_service_type_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_service_type_name_trgm ON public.service_type USING gin (public.mirm_norm((name)::text) public.gin_trgm_ops);


--
-- Name: uq_additional_fault_id_service_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_additional_fault_id_service_order_id ON public.additional_fault USING btree (id, service_order_id);


--
-- Name: uq_additional_fault_service_order_id_fault_no; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_additional_fault_service_order_id_fault_no ON public.additional_fault USING btree (service_order_id, fault_no);


--
-- Name: uq_app_session_token_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_app_session_token_hash ON public.app_session USING btree (token_hash);


--
-- Name: uq_app_user_staff_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_app_user_staff_id ON public.app_user USING btree (staff_id);


--
-- Name: uq_app_user_username; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_app_user_username ON public.app_user USING btree (lower((username)::text));


--
-- Name: uq_cash_withdrawal_reason_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_cash_withdrawal_reason_name ON public.cash_withdrawal_reason USING btree (lower((name)::text));


--
-- Name: uq_customer_national_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_customer_national_id ON public.customer USING btree (upper((national_id)::text));


--
-- Name: uq_customer_payment_allocation_payment_invoice; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_customer_payment_allocation_payment_invoice ON public.customer_payment_allocation USING btree (customer_payment_id, sale_invoice_id);


--
-- Name: uq_customer_payment_allocation_payment_opening_balance; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_customer_payment_allocation_payment_opening_balance ON public.customer_payment_allocation USING btree (customer_payment_id, customer_opening_balance_id);


--
-- Name: uq_customer_return_credit_note_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_customer_return_credit_note_number ON public.customer_return USING btree (credit_note_number);


--
-- Name: uq_customer_return_id_sale_invoice_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_customer_return_id_sale_invoice_id ON public.customer_return USING btree (id, sale_invoice_id);


--
-- Name: uq_customer_return_line_customer_return_id_line_no; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_customer_return_line_customer_return_id_line_no ON public.customer_return_line USING btree (customer_return_id, line_no);


--
-- Name: uq_customer_return_line_id_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_customer_return_line_id_product_id ON public.customer_return_line USING btree (id, product_id);


--
-- Name: uq_customer_return_line_return_id_invoice_line_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_customer_return_line_return_id_invoice_line_id ON public.customer_return_line USING btree (customer_return_id, sale_invoice_line_id);


--
-- Name: uq_discount_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_discount_name ON public.discount USING btree (lower((name)::text));


--
-- Name: uq_inventory_movement_customer_return_line_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_inventory_movement_customer_return_line_id ON public.inventory_movement USING btree (customer_return_line_id);


--
-- Name: uq_inventory_movement_purchase_invoice_line_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_inventory_movement_purchase_invoice_line_id ON public.inventory_movement USING btree (purchase_invoice_line_id);


--
-- Name: uq_inventory_movement_sale_invoice_line_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_inventory_movement_sale_invoice_line_id ON public.inventory_movement USING btree (sale_invoice_line_id);


--
-- Name: uq_inventory_movement_supplier_return_line_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_inventory_movement_supplier_return_line_id ON public.inventory_movement USING btree (supplier_return_line_id);


--
-- Name: uq_motorcycle_brand_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_motorcycle_brand_name ON public.motorcycle_brand USING btree (lower((name)::text));


--
-- Name: uq_motorcycle_chassis_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_motorcycle_chassis_number ON public.motorcycle USING btree (upper((chassis_number)::text));


--
-- Name: uq_motorcycle_model_motorcycle_brand_id_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_motorcycle_model_motorcycle_brand_id_name ON public.motorcycle_model USING btree (motorcycle_brand_id, lower((name)::text));


--
-- Name: uq_motorcycle_plate; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_motorcycle_plate ON public.motorcycle USING btree (upper((plate)::text));


--
-- Name: uq_payment_method_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_payment_method_name ON public.payment_method USING btree (lower((name)::text));


--
-- Name: uq_permission_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_permission_code ON public.permission USING btree (code);


--
-- Name: uq_product_barcode; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_product_barcode ON public.product USING btree (barcode);


--
-- Name: uq_product_brand_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_product_brand_name ON public.product_brand USING btree (lower((name)::text));


--
-- Name: uq_product_category_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_product_category_name ON public.product_category USING btree (lower((name)::text));


--
-- Name: uq_product_price_history_product_id_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_product_price_history_product_id_changed_at ON public.product_price_history USING btree (product_id, changed_at);


--
-- Name: uq_purchase_invoice_id_supplier_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_purchase_invoice_id_supplier_id ON public.purchase_invoice USING btree (id, supplier_id);


--
-- Name: uq_purchase_invoice_line_id_invoice_id_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_purchase_invoice_line_id_invoice_id_product_id ON public.purchase_invoice_line USING btree (id, purchase_invoice_id, product_id);


--
-- Name: uq_purchase_invoice_line_id_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_purchase_invoice_line_id_product_id ON public.purchase_invoice_line USING btree (id, product_id);


--
-- Name: uq_purchase_invoice_line_purchase_invoice_id_line_no; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_purchase_invoice_line_purchase_invoice_id_line_no ON public.purchase_invoice_line USING btree (purchase_invoice_id, line_no);


--
-- Name: uq_purchase_invoice_supplier_id_invoice_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_purchase_invoice_supplier_id_invoice_number ON public.purchase_invoice USING btree (supplier_id, invoice_number);


--
-- Name: uq_return_reason_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_return_reason_name ON public.return_reason USING btree (lower((name)::text));


--
-- Name: uq_role_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_role_name ON public.role USING btree (lower((name)::text));


--
-- Name: uq_sale_invoice_id_service_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_sale_invoice_id_service_order_id ON public.sale_invoice USING btree (id, service_order_id);


--
-- Name: uq_sale_invoice_invoice_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_sale_invoice_invoice_number ON public.sale_invoice USING btree (invoice_number);


--
-- Name: uq_sale_invoice_line_id_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_sale_invoice_line_id_product_id ON public.sale_invoice_line USING btree (id, product_id);


--
-- Name: uq_sale_invoice_line_id_sale_invoice_id_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_sale_invoice_line_id_sale_invoice_id_product_id ON public.sale_invoice_line USING btree (id, sale_invoice_id, product_id);


--
-- Name: uq_sale_invoice_line_sale_invoice_id_line_no; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_sale_invoice_line_sale_invoice_id_line_no ON public.sale_invoice_line USING btree (sale_invoice_id, line_no);


--
-- Name: uq_sale_invoice_service_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_sale_invoice_service_order_id ON public.sale_invoice USING btree (service_order_id);


--
-- Name: uq_sale_invoice_void_customer_return_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_sale_invoice_void_customer_return_id ON public.sale_invoice_void USING btree (customer_return_id);


--
-- Name: uq_service_category_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_service_category_name ON public.service_category USING btree (lower((name)::text));


--
-- Name: uq_service_order_item_order_type; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_service_order_item_order_type ON public.service_order_item USING btree (service_order_id, service_type_id);


--
-- Name: uq_service_order_status_change_service_order_id_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_service_order_status_change_service_order_id_changed_at ON public.service_order_status_change USING btree (service_order_id, changed_at);


--
-- Name: uq_service_type_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_service_type_name ON public.service_type USING btree (lower((name)::text));


--
-- Name: uq_staff_payout_id_staff_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_staff_payout_id_staff_id ON public.staff_payout USING btree (id, staff_id);


--
-- Name: uq_staff_payout_staff_id_period_start; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_staff_payout_staff_id_period_start ON public.staff_payout USING btree (staff_id, period_start);


--
-- Name: uq_supplier_return_id_purchase_invoice_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_supplier_return_id_purchase_invoice_id ON public.supplier_return USING btree (id, purchase_invoice_id);


--
-- Name: uq_supplier_return_line_id_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_supplier_return_line_id_product_id ON public.supplier_return_line USING btree (id, product_id);


--
-- Name: uq_supplier_return_line_return_id_invoice_line_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_supplier_return_line_return_id_invoice_line_id ON public.supplier_return_line USING btree (supplier_return_id, purchase_invoice_line_id);


--
-- Name: uq_supplier_return_line_supplier_return_id_line_no; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_supplier_return_line_supplier_return_id_line_no ON public.supplier_return_line USING btree (supplier_return_id, line_no);


--
-- Name: uq_warranty_claim_new_service_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_warranty_claim_new_service_order_id ON public.warranty_claim USING btree (new_service_order_id);


--
-- Name: uq_warranty_claim_part_sale_invoice_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_warranty_claim_part_sale_invoice_id ON public.warranty_claim USING btree (part_sale_invoice_id);


--
-- Name: customer_payment_allocation tg_customer_payment_allocation_not_voided; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_customer_payment_allocation_not_voided BEFORE INSERT ON public.customer_payment_allocation FOR EACH ROW EXECUTE FUNCTION public.fn_sale_invoice_not_voided();


--
-- Name: customer_return tg_customer_return_not_voided; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_customer_return_not_voided BEFORE INSERT ON public.customer_return FOR EACH ROW EXECUTE FUNCTION public.fn_sale_invoice_not_voided();


--
-- Name: inventory_movement tg_inventory_movement_append_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_inventory_movement_append_only BEFORE DELETE OR UPDATE ON public.inventory_movement FOR EACH ROW EXECUTE FUNCTION public.fn_inventory_movement_append_only();


--
-- Name: inventory_movement tg_inventory_movement_apply_stock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_inventory_movement_apply_stock AFTER INSERT ON public.inventory_movement FOR EACH ROW EXECUTE FUNCTION public.fn_inventory_movement_apply_stock();


--
-- Name: product tg_product_guard_stock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_product_guard_stock BEFORE INSERT OR UPDATE ON public.product FOR EACH ROW EXECUTE FUNCTION public.fn_product_guard_stock();


--
-- Name: sale_invoice_line tg_sale_invoice_line_min_price; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_sale_invoice_line_min_price BEFORE INSERT OR UPDATE OF quantity, unit_price, discount_amount, product_id ON public.sale_invoice_line FOR EACH ROW EXECUTE FUNCTION public.fn_sale_invoice_line_min_price();


--
-- Name: sale_invoice_void tg_sale_invoice_void_check; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_sale_invoice_void_check BEFORE INSERT OR DELETE OR UPDATE ON public.sale_invoice_void FOR EACH ROW EXECUTE FUNCTION public.fn_sale_invoice_void_check();


--
-- Name: service_order tg_service_order_check_responsible; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_service_order_check_responsible BEFORE INSERT OR UPDATE OF mechanic_staff_id, applied_commission_rate ON public.service_order FOR EACH ROW EXECUTE FUNCTION public.fn_service_order_check_responsible();


--
-- Name: service_order tg_service_order_has_items; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER tg_service_order_has_items AFTER INSERT ON public.service_order DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.fn_service_order_has_items();


--
-- Name: service_order_item tg_service_order_item_keep_one; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER tg_service_order_item_keep_one AFTER DELETE OR UPDATE OF service_order_id ON public.service_order_item DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.fn_service_order_has_items();


--
-- Name: service_order_status_change tg_service_order_status_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tg_service_order_status_guard BEFORE INSERT ON public.service_order_status_change FOR EACH ROW EXECUTE FUNCTION public.fn_service_order_status_guard();


--
-- Name: additional_fault fk_additional_fault_service_order_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.additional_fault
    ADD CONSTRAINT fk_additional_fault_service_order_id FOREIGN KEY (service_order_id) REFERENCES public.service_order(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: app_session fk_app_session_app_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_session
    ADD CONSTRAINT fk_app_session_app_user_id FOREIGN KEY (app_user_id) REFERENCES public.app_user(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: app_user fk_app_user_role_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT fk_app_user_role_id FOREIGN KEY (role_id) REFERENCES public.role(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: app_user fk_app_user_staff_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT fk_app_user_staff_id FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: cash_withdrawal fk_cash_withdrawal_cash_withdrawal_reason_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_withdrawal
    ADD CONSTRAINT fk_cash_withdrawal_cash_withdrawal_reason_id FOREIGN KEY (cash_withdrawal_reason_id) REFERENCES public.cash_withdrawal_reason(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: cash_withdrawal fk_cash_withdrawal_withdrawn_by_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_withdrawal
    ADD CONSTRAINT fk_cash_withdrawal_withdrawn_by_user_id FOREIGN KEY (withdrawn_by_user_id) REFERENCES public.app_user(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: customer_opening_balance fk_customer_opening_balance_customer_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_opening_balance
    ADD CONSTRAINT fk_customer_opening_balance_customer_id FOREIGN KEY (customer_id) REFERENCES public.customer(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: customer_opening_balance fk_customer_opening_balance_registered_by_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_opening_balance
    ADD CONSTRAINT fk_customer_opening_balance_registered_by_user_id FOREIGN KEY (registered_by_user_id) REFERENCES public.app_user(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: customer_payment_allocation fk_customer_payment_allocation_customer_opening_balance_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_payment_allocation
    ADD CONSTRAINT fk_customer_payment_allocation_customer_opening_balance_id FOREIGN KEY (customer_opening_balance_id) REFERENCES public.customer_opening_balance(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: customer_payment_allocation fk_customer_payment_allocation_customer_payment_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_payment_allocation
    ADD CONSTRAINT fk_customer_payment_allocation_customer_payment_id FOREIGN KEY (customer_payment_id) REFERENCES public.customer_payment(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: customer_payment_allocation fk_customer_payment_allocation_sale_invoice_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_payment_allocation
    ADD CONSTRAINT fk_customer_payment_allocation_sale_invoice_id FOREIGN KEY (sale_invoice_id) REFERENCES public.sale_invoice(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: customer_payment fk_customer_payment_payment_method_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_payment
    ADD CONSTRAINT fk_customer_payment_payment_method_id FOREIGN KEY (payment_method_id) REFERENCES public.payment_method(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: customer_payment fk_customer_payment_received_by_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_payment
    ADD CONSTRAINT fk_customer_payment_received_by_user_id FOREIGN KEY (received_by_user_id) REFERENCES public.app_user(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: customer_return_line fk_customer_return_line_customer_return; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_return_line
    ADD CONSTRAINT fk_customer_return_line_customer_return FOREIGN KEY (customer_return_id, sale_invoice_id) REFERENCES public.customer_return(id, sale_invoice_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: customer_return_line fk_customer_return_line_sale_invoice_line; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_return_line
    ADD CONSTRAINT fk_customer_return_line_sale_invoice_line FOREIGN KEY (sale_invoice_line_id, sale_invoice_id, product_id) REFERENCES public.sale_invoice_line(id, sale_invoice_id, product_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: customer_return fk_customer_return_registered_by_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_return
    ADD CONSTRAINT fk_customer_return_registered_by_user_id FOREIGN KEY (registered_by_user_id) REFERENCES public.app_user(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: customer_return fk_customer_return_return_reason_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_return
    ADD CONSTRAINT fk_customer_return_return_reason_id FOREIGN KEY (return_reason_id) REFERENCES public.return_reason(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: customer_return fk_customer_return_sale_invoice_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_return
    ADD CONSTRAINT fk_customer_return_sale_invoice_id FOREIGN KEY (sale_invoice_id) REFERENCES public.sale_invoice(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_movement fk_inventory_movement_customer_return_line; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movement
    ADD CONSTRAINT fk_inventory_movement_customer_return_line FOREIGN KEY (customer_return_line_id, product_id) REFERENCES public.customer_return_line(id, product_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_movement fk_inventory_movement_product_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movement
    ADD CONSTRAINT fk_inventory_movement_product_id FOREIGN KEY (product_id) REFERENCES public.product(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_movement fk_inventory_movement_purchase_invoice_line; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movement
    ADD CONSTRAINT fk_inventory_movement_purchase_invoice_line FOREIGN KEY (purchase_invoice_line_id, product_id) REFERENCES public.purchase_invoice_line(id, product_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_movement fk_inventory_movement_registered_by_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movement
    ADD CONSTRAINT fk_inventory_movement_registered_by_user_id FOREIGN KEY (registered_by_user_id) REFERENCES public.app_user(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_movement fk_inventory_movement_sale_invoice_line; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movement
    ADD CONSTRAINT fk_inventory_movement_sale_invoice_line FOREIGN KEY (sale_invoice_line_id, product_id) REFERENCES public.sale_invoice_line(id, product_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_movement fk_inventory_movement_supplier_return_line; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movement
    ADD CONSTRAINT fk_inventory_movement_supplier_return_line FOREIGN KEY (supplier_return_line_id, product_id) REFERENCES public.supplier_return_line(id, product_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_movement fk_inventory_movement_warranty_claim_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movement
    ADD CONSTRAINT fk_inventory_movement_warranty_claim_id FOREIGN KEY (warranty_claim_id) REFERENCES public.warranty_claim(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: motorcycle fk_motorcycle_customer_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.motorcycle
    ADD CONSTRAINT fk_motorcycle_customer_id FOREIGN KEY (customer_id) REFERENCES public.customer(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: motorcycle_model fk_motorcycle_model_motorcycle_brand_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.motorcycle_model
    ADD CONSTRAINT fk_motorcycle_model_motorcycle_brand_id FOREIGN KEY (motorcycle_brand_id) REFERENCES public.motorcycle_brand(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: motorcycle fk_motorcycle_motorcycle_model_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.motorcycle
    ADD CONSTRAINT fk_motorcycle_motorcycle_model_id FOREIGN KEY (motorcycle_model_id) REFERENCES public.motorcycle_model(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: product_price_history fk_product_price_history_changed_by_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_price_history
    ADD CONSTRAINT fk_product_price_history_changed_by_user_id FOREIGN KEY (changed_by_user_id) REFERENCES public.app_user(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: product_price_history fk_product_price_history_product_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_price_history
    ADD CONSTRAINT fk_product_price_history_product_id FOREIGN KEY (product_id) REFERENCES public.product(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: product fk_product_product_brand_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT fk_product_product_brand_id FOREIGN KEY (product_brand_id) REFERENCES public.product_brand(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: product fk_product_product_category_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT fk_product_product_category_id FOREIGN KEY (product_category_id) REFERENCES public.product_category(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_invoice_line fk_purchase_invoice_line_product_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_invoice_line
    ADD CONSTRAINT fk_purchase_invoice_line_product_id FOREIGN KEY (product_id) REFERENCES public.product(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_invoice_line fk_purchase_invoice_line_purchase_invoice_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_invoice_line
    ADD CONSTRAINT fk_purchase_invoice_line_purchase_invoice_id FOREIGN KEY (purchase_invoice_id) REFERENCES public.purchase_invoice(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_invoice fk_purchase_invoice_received_by_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_invoice
    ADD CONSTRAINT fk_purchase_invoice_received_by_user_id FOREIGN KEY (received_by_user_id) REFERENCES public.app_user(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_invoice fk_purchase_invoice_supplier_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_invoice
    ADD CONSTRAINT fk_purchase_invoice_supplier_id FOREIGN KEY (supplier_id) REFERENCES public.supplier(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: role_permission fk_role_permission_permission_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permission
    ADD CONSTRAINT fk_role_permission_permission_id FOREIGN KEY (permission_id) REFERENCES public.permission(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: role_permission fk_role_permission_role_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permission
    ADD CONSTRAINT fk_role_permission_role_id FOREIGN KEY (role_id) REFERENCES public.role(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sale_invoice fk_sale_invoice_created_by_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_invoice
    ADD CONSTRAINT fk_sale_invoice_created_by_user_id FOREIGN KEY (created_by_user_id) REFERENCES public.app_user(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sale_invoice fk_sale_invoice_credit_authorized_by_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_invoice
    ADD CONSTRAINT fk_sale_invoice_credit_authorized_by_user_id FOREIGN KEY (credit_authorized_by_user_id) REFERENCES public.app_user(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sale_invoice fk_sale_invoice_customer_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_invoice
    ADD CONSTRAINT fk_sale_invoice_customer_id FOREIGN KEY (customer_id) REFERENCES public.customer(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sale_invoice_line fk_sale_invoice_line_additional_fault_id_service_order_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_invoice_line
    ADD CONSTRAINT fk_sale_invoice_line_additional_fault_id_service_order_id FOREIGN KEY (additional_fault_id, service_order_id) REFERENCES public.additional_fault(id, service_order_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sale_invoice_line fk_sale_invoice_line_discount_authorized_by_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_invoice_line
    ADD CONSTRAINT fk_sale_invoice_line_discount_authorized_by_user_id FOREIGN KEY (discount_authorized_by_user_id) REFERENCES public.app_user(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sale_invoice_line fk_sale_invoice_line_discount_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_invoice_line
    ADD CONSTRAINT fk_sale_invoice_line_discount_id FOREIGN KEY (discount_id) REFERENCES public.discount(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sale_invoice_line fk_sale_invoice_line_product_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_invoice_line
    ADD CONSTRAINT fk_sale_invoice_line_product_id FOREIGN KEY (product_id) REFERENCES public.product(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sale_invoice_line fk_sale_invoice_line_sale_invoice_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_invoice_line
    ADD CONSTRAINT fk_sale_invoice_line_sale_invoice_id FOREIGN KEY (sale_invoice_id) REFERENCES public.sale_invoice(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sale_invoice_line fk_sale_invoice_line_sale_invoice_id_service_order_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_invoice_line
    ADD CONSTRAINT fk_sale_invoice_line_sale_invoice_id_service_order_id FOREIGN KEY (sale_invoice_id, service_order_id) REFERENCES public.sale_invoice(id, service_order_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sale_invoice_line fk_sale_invoice_line_service_type_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_invoice_line
    ADD CONSTRAINT fk_sale_invoice_line_service_type_id FOREIGN KEY (service_type_id) REFERENCES public.service_type(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sale_invoice fk_sale_invoice_service_order_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_invoice
    ADD CONSTRAINT fk_sale_invoice_service_order_id FOREIGN KEY (service_order_id) REFERENCES public.service_order(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sale_invoice_void fk_sale_invoice_void_customer_return; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_invoice_void
    ADD CONSTRAINT fk_sale_invoice_void_customer_return FOREIGN KEY (customer_return_id, sale_invoice_id) REFERENCES public.customer_return(id, sale_invoice_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sale_invoice_void fk_sale_invoice_void_sale_invoice_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_invoice_void
    ADD CONSTRAINT fk_sale_invoice_void_sale_invoice_id FOREIGN KEY (sale_invoice_id) REFERENCES public.sale_invoice(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: sale_invoice_void fk_sale_invoice_void_voided_by_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_invoice_void
    ADD CONSTRAINT fk_sale_invoice_void_voided_by_user_id FOREIGN KEY (voided_by_user_id) REFERENCES public.app_user(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: service_order_item fk_service_order_item_service_order_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_item
    ADD CONSTRAINT fk_service_order_item_service_order_id FOREIGN KEY (service_order_id) REFERENCES public.service_order(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: service_order_item fk_service_order_item_service_type_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_item
    ADD CONSTRAINT fk_service_order_item_service_type_id FOREIGN KEY (service_type_id) REFERENCES public.service_type(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: service_order fk_service_order_mechanic_staff_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order
    ADD CONSTRAINT fk_service_order_mechanic_staff_id FOREIGN KEY (mechanic_staff_id) REFERENCES public.staff(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: service_order fk_service_order_motorcycle_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order
    ADD CONSTRAINT fk_service_order_motorcycle_id FOREIGN KEY (motorcycle_id) REFERENCES public.motorcycle(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: service_order fk_service_order_staff_payout_id_mechanic_staff_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order
    ADD CONSTRAINT fk_service_order_staff_payout_id_mechanic_staff_id FOREIGN KEY (staff_payout_id, mechanic_staff_id) REFERENCES public.staff_payout(id, staff_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: service_order_status_change fk_service_order_status_change_registered_by_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_status_change
    ADD CONSTRAINT fk_service_order_status_change_registered_by_user_id FOREIGN KEY (registered_by_user_id) REFERENCES public.app_user(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: service_order_status_change fk_service_order_status_change_service_order_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_order_status_change
    ADD CONSTRAINT fk_service_order_status_change_service_order_id FOREIGN KEY (service_order_id) REFERENCES public.service_order(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: service_type fk_service_type_service_category_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_type
    ADD CONSTRAINT fk_service_type_service_category_id FOREIGN KEY (service_category_id) REFERENCES public.service_category(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: staff_advance fk_staff_advance_given_by_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_advance
    ADD CONSTRAINT fk_staff_advance_given_by_user_id FOREIGN KEY (given_by_user_id) REFERENCES public.app_user(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: staff_advance fk_staff_advance_staff_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_advance
    ADD CONSTRAINT fk_staff_advance_staff_id FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: staff_advance fk_staff_advance_staff_payout_id_staff_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_advance
    ADD CONSTRAINT fk_staff_advance_staff_payout_id_staff_id FOREIGN KEY (staff_payout_id, staff_id) REFERENCES public.staff_payout(id, staff_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: staff_payout fk_staff_payout_paid_by_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_payout
    ADD CONSTRAINT fk_staff_payout_paid_by_user_id FOREIGN KEY (paid_by_user_id) REFERENCES public.app_user(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: staff_payout fk_staff_payout_staff_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_payout
    ADD CONSTRAINT fk_staff_payout_staff_id FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: supplier_payment fk_supplier_payment_purchase_invoice_id_supplier_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_payment
    ADD CONSTRAINT fk_supplier_payment_purchase_invoice_id_supplier_id FOREIGN KEY (purchase_invoice_id, supplier_id) REFERENCES public.purchase_invoice(id, supplier_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: supplier_payment fk_supplier_payment_supplier_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_payment
    ADD CONSTRAINT fk_supplier_payment_supplier_id FOREIGN KEY (supplier_id) REFERENCES public.supplier(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: supplier_return_line fk_supplier_return_line_purchase_invoice_line; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_return_line
    ADD CONSTRAINT fk_supplier_return_line_purchase_invoice_line FOREIGN KEY (purchase_invoice_line_id, purchase_invoice_id, product_id) REFERENCES public.purchase_invoice_line(id, purchase_invoice_id, product_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: supplier_return_line fk_supplier_return_line_supplier_return; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_return_line
    ADD CONSTRAINT fk_supplier_return_line_supplier_return FOREIGN KEY (supplier_return_id, purchase_invoice_id) REFERENCES public.supplier_return(id, purchase_invoice_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: supplier_return fk_supplier_return_purchase_invoice_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_return
    ADD CONSTRAINT fk_supplier_return_purchase_invoice_id FOREIGN KEY (purchase_invoice_id) REFERENCES public.purchase_invoice(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: supplier_return fk_supplier_return_registered_by_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_return
    ADD CONSTRAINT fk_supplier_return_registered_by_user_id FOREIGN KEY (registered_by_user_id) REFERENCES public.app_user(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: supplier_return fk_supplier_return_return_reason_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supplier_return
    ADD CONSTRAINT fk_supplier_return_return_reason_id FOREIGN KEY (return_reason_id) REFERENCES public.return_reason(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: warranty_claim fk_warranty_claim_attended_by_user_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warranty_claim
    ADD CONSTRAINT fk_warranty_claim_attended_by_user_id FOREIGN KEY (attended_by_user_id) REFERENCES public.app_user(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: warranty_claim fk_warranty_claim_new_service_order_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warranty_claim
    ADD CONSTRAINT fk_warranty_claim_new_service_order_id FOREIGN KEY (new_service_order_id) REFERENCES public.service_order(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: warranty_claim fk_warranty_claim_original_service_order_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warranty_claim
    ADD CONSTRAINT fk_warranty_claim_original_service_order_id FOREIGN KEY (original_service_order_id) REFERENCES public.service_order(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: warranty_claim fk_warranty_claim_part_sale_invoice_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.warranty_claim
    ADD CONSTRAINT fk_warranty_claim_part_sale_invoice_id FOREIGN KEY (part_sale_invoice_id) REFERENCES public.sale_invoice(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--


