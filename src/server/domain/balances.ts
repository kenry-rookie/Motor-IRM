import { type DbClient, type Prisma } from "~/server/db";
import { intList, Sql } from "~/server/domain/sql";

/**
 * DEC-042 — Balances, commissions and margins come from SQL VIEWS
 * (migration 4_staff_kind_and_balance_views), not from TypeScript loops.
 * There is ONE definition of "how much is owed": the view. This module only
 * reads it. Everything is in córdobas (DEC-025). Raw SQL follows DEC-046
 * (no nested Prisma.sql fragments: they break under Next.js).
 *
 *   v_invoice_balance             sale invoice: total − returned − paid
 *   v_opening_balance_remaining   customer debt from before the system
 *   v_customer_balance            what each customer owes (open items only)
 *   v_purchase_invoice_balance    purchase: total − returned (money/discount) − paid
 *   v_supplier_balance            what we owe each supplier
 *   v_mechanic_unpaid_commission  delivered orders with commission not yet paid
 *   v_product_margin              last cost and margin per product
 */
type Db = DbClient | Prisma.TransactionClient;
type Dec = Prisma.Decimal;


// ---------------------------------------------------------------------------
//  Customers
// ---------------------------------------------------------------------------

export type InvoiceBalance = {
  saleInvoiceId: number;
  customerId: number | null;
  paymentTerms: string;
  createdAt: Date;
  dueDate: Date | null;
  total: Dec;
  returned: Dec;
  paid: Dec;
  balance: Dec;
  daysOverdue: number | null;
};

type InvoiceRow = {
  sale_invoice_id: number;
  customer_id: number | null;
  payment_terms: string;
  created_at: Date;
  due_date: Date | null;
  total: Dec;
  returned: Dec;
  paid: Dec;
  balance: Dec;
  days_overdue: number | null;
};

const toInvoice = (r: InvoiceRow): InvoiceBalance => ({
  saleInvoiceId: r.sale_invoice_id,
  customerId: r.customer_id,
  paymentTerms: r.payment_terms,
  createdAt: r.created_at,
  dueDate: r.due_date,
  total: r.total,
  returned: r.returned,
  paid: r.paid,
  balance: r.balance,
  daysOverdue: r.days_overdue,
});

/** Balances of the given invoices, keyed by id. */
export async function invoiceBalances(db: Db, ids: number[]) {
  if (!ids.length) return new Map<number, InvoiceBalance>();
  const rows = await new Sql().run<InvoiceRow[]>(db, `SELECT * FROM v_invoice_balance WHERE sale_invoice_id IN (${intList(ids)})`);
  return new Map(rows.map((r) => [r.sale_invoice_id, toInvoice(r)]));
}

export async function invoiceBalance(db: Db, id: number) {
  const b = (await invoiceBalances(db, [id])).get(id);
  if (!b) throw new Error(`v_invoice_balance: invoice ${id} not found`);
  return b;
}

/** Every invoice of a customer (newest first); `openOnly` = balance > 0. */
export async function customerInvoiceBalances(db: Db, customerId: number, openOnly = false) {
  const q = new Sql();
  const rows = await q.run<InvoiceRow[]>(
    db,
    `SELECT * FROM v_invoice_balance
      WHERE customer_id = ${q.p(customerId, "int")} ${openOnly ? "AND balance > 0" : ""}
      ORDER BY created_at DESC, sale_invoice_id DESC`,
  );
  return rows.map(toInvoice);
}

export type OpeningBalance = {
  customerOpeningBalanceId: number;
  customerId: number;
  asOfDate: Date;
  dueDate: Date;
  amount: Dec;
  paid: Dec;
  balance: Dec;
  daysOverdue: number | null;
};

type OpeningRow = {
  customer_opening_balance_id: number;
  customer_id: number;
  as_of_date: Date;
  due_date: Date;
  amount: Dec;
  paid: Dec;
  balance: Dec;
  days_overdue: number | null;
};

const toOpening = (r: OpeningRow): OpeningBalance => ({
  customerOpeningBalanceId: r.customer_opening_balance_id,
  customerId: r.customer_id,
  asOfDate: r.as_of_date,
  dueDate: r.due_date,
  amount: r.amount,
  paid: r.paid,
  balance: r.balance,
  daysOverdue: r.days_overdue,
});

export async function openingBalances(db: Db, where: { customerId?: number; ids?: number[] }, openOnly = false) {
  const q = new Sql();
  const conds = ["true"];
  if (where.customerId !== undefined) conds.push(`customer_id = ${q.p(where.customerId, "int")}`);
  if (where.ids) conds.push(`customer_opening_balance_id IN (${intList(where.ids)})`);
  if (openOnly) conds.push("balance > 0");
  const rows = await q.run<OpeningRow[]>(
    db,
    `SELECT * FROM v_opening_balance_remaining WHERE ${conds.join(" AND ")}
      ORDER BY as_of_date DESC, customer_opening_balance_id DESC`,
  );
  return rows.map(toOpening);
}

export type CustomerBalance = {
  customerId: number;
  name: string;
  phone: string;
  balance: Dec;
  overdue: Dec;
  oldestDueDate: Date | null;
  maxDaysOverdue: number | null;
  openItems: number;
};

