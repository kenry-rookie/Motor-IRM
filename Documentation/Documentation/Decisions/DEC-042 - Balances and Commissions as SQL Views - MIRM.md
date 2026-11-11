---
id: DEC-042
project: "[[Motor IRM]]"
stage: S8
status: Tomada
date: 2026-11-10
participants: Kenry
source: IA (redactada e implementada por Claude a pedido de Kenry; prompt v2 §5.1.3; aplica DEC-020)
reviewed: true
---
**[[Motor IRM|← Hub]]** · **[[DEC-020 - Derived Attributes as Views - MIRM|DEC-020]]** · **[[DEC-041 - Order Responsible Mechanic or Owner - MIRM|← DEC-041]]** · **[[DEC-043 - One Search, One Report, One Set of Pickers - MIRM|DEC-043 →]]**

# DEC-042 — Balances and Commissions as SQL Views

## Contexto

- «¿Cuánto me debe este cliente?» se calculaba en TypeScript, con bucles repetidos en ventas, clientes, compras, reportes y personal. Cinco copias de la misma regla.
- [[DEC-020 - Derived Attributes as Views - MIRM|DEC-020]] ya decía que los derivados van como vistas.

## Decisión

Una vista por pregunta del negocio (migración `4_staff_kind_and_balance_views`):

| Vista | Responde |
| --- | --- |
| `v_invoice_balance` | Saldo de cada factura: total − devoluciones − abonos, días de atraso |
| `v_opening_balance_remaining` | Saldo de cada deuda anterior al sistema |
| `v_customer_balance` | Cuánto debe cada cliente, cuánto está vencido, la deuda más vieja |
| `v_purchase_invoice_balance` | Saldo de cada compra (las devoluciones REPOSICION no bajan la deuda) |
| `v_supplier_balance` | Cuánto le debemos a cada proveedor (saldo inicial + compras) |
| `v_mechanic_unpaid_commission` | Órdenes entregadas con comisión sin pagar |
| `v_product_margin` | Último costo (DEC-024) y margen por producto |
| `v_service_order_status` | Estado actual de cada orden |

- La API las lee desde un solo módulo: `src/server/domain/balances.ts`. Las validaciones que necesitan el saldo (no pagar de más) leen la vista **después** de bloquear las filas (`FOR UPDATE`).
- `CURRENT_DATE` usa la zona de la base (America/Managua, DEC-038).

**Por qué:** una sola definición de cada saldo; se puede consultar en `psql` y explicar en clase.

## Consecuencias

- **Ganamos:** el mismo número en todas las pantallas; reportes más simples.
- **Aceptamos:** el interés estimado sigue en TypeScript hasta que la mora manual (Fase 4) lo reemplace.
- **Cuándo revisarla:** si una vista se vuelve lenta con muchos datos (pasar a vista materializada o a columnas mantenidas por trigger).

## Historial

- 10-nov — Implementada por Claude a pedido de Kenry; pendiente de revisión del equipo.
