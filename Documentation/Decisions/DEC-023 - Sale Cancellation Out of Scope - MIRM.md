---
id: DEC-023
project: "[[Motor IRM]]"
stage: S5
transformation: T-08
status: Tomada
date: 2026-10-28
participants: Devans, Gustavo, Kenry
source: IA (redactada por Claude a pedido de Kenry, a partir de lo decidido y aplicado en el esquema y el DDL de la entrega del 29-oct)
reviewed: true
---
**[[Motor IRM|← Hub]]** · **[[S5 - Relational Model and Normalization - MIRM|S5]]** · **[[S5 - Relational Schema - MIRM|Esquema relacional]]** · **[[DEC-022 - Price History Without Old Price - MIRM|← DEC-022]]** · **[[DEC-024 - Exit Cost as Last Cost - MIRM|DEC-024 →]]**

# DEC-023 — Sale Cancellation Out of Scope

Decisión de transformación **T-08** del [[S5 - Relational Schema - MIRM|esquema relacional]] (§1).

## Contexto

- Podría hacer falta anular una venta, pero no está definido qué pasa con sus movimientos y sus pagos.

## Criterios

1. No inventar reglas que el negocio no dio

## Opciones

| Opción | Cómo funciona | A favor | En contra |
| --- | --- | --- | --- |
| A — Columna de anulación ahora | Estado anulada en el documento | Previsto | Sin regla: qué pasa con existencia y pagos queda en el aire |
| B — Fuera de la versión de entrega | No hay columna; se pregunta a los dueños | Honesto con lo que se sabe | Si hay un error al vender, se corrige con devolución o ajuste |

## Decisión

**Elegimos:** B — La anulación queda **fuera de la versión de entrega** (sin columna).

**Por qué:** Regla 2 del Restart Plan: nada se modela sin una regla que lo pida.

## Consecuencias

- **Ganamos:** Un modelo sin inventos.
- **Aceptamos:** Corregir una venta mal hecha requiere devolución o ajuste.
- **Cuándo revisarla:** En la entrevista a los dueños: ¿alguna vez se anula una venta y qué se hace?

## Historial

- 28-oct — Tomada y aplicada en la entrega de la base de datos.
- 05-nov — Registrada como DEC al cerrar S5. Redactada por Claude a pedido de Kenry; pendiente de revisión del equipo.
- 06-nov — Los dueños no tienen registro de anulaciones ("no teníamos sistema", [[SRC-07 - Owners Answers Nov 06 - MIRM|SRC-07]]). Se mantiene; cómo corregir una venta mal registrada pasa al equipo como Q-083 (requisito de S6).
