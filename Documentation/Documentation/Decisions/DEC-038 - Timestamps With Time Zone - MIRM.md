---
id: DEC-038
project: "[[Motor IRM]]"
stage: S8
status: Tomada
date: 2026-11-08
participants: Kenry
source: IA (redactada e implementada por Claude a pedido de Kenry; resuelve API-002 de "Pendientes de desarrollo")
reviewed: false
---
**[[Motor IRM|← Hub]]** · **[[Pendientes de desarrollo - MIRM|Pendientes]]** · **[[DEC-037 - Service Order Own Id - MIRM|← DEC-037]]** · **[[DEC-039 - Stock Maintained by Trigger - MIRM|DEC-039 →]]**

# DEC-038 — Timestamps With Time Zone

Resuelve **API-002**.

## Contexto

- Las columnas de fecha y hora eran `TIMESTAMP` (sin zona) con `LOCALTIMESTAMP`, que depende de la zona del servidor.
- **Prisma interpreta `TIMESTAMP` sin zona como si fuera UTC.** Una venta a las 17:00 en Managua se habría mostrado a las 11:00. No era solo un riesgo de "si la BD se aloja en otro país": pasaba ya en local.
- Nicaragua es UTC−6 todo el año (sin horario de verano).

## Opciones

| Opción | Cómo funciona | A favor | En contra |
| --- | --- | --- | --- |
| A — Fijar `timezone = 'America/Managua'` en la BD y dejar `TIMESTAMP` | La hora local queda bien en SQL | Cambio mínimo | Prisma igual la lee como UTC: horas corridas en la app |
| **B — `TIMESTAMPTZ` + zona de la BD en Managua** | Se guarda el instante exacto; `CURRENT_DATE` y los `::date` usan la zona de Managua | Correcto en SQL **y** en Prisma | Migrar columnas (sin datos todavía: barato) |

## Decisión

**Elegimos:** B.

- Toda columna de instante es `TIMESTAMPTZ` (`created_at`, `paid_at`, `moved_at`, `returned_at`, `changed_at`, `last_login_at`), con valor por defecto `CURRENT_TIMESTAMP(0)` o `clock_timestamp()`.
- La base guarda `timezone = 'America/Managua'` (`ALTER DATABASE`) y el contenedor arranca con esa zona (`docker-compose.yml`).
- Las columnas `DATE` (vencimientos, días de pago) siguen siendo días de calendario.
- El CHECK `ck_sale_invoice_due_date` convierte con la zona explícita: `(created_at AT TIME ZONE 'America/Managua')::date`.
- En la interfaz: los instantes se muestran en hora de Managua; los días, sin conversión (`src/lib/format.ts`).

**Por qué:** es la única opción en la que la hora es correcta en todos lados.

## Consecuencias

- **Ganamos:** horas correctas aunque la base o el servidor estén en otro país.
- **Aceptamos:** al escribir SQL a mano, comparar días con `AT TIME ZONE 'America/Managua'` cuando importe.

## Historial

- 08-nov — Implementada por Claude a pedido de Kenry; pendiente de revisión del equipo.
