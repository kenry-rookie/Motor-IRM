/**
 * «Cuatro semanas de trabajo» (Kenry, 23-nov): datos para mostrarles el sistema
 * a los dueños como si ya llevara un mes funcionando.
 *
 *   npm run db:demo-completo      ← BORRA la base de desarrollo y carga todo
 *   npx tsx prisma/demo-semanas.ts  (solo esta tanda, sobre lo que ya haya)
 *
 * Sobre los datos de las otras demos agrega:
 *   - ~70 productos más para muchas motos (Honda, Yamaha, Bajaj, Suzuki,
 *     Genesis, TVS, Hero, Serpento…) y 4 proveedores nuevos;
 *   - 30 clientes nuevos con sus motos (algunos sin moto);
 *   - 4 semanas día por día (lunes a sábado): ventas de mostrador (efectivo,
 *     dólares, transferencia), ventas al crédito y abonos, motos que entran al
 *     taller, se reparan y se entregan cobradas, cancelaciones, devoluciones,
 *     retiros, adelantos y pagos semanales a mecánicos, compras al crédito y de
 *     contado, dos viajes de compras cerrados y uno en curso hoy;
 *   - la caja de cada día abierta y cerrada con su arqueo (dos días con
 *     diferencia) y la de hoy abierta.
 *
 * Todo es FICTICIO. Se carga una sola vez: si existe el proveedor
 * «Motorepuestos Mayoreo Managua», no hace nada. Los «números al azar» salen
 * de una semilla fija: cada vez que se carga, queda igual.
 */
import { Prisma, PrismaClient } from "../generated/prisma";

const db = new PrismaClient();
type Dec = Prisma.Decimal;
const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const ci = (name: string) => ({ name: { equals: name, mode: "insensitive" as const } });

// ---- Azar con semilla fija (mulberry32) ----------------------------------------------
let seed = 20261123;
const rnd = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]!;
const chance = (p: number) => rnd() < p;

// ---- Fechas en hora de Managua (UTC−6, sin horario de verano) ----------------------------
const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Managua" }).format(new Date());
const dayStr = (ago: number) => new Date(Date.parse(`${todayStr}T00:00:00Z`) - ago * 86_400_000).toISOString().slice(0, 10);
/** Instante del día `ago` a la hora `h` (decimal: 9.5 = 9:30). Nunca en el futuro. */
const at = (ago: number, h: number) => {
  const d = new Date(`${dayStr(ago)}T00:00:00-06:00`);
  const t = new Date(d.getTime() + Math.round(h * 60) * 60_000);
  const limit = Date.now() - 5 * 60_000;
  return t.getTime() > limit ? new Date(limit) : t;
};
const dateOf = (ago: number) => new Date(`${dayStr(ago)}T00:00:00.000Z`);
const isSunday = (ago: number) => new Date(`${dayStr(ago)}T12:00:00Z`).getUTCDay() === 0;
const RATE = ["36.60", "36.62", "36.62", "36.65"];

