---
id: DEC-019
project: "[[Motor IRM]]"
stage: S5
transformation: T-04
status: Tomada
date: 2026-10-28
participants: Devans, Gustavo, Kenry
source: IA (redactada por Claude a pedido de Kenry, a partir de lo decidido y aplicado en el esquema y el DDL de la entrega del 29-oct)
reviewed: true
---
**[[Motor IRM|← Hub]]** · **[[S5 - Relational Model and Normalization - MIRM|S5]]** · **[[S5 - Relational Schema - MIRM|Esquema relacional]]** · **[[DEC-018 - Staff Table Mapping - MIRM|← DEC-018]]** · **[[DEC-020 - Derived Attributes as Views - MIRM|DEC-020 →]]**

# DEC-019 — Inventory Movement Origin Mapping

Decisión de transformación **T-04** del [[S5 - Relational Schema - MIRM|esquema relacional]] (§1).

## Contexto

- [[DEC-014 - Exclusive Arc for Inventory Movement Origin - MIRM|DEC-014]] decidió un arco exclusivo para el origen del movimiento. Hay que decidir de qué lado van las FK.

## Criterios

1. Garantizar "un solo origen" en la base
2. Poder trazar el movimiento a su origen

## Opciones

| Opción | Cómo funciona | A favor | En contra |
| --- | --- | --- | --- |
| A — FK en cada tabla de origen | Cada línea apunta a su movimiento | El movimiento queda simple | La exclusividad cruza seis tablas: no cabe en un CHECK |
| B — Seis FK opcionales en el movimiento + CHECK | Un CHECK obliga a llenar solo el origen del motivo | La exclusividad se ve dentro de una fila | Seis columnas opcionales |

## Decisión

**Elegimos:** B — Seis FK opcionales en `inventory_movement` y `ck_inventory_movement_origin`. Las UQ garantizan "como máximo un movimiento" por línea.

**Por qué:** Un CHECK solo ve la fila que se guarda: la exclusividad tiene que vivir en esa fila.

## Consecuencias

- **Ganamos:** La base rechaza movimientos sin origen o con dos orígenes (pruebas 20 a 24 del DDL).
- **Aceptamos:** El "al menos un movimiento por línea" y que producto y cantidad coincidan con la línea van en la aplicación (C-13).
- **Cuándo revisarla:** Si los orígenes pasan de ~10 (ver DEC-014).

## Historial

- 28-oct — Tomada y aplicada en la entrega de la base de datos.
- 05-nov — Registrada como DEC al cerrar S5. Redactada por Claude a pedido de Kenry; pendiente de revisión del equipo.
