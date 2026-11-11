import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "~/server/auth/password";
import { Prisma } from "~/server/db";
import { callerAs, db, idOf, productByBarcode } from "./helpers";

const BUJIA = "7501234500011"; // stock 20, price 120
const CADENA = "7501234500059"; // stock 5, price 450
const ACEITE = "7501234500035"; // stock 30, price 220

let admin: Awaited<ReturnType<typeof callerAs>>;
let encargado: Awaited<ReturnType<typeof callerAs>>;
let cash: number;

beforeAll(async () => {
  admin = await callerAs("admin");
  encargado = await callerAs("encargado");
  cash = await idOf("paymentMethod", "Efectivo");
});
afterAll(async () => {
  // The kardex and the stock column must still agree after everything (DEC-039).
  const mismatches = await db.$queryRaw<unknown[]>`SELECT * FROM v_product_stock_mismatch`;
  expect(mismatches).toHaveLength(0);
  await db.$disconnect();
});

describe("contraseñas", () => {
  it("verifica la correcta y rechaza la incorrecta", async () => {
    const h = await hashPassword("clave-segura");
    expect(await verifyPassword("clave-segura", h)).toBe(true);
    expect(await verifyPassword("otra", h)).toBe(false);
  });
});

describe("seguridad", () => {
  it("sin sesión no se puede leer inventario", async () => {
    const { createCaller } = await import("~/server/api/root");
    const anon = createCaller({ db, user: null, sessionToken: null, headers: new Headers() });
    await expect(anon.inventory.listProducts()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
  it("el encargado no puede ajustar inventario", async () => {
    const p = await productByBarcode(BUJIA);
    await expect(
      encargado.inventory.adjust({ productId: p.id, direction: "SALIDA", quantity: 1, notes: "x" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("venta en mostrador (API-012)", () => {
  it("de contado: baja el stock, crea el pago y la factura queda saldada", async () => {
    const p = await productByBarcode(BUJIA);
    const sale = await encargado.sales.create({
      terms: { paymentTerms: "CONTADO", payment: { paymentMethodId: cash, currency: "NIO" } },
      lines: [{ productId: p.id, quantity: 2 }],
    });
    expect(sale.total.toString()).toBe("240");
    expect((await productByBarcode(BUJIA)).stock).toBe(p.stock - 2);
    const inv = await admin.sales.getInvoice({ id: sale.id });
    expect(inv.balance.toString()).toBe("0");
  });

  it("sin existencias: falla con mensaje claro y no deja nada a medias", async () => {
    const p = await productByBarcode(CADENA);
    const before = await db.saleInvoice.count();
    await expect(
      encargado.sales.create({
        terms: { paymentTerms: "CONTADO", payment: { paymentMethodId: cash, currency: "NIO" } },
        lines: [{ productId: p.id, quantity: p.stock + 1 }],
      }),
    ).rejects.toThrow("No hay existencias suficientes");
    expect(await db.saleInvoice.count()).toBe(before);
    expect((await productByBarcode(CADENA)).stock).toBe(p.stock);
  });

  it("descuento manual sin autorización se rechaza; con clave del dueño pasa", async () => {
    const p = await productByBarcode(ACEITE);
    const base = {
      terms: { paymentTerms: "CONTADO" as const, payment: { paymentMethodId: cash, currency: "NIO" as const } },
      lines: [{ productId: p.id, quantity: 1, discountAmount: "20" }],
    };
    await expect(encargado.sales.create(base)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const ok = await encargado.sales.create({
      ...base,
      terms: { ...base.terms, authorizer: { username: "admin", password: "admin-pruebas" } },
    });
    expect(ok.total.toString()).toBe("200");
  });
});

describe("crédito, abonos y devoluciones (API-013, 014, 016)", () => {
  it("flujo completo de una venta al crédito", async () => {
    const customer = await db.customer.findFirstOrThrow({ where: { name: "Juan Pérez" } });
    const p = await productByBarcode(ACEITE);
    const due = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    const sale = await admin.sales.create({
      terms: { paymentTerms: "CREDITO", customerId: customer.id, dueDate: due },
      lines: [{ productId: p.id, quantity: 3 }],
    });
    expect(sale.total.toString()).toBe("660");

    // Pagar más de lo que se debe: rechazado.
    await expect(
      encargado.sales.registerPayment({
        customerId: customer.id,
        amount: "700",
        paymentMethodId: cash,
        allocations: [{ saleInvoiceId: sale.id, amount: "700" }],
      }),
    ).rejects.toThrow("solo debe");

    await encargado.sales.registerPayment({
      customerId: customer.id,
      amount: "200",
      paymentMethodId: cash,
      allocations: [{ saleInvoiceId: sale.id, amount: "200" }],
    });

    // Devolver 1 aceite: vuelve al stock y baja la deuda en 220.
    const inv = await admin.sales.getInvoice({ id: sale.id });
    const line = inv.lines[0]!;
    const stockBefore = (await productByBarcode(ACEITE)).stock;
    await encargado.sales.createReturn({
      saleInvoiceId: sale.id,
      returnReasonId: await idOf("returnReason", "Producto defectuoso"),
      lines: [{ saleInvoiceLineId: line.id, quantity: 1 }],
    });
    expect((await productByBarcode(ACEITE)).stock).toBe(stockBefore + 1);
    await expect(
      encargado.sales.createReturn({
        saleInvoiceId: sale.id,
        returnReasonId: await idOf("returnReason", "Producto defectuoso"),
        lines: [{ saleInvoiceLineId: line.id, quantity: 3 }],
      }),
    ).rejects.toThrow("ya se devolvieron 1");

    const st = await admin.customer.statement({ customerId: customer.id });
    expect(st.totalBalance.toString()).toBe("240"); // 660 − 220 − 200
  });
});

describe("taller (API-015) y personal (API-018)", () => {
  it("recibir sin factura, falla adicional, cerrar con repuesto, comisión y pago", async () => {
    const moto = await db.motorcycle.findFirstOrThrow({ where: { plate: "M 654-321" } });
    const freddy = await db.staff.findFirstOrThrow({ where: { name: "Mario Taller" } });
    const order = await encargado.service.receive({ motorcycleId: moto.id, requestedWork: "Engrase completo" });
    expect(await db.saleInvoice.count({ where: { serviceOrderId: order.id } })).toBe(0);

    await encargado.service.assignMechanic({ serviceOrderId: order.id, mechanicStaffId: freddy.id });
    await encargado.service.changeStatus({ serviceOrderId: order.id, status: "EN_PROCESO" });
    const fault = await encargado.service.addFault({ serviceOrderId: order.id, description: "Cadena floja", proposedPrice: "100" });

    const terms = { paymentTerms: "CONTADO" as const, payment: { paymentMethodId: cash, currency: "NIO" as const } };
    await expect(
      encargado.service.close({ serviceOrderId: order.id, terms, labor: [{ description: "Engrase", price: "400" }] }),
    ).rejects.toThrow("sin decisión");
    await encargado.service.decideFault({ additionalFaultId: fault.id, decision: "ACEPTADA" });

    const bujia = await productByBarcode(BUJIA);
    const bill = await encargado.service.close({
      serviceOrderId: order.id,
      terms,
      labor: [{ description: "Engrase", price: "400" }],
      parts: [{ productId: bujia.id, quantity: 1 }],
    });
    expect(bill.total.toString()).toBe("620"); // 400 + 100 + 120
    expect((await productByBarcode(BUJIA)).stock).toBe(bujia.stock - 1);
    const o = await admin.service.get({ id: order.id });
    expect(o.status).toBe("ENTREGADA");
    expect(o.saleInvoice?.id).toBe(bill.id);
    await expect(
      encargado.service.changeStatus({ serviceOrderId: order.id, status: "EN_PROCESO" }),
    ).rejects.toThrow("no se puede cambiar");

    // Comisión: mano de obra (400 + 100) × 60 % = 300.
    const pending = await admin.staff.pending({ staffId: freddy.id });
    expect(pending.commission.toString()).toBe("300");
    await expect(admin.staff.giveAdvance({ staffId: freddy.id, amount: "500" })).rejects.toThrow("no se puede adelantar");
    await admin.staff.giveAdvance({ staffId: freddy.id, amount: "100" });
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Managua" }).format(new Date());
    const payout = await admin.staff.createPayout({ staffId: freddy.id, periodStart: today, periodEnd: today });
    expect(payout.net.toString()).toBe("200");
  });

  it("cancelar una orden sin cargo no crea factura", async () => {
    const moto = await db.motorcycle.findFirstOrThrow({ where: { plate: "M 123-456" } });
    const order = await encargado.service.receive({ motorcycleId: moto.id, requestedWork: "Revisión" });
    const r = await encargado.service.cancel({ serviceOrderId: order.id, notes: "El cliente se llevó la moto" });
    expect(r.invoiceId).toBeNull();
  });
});

describe("compras (API-017)", () => {
  it("la compra sube el stock; la devolución lo baja; no se paga de más", async () => {
    const supplier = await db.supplier.findFirstOrThrow();
    const p = await productByBarcode(CADENA);
    const purchase = await encargado.purchasing.createInvoice({
      supplierId: supplier.id,
      invoiceNumber: "FAC-0001",
      paymentTerms: "CREDITO",
      dueDate: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
      lines: [{ productId: p.id, quantity: 10, unitCost: "300" }],
    });
    expect((await productByBarcode(CADENA)).stock).toBe(p.stock + 10);
    const detail = await admin.purchasing.getInvoice({ id: purchase.id });
    await encargado.purchasing.createReturn({
      purchaseInvoiceId: purchase.id,
      returnReasonId: await idOf("returnReason", "Producto defectuoso"),
      resolution: "DESCUENTO",
      lines: [{ purchaseInvoiceLineId: detail.lines[0]!.id, quantity: 2 }],
    });
    expect((await productByBarcode(CADENA)).stock).toBe(p.stock + 8);
    await expect(
      encargado.purchasing.registerPayment({ supplierId: supplier.id, purchaseInvoiceId: purchase.id, amount: "3000" }),
    ).rejects.toThrow("Solo se deben C$ 2400.00");
  });
});

describe("búsqueda tolerante a errores: un solo servicio (API-021, DEC-043)", () => {
  it("encuentra el producto aunque esté mal escrito y lo marca como sugerencia", async () => {
    const r = await encargado.search.products({ q: "bugia" });
    expect(r.items[0]?.name).toBe("Bujía NGK C7HSA");
    expect(r.didYouMean).toBe("Bujía NGK C7HSA");
    expect(r.suggestionsOnly).toBe(true);
  });
  it("sin tildes y por pedazos también encuentra, y eso no es sugerencia", async () => {
    const r = await encargado.search.products({ q: "pastillas freno" });
    expect(r.items[0]?.name).toBe("Pastillas de freno delanteras");
    const exact = await encargado.search.products({ q: "bujia" });
    expect(exact.didYouMean).toBeNull();
  });
  it("el código de barras va primero", async () => {
    const r = await encargado.search.products({ q: CADENA });
    expect(r.items[0]?.barcode).toBe(CADENA);
  });
  it("clientes por nombre mal escrito, por placa sin guion o por teléfono", async () => {
    expect((await encargado.search.customers({ q: "marai lopes" })).items[0]?.name).toBe("María López");
    expect((await encargado.search.customers({ q: "654321" })).items[0]?.name).toBe("María López");
    expect((await encargado.search.customers({ q: "8888-1111" })).items[0]?.name).toBe("Juan Pérez");
  });
});

describe("recepción en un solo paso, marca y modelo del catálogo (DEC-044)", () => {
  it("registra cliente, moto y orden juntos con un modelo elegido de la lista", async () => {
    const xr = await admin.admin.saveMotorcycleModel({
      motorcycleBrandId: (await admin.admin.createCatalogItem({ kind: "motorcycleBrand", name: "Honda" })).id,
      name: "XR 150",
    });
    const order = await encargado.service.receive({
      newMotorcycle: {
        newCustomer: { name: "Pedro Gómez", phone: "8123-4567" },
        motorcycleModelId: xr.id,
        color: "Blanca",
        plate: "M 777-000",
      },
      requestedWork: "Cambio de aceite",
    });
    const o = await admin.service.get({ id: order.id });
    expect(o.motorcycle.customer.name).toBe("Pedro Gómez");
    expect(o.motorcycle.model.brand.name).toBe("Honda");
    expect(o.status).toBe("RECIBIDA");
    // A repeated plate is rejected; nothing of that reception is left behind.
    await expect(
      encargado.service.receive({
        newMotorcycle: { customerId: o.motorcycle.customer.id, motorcycleModelId: xr.id, color: "Roja", plate: "m 777-000" },
        requestedWork: "Revisión",
      }),
    ).rejects.toThrow("Ya existe una moto con esa placa");
  });

  it("no acepta un modelo que no está en el catálogo, y el encargado no puede crear marcas", async () => {
    const customer = await db.customer.findFirstOrThrow({ where: { name: "Juan Pérez" } });
    await expect(
      encargado.service.receive({
        newMotorcycle: { customerId: customer.id, motorcycleModelId: 999_999, color: "Azul" },
        requestedWork: "Revisión",
      }),
    ).rejects.toThrow("no está en el catálogo");
    await expect(encargado.admin.createCatalogItem({ kind: "motorcycleBrand", name: "Bajah" })).rejects.toThrow();
  });
});

describe("responsable de la orden: mecánico o dueño (DEC-041)", () => {
  const receiveAndClose = async (staffId: number, labor: string) => {
    const moto = await db.motorcycle.findFirstOrThrow({ where: { plate: "M 123-456" } });
    const order = await encargado.service.receive({ motorcycleId: moto.id, requestedWork: "Frenos", mechanicStaffId: staffId });
    await encargado.service.close({
      serviceOrderId: order.id,
      terms: { paymentTerms: "CONTADO", payment: { paymentMethodId: cash, currency: "NIO" } },
      labor: [{ description: "Frenos", price: labor }],
    });
    return db.serviceOrder.findUniqueOrThrow({ where: { id: order.id } });
  };

  it("un dueño puede reparar; la orden no lleva porcentaje y no genera comisión", async () => {
    const owner = await db.staff.findFirstOrThrow({ where: { name: "Segundo Dueño" } });
    const order = await receiveAndClose(owner.id, "300");
    expect(order.appliedCommissionRate).toBeNull();
    const rows = await db.$queryRaw<unknown[]>`SELECT * FROM v_mechanic_unpaid_commission WHERE service_order_id = ${order.id}`;
    expect(rows).toHaveLength(0);
    await expect(
      admin.staff.createPayout({ staffId: owner.id, periodStart: "2026-01-01", periodEnd: "2099-12-31" }),
    ).rejects.toThrow("No hay comisiones");
  });

  it("el mecánico «al 100 %» atiende la moto pero no se paga por el sistema", async () => {
    const m = await db.staff.findFirstOrThrow({ where: { name: "Pablo Llave" } });
    const order = await receiveAndClose(m.id, "250");
    expect(order.mechanicStaffId).toBe(m.id);
    expect(order.appliedCommissionRate).toBeNull();
    expect((await admin.staff.pending({ staffId: m.id })).commission.toString()).toBe("0");
  });

  it("el encargado no repara motos; la base rechaza porcentaje a un dueño", async () => {
    const enc = await db.staff.findFirstOrThrow({ where: { kind: "ENCARGADO" } });
    const moto = await db.motorcycle.findFirstOrThrow({ where: { plate: "M 123-456" } });
    await expect(
      encargado.service.receive({ motorcycleId: moto.id, requestedWork: "x", mechanicStaffId: enc.id }),
    ).rejects.toThrow("no repara motos");
    const owner = await db.staff.findFirstOrThrow({ where: { name: "Segundo Dueño" } });
    // Even writing straight to the database (skipping the API) is rejected.
    await expect(
      db.serviceOrder.create({
        data: { motorcycleId: moto.id, requestedWork: "x", mechanicStaffId: owner.id, appliedCommissionRate: "0.6" },
      }),
    ).rejects.toThrow("Un dueño no cobra comisión");
    await expect(
      admin.staff.save({ id: owner.id, name: owner.name, phone: owner.phone, kind: "DUENO", commissionRate: "0.5" }),
    ).rejects.toThrow("Un dueño no cobra comisión");
  });
});

describe("saldos desde vistas SQL (DEC-042)", () => {
  it("la vista y las cuentas por cobrar dicen lo mismo que la factura", async () => {
    const r = await admin.sales.receivables();
    for (const row of r.rows) {
      const statement = await admin.customer.statement({ customerId: row.customerId });
      const open = [...statement.invoices, ...statement.openingBalances].filter((x) => x.balance.gt(0));
      const sum = open.reduce((a, x) => a.plus(x.balance), new Prisma.Decimal(0));
      expect(sum.toString()).toBe(row.balance.toString());
    }
  });
});

describe("reportes por periodo", () => {
  it("agrupa por día y compara con el periodo anterior", async () => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Managua" }).format(new Date());
    const r = await admin.reports.period({ from: today, to: today, granularity: "day" });
    expect(r.series).toHaveLength(1);
    expect(Number(r.current.sales)).toBeGreaterThan(0);
    expect(r.topProducts.length).toBeGreaterThan(0);
    // "Hoy" is only a preset of the same report (DEC-043): money by method, cash net, workshop, low stock.
    expect(r.receivedByMethod.length).toBeGreaterThan(0);
    expect(typeof r.cashNet).toBe("string");
    expect(r.openOrders).toBeGreaterThanOrEqual(0);
    const m = await admin.reports.period({ from: `${today.slice(0, 5)}01-01`, to: today, granularity: "month" });
    expect(m.series.length).toBe(Number(today.slice(5, 7)));
  });
});
