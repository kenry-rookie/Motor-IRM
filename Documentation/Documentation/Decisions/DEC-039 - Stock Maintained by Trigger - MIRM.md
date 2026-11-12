---
id: DEC-039
project: "[[Motor IRM]]"
stage: S8
status: Tomada
date: 2026-11-08
participants: Kenry
source: IA (redactada e implementada por Claude a pedido de Kenry; resuelve API-003 de "Pendientes de desarrollo")
reviewed: true
---
**[[Motor IRM|← Hub]]** · **[[Pendientes de desarrollo - MIRM|Pendientes]]** · **[[DEC-038 - Timestamps With Time Zone - MIRM|← DEC-038]]**

# DEC-039 — Stock Maintained by Trigger

Resuelve **API-003**.

## Contexto

- `product.stock` es una copia de la suma de `inventory_movement` (el kardex). Se guarda para que el mostrador sea rápido.
- Si dos partes del programa la actualizan, tarde o temprano se desincroniza.
- [[DEC-020 - Derived Attributes as Views - MIRM|DEC-020]] prefería calcular los derivados; el esquema de Prisma ya traía la columna.

## Opciones

| Opción | Cómo funciona | A favor | En contra |
| --- | --- | --- | --- |
| A — La API la actualiza en la misma transacción | Cada flujo suma/resta | Lógica visible en TypeScript | Hay que acordarse en cada flujo; un SQL a mano la rompe |
| **B — Trigger en `inventory_movement`** | Al insertar un movimiento, la base ajusta el stock | Un solo lugar; imposible olvidarlo; el CHECK `stock >= 0` frena ventas sin existencias | Lógica en SQL (es el proyecto de BD: está bien que se vea) |

## Decisión

**Elegimos:** B.

- `tg_inventory_movement_apply_stock`: suma las entradas (COMPRA, DEVOLUCION_CLIENTE, INVENTARIO_INICIAL, AJUSTE_ENTRADA) y resta las salidas.
- `ck_product_stock` (`stock >= 0`) hace fallar **toda** la transacción si una salida deja stock negativo. La API lo traduce a "No hay existencias suficientes de este producto".
- `tg_product_guard_stock`: nadie puede escribir `product.stock` directamente, y un producto nuevo empieza en 0 (el stock inicial es un movimiento `INVENTARIO_INICIAL`).
- `tg_inventory_movement_append_only`: el kardex es de **solo inserción**; un error se corrige con un ajuste.
- Vista `v_product_stock_mismatch`: debe devolver 0 filas (las pruebas la revisan al terminar).

**Por qué:** un solo lugar decide el stock y la base lo protege aunque el programa tenga un error.

## Consecuencias

- **Ganamos:** stock siempre igual al kardex; ventas sin existencias imposibles.
- **Aceptamos:** para corregir un movimiento mal hecho se registra un ajuste (queda rastro).
- **Cuándo revisarla:** si el negocio decide vender en negativo (pedidos por encargo).

## Historial

- 08-nov — Implementada por Claude a pedido de Kenry; pendiente de revisión del equipo.
