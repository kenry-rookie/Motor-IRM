---
id: DEC-048
project: "[[Motor IRM]]"
stage: S8
transformation: Modelo
status: Tomada
date: 2026-11-10
participants: Kenry
source: IA (Claude, a pedido de Kenry; prompt v2 §7)
reviewed: true
---
**[[Motor IRM|← Hub]]** · **[[DEC-047 - Phone Number Format - MIRM|← DEC-047]]** · **[[DEC-049 - Filters in the Database - MIRM|DEC-049 →]]**

# DEC-048 — Workshop Jobs From Catalog

## Contexto

- «Trabajo solicitado» era texto libre: cada quien escribía distinto y no se podía contar ni filtrar.

## Decisión

- Tabla `service_category` (Mantenimiento, Frenos, Motor…) y `service_type` con categoría, precio de referencia y **rango** (mínimo/máximo).
- Tabla `service_order_item`: los trabajos de cada orden. **Toda orden tiene al menos uno**: trigger de restricción **diferido** (`tg_service_order_has_items`), que se revisa al confirmar la transacción.
- `service_order.requested_work` pasa a ser la **nota del cliente** (opcional); nunca reemplaza al trabajo. No existe "Otro".
- Mano de obra siempre con tipo (`ck_sale_invoice_line_labor_service_type`, `NOT VALID` para las facturas viejas). Cobrar fuera del rango pide la clave de alguien con `taller.precio_especial` (dueños).
- Si un trabajo no está, un dueño lo agrega desde la misma pantalla («+ Agregar trabajo al catálogo»).
- También: `motorcycle.chassis_number` (único) y `service_order.odometer_km` (opcional).

## Historial

- 10-nov — Implementada por Claude a pedido de Kenry; pendiente de revisión del equipo.
