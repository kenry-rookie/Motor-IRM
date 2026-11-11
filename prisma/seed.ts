/**
 * API-007 — Seed: what a NEW database needs to be usable.
 *
 *   npm run db:seed            roles, permissions, catalogs and the first admin
 *   SEED_DEMO=true npm run db:seed   …plus demo data for class / testing
 *
 * It is idempotent: running it twice doesn't duplicate anything (it looks rows up
 * by name before inserting). Role permissions are re-synced to the defaults only
 * when the role is created; after that the owners manage them in Administración.
 */
import { PrismaClient } from "../generated/prisma";
import { hashPassword } from "../src/server/auth/password";
import { DEFAULT_ROLES, PERMISSIONS } from "../src/server/auth/permissions";
import { demoMore } from "./demo-more";

const db = new PrismaClient();

async function ensureNamed<T extends { id: number }>(
  find: (name: string) => Promise<T | null>,
  create: (name: string) => Promise<T>,
  names: string[],
) {
  const out: Record<string, T> = {};
  for (const name of names) out[name] = (await find(name)) ?? (await create(name));
  return out;
}
const ci = (name: string) => ({ name: { equals: name, mode: "insensitive" as const } });

async function base() {
  // Permissions
  for (const [code, description] of Object.entries(PERMISSIONS)) {
    await db.permission.upsert({ where: { code }, update: { description }, create: { code, description } });
  }
  const perms = await db.permission.findMany();
  const permId = new Map(perms.map((p) => [p.code, p.id]));

  // Roles
  const roles: Record<string, number> = {};
  for (const [name, def] of Object.entries(DEFAULT_ROLES)) {
    let role = await db.role.findFirst({ where: ci(name) });
    if (!role) {
      role = await db.role.create({ data: { name, description: def.description } });
      await db.rolePermission.createMany({
        data: def.permissions.map((code) => ({ roleId: role!.id, permissionId: permId.get(code)! })),
      });
    }
    roles[name] = role.id;
  }
  // An owner can do everything: permissions added in a new version reach the
  // "Dueño" role too (the other roles keep what the owners chose).
  const owner = roles["Dueño"];
  if (owner) {
    await db.rolePermission.createMany({
      data: perms.map((p) => ({ roleId: owner, permissionId: p.id })),
      skipDuplicates: true,
    });
  }

  // Catalogs
  await ensureNamed((n) => db.paymentMethod.findFirst({ where: ci(n) }), (name) => db.paymentMethod.create({ data: { name } }), [
    "Efectivo",
    "Transferencia",
    "Tarjeta",
  ]);
  await ensureNamed((n) => db.returnReason.findFirst({ where: ci(n) }), (name) => db.returnReason.create({ data: { name } }), [
    "Producto defectuoso",
    "No es compatible con la moto",
    "El cliente cambió de opinión",
    "Error en el pedido",
  ]);
  await ensureNamed(
    (n) => db.cashWithdrawalReason.findFirst({ where: ci(n) }),
    (name) => db.cashWithdrawalReason.create({ data: { name } }),
    ["Viaje a Managua (compras)", "Gastos del negocio", "Retiro de dueño"],
  );
  await ensureNamed((n) => db.productCategory.findFirst({ where: ci(n) }), (name) => db.productCategory.create({ data: { name } }), [
    "Repuestos",
    "Accesorios",
    "Lubricantes",
    "Iluminación",
    "Protectores",
    "Rodamientos",
  ]);
  await ensureNamed((n) => db.productBrand.findFirst({ where: ci(n) }), (name) => db.productBrand.create({ data: { name } }), [
    "Genérico",
  ]);
  await workshopCatalog();

  // First administrator
  const username = process.env.SEED_ADMIN_USERNAME ?? "admin";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "cambiar-esta-clave";
  const existing = await db.appUser.findFirst({ where: { username: { equals: username, mode: "insensitive" } } });
  if (!existing) {
    // The first owner is also a person of the shop (DEC-041), so he can be the
    // responsible of a motorcycle. Rename it from Personal with the real name.
    const owner = await db.staff.create({ data: { name: "Dueño (cambiar nombre)", phone: "0000-0000", kind: "DUENO" } });
    await db.appUser.create({
      data: { username, passwordHash: await hashPassword(password), roleId: roles["Dueño"]!, staffId: owner.id },
    });
    console.log(`👤 Usuario administrador creado: ${username} (cambie la contraseña al entrar)`);
  }
  return roles;
}

