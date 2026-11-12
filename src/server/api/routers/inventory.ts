import { z } from "zod";

import { fail } from "~/server/api/errors";
import { createTRPCRouter, permissionProcedure } from "~/server/api/trpc";
import { type Prisma } from "~/server/db";
import { QUALITY_TIERS, zId, zMoney, pageFields, zQty, zText, zOptBarcode } from "~/server/domain/constants";
import { lastCost, recordMovement } from "~/server/domain/inventory";
import { productInclude } from "~/server/domain/search";

/**
 * API-011 Inventory · API-022 cursor pagination. Text search: search.products.
 * Stock is never written here: every change is a movement (DEC-039).
 */
const view = permissionProcedure("inventario.ver");
const manage = permissionProcedure("inventario.gestionar");

const zProductData = z.object({
  productCategoryId: zId,
  productBrandId: zId,
  name: zText(150),
  barcode: zOptBarcode,
  qualityTier: z.enum(QUALITY_TIERS),
});

export const inventoryRouter = createTRPCRouter({
  /** Paged list to browse and filter. Text search is `search.products` (DEC-043). */
  listProducts: view
    .input(
      z
        .object({
          productCategoryId: zId.optional(),
          lowStock: z.number().int().min(0).optional(),
          ...pageFields,
        })
        .default({}),
    )
    .query(async ({ ctx, input }) => {
      const where: Prisma.ProductWhereInput = {
        productCategoryId: input.productCategoryId,
        stock: input.lowStock !== undefined ? { lte: input.lowStock } : undefined,
      };
      const { cursor, limit } = input;
      const items = await ctx.db.product.findMany({
        where,
        include: productInclude,
        orderBy: { id: "asc" },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      const nextCursor = items.length > limit ? items[limit - 1]!.id : null;
      return { items: items.slice(0, limit), nextCursor };
    }),

  /** Fast lookup for the barcode scanner at the counter (API-021). */
  byBarcode: view.input(z.object({ barcode: zText(50) })).query(({ ctx, input }) =>
    // A deactivated product can't be sold or bought: the scanner doesn't find it.
    ctx.db.product.findFirst({ where: { barcode: input.barcode, active: true }, include: productInclude }),
  ),

  get: view.input(z.object({ id: zId })).query(async ({ ctx, input }) => {
    const product = await ctx.db.product.findUniqueOrThrow({
      where: { id: input.id },
      include: {
        ...productInclude,
        priceHistory: { orderBy: { changedAt: "desc" }, take: 20, include: { changedBy: { select: { username: true } } } },
      },
    });
    const cost = await ctx.db.$transaction((tx) => lastCost(tx, input.id));
    return { ...product, lastCost: cost };
  }),

  /** Kardex of a product, newest first, paged. */
  movements: view
    .input(z.object({ productId: zId, ...pageFields }))
    .query(async ({ ctx, input }) => {
      const { cursor, limit } = input;
      const items = await ctx.db.inventoryMovement.findMany({
        where: { productId: input.productId },
        orderBy: { id: "desc" },
        include: { registeredBy: { select: { username: true } } },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      const nextCursor = items.length > limit ? items[limit - 1]!.id : null;
      return { items: items.slice(0, limit), nextCursor };
    }),

  /** New product. Optional initial stock is an INVENTARIO_INICIAL movement. */
  create: manage
    .input(
      zProductData.extend({
        listPrice: zMoney,
        initialStock: z.object({ quantity: zQty, unitCost: zMoney }).optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        const { initialStock, listPrice, ...data } = input;
        const product = await tx.product.create({ data: { ...data, barcode: data.barcode ?? null, listPrice } });
        await tx.productPriceHistory.create({
          data: { productId: product.id, newPrice: listPrice, changedByUserId: ctx.user.id },
        });
        if (initialStock) {
          await recordMovement(tx, {
            productId: product.id,
            movementType: "INVENTARIO_INICIAL",
            quantity: initialStock.quantity,
            unitCost: initialStock.unitCost,
            userId: ctx.user.id,
          });
        }
        return product;
      }),
    ),

  /** Edits descriptive data. Price and stock have their own procedures. */
  update: manage
    .input(zProductData.extend({ id: zId }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.product.update({ where: { id }, data: { ...data, barcode: data.barcode ?? null } });
    }),

  /**
   * Deactivate / reactivate (migration 9b). A product is never deleted: it has
   * sales, purchases and kardex. Deactivated = hidden from Inventario, Caja and
   * Compras; it is reactivated from Administración → Productos desactivados.
   */
  setActive: manage
    .input(z.object({ id: zId, active: z.boolean() }))
    .mutation(({ ctx, input }) => ctx.db.product.update({ where: { id: input.id }, data: { active: input.active } })),

  /** list_price + price history in one transaction. */
  changePrice: permissionProcedure("inventario.precios")
    .input(z.object({ productId: zId, newPrice: zMoney }))
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        const product = await tx.product.update({
          where: { id: input.productId },
          data: { listPrice: input.newPrice },
        });
        await tx.productPriceHistory.create({
          data: { productId: input.productId, newPrice: input.newPrice, changedByUserId: ctx.user.id },
        });
        return product;
      }),
    ),

  /** Initial inventory for a product that already exists (loading the store on day one). */
  initialInventory: manage
    .input(z.object({ productId: zId, quantity: zQty, unitCost: zMoney }))
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        const already = await tx.inventoryMovement.count({
          where: { productId: input.productId, movementType: "INVENTARIO_INICIAL" },
        });
        if (already > 0) throw fail("Este producto ya tiene inventario inicial; use un ajuste de entrada.");
        return recordMovement(tx, {
          productId: input.productId,
          movementType: "INVENTARIO_INICIAL",
          quantity: input.quantity,
          unitCost: input.unitCost,
          userId: ctx.user.id,
        });
      }),
    ),

  /** AJUSTE_ENTRADA / AJUSTE_SALIDA with a mandatory note (ck_inventory_movement_notes). */
  adjust: permissionProcedure("inventario.ajustar")
    .input(
      z.object({
        productId: zId,
        direction: z.enum(["ENTRADA", "SALIDA"]),
        quantity: zQty,
        notes: zText(200),
        /** Only for ENTRADA; default = last cost. */
        unitCost: zMoney.optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((tx) =>
        recordMovement(tx, {
          productId: input.productId,
          movementType: input.direction === "ENTRADA" ? "AJUSTE_ENTRADA" : "AJUSTE_SALIDA",
          quantity: input.quantity,
          notes: input.notes,
          unitCost: input.direction === "ENTRADA" ? input.unitCost : undefined,
          userId: ctx.user.id,
        }),
      ),
    ),
});
