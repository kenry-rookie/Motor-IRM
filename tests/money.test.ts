import { beforeAll, describe, expect, it } from "vitest";

import { D } from "~/server/domain/money";
import { callerAs, db, idOf, productByBarcode } from "./helpers";

/**
 * Revisión del 23-nov (migración 9f, DEC-057 a DEC-061): de dónde viene y a
 * dónde va cada córdoba del arqueo, viajes de compra, retiros corregibles y
 * catálogos que se pueden corregir.
 */
const BUJIA = "7501234500011"; // price 120
const ACEITE = "7501234500035"; // price 220

let admin: Awaited<ReturnType<typeof callerAs>>;
let encargado: Awaited<ReturnType<typeof callerAs>>;
let cash: number;

/** Lo que el arqueo de hoy dice de un motivo (C$). */
async function line(kind: string) {
  const s = (await admin.cash.current())!.summary;
  const l = [...s.inflows, ...s.outflows].find((x) => x.key === kind);
  return { nio: l?.nio ?? D(0), count: l?.count ?? 0 };
}
const expectedNio = async () => (await admin.cash.current())!.expected.nio;

beforeAll(async () => {
  admin = await callerAs("admin");
  encargado = await callerAs("encargado");
  cash = await idOf("paymentMethod", "Efectivo");
  // Caja de hoy abierta, venga de donde venga el archivo anterior.
  const st = await admin.cash.status();
  if (st.open && !st.open.isToday) throw new Error("Hay una caja de otro día abierta en la base de pruebas");
  if (!st.open) {
    if (st.todayClosed && st.todaySessionId) await admin.cash.reopen({ cashSessionId: st.todaySessionId, reason: "Pruebas de dinero" });
    else await admin.cash.open({ openingNio: "5000" });
  }
});

describe("devolución con reembolso (DEC-057)", () => {
  it("el efectivo devuelto queda en la devolución, no como retiro, y el saldo queda en 0", async () => {
    const p = await productByBarcode(BUJIA);
    const sale = await encargado.sales.create({
      terms: { paymentTerms: "CONTADO", payment: { paymentMethodId: cash, currency: "NIO" } },
      lines: [{ productId: p.id, quantity: 2 }],
    });
    const before = await line("REEMBOLSO_DEVOLUCION");
    const withdrawalsBefore = await line("RETIRO");
    const inv = await admin.sales.getInvoice({ id: sale.id });
    const reason = await idOf("returnReason", "Producto defectuoso");
    // Más de lo pagado de más: rechazado.
    await expect(
      encargado.sales.createReturn({
        saleInvoiceId: sale.id,
        returnReasonId: reason,
        lines: [{ saleInvoiceLineId: inv.lines[0]!.id, quantity: 1 }],
        refundAmount: "121",
      }),
    ).rejects.toThrow("Solo se le pueden devolver C$ 120.00");
    await encargado.sales.createReturn({
      saleInvoiceId: sale.id,
      returnReasonId: reason,
      lines: [{ saleInvoiceLineId: inv.lines[0]!.id, quantity: 1 }],
      refundAmount: "120",
    });
    const after = await admin.sales.getInvoice({ id: sale.id });
    expect(after.balance.toString()).toBe("0");
    expect(after.refunded.toString()).toBe("120");
    const now = await line("REEMBOLSO_DEVOLUCION");
    expect(now.nio.minus(before.nio).toString()).toBe("120");
    expect((await line("RETIRO")).nio.toString()).toBe(withdrawalsBefore.nio.toString());
  });

  it("al anular después, solo se devuelve lo que falta (no dos veces)", async () => {
    const p = await productByBarcode(BUJIA);
    const sale = await admin.sales.create({
      terms: { paymentTerms: "CONTADO", payment: { paymentMethodId: cash, currency: "NIO" } },
      lines: [{ productId: p.id, quantity: 2 }],
    });
    const inv = await admin.sales.getInvoice({ id: sale.id });
    await admin.sales.createReturn({
      saleInvoiceId: sale.id,
      returnReasonId: await idOf("returnReason", "Producto defectuoso"),
      lines: [{ saleInvoiceLineId: inv.lines[0]!.id, quantity: 1 }],
      refundAmount: "120",
    });
    const v = await admin.sales.voidInvoice({ saleInvoiceId: sale.id, reason: "Prueba de anulación" });
    expect(v.refundAmount.toString()).toBe("120");
  });
});

