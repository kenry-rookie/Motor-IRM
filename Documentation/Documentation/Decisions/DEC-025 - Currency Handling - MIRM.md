---
id: DEC-025
project: "[[Motor IRM]]"
stage: S5
transformation: T-10
status: Tomada
date: 2026-10-28
participants: Devans, Gustavo, Kenry
source: IA (redactada por Claude a pedido de Kenry, a partir de lo decidido y aplicado en el esquema y el DDL de la entrega del 29-oct)
reviewed: true
---
**[[Motor IRM|← Hub]]** · **[[S5 - Relational Model and Normalization - MIRM|S5]]** · **[[S5 - Relational Schema - MIRM|Esquema relacional]]** · **[[DEC-024 - Exit Cost as Last Cost - MIRM|← DEC-024]]** · **[[DEC-026 - Value Lists as Check Constraints - MIRM|DEC-026 →]]**

# DEC-025 — Currency Handling

Decisión de transformación **T-10** del [[S5 - Relational Schema - MIRM|esquema relacional]] (§1).

## Contexto

- La moneda principal es el córdoba y se aceptan dólares, con el tipo de cambio que fijan los dueños (BR-057, BR-058).

## Criterios

1. Saldos comparables
2. Guardar lo que realmente se recibió

## Opciones

| Opción | Cómo funciona | A favor | En contra |
| --- | --- | --- | --- |
| A — Todo en córdobas | Se convierte al registrar | Sumas directas | Se pierde cuánto se recibió en dólares |
| B — Monto en su moneda + tipo de cambio | `amount`, `currency`, `exchange_rate`; lo aplicado y los saldos en córdobas | Se conserva el pago real y su conversión | Un CHECK más |

## Decisión

**Elegimos:** B — `amount` en la moneda del pago + `exchange_rate` si es en dólares (`ck_*_exchange`). Montos aplicados, totales y saldos en **córdobas**.

**Por qué:** Conserva la evidencia y deja los cálculos en una sola moneda.

## Consecuencias

- **Ganamos:** El tipo de cambio queda histórico en cada pago.
- **Aceptamos:** El reparto en córdobas lo hace la aplicación (C-07).
- **Cuándo revisarla:** Si se aceptan otras monedas.

## Historial

- 28-oct — Tomada y aplicada en la entrega de la base de datos.
- 05-nov — Registrada como DEC al cerrar S5. Redactada por Claude a pedido de Kenry; pendiente de revisión del equipo.