/**
 * The workshop catalog (DEC-048): standard jobs by category, with a reference
 * price and, where it makes sense, the allowed range (outside it an owner's key
 * is needed). Existing jobs are not touched: the owners may have edited them.
 */
async function workshopCatalog() {
  const CATEGORIES: [string, number][] = [
    ["Mantenimiento", 10], ["Frenos", 20], ["Motor", 30], ["Sistema eléctrico", 40], ["Suspensión y dirección", 50],
    ["Transmisión", 60], ["Llantas", 70], ["Accesorios", 80], ["Diagnóstico", 90], ["Otros cargos", 200],
  ];
  const cat: Record<string, number> = {};
  for (const [name, sortOrder] of CATEGORIES) {
    const c = (await db.serviceCategory.findFirst({ where: ci(name) })) ?? (await db.serviceCategory.create({ data: { name, sortOrder } }));
    cat[name] = c.id;
  }
  // [name, category, reference, min, max]
  const JOBS: [string, string, string | null, string | null, string | null][] = [
    ["Cambio de aceite", "Mantenimiento", "150", "100", "250"],
    ["Engrase", "Mantenimiento", "400", "300", "600"],
    ["Mantenimiento general", "Mantenimiento", "800", "600", "1500"],
    ["Lavado y lubricación de cadena", "Mantenimiento", "150", "100", "250"],
    ["Ajuste de cadena", "Mantenimiento", "100", "50", "200"],
    ["Cambio de filtro de aire", "Mantenimiento", "100", "50", "200"],
    ["Cambio de bujía", "Mantenimiento", "80", "50", "150"],
    ["Cambio de pastillas de freno", "Frenos", "250", "150", "400"],
    ["Cambio de zapatas", "Frenos", "250", "150", "400"],
    ["Purga de frenos", "Frenos", "200", "150", "350"],
    ["Rectificado de disco", "Frenos", "300", null, null],
    ["Trabajo de motor", "Motor", null, null, null],
    ["Limpieza de carburador", "Motor", "500", "350", "800"],
    ["Calibración de válvulas", "Motor", "400", "300", "600"],
    ["Cambio de empaques", "Motor", "600", null, null],
    ["Revisión eléctrica", "Sistema eléctrico", "300", "200", "600"],
    ["Cambio de batería", "Sistema eléctrico", "100", "50", "200"],
    ["Instalación de luces", "Sistema eléctrico", "250", "150", "500"],
    ["Cambio de aceite de barras", "Suspensión y dirección", "500", "400", "800"],
    ["Cambio de rodamientos de dirección", "Suspensión y dirección", "450", "300", "700"],
    ["Cambio de kit de arrastre", "Transmisión", "350", "250", "500"],
    ["Ajuste de clutch", "Transmisión", "150", "100", "250"],
    ["Cambio de cable de clutch", "Transmisión", "150", "100", "250"],
    ["Cambio de llanta", "Llantas", "100", "50", "200"],
    ["Reparación de neumático", "Llantas", "80", "50", "150"],
    ["Cambio de rodamientos de rueda", "Llantas", "300", "200", "450"],
    ["Instalación de accesorio", "Accesorios", "200", "100", "500"],
    ["Diagnóstico", "Diagnóstico", null, null, null],
    ["Cargo por cancelación", "Otros cargos", null, null, null],
  ];
  for (const [name, category, referencePrice, minPrice, maxPrice] of JOBS) {
    if (!(await db.serviceType.findFirst({ where: ci(name) }))) {
      await db.serviceType.create({ data: { name, serviceCategoryId: cat[category]!, referencePrice, minPrice, maxPrice } });
    }
  }
}

