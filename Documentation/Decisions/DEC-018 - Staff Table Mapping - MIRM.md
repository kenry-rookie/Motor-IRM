---
id: DEC-018
project: "[[Motor IRM]]"
stage: S5
transformation: T-03
status: Tomada
date: 2026-10-28
participants: Devans, Gustavo, Kenry
source: IA (redactada por Claude a pedido de Kenry, a partir de lo decidido y aplicado en el esquema y el DDL de la entrega del 29-oct)
reviewed: true
---
**[[Motor IRM|← Hub]]** · **[[S5 - Relational Model and Normalization - MIRM|S5]]** · **[[S5 - Relational Schema - MIRM|Esquema relacional]]** · **[[DEC-017 - Billable Document Table Mapping - MIRM|← DEC-017]]** · **[[DEC-019 - Inventory Movement Origin Mapping - MIRM|DEC-019 →]]**

# DEC-018 — Staff Table Mapping

Decisión de transformación **T-03** del [[S5 - Relational Schema - MIRM|esquema relacional]] (§1).

## Contexto

- [[DEC-012 - Staff Disjoint Specialization - MIRM|DEC-012]] decidió la especialización disjunta de Personal (Dueño, Mecánico, Encargado). Hay que convertirla en tablas.

## Criterios

1. Que "solo un dueño autoriza" se cumpla sin código
2. Guardar el porcentaje del mecánico
3. No crear tablas vacías

## Opciones

| Opción | Cómo funciona | A favor | En contra |
| --- | --- | --- | --- |
| A — Solo `staff` con `role` | Las FK apuntan a `staff` | Simple | "Solo un dueño" quedaría en el código |
| B — `staff` + una tabla por subclase | `owner`, `mechanic` y `clerk` | Completo | `clerk` no tendría columnas ni relaciones |
| C — `staff` + `owner` + `mechanic` | El encargado es solo un valor de `role` | Las FK de dueño apuntan a `owner`; `mechanic` guarda el porcentaje | `role` y la fila de subclase deben coincidir |

## Decisión

**Elegimos:** C — `staff` (con `role`) + `owner` + `mechanic`. Las FK que deben ser de un dueño apuntan a `owner`.

**Por qué:** BR-009 a BR-011 se cumplen con una FK, sin una línea de código.

## Consecuencias

- **Ganamos:** Permisos del negocio garantizados por la base.
- **Aceptamos:** **Redundancia controlada:** `role` repite lo que dice la fila de `owner` o `mechanic`; la coincidencia la controla la aplicación.
- **Cuándo revisarla:** Si el encargado necesita datos o relaciones propias.

## Historial

- 28-oct — Tomada y aplicada en la entrega de la base de datos.
- 05-nov — Registrada como DEC al cerrar S5. Redactada por Claude a pedido de Kenry; pendiente de revisión del equipo.
- 07-nov — `staff` recibe `username` y `password_hash` para el inicio de sesión ([[DEC-035 - Staff Login Credentials - MIRM|DEC-035]]). Registrado por Claude; pendiente de revisión del equipo.