/** Receivables: customers who owe something, most overdue first. */
export async function customerBalances(db: Db, opts: { onlyOverdue?: boolean; customerId?: number } = {}) {
  const q = new Sql();
  const conds = ["true"];
  if (opts.customerId !== undefined) conds.push(`b.customer_id = ${q.p(opts.customerId, "int")}`);
  if (opts.onlyOverdue) conds.push("b.overdue > 0");
  const rows = await q.run<
    {
      customer_id: number;
      name: string;
      phone: string;
      balance: Dec;
      overdue: Dec;
      oldest_due_date: Date | null;
      max_days_overdue: number | null;
      open_items: number;
    }[]
  >(
    db,
    `SELECT b.*, c.name, c.phone
       FROM v_customer_balance b
       JOIN customer c ON c.id = b.customer_id
      WHERE ${conds.join(" AND ")}
      ORDER BY b.overdue DESC, b.balance DESC, c.name`,
  );
  return rows.map(
    (r): CustomerBalance => ({
      customerId: r.customer_id,
      name: r.name,
      phone: r.phone,
      balance: r.balance,
      overdue: r.overdue,
      oldestDueDate: r.oldest_due_date,
      maxDaysOverdue: r.max_days_overdue,
      openItems: Number(r.open_items),
    }),
  );
}

// ---------------------------------------------------------------------------
//  Suppliers
// ---------------------------------------------------------------------------

export type PurchaseBalance = {
  purchaseInvoiceId: number;
  supplierId: number;
  purchaseDate: Date;
  paymentTerms: string;
  dueDate: Date | null;
  total: Dec;
  returned: Dec;
  paid: Dec;
  balance: Dec;
  daysOverdue: number | null;
};

type PurchaseRow = {
  purchase_invoice_id: number;
  supplier_id: number;
  purchase_date: Date;
  payment_terms: string;
  due_date: Date | null;
  total: Dec;
  returned: Dec;
  paid: Dec;
  balance: Dec;
  days_overdue: number | null;
};

const toPurchase = (r: PurchaseRow): PurchaseBalance => ({
  purchaseInvoiceId: r.purchase_invoice_id,
  supplierId: r.supplier_id,
  purchaseDate: r.purchase_date,
  paymentTerms: r.payment_terms,
  dueDate: r.due_date,
  total: r.total,
  returned: r.returned,
  paid: r.paid,
  balance: r.balance,
  daysOverdue: r.days_overdue,
});

export async function purchaseBalances(db: Db, where: { ids?: number[]; supplierId?: number }) {
  const q = new Sql();
  const conds = ["true"];
  if (where.ids) conds.push(`purchase_invoice_id IN (${intList(where.ids)})`);
  if (where.supplierId !== undefined) conds.push(`supplier_id = ${q.p(where.supplierId, "int")}`);
  const rows = await q.run<PurchaseRow[]>(
    db,
    `SELECT * FROM v_purchase_invoice_balance WHERE ${conds.join(" AND ")}
      ORDER BY purchase_date DESC, purchase_invoice_id DESC`,
  );
  return rows.map(toPurchase);
}

export async function supplierBalance(db: Db, supplierId: number) {
  const [r] = await db.$queryRaw<
    { opening_balance: Dec; purchases_balance: Dec; balance: Dec; overdue: Dec }[]
  >`SELECT opening_balance, purchases_balance, balance, overdue FROM v_supplier_balance WHERE supplier_id = ${supplierId}::int`;
  if (!r) throw new Error(`v_supplier_balance: supplier ${supplierId} not found`);
  return { openingBalance: r.opening_balance, purchasesBalance: r.purchases_balance, balance: r.balance, overdue: r.overdue };
}

// ---------------------------------------------------------------------------
//  Mechanics
// ---------------------------------------------------------------------------

export type UnpaidCommission = {
  serviceOrderId: number;
  deliveredAt: Date;
  customer: string;
  labor: Dec;
  rate: Dec;
  commission: Dec;
};

/**
 * Delivered orders of a mechanic whose commission is not paid yet (DEC-030):
 * every one up to `deliveredBefore`, including late ones from earlier periods
 * (BR-104). Orders of an owner, or without a rate, are not in the view.
 */
export async function unpaidCommissions(db: Db, staffId: number, deliveredBefore?: Date) {
  const q = new Sql();
  const staff = q.p(staffId, "int");
  const until = deliveredBefore ? `AND v.delivered_at < ${q.p(deliveredBefore, "timestamptz")}` : "";
  const rows = await q.run<
    { service_order_id: number; delivered_at: Date; customer: string; labor: Dec; rate: Dec; commission: Dec }[]
  >(
    db,
    `SELECT v.service_order_id, v.delivered_at, c.name AS customer, v.labor, v.rate, v.commission
       FROM v_mechanic_unpaid_commission v
       JOIN service_order so ON so.id = v.service_order_id
       JOIN motorcycle m ON m.id = so.motorcycle_id
       JOIN customer c ON c.id = m.customer_id
      WHERE v.staff_id = ${staff} ${until}
      ORDER BY v.service_order_id`,
  );
  return rows.map(
    (r): UnpaidCommission => ({
      serviceOrderId: r.service_order_id,
      deliveredAt: r.delivered_at,
      customer: r.customer,
      labor: r.labor,
      rate: r.rate,
      commission: r.commission,
    }),
  );
}

// ---------------------------------------------------------------------------
//  Products
// ---------------------------------------------------------------------------

export type ProductMargin = { productId: number; lastCost: Dec | null; margin: Dec | null; marginPct: Dec | null };

export async function productMargins(db: Db, ids: number[]) {
  if (!ids.length) return new Map<number, ProductMargin>();
  const rows = await new Sql().run<
    { product_id: number; last_cost: Dec | null; margin: Dec | null; margin_pct: Dec | null }[]
  >(db, `SELECT product_id, last_cost, margin, margin_pct FROM v_product_margin WHERE product_id IN (${intList(ids)})`);
  return new Map(
    rows.map((r) => [
      r.product_id,
      { productId: r.product_id, lastCost: r.last_cost, margin: r.margin, marginPct: r.margin_pct },
    ]),
  );
}
