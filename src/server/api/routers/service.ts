import { z } from "zod";

import { fail } from "~/server/api/errors";
import { createTRPCRouter, permissionProcedure } from "~/server/api/trpc";
import { type Prisma } from "~/server/db";
import { resolveAuthorizer } from "~/server/domain/authorize";
import { buildProductLines, createInvoice, type LineDraft, zProductLine, zTerms } from "~/server/domain/billing";
import {
  FAULT_DECISIONS,
  FINAL_SERVICE_STATUSES,
  PART_PAID_BY,
  SERVICE_ORDER_STATUSES,
  type ServiceOrderStatus,
  WARRANTY_OUTCOMES,
  zId,
  zMoney,
  zOptText,
  pageFields,
  zPositiveMoney,
  zQty,
  zText,
  zOptChassis,
  zPhone,
} from "~/server/domain/constants";
import { recordMovement } from "~/server/domain/inventory";
import { D } from "~/server/domain/money";

type Tx = Prisma.TransactionClient;

/**
 * API-015 service orders · API-019 warranty claims.
 *
 * Life of an order (DEC-037): it is received WITHOUT a bill; it moves through
 * statuses; at the end `close` bills it (labor, accepted faults, parts, external
 * charges) and marks it ENTREGADA, or `cancel` ends it (with an optional fee).
 */
const view = permissionProcedure("taller.ver");
const manage = permissionProcedure("taller.gestionar");

async function currentStatus(tx: Tx, serviceOrderId: number): Promise<ServiceOrderStatus> {
  const last = await tx.serviceOrderStatusChange.findFirst({
    where: { serviceOrderId },
    orderBy: [{ changedAt: "desc" }, { id: "desc" }],
  });
  if (!last) throw fail("La orden no tiene estado.", "NOT_FOUND");
  return last.status as ServiceOrderStatus;
}

async function assertOpen(tx: Tx, serviceOrderId: number) {
  const status = await currentStatus(tx, serviceOrderId);
  if (FINAL_SERVICE_STATUSES.includes(status)) throw fail(`La orden ya está ${status.toLowerCase()}; no se puede cambiar.`);
  return status;
}

/** Jobs of an order: from the catalog, active, no repeats (DEC-048). */
const zItems = z
  .array(z.object({ serviceTypeId: zId, notes: zOptText(200) }))
  .min(1, "Elija al menos un trabajo de la lista")
  .refine((items) => new Set(items.map((i) => i.serviceTypeId)).size === items.length, "Un trabajo aparece dos veces");

async function assertActiveTypes(tx: Tx, ids: number[]) {
  const types = await tx.serviceType.findMany({ where: { id: { in: ids } } });
  if (types.length !== ids.length || types.some((t) => !t.active)) {
    throw fail("Uno de los trabajos no está en el catálogo o está desactivado.");
  }
  return types;
}

/** The job used when a new order is opened without choosing one (warranty with another fault). */
async function diagnosisType(tx: Tx) {
  const t =
    (await tx.serviceType.findFirst({ where: { name: { equals: "Diagnóstico", mode: "insensitive" }, active: true } })) ??
    (await tx.serviceType.findFirst({ where: { active: true }, orderBy: { id: "asc" } }));
  if (!t) throw fail("El catálogo de trabajos está vacío: registre al menos uno en Administración.");
  return t;
}

/**
 * DEC-041 — who can be responsible and with what rate. The database checks it
 * again (tg_service_order_check_responsible); this gives a clear message first.
 */
async function responsibleRate(tx: Tx, staffId: number) {
  const staff = await tx.staff.findUniqueOrThrow({ where: { id: staffId } });
  if (!staff.active || !staff.canRepair) throw fail(`${staff.name} no está activo o no repara motos.`);
  const appliedCommissionRate = staff.kind === "DUENO" ? null : staff.commissionRate;
  return { staff, appliedCommissionRate };
}

const itemsInclude = {
  orderBy: { id: "asc" as const },
  include: { serviceType: { include: { category: true } } },
} satisfies Prisma.ServiceOrder$itemsArgs;

