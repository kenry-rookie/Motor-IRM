---
id: DEC-034
project: "[[Motor IRM]]"
stage: S5
status: Tomada
date: 2026-11-07
participants: Kenry
source: IA (redactada por Claude a pedido de Kenry; adaptada de la recomendación D9, hecha para Django, al cambio a TypeScript/Node de DEC-033)
reviewed: false
---
**[[Motor IRM|← Hub]]** · **[[S5 - DDL PostgreSQL - MIRM|DDL]]** · **[[DEC-033 - Technology Stack Change to TypeScript and Node - MIRM|← DEC-033]]** · **[[DEC-035 - Staff Login Credentials - MIRM|DEC-035 →]]**

# DEC-034 — DDL as Single Source of Truth

## Contexto

- Kenry aceptó la recomendación D9 (el DDL manda sobre el esquema). Después el equipo cambió a TypeScript + Node.js ([[DEC-033 - Technology Stack Change to TypeScript and Node - MIRM|DEC-033]]).
- En Node.js, varios ORM (Prisma, TypeORM, Sequelize) generan el esquema con **sus propias migraciones**; ninguno representa bien todo lo que tiene el DDL (CK de varias columnas, índices sobre `lower()`, FK compuestas con `MATCH SIMPLE`, arco exclusivo).
- Es el proyecto de **Bases de Datos**: el SQL propio debe ser visible.

## Criterios

1. No perder ninguna restricción probada (61 pruebas, 07-nov).
2. Un solo lugar donde cambiar una tabla.
3. Poco tiempo antes del 11-nov.

## Opciones

| Opción | Cómo funciona | A favor | En contra |
| --- | --- | --- | --- |
| A — El ORM manda (migraciones del ORM) | Se reescriben las 36 tablas en el formato del ORM | Tipos generados | Días de trabajo; se pierden o se reescriben a mano las CK y FK compuestas |
| **B — El DDL manda** | `db/postgres/01_schema.sql` crea la base; el programa solo **usa** las tablas | Todo lo probado se conserva; SQL visible | Los tipos de TypeScript se escriben o se generan leyendo la base |

## Decisión

**Elegimos:** B — El DDL es la única fuente de verdad del esquema.

- Archivos versionados en `db/postgres/`: `01_schema.sql` (tablas), después `02_views.sql` (vistas de §7) y los datos.
- Si una tabla cambia: se cambia el `.sql`, se prueba, se copia a la [[S5 - DDL PostgreSQL - MIRM|nota del DDL]] y se ajusta el programa (regla 5 del Restart Plan).
- El programa **no** crea ni altera tablas. Cómo accede a la base (driver `pg` con SQL, o un *query builder* que lea el esquema existente) se decide en S8.

**Por qué:** cumple los tres criterios.

## Consecuencias

- **Ganamos:** las restricciones de la base protegen los datos aunque el programa tenga un error.
- **Aceptamos:** los errores de restricción llegan al programa como errores de PostgreSQL (código `23503` FK, `23505` UQ, `23514` CHECK); la API los traduce a mensajes para el usuario.
- **Cuándo revisarla:** si el equipo adopta un ORM que pueda trabajar sobre una base existente sin migraciones propias.

## Historial

- 06-nov — Recomendada como D9 (versión Django: `managed = False` + `inspectdb`).
- 07-nov — Aceptada por Kenry y adaptada a TypeScript/Node. Redactada por Claude a pedido de Kenry; pendiente de revisión del equipo.
