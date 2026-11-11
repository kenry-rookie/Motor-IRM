/**
 * Demo data, third batch (Kenry, 11-nov): a richer test base for class.
 *
 *   npm run db:demo-extra
 *
 *   - ~70 products more: accessories, bearings, engine parts and ORIGINAL parts
 *     of the motorcycle brands (Honda, Yamaha, Bajaj, Suzuki, Genesis, TVS…),
 *     with stock that comes from purchases to 3 new suppliers.
 *   - Motorcycle brands and models common in Nicaragua.
 *   - 5 customers, 2 motorcycles each (10 motorcycles) — all of them in the
 *     workshop right now, in different states; some with past repairs.
 *   - 2 mechanics with commission (50 % and 55 %), with delivered work to pay.
 *   - Counter sales of the new products over the last weeks.
 *
 * Everything is FICTITIOUS (no real people). All or nothing (one transaction),
 * and it runs once: if the supplier "Repuestos Originales Centro" exists, it
 * does nothing. Needs the base seed (roles, service types, payment methods).
 */
import { Prisma, PrismaClient } from "../generated/prisma";

type Tx = Prisma.TransactionClient;
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

// ---- Motorcycle brands and models seen every day in Nicaragua ---------------------
const MOTO_MODELS: Record<string, string[]> = {
  Genesis: ["KN 110", "GBR 150", "Rally 200", "Sport 125"],
  Honda: ["XR 150L", "XR 190L", "CGL 125", "Navi 110", "CB 190R", "Wave 110"],
  Yamaha: ["XTZ 125", "XTZ 150", "YBR 125", "FZ 2.0", "Crypton 115"],
  Suzuki: ["GN 125", "AX4 110", "DR 150", "Gixxer 150"],
  Bajaj: ["Boxer 150", "Pulsar 150", "Pulsar NS 200", "Discover 125", "Platino 100"],
  TVS: ["Apache RTR 160", "Apache RTR 200", "Star HLX 125", "Sport 100"],
  Hero: ["Hunk 150", "Eco Deluxe 100", "Ignitor 125"],
  Serpento: ["Yasu 150", "Cobra 200", "Tayra 125"],
  Kawasaki: ["KLX 150", "Ninja 400"],
  Freedom: ["Max 150", "Speed 125"],
};

