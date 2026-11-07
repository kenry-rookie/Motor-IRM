---
id: DEC-021
project: "[[Motor IRM]]"
stage: S5
transformation: T-06
status: Tomada
date: 2026-10-28
participants: Devans, Gustavo, Kenry
source: IA (redactada por Claude a pedido de Kenry, a partir de lo decidido y aplicado en el esquema y el DDL de la entrega del 29-oct)
reviewed: true
---
**[[Motor IRM|← Hub]]** · **[[S5 - Relational Model and Normalization - MIRM|S5]]** · **[[S5 - Relational Schema - MIRM|Esquema relacional]]** · **[[DEC-020 - Derived Attributes as Views - MIRM|← DEC-020]]** · **[[DEC-022 - Price History Without Old Price - MIRM|DEC-022 →]]**

# DEC-021 — Movement Reason Includes Direction

Decisión de transformación **T-06** del [[S5 - Relational Schema - MIRM|esquema relacional]] (§1).

## Contexto

- Un movimiento de inventario es entrada o salida. Con un motivo `AJUSTE` que podía ser las dos, había que guardar la dirección aparte.

## Criterios

1. Sin datos repetidos
2. Que la existencia se calcule sin ambigüedad

## Opciones

| Opción | Cómo funciona | A favor | En contra |
| --- | --- | --- | --- |
| A — Motivo + columna de dirección | `reason` y `direction` | Explícito | Si el motivo determina la dirección, se repite (y pueden contradecirse) |
| B — El motivo incluye la dirección | `AJUSTE_ENTRADA` / `AJUSTE_SALIDA`, `CAMBIO_CLIENTE`… | DF *motivo → dirección*; nada repetido | Más valores en la lista |

## Decisión

**Elegimos:** B — El motivo incluye la dirección y **no hay columna de dirección**.

**Por qué:** Con la DF *motivo → dirección*, guardar las dos violaría la 3FN.

## Consecuencias

- **Ganamos:** Un solo dato decide si suma o resta.
- **Aceptamos:** La tabla motivo → dirección vive en el esquema (§5.1) y en la vista de existencia.
- **Cuándo revisarla:** Si aparece un motivo que pueda ser entrada y salida.

## Historial

- 28-oct — Tomada y aplicada en la entrega de la base de datos.
- 05-nov — Registrada como DEC al cerrar S5. Redactada por Claude a pedido de Kenry; pendiente de revisión del equipo.