/** Small, realistic demo data (from the real purchase invoice and interviews). */
async function demo(roles: Record<string, number>) {
  if ((await db.product.count()) > 0) {
    console.log("ℹ️  Ya hay productos: no se cargan datos de demostración.");
    return;
  }
  const admin = await db.appUser.findFirstOrThrow({ where: { roleId: roles["Dueño"] }, orderBy: { id: "asc" } });

  const brands = await ensureNamed((n) => db.productBrand.findFirst({ where: ci(n) }), (name) => db.productBrand.create({ data: { name } }), [
    "KOYO",
    "NGK",
    "BINDA",
    "Protaper",
    "Monster",
  ]);
  const cat = Object.fromEntries((await db.productCategory.findMany()).map((c) => [c.name, c.id]));
  const generic = (await db.productBrand.findFirstOrThrow({ where: ci("Genérico") })).id;
  const products: [string, number, string, "ALTA" | "MEDIA" | "BAJA", string, string, number, string][] = [
    ["Bujía NGK C7HSA", brands.NGK!.id, "Repuestos", "ALTA", "120", "75", 20, "7501234500011"],
    ["Rodamiento 6301 KOYO", brands.KOYO!.id, "Rodamientos", "ALTA", "180", "110", 12, "7501234500028"],
    ["Aceite 20W-50 1L", generic, "Lubricantes", "MEDIA", "220", "160", 30, "7501234500035"],
    ["Pastillas de freno delanteras", generic, "Repuestos", "MEDIA", "250", "150", 8, "7501234500042"],
    ["Cadena 428H", generic, "Repuestos", "BAJA", "450", "300", 5, "7501234500059"],
    ["Foco LED delantero", generic, "Iluminación", "MEDIA", "380", "240", 6, "7501234500066"],
    ["Manillar Protaper", brands.Protaper!.id, "Accesorios", "ALTA", "1200", "850", 2, "7501234500073"],
    ["Guantes Monster", brands.Monster!.id, "Protectores", "BAJA", "300", "180", 10, "7501234500080"],
  ];
  for (const [name, brandId, category, tier, price, cost, qty, barcode] of products) {
    const p = await db.product.create({
      data: { name, productBrandId: brandId, productCategoryId: cat[category]!, qualityTier: tier, listPrice: price, barcode },
    });
    await db.productPriceHistory.create({ data: { productId: p.id, newPrice: price, changedByUserId: admin.id } });
    await db.inventoryMovement.create({
      data: { productId: p.id, movementType: "INVENTARIO_INICIAL", quantity: qty, unitCost: cost, registeredByUserId: admin.id },
    });
  }

  // Fictitious people (no real personal data in seeds, prompt v2 §14).
  // The "100 %" mechanic keeps all his labor and is not paid by the system: no rate (DEC-041).
  for (const [name, phone, rate, kind] of [
    ["Mario Taller", "8000-0001", "0.6000", "MECANICO"],
    ["Pablo Llave", "8000-0002", null, "MECANICO"],
    ["Segundo Dueño", "8000-0003", null, "DUENO"],
  ] as const) {
    if (!(await db.staff.findFirst({ where: ci(name) }))) {
      await db.staff.create({ data: { name, phone, commissionRate: rate, kind } });
    }
  }
  const encargado = await db.staff.create({
    data: { name: "Encargado de mostrador", phone: "8000-0004", kind: "ENCARGADO", canRepair: false },
  });
  await db.appUser.create({
    data: {
      username: "encargado",
      passwordHash: await hashPassword("encargado123"),
      roleId: roles.Encargado!,
      staffId: encargado.id,
    },
  });

  const mb = await ensureNamed((n) => db.motorcycleBrand.findFirst({ where: ci(n) }), (name) => db.motorcycleBrand.create({ data: { name } }), [
    "Bajaj",
    "Yamaha",
    "Suzuki",
  ]);
  const pulsar = await db.motorcycleModel.create({ data: { motorcycleBrandId: mb.Bajaj!.id, name: "Pulsar 150" } });
  const ybr = await db.motorcycleModel.create({ data: { motorcycleBrandId: mb.Yamaha!.id, name: "YBR 125" } });
  await db.customer.create({
    data: {
      name: "Juan Pérez",
      phone: "8888-1111",
      motorcycles: { create: [{ motorcycleModelId: pulsar.id, color: "Negra", plate: "M 123-456" }] },
    },
  });
  await db.customer.create({
    data: {
      name: "María López",
      phone: "8777-2222",
      nationalId: "001-010190-0001A",
      motorcycles: { create: [{ motorcycleModelId: ybr.id, color: "Roja", plate: "M 654-321" }] },
    },
  });
  await db.supplier.create({ data: { name: "Distribuidora MotoNica", phone: "2221-0303", givesWarranty: false } });
  console.log("🧪 Datos de demostración cargados (usuario «encargado», clave «encargado123»).");
}

async function main() {
  const roles = await base();
  if (process.env.SEED_DEMO === "true") {
    await demo(roles);
    const admin = await db.appUser.findFirstOrThrow({ where: { roleId: roles["Dueño"] }, orderBy: { id: "asc" } });
    await demoMore(db, admin.id);
  }
  console.log("✅ Seed terminado.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void db.$disconnect());