// ---- Products: [name, brand, category, tier, price, cost, supplier] ---------------
type P = [string, string, string, "ALTA" | "MEDIA" | "BAJA", string, string, string];
const ORIG = "Repuestos Originales Centro";
const ACC = "Accesorios La Curva";
const MOT = "Motopartes Del Norte";
const PRODUCTS: P[] = [
  // Original parts of the motorcycle brands
  ["Filtro de aceite original Honda XR 150L", "Honda", "Filtros", "ALTA", "210", "140", ORIG],
  ["Filtro de aire original Honda CGL 125", "Honda", "Filtros", "ALTA", "260", "175", ORIG],
  ["Pastillas de freno originales Honda XR 190L", "Honda", "Frenos", "ALTA", "480", "330", ORIG],
  ["Kit de arrastre original Honda XR 150L", "Honda", "Transmisión", "ALTA", "2350", "1700", ORIG],
  ["Empaque de culata original Honda CGL 125", "Honda", "Motor", "ALTA", "290", "190", ORIG],
  ["Filtro de aire original Yamaha XTZ 125", "Yamaha", "Filtros", "ALTA", "280", "190", ORIG],
  ["Bujía original Yamaha YBR 125", "Yamaha", "Repuestos", "ALTA", "180", "115", ORIG],
  ["Pastillas de freno originales Yamaha FZ 2.0", "Yamaha", "Frenos", "ALTA", "520", "360", ORIG],
  ["Kit de clutch original Yamaha XTZ 150", "Yamaha", "Transmisión", "ALTA", "1650", "1180", ORIG],
  ["Filtro de aceite original Bajaj Pulsar", "Bajaj", "Filtros", "ALTA", "190", "125", ORIG],
  ["Zapatas originales Bajaj Boxer 150", "Bajaj", "Frenos", "ALTA", "260", "170", ORIG],
  ["Kit de arrastre original Bajaj Boxer 150", "Bajaj", "Transmisión", "ALTA", "1750", "1250", ORIG],
  ["Bobina de encendido original Bajaj Pulsar", "Bajaj", "Eléctrico", "ALTA", "690", "470", ORIG],
  ["Filtro de aire original Suzuki GN 125", "Suzuki", "Filtros", "ALTA", "240", "160", ORIG],
  ["Kit de arrastre original Suzuki GN 125", "Suzuki", "Transmisión", "ALTA", "1890", "1350", ORIG],
  ["Pastillas de freno originales Genesis GBR 150", "Genesis", "Frenos", "ALTA", "350", "230", ORIG],
  ["Filtro de aceite original Genesis KN 110", "Genesis", "Filtros", "ALTA", "150", "95", ORIG],
  ["Cable de clutch original TVS Apache 160", "TVS", "Cables", "ALTA", "240", "155", ORIG],
  ["Filtro de aire original TVS Apache RTR 160", "TVS", "Filtros", "ALTA", "300", "200", ORIG],

  // Engine
  ["Kit de pistón 150 cc (pistón, anillos, pin)", "Genérico", "Motor", "MEDIA", "980", "650", MOT],
  ["Kit de pistón 125 cc (pistón, anillos, pin)", "Genérico", "Motor", "MEDIA", "890", "590", MOT],
  ["Juego de anillos 150 cc STD", "Riken", "Motor", "ALTA", "520", "340", MOT],
  ["Juego de anillos 125 cc STD", "Riken", "Motor", "ALTA", "480", "310", MOT],
  ["Cilindro completo 150 cc", "Genérico", "Motor", "MEDIA", "2450", "1700", MOT],
  ["Juego de válvulas 150 cc (admisión y escape)", "Genérico", "Motor", "MEDIA", "620", "400", MOT],
  ["Cadenilla de distribución", "DID", "Motor", "ALTA", "450", "290", MOT],
  ["Tensor de cadenilla", "Genérico", "Motor", "MEDIA", "320", "200", MOT],
  ["Juego de empaques de motor 150 cc", "Genérico", "Motor", "MEDIA", "380", "230", MOT],
  ["Retenedor de cigüeñal", "NOK", "Motor", "ALTA", "120", "70", MOT],
  ["Carburador completo 150 cc", "Mikuni", "Motor", "ALTA", "1850", "1300", MOT],
  ["Kit de reparación de carburador", "Genérico", "Motor", "MEDIA", "260", "150", MOT],
  ["Bomba de aceite 150 cc", "Genérico", "Motor", "MEDIA", "540", "350", MOT],
  ["Árbol de levas 150 cc", "Genérico", "Motor", "MEDIA", "980", "660", MOT],
  ["Balancines (par)", "Genérico", "Motor", "BAJA", "420", "260", MOT],
  ["Motor de arranque 150 cc", "Genérico", "Eléctrico", "MEDIA", "1650", "1150", MOT],
  ["Estator / bobina de carga 150 cc", "Genérico", "Eléctrico", "MEDIA", "1250", "850", MOT],
  ["CDI universal 5 pines", "Genérico", "Eléctrico", "MEDIA", "580", "380", MOT],

  // Bearings and suspension
  ["Rodamiento 6301 KOYO", "KOYO", "Rodamientos", "ALTA", "190", "120", MOT],
  ["Rodamiento 6201 KOYO", "KOYO", "Rodamientos", "ALTA", "160", "100", MOT],
  ["Rodamiento 6004 SKF", "SKF", "Rodamientos", "ALTA", "230", "150", MOT],
  ["Rodamiento 6203 SKF", "SKF", "Rodamientos", "ALTA", "210", "135", MOT],
  ["Rodamiento 6202 genérico", "Genérico", "Rodamientos", "BAJA", "90", "50", MOT],
  ["Rodamientos de rueda delantera (juego)", "NTN", "Rodamientos", "ALTA", "380", "250", MOT],
  ["Rodamientos de rueda trasera (juego)", "NTN", "Rodamientos", "ALTA", "420", "275", MOT],
  ["Rodamiento de cigüeñal 6305", "NSK", "Rodamientos", "ALTA", "520", "340", MOT],
  ["Bujes de horquilla (juego)", "Genérico", "Suspensión", "MEDIA", "280", "170", MOT],
  ["Retenedores de barras (par)", "NOK", "Suspensión", "ALTA", "350", "220", MOT],
  ["Amortiguador trasero 320 mm (par)", "Genérico", "Suspensión", "MEDIA", "1650", "1100", MOT],
  ["Mono-amortiguador XR / XTZ", "Genérico", "Suspensión", "MEDIA", "2200", "1500", MOT],

  // Accessories
  ["Casco integral con visor ahumado talla L", "LS2", "Protectores", "ALTA", "3200", "2300", ACC],
  ["Casco cross talla M", "Genérico", "Protectores", "MEDIA", "2100", "1450", ACC],
  ["Guantes de moto (par)", "Genérico", "Protectores", "MEDIA", "380", "230", ACC],
  ["Chaleco reflectivo", "Genérico", "Protectores", "BAJA", "180", "100", ACC],
  ["Capa impermeable de dos piezas", "Genérico", "Protectores", "MEDIA", "650", "420", ACC],
  ["Rodilleras (par)", "Genérico", "Protectores", "BAJA", "450", "280", ACC],
  ["Baúl trasero 30 L", "Genérico", "Accesorios", "MEDIA", "1450", "980", ACC],
  ["Parrilla trasera universal", "Genérico", "Accesorios", "BAJA", "650", "400", ACC],
  ["Soporte de celular para manubrio", "Genérico", "Accesorios", "MEDIA", "350", "200", ACC],
  ["Cargador USB para moto", "Genérico", "Accesorios", "MEDIA", "320", "190", ACC],
  ["Alarma con control remoto", "Genérico", "Accesorios", "MEDIA", "1250", "820", ACC],
  ["Pito / bocina 12 V", "Genérico", "Accesorios", "BAJA", "180", "100", ACC],
  ["Protector de motor (slider) par", "Genérico", "Accesorios", "MEDIA", "780", "500", ACC],
  ["Funda cubre moto talla L", "Genérico", "Accesorios", "BAJA", "520", "320", ACC],
  ["Calcomanías reflectivas (juego)", "Genérico", "Accesorios", "BAJA", "120", "60", ACC],
  ["Faro LED auxiliar (par)", "Genérico", "Iluminación", "MEDIA", "950", "620", ACC],
  ["Bombillo LED H4", "Genérico", "Iluminación", "MEDIA", "380", "240", ACC],
  ["Manecillas de freno y clutch (par)", "Genérico", "Accesorios", "BAJA", "290", "170", ACC],
  ["Pedal de cambios", "Genérico", "Accesorios", "BAJA", "220", "130", ACC],
  ["Pata de parqueo (lateral)", "Genérico", "Accesorios", "BAJA", "260", "150", ACC],
];