// ---- Catálogo nuevo: [nombre, marca, categoría, calidad, precio, costo, proveedor, stock inicial] ----
const MAY = "Motorepuestos Mayoreo Managua";
const EST = "Repuestos Hermanos Rocha (Estelí)";
const LUB = "Lubrimotor León";
const CAS = "Cascos y Accesorios Granada";
type P = [string, string, string, "ALTA" | "MEDIA" | "BAJA", number, number, string, number];
const PRODUCTS: P[] = [
  // Lubricantes y químicos
  ["Aceite Shell Advance AX5 20W-50 1L", "Shell", "Lubricantes", "ALTA", 280, 195, LUB, 36],
  ["Aceite Valvoline 4T 20W-50 1L", "Valvoline", "Lubricantes", "ALTA", 270, 185, LUB, 30],
  ["Aceite Motul 5100 15W-50 1L", "Motul", "Lubricantes", "ALTA", 420, 300, LUB, 14],
  ["Aceite Repsol Moto Rider 20W-50 1L", "Repsol", "Lubricantes", "MEDIA", 250, 170, LUB, 24],
  ["Aceite de transmisión 80W-90 1L", "Genérico", "Lubricantes", "MEDIA", 190, 120, LUB, 12],
  ["Refrigerante para moto 1L", "Prestone", "Lubricantes", "MEDIA", 210, 135, LUB, 10],
  ["Limpiador de carburador en spray", "WD-40", "Lubricantes", "MEDIA", 220, 140, LUB, 18],
  ["Lubricante multiuso WD-40 311 ml", "WD-40", "Lubricantes", "ALTA", 260, 175, LUB, 15],
  ["Shampoo para moto 1L", "Genérico", "Accesorios", "BAJA", 150, 85, LUB, 10],
  ["Silicón para tablero 300 ml", "Genérico", "Accesorios", "BAJA", 140, 80, LUB, 8],
  // Frenos por modelo
  ["Pastillas de freno delanteras Honda XR 150L", "Genérico", "Frenos", "MEDIA", 260, 160, EST, 10],
  ["Pastillas de freno delanteras Yamaha XTZ 125", "Genérico", "Frenos", "MEDIA", 250, 155, EST, 8],
  ["Pastillas de freno delanteras Bajaj Pulsar 150", "Genérico", "Frenos", "MEDIA", 240, 150, EST, 10],
  ["Pastillas de freno delanteras TVS Apache 160", "Genérico", "Frenos", "MEDIA", 270, 170, EST, 6],
  ["Pastillas de freno delanteras Suzuki Gixxer 150", "Genérico", "Frenos", "MEDIA", 280, 175, EST, 4],
  ["Zapatas traseras Honda CGL 125", "Genérico", "Frenos", "MEDIA", 190, 115, EST, 8],
  ["Zapatas traseras Genesis KN 110", "Genérico", "Frenos", "BAJA", 160, 95, EST, 10],
  ["Zapatas traseras Yamaha YBR 125", "Genérico", "Frenos", "MEDIA", 200, 120, EST, 6],
  ["Bomba de freno delantera universal", "Genérico", "Frenos", "MEDIA", 650, 420, EST, 3],
  ["Manguera de freno delantera", "Genérico", "Frenos", "MEDIA", 320, 200, EST, 4],
  // Transmisión
  ["Kit de arrastre Yamaha XTZ 125 (genérico)", "Genérico", "Transmisión", "MEDIA", 1250, 850, MAY, 4],
  ["Kit de arrastre Honda CGL 125 (genérico)", "Genérico", "Transmisión", "MEDIA", 1150, 790, MAY, 4],
  ["Kit de arrastre Genesis GBR 150 (genérico)", "Genérico", "Transmisión", "MEDIA", 1200, 820, MAY, 3],
  ["Kit de arrastre TVS Apache 160 (genérico)", "Genérico", "Transmisión", "MEDIA", 1350, 920, MAY, 2],
  ["Cadena 428H x 118 eslabones", "KMC", "Transmisión", "ALTA", 650, 430, MAY, 8],
  ["Piñón delantero 15T 428", "Genérico", "Transmisión", "MEDIA", 230, 140, MAY, 10],
  ["Corona 45T 428", "Genérico", "Transmisión", "MEDIA", 440, 280, MAY, 6],
  ["Cable de clutch Honda XR 150L", "Genérico", "Cables", "MEDIA", 170, 100, EST, 8],
  ["Cable de clutch Yamaha YBR 125", "Genérico", "Cables", "MEDIA", 160, 95, EST, 8],
  ["Cable de acelerador Bajaj Boxer 150", "Genérico", "Cables", "BAJA", 130, 75, EST, 10],
  ["Cable de velocímetro universal", "Genérico", "Cables", "BAJA", 120, 65, EST, 6],
  ["Discos de clutch Honda CGL 125", "Genérico", "Transmisión", "MEDIA", 560, 360, MAY, 4],
  // Filtros, bujías, encendido
  ["Filtro de aceite Yamaha XTZ 125/150", "Genérico", "Filtros", "MEDIA", 150, 90, EST, 15],
  ["Filtro de aceite TVS Apache 160/200", "Genérico", "Filtros", "MEDIA", 160, 95, EST, 12],
  ["Filtro de aire Genesis GBR 150", "Genérico", "Filtros", "MEDIA", 180, 105, EST, 8],
  ["Filtro de aire Hero Hunk 150", "Genérico", "Filtros", "MEDIA", 190, 110, EST, 5],
  ["Filtro de gasolina universal", "Genérico", "Filtros", "BAJA", 60, 30, EST, 25],
  ["Bujía NGK C7HSA", "NGK", "Repuestos", "ALTA", 120, 72, EST, 30],
  ["Bujía NGK DR8ES", "NGK", "Repuestos", "ALTA", 160, 98, EST, 12],
  ["Bujía Denso U22FS-U", "Denso", "Repuestos", "ALTA", 150, 92, EST, 10],
  ["Capuchón de bujía", "NGK", "Repuestos", "ALTA", 110, 65, EST, 12],
  ["Bobina de encendido universal", "Genérico", "Eléctrico", "MEDIA", 420, 270, MAY, 5],
  // Eléctrico e iluminación
  ["Batería 12V 9Ah gel", "Yuasa", "Eléctrico", "ALTA", 1750, 1250, MAY, 4],
  ["Batería 12V 4Ah gel", "Genérico", "Eléctrico", "MEDIA", 850, 580, MAY, 5],
  ["Relé de arranque", "Genérico", "Eléctrico", "MEDIA", 260, 160, MAY, 6],
  ["Switch de encendido con llaves", "Genérico", "Eléctrico", "MEDIA", 480, 310, MAY, 4],
  ["Flasher (intermitente) 12V", "Genérico", "Eléctrico", "BAJA", 120, 65, MAY, 10],
  ["Bombillo de stop 12V (par)", "Genérico", "Iluminación", "BAJA", 60, 30, MAY, 20],
  ["Faro delantero completo Boxer 150", "Genérico", "Iluminación", "MEDIA", 780, 510, MAY, 2],
  ["Direccionales originales Honda (par)", "Honda", "Iluminación", "ALTA", 650, 440, MAY, 2],
  // Llantas
  ["Llanta delantera 2.50-17", "IRC", "Llantas", "MEDIA", 980, 680, MAY, 6],
  ["Llanta trasera 2.75-17", "IRC", "Llantas", "MEDIA", 1080, 750, MAY, 6],
  ["Llanta trasera 100/90-18 todo terreno", "Pirelli", "Llantas", "ALTA", 2150, 1550, MAY, 3],
  ["Llanta delantera 90/90-19", "Pirelli", "Llantas", "ALTA", 1950, 1400, MAY, 2],
  ["Neumático (tubo) 17 pulgadas", "Genérico", "Llantas", "MEDIA", 240, 150, MAY, 12],
  ["Parche y pegamento para neumático", "Genérico", "Llantas", "BAJA", 50, 25, MAY, 30],
  // Suspensión y dirección
  ["Retenedores de barras Honda XR 150L (par)", "NOK", "Suspensión", "ALTA", 380, 240, EST, 4],
  ["Amortiguador trasero Genesis KN 110 (par)", "Genérico", "Suspensión", "MEDIA", 1250, 850, MAY, 2],
  ["Tazas de dirección Bajaj Boxer", "Genérico", "Rodamientos", "MEDIA", 350, 220, EST, 4],
  // Accesorios y protectores
  ["Casco certificado DOT talla M", "Shaft", "Protectores", "ALTA", 2600, 1850, CAS, 3],
  ["Casco certificado DOT talla L", "Shaft", "Protectores", "ALTA", 2600, 1850, CAS, 3],
  ["Casco abierto con visor talla M", "Genérico", "Protectores", "MEDIA", 1100, 720, CAS, 5],
  ["Visor de casco ahumado", "Genérico", "Protectores", "BAJA", 280, 160, CAS, 6],
  ["Guantes de cuero (par)", "Genérico", "Protectores", "MEDIA", 520, 330, CAS, 6],
  ["Impermeable tipo poncho", "Genérico", "Protectores", "BAJA", 300, 180, CAS, 10],
  ["Espejos estilo deportivo (par)", "Genérico", "Accesorios", "MEDIA", 420, 260, CAS, 6],
  ["Llavero con logo de moto", "Genérico", "Accesorios", "BAJA", 60, 25, CAS, 30],
  ["Pulpo elástico para carga", "Genérico", "Accesorios", "BAJA", 90, 45, CAS, 20],
  ["Porta placa con luz", "Genérico", "Accesorios", "BAJA", 250, 140, CAS, 6],
  ["Guardafango trasero universal", "Genérico", "Accesorios", "BAJA", 320, 190, CAS, 4],
  ["Llave de bujía en cruz", "Genérico", "Accesorios", "BAJA", 120, 60, CAS, 8],
];

