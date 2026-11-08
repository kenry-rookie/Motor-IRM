import { z } from "zod";

import { fail } from "~/server/api/errors";
import { type SessionUser } from "~/server/auth/session";
import { type Prisma } from "~/server/db";
import { resolveAuthorizer, zAuthorizer } from "~/server/domain/authorize";
import {
  CURRENCIES,
  dayToDate,
  PAYMENT_TERMS,
  todayInManagua,
  zDay,
  zExchangeRate,
  zId,
  zMoney,
  zOptText,
  zQty,
  zRate,

} from "~/server/domain/constants";
import { recordMovement } from "~/server/domain/inventory";
import { D, type Dec, round2, sum, ZERO } from "~/server/domain/money";

type Tx = Prisma.TransactionClient;

// ---------------------------------------------------------------------------
//  Input pieces shared by the counter sale (sales.create) and the service bill
//  (service.close).
// ---------------------------------------------------------------------------

export const zProductLine = z.object({
  productId: zId,
  quantity: zQty,
  /** A discount from the catalog (no extra authorization needed)… */
  discountId: zId.optional(),
  /** …or a manual amount in córdobas (needs ventas.autorizar_descuento). */
  discountAmount: zMoney.optional(),
});

export const zTerms = z
  .object({
    paymentTerms: z.enum(PAYMENT_TERMS),
    customerId: zId.optional(),
    dueDate: zDay.optional(),
    monthlyInterest: zRate.optional(),
    invoiceNumber: zOptText(20),
    notes: zOptText(200),
    /** CONTADO: how the customer pays now (creates the payment in the same transaction). */
    payment: z
      .object({
        paymentMethodId: zId,
        currency: z.enum(CURRENCIES).default("NIO"),
        exchangeRate: zExchangeRate.optional(),
      })
      .optional(),
    authorizer: zAuthorizer,
  })
  .superRefine((v, ctx) => {
    if (v.paymentTerms === "CREDITO") {
      if (!v.customerId) ctx.addIssue({ code: "custom", path: ["customerId"], message: "El crédito necesita cliente" });
      if (!v.dueDate) ctx.addIssue({ code: "custom", path: ["dueDate"], message: "El crédito necesita vencimiento" });
    } else if (!v.payment) {
      ctx.addIssue({ code: "custom", path: ["payment"], message: "Indique cómo paga (método de pago)" });
    }
  });
export type TermsInput = z.infer<typeof zTerms>;

export type LineDraft = {
  lineType: "PRODUCTO" | "MANO_OBRA" | "CARGO_EXTERNO";
  productId?: number;
  serviceTypeId?: number;
  description?: string;
  quantity: number;
  unitPrice: Dec;
  discountId?: number;
  discountAmount: Dec;
  discountAuthorizedByUserId?: number;
  additionalFaultId?: number;
};

export const lineNet = (l: { quantity: number; unitPrice: Prisma.Decimal.Value; discountAmount: Prisma.Decimal.Value }) =>
  D(l.unitPrice).times(l.quantity).minus(l.discountAmount);

/**
 * Builds PRODUCTO lines with prices taken from the database (the client's price is
 * never trusted) and resolves each discount.
 */
export async function buildProductLines(
  tx: Tx,
  user: SessionUser,
  lines: z.infer<typeof zProductLine>[],
  authorizer?: { username: string; password: string },
): Promise<LineDraft[]> {
  const products = await tx.product.findMany({ where: { id: { in: lines.map((l) => l.productId) } } });
  const byId = new Map(products.map((p) => [p.id, p]));
  let discountAuthorizer: number | undefined;
  const drafts: LineDraft[] = [];
  for (const line of lines) {
    const product = byId.get(line.productId);
    if (!product) throw fail(`El producto ${line.productId} no existe.`, "NOT_FOUND");
    const unitPrice = D(product.listPrice);
    const gross = unitPrice.times(line.quantity);
    let discountAmount = ZERO;
    let discountAuthorizedByUserId: number | undefined;
    if (line.discountId) {
      const discount = await tx.discount.findUnique({ where: { id: line.discountId } });
      if (!discount?.active) throw fail("El descuento no existe o está inactivo.");
      discountAmount =
        discount.discountType === "PORCENTAJE" ? round2(gross.times(discount.value)) : D(discount.value);
    } else if (line.discountAmount && D(line.discountAmount).gt(0)) {
      discountAuthorizer ??= await resolveAuthorizer(tx, user, "ventas.autorizar_descuento", authorizer);
      discountAmount = D(line.discountAmount);
      discountAuthorizedByUserId = discountAuthorizer;
    }
    if (discountAmount.gt(gross)) throw fail(`El descuento de «${product.name}» es mayor que el total de la línea.`);
    drafts.push({
      lineType: "PRODUCTO",
      productId: product.id,
      quantity: line.quantity,
      unitPrice,
      discountId: line.discountId,
      discountAmount,
      discountAuthorizedByUserId,
    });
  }
  return drafts;
}

/**
 * Creates the invoice, its lines, the inventory exits (VENTA or USO_SERVICIO) and,
 * for CONTADO, the payment — all inside the caller's transaction (API-012).
 */
