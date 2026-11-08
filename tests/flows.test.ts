import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "~/server/auth/password";
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
    const freddy = await db.staff.findFirstOrThrow({ where: { name: "Freddy Orozco" } });
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