describe("el arqueo dice de qué fue cada entrada (DEC-058)", () => {
  it("venta de mostrador → «Ventas de mostrador»; abono a un crédito → «Abonos de clientes»", async () => {
    const p = await productByBarcode(ACEITE);
    const ventas = await line("COBRO_VENTA");
    await encargado.sales.create({
      terms: { paymentTerms: "CONTADO", payment: { paymentMethodId: cash, currency: "NIO" } },
      lines: [{ productId: p.id, quantity: 1 }],
    });
    expect((await line("COBRO_VENTA")).nio.minus(ventas.nio).toString()).toBe("220");

    const customer = await db.customer.findFirstOrThrow();
    const credit = await admin.sales.create({
      terms: {
        paymentTerms: "CREDITO",
        customerId: customer.id,
        dueDate: new Date(Date.now() + 15 * 86_400_000).toISOString().slice(0, 10),
      },
      lines: [{ productId: p.id, quantity: 1 }],
    });
    const abonos = await line("ABONO_CLIENTE");
    await encargado.sales.registerPayment({
      customerId: customer.id,
      amount: "100",
      paymentMethodId: cash,
      allocations: [{ saleInvoiceId: credit.id, amount: "100" }],
    });
    expect((await line("ABONO_CLIENTE")).nio.minus(abonos.nio).toString()).toBe("100");
  });
});

describe("pagos a proveedores con el origen del dinero (DEC-058)", () => {
  it("de la caja resta en el arqueo; fuera de la caja no", async () => {
    const supplier = await db.supplier.findFirstOrThrow();
    const p = await productByBarcode(ACEITE);
    const due = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    const purchase = await admin.purchasing.createInvoice({
      supplierId: supplier.id,
      invoiceNumber: `PRUEBA-PP-${Date.now()}`,
      paymentTerms: "CREDITO",
      dueDate: due,
      lines: [{ productId: p.id, quantity: 2, unitCost: "150" }],
    });
    const e0 = await expectedNio();
    await admin.purchasing.registerPayment({ supplierId: supplier.id, purchaseInvoiceId: purchase.id, amount: "100", source: "FUERA_DE_CAJA" });
    expect((await expectedNio()).toString()).toBe(e0.toString());
    await admin.purchasing.registerPayment({ supplierId: supplier.id, purchaseInvoiceId: purchase.id, amount: "50", source: "CAJA" });
    expect(e0.minus(await expectedNio()).toString()).toBe("50");
    const list = await admin.purchasing.listPayments({ supplierId: supplier.id });
    expect(list.items[0]!.source).toBe("CAJA");
    expect(list.items[0]!.registeredBy?.username).toBe("admin");
  });

  it("una compra de contado fuera de viaje exige decir con qué dinero se pagó", async () => {
    const supplier = await db.supplier.findFirstOrThrow();
    const p = await productByBarcode(ACEITE);
    await expect(
      admin.purchasing.createInvoice({
        supplierId: supplier.id,
        invoiceNumber: `PRUEBA-SIN-ORIGEN-${Date.now()}`,
        paymentTerms: "CONTADO",
        lines: [{ productId: p.id, quantity: 1, unitCost: "150" }],
      }),
    ).rejects.toThrow();
  });
});

describe("viaje de compras (DEC-059)", () => {
  it("lleva dinero, compra, gasta, regresa el vuelto, y el arqueo lo ve todo", async () => {
    const supplier = await db.supplier.findFirstOrThrow();
    const p = await productByBarcode(ACEITE);
    const e0 = await expectedNio();
    const trip = await admin.trips.create({ destination: "Managua", traveler: "Dueño", cashTaken: "1000" });
    expect(e0.minus(await expectedNio()).toString()).toBe("1000");

    const stock0 = (await productByBarcode(ACEITE)).stock;
    await admin.purchasing.createInvoice({
      supplierId: supplier.id,
      invoiceNumber: `VIAJE-${trip.id}-1`,
      paymentTerms: "CONTADO",
      purchaseTripId: trip.id,
      lines: [{ productId: p.id, quantity: 3, unitCost: "100" }],
    });
    expect((await productByBarcode(ACEITE)).stock).toBe(stock0 + 3);
    const types = await admin.trips.expenseTypes();
    await admin.trips.addExpense({ purchaseTripId: trip.id, tripExpenseTypeId: types[0]!.id, amount: "100", description: "Bus" });
    // Pagar y gastar con el dinero del viaje no toca la gaveta.
    expect(e0.minus(await expectedNio()).toString()).toBe("1000");

    const t = await admin.trips.get({ id: trip.id });
    expect(t.summary.expectedBack.toString()).toBe("600");
    expect(t.payments[0]!.source).toBe("VIAJE");
    await expect(admin.trips.close({ id: trip.id, cashReturned: "590" })).rejects.toThrow("escriba una nota");
    await admin.trips.close({ id: trip.id, cashReturned: "590", notes: "Se perdieron 10 en el cambio" });
    expect(e0.minus(await expectedNio()).toString()).toBe("410");
    expect((await admin.trips.get({ id: trip.id })).summary.difference?.toString()).toBe("-10");
    // Cerrado: ya no recibe gastos ni facturas.
    await expect(admin.trips.addExpense({ purchaseTripId: trip.id, tripExpenseTypeId: types[0]!.id, amount: "5" })).rejects.toThrow("cerrado");
    // El kardex dice de qué viaje vino.
    const mv = await db.inventoryMovement.findFirstOrThrow({ where: { productId: p.id, movementType: "COMPRA" }, orderBy: { id: "desc" } });
    expect(mv.notes).toContain(`V-${String(trip.id).padStart(6, "0")}`);
  });
});

