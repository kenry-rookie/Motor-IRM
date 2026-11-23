import { z } from "zod";

import { fail } from "~/server/api/errors";
import { createTRPCRouter, permissionProcedure, protectedProcedure } from "~/server/api/trpc";
import { hashPassword, PASSWORD_MIN_LENGTH, verifyPassword } from "~/server/auth/password";
import { VOID_REASON } from "~/server/api/routers/sales";
import { type DbClient, type Prisma } from "~/server/db";
import { DISCOUNT_TYPES, zId, zMoney, zOptText, zText } from "~/server/domain/constants";
import { Sql } from "~/server/domain/sql";

/**
 * API-020 — Catalogs and administration, so the business maintains them without
 * touching the database (DEC-027, DEC-061):
 *   - everything can be renamed and deactivated (deactivated = not offered in
 *     the lists; «Ver desactivados» shows them);
 *   - an item that was NEVER used can be deleted (a typo just created);
 *   - an item used by mistake is MERGED into the right one: its records move to
 *     the right item and the wrong one disappears (e.g. model «Pulsr» → «Pulsar»).
 */
const NAMED_CATALOGS = [
  "productCategory",
  "productBrand",
  "motorcycleBrand",
  "returnReason",
  "paymentMethod",
  "cashWithdrawalReason",
  "tripExpenseType",
] as const;
type CatalogKind = (typeof NAMED_CATALOGS)[number];
const zCatalog = z.enum(NAMED_CATALOGS);

const admin = permissionProcedure("catalogos.gestionar");
const users = permissionProcedure("admin.usuarios");

type Tx = Prisma.TransactionClient;
type Row = { id: number; name: string; active: boolean };
/** The few operations every named catalog has (Prisma delegates share this shape). */
type Delegate = {
  findMany(args: object): Promise<Row[]>;
  findUnique(args: { where: { id: number } }): Promise<Row | null>;
  create(args: { data: { name: string } }): Promise<Row>;
  update(args: { where: { id: number }; data: object }): Promise<Row>;
  delete(args: { where: { id: number } }): Promise<Row>;
};
const delegate = (db: Tx | DbClient, kind: CatalogKind) => db[kind] as unknown as Delegate;

/** How many records use each item (to know if it can be deleted, and to show it). */
async function usage(db: Tx | DbClient, kind: CatalogKind): Promise<Map<number, number>> {
  const q = new Sql();
  const sql: Record<CatalogKind, string> = {
    productCategory: `SELECT product_category_id AS id, count(*)::int AS n FROM product GROUP BY 1`,
    productBrand: `SELECT product_brand_id AS id, count(*)::int AS n FROM product GROUP BY 1`,
    motorcycleBrand: `SELECT mm.motorcycle_brand_id AS id, count(m.id)::int + count(DISTINCT mm.id)::int AS n
                        FROM motorcycle_model mm LEFT JOIN motorcycle m ON m.motorcycle_model_id = mm.id GROUP BY 1`,
    returnReason: `SELECT id, sum(n)::int AS n FROM (SELECT return_reason_id AS id, count(*) AS n FROM customer_return GROUP BY 1
                     UNION ALL SELECT return_reason_id, count(*) FROM supplier_return GROUP BY 1) x GROUP BY 1`,
    paymentMethod: `SELECT payment_method_id AS id, count(*)::int AS n FROM customer_payment GROUP BY 1`,
    cashWithdrawalReason: `SELECT cash_withdrawal_reason_id AS id, count(*)::int AS n FROM cash_withdrawal GROUP BY 1`,
    tripExpenseType: `SELECT trip_expense_type_id AS id, count(*)::int AS n FROM purchase_trip_expense GROUP BY 1`,
  };
  const rows = await q.run<{ id: number; n: number }[]>(db, sql[kind]);
  return new Map(rows.map((r) => [r.id, Number(r.n)]));
}

