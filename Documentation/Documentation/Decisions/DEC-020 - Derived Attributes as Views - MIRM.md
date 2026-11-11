---
id: DEC-020
project: "[[Motor IRM]]"
stage: S5
transformation: T-05
status: Tomada
date: 2026-10-28
participants: Devans, Gustavo, Kenry
source: IA (redactada por Claude a pedido de Kenry, a partir de lo decidido y aplicado en el esquema y el DDL de la entrega del 29-oct)
reviewed: true
---
**[[Motor IRM|← Hub]]** · **[[S5 - Relational Model and Normalization - MIRM|S5]]** · **[[S5 - Relational Schema - MIRM|Esquema relacional]]** · **[[DEC-019 - Inventory Movement Origin Mapping - MIRM|← DEC-019]]** · **[[DEC-021 - Movement Reason Includes Direction - MIRM|DEC-021 →]]**

# DEC-020 — Derived Attributes as Views

Decisión de transformación **T-05** del [[S5 - Relational Schema - MIRM|esquema relacional]] (§1).

## Contexto

- El modelo tiene datos que se calculan: existencia, último costo, totales, saldos, deuda, comisión, estado actual y fechas del servicio.

## Criterios

1. Que un dato nunca quede desactualizado
2. Que el SQL propio sea visible (DEC-006)

## Opciones

| Opción | Cómo funciona | A favor | En contra |
| --- | --- | --- | --- |
| A — Guardarlos en columnas | Se actualizan con cada operación | Lectura rápida | Anomalía de actualización: si falla un paso, el dato miente |
| B — Calcularlos en vistas | Vistas de PostgreSQL (§7 del esquema) | Siempre correctos; SQL propio | Consultas más pesadas (irrelevante para este volumen) |

## Decisión

**Elegimos:** B — Los derivados **no se guardan**: se calculan en vistas (§7). La única excepción es `product.sale_price` ([[DEC-022 - Price History Without Old Price - MIRM|DEC-022]]).

**Por qué:** Un dato calculado que además se guarda puede contradecir a sus fuentes.

## Consecuencias

- **Ganamos:** Una sola fuente de verdad por dato.
- **Aceptamos:** Las vistas todavía no están escritas: su lógica existe como consultas (Q04, Q07, Q11, Q15–Q17, Q19).
- **Cuándo revisarla:** Si alguna pantalla se vuelve lenta (por ejemplo, el estado actual del servicio, DEC-013).

## Historial

- 28-oct — Tomada y aplicada en la entrega de la base de datos.
- 05-nov — Registrada como DEC al cerrar S5. Redactada por Claude a pedido de Kenry; pendiente de revisión del equipo.
