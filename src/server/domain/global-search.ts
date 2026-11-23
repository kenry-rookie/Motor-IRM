import { DOC_PREFIX, type DocKind, docNo, parseDocNo } from "~/lib/business";
import { type SessionUser } from "~/server/auth/session";
import { type DbClient } from "~/server/db";
import { LABELS, type ServiceOrderStatus } from "~/server/domain/constants";
import { customerInclude, inRankOrder, motorcyclesInWorkshop, productInclude, searchCustomerIds, searchProductIds } from "~/server/domain/search";
import { intList, Sql } from "~/server/domain/sql";

/**
 * Buscador general (Kenry, 23-nov): one box at the top of every screen. It
 * understands a document number (R-000045, F-12, OS 7, «45»), a customer's name,
 * phone or cédula, a plate, a product or a supplier, and returns each hit with
 * the screen it opens. Only what the user's role may see comes back.
 */
export const SEARCH_GROUPS = ["documentos", "clientes", "motos", "productos", "proveedores"] as const;
export type SearchGroup = (typeof SEARCH_GROUPS)[number];

export type Hit = {
  group: SearchGroup;
  key: string;
  /** Big text: «F-000045», «Juan Pérez», «Pulsar 180 · M 123-456». */
  title: string;
  /** Small text under it: what it is, whose, how much… */
  subtitle: string;
  /** A short tag: «Factura», «Recibo», «En el taller»… */
  badge?: string;
  href: string;
};

const money = new Intl.NumberFormat("es-NI", { style: "currency", currency: "NIO", minimumFractionDigits: 2 });
const nio = (v: { toString(): string } | null | undefined) => money.format(Number(v?.toString() ?? 0));
const day = new Intl.DateTimeFormat("es-NI", { timeZone: "America/Managua", dateStyle: "medium" });
const when = (d: Date) => day.format(d);

const COMPROBANTE = (kind: DocKind, id: number) => `/comprobantes?q=${encodeURIComponent(docNo(kind, id))}`;

/** Document kinds, what they are called and who can open them. */
const DOCS: { kind: DocKind; label: string; perms: string[] }[] = [
  { kind: "factura", label: "Factura de venta", perms: ["ventas.ver"] },
  { kind: "orden", label: "Orden del taller", perms: ["taller.ver"] },
  { kind: "recibo", label: "Recibo de abono", perms: ["clientes.ver", "caja.arqueo", "reportes.ver"] },
  { kind: "compra", label: "Factura de compra", perms: ["compras.ver"] },
  { kind: "viaje", label: "Viaje de compras", perms: ["compras.ver"] },
  { kind: "retiro", label: "Retiro de caja", perms: ["caja.retiros", "caja.arqueo", "reportes.ver"] },
  { kind: "pagoProveedor", label: "Pago a proveedor", perms: ["compras.ver"] },
  { kind: "devolucion", label: "Devolución de cliente", perms: ["ventas.ver"] },
  { kind: "adelanto", label: "Adelanto a mecánico", perms: ["personal.ver"] },
  { kind: "pagoMecanico", label: "Pago a mecánico", perms: ["personal.ver"] },
];