describe("retiros: corregir y anular con bitácora (DEC-060)", () => {
  it("el administrador corrige y anula; queda en la bitácora y el arqueo lo refleja", async () => {
    const reason = await db.cashWithdrawalReason.findFirstOrThrow({ where: { active: true } });
    const e0 = await expectedNio();
    const w = await admin.staff.withdrawCash({ cashWithdrawalReasonId: reason.id, amount: "500" });
    await admin.staff.updateWithdrawal({ id: w.id, cashWithdrawalReasonId: reason.id, amount: "50", reason: "Se escribió 500 en vez de 50" });
    expect(e0.minus(await expectedNio()).toString()).toBe("50");
    await admin.staff.voidWithdrawal({ id: w.id, reason: "Se registró dos veces" });
    expect((await expectedNio()).toString()).toBe(e0.toString());
    const d = await admin.staff.withdrawal({ id: w.id });
    expect(d.changes.map((c) => c.action)).toEqual(["ANULACION", "EDICION"]);
    await expect(db.cashWithdrawal.delete({ where: { id: w.id } })).rejects.toThrow();
    // Aparece en Comprobantes buscándolo por su número.
    const found = await admin.money.list({ from: "2000-01-01", to: "2100-01-01", text: `RT-${w.id}` });
    expect(found.items.some((i) => i.refTable === "cash_withdrawal" && i.refId === w.id)).toBe(false); // anulado: ya no es dinero
  });

  it("el encargado no corrige el retiro de otra persona", async () => {
    const reason = await db.cashWithdrawalReason.findFirstOrThrow({ where: { active: true } });
    const w = await admin.staff.withdrawCash({ cashWithdrawalReasonId: reason.id, amount: "20" });
    await expect(encargado.staff.updateWithdrawal({ id: w.id, cashWithdrawalReasonId: reason.id, amount: "10", reason: "Probando permisos" })).rejects.toThrow();
  });
});

describe("catálogos: eliminar lo que no se usa, unir lo mal escrito (DEC-061)", () => {
  it("un modelo mal escrito se une con el correcto y sus motos pasan al correcto", async () => {
    const brand = await admin.admin.createCatalogItem({ kind: "motorcycleBrand", name: `Marca Prueba ${Date.now()}` });
    const good = await admin.admin.saveMotorcycleModel({ motorcycleBrandId: brand.id, name: "Pulsar 150" });
    const bad = await admin.admin.saveMotorcycleModel({ motorcycleBrandId: brand.id, name: "Pulsr 150" });
    const customer = await db.customer.findFirstOrThrow();
    const moto = await db.motorcycle.create({ data: { customerId: customer.id, motorcycleModelId: bad.id, color: "Rojo" } });
    await expect(admin.admin.deleteMotorcycleModel({ id: bad.id })).rejects.toThrow("únalo");
    await admin.admin.mergeMotorcycleModel({ fromId: bad.id, intoId: good.id });
    expect((await db.motorcycle.findUniqueOrThrow({ where: { id: moto.id } })).motorcycleModelId).toBe(good.id);
    expect(await db.motorcycleModel.findUnique({ where: { id: bad.id } })).toBeNull();
  });

  it("lo que nunca se usó se elimina; «Efectivo» no se toca", async () => {
    const c = await admin.admin.createCatalogItem({ kind: "productCategory", name: `Categoría Prueba ${Date.now()}` });
    await admin.admin.deleteCatalogItem({ kind: "productCategory", id: c.id });
    await expect(admin.admin.setCatalogItemActive({ kind: "paymentMethod", id: cash, active: false })).rejects.toThrow("Efectivo");
    const active = await admin.admin.catalog({ kind: "productCategory", onlyActive: true });
    expect(active.every((r) => r.active)).toBe(true);
  });
});
