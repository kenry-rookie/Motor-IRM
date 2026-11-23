import { beforeAll, describe, expect, it } from "vitest";

import { D } from "~/server/domain/money";
import { callerAs, db, idOf, productByBarcode } from "./helpers";

/**
 * Revisión de Kenry del 23-nov (migración 9g, DEC-063 a DEC-065): moto recibida
 * dos veces, motos vendidas, abonos con vuelto, compras pagadas/debidas,
 * Resumen con ganancias y deudas, avisos y buscador general.
 */
const ACEITE = "7501234500035"; // price 220

let admin: Awaited<ReturnType<typeof callerAs>>;
let encargado: Awaited<ReturnType<typeof callerAs>>;
let cash: number;
let engrase: number;
let frenos: number;
let modelId: number;
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Managua" }).format(new Date());
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const contado = () => ({ paymentTerms: "CONTADO" as const, payment: { paymentMethodId: cash, currency: "NIO" as const } });

beforeAll(async () => {
  admin = await callerAs("admin");
  encargado = await callerAs("encargado");
  cash = await idOf("paymentMethod", "Efectivo");
  engrase = (await db.serviceType.findFirstOrThrow({ where: { name: "Engrase" } })).id;
  frenos = (await db.serviceType.findFirstOrThrow({ where: { name: "Cambio de pastillas de freno" } })).id;
  modelId = (await db.motorcycleModel.findFirstOrThrow({ where: { active: true } })).id;
  const st = await admin.cash.status();
  if (st.open && !st.open.isToday) throw new Error("Hay una caja de otro día abierta en la base de pruebas");
  if (!st.open) {
    if (st.todayClosed && st.todaySessionId) await admin.cash.reopen({ cashSessionId: st.todaySessionId, reason: "Pruebas de la revisión" });
    else await admin.cash.open({ openingNio: "5000" });
  }
});

describe("una moto en el taller no se recibe dos veces (DEC-063)", () => {
  it("la API y la base lo impiden; la búsqueda dice que está en el taller", async () => {
    const c = await encargado.customer.create({
      name: "Cliente Revisión Taller",
      phone: "8777-1001",
      motorcycle: { motorcycleModelId: modelId, color: "Azul", plate: "M 900-001" },
    });
    const moto = c.motorcycles[0]!;
    const order = await encargado.service.receive({ motorcycleId: moto.id, items: [{ serviceTypeId: engrase }] });
    await encargado.service.changeStatus({ serviceOrderId: order.id, status: "EN_PROCESO" });

    await expect(encargado.service.receive({ motorcycleId: moto.id, items: [{ serviceTypeId: frenos }] })).rejects.toThrow("ya está en el taller");
    // Aunque alguien se salte la API, el trigger lo impide.
    await expect(db.serviceOrder.create({ data: { motorcycleId: moto.id, items: { create: [{ serviceTypeId: frenos }] } } })).rejects.toThrow();

    const found = await encargado.search.customers({ q: "Cliente Revisión Taller", limit: 5 });
    const m = found.items.find((x) => x.id === c.id)!.motorcycles.find((x) => x.id === moto.id)!;
    expect(m.inWorkshop?.orderId).toBe(order.id);

    // Cuando sale del taller se puede volver a recibir.
    await encargado.service.cancel({ serviceOrderId: order.id, notes: "Prueba" });
    const again = await encargado.service.receive({ motorcycleId: moto.id, items: [{ serviceTypeId: engrase }] });
    await encargado.service.cancel({ serviceOrderId: again.id, notes: "Prueba" });
  });

  it("cuenta cuántas motos tiene cada responsable", async () => {
    const mario = await db.staff.findFirstOrThrow({ where: { name: "Mario Taller" } });
    const before = (await encargado.service.workload()).find((w) => w.staffId === mario.id)?.open ?? 0;
    const c = await encargado.customer.create({
      name: "Cliente Revisión Carga",
      phone: "8777-1002",
      motorcycle: { motorcycleModelId: modelId, color: "Gris", plate: "M 900-002" },
    });
    const order = await encargado.service.receive({ motorcycleId: c.motorcycles[0]!.id, items: [{ serviceTypeId: engrase }], mechanicStaffId: mario.id });
    expect((await encargado.service.workload()).find((w) => w.staffId === mario.id)?.open).toBe(before + 1);
    await encargado.service.cancel({ serviceOrderId: order.id, notes: "Prueba" });
  });
});