const SUPPLIERS: [string, string, string, boolean][] = [
  [ORIG, "2250-7700", "Lic. Fabiola (ventas)", true],
  [ACC, "2268-8800", "Don Ernesto", false],
  [MOT, "2713-9900", "Atención a talleres", true],
];

// [name, phone, cédula|null, address|null, motorcycles [brand, model, color, plate|null, km][]]
type Moto = [string, string, string, string | null, number];
const CUSTOMERS: [string, string, string | null, string | null, Moto[]][] = [
  ["Fernando Aguirre Blandón", "8200-1001", "001-120388-0011K", "Barrio San Judas, Managua", [
    ["Honda", "XR 190L", "Roja", "M 310-501", 15400],
    ["Genesis", "KN 110", "Azul", "M 310-502", 41200],
  ]],
  ["Lucía Moraga Espinoza", "8200-1002", null, "Ciudad Sandino", [
    ["Yamaha", "FZ 2.0", "Negra", "M 310-503", 9800],
    ["TVS", "Apache RTR 160", "Blanca", "M 310-504", 22300],
  ]],
  ["Ramón Zeledón Cruz", "8200-1003", "001-050581-0022P", "Tipitapa", [
    ["Bajaj", "Pulsar NS 200", "Gris", "M 310-505", 18700],
    ["Hero", "Hunk 150", "Roja", null, 30500],
  ]],
  ["Gabriela Téllez Paz", "8200-1004", null, null, [
    ["Suzuki", "AX4 110", "Negra", "M 310-506", 12600],
    ["Serpento", "Yasu 150", "Azul", "M 310-507", 7300],
  ]],
  ["Transportes Hermanos Lanuza", "2233-1005", null, "Mercado Mayoreo, Managua", [
    ["Bajaj", "Boxer 150", "Negra", "M 310-508", 58900],
    ["Genesis", "GBR 150", "Roja", "M 310-509", 47400],
  ]],
];

