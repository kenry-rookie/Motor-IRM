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
let engrase: number;
let frenos: number;

beforeAll(async () => {
  admin = await callerAs("admin");
  encargado = await callerAs("encargado");
  cash = await idOf("paymentMethod", "Efectivo");
  engrase = (await db.serviceType.findFirstOrThrow({ where: { name: "Engrase" } })).id;
  frenos = (await db.serviceType.findFirstOrThrow({ where: { name: "Cambio de pastillas de freno" } })).id;
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
    const order = await encargado.service.receive({ motorcycleId: moto.id, items: [{ serviceTypeId: engrase }], requestedWork: "Engrase completo" });
    expect(await db.saleInvoice.count({ where: { serviceOrderId: order.id } })).toBe(0);

    await encargado.service.assignMechanic({ serviceOrderId: order.id, mechanicStaffId: freddy.id });
    await encargado.service.changeStatus({ serviceOrderId: order.id, status: "EN_PROCESO" });
    const fault = await encargado.service.addFault({ serviceOrderId: order.id, description: "Cadena floja", proposedPrice: "100" });

    const terms = { paymentTerms: "CONTADO" as const, payment: { paymentMethodId: cash, currency: "NIO" as const } };
    await expect(
      encargado.service.close({ serviceOrderId: order.id, terms, labor: [{ serviceTypeId: engrase, price: "400" }] }),
    ).rejects.toThrow("sin decisión");
    await encargado.service.decideFault({ additionalFaultId: fault.id, decision: "ACEPTADA" });

    const bujia = await productByBarcode(BUJIA);
    const bill = await encargado.service.close({
      serviceOrderId: order.id,
      terms,
      labor: [{ serviceTypeId: engrase, price: "400" }],
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
    const order = await encargado.service.receive({ motorcycleId: moto.id, items: [{ serviceTypeId: engrase }] });
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
    expect(r.items[0]?.name).toMatch(/^Bujía/);
    expect(r.didYouMean).toMatch(/^Bujía/);
    expect(r.suggestionsOnly).toBe(true);
  });
  it("sin tildes y por pedazos también encuentra, y eso no es sugerencia", async () => {
    const r = await encargado.search.products({ q: "pastillas freno delanteras" });
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
      motorcycleBrandId: (await admin.admin.createCatalogItem({ kind: "motorcycleBrand", name: "Marca de Prueba" })).id,
      name: "XR 150",
    });
    const order = await encargado.service.receive({
      newMotorcycle: {
        newCustomer: { name: "Pedro Gómez", phone: "8123-4567" },
        motorcycleModelId: xr.id,
        color: "Blanca",
        plate: "M 777-000",
      },
      items: [{ serviceTypeId: engrase }], odometerKm: 12000,
    });
    const o = await admin.service.get({ id: order.id });
    expect(o.motorcycle.customer.name).toBe("Pedro Gómez");
    expect(o.motorcycle.model.brand.name).toBe("Marca de Prueba");
    expect(o.status).toBe("RECIBIDA");
    // A repeated plate is rejected; nothing of that reception is left behind.
    await expect(
      encargado.service.receive({
        newMotorcycle: { customerId: o.motorcycle.customer.id, motorcycleModelId: xr.id, color: "Roja", plate: "m 777-000" },
        items: [{ serviceTypeId: engrase }],
      }),
    ).rejects.toThrow("Ya existe una moto con esa placa");
  });

  it("no acepta un modelo que no está en el catálogo, y el encargado no puede crear marcas", async () => {
    const customer = await db.customer.findFirstOrThrow({ where: { name: "Juan Pérez" } });
    await expect(
      encargado.service.receive({
        newMotorcycle: { customerId: customer.id, motorcycleModelId: 999_999, color: "Azul" },
        items: [{ serviceTypeId: engrase }],
      }),
    ).rejects.toThrow("no está en el catálogo");
    await expect(encargado.admin.createCatalogItem({ kind: "motorcycleBrand", name: "Bajah" })).rejects.toThrow();
  });
});