const SUPPLIERS: [string, string, string, boolean][] = [
  [MAY, "2249-5500", "Don Álvaro (mayoreo)", false],
  [EST, "2713-6600", "Hermanos Rocha", true],
  [LUB, "2311-7700", "Licda. Marisol", true],
  [CAS, "2552-8800", "Don Felipe", false],
];

// ---- Clientes (ficticios) -----------------------------------------------------------------
const FIRST = ["Marvin", "Yessenia", "Kevin", "Darling", "Wilmer", "Ingrid", "Byron", "Scarleth", "Elvin", "Massiel", "Henry", "Jahoska", "Norlan", "Fátima", "Oscar", "Lesbia", "Bayardo", "Katherine", "Danilo", "Xiomara", "Junior", "Maritza", "Allan", "Rebeca", "Francisco", "Alba", "Erick", "Nubia", "Jairo", "Martha"];
const LAST = ["Rivera", "Obando", "Galeano", "Úbeda", "Chavarría", "Mairena", "Sequeira", "Orozco", "Amador", "Pineda", "Rugama", "Valle", "Centeno", "Picado", "Baltodano", "Cajina", "Laguna", "Montenegro", "Somarriba", "Rostrán"];
const PLACES = ["Barrio Monseñor Lezcano", "Ciudad Sandino", "Tipitapa", "Masaya", "Nindirí", "Ticuantepe", "Mateare", "Villa El Carmen", "Barrio Altagracia", "Colonia Centroamérica", "Reparto Schick", "Barrio Bello Horizonte"];
const COLORS = ["Negra", "Roja", "Azul", "Blanca", "Gris", "Verde", "Naranja", "Plateada"];

const NOTES = [
  "Suena raro al acelerar",
  "Le falla el arranque en la mañana",
  "Pierde fuerza en subida",
  "Se le apagan las luces",
  "Frena poco",
  "La cadena suena",
  "Mantenimiento de rutina",
  "Gotea aceite",
];

