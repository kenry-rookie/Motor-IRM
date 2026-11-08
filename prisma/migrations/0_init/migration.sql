-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "role" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" VARCHAR(200),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "pk_role" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "description" VARCHAR(200),

    CONSTRAINT "pk_permission" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permission" (
    "role_id" INTEGER NOT NULL,
    "permission_id" INTEGER NOT NULL,

    CONSTRAINT "pk_role_permission" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "staff" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "commission_rate" DECIMAL(5,4),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "pk_staff" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_user" (
    "id" SERIAL NOT NULL,
    "role_id" INTEGER NOT NULL,
    "staff_id" INTEGER,
    "username" VARCHAR(30) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT LOCALTIMESTAMP(0),
    "last_login_at" TIMESTAMP(0),

    CONSTRAINT "pk_app_user" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_reason" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "pk_return_reason" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_method" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "pk_payment_method" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_withdrawal_reason" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "pk_cash_withdrawal_reason" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "discount_type" VARCHAR(20) NOT NULL,
    "value" DECIMAL(12,4) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "pk_discount" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_type" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "reference_price" DECIMAL(12,2),
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "pk_service_type" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "national_id" VARCHAR(20),
    "address" VARCHAR(200),

    CONSTRAINT "pk_customer" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "motorcycle_brand" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,

    CONSTRAINT "pk_motorcycle_brand" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "motorcycle_model" (
    "id" SERIAL NOT NULL,
    "motorcycle_brand_id" INTEGER NOT NULL,
    "name" VARCHAR(50) NOT NULL,

    CONSTRAINT "pk_motorcycle_model" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "motorcycle" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "motorcycle_model_id" INTEGER NOT NULL,
    "color" VARCHAR(30) NOT NULL,
    "plate" VARCHAR(15),
    "notes" VARCHAR(200),

    CONSTRAINT "pk_motorcycle" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_category" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,

    CONSTRAINT "pk_product_category" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_brand" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,

    CONSTRAINT "pk_product_brand" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product" (
    "id" SERIAL NOT NULL,
    "product_category_id" INTEGER NOT NULL,
    "product_brand_id" INTEGER NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "barcode" VARCHAR(50),
    "quality_tier" VARCHAR(20) NOT NULL,
    "list_price" DECIMAL(12,2) NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "pk_product" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_price_history" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "changed_at" TIMESTAMP(6) NOT NULL DEFAULT clock_timestamp(),
    "new_price" DECIMAL(12,2) NOT NULL,
    "changed_by_user_id" INTEGER,

    CONSTRAINT "pk_product_price_history" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_payout" (
    "id" SERIAL NOT NULL,
    "staff_id" INTEGER NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "paid_on" DATE,
    "paid_by_user_id" INTEGER,

    CONSTRAINT "pk_staff_payout" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_advance" (
    "id" SERIAL NOT NULL,
    "staff_id" INTEGER NOT NULL,
    "given_on" DATE NOT NULL DEFAULT CURRENT_DATE,
    "amount" DECIMAL(12,2) NOT NULL,
    "given_by_user_id" INTEGER NOT NULL,
    "staff_payout_id" INTEGER,

    CONSTRAINT "pk_staff_advance" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_withdrawal" (
    "id" SERIAL NOT NULL,
    "withdrawn_by_user_id" INTEGER NOT NULL,
    "cash_withdrawal_reason_id" INTEGER NOT NULL,
    "withdrawn_on" DATE NOT NULL DEFAULT CURRENT_DATE,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" VARCHAR(200),

    CONSTRAINT "pk_cash_withdrawal" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_invoice" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER,
    "created_by_user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(0) NOT NULL DEFAULT LOCALTIMESTAMP(0),
    "invoice_number" VARCHAR(20),
    "payment_terms" VARCHAR(20) NOT NULL,
    "due_date" DATE,
    "extended_due_date" DATE,
    "monthly_interest" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "credit_authorized_by_user_id" INTEGER,
    "notes" VARCHAR(200),

    CONSTRAINT "pk_sale_invoice" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_invoice_line" (
    "id" SERIAL NOT NULL,
    "sale_invoice_id" INTEGER NOT NULL,
    "line_no" SMALLINT NOT NULL,
    "line_type" VARCHAR(20) NOT NULL,
    "product_id" INTEGER,
    "service_type_id" INTEGER,
    "description" VARCHAR(200),
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "discount_id" INTEGER,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount_authorized_by_user_id" INTEGER,
    "additional_fault_id" INTEGER,

    CONSTRAINT "pk_sale_invoice_line" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_return" (
    "id" SERIAL NOT NULL,
    "sale_invoice_id" INTEGER NOT NULL,
    "returned_at" TIMESTAMP(0) NOT NULL DEFAULT LOCALTIMESTAMP(0),
    "credit_note_number" VARCHAR(20),
    "return_reason_id" INTEGER NOT NULL,
    "registered_by_user_id" INTEGER NOT NULL,
    "notes" VARCHAR(200),

    CONSTRAINT "pk_customer_return" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_return_line" (
    "id" SERIAL NOT NULL,
    "customer_return_id" INTEGER NOT NULL,
    "sale_invoice_id" INTEGER NOT NULL,
    "line_no" SMALLINT NOT NULL,
    "sale_invoice_line_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "pk_customer_return_line" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_opening_balance" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "as_of_date" DATE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "due_date" DATE NOT NULL,
    "monthly_interest" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "registered_by_user_id" INTEGER NOT NULL,
    "notes" VARCHAR(200),

    CONSTRAINT "pk_customer_opening_balance" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_order" (
    "id" INTEGER NOT NULL,
    "motorcycle_id" INTEGER NOT NULL,
    "mechanic_staff_id" INTEGER,
    "requested_work" VARCHAR(500) NOT NULL,
    "diagnosis" VARCHAR(500),
    "cancellation_fee" DECIMAL(12,2),
    "applied_commission_rate" DECIMAL(5,4),
    "staff_payout_id" INTEGER,

    CONSTRAINT "pk_service_order" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_order_status_change" (
    "id" SERIAL NOT NULL,
    "service_order_id" INTEGER NOT NULL,
    "changed_at" TIMESTAMP(6) NOT NULL DEFAULT clock_timestamp(),
    "status" VARCHAR(20) NOT NULL,
    "notes" VARCHAR(200),
    "registered_by_user_id" INTEGER NOT NULL,

    CONSTRAINT "pk_service_order_status_change" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "additional_fault" (
    "id" SERIAL NOT NULL,
    "service_order_id" INTEGER NOT NULL,
    "fault_no" SMALLINT NOT NULL,
    "reported_on" DATE NOT NULL DEFAULT CURRENT_DATE,
    "description" VARCHAR(500) NOT NULL,
    "proposed_price" DECIMAL(12,2),
    "decision" VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',

    CONSTRAINT "pk_additional_fault" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warranty_claim" (
    "id" SERIAL NOT NULL,
    "original_service_order_id" INTEGER NOT NULL,
    "claimed_on" DATE NOT NULL DEFAULT CURRENT_DATE,
    "description" VARCHAR(500) NOT NULL,
    "outcome" VARCHAR(20) NOT NULL,
    "part_paid_by" VARCHAR(20),
    "refund_amount" DECIMAL(12,2),
    "attended_by_user_id" INTEGER NOT NULL,
    "new_service_order_id" INTEGER,
    "part_sale_invoice_id" INTEGER,

    CONSTRAINT "pk_warranty_claim" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_payment" (
    "id" SERIAL NOT NULL,
    "paid_at" TIMESTAMP(0) NOT NULL DEFAULT LOCALTIMESTAMP(0),
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'NIO',
    "exchange_rate" DECIMAL(10,4),
    "payment_method_id" INTEGER NOT NULL,
    "received_by_user_id" INTEGER NOT NULL,

    CONSTRAINT "pk_customer_payment" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_payment_allocation" (
    "id" SERIAL NOT NULL,
    "customer_payment_id" INTEGER NOT NULL,
    "sale_invoice_id" INTEGER,
    "customer_opening_balance_id" INTEGER,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "pk_customer_payment_allocation" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(20),
    "contact_person" VARCHAR(100),
    "gives_warranty" BOOLEAN,
    "opening_balance" DECIMAL(12,2),
    "opening_date" DATE,

    CONSTRAINT "pk_supplier" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_invoice" (
    "id" SERIAL NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "invoice_number" VARCHAR(30) NOT NULL,
    "purchase_date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "payment_terms" VARCHAR(20) NOT NULL,
    "due_date" DATE,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "received_by_user_id" INTEGER NOT NULL,

    CONSTRAINT "pk_purchase_invoice" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_invoice_line" (
    "id" SERIAL NOT NULL,
    "purchase_invoice_id" INTEGER NOT NULL,
    "line_no" SMALLINT NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_cost" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "pk_purchase_invoice_line" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_return" (
    "id" SERIAL NOT NULL,
    "purchase_invoice_id" INTEGER NOT NULL,
    "returned_on" DATE NOT NULL DEFAULT CURRENT_DATE,
    "return_reason_id" INTEGER NOT NULL,
    "resolution" VARCHAR(20) NOT NULL,
    "registered_by_user_id" INTEGER NOT NULL,

    CONSTRAINT "pk_supplier_return" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_return_line" (
    "id" SERIAL NOT NULL,
    "supplier_return_id" INTEGER NOT NULL,
    "purchase_invoice_id" INTEGER NOT NULL,
    "line_no" SMALLINT NOT NULL,
    "purchase_invoice_line_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "pk_supplier_return_line" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_payment" (
    "id" SERIAL NOT NULL,
    "supplier_id" INTEGER NOT NULL,
    "purchase_invoice_id" INTEGER,
    "paid_on" DATE NOT NULL DEFAULT CURRENT_DATE,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'NIO',
    "exchange_rate" DECIMAL(10,4),

    CONSTRAINT "pk_supplier_payment" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movement" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "moved_at" TIMESTAMP(0) NOT NULL DEFAULT LOCALTIMESTAMP(0),
    "movement_type" VARCHAR(25) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_cost" DECIMAL(12,2) NOT NULL,
    "notes" VARCHAR(200),
    "registered_by_user_id" INTEGER NOT NULL,
    "sale_invoice_line_id" INTEGER,
    "customer_return_line_id" INTEGER,
    "purchase_invoice_line_id" INTEGER,
    "supplier_return_line_id" INTEGER,
    "warranty_claim_id" INTEGER,

    CONSTRAINT "pk_inventory_movement" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_permission_code" ON "permission"("code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_app_user_staff_id" ON "app_user"("staff_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_product_barcode" ON "product"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "uq_product_price_history_product_id_changed_at" ON "product_price_history"("product_id", "changed_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_staff_payout_staff_id_period_start" ON "staff_payout"("staff_id", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "uq_staff_payout_id_staff_id" ON "staff_payout"("id", "staff_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_sale_invoice_invoice_number" ON "sale_invoice"("invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX "uq_sale_invoice_line_sale_invoice_id_line_no" ON "sale_invoice_line"("sale_invoice_id", "line_no");

-- CreateIndex
CREATE UNIQUE INDEX "uq_sale_invoice_line_id_product_id" ON "sale_invoice_line"("id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_sale_invoice_line_id_sale_invoice_id_product_id" ON "sale_invoice_line"("id", "sale_invoice_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_customer_return_credit_note_number" ON "customer_return"("credit_note_number");

-- CreateIndex
CREATE UNIQUE INDEX "uq_customer_return_id_sale_invoice_id" ON "customer_return"("id", "sale_invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_customer_return_line_customer_return_id_line_no" ON "customer_return_line"("customer_return_id", "line_no");

-- CreateIndex
CREATE UNIQUE INDEX "uq_customer_return_line_return_id_invoice_line_id" ON "customer_return_line"("customer_return_id", "sale_invoice_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_customer_return_line_id_product_id" ON "customer_return_line"("id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_service_order_status_change_service_order_id_changed_at" ON "service_order_status_change"("service_order_id", "changed_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_additional_fault_service_order_id_fault_no" ON "additional_fault"("service_order_id", "fault_no");

-- CreateIndex
CREATE UNIQUE INDEX "uq_additional_fault_id_service_order_id" ON "additional_fault"("id", "service_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_warranty_claim_new_service_order_id" ON "warranty_claim"("new_service_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_warranty_claim_part_sale_invoice_id" ON "warranty_claim"("part_sale_invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_customer_payment_allocation_payment_invoice" ON "customer_payment_allocation"("customer_payment_id", "sale_invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_customer_payment_allocation_payment_opening_balance" ON "customer_payment_allocation"("customer_payment_id", "customer_opening_balance_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_purchase_invoice_supplier_id_invoice_number" ON "purchase_invoice"("supplier_id", "invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX "uq_purchase_invoice_id_supplier_id" ON "purchase_invoice"("id", "supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_purchase_invoice_line_purchase_invoice_id_line_no" ON "purchase_invoice_line"("purchase_invoice_id", "line_no");

-- CreateIndex
CREATE UNIQUE INDEX "uq_purchase_invoice_line_id_product_id" ON "purchase_invoice_line"("id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_purchase_invoice_line_id_invoice_id_product_id" ON "purchase_invoice_line"("id", "purchase_invoice_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_supplier_return_id_purchase_invoice_id" ON "supplier_return"("id", "purchase_invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_supplier_return_line_supplier_return_id_line_no" ON "supplier_return_line"("supplier_return_id", "line_no");

-- CreateIndex
CREATE UNIQUE INDEX "uq_supplier_return_line_return_id_invoice_line_id" ON "supplier_return_line"("supplier_return_id", "purchase_invoice_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_supplier_return_line_id_product_id" ON "supplier_return_line"("id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_inventory_movement_sale_invoice_line_id" ON "inventory_movement"("sale_invoice_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_inventory_movement_customer_return_line_id" ON "inventory_movement"("customer_return_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_inventory_movement_purchase_invoice_line_id" ON "inventory_movement"("purchase_invoice_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_inventory_movement_supplier_return_line_id" ON "inventory_movement"("supplier_return_line_id");

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "fk_role_permission_role_id" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "fk_role_permission_permission_id" FOREIGN KEY ("permission_id") REFERENCES "permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_user" ADD CONSTRAINT "fk_app_user_role_id" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_user" ADD CONSTRAINT "fk_app_user_staff_id" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "motorcycle_model" ADD CONSTRAINT "fk_motorcycle_model_motorcycle_brand_id" FOREIGN KEY ("motorcycle_brand_id") REFERENCES "motorcycle_brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "motorcycle" ADD CONSTRAINT "fk_motorcycle_customer_id" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "motorcycle" ADD CONSTRAINT "fk_motorcycle_motorcycle_model_id" FOREIGN KEY ("motorcycle_model_id") REFERENCES "motorcycle_model"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "fk_product_product_category_id" FOREIGN KEY ("product_category_id") REFERENCES "product_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "fk_product_product_brand_id" FOREIGN KEY ("product_brand_id") REFERENCES "product_brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_price_history" ADD CONSTRAINT "fk_product_price_history_product_id" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_price_history" ADD CONSTRAINT "fk_product_price_history_changed_by_user_id" FOREIGN KEY ("changed_by_user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_payout" ADD CONSTRAINT "fk_staff_payout_staff_id" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_payout" ADD CONSTRAINT "fk_staff_payout_paid_by_user_id" FOREIGN KEY ("paid_by_user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_advance" ADD CONSTRAINT "fk_staff_advance_staff_id" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_advance" ADD CONSTRAINT "fk_staff_advance_given_by_user_id" FOREIGN KEY ("given_by_user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_advance" ADD CONSTRAINT "fk_staff_advance_staff_payout_id_staff_id" FOREIGN KEY ("staff_payout_id", "staff_id") REFERENCES "staff_payout"("id", "staff_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_withdrawal" ADD CONSTRAINT "fk_cash_withdrawal_withdrawn_by_user_id" FOREIGN KEY ("withdrawn_by_user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_withdrawal" ADD CONSTRAINT "fk_cash_withdrawal_cash_withdrawal_reason_id" FOREIGN KEY ("cash_withdrawal_reason_id") REFERENCES "cash_withdrawal_reason"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_invoice" ADD CONSTRAINT "fk_sale_invoice_customer_id" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_invoice" ADD CONSTRAINT "fk_sale_invoice_created_by_user_id" FOREIGN KEY ("created_by_user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_invoice" ADD CONSTRAINT "fk_sale_invoice_credit_authorized_by_user_id" FOREIGN KEY ("credit_authorized_by_user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_invoice_line" ADD CONSTRAINT "fk_sale_invoice_line_sale_invoice_id" FOREIGN KEY ("sale_invoice_id") REFERENCES "sale_invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_invoice_line" ADD CONSTRAINT "fk_sale_invoice_line_product_id" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_invoice_line" ADD CONSTRAINT "fk_sale_invoice_line_service_type_id" FOREIGN KEY ("service_type_id") REFERENCES "service_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_invoice_line" ADD CONSTRAINT "fk_sale_invoice_line_discount_id" FOREIGN KEY ("discount_id") REFERENCES "discount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_invoice_line" ADD CONSTRAINT "fk_sale_invoice_line_discount_authorized_by_user_id" FOREIGN KEY ("discount_authorized_by_user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_invoice_line" ADD CONSTRAINT "fk_sale_invoice_line_additional_fault_id_sale_invoice_id" FOREIGN KEY ("additional_fault_id", "sale_invoice_id") REFERENCES "additional_fault"("id", "service_order_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_return" ADD CONSTRAINT "fk_customer_return_sale_invoice_id" FOREIGN KEY ("sale_invoice_id") REFERENCES "sale_invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_return" ADD CONSTRAINT "fk_customer_return_return_reason_id" FOREIGN KEY ("return_reason_id") REFERENCES "return_reason"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_return" ADD CONSTRAINT "fk_customer_return_registered_by_user_id" FOREIGN KEY ("registered_by_user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_return_line" ADD CONSTRAINT "fk_customer_return_line_customer_return" FOREIGN KEY ("customer_return_id", "sale_invoice_id") REFERENCES "customer_return"("id", "sale_invoice_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_return_line" ADD CONSTRAINT "fk_customer_return_line_sale_invoice_line" FOREIGN KEY ("sale_invoice_line_id", "sale_invoice_id", "product_id") REFERENCES "sale_invoice_line"("id", "sale_invoice_id", "product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_opening_balance" ADD CONSTRAINT "fk_customer_opening_balance_customer_id" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_opening_balance" ADD CONSTRAINT "fk_customer_opening_balance_registered_by_user_id" FOREIGN KEY ("registered_by_user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_order" ADD CONSTRAINT "fk_service_order_id" FOREIGN KEY ("id") REFERENCES "sale_invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_order" ADD CONSTRAINT "fk_service_order_motorcycle_id" FOREIGN KEY ("motorcycle_id") REFERENCES "motorcycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_order" ADD CONSTRAINT "fk_service_order_mechanic_staff_id" FOREIGN KEY ("mechanic_staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_order" ADD CONSTRAINT "fk_service_order_staff_payout_id_mechanic_staff_id" FOREIGN KEY ("staff_payout_id", "mechanic_staff_id") REFERENCES "staff_payout"("id", "staff_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_order_status_change" ADD CONSTRAINT "fk_service_order_status_change_service_order_id" FOREIGN KEY ("service_order_id") REFERENCES "service_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_order_status_change" ADD CONSTRAINT "fk_service_order_status_change_registered_by_user_id" FOREIGN KEY ("registered_by_user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "additional_fault" ADD CONSTRAINT "fk_additional_fault_service_order_id" FOREIGN KEY ("service_order_id") REFERENCES "service_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_claim" ADD CONSTRAINT "fk_warranty_claim_original_service_order_id" FOREIGN KEY ("original_service_order_id") REFERENCES "service_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_claim" ADD CONSTRAINT "fk_warranty_claim_new_service_order_id" FOREIGN KEY ("new_service_order_id") REFERENCES "service_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_claim" ADD CONSTRAINT "fk_warranty_claim_part_sale_invoice_id" FOREIGN KEY ("part_sale_invoice_id") REFERENCES "sale_invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranty_claim" ADD CONSTRAINT "fk_warranty_claim_attended_by_user_id" FOREIGN KEY ("attended_by_user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_payment" ADD CONSTRAINT "fk_customer_payment_payment_method_id" FOREIGN KEY ("payment_method_id") REFERENCES "payment_method"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_payment" ADD CONSTRAINT "fk_customer_payment_received_by_user_id" FOREIGN KEY ("received_by_user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_payment_allocation" ADD CONSTRAINT "fk_customer_payment_allocation_customer_payment_id" FOREIGN KEY ("customer_payment_id") REFERENCES "customer_payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_payment_allocation" ADD CONSTRAINT "fk_customer_payment_allocation_sale_invoice_id" FOREIGN KEY ("sale_invoice_id") REFERENCES "sale_invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_payment_allocation" ADD CONSTRAINT "fk_customer_payment_allocation_customer_opening_balance_id" FOREIGN KEY ("customer_opening_balance_id") REFERENCES "customer_opening_balance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice" ADD CONSTRAINT "fk_purchase_invoice_supplier_id" FOREIGN KEY ("supplier_id") REFERENCES "supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice" ADD CONSTRAINT "fk_purchase_invoice_received_by_user_id" FOREIGN KEY ("received_by_user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_line" ADD CONSTRAINT "fk_purchase_invoice_line_purchase_invoice_id" FOREIGN KEY ("purchase_invoice_id") REFERENCES "purchase_invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_line" ADD CONSTRAINT "fk_purchase_invoice_line_product_id" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_return" ADD CONSTRAINT "fk_supplier_return_purchase_invoice_id" FOREIGN KEY ("purchase_invoice_id") REFERENCES "purchase_invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_return" ADD CONSTRAINT "fk_supplier_return_return_reason_id" FOREIGN KEY ("return_reason_id") REFERENCES "return_reason"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_return" ADD CONSTRAINT "fk_supplier_return_registered_by_user_id" FOREIGN KEY ("registered_by_user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_return_line" ADD CONSTRAINT "fk_supplier_return_line_supplier_return" FOREIGN KEY ("supplier_return_id", "purchase_invoice_id") REFERENCES "supplier_return"("id", "purchase_invoice_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_return_line" ADD CONSTRAINT "fk_supplier_return_line_purchase_invoice_line" FOREIGN KEY ("purchase_invoice_line_id", "purchase_invoice_id", "product_id") REFERENCES "purchase_invoice_line"("id", "purchase_invoice_id", "product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payment" ADD CONSTRAINT "fk_supplier_payment_supplier_id" FOREIGN KEY ("supplier_id") REFERENCES "supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payment" ADD CONSTRAINT "fk_supplier_payment_purchase_invoice_id_supplier_id" FOREIGN KEY ("purchase_invoice_id", "supplier_id") REFERENCES "purchase_invoice"("id", "supplier_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movement" ADD CONSTRAINT "fk_inventory_movement_product_id" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movement" ADD CONSTRAINT "fk_inventory_movement_registered_by_user_id" FOREIGN KEY ("registered_by_user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movement" ADD CONSTRAINT "fk_inventory_movement_warranty_claim_id" FOREIGN KEY ("warranty_claim_id") REFERENCES "warranty_claim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movement" ADD CONSTRAINT "fk_inventory_movement_sale_invoice_line" FOREIGN KEY ("sale_invoice_line_id", "product_id") REFERENCES "sale_invoice_line"("id", "product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movement" ADD CONSTRAINT "fk_inventory_movement_customer_return_line" FOREIGN KEY ("customer_return_line_id", "product_id") REFERENCES "customer_return_line"("id", "product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movement" ADD CONSTRAINT "fk_inventory_movement_purchase_invoice_line" FOREIGN KEY ("purchase_invoice_line_id", "product_id") REFERENCES "purchase_invoice_line"("id", "product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movement" ADD CONSTRAINT "fk_inventory_movement_supplier_return_line" FOREIGN KEY ("supplier_return_line_id", "product_id") REFERENCES "supplier_return_line"("id", "product_id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- =====================================================================
--  Hand-written: not expressible in schema.prisma.
--  Case-insensitive unique indexes + CHECK constraints from the DBML v2.
-- =====================================================================

-- Case-insensitive uniques
CREATE UNIQUE INDEX "uq_role_name" ON "role" (lower("name"));
CREATE UNIQUE INDEX "uq_app_user_username" ON "app_user" (lower("username"));
CREATE UNIQUE INDEX "uq_return_reason_name" ON "return_reason" (lower("name"));
CREATE UNIQUE INDEX "uq_payment_method_name" ON "payment_method" (lower("name"));
CREATE UNIQUE INDEX "uq_cash_withdrawal_reason_name" ON "cash_withdrawal_reason" (lower("name"));
CREATE UNIQUE INDEX "uq_discount_name" ON "discount" (lower("name"));
CREATE UNIQUE INDEX "uq_service_type_name" ON "service_type" (lower("name"));
CREATE UNIQUE INDEX "uq_customer_national_id" ON "customer" (upper("national_id"));
CREATE UNIQUE INDEX "uq_motorcycle_brand_name" ON "motorcycle_brand" (lower("name"));
CREATE UNIQUE INDEX "uq_motorcycle_model_motorcycle_brand_id_name" ON "motorcycle_model" ("motorcycle_brand_id", lower("name"));
CREATE UNIQUE INDEX "uq_motorcycle_plate" ON "motorcycle" (upper("plate"));
CREATE UNIQUE INDEX "uq_product_category_name" ON "product_category" (lower("name"));
CREATE UNIQUE INDEX "uq_product_brand_name" ON "product_brand" (lower("name"));

-- Security
ALTER TABLE "role" ADD CONSTRAINT "ck_role_name" CHECK (btrim("name") <> '');
ALTER TABLE "permission" ADD CONSTRAINT "ck_permission_code" CHECK ("code" ~ '^[a-z_]+(\.[a-z_]+)*$');
ALTER TABLE "staff"
  ADD CONSTRAINT "ck_staff_name" CHECK (btrim("name") <> ''),
  ADD CONSTRAINT "ck_staff_phone" CHECK (btrim("phone") <> ''),
  ADD CONSTRAINT "ck_staff_commission_rate" CHECK ("commission_rate" > 0 AND "commission_rate" <= 1);
ALTER TABLE "app_user" ADD CONSTRAINT "ck_app_user_username" CHECK (btrim("username") <> '');

-- Catalogs
ALTER TABLE "return_reason" ADD CONSTRAINT "ck_return_reason_name" CHECK (btrim("name") <> '');
ALTER TABLE "payment_method" ADD CONSTRAINT "ck_payment_method_name" CHECK (btrim("name") <> '');
ALTER TABLE "cash_withdrawal_reason" ADD CONSTRAINT "ck_cash_withdrawal_reason_name" CHECK (btrim("name") <> '');
ALTER TABLE "discount"
  ADD CONSTRAINT "ck_discount_name" CHECK (btrim("name") <> ''),
  ADD CONSTRAINT "ck_discount_discount_type" CHECK ("discount_type" IN ('PORCENTAJE', 'MONTO')),
  ADD CONSTRAINT "ck_discount_value" CHECK ("value" > 0 AND ("discount_type" = 'MONTO' OR "value" <= 1));
ALTER TABLE "service_type"
  ADD CONSTRAINT "ck_service_type_name" CHECK (btrim("name") <> ''),
  ADD CONSTRAINT "ck_service_type_reference_price" CHECK ("reference_price" >= 0);

-- Customers & motorcycles
ALTER TABLE "customer"
  ADD CONSTRAINT "ck_customer_name" CHECK (btrim("name") <> ''),
  ADD CONSTRAINT "ck_customer_phone" CHECK (btrim("phone") <> ''),
  ADD CONSTRAINT "ck_customer_national_id" CHECK ("national_id" IS NULL OR btrim("national_id") <> ''),
  ADD CONSTRAINT "ck_customer_address" CHECK ("address" IS NULL OR btrim("address") <> '');
ALTER TABLE "motorcycle_brand" ADD CONSTRAINT "ck_motorcycle_brand_name" CHECK (btrim("name") <> '');
ALTER TABLE "motorcycle_model" ADD CONSTRAINT "ck_motorcycle_model_name" CHECK (btrim("name") <> '');
ALTER TABLE "motorcycle"
  ADD CONSTRAINT "ck_motorcycle_color" CHECK (btrim("color") <> ''),
  ADD CONSTRAINT "ck_motorcycle_plate" CHECK ("plate" IS NULL OR btrim("plate") <> '');

-- Products
ALTER TABLE "product_category" ADD CONSTRAINT "ck_product_category_name" CHECK (btrim("name") <> '');
ALTER TABLE "product_brand" ADD CONSTRAINT "ck_product_brand_name" CHECK (btrim("name") <> '');
ALTER TABLE "product"
  ADD CONSTRAINT "ck_product_name" CHECK (btrim("name") <> ''),
  ADD CONSTRAINT "ck_product_barcode" CHECK ("barcode" IS NULL OR btrim("barcode") <> ''),
  ADD CONSTRAINT "ck_product_quality_tier" CHECK ("quality_tier" IN ('ALTA', 'MEDIA', 'BAJA')),
  ADD CONSTRAINT "ck_product_list_price" CHECK ("list_price" >= 0),
  ADD CONSTRAINT "ck_product_stock" CHECK ("stock" >= 0);
ALTER TABLE "product_price_history" ADD CONSTRAINT "ck_product_price_history_new_price" CHECK ("new_price" >= 0);

-- Staff money
ALTER TABLE "staff_payout"
  ADD CONSTRAINT "ck_staff_payout_period" CHECK ("period_end" >= "period_start"),
  ADD CONSTRAINT "ck_staff_payout_paid_pair" CHECK (("paid_on" IS NULL) = ("paid_by_user_id" IS NULL)),
  ADD CONSTRAINT "ck_staff_payout_paid_on" CHECK ("paid_on" IS NULL OR "paid_on" >= "period_start");
ALTER TABLE "staff_advance" ADD CONSTRAINT "ck_staff_advance_amount" CHECK ("amount" > 0);
ALTER TABLE "cash_withdrawal"
  ADD CONSTRAINT "ck_cash_withdrawal_amount" CHECK ("amount" > 0),
  ADD CONSTRAINT "ck_cash_withdrawal_description" CHECK ("description" IS NULL OR btrim("description") <> '');

-- Sales
ALTER TABLE "sale_invoice"
  ADD CONSTRAINT "ck_sale_invoice_payment_terms" CHECK ("payment_terms" IN ('CONTADO', 'CREDITO')),
  ADD CONSTRAINT "ck_sale_invoice_invoice_number" CHECK ("invoice_number" IS NULL OR btrim("invoice_number") <> ''),
  ADD CONSTRAINT "ck_sale_invoice_customer" CHECK ("customer_id" IS NOT NULL OR "payment_terms" = 'CONTADO'),
  ADD CONSTRAINT "ck_sale_invoice_credit" CHECK (
        ("payment_terms" = 'CREDITO') = ("due_date" IS NOT NULL)
    AND ("payment_terms" = 'CREDITO') = ("credit_authorized_by_user_id" IS NOT NULL)
    AND ("payment_terms" = 'CREDITO' OR ("extended_due_date" IS NULL AND "monthly_interest" = 0))),
  ADD CONSTRAINT "ck_sale_invoice_due_date" CHECK ("due_date" >= "created_at"::date),
  ADD CONSTRAINT "ck_sale_invoice_extended_due" CHECK ("extended_due_date" > "due_date"),
  ADD CONSTRAINT "ck_sale_invoice_monthly_interest" CHECK ("monthly_interest" >= 0 AND "monthly_interest" < 1),
  ADD CONSTRAINT "ck_sale_invoice_notes" CHECK ("notes" IS NULL OR btrim("notes") <> '');
ALTER TABLE "sale_invoice_line"
  ADD CONSTRAINT "ck_sale_invoice_line_line_no" CHECK ("line_no" > 0),
  ADD CONSTRAINT "ck_sale_invoice_line_quantity" CHECK ("quantity" > 0),
  ADD CONSTRAINT "ck_sale_invoice_line_unit_price" CHECK ("unit_price" >= 0),
  ADD CONSTRAINT "ck_sale_invoice_line_description" CHECK ("description" IS NULL OR btrim("description") <> ''),
  ADD CONSTRAINT "ck_sale_invoice_line_line_type" CHECK ("line_type" IN ('PRODUCTO', 'MANO_OBRA', 'CARGO_EXTERNO')),
  ADD CONSTRAINT "ck_sale_invoice_line_by_type" CHECK (
       ("line_type" = 'PRODUCTO'      AND "product_id" IS NOT NULL AND "service_type_id" IS NULL)
    OR ("line_type" = 'MANO_OBRA'     AND "product_id" IS NULL AND "description" IS NOT NULL)
    OR ("line_type" = 'CARGO_EXTERNO' AND "product_id" IS NULL AND "service_type_id" IS NULL
                                      AND "description" IS NOT NULL AND "quantity" = 1)),
  ADD CONSTRAINT "ck_sale_invoice_line_discount" CHECK (
        "discount_amount" >= 0
    AND "discount_amount" <= "quantity" * "unit_price"
    AND ("discount_id" IS NULL OR "discount_amount" > 0)
    AND ("discount_amount" = 0 OR "discount_id" IS NOT NULL OR "discount_authorized_by_user_id" IS NOT NULL));
ALTER TABLE "customer_return"
  ADD CONSTRAINT "ck_customer_return_credit_note_number" CHECK ("credit_note_number" IS NULL OR btrim("credit_note_number") <> ''),
  ADD CONSTRAINT "ck_customer_return_notes" CHECK ("notes" IS NULL OR btrim("notes") <> '');
ALTER TABLE "customer_return_line"
  ADD CONSTRAINT "ck_customer_return_line_line_no" CHECK ("line_no" > 0),
  ADD CONSTRAINT "ck_customer_return_line_quantity" CHECK ("quantity" > 0);
ALTER TABLE "customer_opening_balance"
  ADD CONSTRAINT "ck_customer_opening_balance_amount" CHECK ("amount" > 0),
  ADD CONSTRAINT "ck_customer_opening_balance_monthly_interest" CHECK ("monthly_interest" >= 0 AND "monthly_interest" < 1),
  ADD CONSTRAINT "ck_customer_opening_balance_notes" CHECK ("notes" IS NULL OR btrim("notes") <> '');

-- Service orders
ALTER TABLE "service_order"
  ADD CONSTRAINT "ck_service_order_requested_work" CHECK (btrim("requested_work") <> ''),
  ADD CONSTRAINT "ck_service_order_cancellation_fee" CHECK ("cancellation_fee" >= 0),
  ADD CONSTRAINT "ck_service_order_applied_commission_rate" CHECK ("applied_commission_rate" > 0 AND "applied_commission_rate" <= 1),
  ADD CONSTRAINT "ck_service_order_payout_rate" CHECK (
    "staff_payout_id" IS NULL OR ("applied_commission_rate" IS NOT NULL AND "mechanic_staff_id" IS NOT NULL));
ALTER TABLE "service_order_status_change"
  ADD CONSTRAINT "ck_service_order_status_change_status" CHECK ("status" IN (
    'RECIBIDA', 'EN_DIAGNOSTICO', 'EN_PROCESO', 'ESPERA_REPUESTO', 'ESPERA_CLIENTE',
    'TERMINADA', 'EN_PRUEBA', 'ENTREGADA', 'CANCELADA'));
ALTER TABLE "additional_fault"
  ADD CONSTRAINT "ck_additional_fault_fault_no" CHECK ("fault_no" > 0),
  ADD CONSTRAINT "ck_additional_fault_description" CHECK (btrim("description") <> ''),
  ADD CONSTRAINT "ck_additional_fault_proposed_price" CHECK ("proposed_price" >= 0),
  ADD CONSTRAINT "ck_additional_fault_decision" CHECK ("decision" IN ('PENDIENTE', 'ACEPTADA', 'RECHAZADA'));
ALTER TABLE "warranty_claim"
  ADD CONSTRAINT "ck_warranty_claim_description" CHECK (btrim("description") <> ''),
  ADD CONSTRAINT "ck_warranty_claim_outcome" CHECK ("outcome" IN ('CUBIERTO', 'FALLA_DISTINTA', 'FUERA_DE_PLAZO', 'REEMBOLSO')),
  ADD CONSTRAINT "ck_warranty_claim_part_paid_by" CHECK ("part_paid_by" IN ('TIENDA', 'CLIENTE')),
  ADD CONSTRAINT "ck_warranty_claim_refund" CHECK (("outcome" = 'REEMBOLSO') = ("refund_amount" IS NOT NULL)),
  ADD CONSTRAINT "ck_warranty_claim_refund_amount" CHECK ("refund_amount" > 0),
  ADD CONSTRAINT "ck_warranty_claim_new_service_order" CHECK (
    "new_service_order_id" IS NULL OR ("outcome" = 'FALLA_DISTINTA' AND "new_service_order_id" <> "original_service_order_id")),
  ADD CONSTRAINT "ck_warranty_claim_part_sale_invoice" CHECK (
    "part_sale_invoice_id" IS NULL OR coalesce("part_paid_by", '') = 'CLIENTE');

-- Customer payments
ALTER TABLE "customer_payment"
  ADD CONSTRAINT "ck_customer_payment_amount" CHECK ("amount" > 0),
  ADD CONSTRAINT "ck_customer_payment_currency" CHECK ("currency" IN ('NIO', 'USD')),
  ADD CONSTRAINT "ck_customer_payment_exchange" CHECK (
       ("currency" = 'NIO' AND "exchange_rate" IS NULL)
    OR ("currency" = 'USD' AND "exchange_rate" IS NOT NULL AND "exchange_rate" > 0));
ALTER TABLE "customer_payment_allocation"
  ADD CONSTRAINT "ck_customer_payment_allocation_amount" CHECK ("amount" > 0),
  ADD CONSTRAINT "ck_customer_payment_allocation_target" CHECK (num_nonnulls("sale_invoice_id", "customer_opening_balance_id") = 1);

-- Purchasing
ALTER TABLE "supplier"
  ADD CONSTRAINT "ck_supplier_name" CHECK (btrim("name") <> ''),
  ADD CONSTRAINT "ck_supplier_opening_balance" CHECK ("opening_balance" >= 0),
  ADD CONSTRAINT "ck_supplier_opening_pair" CHECK (("opening_balance" IS NULL) = ("opening_date" IS NULL));
ALTER TABLE "purchase_invoice"
  ADD CONSTRAINT "ck_purchase_invoice_invoice_number" CHECK (btrim("invoice_number") <> ''),
  ADD CONSTRAINT "ck_purchase_invoice_payment_terms" CHECK ("payment_terms" IN ('CONTADO', 'CREDITO')),
  ADD CONSTRAINT "ck_purchase_invoice_due_date" CHECK (
        ("payment_terms" = 'CREDITO') = ("due_date" IS NOT NULL)
    AND ("due_date" IS NULL OR "due_date" >= "purchase_date")),
  ADD CONSTRAINT "ck_purchase_invoice_discount_amount" CHECK ("discount_amount" >= 0);
ALTER TABLE "purchase_invoice_line"
  ADD CONSTRAINT "ck_purchase_invoice_line_line_no" CHECK ("line_no" > 0),
  ADD CONSTRAINT "ck_purchase_invoice_line_quantity" CHECK ("quantity" > 0),
  ADD CONSTRAINT "ck_purchase_invoice_line_unit_cost" CHECK ("unit_cost" >= 0);
ALTER TABLE "supplier_return"
  ADD CONSTRAINT "ck_supplier_return_resolution" CHECK ("resolution" IN ('REPOSICION', 'DINERO', 'DESCUENTO'));
ALTER TABLE "supplier_return_line"
  ADD CONSTRAINT "ck_supplier_return_line_line_no" CHECK ("line_no" > 0),
  ADD CONSTRAINT "ck_supplier_return_line_quantity" CHECK ("quantity" > 0);
ALTER TABLE "supplier_payment"
  ADD CONSTRAINT "ck_supplier_payment_amount" CHECK ("amount" > 0),
  ADD CONSTRAINT "ck_supplier_payment_currency" CHECK ("currency" IN ('NIO', 'USD')),
  ADD CONSTRAINT "ck_supplier_payment_exchange" CHECK (
       ("currency" = 'NIO' AND "exchange_rate" IS NULL)
    OR ("currency" = 'USD' AND "exchange_rate" IS NOT NULL AND "exchange_rate" > 0));

-- Inventory ledger
ALTER TABLE "inventory_movement"
  ADD CONSTRAINT "ck_inventory_movement_quantity" CHECK ("quantity" > 0),
  ADD CONSTRAINT "ck_inventory_movement_unit_cost" CHECK ("unit_cost" >= 0),
  ADD CONSTRAINT "ck_inventory_movement_movement_type" CHECK ("movement_type" IN (
    'COMPRA', 'DEVOLUCION_CLIENTE', 'INVENTARIO_INICIAL', 'AJUSTE_ENTRADA',
    'VENTA', 'USO_SERVICIO', 'DEVOLUCION_PROVEEDOR', 'GARANTIA', 'AJUSTE_SALIDA')),
  ADD CONSTRAINT "ck_inventory_movement_notes" CHECK (
    "movement_type" NOT IN ('AJUSTE_ENTRADA', 'AJUSTE_SALIDA') OR btrim(coalesce("notes", '')) <> ''),
  ADD CONSTRAINT "ck_inventory_movement_origin" CHECK (
        num_nonnulls("sale_invoice_line_id", "customer_return_line_id", "purchase_invoice_line_id",
                     "supplier_return_line_id", "warranty_claim_id")
          = CASE WHEN "movement_type" IN ('INVENTARIO_INICIAL', 'AJUSTE_ENTRADA', 'AJUSTE_SALIDA') THEN 0 ELSE 1 END
    AND ("sale_invoice_line_id"     IS NULL OR "movement_type" IN ('VENTA', 'USO_SERVICIO'))
    AND ("customer_return_line_id"  IS NULL OR "movement_type" = 'DEVOLUCION_CLIENTE')
    AND ("purchase_invoice_line_id" IS NULL OR "movement_type" = 'COMPRA')
    AND ("supplier_return_line_id"  IS NULL OR "movement_type" = 'DEVOLUCION_PROVEEDOR')
    AND ("warranty_claim_id"        IS NULL OR "movement_type" = 'GARANTIA'));