async function documentHits(db: DbClient, user: SessionUser, text: string): Promise<Hit[]> {
  const parsed = parseDocNo(text);
  const hits: Hit[] = [];
  const allowed = DOCS.filter((d) => d.perms.some((p) => user.permissions.has(p)));
  if (parsed) {
    const kinds = parsed.kind ? allowed.filter((d) => d.kind === parsed.kind) : allowed;
    const id = parsed.id;
    for (const d of kinds) {
      const tag = { badge: d.label, group: "documentos" as const, key: `${d.kind}-${id}` };
      switch (d.kind) {
        case "factura": {
          const inv = await db.saleInvoice.findUnique({ where: { id }, include: { customer: true, void: true } });
          if (inv)
            hits.push({
              ...tag,
              title: docNo("factura", id),
              subtitle: `${inv.customer?.name ?? "Cliente de contado"} · ${when(inv.createdAt)} · ${inv.paymentTerms === "CREDITO" ? "crédito" : "contado"}${inv.void ? " · ANULADA" : ""}`,
              href: `/ventas/${id}`,
            });
          break;
        }
        case "orden": {
          const o = await db.serviceOrder.findUnique({
            where: { id },
            include: { motorcycle: { include: { customer: true, model: { include: { brand: true } } } }, statusChanges: { orderBy: [{ changedAt: "desc" }, { id: "desc" }], take: 1 } },
          });
          if (o) {
            const st = (o.statusChanges[0]?.status ?? "RECIBIDA") as ServiceOrderStatus;
            hits.push({
              ...tag,
              title: docNo("orden", id),
              subtitle: `${o.motorcycle.model.brand.name} ${o.motorcycle.model.name}${o.motorcycle.plate ? ` ${o.motorcycle.plate}` : ""} · ${o.motorcycle.customer.name} · ${LABELS.serviceStatus[st]}`,
              href: `/taller/${id}`,
            });
          }
          break;
        }
        case "recibo": {
          const p = await db.customerPayment.findUnique({
            where: { id },
            include: { allocations: { take: 1, include: { saleInvoice: { include: { customer: true } }, customerOpeningBalance: { include: { customer: true } } } } },
          });
          if (p) {
            const c = p.allocations[0]?.saleInvoice?.customer ?? p.allocations[0]?.customerOpeningBalance?.customer;
            hits.push({
              ...tag,
              title: docNo("recibo", id),
              subtitle: `${c?.name ?? "Cliente"} · ${when(p.paidAt)} · ${p.currency === "USD" ? `US$ ${p.amount.toFixed(2)}` : nio(p.amount)}`,
              href: COMPROBANTE("recibo", id),
            });
          }
          break;
        }
        case "compra": {
          const p = await db.purchaseInvoice.findUnique({ where: { id }, include: { supplier: true } });
          if (p) hits.push({ ...tag, title: docNo("compra", id), subtitle: `${p.supplier.name} · factura ${p.invoiceNumber}`, href: `/compras/${id}` });
          break;
        }
        case "viaje": {
          const t = await db.purchaseTrip.findUnique({ where: { id } });
          if (t) hits.push({ ...tag, title: docNo("viaje", id), subtitle: `A ${t.destination} · ${t.status === "ABIERTO" ? "en curso" : "cerrado"}`, href: `/compras/viajes/${id}` });
          break;
        }
        case "retiro": {
          const w = await db.cashWithdrawal.findUnique({ where: { id }, include: { reason: true } });
          if (w) hits.push({ ...tag, title: docNo("retiro", id), subtitle: `${w.reason.name} · ${nio(w.amount)}${w.voidedAt ? " · anulado" : ""}`, href: COMPROBANTE("retiro", id) });
          break;
        }
        case "pagoProveedor": {
          const sp = await db.supplierPayment.findUnique({ where: { id }, include: { supplier: true } });
          if (sp) hits.push({ ...tag, title: docNo("pagoProveedor", id), subtitle: `${sp.supplier.name} · ${nio(sp.amount)}`, href: COMPROBANTE("pagoProveedor", id) });
          break;
        }
        case "devolucion": {
          const r = await db.customerReturn.findUnique({ where: { id } });
          if (r) hits.push({ ...tag, title: docNo("devolucion", id), subtitle: `De la factura ${docNo("factura", r.saleInvoiceId)}`, href: `/ventas/${r.saleInvoiceId}` });
          break;
        }
        case "adelanto": {
          const a = await db.staffAdvance.findUnique({ where: { id }, include: { staff: true } });
          if (a) hits.push({ ...tag, title: docNo("adelanto", id), subtitle: `${a.staff.name} · ${nio(a.amount)}`, href: COMPROBANTE("adelanto", id) });
          break;
        }
        case "pagoMecanico": {
          const p = await db.staffPayout.findUnique({ where: { id }, include: { staff: true } });
          if (p) hits.push({ ...tag, title: docNo("pagoMecanico", id), subtitle: p.staff.name, href: COMPROBANTE("pagoMecanico", id) });
          break;
        }
        default:
          break;
      }
    }
  }
  // The number printed on a paper invoice (the owner's pad) or the supplier's invoice number.
  const t = text.trim();
  if (t.length >= 2) {
    if (user.permissions.has("ventas.ver")) {
      const byNumber = await db.saleInvoice.findMany({ where: { invoiceNumber: { equals: t, mode: "insensitive" } }, include: { customer: true }, take: 3 });
      for (const inv of byNumber)
        if (!hits.some((h) => h.key === `factura-${inv.id}`))
          hits.push({ group: "documentos", key: `factura-${inv.id}`, badge: "Factura de venta", title: `${docNo("factura", inv.id)} (N.º ${inv.invoiceNumber})`, subtitle: inv.customer?.name ?? "Cliente de contado", href: `/ventas/${inv.id}` });
    }
    if (user.permissions.has("compras.ver")) {
      const byNumber = await db.purchaseInvoice.findMany({ where: { invoiceNumber: { equals: t, mode: "insensitive" } }, include: { supplier: true }, take: 3 });
      for (const p of byNumber)
        if (!hits.some((h) => h.key === `compra-${p.id}`))
          hits.push({ group: "documentos", key: `compra-${p.id}`, badge: "Factura de compra", title: `${docNo("compra", p.id)} (factura ${p.invoiceNumber})`, subtitle: p.supplier.name, href: `/compras/${p.id}` });
    }
  }
  return hits;
}