describe("motos que ya no son del cliente (DEC-064)", () => {
  it("con historial se suelta y libera la placa; sin historial se elimina", async () => {
    const seller = await encargado.customer.create({
      name: "Cliente Revisión Vende",
      phone: "8777-1003",
      motorcycle: { motorcycleModelId: modelId, color: "Negra", plate: "M 900-003" },
    });
    const moto = seller.motorcycles[0]!;
    const order = await encargado.service.receive({ motorcycleId: moto.id, items: [{ serviceTypeId: engrase }] });
    // En el taller no se quita.
    await expect(encargado.customer.removeMotorcycle({ id: moto.id })).rejects.toThrow("está en el taller");
    await encargado.service.cancel({ serviceOrderId: order.id, notes: "Prueba" });

    expect(await encargado.customer.removeMotorcycle({ id: moto.id })).toEqual({ deleted: false });
    const st = await encargado.customer.statement({ customerId: seller.id });
    expect(st.motorcycles.find((m) => m.id === moto.id)?.releasedAt).not.toBeNull();
    expect(st.orders.some((o) => o.id === order.id)).toBe(true); // el historial se queda con él
    const found = await encargado.search.customers({ q: "Cliente Revisión Vende", limit: 5 });
    expect(found.items.find((x) => x.id === seller.id)!.motorcycles).toHaveLength(0);
    await expect(encargado.service.receive({ motorcycleId: moto.id, items: [{ serviceTypeId: engrase }] })).rejects.toThrow("ya no es de ese cliente");

    // El dueño nuevo la registra con la misma placa.
    const buyer = await encargado.customer.create({ name: "Cliente Revisión Compra", phone: "8777-1004" });
    await encargado.customer.addMotorcycle({ customerId: buyer.id, motorcycleModelId: modelId, color: "Negra", plate: "M 900-003" });
    // Volver a ponerla como del vendedor choca con la placa del dueño nuevo.
    await expect(encargado.customer.restoreMotorcycle({ id: moto.id })).rejects.toThrow("placa");

    // Una moto que nunca entró al taller se elimina del todo.
    const extra = await encargado.customer.addMotorcycle({ customerId: buyer.id, motorcycleModelId: modelId, color: "Roja" });
    expect(await encargado.customer.removeMotorcycle({ id: extra.id })).toEqual({ deleted: true });
    expect(await db.motorcycle.findUnique({ where: { id: extra.id } })).toBeNull();
  });
});

describe("abonos: solo se registra lo que paga deudas (DEC-065)", () => {
  it("rechaza un abono mayor que lo aplicado; en dólares acepta el redondeo de un centavo", async () => {
    const customer = await encargado.customer.create({ name: "Cliente Revisión Abono", phone: "8777-1005" });
    const p = await productByBarcode(ACEITE);
    const sale = await admin.sales.create({
      terms: { paymentTerms: "CREDITO", customerId: customer.id, dueDate: inDays(30) },
      lines: [{ productId: p.id, quantity: 1 }],
    });
    // El caso de Kenry: 1000 dólares para una deuda de 220 córdobas.
    await expect(
      encargado.sales.registerPayment({
        customerId: customer.id,
        amount: "1000",
        currency: "USD",
        exchangeRate: "36.6",
        paymentMethodId: cash,
        allocations: [{ saleInvoiceId: sale.id, amount: "220" }],
      }),
    ).rejects.toThrow("vuelto");
    await expect(
      encargado.sales.registerPayment({ customerId: customer.id, amount: "500", paymentMethodId: cash, allocations: [{ saleInvoiceId: sale.id, amount: "220" }] }),
    ).rejects.toThrow("vuelto");

    // 220 / 36.6 = 6.0109… → US$ 6.02 (redondeado hacia arriba, como en caja).
    const pay = await encargado.sales.registerPayment({
      customerId: customer.id,
      amount: "6.02",
      currency: "USD",
      exchangeRate: "36.6",
      paymentMethodId: cash,
      allocations: [{ saleInvoiceId: sale.id, amount: "220" }],
    });
    const loose = await db.$queryRaw<unknown[]>`SELECT 1 FROM v_money_movement WHERE ref_table = 'customer_payment' AND ref_id = ${pay.id} AND kind = 'COBRO_SIN_REPARTIR'`;
    expect(loose).toHaveLength(0);
    const st = await admin.customer.statement({ customerId: customer.id });
    expect(st.totalBalance.toString()).toBe("0");
  });
});

describe("compras al crédito: pagadas, se deben, vencidas", () => {
  it("filtra por el saldo de la vista", async () => {
    const owed = await admin.purchasing.listInvoices({ paymentTerms: "CREDITO", state: "SE_DEBEN", limit: 100 });
    expect(owed.items.every((p) => p.balance.gt(0))).toBe(true);
    const paid = await admin.purchasing.listInvoices({ paymentTerms: "CREDITO", state: "PAGADAS", limit: 100 });
    expect(paid.items.every((p) => p.balance.lte(0))).toBe(true);
    const late = await admin.purchasing.listInvoices({ paymentTerms: "CREDITO", state: "VENCIDAS", limit: 100 });
    expect(late.items.every((p) => (p.daysOverdue ?? 0) > 0)).toBe(true);
  });
});

