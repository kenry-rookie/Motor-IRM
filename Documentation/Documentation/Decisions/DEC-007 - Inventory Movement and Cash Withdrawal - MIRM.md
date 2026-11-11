---
id: DEC-007
project: "[[Motor IRM]]"
stage: S3
status: Tomada
date: 2026-10-27
participants: Devans, Gustavo, Kenry
source: IA (redactada por Claude a pedido de Kenry, con lo decidido por el equipo)
ai_edit: "Claude — 2026-10-28: historial (revisada por el equipo)"
reviewed: true
---
**[[Motor IRM|← Hub]]** · **[[S3 - Conceptual Model - MIRM|Modelo conceptual]]** · **[[DEC-005 - Managua Trip Expenses as Cash Withdrawal - MIRM|← DEC-005]]** · **[[DEC-008 - Separate Brand Catalogs and Product Tier - MIRM|DEC-008 →]]**

# DEC-007 — Inventory Movement and Cash Withdrawal

## Contexto

- El equipo discutía si usar solo *Movimiento de inventario* o agregar también *Retiro de caja*.
- DEC-005 decidió que los gastos de viaje se registran como **retiro de caja**. Q-052 ([[SRC-04 - Follow-up Answers Owners - MIRM|SRC-04]]): los retiros *"Son de caja"*.
- En la revisión del 27-oct el equipo definió que el **consumo interno** (limpieza u otro gasto) **sale de un retiro de caja y no es una venta**.

## Criterios

1. Que cada entidad represente **una sola cosa** (sin campos que queden vacíos según el tipo de fila).
2. Que la existencia de productos y el dinero de caja se puedan calcular sin mezclarse.
3. Que respete cómo trabaja el negocio.

## Opciones

| Opción | Cómo funciona | A favor | En contra |
| --- | --- | --- | --- |
| A — Solo *Movimiento de inventario* | Los retiros de dinero se guardan como un tipo de movimiento | Una entidad menos | Mezcla productos (cantidad) con dinero (monto): la mitad de los campos queda vacía en cada fila |
| B — Solo *Retiro de caja* | No hay kardex de productos | — | No se puede calcular la existencia (BR-020) |
| C — Las dos, separadas | *Movimiento de inventario* para productos; *Retiro de caja* para dinero | Cada una tiene sus propios datos y relaciones | Dos entidades en vez de una |

## Decisión

**Elegimos:** C — *Movimiento de inventario* y *Retiro de caja* son **entidades separadas**. Uno mueve productos y el otro dinero.

**Consecuencias en las reglas:**
- El **consumo interno** (limpieza u otros gastos) es un **motivo de retiro de caja**, no una salida de inventario (BR-075 v2, BR-079 v2).
- Si un mecánico usa productos de la tienda en su propia moto, es una **venta** (BR-055, DEC-003).

## Consecuencias

- **Ganamos:** existencia y caja se calculan por separado y sin campos vacíos.
- **Aceptamos:** si algún día se toma un producto de la tienda para uso interno, se registra como **ajuste** de inventario con observación.
- **Cuándo revisarla:** si los dueños empiezan a sacar productos de la tienda para uso interno con frecuencia.

## Historial

- 27-oct — Tomada por el equipo. Redactada por Claude a pedido de Kenry. Revisada por el equipo.
