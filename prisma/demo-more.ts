/**
 * More demo data (prompt v2 + Kenry, 10-nov): ~40 products, 4 suppliers with
 * their purchases (so each supplier "sells" known products), 10 customers with
 * and without debts, sales over the last weeks, and workshop history.
 *
 * Everything is FICTITIOUS (no real personal data, prompt §14). It runs once:
 * if the supplier "Repuestos El Pistón" exists, it does nothing. It never
 * touches the products of the first demo (the tests count their stock).
 */
import { type PrismaClient, Prisma } from "../generated/prisma";

type Db = PrismaClient;
const D = (v: string | number) => new Prisma.Decimal(v);
const ci = (name: string) => ({ name: { equals: name, mode: "insensitive" as const } });

/** An instant n days ago at `hour` in Managua (UTC−6). */
const daysAgo = (n: number, hour = 10) => {
  const d = new Date();
  d.setUTCHours(hour + 6, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
};
/** The calendar day of an instant in Managua, as Prisma expects for DATE columns. */
const day = (d: Date) => new Date(`${new Intl.DateTimeFormat("en-CA", { timeZone: "America/Managua" }).format(d)}T00:00:00.000Z`);

// [name, brand, category, tier, price, cost, supplier]
type P = [string, string, string, "ALTA" | "MEDIA" | "BAJA", string, string, string];
const PRODUCTS: P[] = [
  ["Aceite Motul 3000 20W-50 1L", "Motul", "Lubricantes", "ALTA", "290", "205", "Lubricantes Nica"],
  ["Aceite Castrol Actevo 20W-50 1L", "Castrol", "Lubricantes", "ALTA", "300", "215", "Lubricantes Nica"],
  ["Aceite 2T para mezcla 1L", "Genérico", "Lubricantes", "MEDIA", "180", "120", "Lubricantes Nica"],
  ["Aceite de barras 10W 500 ml", "Motul", "Lubricantes", "ALTA", "260", "180", "Lubricantes Nica"],
  ["Grasa multiuso 250 g", "Genérico", "Lubricantes", "MEDIA", "120", "75", "Lubricantes Nica"],
  ["Lubricante de cadena en spray", "Motul", "Lubricantes", "ALTA", "350", "250", "Lubricantes Nica"],
  ["Líquido de frenos DOT 4 250 ml", "Castrol", "Lubricantes", "ALTA", "190", "130", "Lubricantes Nica"],
  ["Filtro de aceite Pulsar 150/180", "Genérico", "Filtros", "MEDIA", "140", "85", "Repuestos El Pistón"],
  ["Filtro de aire Boxer 150", "Genérico", "Filtros", "MEDIA", "160", "95", "Repuestos El Pistón"],
  ["Filtro de aire XR 150", "Genérico", "Filtros", "MEDIA", "170", "100", "Repuestos El Pistón"],
  ["Bujía NGK CR7HSA", "NGK", "Repuestos", "ALTA", "130", "80", "Repuestos El Pistón"],
  ["Bujía NGK D8EA", "NGK", "Repuestos", "ALTA", "140", "85", "Repuestos El Pistón"],
  ["Pastillas de freno traseras", "Genérico", "Frenos", "MEDIA", "230", "140", "Repuestos El Pistón"],
  ["Zapatas de freno Boxer", "Genérico", "Frenos", "BAJA", "180", "105", "Repuestos El Pistón"],
  ["Disco de freno delantero Pulsar", "Genérico", "Frenos", "MEDIA", "950", "640", "Importadora Moto Sur"],
  ["Cable de freno trasero", "Genérico", "Cables", "BAJA", "110", "60", "Repuestos El Pistón"],
  ["Cable de clutch universal", "Genérico", "Cables", "BAJA", "120", "65", "Repuestos El Pistón"],
  ["Cable de acelerador", "Genérico", "Cables", "BAJA", "120", "65", "Repuestos El Pistón"],
  ["Kit de arrastre 428 (cadena y piñones)", "DID", "Transmisión", "ALTA", "1450", "1020", "Importadora Moto Sur"],
  ["Cadena 520 reforzada", "DID", "Transmisión", "ALTA", "980", "690", "Importadora Moto Sur"],
  ["Piñón delantero 14T", "Genérico", "Transmisión", "MEDIA", "220", "130", "Importadora Moto Sur"],
  ["Corona 43T", "Genérico", "Transmisión", "MEDIA", "420", "270", "Importadora Moto Sur"],
  ["Kit de clutch (discos) Pulsar", "Genérico", "Transmisión", "MEDIA", "780", "520", "Importadora Moto Sur"],
  ["Llanta delantera 2.75-18", "Pirelli", "Llantas", "ALTA", "1350", "980", "Llantas y Más Masaya"],
  ["Llanta trasera 3.00-18", "Pirelli", "Llantas", "ALTA", "1550", "1120", "Llantas y Más Masaya"],
  ["Llanta trasera 90/90-18", "Michelin", "Llantas", "ALTA", "1890", "1380", "Llantas y Más Masaya"],
  ["Neumático (tubo) 18 pulgadas", "Genérico", "Llantas", "MEDIA", "260", "160", "Llantas y Más Masaya"],
  ["Válvula de neumático", "Genérico", "Llantas", "BAJA", "40", "18", "Llantas y Más Masaya"],
  ["Batería 12V 5Ah", "Yuasa", "Eléctrico", "ALTA", "1250", "880", "Importadora Moto Sur"],
  ["Batería 12V 7Ah", "Yuasa", "Eléctrico", "ALTA", "1480", "1050", "Importadora Moto Sur"],
  ["Regulador de voltaje", "Genérico", "Eléctrico", "MEDIA", "450", "290", "Importadora Moto Sur"],
  ["Bombillo de faro H4", "Genérico", "Iluminación", "MEDIA", "120", "70", "Repuestos El Pistón"],
  ["Direccional LED (par)", "Genérico", "Iluminación", "MEDIA", "280", "170", "Repuestos El Pistón"],
  ["Stop trasero LED", "Genérico", "Iluminación", "MEDIA", "350", "220", "Repuestos El Pistón"],
  ["Rodamiento 6202 KOYO", "KOYO", "Rodamientos", "ALTA", "170", "105", "Importadora Moto Sur"],
  ["Rodamientos de dirección (juego)", "KOYO", "Rodamientos", "ALTA", "520", "350", "Importadora Moto Sur"],
  ["Casco integral talla M", "Genérico", "Protectores", "MEDIA", "1800", "1250", "Importadora Moto Sur"],
  ["Casco abierto talla L", "Genérico", "Protectores", "BAJA", "950", "620", "Importadora Moto Sur"],
  ["Retrovisores cromados (par)", "Genérico", "Accesorios", "BAJA", "320", "190", "Repuestos El Pistón"],
  ["Puños de manubrio", "Protaper", "Accesorios", "ALTA", "380", "240", "Repuestos El Pistón"],
  ["Forro de asiento", "Genérico", "Accesorios", "BAJA", "250", "140", "Repuestos El Pistón"],
  ["Candado de disco", "Genérico", "Accesorios", "MEDIA", "450", "290", "Importadora Moto Sur"],
];

const SUPPLIERS: [string, string, string, boolean][] = [
  ["Repuestos El Pistón", "2255-1100", "Doña Marta (ventas)", true],
  ["Importadora Moto Sur", "2266-2200", "Ing. Roberto (ventas)", false],
  ["Lubricantes Nica", "2277-3300", "Atención al cliente", true],
  ["Llantas y Más Masaya", "2522-4400", "Don Julio", false],
];

// [name, phone, cédula|null, motorcycle [brand, model, color, plate|null] | null]
const CUSTOMERS: [string, string, string | null, [string, string, string, string | null] | null][] = [
  ["Ana Gutiérrez Rocha", "8100-0001", null, ["Honda", "XR 150L", "Roja", "M 210-401"]],
  ["Luis Mendoza Pérez", "8100-0002", "001-020285-0003C", ["Bajaj", "Boxer 150", "Azul", "M 210-402"]],
  ["Rosa Hernández López", "8100-0003", null, null],
  ["Pedro Castillo Ruiz", "8100-0004", null, ["Genesis", "KN 110", "Negra", null]],
  ["José Martínez Chávez", "8100-0005", "001-150790-0004D", ["Yamaha", "XTZ 125", "Blanca", "M 210-405"]],
  ["Karla Rivas Obando", "+506 8800-0006", null, ["Suzuki", "GN 125", "Gris", "M 210-406"]],
  ["Miguel Torres Aráuz", "8100-0007", null, ["Bajaj", "Pulsar 150", "Negra", "M 210-407"]],
  ["Elena Ruiz Sandino", "8100-0008", null, null],
  ["Óscar Sánchez Mairena", "+1 305-555-0109", null, ["Honda", "CGL 125", "Roja", "M 210-409"]],
  ["Carmen Flores Duarte", "8100-0010", null, ["Genesis", "GBR 150", "Azul", "M 210-410"]],
];

export async function demoMore(db: Db, adminId: number) {
  if (await db.supplier.findFirst({ where: ci("Repuestos El Pistón") })) {
    console.log("ℹ️  Datos de demostración ampliados ya cargados.");
    return;
  }

  // ---- Catalogs ---------------------------------------------------------------
  const named = async <T extends { id: number }>(
    find: (n: string) => Promise<T | null>,
    create: (n: string) => Promise<T>,
    names: string[],
  ) => {
    const out: Record<string, number> = {};
    for (const n of names) out[n] = ((await find(n)) ?? (await create(n))).id;
    return out;
  };
  const brand = await named(
    (n) => db.productBrand.findFirst({ where: ci(n) }),
    (name) => db.productBrand.create({ data: { name } }),
    [...new Set(PRODUCTS.map((p) => p[1]))],
  );
  const category = await named(
    (n) => db.productCategory.findFirst({ where: ci(n) }),
    (name) => db.productCategory.create({ data: { name } }),
    [...new Set(PRODUCTS.map((p) => p[2]))],
  );
  const motoBrand = await named(
    (n) => db.motorcycleBrand.findFirst({ where: ci(n) }),
    (name) => db.motorcycleBrand.create({ data: { name } }),
    [...new Set(CUSTOMERS.flatMap((c) => (c[3] ? [c[3][0]] : [])))],
  );
  const model: Record<string, number> = {};
  for (const c of CUSTOMERS) {
    if (!c[3]) continue;
    const [b, m] = c[3];
    const key = `${b}|${m}`;
    if (model[key]) continue;
    model[key] = (
      (await db.motorcycleModel.findFirst({ where: { motorcycleBrandId: motoBrand[b]!, ...ci(m) } })) ??
      (await db.motorcycleModel.create({ data: { motorcycleBrandId: motoBrand[b]!, name: m } }))
    ).id;
  }

  // ---- Products (no stock: it comes from the purchases below) -----------------
  const product: Record<string, { id: number; price: string; cost: string }> = {};
  for (const [i, [name, b, c, tier, price, cost]] of PRODUCTS.entries()) {
    const p = await db.product.create({
      data: {
        name,
        productBrandId: brand[b]!,
        productCategoryId: category[c]!,
        qualityTier: tier,
        listPrice: price,
        barcode: `75099${String(1000 + i).padStart(8, "0")}`,
      },
    });
    await db.productPriceHistory.create({ data: { productId: p.id, newPrice: price, changedByUserId: adminId, changedAt: daysAgo(70) } });
    product[name] = { id: p.id, price, cost };
  }

  // ---- Suppliers and their purchases ------------------------------------------
  for (const [name, phone, contactPerson, givesWarranty] of SUPPLIERS) {
    const s = await db.supplier.create({
      data: {
        name,
        phone,
        contactPerson,
        givesWarranty,
        ...(name === "Importadora Moto Sur" ? { openingBalance: "4500", openingDate: day(daysAgo(90)) } : {}),
      },
    });
    const mine = PRODUCTS.filter((p) => p[6] === name);
    // Two purchases: 60 days ago (cash) and 20 days ago (credit, one overdue).
    for (const [n, [ago, terms]] of ([[60, "CONTADO"], [20, "CREDITO"]] as const).entries()) {
      const at = daysAgo(ago);
      const half = n === 0 ? mine : mine.filter((_, i) => i % 2 === 0);
      const due = terms === "CREDITO" ? day(daysAgo(name === "Importadora Moto Sur" ? 5 : -10)) : null;
      const inv = await db.purchaseInvoice.create({
        data: {
          supplierId: s.id,
          invoiceNumber: `${name.slice(0, 3).toUpperCase()}-${1000 + n * 37}`,
          purchaseDate: day(at),
          paymentTerms: terms,
          dueDate: due,
          receivedByUserId: adminId,
        },
      });
      for (const [i, p] of half.entries()) {
        const prod = product[p[0]]!;
        // The second purchase came a bit more expensive (to see ▲ in purchases).
        const unitCost = n === 0 ? D(prod.cost) : D(prod.cost).times(1.05).toDecimalPlaces(2);
        const qty = Number(prod.price) > 1000 ? 4 : 15;
        const line = await db.purchaseInvoiceLine.create({
          data: { purchaseInvoiceId: inv.id, lineNo: i + 1, productId: prod.id, quantity: qty, unitCost },
        });
        await db.inventoryMovement.create({
          data: {
            productId: prod.id,
            movementType: "COMPRA",
            quantity: qty,
            unitCost,
            registeredByUserId: adminId,
            purchaseInvoiceLineId: line.id,
            movedAt: at,
          },
        });
      }
      if (terms === "CREDITO" && name === "Repuestos El Pistón") {
        await db.supplierPayment.create({
          data: { supplierId: s.id, purchaseInvoiceId: inv.id, amount: "1000", paidOn: day(daysAgo(8)) },
        });
      }
    }
  }

  // ---- Customers ----------------------------------------------------------------
  const customer: Record<string, { id: number; motorcycleId: number | null }> = {};
  for (const [name, phone, nationalId, moto] of CUSTOMERS) {
    const c = await db.customer.create({
      data: {
        name,
        phone,
        nationalId,
        motorcycles: moto
          ? { create: [{ motorcycleModelId: model[`${moto[0]}|${moto[1]}`]!, color: moto[2], plate: moto[3] }] }
          : undefined,
      },
      include: { motorcycles: true },
    });
    customer[name] = { id: c.id, motorcycleId: c.motorcycles[0]?.id ?? null };
  }
  const cash = (await db.paymentMethod.findFirstOrThrow({ where: ci("Efectivo") })).id;
  const transfer = (await db.paymentMethod.findFirst({ where: ci("Transferencia") }))?.id ?? cash;

  /** A sale (counter or service bill) in the past, with its stock exits and payment. */
  async function sale(o: {
    customer?: string;
    ago: number;
    terms: "CONTADO" | "CREDITO";
    dueAfter?: number;
    lines: [string, number][];
    labor?: { serviceTypeId: number; name: string; price: string }[];
    serviceOrderId?: number;
    paid?: string;
    method?: number;
  }) {
    const at = daysAgo(o.ago, 9 + (o.ago % 8));
    const inv = await db.saleInvoice.create({
      data: {
        customerId: o.customer ? customer[o.customer]!.id : null,
        createdByUserId: adminId,
        createdAt: at,
        paymentTerms: o.terms,
        dueDate: o.terms === "CREDITO" ? day(new Date(at.getTime() + (o.dueAfter ?? 30) * 86_400_000)) : null,
        creditAuthorizedByUserId: o.terms === "CREDITO" ? adminId : null,
        serviceOrderId: o.serviceOrderId ?? null,
      },
    });
    let total = D(0);
    let lineNo = 0;
    for (const l of o.labor ?? []) {
      await db.saleInvoiceLine.create({
        data: {
          saleInvoiceId: inv.id,
          lineNo: ++lineNo,
          lineType: "MANO_OBRA",
          serviceTypeId: l.serviceTypeId,
          description: l.name,
          quantity: 1,
          unitPrice: l.price,
          serviceOrderId: o.serviceOrderId ?? null,
        },
      });
      total = total.plus(l.price);
    }
    for (const [name, qty] of o.lines) {
      const p = product[name]!;
      const line = await db.saleInvoiceLine.create({
        data: {
          saleInvoiceId: inv.id,
          lineNo: ++lineNo,
          lineType: "PRODUCTO",
          productId: p.id,
          quantity: qty,
          unitPrice: p.price,
          serviceOrderId: o.serviceOrderId ?? null,
        },
      });
      await db.inventoryMovement.create({
        data: {
          productId: p.id,
          movementType: o.serviceOrderId ? "USO_SERVICIO" : "VENTA",
          quantity: qty,
          unitCost: D(p.cost).times(1.05).toDecimalPlaces(2),
          registeredByUserId: adminId,
          saleInvoiceLineId: line.id,
          movedAt: at,
        },
      });
      total = total.plus(D(p.price).times(qty));
    }
    const paid = o.terms === "CONTADO" ? total : o.paid ? D(o.paid) : null;
    if (paid?.gt(0)) {
      await db.customerPayment.create({
        data: {
          amount: paid,
          paymentMethodId: o.method ?? cash,
          receivedByUserId: adminId,
          paidAt: o.terms === "CONTADO" ? at : daysAgo(Math.max(o.ago - 7, 0), 15),
          allocations: { create: [{ saleInvoiceId: inv.id, amount: paid }] },
        },
      });
    }
    return inv;
  }

  // Counter sales over the last month (charts, best sellers, "vendidos 90 días").
  const counter: [number, [string, number][]][] = [
    [1, [["Aceite Motul 3000 20W-50 1L", 2], ["Filtro de aceite Pulsar 150/180", 1]]],
    [2, [["Bujía NGK CR7HSA", 1]]],
    [3, [["Lubricante de cadena en spray", 1], ["Grasa multiuso 250 g", 1]]],
    [5, [["Llanta trasera 3.00-18", 1], ["Neumático (tubo) 18 pulgadas", 1]]],
    [6, [["Aceite Castrol Actevo 20W-50 1L", 1]]],
    [8, [["Direccional LED (par)", 1], ["Bombillo de faro H4", 2]]],
    [11, [["Casco abierto talla L", 1]]],
    [13, [["Aceite Motul 3000 20W-50 1L", 3]]],
    [15, [["Batería 12V 5Ah", 1]]],
    [18, [["Retrovisores cromados (par)", 1], ["Puños de manubrio", 1]]],
    [22, [["Aceite 2T para mezcla 1L", 2]]],
    [26, [["Kit de arrastre 428 (cadena y piñones)", 1]]],
  ];
  for (const [ago, lines] of counter) await sale({ ago, terms: "CONTADO", lines, method: ago % 3 === 0 ? transfer : cash });

  // Credit customers: up to date, overdue, long overdue, paid off.
  await sale({ customer: "Luis Mendoza Pérez", ago: 50, terms: "CREDITO", dueAfter: 15, lines: [["Kit de arrastre 428 (cadena y piñones)", 1], ["Llanta delantera 2.75-18", 1]], paid: "800" });
  await sale({ customer: "Rosa Hernández López", ago: 12, terms: "CREDITO", dueAfter: 30, lines: [["Casco integral talla M", 1]], paid: "500" });
  await sale({ customer: "Pedro Castillo Ruiz", ago: 75, terms: "CREDITO", dueAfter: 15, lines: [["Batería 12V 7Ah", 1], ["Regulador de voltaje", 1]] });
  await sale({ customer: "Miguel Torres Aráuz", ago: 35, terms: "CREDITO", dueAfter: 30, lines: [["Disco de freno delantero Pulsar", 1], ["Pastillas de freno traseras", 1]], paid: "300" });
  await sale({ customer: "Elena Ruiz Sandino", ago: 20, terms: "CREDITO", dueAfter: 15, lines: [["Candado de disco", 1], ["Forro de asiento", 1]], paid: "700" });
  // Debts from before the system (paper notes).
  for (const [name, amount, ago, dueAgo] of [
    ["José Martínez Chávez", "1800", 120, 60],
    ["Carmen Flores Duarte", "650", 40, 10],
  ] as const) {
    await db.customerOpeningBalance.create({
      data: {
        customerId: customer[name]!.id,
        asOfDate: day(daysAgo(ago)),
        amount,
        dueDate: day(daysAgo(dueAgo)),
        registeredByUserId: adminId,
        notes: "Cuaderno de créditos",
      },
    });
  }

  // ---- Workshop: delivered orders (history, commissions) and open ones (board) ---
  const job = async (name: string) => (await db.serviceType.findFirstOrThrow({ where: ci(name) })).id;
  // Its own mechanic, so the demo commissions don't mix with anyone else's.
  const mechanic =
    (await db.staff.findFirst({ where: ci("Raúl Llanta") })) ??
    (await db.staff.create({ data: { name: "Raúl Llanta", phone: "8000-0005", commissionRate: "0.6000", kind: "MECANICO" } }));
  const owner = await db.staff.findFirst({ where: { kind: "DUENO", active: true } });

  async function order(o: {
    customer: string;
    jobs: string[];
    km?: number;
    ago: number;
    statuses: string[];
    responsible?: { id: number; rate: Prisma.Decimal | null };
    note?: string;
  }) {
    const motorcycleId = customer[o.customer]!.motorcycleId!;
    const types = await Promise.all(o.jobs.map(job));
    const so = await db.serviceOrder.create({
      data: {
        motorcycleId,
        requestedWork: o.note ?? null,
        odometerKm: o.km ?? null,
        mechanicStaffId: o.responsible?.id ?? null,
        appliedCommissionRate: o.responsible?.rate ?? null,
        items: { create: types.map((serviceTypeId) => ({ serviceTypeId })) },
      },
    });
    // One change every 40 minutes, the last one `ago` days back: always in the past.
    for (const [i, status] of o.statuses.entries()) {
      const changedAt = new Date(Date.now() - o.ago * 86_400_000 - (o.statuses.length - i) * 40 * 60_000);
      await db.serviceOrderStatusChange.create({ data: { serviceOrderId: so.id, status, registeredByUserId: adminId, changedAt } });
    }
    return { id: so.id, types };
  }
  const mech = { id: mechanic.id, rate: mechanic.commissionRate };
  const own = owner ? { id: owner.id, rate: null } : mech;

  const done1 = await order({ customer: "Ana Gutiérrez Rocha", jobs: ["Cambio de aceite", "Engrase"], km: 18250, ago: 30, statuses: ["RECIBIDA", "EN_PROCESO", "TERMINADA", "ENTREGADA"], responsible: mech });
  await sale({ customer: "Ana Gutiérrez Rocha", ago: 30, terms: "CONTADO", serviceOrderId: done1.id, labor: [{ serviceTypeId: done1.types[0]!, name: "Cambio de aceite", price: "150" }, { serviceTypeId: done1.types[1]!, name: "Engrase", price: "400" }], lines: [["Aceite Motul 3000 20W-50 1L", 1], ["Filtro de aceite Pulsar 150/180", 1]] });
  const done2 = await order({ customer: "Ana Gutiérrez Rocha", jobs: ["Cambio de pastillas de freno"], km: 19900, ago: 4, statuses: ["RECIBIDA", "EN_PROCESO", "ENTREGADA"], responsible: mech });
  await sale({ customer: "Ana Gutiérrez Rocha", ago: 4, terms: "CONTADO", serviceOrderId: done2.id, labor: [{ serviceTypeId: done2.types[0]!, name: "Cambio de pastillas de freno", price: "250" }], lines: [["Pastillas de freno traseras", 1]] });
  const done3 = await order({ customer: "Luis Mendoza Pérez", jobs: ["Cambio de kit de arrastre"], km: 32100, ago: 9, statuses: ["RECIBIDA", "ESPERA_REPUESTO", "EN_PROCESO", "ENTREGADA"], responsible: own });
  await sale({ customer: "Luis Mendoza Pérez", ago: 9, terms: "CONTADO", serviceOrderId: done3.id, labor: [{ serviceTypeId: done3.types[0]!, name: "Cambio de kit de arrastre", price: "350" }], lines: [["Kit de arrastre 428 (cadena y piñones)", 1]] });

  await order({ customer: "José Martínez Chávez", jobs: ["Diagnóstico"], km: 45020, ago: 0, statuses: ["RECIBIDA"], note: "Dice que pierde fuerza en subida" });
  await order({ customer: "Karla Rivas Obando", jobs: ["Mantenimiento general"], km: 8800, ago: 1, statuses: ["RECIBIDA", "EN_PROCESO"], responsible: mech });
  await order({ customer: "Miguel Torres Aráuz", jobs: ["Cambio de pastillas de freno", "Purga de frenos"], km: 27500, ago: 2, statuses: ["RECIBIDA", "ESPERA_REPUESTO"], responsible: mech, note: "Suena al frenar" });
  await order({ customer: "Óscar Sánchez Mairena", jobs: ["Revisión eléctrica", "Cambio de batería"], ago: 1, statuses: ["RECIBIDA", "EN_DIAGNOSTICO"], responsible: own });
  await order({ customer: "Carmen Flores Duarte", jobs: ["Cambio de aceite", "Ajuste de cadena"], km: 12040, ago: 0, statuses: ["RECIBIDA", "TERMINADA"], responsible: mech });

  console.log(`🧪 Demo ampliada: ${PRODUCTS.length} productos, ${SUPPLIERS.length} proveedores, ${CUSTOMERS.length} clientes, ventas y taller.`);
}
