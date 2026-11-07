---
id: DEC-024
project: "[[Motor IRM]]"
stage: S5
transformation: T-09
status: Tomada
date: 2026-10-28
participants: Devans, Gustavo, Kenry
source: IA (redactada por Claude a pedido de Kenry, a partir de lo decidido y aplicado en el esquema y el DDL de la entrega del 29-oct)
reviewed: true
---
**[[Motor IRM|← Hub]]** · **[[S5 - Relational Model and Normalization - MIRM|S5]]** · **[[S5 - Relational Schema - MIRM|Esquema relacional]]** · **[[DEC-023 - Sale Cancellation Out of Scope - MIRM|← DEC-023]]** · **[[DEC-025 - Currency Handling - MIRM|DEC-025 →]]**

# DEC-024 — Exit Cost as Last Cost

Decisión de transformación **T-09** del [[S5 - Relational Schema - MIRM|esquema relacional]] (§1).

## Contexto

- Cada salida de inventario guarda un costo, para calcular la ganancia. Hay varias formas de calcularlo.

## Criterios

1. No cambiar las tablas
2. Sencillo para la entrega

## Opciones

| Opción | Cómo funciona | A favor | En contra |
| --- | --- | --- | --- |
| A — Último costo | El costo de la última compra al momento de salir | Simple | Menos exacto si los costos varían mucho |
| B — Costo promedio | Promedio ponderado de las existencias | Más exacto | Más cálculo; hay que decidir cómo se recalcula |

## Decisión

**Elegimos:** A (provisional) — Cada salida guarda en `unit_cost` el **último costo** del producto al momento de salir.

**Por qué:** No cambia las tablas: solo cómo se llena `unit_cost`. Se puede cambiar después.

## Consecuencias

- **Ganamos:** Ganancia calculable desde ya.
- **Aceptamos:** El cálculo es aproximado.
- **Cuándo revisarla:** Antes del 10-dic, con los dueños.

## Historial

- 28-oct — Tomada y aplicada en la entrega de la base de datos.
- 05-nov — Registrada como DEC al cerrar S5. Redactada por Claude a pedido de Kenry; pendiente de revisión del equipo.