export async function createInvoice(
  tx: Tx,
  user: SessionUser,
  terms: TermsInput,
  drafts: LineDraft[],
  opts: { serviceOrderId?: number; exitType: "VENTA" | "USO_SERVICIO" },
) {
  if (drafts.length === 0) throw fail("La factura necesita al menos una línea.");
  const total = sum(drafts.map(lineNet));

  let creditAuthorizedByUserId: number | undefined;
  if (terms.paymentTerms === "CREDITO") {
    creditAuthorizedByUserId = await resolveAuthorizer(tx, user, "ventas.autorizar_credito", terms.authorizer);
    if (terms.dueDate! < todayInManagua()) throw fail("El vencimiento no puede ser una fecha pasada.");
  }

  const invoice = await tx.saleInvoice.create({
    data: {
      customerId: terms.customerId ?? null,
      createdByUserId: user.id,
      invoiceNumber: terms.invoiceNumber ?? null,
      paymentTerms: terms.paymentTerms,
      dueDate: terms.paymentTerms === "CREDITO" ? dayToDate(terms.dueDate!) : null,
      monthlyInterest: terms.paymentTerms === "CREDITO" ? (terms.monthlyInterest ?? "0") : "0",
      creditAuthorizedByUserId: creditAuthorizedByUserId ?? null,
      notes: terms.notes ?? null,
      serviceOrderId: opts.serviceOrderId ?? null,
    },
  });

  for (const [i, d] of drafts.entries()) {
    const line = await tx.saleInvoiceLine.create({
      data: {
        saleInvoiceId: invoice.id,
        lineNo: i + 1,
        lineType: d.lineType,
        productId: d.productId ?? null,
        serviceTypeId: d.serviceTypeId ?? null,
        description: d.description ?? null,
        quantity: d.quantity,
        unitPrice: d.unitPrice,
        discountId: d.discountId ?? null,
        discountAmount: d.discountAmount,
        discountAuthorizedByUserId: d.discountAuthorizedByUserId ?? null,
        additionalFaultId: d.additionalFaultId ?? null,
        serviceOrderId: opts.serviceOrderId ?? null,
      },
    });
    if (d.lineType === "PRODUCTO" && d.productId) {
      await recordMovement(tx, {
        productId: d.productId,
        movementType: opts.exitType,
        quantity: d.quantity,
        userId: user.id,
        saleInvoiceLineId: line.id,
      });
    }
  }

  if (terms.paymentTerms === "CONTADO" && terms.payment && total.gt(0)) {
    const p = terms.payment;
    if (p.currency === "USD" && !p.exchangeRate) throw fail("Indique el tipo de cambio del dólar.");
    const amount = p.currency === "USD" ? D(total).div(p.exchangeRate!).toDecimalPlaces(2, 0) : total;
    await tx.customerPayment.create({
      data: {
        amount,
        currency: p.currency,
        exchangeRate: p.currency === "USD" ? p.exchangeRate : null,
        paymentMethodId: p.paymentMethodId,
        receivedByUserId: user.id,
        allocations: { create: [{ saleInvoiceId: invoice.id, amount: total }] },
      },
    });
  }
  return { id: invoice.id, total };
}

// ---------------------------------------------------------------------------
//  Balances (API-014). Everything in córdobas (DEC-025).
// ---------------------------------------------------------------------------

export const invoiceBalanceInclude = {
  lines: { include: { returnLines: true } },
  paymentAllocations: true,
} satisfies Prisma.SaleInvoiceInclude;

type InvoiceForBalance = Prisma.SaleInvoiceGetPayload<{ include: typeof invoiceBalanceInclude }>;

/** total − returns − payments. A returned unit is worth its net price (discount spread per unit). */
export function invoiceBalance(inv: InvoiceForBalance) {
  const total = sum(inv.lines.map(lineNet));
  const returned = sum(
    inv.lines.flatMap((l) =>
      l.returnLines.map((r) => round2(lineNet(l).div(l.quantity).times(r.quantity))),
    ),
  );
  const paid = sum(inv.paymentAllocations.map((a) => a.amount));
  return { total, returned, paid, balance: total.minus(returned).minus(paid) };
}

export const openingBalanceInclude = { paymentAllocations: true } satisfies Prisma.CustomerOpeningBalanceInclude;
type OpeningForBalance = Prisma.CustomerOpeningBalanceGetPayload<{ include: typeof openingBalanceInclude }>;
export function openingBalanceRemaining(ob: OpeningForBalance) {
  return D(ob.amount).minus(sum(ob.paymentAllocations.map((a) => a.amount)));
}

/**
 * Provisional monthly interest (Q-009, Q-021 still open): simple interest on the
 * remaining balance for each started month past the (extended) due date.
 * It is shown as an estimate; nothing is stored.
 */
export function estimatedInterest(balance: Dec, rate: Prisma.Decimal.Value, due: Date | null, today = todayInManagua()) {
  if (!due || balance.lte(0) || D(rate).lte(0)) return ZERO;
  const dueDay = due.toISOString().slice(0, 10);
  if (today <= dueDay) return ZERO;
  const [y1, m1, d1] = dueDay.split("-").map(Number) as [number, number, number];
  const [y2, m2, d2] = today.split("-").map(Number) as [number, number, number];
  let months = (y2 - y1) * 12 + (m2 - m1);
  if (d2 > d1) months += 1;
  return round2(balance.times(rate).times(Math.max(months, 1)));
}