export async function globalSearch(db: DbClient, user: SessionUser, text: string, only: SearchGroup | undefined, limit: number) {
  const q = text.trim();
  const want = (g: SearchGroup) => !only || only === g;
  const can = (p: string) => user.permissions.has(p);
  const hits: Hit[] = [];
  if (!q) return { hits, counts: {} as Partial<Record<SearchGroup, number>> };
  const counts: Partial<Record<SearchGroup, number>> = {};

  if (want("documentos")) {
    const docs = await documentHits(db, user, q);
    counts.documentos = docs.length;
    hits.push(...docs.slice(0, limit));
  }

  if (want("motos") && (can("clientes.ver") || can("taller.ver"))) {
    const plate = q.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (plate.length >= 3) {
      const s = new Sql();
      const ids = (
        await s.run<{ id: number }[]>(
          db,
          `SELECT m.id FROM motorcycle m
            WHERE m.released_at IS NULL
              AND (upper(regexp_replace(coalesce(m.plate, ''), '[^A-Za-z0-9]', '', 'g')) LIKE '%' || ${s.p(plate)} || '%'
                OR upper(coalesce(m.chassis_number, '')) LIKE '%' || ${s.p(plate)} || '%')
            ORDER BY m.id DESC LIMIT 25`,
        )
      ).map((r) => Number(r.id));
      counts.motos = ids.length;
      const motos = await db.motorcycle.findMany({ where: { id: { in: ids.slice(0, limit) } }, include: { customer: true, model: { include: { brand: true } } } });
      const shop = await motorcyclesInWorkshop(db, motos.map((m) => m.id));
      for (const m of motos) {
        const open = shop.get(m.id);
        hits.push({
          group: "motos",
          key: `moto-${m.id}`,
          badge: open ? "En el taller" : "Moto",
          title: `${m.model.brand.name} ${m.model.name} · ${m.plate ?? "sin placa"}`,
          subtitle: `${m.color} · de ${m.customer.name}${open ? ` · orden ${docNo("orden", open.orderId)} (${LABELS.serviceStatus[open.status as ServiceOrderStatus]?.toLowerCase() ?? open.status})` : ""}`,
          href: open && can("taller.ver") ? `/taller/${open.orderId}` : `/clientes/${m.customerId}`,
        });
      }
    }
  }

  if (want("clientes") && can("clientes.ver")) {
    const { ranked, total } = await searchCustomerIds(db, { q, limit, offset: 0 });
    counts.clientes = total;
    const rows = await db.customer.findMany({ where: { id: { in: ranked.map((r) => r.id) } }, include: customerInclude });
    const balances = new Map(
      (
        await db.$queryRawUnsafe<{ customer_id: number; balance: string }[]>(
          `SELECT customer_id, balance::text AS balance FROM v_customer_balance WHERE customer_id IN (${intList(ranked.map((r) => r.id))})`,
        )
      ).map((r) => [Number(r.customer_id), r.balance]),
    );
    for (const c of inRankOrder(ranked, rows)) {
      const owes = balances.get(c.id);
      hits.push({
        group: "clientes",
        key: `cliente-${c.id}`,
        badge: owes && Number(owes) > 0 ? `Debe ${nio(owes)}` : "Cliente",
        title: c.name,
        subtitle: [c.phone, ...c.motorcycles.map((m) => `${m.model.brand.name} ${m.model.name}${m.plate ? ` ${m.plate}` : ""}`)].join(" · "),
        href: `/clientes/${c.id}`,
      });
    }
  }

  if (want("productos") && can("inventario.ver")) {
    const { ranked, total } = await searchProductIds(db, { q, limit, offset: 0 });
    counts.productos = total;
    const rows = await db.product.findMany({ where: { id: { in: ranked.map((r) => r.id) } }, include: productInclude });
    for (const p of inRankOrder(ranked, rows))
      hits.push({
        group: "productos",
        key: `producto-${p.id}`,
        badge: p.stock === 0 ? "Agotado" : `${p.stock} en stock`,
        title: p.name,
        subtitle: `${p.brand.name} · ${p.category.name} · ${nio(p.listPrice)}`,
        href: `/inventario/${p.id}`,
      });
  }

  if (want("proveedores") && can("compras.ver") && q.length >= 2) {
    const s = new Sql();
    const rows = await s.run<{ id: number; name: string; phone: string | null; total: number }[]>(
      db,
      `SELECT s.id, s.name, s.phone, count(*) OVER ()::int AS total FROM supplier s
        WHERE mirm_norm(s.name) LIKE '%' || mirm_norm(${s.p(q)}) || '%'
           OR mirm_norm(coalesce(s.contact_person, '')) LIKE '%' || mirm_norm(${s.p(q)}) || '%'
        ORDER BY s.name LIMIT ${s.p(limit, "int")}`,
    );
    counts.proveedores = Number(rows[0]?.total ?? 0);
    for (const r of rows)
      hits.push({ group: "proveedores", key: `proveedor-${r.id}`, badge: "Proveedor", title: r.name, subtitle: r.phone ?? "", href: `/compras/proveedores/${r.id}` });
  }

  return { hits, counts };
}

export { DOC_PREFIX };