const orderListInclude = {
  motorcycle: { include: { customer: true, model: { include: { brand: true } } } },
  mechanic: true,
  items: itemsInclude,
  statusChanges: { orderBy: [{ changedAt: "desc" as const }, { id: "desc" as const }], take: 1 },
} satisfies Prisma.ServiceOrderInclude;

const orderInclude = {
  motorcycle: { include: { customer: true, model: { include: { brand: true } } } },
  mechanic: true,
  items: itemsInclude,
  statusChanges: { orderBy: { changedAt: "desc" }, include: { registeredBy: { select: { username: true } } } },
  additionalFaults: { orderBy: { faultNo: "asc" } },
  saleInvoice: { select: { id: true, invoiceNumber: true, paymentTerms: true } },
} satisfies Prisma.ServiceOrderInclude;

export const serviceRouter = createTRPCRouter({
  /** Board: orders with their current status; by default only the open ones. */
  listOrders: view
    .input(
      z
        .object({
          status: z.enum(SERVICE_ORDER_STATUSES).optional(),
          includeClosed: z.boolean().default(false),
          mechanicStaffId: zId.optional(),
          ...pageFields,
        })
        .default({}),
    )
    .query(async ({ ctx, input }) => {
      const { cursor, limit } = input;
      const orders = await ctx.db.serviceOrder.findMany({
        where: { mechanicStaffId: input.mechanicStaffId },
        orderBy: { id: "desc" },
        include: orderListInclude,
        // The status lives in the history table, so filtering by it happens here;
        // a shop has tens of open orders, not thousands.
        take: input.status || !input.includeClosed ? 500 : limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      const rows = orders
        .map((o) => ({ ...o, status: (o.statusChanges[0]?.status ?? "RECIBIDA") as ServiceOrderStatus }))
        .filter((o) => (input.status ? o.status === input.status : input.includeClosed || !FINAL_SERVICE_STATUSES.includes(o.status)));
      return { items: rows.slice(0, limit), nextCursor: rows.length > limit ? rows[limit - 1]!.id : null };
    }),

  get: view.input(z.object({ id: zId })).query(async ({ ctx, input }) => {
    const order = await ctx.db.serviceOrder.findUniqueOrThrow({ where: { id: input.id }, include: orderInclude });
    return { ...order, status: (order.statusChanges[0]?.status ?? "RECIBIDA") as ServiceOrderStatus };
  }),

  /**
   * Reception: the motorcycle arrives. No bill, no price yet.
   * For speed, a NEW customer and/or motorcycle can be registered in the same
   * step (one transaction). The model is CHOSEN from the catalog (its id): the
   * old find-or-create by typed text allowed "Bajaj", "bajaj " and "Bajah" as
   * three brands, so it was removed (DEC-044).
   */
  receive: manage
    .input(
      z
        .object({
          motorcycleId: zId.optional(),
          newMotorcycle: z
            .object({
              customerId: zId.optional(),
              newCustomer: z
                .object({ name: zText(100), phone: zPhone, nationalId: zOptText(20) })
                .optional(),
              motorcycleModelId: z.number().int().positive("Elija la marca y el modelo de la moto"),
              color: zText(30),
              plate: zOptText(15),
              chassisNumber: zOptChassis,
            })
            .refine((m) => !!m.customerId !== !!m.newCustomer, {
              message: "Elija un cliente existente o registre uno nuevo",
              path: ["customerId"],
            })
            .optional(),
          /** The jobs, chosen from the catalog (at least one). */
          items: zItems,
          /** The customer's words ("dice que suena al frenar"): optional, never replaces a job. */
          requestedWork: zOptText(500),
          odometerKm: z.number().int().min(0).max(2_000_000).optional(),
          mechanicStaffId: zId.optional(),
          notes: zOptText(200),
        })
        .refine((v) => !!v.motorcycleId !== !!v.newMotorcycle, {
          message: "Elija una moto registrada o registre la moto nueva",
          path: ["motorcycleId"],
        }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        let motorcycleId = input.motorcycleId;
        if (input.newMotorcycle) {
          const m = input.newMotorcycle;
          const customerId =
            m.customerId ??
            (
              await tx.customer.create({
                data: { name: m.newCustomer!.name, phone: m.newCustomer!.phone, nationalId: m.newCustomer!.nationalId ?? null },
              })
            ).id;
          motorcycleId = (
            await tx.motorcycle.create({
              data: {
                customerId,
                motorcycleModelId: m.motorcycleModelId,
                color: m.color,
                plate: m.plate ?? null,
                chassisNumber: m.chassisNumber ?? null,
              },
            })
          ).id;
        }
        const appliedCommissionRate = input.mechanicStaffId
          ? (await responsibleRate(tx, input.mechanicStaffId)).appliedCommissionRate
          : null;
        await assertActiveTypes(tx, input.items.map((i) => i.serviceTypeId));
        // Order + its jobs in the same transaction: the deferred trigger
        // tg_service_order_has_items checks at COMMIT that there is at least one.
        const order = await tx.serviceOrder.create({
          data: {
            motorcycleId: motorcycleId!,
            requestedWork: input.requestedWork ?? null,
            odometerKm: input.odometerKm ?? null,
            mechanicStaffId: input.mechanicStaffId ?? null,
            appliedCommissionRate,
            items: { create: input.items.map((i) => ({ serviceTypeId: i.serviceTypeId, notes: i.notes ?? null })) },
          },
        });
        await tx.serviceOrderStatusChange.create({
          data: { serviceOrderId: order.id, status: "RECIBIDA", notes: input.notes ?? null, registeredByUserId: ctx.user.id },
        });
        return order;
      }),
    ),

  /**
   * One responsible per motorcycle (business rule): a mechanic or an owner
   * (DEC-041). The commission rate is frozen here; an owner, or a mechanic
   * without a rate, leaves it empty and earns no commission.
   */
  assignMechanic: manage
    .input(z.object({ serviceOrderId: zId, mechanicStaffId: zId }))
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        await assertOpen(tx, input.serviceOrderId);
        const order = await tx.serviceOrder.findUniqueOrThrow({ where: { id: input.serviceOrderId } });
        if (order.staffPayoutId) throw fail("La comisión de esta orden ya se pagó.");
        const { staff, appliedCommissionRate } = await responsibleRate(tx, input.mechanicStaffId);
        return tx.serviceOrder.update({
          where: { id: input.serviceOrderId },
          data: { mechanicStaffId: staff.id, appliedCommissionRate },
        });
      }),
    ),

  /** Change the jobs of an open order (the customer asked for something else). */
  setItems: manage
    .input(z.object({ serviceOrderId: zId, items: zItems }))
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        await assertOpen(tx, input.serviceOrderId);
        await assertActiveTypes(tx, input.items.map((i) => i.serviceTypeId));
        await tx.serviceOrderItem.deleteMany({ where: { serviceOrderId: input.serviceOrderId } });
        await tx.serviceOrderItem.createMany({
          data: input.items.map((i) => ({ serviceOrderId: input.serviceOrderId, serviceTypeId: i.serviceTypeId, notes: i.notes ?? null })),
        });
        return { ok: true };
      }),
    ),

  setOdometer: manage
    .input(z.object({ serviceOrderId: zId, odometerKm: z.number().int().min(0).max(2_000_000).nullable() }))
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        await assertOpen(tx, input.serviceOrderId);
        return tx.serviceOrder.update({ where: { id: input.serviceOrderId }, data: { odometerKm: input.odometerKm } });
      }),
    ),

  /** History of a motorcycle: every order, its jobs, mileage and what was charged. */
  motorcycleHistory: view.input(z.object({ motorcycleId: zId })).query(async ({ ctx, input }) => {
    const orders = await ctx.db.serviceOrder.findMany({
      where: { motorcycleId: input.motorcycleId },
      orderBy: { id: "desc" },
      include: {
        items: itemsInclude,
        mechanic: true,
        statusChanges: { orderBy: [{ changedAt: "desc" }, { id: "desc" }], take: 1 },
        saleInvoice: {
          select: {
            id: true,
            lines: {
              where: { lineType: "PRODUCTO" },
              select: { quantity: true, product: { select: { name: true } } },
            },
          },
        },
      },
      take: 50,
    });
    return orders.map((o) => ({
      id: o.id,
      status: (o.statusChanges[0]?.status ?? "RECIBIDA") as ServiceOrderStatus,
      date: o.statusChanges[0]?.changedAt ?? null,
      odometerKm: o.odometerKm,
      responsible: o.mechanic?.name ?? null,
      jobs: o.items.map((i) => i.serviceType.name),
      parts: o.saleInvoice?.lines.map((l) => `${l.quantity} × ${l.product?.name ?? ""}`) ?? [],
      invoiceId: o.saleInvoice?.id ?? null,
    }));
  }),

  setDiagnosis: manage
    .input(z.object({ serviceOrderId: zId, diagnosis: zText(500) }))
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        await assertOpen(tx, input.serviceOrderId);
        return tx.serviceOrder.update({ where: { id: input.serviceOrderId }, data: { diagnosis: input.diagnosis } });
      }),
    ),

  /** Status history (ENTREGADA and CANCELADA only through close/cancel). */
  changeStatus: manage
    .input(
      z.object({
        serviceOrderId: zId,
        status: z.enum(SERVICE_ORDER_STATUSES).exclude(["ENTREGADA", "CANCELADA", "RECIBIDA"]),
        notes: zOptText(200),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        const current = await assertOpen(tx, input.serviceOrderId);
        if (current === input.status) throw fail("La orden ya está en ese estado.");
        return tx.serviceOrderStatusChange.create({
          data: {
            serviceOrderId: input.serviceOrderId,
            status: input.status,
            notes: input.notes ?? null,
            registeredByUserId: ctx.user.id,
          },
        });
      }),
    ),

  /** A fault found during the repair; the customer decides later. */
  addFault: manage
    .input(z.object({ serviceOrderId: zId, description: zText(500), proposedPrice: zMoney.optional() }))
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        await assertOpen(tx, input.serviceOrderId);
        const last = await tx.additionalFault.findFirst({
          where: { serviceOrderId: input.serviceOrderId },
          orderBy: { faultNo: "desc" },
        });
        return tx.additionalFault.create({
          data: {
            serviceOrderId: input.serviceOrderId,
            faultNo: (last?.faultNo ?? 0) + 1,
            description: input.description,
            proposedPrice: input.proposedPrice ?? null,
          },
        });
      }),
    ),

  decideFault: manage
    .input(z.object({ additionalFaultId: zId, decision: z.enum(FAULT_DECISIONS), proposedPrice: zMoney.optional() }))
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        const fault = await tx.additionalFault.findUniqueOrThrow({ where: { id: input.additionalFaultId } });
        await assertOpen(tx, fault.serviceOrderId);
        return tx.additionalFault.update({
          where: { id: fault.id },
          data: { decision: input.decision, proposedPrice: input.proposedPrice ?? fault.proposedPrice },
        });
      }),
    ),

  /**
   * Bills and delivers the order: labor lines, accepted faults (at their price),
   * parts used (USO_SERVICIO exits) and external charges, in ONE transaction.
   */
  close: permissionProcedure("taller.facturar")
    .input(
      z.object({
        serviceOrderId: zId,
        terms: zTerms,
        /** Labor is always a job of the catalog (CHECK ck_sale_invoice_line_labor_service_type). */
        labor: z
          .array(z.object({ serviceTypeId: zId, description: zOptText(200), price: zMoney }))
          .default([]),
        parts: z.array(zProductLine).default([]),
        externalCharges: z.array(z.object({ description: zText(200), price: zPositiveMoney })).default([]),
        notes: zOptText(200),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        await assertOpen(tx, input.serviceOrderId);
        const order = await tx.serviceOrder.findUniqueOrThrow({
          where: { id: input.serviceOrderId },
          include: { motorcycle: true, additionalFaults: true },
        });
        if (!order.mechanicStaffId) throw fail("Asigne un responsable (mecánico o dueño) antes de cerrar la orden.");
        const customerId = input.terms.customerId ?? order.motorcycle.customerId;
        if (customerId !== order.motorcycle.customerId) throw fail("La factura es para el dueño de la moto.");
        const pending = order.additionalFaults.filter((f) => f.decision === "PENDIENTE");
        if (pending.length) throw fail("Hay fallas adicionales sin decisión del cliente.");

        // Charging outside the job's price range needs an owner's key (prompt §7.3).
        const types = new Map(
          (await assertActiveTypes(tx, [...new Set(input.labor.map((l) => l.serviceTypeId))])).map((t) => [t.id, t]),
        );
        for (const l of input.labor) {
          const t = types.get(l.serviceTypeId)!;
          const price = D(l.price);
          if ((t.minPrice && price.lt(t.minPrice)) || (t.maxPrice && price.gt(t.maxPrice))) {
            await resolveAuthorizer(tx, ctx.user, "taller.precio_especial", input.terms.authorizer);
          }
        }
        const drafts: LineDraft[] = [
          ...input.labor.map((l) => ({
            lineType: "MANO_OBRA" as const,
            serviceTypeId: l.serviceTypeId,
            description: l.description ?? types.get(l.serviceTypeId)!.name,
            quantity: 1,
            unitPrice: D(l.price),
            discountAmount: D(0),
          })),
          ...order.additionalFaults
            .filter((f) => f.decision === "ACEPTADA")
            .map((f) => {
              if (!f.proposedPrice) throw fail(`La falla ${f.faultNo} aceptada no tiene precio.`);
              return {
                lineType: "MANO_OBRA" as const,
                description: `Falla adicional ${f.faultNo}: ${f.description}`.slice(0, 200),
                quantity: 1,
                unitPrice: D(f.proposedPrice),
                discountAmount: D(0),
                additionalFaultId: f.id,
              };
            }),
          ...(await buildProductLines(tx, ctx.user, input.parts, input.terms.authorizer)),
          ...input.externalCharges.map((c) => ({
            lineType: "CARGO_EXTERNO" as const,
            description: c.description,
            quantity: 1,
            unitPrice: D(c.price),
            discountAmount: D(0),
          })),
        ];
        const invoice = await createInvoice(tx, ctx.user, { ...input.terms, customerId }, drafts, {
          serviceOrderId: order.id,
          exitType: "USO_SERVICIO",
        });
        await tx.serviceOrderStatusChange.create({
          data: { serviceOrderId: order.id, status: "ENTREGADA", notes: input.notes ?? null, registeredByUserId: ctx.user.id },
        });
        return invoice;
      }),
    ),

  /** Cancels the order; with a fee, bills it as a labor line. */
  cancel: permissionProcedure("taller.facturar")
    .input(
      z.object({
        serviceOrderId: zId,
        notes: zText(200),
        cancellationFee: zPositiveMoney.optional(),
        terms: zTerms.optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        await assertOpen(tx, input.serviceOrderId);
        const order = await tx.serviceOrder.update({
          where: { id: input.serviceOrderId },
          data: { cancellationFee: input.cancellationFee ?? null },
          include: { motorcycle: true },
        });
        let invoiceId: number | null = null;
        if (input.cancellationFee) {
          if (!input.terms) throw fail("Indique cómo se cobra el cargo por cancelación.");
          const feeType = await tx.serviceType.findFirst({
            where: { name: { equals: "Cargo por cancelación", mode: "insensitive" } },
          });
          if (!feeType) throw fail("Falta el trabajo «Cargo por cancelación» en el catálogo.");
          const inv = await createInvoice(
            tx,
            ctx.user,
            { ...input.terms, customerId: order.motorcycle.customerId },
            [
              {
                lineType: "MANO_OBRA",
                serviceTypeId: feeType.id,
                description: "Cargo por cancelación",
                quantity: 1,
                unitPrice: D(input.cancellationFee),
                discountAmount: D(0),
              },
            ],
            { serviceOrderId: order.id, exitType: "USO_SERVICIO" },
          );
          invoiceId = inv.id;
        }
        await tx.serviceOrderStatusChange.create({
          data: { serviceOrderId: order.id, status: "CANCELADA", notes: input.notes, registeredByUserId: ctx.user.id },
        });
        return { ok: true, invoiceId };
      }),
    ),

  // ---------------------------------------------------------------------------
  //  API-019 — Warranty claims
  // ---------------------------------------------------------------------------
  warrantyClaims: view
    .input(z.object({ originalServiceOrderId: zId.optional() }).default({}))
    .query(({ ctx, input }) =>
      ctx.db.warrantyClaim.findMany({
        where: { originalServiceOrderId: input.originalServiceOrderId },
        orderBy: { id: "desc" },
        include: { originalServiceOrder: { include: { motorcycle: { include: { customer: true } } } }, inventoryMovements: true },
        take: 100,
      }),
    ),

  createWarrantyClaim: permissionProcedure("garantias.gestionar")
    .input(
      z
        .object({
          originalServiceOrderId: zId,
          description: zText(500),
          outcome: z.enum(WARRANTY_OUTCOMES),
          partPaidBy: z.enum(PART_PAID_BY).optional(),
          refundAmount: zPositiveMoney.optional(),
          /** FALLA_DISTINTA: open a new order for the new fault. */
          newOrderRequestedWork: zOptText(500),
          /** Part replaced at the store's expense (GARANTIA exit). */
          replacedPart: z.object({ productId: zId, quantity: zQty }).optional(),
          /** Part the customer paid: the invoice that sold it. */
          partSaleInvoiceId: zId.optional(),
        })
        .superRefine((v, c) => {
          if (v.outcome === "REEMBOLSO" && !v.refundAmount)
            c.addIssue({ code: "custom", path: ["refundAmount"], message: "Indique el monto del reembolso" });
          if (v.replacedPart && v.partPaidBy !== "TIENDA")
            c.addIssue({ code: "custom", path: ["partPaidBy"], message: "El repuesto de garantía lo paga la tienda" });
          if (v.partSaleInvoiceId && v.partPaidBy !== "CLIENTE")
            c.addIssue({ code: "custom", path: ["partPaidBy"], message: "La factura del repuesto aplica cuando paga el cliente" });
        }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        const original = await tx.serviceOrder.findUniqueOrThrow({ where: { id: input.originalServiceOrderId } });
        let newServiceOrderId: number | null = null;
        if (input.outcome === "FALLA_DISTINTA" && input.newOrderRequestedWork) {
          const n = await tx.serviceOrder.create({
            data: {
              motorcycleId: original.motorcycleId,
              requestedWork: input.newOrderRequestedWork,
              mechanicStaffId: original.mechanicStaffId,
              appliedCommissionRate: original.appliedCommissionRate,
              items: { create: [{ serviceTypeId: (await diagnosisType(tx)).id }] },
            },
          });
          await tx.serviceOrderStatusChange.create({
            data: { serviceOrderId: n.id, status: "RECIBIDA", notes: `Garantía de la orden ${original.id}`, registeredByUserId: ctx.user.id },
          });
          newServiceOrderId = n.id;
        }
        const claim = await tx.warrantyClaim.create({
          data: {
            originalServiceOrderId: original.id,
            description: input.description,
            outcome: input.outcome,
            partPaidBy: input.partPaidBy ?? null,
            refundAmount: input.outcome === "REEMBOLSO" ? input.refundAmount : null,
            attendedByUserId: ctx.user.id,
            newServiceOrderId,
            partSaleInvoiceId: input.partSaleInvoiceId ?? null,
          },
        });
        if (input.replacedPart) {
          await recordMovement(tx, {
            productId: input.replacedPart.productId,
            movementType: "GARANTIA",
            quantity: input.replacedPart.quantity,
            userId: ctx.user.id,
            warrantyClaimId: claim.id,
          });
        }
        return claim;
      }),
    ),
});
