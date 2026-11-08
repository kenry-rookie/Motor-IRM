import { type Prisma } from "~/server/db";
import { MOVEMENT_TYPES_IN, type MovementType } from "~/server/domain/constants";
import { D, type Dec } from "~/server/domain/money";

type Tx = Prisma.TransactionClient;

/**
 * DEC-024 (provisional): every exit stores the product's LAST cost — the unit cost
 * of its most recent entry (purchase, initial inventory, positive adjustment…).
 * 0 when the product never had an entry.
 */
export async function lastCost(tx: Tx, productId: number): Promise<Dec> {
  const last = await tx.inventoryMovement.findFirst({
    where: { productId, movementType: { in: [...MOVEMENT_TYPES_IN] } },
    orderBy: [{ movedAt: "desc" }, { id: "desc" }],
    select: { unitCost: true },
  });
  return last ? D(last.unitCost) : D(0);
}

type MovementOrigin = {
  saleInvoiceLineId?: number;
  customerReturnLineId?: number;
  purchaseInvoiceLineId?: number;
  supplierReturnLineId?: number;
  warrantyClaimId?: number;
};

/**
 * The ONLY way the API changes stock: insert a movement; the trigger
 * (DEC-039) updates product.stock and CHECK ck_product_stock rejects going
 * below zero, which aborts the whole transaction.
 */
export async function recordMovement(
  tx: Tx,
  args: {
    productId: number;
    movementType: MovementType;
    quantity: number;
    userId: number;
    unitCost?: Prisma.Decimal.Value;
    notes?: string | null;
  } & MovementOrigin,
) {
  const unitCost = args.unitCost ?? (await lastCost(tx, args.productId));
  return tx.inventoryMovement.create({
    data: {
      productId: args.productId,
      movementType: args.movementType,
      quantity: args.quantity,
      unitCost,
      notes: args.notes ?? null,
      registeredByUserId: args.userId,
      saleInvoiceLineId: args.saleInvoiceLineId,
      customerReturnLineId: args.customerReturnLineId,
      purchaseInvoiceLineId: args.purchaseInvoiceLineId,
      supplierReturnLineId: args.supplierReturnLineId,
      warrantyClaimId: args.warrantyClaimId,
    },
  });
}
