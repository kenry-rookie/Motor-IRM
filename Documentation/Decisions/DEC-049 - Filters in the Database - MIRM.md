---
id: DEC-049
project: "[[Motor IRM]]"
stage: S8
status: Tomada
date: 2026-11-10
participants: Kenry
source: IA (Claude, a pedido de Kenry)
reviewed: true
---
**[[Motor IRM|← Hub]]** · **[[DEC-048 - Workshop Jobs From Catalog - MIRM|← DEC-048]]** · **[[DEC-050 - Password to Change Permissions - MIRM|DEC-050 →]]**

# DEC-049 — Filters in the Database

## Decisión

- Buscar y filtrar lo hace PostgreSQL, no la pantalla. Vistas nuevas:
  - `v_product_overview`: categoría, marca, calidad, existencias, último costo, margen, vendidos en 90 días, proveedores que lo venden.
  - `v_customer_overview`: motos (y sus marcas), deuda, vencido, días de atraso, si compra al crédito, última visita.
  - `v_supplier_product`: qué vende cada proveedor, último costo pagado y cuándo (también es el «último costo a este proveedor» de la compra).
- `search.products` y `search.customers` combinan texto (tolerante a errores) + filtros + orden, con paginación.
- Productos: categoría, marca, calidad, existencias, «lo vende el proveedor», orden por precio, existencias, más vendidos o margen. Clientes: con/sin moto, marca de la moto, deuda (con, vencida, al día, sin), compra al crédito; orden por deuda, atraso o visita.

## Historial

- 10-nov — Implementada por Claude a pedido de Kenry; pendiente de revisión del equipo.