describe("Resumen: ventas sin devoluciones, ganancias y deudas", () => {
  const period = () => admin.reports.period({ from: today(), to: today(), granularity: "day" });

  it("una devolución baja las ventas y la ganancia de productos", async () => {
    const p = await productByBarcode(ACEITE);
    const r1 = await period();
    const sale = await encargado.sales.create({ terms: contado(), lines: [{ productId: p.id, quantity: 2 }] });
    const r2 = await period();
    expect(D(r2.current.sales).minus(r1.current.sales).toString()).toBe("440");
    const cost = D(r2.current.profit.shelf.counterCost).minus(r1.current.profit.shelf.counterCost);
    expect(D(r2.current.profit.shelf.total).minus(r1.current.profit.shelf.total).toString()).toBe(D(440).minus(cost).toString());

    const inv = await admin.sales.getInvoice({ id: sale.id });
    await encargado.sales.createReturn({
      saleInvoiceId: sale.id,
      returnReasonId: await idOf("returnReason", "Producto defectuoso"),
      lines: [{ saleInvoiceLineId: inv.lines[0]!.id, quantity: 1 }],
    });
    const r3 = await period();
    expect(D(r2.current.sales).minus(r3.current.sales).toString()).toBe("220");
    expect(D(r3.current.returns).minus(r2.current.returns).toString()).toBe("220");
  });

  it("ganancia del taller: el dueño gana todo, el mecánico con comisión su parte, el «100 %» nada", async () => {
    const c = await encargado.customer.create({
      name: "Cliente Revisión Ganancia",
      phone: "8777-1006",
      motorcycle: { motorcycleModelId: modelId, color: "Blanca", plate: "M 900-006" },
    });
    const moto = c.motorcycles[0]!;
    const job = async (staffName: string) => {
      const staff = await db.staff.findFirstOrThrow({ where: { name: staffName } });
      const before = await period();
      const order = await encargado.service.receive({ motorcycleId: moto.id, items: [{ serviceTypeId: frenos }], mechanicStaffId: staff.id });
      await encargado.service.close({ serviceOrderId: order.id, terms: contado(), labor: [{ serviceTypeId: frenos, price: "300" }] });
      const after = await period();
      return D(after.current.profit.workshop.total).minus(before.current.profit.workshop.total).toString();
    };
    expect(await job("Segundo Dueño")).toBe("300");
    expect(await job("Mario Taller")).toBe("120"); // 300 − 60 %
    expect(await job("Pablo Llave")).toBe("0");
  });

  it("deudas ahora: lo que nos deben y lo que debemos salen de las vistas", async () => {
    const r = await period();
    const [c] = await db.$queryRaw<{ s: string }[]>`SELECT coalesce(sum(balance), 0)::text AS s FROM v_customer_balance WHERE balance > 0`;
    expect(D(r.debts.customers.total).toString()).toBe(D(c!.s).toString());
    expect(Number(r.debts.suppliers.total)).toBeGreaterThanOrEqual(0);
  });
});

describe("avisos y buscador general", () => {
  it("avisa de un viaje de compras abierto y de los créditos vencidos", async () => {
    const trip = await admin.trips.create({ tripDate: today(), destination: "Managua", cashTaken: "0" });
    const notices = await admin.reports.attention();
    expect(notices.some((n) => n.key === "viajes-abiertos")).toBe(true);
    expect(notices.every((n) => n.href.startsWith("/"))).toBe(true);
    await admin.trips.close({ id: trip.id, cashReturned: "0" });
  });

  it("encuentra un documento por su número, un cliente y una placa", async () => {
    const c = await encargado.customer.create({
      name: "Cliente Revisión Buscador",
      phone: "8777-1007",
      motorcycle: { motorcycleModelId: modelId, color: "Verde", plate: "M 900-007" },
    });
    const order = await encargado.service.receive({ motorcycleId: c.motorcycles[0]!.id, items: [{ serviceTypeId: engrase }] });
    const byNo = await encargado.search.global({ q: `OS-${String(order.id).padStart(6, "0")}` });
    expect(byNo.hits.some((h) => h.href === `/taller/${order.id}`)).toBe(true);
    const byName = await encargado.search.global({ q: "Revisión Buscador", only: "clientes" });
    expect(byName.hits.some((h) => h.href === `/clientes/${c.id}`)).toBe(true);
    const byPlate = await encargado.search.global({ q: "900-007" });
    expect(byPlate.hits.some((h) => h.group === "motos" && h.badge === "En el taller")).toBe(true);
    await encargado.service.cancel({ serviceOrderId: order.id, notes: "Prueba" });
  });
});