async function main() {
  if (await db.supplier.findFirst({ where: ci(MAY) })) {
    console.log("ℹ️  Las cuatro semanas de prueba ya estaban cargadas. No se hizo nada.");
    return;
  }
  const found = await db.appUser.findFirst({ where: { role: ci("Dueño"), active: true }, orderBy: { id: "asc" } });
  if (!found) throw new Error("No hay usuario dueño: corra primero npm run db:seed");
  const owner = found;
  const clerk = (await db.appUser.findFirst({ where: { role: ci("Encargado"), active: true } })) ?? owner;
  const users = [owner.id, clerk.id, clerk.id]; // el encargado atiende más
  const who = () => pick(users);

  const methodId = async (n: string) => (await db.paymentMethod.findFirstOrThrow({ where: ci(n) })).id;
  const CASH = await methodId("Efectivo");
  const TRANSFER = await methodId("Transferencia");
  const CARD = await methodId("Tarjeta");
  const reasonId = async (n: string) => (await db.cashWithdrawalReason.findFirstOrThrow({ where: ci(n) })).id;
  const R_BIZ = await reasonId("Gastos del negocio");
  const R_SERV = await reasonId("Pago de servicios (luz, agua, internet)");
  const R_OWNER = await reasonId("Retiro de dueño");
  const returnReason = await db.returnReason.findFirstOrThrow({ where: ci("No es compatible con la moto") });
  const expType = async (n: string) => (await db.tripExpenseType.findFirstOrThrow({ where: ci(n) })).id;

  // ---- Catálogos de producto ----
  const named = async (model: "brand" | "category", names: string[]) => {
    const out: Record<string, number> = {};
    for (const name of names) {
      const found = model === "brand" ? await db.productBrand.findFirst({ where: ci(name) }) : await db.productCategory.findFirst({ where: ci(name) });
      out[name] = (found ?? (model === "brand" ? await db.productBrand.create({ data: { name } }) : await db.productCategory.create({ data: { name } }))).id;
    }
    return out;
  };
  const brand = await named("brand", [...new Set(PRODUCTS.map((p) => p[1]))]);
  const category = await named("category", [...new Set(PRODUCTS.map((p) => p[2]))]);

  // ---- Inventario en memoria: lo que hay y lo que costó (para no vender lo que no hay) ----
  type Item = { id: number; name: string; price: Dec; cost: Dec; stock: number; supplier?: string };
  const items = new Map<number, Item>();
  const existing = await db.$queryRawUnsafe<{ id: number; name: string; list_price: string; stock: number; last_cost: string | null }[]>(
    `SELECT p.id, p.name, p.list_price::text, p.stock, m.last_cost::text FROM product p LEFT JOIN v_product_margin m ON m.product_id = p.id WHERE p.active`,
  );
  for (const r of existing) {
    items.set(r.id, { id: r.id, name: r.name, price: D(r.list_price), cost: D(r.last_cost ?? D(r.list_price).times(0.65).toFixed(2)), stock: Number(r.stock) });
  }

  // ---- Proveedores y productos nuevos, con su inventario de hace 30 días ----
  const supplier: Record<string, number> = {};
  for (const [name, phone, contactPerson, givesWarranty] of SUPPLIERS) {
    supplier[name] = (await db.supplier.create({ data: { name, phone, contactPerson, givesWarranty } })).id;
  }
  const opening = at(30, 8);
  for (const [i, [name, b, c, tier, price, cost, sup, qty]] of PRODUCTS.entries()) {
    const p = await db.product.create({
      data: { name, productBrandId: brand[b]!, productCategoryId: category[c]!, qualityTier: tier, listPrice: price, barcode: `75099${String(3000 + i).padStart(8, "0")}` },
    });
    await db.productPriceHistory.create({ data: { productId: p.id, newPrice: price, changedByUserId: owner.id, changedAt: opening } });
    await db.inventoryMovement.create({
      data: { productId: p.id, movementType: "INVENTARIO_INICIAL", quantity: qty, unitCost: cost, registeredByUserId: owner.id, movedAt: opening, notes: "Conteo inicial" },
    });
    items.set(p.id, { id: p.id, name, price: D(price), cost: D(cost), stock: qty, supplier: sup });
  }

  // ---- Clientes y motos ----
  const models = await db.motorcycleModel.findMany({ where: { active: true, brand: { active: true } }, include: { brand: true } });
  type Moto = { id: number; customerId: number; km: number; label: string };
  const motos: Moto[] = [];
  const customers: { id: number; name: string; credit: boolean }[] = [];
  for (let i = 0; i < 30; i++) {
    const name = `${FIRST[i]!} ${LAST[i % LAST.length]!} ${LAST[(i * 7 + 3) % LAST.length]!}`;
    const c = await db.customer.create({
      data: {
        name,
        phone: `84${String(10 + i).padStart(2, "0")}-${String(1000 + i * 37).slice(-4)}`,
        nationalId: i % 3 === 0 ? `00${1 + (i % 9)}-${String(10185 + i * 13).padStart(6, "0")}-00${String(10 + i).slice(-2)}${"ABCDEFGHJK"[i % 10]}` : null,
        address: i % 4 === 3 ? null : pick(PLACES),
      },
    });
    customers.push({ id: c.id, name, credit: i % 4 === 0 || i % 7 === 0 });
    const n = i % 6 === 5 ? 0 : i % 5 === 0 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const m = pick(models);
      const moto = await db.motorcycle.create({
        data: { customerId: c.id, motorcycleModelId: m.id, color: pick(COLORS), plate: i % 9 === 8 && k === 0 ? null : `M 52${k}-${String(100 + i).padStart(3, "0")}` },
      });
      motos.push({ id: moto.id, customerId: c.id, km: int(3000, 60000), label: `${m.brand.name} ${m.name}` });
    }
  }
  // Las motos de las otras demos también vuelven al taller (si no están ahí ahora).
  const busy = new Set(
    (
      await db.$queryRawUnsafe<{ motorcycle_id: number }[]>(
        `SELECT so.motorcycle_id FROM service_order so JOIN v_service_order_status st ON st.service_order_id = so.id
          WHERE st.status NOT IN ('ENTREGADA', 'CANCELADA')`,
      )
    ).map((r) => Number(r.motorcycle_id)),
  );
  for (const m of await db.motorcycle.findMany({ where: { releasedAt: null, id: { notIn: motos.map((x) => x.id) } }, include: { model: { include: { brand: true } } } })) {
    motos.push({ id: m.id, customerId: m.customerId, km: int(5000, 50000), label: `${m.model.brand.name} ${m.model.name}` });
  }

  // ---- Personal ----
  const staff = await db.staff.findMany({ where: { active: true, canRepair: true } });
  const mechanics = staff.filter((s) => s.kind === "MECANICO");
  const owners = staff.filter((s) => s.kind === "DUENO");
  const responsible = () => (chance(0.15) && owners.length ? pick(owners) : pick(mechanics));
  const jobs = await db.serviceType.findMany({ where: { active: true, NOT: { name: { in: ["Cargo por cancelación"] } } } });

  // ---- Ventas ----
  const sellable = (min = 1) => [...items.values()].filter((p) => p.stock >= min);
  const pickLines = (n: number) => {
    const out = new Map<number, number>();
    for (let k = 0; k < n; k++) {
      const p = pick(sellable());
      const q = Math.min(p.stock - (out.get(p.id) ?? 0), p.price.lt(400) ? int(1, 3) : 1);
      if (q > 0) out.set(p.id, (out.get(p.id) ?? 0) + q);
    }
    return [...out.entries()].filter(([, q]) => q > 0);
  };
  const credits: { id: number; customerId: number; balance: Dec; ago: number }[] = [];

  async function sale(o: {
    ago: number;
    h: number;
    customerId?: number;
    terms: "CONTADO" | "CREDITO";
    lines: [number, number][];
    labor?: { serviceTypeId: number; description: string; price: Dec }[];
    serviceOrderId?: number;
    method?: number;
    usd?: boolean;
    dueDays?: number;
    user?: number;
  }) {
    const created = at(o.ago, o.h);
    const user = o.user ?? who();
    const inv = await db.saleInvoice.create({
      data: {
        customerId: o.customerId ?? null,
        createdByUserId: user,
        createdAt: created,
        paymentTerms: o.terms,
        dueDate: o.terms === "CREDITO" ? dateOf(o.ago - (o.dueDays ?? 15)) : null,
        creditAuthorizedByUserId: o.terms === "CREDITO" ? owner.id : null,
        serviceOrderId: o.serviceOrderId ?? null,
      },
    });
    let total = D(0);
    let lineNo = 0;
    for (const l of o.labor ?? []) {
      await db.saleInvoiceLine.create({
        data: { saleInvoiceId: inv.id, lineNo: ++lineNo, lineType: "MANO_OBRA", serviceTypeId: l.serviceTypeId, description: l.description, quantity: 1, unitPrice: l.price, serviceOrderId: o.serviceOrderId ?? null },
      });
      total = total.plus(l.price);
    }
    const lineIds: { id: number; productId: number; qty: number; price: Dec }[] = [];
    for (const [pid, qty] of o.lines) {
      const p = items.get(pid)!;
      const line = await db.saleInvoiceLine.create({
        data: { saleInvoiceId: inv.id, lineNo: ++lineNo, lineType: "PRODUCTO", productId: pid, quantity: qty, unitPrice: p.price, serviceOrderId: o.serviceOrderId ?? null },
      });
      await db.inventoryMovement.create({
        data: { productId: pid, movementType: o.serviceOrderId ? "USO_SERVICIO" : "VENTA", quantity: qty, unitCost: p.cost, registeredByUserId: user, saleInvoiceLineId: line.id, movedAt: created },
      });
      p.stock -= qty;
      total = total.plus(p.price.times(qty));
      lineIds.push({ id: line.id, productId: pid, qty, price: p.price });
    }
    if (o.terms === "CONTADO" && total.gt(0)) {
      const rate = pick(RATE);
      const usd = o.usd ?? false;
      await db.customerPayment.create({
        data: {
          amount: usd ? total.div(rate).toDecimalPlaces(2, Prisma.Decimal.ROUND_UP) : total,
          currency: usd ? "USD" : "NIO",
          exchangeRate: usd ? rate : null,
          paymentMethodId: usd ? CASH : (o.method ?? CASH),
          receivedByUserId: user,
          paidAt: created,
          allocations: { create: [{ saleInvoiceId: inv.id, amount: total }] },
        },
      });
    } else if (o.terms === "CREDITO" && o.customerId) {
      credits.push({ id: inv.id, customerId: o.customerId, balance: total, ago: o.ago });
    }
    return { id: inv.id, total, created, lineIds };
  }

  const purchases: { id: number; supplierId: number; total: Dec; ago: number; due: number }[] = [];
  async function purchase(o: { ago: number; supplier: string; terms: "CONTADO" | "CREDITO"; tripId?: number; lines: [number, number][]; dueDays?: number; paidFrom?: "CAJA" | "FUERA_DE_CAJA" | "VIAJE" }) {
    const when = at(o.ago, o.tripId ? 11 : 9.5);
    const sid = supplier[o.supplier] ?? (await db.supplier.findFirstOrThrow({ where: ci(o.supplier) })).id;
    const inv = await db.purchaseInvoice.create({
      data: {
        supplierId: sid,
        invoiceNumber: `${o.supplier.slice(0, 3).toUpperCase()}-${int(10000, 99999)}`,
        purchaseDate: dateOf(o.ago),
        paymentTerms: o.terms,
        dueDate: o.terms === "CREDITO" ? dateOf(o.ago - (o.dueDays ?? 15)) : null,
        receivedByUserId: owner.id,
        purchaseTripId: o.tripId ?? null,
        createdAt: when,
      },
    });
    let total = D(0);
    for (const [i, [pid, qty]] of o.lines.entries()) {
      const p = items.get(pid)!;
      // Algunos productos suben un poco de costo: así se ve el «último costo».
      const unitCost = chance(0.25) ? p.cost.times(1.05).toDecimalPlaces(2) : p.cost;
      const line = await db.purchaseInvoiceLine.create({ data: { purchaseInvoiceId: inv.id, lineNo: i + 1, productId: pid, quantity: qty, unitCost } });
      await db.inventoryMovement.create({
        data: { productId: pid, movementType: "COMPRA", quantity: qty, unitCost, registeredByUserId: owner.id, purchaseInvoiceLineId: line.id, movedAt: when },
      });
      p.stock += qty;
      p.cost = unitCost;
      total = total.plus(unitCost.times(qty));
    }
    if (o.terms === "CONTADO") {
      await db.supplierPayment.create({
        data: {
          supplierId: sid,
          purchaseInvoiceId: inv.id,
          amount: total,
          paidOn: dateOf(o.ago),
          paidAt: when,
          source: o.tripId ? "VIAJE" : (o.paidFrom ?? "CAJA"),
          purchaseTripId: o.tripId ?? null,
          registeredByUserId: owner.id,
        },
      });
    } else {
      purchases.push({ id: inv.id, supplierId: sid, total, ago: o.ago, due: o.ago - (o.dueDays ?? 15) });
    }
    return total;
  }
  /** Lo que se repone: productos de ese proveedor (o cualquiera) con poco stock. */
  const restock = (sup: string | null, n: number): [number, number][] => {
    const pool = [...items.values()].filter((p) => (sup ? p.supplier === sup : true)).sort((a, b) => a.stock - b.stock);
    return pool.slice(0, n).map((p) => [p.id, p.price.gte(1500) ? int(2, 4) : p.price.gte(500) ? int(3, 6) : int(6, 15)]);
  };

  // ---- El taller ----
  type Open = { id: number; moto: Moto; staffId: number; types: { id: number; name: string; ref: Prisma.Decimal | null }[]; receivedAgo: number; doneAgo: number; fate: "ENTREGAR" | "CANCELAR" | "ABIERTA" };
  const workshop: Open[] = [];
  const inShop = new Set(busy);
  async function receive(ago: number) {
    const free = motos.filter((m) => !inShop.has(m.id));
    if (!free.length) return;
    const moto = pick(free);
    const staffMember = responsible();
    const n = chance(0.35) ? 2 : 1;
    const types = [...new Set(Array.from({ length: n }, () => pick(jobs)))].map((t) => ({ id: t.id, name: t.name, ref: t.referencePrice }));
    const so = await db.serviceOrder.create({
      data: {
        motorcycleId: moto.id,
        requestedWork: chance(0.6) ? pick(NOTES) : null,
        odometerKm: moto.km,
        mechanicStaffId: staffMember.id,
        appliedCommissionRate: staffMember.kind === "DUENO" ? null : staffMember.commissionRate,
        items: { create: types.map((t) => ({ serviceTypeId: t.id })) },
      },
    });
    await db.serviceOrderStatusChange.create({ data: { serviceOrderId: so.id, status: "RECIBIDA", registeredByUserId: who(), changedAt: at(ago, 8 + rnd() * 3) } });
    moto.km += int(800, 2500);
    inShop.add(moto.id);
    // Lo de hoy sigue en el taller; lo que caería en domingo se entrega el lunes.
    let doneAgo = ago === 0 ? -1 : ago - (chance(0.5) ? 0 : chance(0.6) ? 1 : int(2, 4));
    while (doneAgo >= 0 && isSunday(doneAgo)) doneAgo--;
    if (doneAgo === 0) doneAgo = -1; // lo que se terminaría hoy todavía no se entrega
    workshop.push({ id: so.id, moto, staffId: staffMember.id, types, receivedAgo: ago, doneAgo, fate: doneAgo < 0 ? "ABIERTA" : chance(0.05) ? "CANCELAR" : "ENTREGAR" });
  }
  const laborPrice = (ref: Prisma.Decimal | null) => (ref ? D(ref) : D(pick([300, 450, 600, 800, 1200])));
  async function finish(o: Open, ago: number) {
    const status = async (s: string, h: number) => db.serviceOrderStatusChange.create({ data: { serviceOrderId: o.id, status: s, registeredByUserId: who(), changedAt: at(ago, h) } });
    if (o.fate === "CANCELAR") {
      await status("CANCELADA", 15);
      inShop.delete(o.moto.id);
      return;
    }
    if (chance(0.25)) await status("ESPERA_REPUESTO", 11);
    await status("EN_PROCESO", 12);
    await status("TERMINADA", 14.5);
    await status("ENTREGADA", 16 + rnd());
    const parts = chance(0.7) ? pickLines(int(1, 2)) : [];
    const customer = customers.find((c) => c.id === o.moto.customerId);
    await sale({
      ago,
      h: 16.2,
      customerId: o.moto.customerId,
      terms: customer?.credit && chance(0.4) ? "CREDITO" : "CONTADO",
      serviceOrderId: o.id,
      labor: o.types.map((t) => ({ serviceTypeId: t.id, description: t.name, price: laborPrice(t.ref) })),
      lines: parts,
      method: chance(0.2) ? TRANSFER : CASH,
      usd: chance(0.08),
    });
    inShop.delete(o.moto.id);
  }

  // ---- Viajes de compra ----
  async function trip(o: { ago: number; cash: number; supplier: string[]; expenses: [string, number, string?][]; open?: boolean; short?: number }) {
    const t = await db.purchaseTrip.create({
      data: {
        tripDate: dateOf(o.ago),
        destination: "Managua",
        traveler: "Dueño",
        cashTaken: o.cash,
        takenAt: o.cash > 0 ? at(o.ago, 6.5) : null,
        createdAt: at(o.ago, 6.5),
        createdByUserId: owner.id,
        notes: "Compra semanal en el mercado Oriental y distribuidoras",
      },
    });
    let spent = D(0);
    for (const s of o.supplier) spent = spent.plus(await purchase({ ago: o.ago, supplier: s, terms: "CONTADO", tripId: t.id, lines: restock(s, int(4, 7)) }));
    for (const [type, amount, desc] of o.expenses) {
      await db.purchaseTripExpense.create({
        data: { purchaseTripId: t.id, tripExpenseTypeId: await expType(type), amount, description: desc ?? null, createdAt: at(o.ago, 13), createdByUserId: owner.id },
      });
      spent = spent.plus(amount);
    }
    // Si se gastó más de lo que se llevó de la caja, el dueño puso el resto de su bolsa.
    const otherFunds = spent.gt(o.cash) ? spent.minus(o.cash).plus(1000).div(1000).round().times(1000) : D(0);
    if (otherFunds.gt(0)) await db.purchaseTrip.update({ where: { id: t.id }, data: { otherFunds } });
    if (!o.open) {
      const back = D(o.cash).plus(otherFunds).minus(spent).minus(o.short ?? 0);
      await db.purchaseTrip.update({
        where: { id: t.id },
        data: {
          status: "CERRADO",
          cashReturned: back.gt(0) ? back : D(0),
          closedAt: at(o.ago, 18),
          closedByUserId: owner.id,
          closingNotes: o.short ? `Faltan C$ ${o.short}: propina al cargador, no se pidió factura` : null,
        },
      });
    }
  }

  // ---- Las cuatro semanas, día por día ----
  const START = 27;
  // Compras al crédito antes de empezar (una ya vencida y sin pagar completa).
  await purchase({ ago: 29, supplier: EST, terms: "CREDITO", dueDays: 15, lines: restock(EST, 8) });
  await purchase({ ago: 28, supplier: LUB, terms: "CREDITO", dueDays: 30, lines: restock(LUB, 6) });

  for (let ago = START; ago >= 0; ago--) {
    if (isSunday(ago)) continue;
    const today = ago === 0;
    const busyDay = new Date(`${dayStr(ago)}T12:00:00Z`).getUTCDay() === 6 ? 1.4 : 1; // sábados se vende más

    // Taller: entregas de lo que ya estaba, y motos que llegan.
    for (const o of workshop.filter((w) => w.fate !== "ABIERTA" && w.doneAgo === ago)) await finish(o, ago);
    const arrivals = today ? 3 : Math.round(int(2, 4) * busyDay);
    for (let k = 0; k < arrivals; k++) {
      await receive(ago);
      const last = workshop[workshop.length - 1]!;
      if (last.receivedAgo === ago && last.doneAgo === ago && last.fate !== "ABIERTA") await finish(last, ago);
    }
    if (today) break; // lo de hoy: solo motos recibidas (la caja de hoy se abre al final)

    // Mostrador
    const n = Math.round(int(4, 9) * busyDay);
    for (let k = 0; k < n; k++) {
      const lines = pickLines(chance(0.3) ? 2 : 1);
      if (!lines.length) continue;
      const credit = chance(0.08);
      const cust = credit || chance(0.2) ? pick(customers.filter((c) => !credit || c.credit)) : undefined;
      const roll = rnd();
      await sale({
        ago,
        h: 8 + rnd() * 9.5,
        customerId: cust?.id,
        terms: credit ? "CREDITO" : "CONTADO",
        lines,
        method: roll < 0.18 ? TRANSFER : roll < 0.22 ? CARD : CASH,
        usd: roll > 0.93,
        dueDays: chance(0.5) ? 15 : 30,
      });
    }

    // Abonos de clientes al crédito (algunos en dólares)
    for (const c of credits.filter((x) => x.balance.gt(0) && x.ago - ago >= 4 && chance(0.18))) {
      const part = chance(0.4) ? c.balance : c.balance.times(pick([0.3, 0.5])).toDecimalPlaces(0);
      if (part.lte(0)) continue;
      const usd = chance(0.2);
      const rate = pick(RATE);
      await db.customerPayment.create({
        data: {
          amount: usd ? part.div(rate).toDecimalPlaces(2, Prisma.Decimal.ROUND_UP) : part,
          currency: usd ? "USD" : "NIO",
          exchangeRate: usd ? rate : null,
          paymentMethodId: usd ? CASH : chance(0.3) ? TRANSFER : CASH,
          receivedByUserId: who(),
          paidAt: at(ago, 10 + rnd() * 7),
          allocations: { create: [{ saleInvoiceId: c.id, amount: part }] },
        },
      });
      c.balance = c.balance.minus(part);
    }

    // Retiros de caja
    if (chance(0.35))
      await db.cashWithdrawal.create({
        data: { withdrawnByUserId: who(), cashWithdrawalReasonId: R_BIZ, withdrawnOn: dateOf(ago), amount: pick([120, 150, 200, 250, 350]), description: pick(["Almuerzo del personal", "Agua y café", "Bolsas y papel", "Combustible para mandado", "Limpieza"]), createdAt: at(ago, 12.5) },
      });
    const dow = new Date(`${dayStr(ago)}T12:00:00Z`).getUTCDay();
    if (dow === 6)
      await db.cashWithdrawal.create({
        data: { withdrawnByUserId: owner.id, cashWithdrawalReasonId: R_OWNER, withdrawnOn: dateOf(ago), amount: pick([2000, 2500, 3000]), description: "Retiro semanal", createdAt: at(ago, 17.8) },
      });
    if (ago === 20 || ago === 6)
      await db.cashWithdrawal.create({
        data: { withdrawnByUserId: owner.id, cashWithdrawalReasonId: R_SERV, withdrawnOn: dateOf(ago), amount: ago === 20 ? 1850 : 650, description: ago === 20 ? "Recibo de luz" : "Internet del mes", createdAt: at(ago, 10) },
      });

    // Adelantos a mecánicos (de la caja)
    if (chance(0.2)) {
      const m = pick(mechanics.filter((x) => x.commissionRate));
      await db.staffAdvance.create({ data: { staffId: m.id, givenOn: dateOf(ago), amount: pick([200, 300, 500]), givenByUserId: owner.id } });
    }

    // Pago semanal a mecánicos (sábados): comisiones de lo entregado menos adelantos
    if (dow === 6 && ago > 0) {
      for (const m of mechanics.filter((x) => x.commissionRate)) {
        const orders = await db.$queryRawUnsafe<{ service_order_id: number }[]>(
          `SELECT service_order_id FROM v_mechanic_unpaid_commission WHERE staff_id = $1 AND delivered_at < $2::timestamptz`,
          m.id,
          at(ago, 17),
        );
        if (!orders.length) continue;
        const payout = await db.staffPayout.create({
          data: { staffId: m.id, periodStart: dateOf(ago + 6), periodEnd: dateOf(ago), paidOn: dateOf(ago), paidByUserId: owner.id },
        });
        await db.serviceOrder.updateMany({ where: { id: { in: orders.map((o) => Number(o.service_order_id)) } }, data: { staffPayoutId: payout.id } });
        await db.staffAdvance.updateMany({ where: { staffId: m.id, staffPayoutId: null, givenOn: { lte: dateOf(ago) } }, data: { staffPayoutId: payout.id } });
      }
    }

    // Compras
    if (ago === 20) await trip({ ago, cash: 30000, supplier: [MAY, EST, CAS], expenses: [["Pasaje / transporte", 360], ["Comida", 420], ["Flete o encomienda", 800, "Camioneta del mercado a la terminal"]] });
    if (ago === 13) await purchase({ ago, supplier: MAY, terms: "CREDITO", dueDays: 30, lines: restock(MAY, 6) });
    if (ago === 9) await purchase({ ago, supplier: CAS, terms: "CONTADO", paidFrom: "FUERA_DE_CAJA", lines: restock(CAS, 4) });
    if (ago === 6) await trip({ ago, cash: 25000, supplier: [MAY, LUB], expenses: [["Pasaje / transporte", 360], ["Comida", 380], ["Parqueo / peaje", 60]], short: 40 });
    if (ago === 3) await purchase({ ago, supplier: EST, terms: "CREDITO", dueDays: 15, lines: restock(EST, 5) });

    // Pagos a proveedores al crédito
    for (const p of purchases.filter((x) => x.total.gt(0))) {
      if (ago === p.ago - 8 && chance(0.7)) {
        const amount = p.total.times(0.5).toDecimalPlaces(0);
        const src = chance(0.5) ? "CAJA" : "FUERA_DE_CAJA";
        await db.supplierPayment.create({
          data: { supplierId: p.supplierId, purchaseInvoiceId: p.id, amount, paidOn: dateOf(ago), paidAt: at(ago, 15), source: src, registeredByUserId: owner.id, notes: "Abono a la factura" },
        });
        p.total = p.total.minus(amount);
      }
    }

    // Una devolución de vez en cuando (no le quedó a la moto), con su reembolso en efectivo
    if (ago === 17 || ago === 8) {
      const recent = await db.saleInvoice.findFirst({
        where: { paymentTerms: "CONTADO", serviceOrderId: null, createdAt: { gte: at(ago, 0), lte: at(ago, 23) }, lines: { some: { lineType: "PRODUCTO" } } },
        include: { lines: { where: { lineType: "PRODUCTO" }, take: 1 } },
        orderBy: { id: "asc" },
      });
      const line = recent?.lines[0];
      if (recent && line) {
        const p = items.get(line.productId!)!;
        const ret = await db.customerReturn.create({
          data: {
            saleInvoiceId: recent.id,
            returnedAt: at(ago, 17.5),
            returnReasonId: returnReason.id,
            registeredByUserId: clerk.id,
            refundAmount: line.unitPrice,
            notes: "El cliente trajo el repuesto, no era para su moto",
            lines: { create: [{ lineNo: 1, saleInvoiceLineId: line.id, productId: p.id, quantity: 1 }] },
          },
          include: { lines: true },
        });
        await db.inventoryMovement.create({
          data: { productId: p.id, movementType: "DEVOLUCION_CLIENTE", quantity: 1, unitCost: p.cost, registeredByUserId: clerk.id, customerReturnLineId: ret.lines[0]!.id, movedAt: at(ago, 17.5) },
        });
        p.stock += 1;
      }
    }

    // Cambios de precio (se ven en el historial del producto)
    if (ago === 15 || ago === 4) {
      for (const p of [...items.values()].filter(() => chance(0.04))) {
        p.price = p.price.times(1.08).div(10).round().times(10);
        await db.product.update({ where: { id: p.id }, data: { listPrice: p.price } });
        await db.productPriceHistory.create({ data: { productId: p.id, newPrice: p.price, changedByUserId: owner.id, changedAt: at(ago, 7.5) } });
      }
    }
  }

  // ---- Lo que sigue abierto en el taller: estados variados para el tablero ----
  const states: string[][] = [["EN_DIAGNOSTICO"], ["EN_PROCESO"], ["ESPERA_REPUESTO"], ["EN_PROCESO", "TERMINADA"], ["ESPERA_CLIENTE"], []];
  for (const [i, o] of workshop.filter((w) => w.fate === "ABIERTA" && w.receivedAgo > 0).entries()) {
    const seq = states[i % states.length]!;
    for (const [k, s] of seq.entries()) {
      // Nunca hoy (las horas de hoy pueden estar en el futuro): el día siguiente al que llegó, o la tarde del mismo día.
      const d = o.receivedAgo > 1 ? o.receivedAgo - 1 : o.receivedAgo;
      await db.serviceOrderStatusChange.create({ data: { serviceOrderId: o.id, status: s, registeredByUserId: who(), changedAt: at(d, d === o.receivedAgo ? 14 + k : 11 + k) } });
    }
  }

  // Saldos anteriores al sistema (cuaderno)
  for (const [i, c] of customers.filter((x) => x.credit).slice(0, 3).entries()) {
    await db.customerOpeningBalance.create({
      data: { customerId: c.id, asOfDate: dateOf(35), amount: [1200, 850, 2300][i]!, dueDate: dateOf([10, -5, 2][i]!), registeredByUserId: owner.id, notes: "Cuaderno de créditos" },
    });
  }

  // Viaje en curso hoy (sale en «Necesita atención»).
  await trip({ ago: 0, cash: 0, supplier: [], expenses: [["Pasaje / transporte", 180]], open: true });

  // ---- Las cajas: cada día abierta y cerrada con su arqueo; hoy, abierta ----
  const drawer = await db.$queryRawUnsafe<{ day: Date; currency: string; net: string }[]>(
    `SELECT business_day AS day, currency, sum(CASE WHEN direction = 'ENTRADA' THEN amount ELSE -amount END)::text AS net
       FROM v_money_movement WHERE in_drawer AND business_day >= $1::date GROUP BY 1, 2`,
    dayStr(START + 2),
  );
  const net = (day: string, cur: string) => D(drawer.find((r) => r.day.toISOString().slice(0, 10) === day && r.currency === cur)?.net ?? 0);
  let open = { nio: D(3000), usd: D(40) };
  for (let ago = START; ago >= 0; ago--) {
    const day = dayStr(ago);
    const nNio = net(day, "NIO");
    const nUsd = net(day, "USD");
    if (isSunday(ago) && nNio.isZero() && nUsd.isZero()) continue;
    if (await db.cashSession.findUnique({ where: { businessDay: dateOf(ago) } })) continue;
    // Si ese día salió más de lo que había, se abrió con más (el dueño puso dinero).
    if (open.nio.plus(nNio).lt(500)) open = { ...open, nio: open.nio.plus(nNio.neg()).plus(1500) };
    const opener = ago % 2 ? owner.id : clerk.id;
    if (ago === 0) {
      await db.cashSession.create({ data: { businessDay: dateOf(0), openedAt: at(0, 7.5), openedByUserId: opener, openingNio: open.nio, openingUsd: open.usd } });
      break;
    }
    const expectedNio = open.nio.plus(nNio);
    const expectedUsd = open.usd.plus(nUsd);
    const diff = ago === 16 ? D(-20) : ago === 9 ? D(50) : D(0);
    await db.cashSession.create({
      data: {
        businessDay: dateOf(ago),
        openedAt: at(ago, 7.5),
        openedByUserId: opener,
        openingNio: open.nio,
        openingUsd: open.usd,
        closedAt: at(ago, 18.2),
        closedByUserId: ago % 2 ? clerk.id : owner.id,
        expectedNio,
        expectedUsd,
        countedNio: expectedNio.plus(diff),
        countedUsd: expectedUsd,
        closingNotes: diff.isZero() ? null : diff.lt(0) ? "Faltan C$ 20: se dio vuelto de más" : "Sobran C$ 50: un cliente no esperó el vuelto",
      },
    });
    open = { nio: expectedNio.plus(diff), usd: expectedUsd };
  }

  const count = async (t: string) => Number((await db.$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM ${t}`))[0]!.n);
  console.log(
    `🧪 Cuatro semanas cargadas: ${await count("product")} productos, ${await count("customer")} clientes, ${await count("motorcycle")} motos, ` +
      `${await count("sale_invoice")} facturas, ${await count("service_order")} órdenes del taller, ${await count("cash_session")} cajas.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void db.$disconnect());