describe("responsable de la orden: mecánico o dueño (DEC-041)", () => {
  const receiveAndClose = async (staffId: number, labor: string) => {
    const moto = await db.motorcycle.findFirstOrThrow({ where: { plate: "M 123-456" } });
    const order = await encargado.service.receive({ motorcycleId: moto.id, items: [{ serviceTypeId: frenos }], mechanicStaffId: staffId });
    await encargado.service.close({
      serviceOrderId: order.id,
      terms: { paymentTerms: "CONTADO", payment: { paymentMethodId: cash, currency: "NIO" } },
      labor: [{ serviceTypeId: frenos, price: labor }],
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
      encargado.service.receive({ motorcycleId: moto.id, items: [{ serviceTypeId: frenos }], mechanicStaffId: enc.id }),
    ).rejects.toThrow("no repara motos");
    const owner = await db.staff.findFirstOrThrow({ where: { name: "Segundo Dueño" } });
    // Even writing straight to the database (skipping the API) is rejected.
    await expect(
      db.serviceOrder.create({
        data: { motorcycleId: moto.id, items: { create: [{ serviceTypeId: frenos }] }, mechanicStaffId: owner.id, appliedCommissionRate: "0.6" },
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

describe("trabajos del taller desde el catálogo (DEC-048)", () => {
  it("una orden necesita al menos un trabajo; la base lo exige aunque se salte la API", async () => {
    const moto = await db.motorcycle.findFirstOrThrow({ where: { plate: "M 123-456" } });
    await expect(encargado.service.receive({ motorcycleId: moto.id, items: [] })).rejects.toThrow("al menos un trabajo");
    await expect(db.serviceOrder.create({ data: { motorcycleId: moto.id } })).rejects.toThrow("al menos un trabajo");
  });

  it("se pueden cambiar los trabajos de una orden abierta", async () => {
    const moto = await db.motorcycle.findFirstOrThrow({ where: { plate: "M 123-456" } });
    const order = await encargado.service.receive({ motorcycleId: moto.id, items: [{ serviceTypeId: engrase }], requestedWork: "suena al frenar" });
    await encargado.service.setItems({ serviceOrderId: order.id, items: [{ serviceTypeId: frenos }, { serviceTypeId: engrase }] });
    const o = await admin.service.get({ id: order.id });
    expect(o.items.map((i) => i.serviceType.id).sort()).toEqual([engrase, frenos].sort());
    expect(o.requestedWork).toBe("suena al frenar");
  });

  it("cobrar fuera del rango de precio pide la clave de un dueño", async () => {
    const moto = await db.motorcycle.findFirstOrThrow({ where: { plate: "M 654-321" } });
    const mario = await db.staff.findFirstOrThrow({ where: { name: "Mario Taller" } });
    const order = await encargado.service.receive({ motorcycleId: moto.id, items: [{ serviceTypeId: frenos }], mechanicStaffId: mario.id });
    const terms = { paymentTerms: "CONTADO" as const, payment: { paymentMethodId: cash, currency: "NIO" as const } };
    await expect(
      encargado.service.close({ serviceOrderId: order.id, terms, labor: [{ serviceTypeId: frenos, price: "5000" }] }),
    ).rejects.toThrow("taller.precio_especial");
    const bill = await encargado.service.close({
      serviceOrderId: order.id,
      terms: { ...terms, authorizer: { username: "admin", password: "admin-pruebas" } },
      labor: [{ serviceTypeId: frenos, price: "5000" }],
    });
    expect(bill.total.toString()).toBe("5000");
  });
});

describe("teléfonos con formato (DEC-047)", () => {
  it("se guardan como 8888-1111 o con código de país, y se rechazan incompletos", async () => {
    const a = await encargado.customer.create({ name: "Cliente Prueba Uno", phone: "85687080" });
    expect(a.phone).toBe("8568-7080");
    const b = await encargado.customer.create({ name: "Cliente Prueba Dos", phone: "+1 3055551234" });
    expect(b.phone).toBe("+1 305-555-1234");
    const c = await encargado.customer.create({ name: "Cliente Prueba Tres", phone: "+505 8899 4433" });
    expect(c.phone).toBe("8899-4433");
    await expect(encargado.customer.create({ name: "Cliente Prueba Cuatro", phone: "1234" })).rejects.toThrow("Teléfono incompleto");
    await expect(db.customer.create({ data: { name: "Directo", phone: "88991122" } })).rejects.toThrow("ck_customer_phone_format");
  });
});

describe("filtros en la base de datos (DEC-049)", () => {
  it("productos por categoría y existencias; clientes con deuda", async () => {
    const cat = await db.productCategory.findFirstOrThrow({ where: { name: "Lubricantes" } });
    const r = await encargado.search.products({ categoryId: cat.id, stock: "disponible", limit: 50 });
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.items.every((p) => p.productCategoryId === cat.id && p.stock > 0)).toBe(true);
    const debtors = await encargado.search.customers({ debt: "con_deuda", sort: "deuda", limit: 50 });
    expect(debtors.items.every((c) => Number(c.balance) > 0)).toBe(true);
    const none = await encargado.search.customers({ debt: "sin_deuda", limit: 50 });
    expect(none.items.every((c) => Number(c.balance ?? 0) <= 0)).toBe(true);
  });
});

describe("permisos con contraseña (DEC-050)", () => {
  it("guardar un rol pide la contraseña de quien guarda, aunque sea dueño", async () => {
    const roles = await admin.admin.roles();
    const enc = roles.find((r) => r.name === "Encargado")!;
    const ids = enc.permissions.map((p) => p.permissionId);
    await expect(
      admin.admin.saveRole({ id: enc.id, name: enc.name, permissionIds: ids, confirmPassword: "otra-clave" }),
    ).rejects.toThrow("contraseña no es correcta");
    await admin.admin.saveRole({ id: enc.id, name: enc.name, permissionIds: ids, confirmPassword: "admin-pruebas" });
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

describe("orden terminada no se cancela (DEC-051)", () => {
  it("la API y la base rechazan cancelar una orden TERMINADA", async () => {
    const moto = await db.motorcycle.findFirstOrThrow({ where: { plate: "M 123-456" } });
    const order = await encargado.service.receive({ motorcycleId: moto.id, items: [{ serviceTypeId: engrase }] });
    await encargado.service.changeStatus({ serviceOrderId: order.id, status: "TERMINADA" });
    await expect(encargado.service.cancel({ serviceOrderId: order.id, notes: "Ya no la quiere" })).rejects.toThrow(
      "no se puede cancelar",
    );
    // Aunque alguien se salte la API, el trigger lo impide.
    const user = await db.appUser.findFirstOrThrow({ where: { username: "admin" } });
    await expect(
      db.serviceOrderStatusChange.create({ data: { serviceOrderId: order.id, status: "CANCELADA", registeredByUserId: user.id } }),
    ).rejects.toThrow();
    expect((await admin.service.get({ id: order.id })).status).toBe("TERMINADA");
  });
});

describe("precio rebajado en caja (DEC-052)", () => {
  const terms = { paymentTerms: "CONTADO" as const, payment: { paymentMethodId: 0, currency: "NIO" as const } };

  it("rebajar 2 % pide permiso; con permiso queda guardado como descuento sobre el precio normal", async () => {
    const p = await productByBarcode(ACEITE);
    const t = { ...terms, payment: { ...terms.payment, paymentMethodId: cash } };
    await expect(encargado.sales.create({ terms: t, lines: [{ productId: p.id, quantity: 1, unitPrice: "215.60" }] })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    const sale = await admin.sales.create({ terms: t, lines: [{ productId: p.id, quantity: 2, unitPrice: "215.60" }] });
    expect(sale.total.toString()).toBe("431.2");
    const inv = await admin.sales.getInvoice({ id: sale.id });
    expect(inv.lines[0]!.unitPrice.toString()).toBe("220");
    expect(inv.lines[0]!.discountAmount.toString()).toBe("8.8");
  });

  it("no se puede subir el precio ni bajarlo por debajo del costo", async () => {
    const p = await productByBarcode(ACEITE);
    const t = { ...terms, payment: { ...terms.payment, paymentMethodId: cash } };
    const rows = await db.$queryRaw<{ last_cost: Prisma.Decimal }[]>`SELECT last_cost FROM v_product_margin WHERE product_id = ${p.id}`;
    const last_cost = rows[0]!.last_cost;
    await expect(admin.sales.create({ terms: t, lines: [{ productId: p.id, quantity: 1, unitPrice: "230" }] })).rejects.toThrow("mayor");
    const below = new Prisma.Decimal(last_cost).minus("0.01").toFixed(2);
    await expect(admin.sales.create({ terms: t, lines: [{ productId: p.id, quantity: 1, unitPrice: below }] })).rejects.toThrow("costo");
    // Exactamente el costo sí se permite.
    const ok = await admin.sales.create({ terms: t, lines: [{ productId: p.id, quantity: 1, unitPrice: new Prisma.Decimal(last_cost).toFixed(2) }] });
    // Y la base lo exige aunque se salte la API.
    await expect(
      db.saleInvoiceLine.create({
        data: { saleInvoiceId: ok.id, lineNo: 9, lineType: "PRODUCTO", productId: p.id, quantity: 1, unitPrice: "220", discountAmount: "219" },
      }),
    ).rejects.toThrow();
  });
});

describe("comprobante de abono (DEC-053)", () => {
  it("dice quién pagó, cuánto, a qué factura y cuánto queda", async () => {
    const customer = await db.customer.findFirstOrThrow({ where: { name: "Juan Pérez" } });
    const p = await productByBarcode(BUJIA);
    const due = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    const sale = await admin.sales.create({
      terms: { paymentTerms: "CREDITO", customerId: customer.id, dueDate: due },
      lines: [{ productId: p.id, quantity: 2 }],
    });
    const pay = await encargado.sales.registerPayment({
      customerId: customer.id,
      amount: "100",
      paymentMethodId: cash,
      allocations: [{ saleInvoiceId: sale.id, amount: "100" }],
    });
    const r = await admin.sales.getPayment({ id: pay.id });
    expect(r.customer?.name).toBe("Juan Pérez");
    expect(r.amountNio.toString()).toBe("100");
    expect(r.allocations[0]!.saleInvoiceId).toBe(sale.id);
    expect(r.allocations[0]!.balanceNow?.toString()).toBe("140");
    const st = await admin.customer.statement({ customerId: customer.id });
    expect(st.payments.some((x) => x.id === pay.id)).toBe(true);
  });
});

describe("registro de facturas (DEC-054)", () => {
  it("lista lo cobrado con filtros hechos por la base y totales de todo lo que coincide", async () => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Managua" }).format(new Date());
    const all = await admin.sales.searchInvoices({ from: today, to: today });
    expect(all.count).toBeGreaterThan(0);
    expect(all.items.every((i) => i.id > 0)).toBe(true);

    const credit = await admin.sales.searchInvoices({ from: today, to: today, paymentTerms: "CREDITO", state: "PENDIENTES" });
    expect(credit.items.every((i) => i.paymentTerms === "CREDITO" && Number(i.balance) > 0)).toBe(true);
    expect(credit.sumBalance.toString()).toBe(
      credit.items.reduce((a, i) => a.plus(i.balance), new Prisma.Decimal(0)).toString(),
    );

    const byName = await admin.sales.searchInvoices({ text: "juan perez" }); // sin tilde
    expect(byName.items.length).toBeGreaterThan(0);
    expect(byName.items.every((i) => (i.customer?.name ?? "").includes("Juan Pérez"))).toBe(true);

    const one = all.items[0]!;
    const byNumber = await admin.sales.searchInvoices({ text: String(one.id).padStart(6, "0") });
    expect(byNumber.items.some((i) => i.id === one.id)).toBe(true);

    const workshop = await admin.sales.searchInvoices({ origin: "TALLER" });
    expect(workshop.items.every((i) => i.serviceOrderId !== null)).toBe(true);
  });
});

describe("anulación de facturas (DEC-055)", () => {
  it("un dueño anula: los productos regresan, el saldo queda en 0 y se registra el efectivo devuelto", async () => {
    const p = await productByBarcode(BUJIA);
    const sale = await admin.sales.create({
      terms: { paymentTerms: "CONTADO", payment: { paymentMethodId: cash, currency: "NIO" } },
      lines: [{ productId: p.id, quantity: 2 }],
    });
    // El encargado no tiene el permiso.
    await expect(encargado.sales.voidInvoice({ saleInvoiceId: sale.id, reason: "Se cobró mal" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(admin.sales.voidInvoice({ saleInvoiceId: sale.id, reason: "x" })).rejects.toThrow();

    const v = await admin.sales.voidInvoice({ saleInvoiceId: sale.id, reason: "Se cobró el producto equivocado" });
    expect(v.refundAmount.toString()).toBe("240");
    expect((await productByBarcode(BUJIA)).stock).toBe(p.stock);
    const inv = await admin.sales.getInvoice({ id: sale.id });
    expect(inv.void?.reason).toBe("Se cobró el producto equivocado");
    expect(inv.balance.toString()).toBe("0");
    await expect(admin.sales.voidInvoice({ saleInvoiceId: sale.id, reason: "Otra vez" })).rejects.toThrow("ya está anulada");

    const list = await admin.sales.searchInvoices({ state: "ANULADAS" });
    expect(list.items.some((i) => i.id === sale.id && i.voided)).toBe(true);
  });

  it("al crédito: no recibe abonos después; y no se anula pasados 3 días", async () => {
    const customer = await db.customer.findFirstOrThrow({ where: { name: "Juan Pérez" } });
    const p = await productByBarcode(BUJIA);
    const due = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    const sale = await admin.sales.create({
      terms: { paymentTerms: "CREDITO", customerId: customer.id, dueDate: due },
      lines: [{ productId: p.id, quantity: 1 }],
    });
    await admin.sales.voidInvoice({ saleInvoiceId: sale.id, reason: "El cliente no se llevó nada" });
    await expect(
      encargado.sales.registerPayment({
        customerId: customer.id,
        amount: "10",
        paymentMethodId: cash,
        allocations: [{ saleInvoiceId: sale.id, amount: "10" }],
      }),
    ).rejects.toThrow();

    const old = await admin.sales.create({
      terms: { paymentTerms: "CONTADO", payment: { paymentMethodId: cash, currency: "NIO" } },
      lines: [{ productId: p.id, quantity: 1 }],
    });
    await db.$executeRaw`UPDATE sale_invoice SET created_at = now() - interval '4 days' WHERE id = ${old.id}`;
    await expect(admin.sales.voidInvoice({ saleInvoiceId: old.id, reason: "Demasiado tarde" })).rejects.toThrow("3 días");
  });
});
