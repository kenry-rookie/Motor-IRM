---
id: DEC-030
project: "[[Motor IRM]]"
stage: S5
transformation: Modelo
status: Tomada (pendiente de confirmar con los dueños: Q-084 y Q-085)
date: 2026-11-07
participants: Kenry
source: IA (redactada por Claude a pedido de Kenry, a partir de SRC-08; aplicada y probada por Claude en 01_schema.sql v2)
reviewed: true
---
**[[Motor IRM|← Hub]]** · **[[S5 - Relational Model and Normalization - MIRM|S5]]** · **[[SRC-08 - Team Observations Nov 07 - MIRM|SRC-08]]** · **[[DEC-029 - Controlled Redundancy with Composite Foreign Keys - MIRM|← DEC-029]]** · **[[DEC-031 - Purchase Invoice Discount - MIRM|DEC-031 →]]**

# DEC-030 — Mechanic Pay Period

Resuelve N-3 (caso 4) de la [[S5 - Normalization - MIRM|normalización]].

## Contexto

- El caso 4 preguntaba si `week_end` se deduce de `week_start` (semana fija de lunes a sábado). SRC-07 dijo "de lunes a sábado", pero [[SRC-08 - Team Observations Nov 07 - MIRM|SRC-08]] (Kenry) muestra que el periodo **depende de los días que el mecánico trabajó**: de miércoles a sábado, de martes a jueves, o pagado el jueves si no vendrá viernes ni sábado.
- Si un mecánico se enferma, lo que se le debía de la semana anterior se le paga después.
- Kenry propone que un adelanto no pase de lo que el mecánico ya ganó.

## Criterios

1. Registrar el periodo real de cada pago, sin reglas fijas de calendario.
2. Que el trabajo no liquidado no se pierda ni se pague dos veces.
3. Que las consultas de pago (Q16) sigan funcionando.

## Opciones

| Opción | Cómo funciona | A favor | En contra |
| --- | --- | --- | --- |
| A — Semana fija (quitar `week_end`, exigir lunes) | Fin = inicio + 5 días | 3FN estricta | No representa los casos reales de SRC-08 |
| **B — Periodo variable** | `period_start` y `period_end` son datos propios; cada servicio y adelanto se une a **un** pago con su FK | Cubre todos los casos; lo pendiente queda con FK nula hasta el siguiente pago | Dos columnas de fecha (no es redundancia: el fin no se deduce) |

## Decisión

**Elegimos:** B — Periodo variable.

- `weekly_payout.week_start / week_end` → **`period_start / period_end`** (cambio de nombre: ya no es siempre una semana). Se conserva el nombre de la tabla.
- `uq_weekly_payout_id_mechanic_period_start`: un mecánico no tiene dos pagos que empiecen el mismo día. `ck_weekly_payout_period`: el fin no es antes del inicio.
- **Caso 4 → ✅:** `period_end` no depende de `period_start`, así que no hay dependencia transitiva.
- **Trabajo de semanas anteriores (BR-104):** un servicio o adelanto con `id_weekly_payout` nulo está **pendiente** y se liquida en el siguiente pago de ese mecánico (la FK compuesta de [[DEC-029 - Controlled Redundancy with Composite Foreign Keys - MIRM|DEC-029]] garantiza que sea el mismo mecánico).
- **Adelanto (BR-103):** al registrar un adelanto, la aplicación compara el monto con la comisión pendiente menos los adelantos pendientes (consulta **Q21**). Si no alcanza, **avisa** y el dueño decide: es un aviso, no un bloqueo, porque BR-048 dice que no hay límite fijo. No va en la base (mira otras tablas).

**Por qué:** es la opción que representa lo que pasa en el negocio, y no cambia la estructura (solo nombres y CK).

## Consecuencias

- **Ganamos:** periodos cortos, pagos adelantados y semanas atrasadas se registran igual.
- **Aceptamos:** que un periodo no se traslape con otro del mismo mecánico queda en la aplicación (se podría con una restricción `EXCLUDE`, pero necesita la extensión `btree_gist`; se deja para el 10-dic si hace falta).
- **Consultas actualizadas:** Q16 (usa `period_start`/`period_end`) y Q21 nueva (disponible para adelanto).
- **Cuándo revisarla:** cuando los dueños respondan Q-084 y Q-085.

## Historial

- 06-nov — Caso 4 planteado como pregunta (SRC-07: lunes a sábado).
- 07-nov — Kenry describe los periodos reales (SRC-08). Tomada y aplicada en `01_schema.sql` v2. Redactada por Claude a pedido de Kenry; pendiente de revisión del equipo.
