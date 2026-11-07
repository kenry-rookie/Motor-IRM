---
id: DEC-027
project: "[[Motor IRM]]"
stage: S5
transformation: T-12
status: Tomada
date: 2026-10-28
participants: Devans, Gustavo, Kenry
source: IA (redactada por Claude a pedido de Kenry, a partir de lo decidido y aplicado en el esquema y el DDL de la entrega del 29-oct)
reviewed: true
---
**[[Motor IRM|← Hub]]** · **[[S5 - Relational Model and Normalization - MIRM|S5]]** · **[[S5 - Relational Schema - MIRM|Esquema relacional]]** · **[[DEC-026 - Value Lists as Check Constraints - MIRM|← DEC-026]]** · **[[DEC-028 - Naming Convention for Keys - MIRM|DEC-028 →]]**

# DEC-027 — No Cascade Delete

Decisión de transformación **T-12** del [[S5 - Relational Schema - MIRM|esquema relacional]] (§1).

## Contexto

- Borrar un registro con historia (un mecánico, un producto) podría arrastrar ventas y comisiones.

## Criterios

1. No perder historia
2. Que la base lo impida, no la buena voluntad

## Opciones

| Opción | Cómo funciona | A favor | En contra |
| --- | --- | --- | --- |
| A — `ON DELETE CASCADE` | Borrar el padre borra los hijos | Limpieza fácil | Destruye el historial |
| B — Sin cascada + desactivar | FK `NO ACTION`; columna `active` | El historial no se puede romper | Hay que filtrar los inactivos |

## Decisión

**Elegimos:** B — Todas las FK sin cascada (`NO ACTION`). Nada del negocio se borra: se desactiva (`active`).

**Por qué:** Lo que pasó en el negocio no se deshace.

## Consecuencias

- **Ganamos:** La base rechaza borrar un producto con historia (prueba 33 del DDL).
- **Aceptamos:** Las pantallas deben ocultar lo inactivo.
- **Cuándo revisarla:** Si hay datos de prueba que limpiar (se hace con scripts, no con cascada).

## Historial

- 28-oct — Tomada y aplicada en la entrega de la base de datos.
- 05-nov — Registrada como DEC al cerrar S5. Redactada por Claude a pedido de Kenry; pendiente de revisión del equipo.
