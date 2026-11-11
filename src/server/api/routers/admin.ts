import { z } from "zod";

import { fail } from "~/server/api/errors";
import { createTRPCRouter, permissionProcedure, protectedProcedure } from "~/server/api/trpc";
import { hashPassword, PASSWORD_MIN_LENGTH, verifyPassword } from "~/server/auth/password";
import { DISCOUNT_TYPES, zId, zMoney, zOptText, zText } from "~/server/domain/constants";

/**
 * API-020 — Catalogs and administration, so the business maintains them without
 * touching the database. Nothing here deletes: rows are deactivated (DEC-027).
 */
const NAMED_CATALOGS = [
  "productCategory",
  "productBrand",
  "motorcycleBrand",
  "returnReason",
  "paymentMethod",
  "cashWithdrawalReason",
] as const;
const zCatalog = z.enum(NAMED_CATALOGS);
const ACTIVE_CATALOGS = ["returnReason", "paymentMethod", "cashWithdrawalReason"] as const;
const zActiveCatalog = z.enum(ACTIVE_CATALOGS);

const admin = permissionProcedure("catalogos.gestionar");
const users = permissionProcedure("admin.usuarios");

export const adminRouter = createTRPCRouter({
  // ---- Named catalogs ----------------------------------------------------------
  /** Any logged-in user can read catalogs (they fill the selects). */
  catalog: protectedProcedure.input(z.object({ kind: zCatalog })).query(async ({ ctx, input }) => {
    const orderBy = { name: "asc" as const };
    switch (input.kind) {
      case "productCategory":
        return (await ctx.db.productCategory.findMany({ orderBy })).map((r) => ({ ...r, active: true }));
      case "productBrand":
        return (await ctx.db.productBrand.findMany({ orderBy })).map((r) => ({ ...r, active: true }));
      case "motorcycleBrand":
        return (await ctx.db.motorcycleBrand.findMany({ orderBy })).map((r) => ({ ...r, active: true }));
      case "returnReason":
        return ctx.db.returnReason.findMany({ orderBy });
      case "paymentMethod":
        return ctx.db.paymentMethod.findMany({ orderBy });
      case "cashWithdrawalReason":
        return ctx.db.cashWithdrawalReason.findMany({ orderBy });
    }
  }),

  createCatalogItem: admin
    .input(z.object({ kind: zCatalog, name: zText(80) }))
    .mutation(async ({ ctx, input }) => {
      const data = { name: input.name };
      switch (input.kind) {
        case "productCategory":
          return ctx.db.productCategory.create({ data });
        case "productBrand":
          return ctx.db.productBrand.create({ data });
        case "motorcycleBrand":
          return ctx.db.motorcycleBrand.create({ data });
        case "returnReason":
          return ctx.db.returnReason.create({ data });
        case "paymentMethod":
          return ctx.db.paymentMethod.create({ data });
        case "cashWithdrawalReason":
          return ctx.db.cashWithdrawalReason.create({ data });
      }
    }),

  renameCatalogItem: admin
    .input(z.object({ kind: zCatalog, id: zId, name: zText(80) }))
    .mutation(async ({ ctx, input }) => {
      const args = { where: { id: input.id }, data: { name: input.name } };
      switch (input.kind) {
        case "productCategory":
          return ctx.db.productCategory.update(args);
        case "productBrand":
          return ctx.db.productBrand.update(args);
        case "motorcycleBrand":
          return ctx.db.motorcycleBrand.update(args);
        case "returnReason":
          return ctx.db.returnReason.update(args);
        case "paymentMethod":
          return ctx.db.paymentMethod.update(args);
        case "cashWithdrawalReason":
          return ctx.db.cashWithdrawalReason.update(args);
      }
    }),

  setCatalogItemActive: admin
    .input(z.object({ kind: zActiveCatalog, id: zId, active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const args = { where: { id: input.id }, data: { active: input.active } };
      switch (input.kind) {
        case "returnReason":
          return ctx.db.returnReason.update(args);
        case "paymentMethod":
          return ctx.db.paymentMethod.update(args);
        case "cashWithdrawalReason":
          return ctx.db.cashWithdrawalReason.update(args);
      }
    }),

  // ---- Motorcycle models -------------------------------------------------------
  motorcycleModels: protectedProcedure
    .input(z.object({ motorcycleBrandId: zId.optional() }).default({}))
    .query(({ ctx, input }) =>
      ctx.db.motorcycleModel.findMany({
        where: { motorcycleBrandId: input.motorcycleBrandId },
        include: { brand: true },
        orderBy: [{ brand: { name: "asc" } }, { name: "asc" }],
      }),
    ),
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

  // ---- Workshop catalog (DEC-048) ---------------------------------------------
  /** Jobs grouped by category; also how often each one was asked (to show the usual ones first). */
  serviceTypes: protectedProcedure.query(async ({ ctx }) => {
    const types = await ctx.db.serviceType.findMany({
      include: { category: true, _count: { select: { orderItems: true } } },
      orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
    });
    return types.map(({ _count, ...t }) => ({ ...t, timesOrdered: _count.orderItems }));
  }),
  serviceCategories: protectedProcedure.query(({ ctx }) =>
    ctx.db.serviceCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
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
