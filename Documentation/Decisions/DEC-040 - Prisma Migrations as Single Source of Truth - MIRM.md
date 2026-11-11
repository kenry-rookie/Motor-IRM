---
id: DEC-040
project: "[[Motor IRM]]"
stage: S8
status: Tomada
date: 2026-11-10
participants: Kenry
source: IA (redactada e implementada por Claude a pedido de Kenry; prompt v2 §5.1.1)
replaces: DEC-034
reviewed: true
---
**[[Motor IRM|← Hub]]** · **[[DEC-034 - DDL as Single Source of Truth - MIRM|← DEC-034 (reemplazada)]]** · **[[DEC-041 - Order Responsible Mechanic or Owner - MIRM|DEC-041 →]]**

# DEC-040 — Prisma Migrations as Single Source of Truth

Reemplaza a [[DEC-034 - DDL as Single Source of Truth - MIRM|DEC-034]].

## Contexto

- DEC-034 decía que manda el DDL del equipo (`db/01_schema.sql`). El 07-nov Kenry eligió que la base en Docker use el esquema de Prisma, y desde entonces la aplicación corre **solo** con `prisma/migrations/`.
- Había dos esquemas en el repositorio que ya no coincidían (por ejemplo, el login estaba en `staff` en el DDL y en `app_user` en Prisma). Dos fuentes = una de ellas miente.
- La clase de Bases de Datos necesita ver el SQL completo en un solo archivo.

## Opciones

| Opción | Cómo funciona | A favor | En contra |
| --- | --- | --- | --- |
| A — Volver al DDL del equipo | Reescribir la app sobre `db/01_schema.sql` | El DDL original se respeta | Días de trabajo; se pierden migraciones, triggers y sesiones ya probadas |
| **B — Migraciones de Prisma + SQL a mano** | `prisma migrate dev --create-only`, se revisa y completa el SQL a mano (CHECK, triggers, vistas); `db/01_schema.sql` se **genera** con `pg_dump --schema-only` | Una sola fuente; el SQL sigue visible y explicable | `db/01_schema.sql` no se edita a mano |

## Decisión

**Elegimos:** B.

- La única fuente del esquema es `prisma/migrations/*/migration.sql` (+ `schema.prisma` para los tipos). Nunca `prisma db push`.
- `db/01_schema.sql` se regenera con `npm run db:dump-schema` (script `scripts/dump-schema.mjs`). Lleva un encabezado que dice que es de solo lectura.
- El DDL y el seed del equipo pasan a `db/legacy-team-ddl/` como historia de la clase. Se borró `db/02_seed_demo.sql` (copia vieja de `03`). En el seed histórico se cambiaron nombres y teléfonos del personal por datos ficticios.

**Por qué:** cumple los criterios de DEC-034 (no perder restricciones, un solo lugar para cambiar una tabla) con el stack que de verdad corre.

## Consecuencias

- **Ganamos:** el esquema que se presenta es exactamente el que usa la aplicación.
- **Aceptamos:** cada migración se revisa a mano; Prisma no conoce CHECK, triggers ni vistas, así que se documentan en el encabezado de `schema.prisma`.
- **Cuándo revisarla:** si se deja de usar Prisma.

## Historial

- 10-nov — Implementada por Claude a pedido de Kenry (prompt v2); pendiente de revisión del equipo.