const MECHANICS: [string, string, string][] = [
  ["Julio Bujía", "8300-2001", "0.5000"],
  ["Andrés Cadena", "8300-2002", "0.5500"],
];

async function load(db: Tx, adminId: number) {
  // ---- Catalogs ---------------------------------------------------------------
  const named = async <T extends { id: number }>(find: (n: string) => Promise<T | null>, create: (n: string) => Promise<T>, names: string[]) => {
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
    Object.keys(MOTO_MODELS),
  );
  const model: Record<string, number> = {};
  let newModels = 0;
  for (const [b, models] of Object.entries(MOTO_MODELS)) {
    for (const m of models) {
      const found = await db.motorcycleModel.findFirst({ where: { motorcycleBrandId: motoBrand[b]!, ...ci(m) } });
      if (!found) newModels++;
      model[`${b}|${m}`] = (found ?? (await db.motorcycleModel.create({ data: { motorcycleBrandId: motoBrand[b]!, name: m } }))).id;
    }
  }

  // ---- Products (stock comes from the purchases) ----------------------------------
  const product: Record<string, { id: number; price: string; cost: string }> = {};
  for (const [i, [name, b, c, tier, price, cost]] of PRODUCTS.entries()) {
    const existing = await db.product.findFirst({ where: ci(name) });
    const p =
      existing ??
      (await db.product.create({
        data: {
          name,
          productBrandId: brand[b]!,
          productCategoryId: category[c]!,
          qualityTier: tier,
          listPrice: price,
          barcode: `75088${String(2000 + i).padStart(8, "0")}`,
        },
      }));
    if (!existing) {
      await db.productPriceHistory.create({ data: { productId: p.id, newPrice: price, changedByUserId: adminId, changedAt: daysAgo(45) } });
    }
    product[name] = { id: p.id, price, cost };
  }

  // ---- Suppliers: a cash purchase 40 days ago and a credit one 12 days ago ----------
  for (const [name, phone, contactPerson, givesWarranty] of SUPPLIERS) {
    const s = await db.supplier.create({ data: { name, phone, contactPerson, givesWarranty } });
    const mine = PRODUCTS.filter((p) => p[6] === name);
    for (const [n, [ago, terms]] of ([[40, "CONTADO"], [12, "CREDITO"]] as const).entries()) {
      const at = daysAgo(ago);
      const lines = n === 0 ? mine : mine.filter((_, i) => i % 3 === 0);
      const inv = await db.purchaseInvoice.create({
        data: {
          supplierId: s.id,
          invoiceNumber: `${name.slice(0, 3).toUpperCase()}-${2000 + n * 51}`,
          purchaseDate: day(at),
          paymentTerms: terms,
          dueDate: terms === "CREDITO" ? day(daysAgo(-18)) : null,
          receivedByUserId: adminId,
        },
      });
      for (const [i, p] of lines.entries()) {
        const prod = product[p[0]]!;
        const unitCost = n === 0 ? D(prod.cost) : D(prod.cost).times(1.04).toDecimalPlaces(2);
        const price = Number(prod.price);
        const qty = n === 1 ? 4 : price >= 2000 ? 3 : price >= 1000 ? 5 : price >= 400 ? 10 : 20;
        const line = await db.purchaseInvoiceLine.create({
          data: { purchaseInvoiceId: inv.id, lineNo: i + 1, productId: prod.id, quantity: qty, unitCost },
        });
        await db.inventoryMovement.create({
          data: { productId: prod.id, movementType: "COMPRA", quantity: qty, unitCost, registeredByUserId: adminId, purchaseInvoiceLineId: line.id, movedAt: at },
        });
      }
    }
  }

  // ---- Mechanics with commission -----------------------------------------------------
  const mech: { id: number; rate: Prisma.Decimal | null }[] = [];
  for (const [name, phone, rate] of MECHANICS) {
    const m = (await db.staff.findFirst({ where: ci(name) })) ?? (await db.staff.create({ data: { name, phone, commissionRate: rate, kind: "MECANICO" } }));
    mech.push({ id: m.id, rate: m.commissionRate });
  }
  const owner = await db.staff.findFirst({ where: { kind: "DUENO", active: true } });
  const own = owner ? { id: owner.id, rate: null } : mech[0]!;

  // ---- Customers and their motorcycles ------------------------------------------------
  const motos: { customerId: number; customer: string; motorcycleId: number; km: number }[] = [];
  for (const [name, phone, nationalId, address, list] of CUSTOMERS) {
    const c = await db.customer.create({ data: { name, phone, nationalId, address } });
    for (const [b, m, color, plate, km] of list) {
      const moto = await db.motorcycle.create({ data: { customerId: c.id, motorcycleModelId: model[`${b}|${m}`]!, color, plate } });
      motos.push({ customerId: c.id, customer: name, motorcycleId: moto.id, km });
    }
  }

  const cash = (await db.paymentMethod.findFirstOrThrow({ where: ci("Efectivo") })).id;
  const transfer = (await db.paymentMethod.findFirst({ where: ci("Transferencia") }))?.id ?? cash;
  const job = async (name: string) => (await db.serviceType.findFirstOrThrow({ where: ci(name) })).id;

  /** A past sale (counter or service bill) with its stock exits and payment. */
  async function sale(o: {
    customerId?: number;
    ago: number;
    terms: "CONTADO" | "CREDITO";
    lines: [string, number][];
    labor?: { serviceTypeId: number; name: string; price: string }[];
    serviceOrderId?: number;
    paid?: string;
    method?: number;
  }) {
    const at = daysAgo(o.ago, 9 + (o.ago % 8));
    const inv = await db.saleInvoice.create({
      data: {
        customerId: o.customerId ?? null,
        createdByUserId: adminId,
        createdAt: at,
        paymentTerms: o.terms,
        dueDate: o.terms === "CREDITO" ? day(new Date(at.getTime() + 30 * 86_400_000)) : null,
        creditAuthorizedByUserId: o.terms === "CREDITO" ? adminId : null,
        serviceOrderId: o.serviceOrderId ?? null,
      },
    });
    let total = D(0);
    let lineNo = 0;
    for (const l of o.labor ?? []) {
      await db.saleInvoiceLine.create({
        data: { saleInvoiceId: inv.id, lineNo: ++lineNo, lineType: "MANO_OBRA", serviceTypeId: l.serviceTypeId, description: l.name, quantity: 1, unitPrice: l.price, serviceOrderId: o.serviceOrderId ?? null },
      });
      total = total.plus(l.price);
    }
    for (const [name, qty] of o.lines) {
      const p = product[name]!;
      const line = await db.saleInvoiceLine.create({
        data: { saleInvoiceId: inv.id, lineNo: ++lineNo, lineType: "PRODUCTO", productId: p.id, quantity: qty, unitPrice: p.price, serviceOrderId: o.serviceOrderId ?? null },
      });
      await db.inventoryMovement.create({
        data: {
          productId: p.id,
          movementType: o.serviceOrderId ? "USO_SERVICIO" : "VENTA",
          quantity: qty,
          unitCost: D(p.cost),
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
          paidAt: o.terms === "CONTADO" ? at : daysAgo(Math.max(o.ago - 5, 0), 15),
          allocations: { create: [{ saleInvoiceId: inv.id, amount: paid }] },
        },
      });
    }
  }

  /** A service order with its status history; the last change `ago` days back. */
  async function order(o: {
    moto: (typeof motos)[number];
    jobs: string[];
    ago: number;
    statuses: string[];
    km?: number;
    responsible?: { id: number; rate: Prisma.Decimal | null };
    note?: string;
  }) {
    const types = await Promise.all(o.jobs.map(job));
    const so = await db.serviceOrder.create({
      data: {
        motorcycleId: o.moto.motorcycleId,
        requestedWork: o.note ?? null,
        odometerKm: o.km ?? o.moto.km,
        mechanicStaffId: o.responsible?.id ?? null,
        appliedCommissionRate: o.responsible?.rate ?? null,
        items: { create: types.map((serviceTypeId) => ({ serviceTypeId })) },
      },
    });
    for (const [i, status] of o.statuses.entries()) {
      const changedAt = new Date(Date.now() - o.ago * 86_400_000 - (o.statuses.length - i) * 45 * 60_000);
      await db.serviceOrderStatusChange.create({ data: { serviceOrderId: so.id, status, registeredByUserId: adminId, changedAt } });
    }
    return { id: so.id, types };
  }

  // ---- Workshop history: delivered and billed (commissions to pay) ---------------------
  const [m1, m2, m3, m4, m5, m6, m7, m8, m9, m10] = motos as [typeof motos[number], ...typeof motos];
  const done: [typeof m1, string[], number, { id: number; rate: Prisma.Decimal | null }, string[], [string, number][]][] = [
    [m1, ["Cambio de aceite", "Cambio de filtro de aire"], 25, mech[0]!, ["150", "100"], [["Filtro de aceite original Honda XR 150L", 1]]],
    [m5, ["Cambio de kit de arrastre"], 14, mech[1]!, ["350"], [["Kit de arrastre original Bajaj Boxer 150", 1]]],
    [m9, ["Cambio de rodamientos de rueda"], 8, mech[0]!, ["300"], [["Rodamientos de rueda trasera (juego)", 1]]],
    [m4, ["Calibración de válvulas", "Cambio de bujía"], 5, mech[1]!, ["400", "80"], [["Juego de empaques de motor 150 cc", 1]]],
    [m10, ["Cambio de pastillas de freno"], 3, own, ["250"], [["Pastillas de freno originales Genesis GBR 150", 1]]],
  ];
  for (const [moto, jobs, ago, who, prices, lines] of done) {
    const o = await order({ moto, jobs, ago, km: moto.km - 1500, statuses: ["RECIBIDA", "EN_PROCESO", "TERMINADA", "ENTREGADA"], responsible: who });
    await sale({
      customerId: moto.customerId,
      ago,
      terms: moto.customer.startsWith("Transportes") ? "CREDITO" : "CONTADO",
      paid: moto.customer.startsWith("Transportes") ? "300" : undefined,
      serviceOrderId: o.id,
      labor: o.types.map((serviceTypeId, i) => ({ serviceTypeId, name: jobs[i]!, price: prices[i]! })),
      lines,
    });
  }

  // ---- The 10 motorcycles in the workshop NOW, in different states ---------------------
  const open: [typeof m1, string[], number, string[], { id: number; rate: Prisma.Decimal | null } | undefined, string | undefined][] = [
    [m1, ["Diagnóstico"], 0, ["RECIBIDA"], undefined, "Hace ruido en el motor al acelerar"],
    [m2, ["Limpieza de carburador", "Ajuste de cadena"], 0, ["RECIBIDA", "EN_PROCESO"], mech[0], undefined],
    [m3, ["Revisión eléctrica"], 1, ["RECIBIDA", "EN_DIAGNOSTICO"], mech[1], "No enciende la luz delantera"],
    [m4, ["Cambio de aceite de barras"], 1, ["RECIBIDA", "ESPERA_REPUESTO"], mech[1], "Esperan retenedores de barras"],
    [m5, ["Trabajo de motor"], 2, ["RECIBIDA", "EN_DIAGNOSTICO", "ESPERA_CLIENTE"], mech[0], "Hay que cambiar anillos: falta que el cliente apruebe el precio"],
    [m6, ["Cambio de llanta", "Reparación de neumático"], 0, ["RECIBIDA", "TERMINADA"], mech[1], undefined],
    [m7, ["Mantenimiento general"], 1, ["RECIBIDA", "EN_PROCESO", "EN_PRUEBA"], mech[0], undefined],
    [m8, ["Cambio de rodamientos de dirección"], 0, ["RECIBIDA"], undefined, "La dirección se siente floja"],
    [m9, ["Cambio de batería", "Instalación de luces"], 1, ["RECIBIDA", "EN_PROCESO"], own, undefined],
    [m10, ["Ajuste de clutch", "Cambio de cable de clutch"], 0, ["RECIBIDA", "EN_PROCESO"], mech[1], undefined],
  ];
  for (const [moto, jobs, ago, statuses, responsible, note] of open) {
    await order({ moto, jobs, ago, statuses, responsible, note });
  }

  // ---- Counter sales of the new products (best sellers, charts) ------------------------
  const counter: [number, [string, number][], string?][] = [
    [0, [["Guantes de moto (par)", 1], ["Chaleco reflectivo", 1]]],
    [1, [["Rodamiento 6301 KOYO", 2]]],
    [1, [["Casco integral con visor ahumado talla L", 1]], "Fernando Aguirre Blandón"],
    [2, [["Soporte de celular para manubrio", 1], ["Cargador USB para moto", 1]]],
    [3, [["Filtro de aceite original Bajaj Pulsar", 2]]],
    [4, [["Capa impermeable de dos piezas", 1]]],
    [6, [["Bombillo LED H4", 2], ["Pito / bocina 12 V", 1]]],
    [7, [["Juego de anillos 150 cc STD", 1], ["Retenedor de cigüeñal", 2]]],
    [9, [["Baúl trasero 30 L", 1], ["Parrilla trasera universal", 1]], "Lucía Moraga Espinoza"],
    [10, [["Kit de pistón 150 cc (pistón, anillos, pin)", 1]]],
    [16, [["Alarma con control remoto", 1]]],
    [21, [["Rodamiento 6004 SKF", 2], ["Rodamiento 6203 SKF", 2]]],
  ];
  const customerId = (name?: string) => motos.find((m) => m.customer === name)?.customerId;
  for (const [ago, lines, who] of counter) {
    await sale({ customerId: customerId(who), ago, terms: "CONTADO", lines, method: ago % 2 === 0 ? transfer : cash });
  }
  // A credit customer with debt
  await sale({ customerId: customerId("Ramón Zeledón Cruz"), ago: 18, terms: "CREDITO", lines: [["Amortiguador trasero 320 mm (par)", 1]], paid: "600" });

  return { newModels };
}

async function main() {
  const db = new PrismaClient();
  try {
    if (await db.supplier.findFirst({ where: ci(ORIG) })) {
      console.log("ℹ️  Esta tanda de datos de prueba ya estaba cargada. No se hizo nada.");
      return;
    }
    const admin = await db.appUser.findFirst({ where: { role: ci("Dueño") }, orderBy: { id: "asc" } });
    if (!admin) throw new Error("No hay usuario dueño: corre primero npm run db:seed");
    const { newModels } = await db.$transaction((tx) => load(tx, admin.id), { timeout: 180_000, maxWait: 20_000 });
    console.log(
      `🧪 Cargado: ${PRODUCTS.length} productos, ${SUPPLIERS.length} proveedores, ${newModels} modelos de moto nuevos, ` +
        `${CUSTOMERS.length} clientes con 10 motos (todas en el taller), ${MECHANICS.length} mecánicos y ventas.`,
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
