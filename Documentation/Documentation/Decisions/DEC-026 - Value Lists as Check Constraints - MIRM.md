---
id: DEC-026
project: "[[Motor IRM]]"
stage: S5
transformation: T-11
status: Tomada
date: 2026-10-28
participants: Devans, Gustavo, Kenry
source: IA (redactada por Claude a pedido de Kenry, a partir de lo decidido y aplicado en el esquema y el DDL de la entrega del 29-oct)
reviewed: true
---
**[[Motor IRM|← Hub]]** · **[[S5 - Relational Model and Normalization - MIRM|S5]]** · **[[S5 - Relational Schema - MIRM|Esquema relacional]]** · **[[DEC-025 - Currency Handling - MIRM|← DEC-025]]** · **[[DEC-027 - No Cascade Delete - MIRM|DEC-027 →]]**

# DEC-026 — Value Lists as Check Constraints

Decisión de transformación **T-11** del [[S5 - Relational Schema - MIRM|esquema relacional]] (§1).

## Contexto

- Hay listas de valores (estados, motivos, rol, gama) y catálogos que los dueños amplían (categorías, marcas, tipos de servicio).

## Criterios

1. No agregar tablas sin ganar nada
2. Que los dueños puedan ampliar lo que es suyo

## Opciones

| Opción | Cómo funciona | A favor | En contra |
| --- | --- | --- | --- |
| A — Una tabla por lista | FK a una tabla de códigos | Ampliable sin DDL | Muchas tablas y FK para listas que no cambian |
| B — `VARCHAR` + CHECK para listas fijas; tabla para catálogos | Listas fijas con CHECK; catálogos con atributos en tabla | Lo justo en cada caso | Cambiar una lista fija requiere `ALTER TABLE` |
| C — Tipo ENUM de PostgreSQL | Tipo propio | Compacto | Quitar valores es complicado |

## Decisión

**Elegimos:** B — Valores fijos → `VARCHAR` + CHECK con la lista (en mayúsculas, sin tildes). Catálogos con atributos o que los dueños amplían → tabla.

**Por qué:** Una tabla para cada lista fija agregaría FK sin ganar nada; ENUM es más difícil de modificar.

## Consecuencias

- **Ganamos:** Menos tablas; reglas visibles en el DDL.
- **Aceptamos:** Agregar un estado nuevo es un cambio de DDL (regla 6).
- **Cuándo revisarla:** Si los dueños necesitan crear sus propios motivos o estados.

## Historial

- 28-oct — Tomada y aplicada en la entrega de la base de datos.
- 05-nov — Registrada como DEC al cerrar S5. Redactada por Claude a pedido de Kenry; pendiente de revisión del equipo.
