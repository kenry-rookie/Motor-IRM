---
project: "[[Motor IRM]]"
date: 2026-11-10
source: IA (Claude, a pedido de Kenry — prompt v2, Fase 1)
reviewed: false
---
# Registro v2 — Fase 1 (limpieza) · 10-nov-2026

> Nota nueva para no pisar tu respaldo de `Documentation/`. Al restaurarlo, copia cada bloque a su nota: **Pendientes de desarrollo**, **Bitácora** y **Preguntas**. Rama de git: `modules`.

## Para «Pendientes de desarrollo» (sección nueva: Prompt v2)

| ID | Tarea | Prioridad | Estado |
| --- | --- | --- | --- |
| V2-001 | Un solo esquema: migraciones de Prisma; `db/01_schema.sql` generado; DDL del equipo a `db/legacy-team-ddl/` | 🔴 Alta | Hecha — DEC-040 |
| V2-002 | Login solo en `app_user` (documentación) | 🟠 Media | Hecha — DEC-045 |
| V2-003 | Saldos, comisiones y margen como vistas SQL | 🔴 Alta | Hecha — DEC-042 |
| V2-004 | Un solo servicio de búsqueda (`search`), un solo reporte (`reports.period`), selectores únicos | 🟠 Media | Hecha — DEC-043 |
| V2-005 | Marca y modelo de moto solo del catálogo; sin «find-or-create» | 🔴 Alta | Hecha — DEC-044 |
| V2-006 | Responsable de la orden: mecánico o dueño; dueño sin comisión; mecánico al 100 % sin porcentaje | 🔴 Alta | Hecha — DEC-041 |
| V2-007 | Fase 2 — Taller (servicios desde lista, km y chasis, tablero, presupuesto, reserva, historial, WhatsApp, pago del mecánico) | 🔴 Alta | Pendiente |
| V2-008 | Fase 3 — Compras (pantalla nueva, último costo por proveedor, reposición) | 🔴 Alta | Pendiente |
| V2-009 | Fase 4 — Caja y dinero | 🔴 Alta | Pendiente |
| V2-010 | Fase 5 — Inventario (estantes, etiquetas, códigos, conteo, costo promedio) | 🟠 Media | Pendiente |
| V2-011 | Fase 6 — Usuarios y operación (perfiles, auditoría, respaldos, PWA, importación, reportes) | 🟠 Media | Pendiente |

**CLI-015** avanza: ya se registran modelos de moto (desde la recepción y Nuevo cliente) y personas del negocio (Personal → Personas del negocio).

## Para la «Bitácora»

### 2026-11-10 — Prompt v2, Fase 1 (Claude a pedido de Kenry)

**Hice:**
- Migración `4_staff_kind_and_balance_views`: `staff.kind` y `staff.can_repair`, reglas de responsable (CHECK + trigger) y 8 vistas de saldos, comisiones, margen y estado de órdenes.
- La API lee los saldos de las vistas (`src/server/domain/balances.ts`); se quitaron los cálculos repetidos en TypeScript.
- Router `search` único; `reports.daySummary` eliminado (Hoy = preset del periodo); selectores unificados en `pickers.tsx` con botón «Buscar» visible.
- Recepción y Nuevo cliente: marca y modelo de listas; un dueño registra el que falte sin salir.
- Personal: pantalla «Personas del negocio» (dueños, mecánicos, encargado; con o sin comisión).
- Seed sin datos personales reales (mecánicos ficticios); el primer dueño queda como persona enlazada al usuario `admin`.
- Pruebas nuevas: dueño responsable sin comisión, mecánico al 100 %, encargado no repara, modelo fuera de catálogo, saldos de vista = estado de cuenta.

**Probado por Claude:** migraciones 0–4 en base vacía y con datos (PostgreSQL 16), reglas nuevas forzadas con SQL directo, `tsc --noEmit` y ESLint sin errores.
**Falta probar en la Mac:** `npm run check`, `npm test`, `npm run build` (PostgreSQL 17 en Docker).

## Para «Preguntas» (numerar según tu nota de Preguntas)

| Pregunta | Valor por defecto mientras tanto |
| --- | --- |
| ¿La caja se abre y se cierra una vez al día, o cada dueño la cuenta al cambiar de turno? | Una vez al día |
| ¿Cuántos estantes hay y cuántos niveles tiene cada uno? | Lo define el equipo al visitar el negocio |
| Si un dueño ayuda al mecánico en la misma moto, ¿cambia el 60 % del mecánico? | Un solo responsable por orden; la comisión es completa del responsable |