/** Names the code depends on: they can't be renamed, merged, deleted or deactivated. */
function protectedItem(kind: CatalogKind, name: string) {
  const n = name.trim().toLowerCase();
  if (kind === "paymentMethod" && n === "efectivo") return "«Efectivo» es el método que la caja cuenta como dinero de la gaveta: no se cambia.";
  if (kind === "returnReason" && n === VOID_REASON.toLowerCase()) return `«${VOID_REASON}» lo usa el botón «Anular factura»: no se cambia.`;
  return null;
}

async function getItem(db: Tx | DbClient, kind: CatalogKind, id: number) {
  const r = await delegate(db, kind).findUnique({ where: { id } });
  if (!r) throw fail("Ese elemento no existe.", "NOT_FOUND");
  return r;
}

/** Moves every record of `fromId` to `intoId` (same catalog). Raw SQL: one statement per table. */
async function moveReferences(tx: Tx, kind: CatalogKind, fromId: number, intoId: number) {
  const run = (sql: string) => tx.$executeRawUnsafe(sql, intoId, fromId);
  switch (kind) {
    case "productCategory":
      return run(`UPDATE product SET product_category_id = $1 WHERE product_category_id = $2`);
    case "productBrand":
      return run(`UPDATE product SET product_brand_id = $1 WHERE product_brand_id = $2`);
    case "returnReason":
      await run(`UPDATE customer_return SET return_reason_id = $1 WHERE return_reason_id = $2`);
      return run(`UPDATE supplier_return SET return_reason_id = $1 WHERE return_reason_id = $2`);
    case "paymentMethod":
      return run(`UPDATE customer_payment SET payment_method_id = $1 WHERE payment_method_id = $2`);
    case "cashWithdrawalReason":
      return run(`UPDATE cash_withdrawal SET cash_withdrawal_reason_id = $1 WHERE cash_withdrawal_reason_id = $2`);
    case "tripExpenseType":
      return run(`UPDATE purchase_trip_expense SET trip_expense_type_id = $1 WHERE trip_expense_type_id = $2`);
    case "motorcycleBrand": {
      // Each model of the wrong brand: if the right brand already has a model with that
      // name, its motorcycles move there and the duplicate model goes; otherwise the model moves.
      const models = await tx.motorcycleModel.findMany({ where: { motorcycleBrandId: fromId } });
      for (const m of models) {
        const twin = await tx.motorcycleModel.findFirst({
          where: { motorcycleBrandId: intoId, name: { equals: m.name.trim(), mode: "insensitive" } },
        });
        if (twin) {
          await tx.motorcycle.updateMany({ where: { motorcycleModelId: m.id }, data: { motorcycleModelId: twin.id } });
          await tx.motorcycleModel.delete({ where: { id: m.id } });
        } else {
          await tx.motorcycleModel.update({ where: { id: m.id }, data: { motorcycleBrandId: intoId } });
        }
      }
      return;
    }
  }
}

