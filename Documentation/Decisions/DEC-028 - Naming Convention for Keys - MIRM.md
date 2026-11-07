---
id: DEC-028
project: "[[Motor IRM]]"
stage: S5
transformation: Convención
status: Tomada
date: 2026-10-29
participants: Kenry
source: IA (redactada por Claude a pedido de Kenry, a partir de lo decidido y aplicado en el esquema y el DDL de la entrega del 29-oct)
reviewed: true
---
**[[Motor IRM|← Hub]]** · **[[S5 - Relational Model and Normalization - MIRM|S5]]** · **[[S5 - Relational Schema - MIRM|Esquema relacional]]** · **[[DEC-027 - No Cascade Delete - MIRM|← DEC-027]]**

# DEC-028 — Naming Convention for Keys

Convención del [[S5 - Relational Schema - MIRM|esquema relacional]] (§2) y del [[S5 - DDL PostgreSQL - MIRM|DDL]].

## Contexto

- El esquema v1 usaba `id` como PK y `<tabla>_id` como FK. Al escribir el DDL entre dos personas, los nombres tenían que coincidir exactamente.

## Criterios

1. Saber a qué tabla lleva una FK con solo leerla
2. Que dos personas escriban nombres iguales

## Opciones

| Opción | Cómo funciona | A favor | En contra |
| --- | --- | --- | --- |
| A — `id` y `<tabla>_id` | Estilo habitual de Django | Corto | `id` se repite en todas las tablas; en un JOIN hay que calificarlo siempre |
| B — `id_<tabla>` en PK y FK | La FK se llama igual que la PK a la que apunta; `id_<rol>` si hay rol | Un nombre por concepto en toda la base | Nombres más largos; en Django hay que indicar `db_column` |

## Decisión

**Elegimos:** B — La PK de cada tabla se llama `id_<tabla>` y cada FK se llama igual que la PK a la que apunta, o `id_<rol>` cuando hay rol (`id_registered_by`). Restricciones con nombre en minúsculas: `pk_`, `fk_`, `uq_`, `ck_`.

**Por qué:** Decisión de Kenry (29-oct), aplicada en el DDL y en las consultas.

## Consecuencias

- **Ganamos:** Las FK entre los dos archivos coincidieron.
- **Aceptamos:** Los diagramas y el diccionario del esquema todavía muestran los nombres viejos: se actualizan al cerrar S5.
- **Cuándo revisarla:** —

## Historial

- 29-oct — Tomada y aplicada en la entrega de la base de datos.
- 05-nov — Registrada como DEC al cerrar S5. Redactada por Claude a pedido de Kenry; pendiente de revisión del equipo.
