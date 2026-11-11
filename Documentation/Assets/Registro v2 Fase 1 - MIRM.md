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

---

## Segunda ronda (10-nov, noche) — revisión de Kenry en su Mac

**Errores corregidos**
- Clientes, Compras y Resumen fallaban dentro de la app (no en las pruebas): fragmentos SQL anidados llegaban como JSON → DEC-046.
- Caja se caía con el descuento vacío. «Registrar marca/modelo» cerraba la ventana de recepción.

**Pedidos implementados**
- Administración por opciones (Personas, Pago a mecánicos, Usuarios, Permisos por perfil, Trabajos del taller, Marcas y modelos, Otros catálogos). Personal pasó adentro; **Retiros de caja** es una opción aparte del menú.
- Guardar permisos pide la contraseña de quien guarda → DEC-050.
- Inventario y Clientes con filtros hechos por la base de datos → DEC-049.
- Compras: pantalla completa, «Ver todos los productos» abre el catálogo con filtros, último costo pagado a ese proveedor con ▲/▼, cambio de precio de venta desde la línea, borrador automático. Proveedores en tabla con «qué nos vende» y ficha propia.
- Taller: trabajos elegidos del catálogo (con buscador y categorías; un dueño agrega los que falten), kilometraje, chasis, estado y responsable desde la tarjeta o arrastrando, botón «Volver al taller», historial de la moto → DEC-048.
- Teléfonos con formato 8888-1111 / extranjero → DEC-047.
- Datos de demostración ampliados (42 productos, 4 proveedores con compras, 10 clientes con y sin deuda, ventas y taller), todo ficticio.

**Migración nueva:** `5_workshop_catalog_phones_filters`. **Pruebas nuevas:** trabajos obligatorios, rango de precio, teléfonos, filtros, contraseña en permisos.

---

## Tercera ronda (10-nov, noche) — revisión de Kenry en su Mac

**Corregido**
- Una orden Terminada o En prueba ya no se puede cancelar (pantalla, API y trigger) → DEC-051.
- Caja: cerrar con × una pestaña ya no «gasta» números: la pestaña toma el número libre más bajo («Venta 1», «Venta 2»…), que es solo su nombre, no el de la factura. La única pestaña vacía no muestra ×.
- Caja (cobro del taller): un trabajo sin precio (p. ej. «Diagnóstico», que no tiene precio de referencia) ya no se descarta sin aviso; se pide su precio antes de cobrar.

**Pedidos implementados**
- Caja: «+ Agregar trabajo» abre un panel grande con buscador y categorías, en lugar de alargar la pantalla.
- Caja: sin desplegable de descuento; doble clic en el precio → rebajas de 2/3/5 % u otro precio, nunca bajo el costo → DEC-052.
- Nombre del producto más grande que el control de cantidad.
- Al cobrar, ventana «¿Imprimir factura?»; factura con formato real «Motoservicios y Repuestos Rivera»; recibo de abono imprimible y reimprimible → DEC-053.
- Textos de ayuda quitados: recepción (teléfono, chasis, kilometraje, nota del cliente, responsable), placa de moto nueva y subtítulos de Caja e Inventario.

**Migración nueva:** `6_order_status_guard_min_price` (solo triggers). **Pruebas nuevas:** cancelar orden terminada (API y base), precio rebajado con y sin permiso, precio mayor al normal y bajo el costo (API y base), recibo de abono.

**Probado por Claude:** migraciones 0–6 en base vacía (PostgreSQL 16) y los triggers con SQL directo; `tsc --noEmit` y ESLint sin errores.
**Falta:** `npm run db:migrate`, `npm test`, `npm run build` en la Mac, y el recorrido en la app.

**Pendiente para decidir:** otras pantallas también tienen subtítulos o ayudas (Compras, Retiros, Administración y sus opciones, Resumen, formularios de usuarios). No los toqué: dime cuáles quitar.

**Cuarta ronda (10-nov, 22 h)** → DEC-054
- Pantalla **Facturas**: registro de todo lo cobrado con filtros, totales y reimpresión.
- Caja: «Cobrar» abre «Realizar cobro» (Cobrar / Cancelar); recién después se pregunta si imprimir.
- Administración: opciones como sub-menú en la barra lateral; sin el recuadro.
- Prueba nueva: registro de facturas (filtros, búsqueda sin tilde y por número, totales).

**Quinta ronda (10-nov, 22:30 h)** → DEC-055, DEC-056
- **Anulación de facturas**: solo dueños, hasta 3 días, con motivo; productos de vuelta, efectivo devuelto registrado, saldo 0, sin comisión; reglas en la base. Migración `7_sale_invoice_void`, permiso `ventas.anular`.
- **Pago a mecánicos** como área propia del menú con «Dar adelanto» y «Pagar periodo trabajado».
- Pruebas nuevas: anulación (permiso, motivo, stock, saldo, efectivo, doble anulación, abonos bloqueados, plazo de 3 días).
- Pregunta abierta: al anular la factura de una moto, ¿reabrir la misma orden o recibirla como orden nueva? (por ahora, orden nueva).
