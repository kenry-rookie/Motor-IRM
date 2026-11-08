---
id: DEC-037
project: "[[Motor IRM]]"
stage: S8
status: Tomada
date: 2026-11-08
participants: Kenry
source: IA (redactada e implementada por Claude a pedido de Kenry; resuelve API-001 de "Pendientes de desarrollo")
reviewed: false
---
**[[Motor IRM|← Hub]]** · **[[Pendientes de desarrollo - MIRM|Pendientes]]** · **[[DEC-036 - Lightweight S6 Before Programming - MIRM|← DEC-036]]** · **[[DEC-038 - Timestamps With Time Zone - MIRM|DEC-038 →]]**

# DEC-037 — Service Order Own Id

Resuelve **API-001**.

## Contexto

- En el esquema de Prisma (`0_init`), `service_order.id` era el mismo `id` de `sale_invoice` (subtipo 1:1).
- Consecuencia: para **recibir una moto** había que crear antes una factura, con `payment_terms` obligatorio, sin saber el precio. Una orden cancelada dejaba una factura vacía.
- Todavía no hay datos reales: es el momento más barato para cambiarlo.

## Opciones

| Opción | Cómo funciona | A favor | En contra |
| --- | --- | --- | --- |
| A — Seguir compartiendo el id | La factura nace con la orden | Sin cambios | Facturas sin precio ni condiciones; facturas vacías al cancelar |
| **B — Id propio + la factura apunta a la orden** | `service_order.id` serial; `sale_invoice.service_order_id` (único, opcional) | La orden existe sola; la factura nace al cobrar | Una migración y una columna redundante en la línea |

## Decisión

**Elegimos:** B.

- `service_order.id` tiene su propia secuencia.
- `sale_invoice.service_order_id` → `service_order(id)`, **único**: como máximo una factura por orden. Si es NULL, es venta de mostrador.
- La línea que cobra una **falla adicional** debe estar en la factura de **su** orden. Antes lo probaba la FK (falla, factura) porque los id coincidían. Ahora `sale_invoice_line.service_order_id` copia la orden de la factura (redundancia controlada, igual que [[DEC-029 - Controlled Redundancy with Composite Foreign Keys - MIRM|DEC-029]]) y lo garantizan:
  - FK compuesta (factura, orden) → `sale_invoice(id, service_order_id)`.
  - FK compuesta (falla, orden) → `additional_fault(id, service_order_id)`.
  - CHECK `ck_sale_invoice_line_additional_fault`: si hay falla, la orden es obligatoria (con `MATCH SIMPLE` una FK con NULL no se revisa).
- Flujo en la API: `service.receive` crea la orden sin factura → cambios de estado y fallas → `service.close` crea la factura (mano de obra, fallas aceptadas, repuestos con salida `USO_SERVICIO`, cargos externos) y marca **ENTREGADA**. `service.cancel` marca **CANCELADA** y solo factura si hay cargo por cancelación.

**Por qué:** la recepción ya no depende del cobro y no quedan facturas vacías.

## Consecuencias

- **Ganamos:** recepción rápida; facturas solo cuando hay algo que cobrar.
- **Aceptamos:** los repuestos usados se descuentan del inventario **al cerrar** la orden (cuando se facturan), no en el momento en que el mecánico los toma. Si los dueños necesitan verlo antes, se agrega una reserva de repuestos.
- **Cuándo revisarla:** si el negocio necesita varias facturas por orden (anticipos, pagos parciales antes de terminar).

## Implementación

`prisma/migrations/1_decisions_api_001_003/migration.sql`, `prisma/schema.prisma`, `src/server/api/routers/service.ts`. Probado en PostgreSQL real y en `tests/flows.test.ts`.

## Historial

- 08-nov — Implementada por Claude a pedido de Kenry; pendiente de revisión del equipo.