export const adminRouter = createTRPCRouter({
  // ---- Named catalogs ----------------------------------------------------------
  /**
   * Any logged-in user can read catalogs (they fill the selects). Every row has
   * `active`; `onlyActive` leaves the deactivated ones out (the selects), and
   * `uses` says how many records use it (Administración).
   */
  catalog: protectedProcedure
    .input(z.object({ kind: zCatalog, onlyActive: z.boolean().default(false) }))
    .query(async ({ ctx, input }) => {
      const rows = await delegate(ctx.db, input.kind).findMany({
        where: input.onlyActive ? { active: true } : undefined,
        orderBy: { name: "asc" },
      });
      const uses = await usage(ctx.db, input.kind);
      return rows.map((r) => ({ id: r.id, name: r.name, active: r.active, uses: uses.get(r.id) ?? 0 }));
    }),

  createCatalogItem: admin
    .input(z.object({ kind: zCatalog, name: zText(80) }))
    .mutation(({ ctx, input }) => delegate(ctx.db, input.kind).create({ data: { name: input.name } })),

  renameCatalogItem: admin
    .input(z.object({ kind: zCatalog, id: zId, name: zText(80) }))
    .mutation(async ({ ctx, input }) => {
      const item = await getItem(ctx.db, input.kind, input.id);
      const p = protectedItem(input.kind, item.name);
      if (p && item.name.trim().toLowerCase() !== input.name.trim().toLowerCase()) throw fail(p);
      return delegate(ctx.db, input.kind).update({ where: { id: input.id }, data: { name: input.name } });
    }),

  setCatalogItemActive: admin
    .input(z.object({ kind: zCatalog, id: zId, active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const item = await getItem(ctx.db, input.kind, input.id);
      const p = protectedItem(input.kind, item.name);
      if (p && !input.active) throw fail(p);
      return delegate(ctx.db, input.kind).update({ where: { id: input.id }, data: { active: input.active } });
    }),

  /** Deletes an item nobody uses (e.g. a typo just created). In use → deactivate or merge. */
  deleteCatalogItem: admin.input(z.object({ kind: zCatalog, id: zId })).mutation(({ ctx, input }) =>
    ctx.db.$transaction(async (tx) => {
      const item = await getItem(tx, input.kind, input.id);
      const p = protectedItem(input.kind, item.name);
      if (p) throw fail(p);
      const n = (await usage(tx, input.kind)).get(input.id) ?? 0;
      if (n > 0) throw fail(`«${item.name}» está en uso (${n}): desactívelo o únalo con el correcto.`, "CONFLICT");
      await delegate(tx, input.kind).delete({ where: { id: input.id } });
      return { deleted: true };
    }),
  ),

  /** Merges a wrong item into the right one: every record moves, the wrong one is deleted. */
  mergeCatalogItem: admin
    .input(z.object({ kind: zCatalog, fromId: zId, intoId: zId }))
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        if (input.fromId === input.intoId) throw fail("Elija otro elemento: no se une consigo mismo.");
        const from = await getItem(tx, input.kind, input.fromId);
        await getItem(tx, input.kind, input.intoId);
        const p = protectedItem(input.kind, from.name);
        if (p) throw fail(p);
        await moveReferences(tx, input.kind, input.fromId, input.intoId);
        await delegate(tx, input.kind).delete({ where: { id: input.fromId } });
        return { merged: true };
      }),
    ),

  // ---- Motorcycle models -------------------------------------------------------
  motorcycleModels: protectedProcedure
    .input(z.object({ motorcycleBrandId: zId.optional(), onlyActive: z.boolean().default(false) }).default({}))
    .query(async ({ ctx, input }) => {
      const models = await ctx.db.motorcycleModel.findMany({
        where: {
          motorcycleBrandId: input.motorcycleBrandId,
          ...(input.onlyActive ? { active: true, brand: { active: true } } : {}),
        },
        include: { brand: true, _count: { select: { motorcycles: true } } },
        orderBy: [{ brand: { name: "asc" } }, { name: "asc" }],
      });
      return models.map(({ _count, ...m }) => ({ ...m, uses: _count.motorcycles }));
    }),
  saveMotorcycleModel: admin
    .input(z.object({ id: zId.optional(), motorcycleBrandId: zId, name: zText(50) }))
    .mutation(({ ctx, input }) =>
      input.id
        ? ctx.db.motorcycleModel.update({
            where: { id: input.id },
            data: { motorcycleBrandId: input.motorcycleBrandId, name: input.name },
          })
        : ctx.db.motorcycleModel.create({ data: { motorcycleBrandId: input.motorcycleBrandId, name: input.name } }),
    ),
  setMotorcycleModelActive: admin
    .input(z.object({ id: zId, active: z.boolean() }))
    .mutation(({ ctx, input }) => ctx.db.motorcycleModel.update({ where: { id: input.id }, data: { active: input.active } })),
  /** A model no motorcycle uses can be deleted; one in use is merged into the right model. */
  deleteMotorcycleModel: admin.input(z.object({ id: zId })).mutation(({ ctx, input }) =>
    ctx.db.$transaction(async (tx) => {
      const n = await tx.motorcycle.count({ where: { motorcycleModelId: input.id } });
      if (n > 0) throw fail(`Hay ${n} moto(s) con ese modelo: únalo con el modelo correcto o desactívelo.`, "CONFLICT");
      await tx.motorcycleModel.delete({ where: { id: input.id } });
      return { deleted: true };
    }),
  ),
  mergeMotorcycleModel: admin.input(z.object({ fromId: zId, intoId: zId })).mutation(({ ctx, input }) =>
    ctx.db.$transaction(async (tx) => {
      if (input.fromId === input.intoId) throw fail("Elija otro modelo: no se une consigo mismo.");
      await tx.motorcycleModel.findUniqueOrThrow({ where: { id: input.intoId } });
      await tx.motorcycle.updateMany({ where: { motorcycleModelId: input.fromId }, data: { motorcycleModelId: input.intoId } });
      await tx.motorcycleModel.delete({ where: { id: input.fromId } });
      return { merged: true };
    }),
  ),

  // ---- Workshop catalog (DEC-048) ---------------------------------------------
  /** Jobs grouped by category; also how often each one was asked (to show the usual ones first). */
  serviceTypes: protectedProcedure.query(async ({ ctx }) => {
    const types = await ctx.db.serviceType.findMany({
      include: { category: true, _count: { select: { orderItems: true } } },
      orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
    });
    return types.map(({ _count, ...t }) => ({ ...t, timesOrdered: _count.orderItems }));
  }),
  serviceCategories: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.serviceCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { serviceTypes: true } } },
    });
    return rows.map(({ _count, ...c }) => ({ ...c, uses: _count.serviceTypes }));
  }),
  setServiceCategoryActive: admin
    .input(z.object({ id: zId, active: z.boolean() }))
    .mutation(({ ctx, input }) => ctx.db.serviceCategory.update({ where: { id: input.id }, data: { active: input.active } })),
  /** A category without jobs can be deleted; with jobs, move them or deactivate it. */
  deleteServiceCategory: admin.input(z.object({ id: zId })).mutation(({ ctx, input }) =>
    ctx.db.$transaction(async (tx) => {
      const n = await tx.serviceType.count({ where: { serviceCategoryId: input.id } });
      if (n > 0) throw fail(`La categoría tiene ${n} trabajo(s): páselos a otra categoría o desactívela.`, "CONFLICT");
      await tx.serviceCategory.delete({ where: { id: input.id } });
      return { deleted: true };
    }),
  ),
  saveServiceCategory: admin
    .input(z.object({ id: zId.optional(), name: zText(40), sortOrder: z.number().int().min(0).max(999).default(100) }))
    .mutation(({ ctx, input }) => {
      const data = { name: input.name, sortOrder: input.sortOrder };
      return input.id
        ? ctx.db.serviceCategory.update({ where: { id: input.id }, data })
        : ctx.db.serviceCategory.create({ data });
    }),
  /** Only owners (catalogos.gestionar) add jobs, so the catalog grows in order (prompt §7.2). */
  saveServiceType: admin
    .input(
      z
        .object({
          id: zId.optional(),
          name: zText(50),
          serviceCategoryId: zId,
          referencePrice: zMoney.nullish(),
          minPrice: zMoney.nullish(),
          maxPrice: zMoney.nullish(),
          active: z.boolean().default(true),
        })
        .refine((v) => !v.minPrice || !v.maxPrice || Number(v.maxPrice) >= Number(v.minPrice), {
          path: ["maxPrice"],
          message: "El máximo no puede ser menor que el mínimo",
        }),
    )
    .mutation(({ ctx, input }) => {
      const data = {
        name: input.name,
        serviceCategoryId: input.serviceCategoryId,
        referencePrice: input.referencePrice ?? null,
        minPrice: input.minPrice ?? null,
        maxPrice: input.maxPrice ?? null,
        active: input.active,
      };
      return input.id
        ? ctx.db.serviceType.update({ where: { id: input.id }, data, include: { category: true } })
        : ctx.db.serviceType.create({ data, include: { category: true } });
    }),

  // ---- Discounts ---------------------------------------------------------------
  discounts: protectedProcedure.query(({ ctx }) => ctx.db.discount.findMany({ orderBy: { name: "asc" } })),
  saveDiscount: admin
    .input(
      z.object({
        id: zId.optional(),
        name: zText(80),
        discountType: z.enum(DISCOUNT_TYPES),
        /** PORCENTAJE: 0–1 ("0.10" = 10 %). MONTO: córdobas. */
        value: z.string().regex(/^\d{1,8}(\.\d{1,4})?$/),
        active: z.boolean().default(true),
      }),
    )
    .mutation(({ ctx, input }) => {
      const data = { name: input.name, discountType: input.discountType, value: input.value, active: input.active };
      return input.id ? ctx.db.discount.update({ where: { id: input.id }, data }) : ctx.db.discount.create({ data });
    }),

  // ---- Users, roles, permissions ----------------------------------------------
  users: users.query(({ ctx }) =>
    ctx.db.appUser.findMany({
      select: {
        id: true,
        username: true,
        active: true,
        createdAt: true,
        lastLoginAt: true,
        role: { select: { id: true, name: true } },
        staff: { select: { id: true, name: true } },
      },
      orderBy: { username: "asc" },
    }),
  ),

  createUser: users
    .input(
      z.object({
        username: zText(30),
        password: z.string().min(PASSWORD_MIN_LENGTH, `Mínimo ${PASSWORD_MIN_LENGTH} caracteres`),
        roleId: zId,
        staffId: zId.nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.appUser.create({
        data: {
          username: input.username,
          passwordHash: await hashPassword(input.password),
          roleId: input.roleId,
          staffId: input.staffId ?? null,
        },
      });
      return { id: user.id, username: user.username };
    }),

  updateUser: users
    .input(
      z.object({
        id: zId,
        roleId: zId.optional(),
        staffId: zId.nullish(),
        active: z.boolean().optional(),
        newPassword: z.string().min(PASSWORD_MIN_LENGTH).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.id === ctx.user.id && input.active === false) throw fail("No puede desactivar su propio usuario.");
      await ctx.db.appUser.update({
        where: { id: input.id },
        data: {
          roleId: input.roleId,
          staffId: input.staffId,
          active: input.active,
          passwordHash: input.newPassword ? await hashPassword(input.newPassword) : undefined,
        },
      });
      // Deactivating or resetting the password closes the user's sessions.
      if (input.active === false || input.newPassword) {
        await ctx.db.appSession.deleteMany({ where: { appUserId: input.id } });
      }
      return { ok: true };
    }),

  roles: users.query(({ ctx }) =>
    ctx.db.role.findMany({
      include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
      orderBy: { name: "asc" },
    }),
  ),
  permissions: users.query(({ ctx }) => ctx.db.permission.findMany({ orderBy: { code: "asc" } })),

  /**
   * Changing what a role can do asks for the password of the person saving it,
   * even an owner who is already logged in (DEC-050): a computer left open at
   * the counter must not be enough to hand out permissions.
   */
  saveRole: users
    .input(
      z.object({
        id: zId.optional(),
        name: zText(50),
        description: zOptText(200),
        active: z.boolean().default(true),
        permissionIds: z.array(zId),
        confirmPassword: z.string().min(1, "Escriba su contraseña para guardar"),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        const me = await tx.appUser.findUniqueOrThrow({ where: { id: ctx.user.id } });
        if (!(await verifyPassword(input.confirmPassword, me.passwordHash))) {
          throw fail("La contraseña no es correcta; no se guardaron los permisos.", "FORBIDDEN");
        }
        const own = await tx.appUser.findFirst({ where: { id: ctx.user.id, roleId: input.id } });
        const adminPerm = await tx.permission.findUnique({ where: { code: "admin.usuarios" } });
        if (own && adminPerm && !input.permissionIds.includes(adminPerm.id)) {
          throw fail("No puede quitarle a su propio rol el permiso de administrar usuarios.");
        }
        const data = { name: input.name, description: input.description ?? null, active: input.active };
        const role = input.id
          ? await tx.role.update({ where: { id: input.id }, data })
          : await tx.role.create({ data });
        await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
        await tx.rolePermission.createMany({
          data: input.permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
        });
        return role;
      }),
    ),
});
