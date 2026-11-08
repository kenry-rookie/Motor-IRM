# 🛠️ Pendientes de desarrollo — Motor IRM

> Cómo usar esta nota
> - **Qué guarda:** el trabajo que falta en el código, separado en **API** (servidor: tRPC + Prisma) y **Cliente** (interfaz: Next.js + React).
> - **Punto de partida (07-nov):** el proyecto tenía el esquema completo (`prisma/schema.prisma` + `prisma/migrations/0_init`), un router por área con una sola consulta de ejemplo (`list`) y una página de inicio estática.
> - **08-nov:** base de datos en Docker (`docker-compose.yml`) y la mayoría de tareas resueltas por Claude a pedido de Kenry (ver *Registro 08-nov* al final). `reviewed: false` — el equipo debe revisarlas.
> - **ID:** `API-001`… y `CLI-001`… en orden. **Nunca se reutiliza** un ID, aunque la tarea se descarte.
> - **Depende de:** otra tarea (`API-xxx`) o una pregunta abierta (`Q-xxx` en [[Questions - MIRM|Preguntas]]) que hay que resolver antes.
> - **Cuando se termina:** el estado pasa a *Hecha* y se anota en la bitácora.

**Valores permitidos**
- **Prioridad:** 🔴 Alta (bloquea otras tareas o es riesgo de seguridad/datos) · 🟠 Media (función principal del negocio) · 🟡 Baja (mejora o detalle).
- **Estado:** Pendiente · En progreso · Hecha · Descartada.

---
## Decisiones pendientes (antes de programar los flujos)

| ID | Tarea | Por qué | Prioridad | Depende de | Estado |
| --- | --- | --- | --- | --- | --- |
| API-001 | Decidir si `service_order` sigue compartiendo su `id` con `sale_invoice`, o si tiene id propio y la factura apunta a la orden (`sale_invoice.service_order_id`). | Hoy, para recibir una moto hay que crear antes una factura (con `payment_terms` obligatorio) sin saber el precio, y una orden cancelada deja una factura vacía. Cambiarlo después implica migrar datos. | 🔴 Alta | — | Hecha — [[DEC-037 - Service Order Own Id - MIRM|DEC-037]] |
| API-002 | Decidir el manejo de fechas: `TIMESTAMP` sin zona horaria + `LOCALTIMESTAMP` depende de la zona del servidor. Opciones: fijar `timezone = 'America/Managua'` en la BD, o pasar a `timestamptz`. | Si la BD se aloja en otro país, las horas de ventas y pagos quedan corridas. Es barato decidirlo ahora y caro con datos reales. | 🔴 Alta | — | Hecha — [[DEC-038 - Timestamps With Time Zone - MIRM|DEC-038]] |
| API-003 | Decidir cómo se mantiene `product.stock`: trigger en `inventory_movement` o actualización dentro de la misma transacción en la API. | Es una copia de la suma de movimientos; si se actualiza en dos lugares distintos, se desincroniza. | 🔴 Alta | — | Hecha — [[DEC-039 - Stock Maintained by Trigger - MIRM|DEC-039]] |

---
## API (servidor)

### Base y seguridad

| ID | Tarea | Por qué | Prioridad | Depende de | Estado |
| --- | --- | --- | --- | --- | --- |
| API-004 | Autenticación: login con `app_user.username` + `password_hash` (argon2 o bcrypt), sesión, logout, actualizar `last_login_at`. Poner el usuario en el contexto de tRPC (`ctx.user`). | **Hoy toda la API es pública**: cualquiera que llegue a la app puede leer los datos. | 🔴 Alta | Q-006 | Hecha — scrypt + sesión en `app_session` (cookie HttpOnly) |
| API-005 | `protectedProcedure` + middleware de permisos que lea `role_permission` (códigos tipo `ventas.crear`). Reemplazar `publicProcedure` en todos los routers. | Controlar quién vende, quién autoriza créditos/descuentos, quién ve los pagos al personal. | 🔴 Alta | API-004, Q-008, Q-010 | Hecha — permisos por rol del seed son provisionales (Q-008, Q-010) |
| API-006 | Los campos de auditoría (`created_by_user_id`, `registered_by_user_id`, `received_by_user_id`, etc.) se llenan **siempre** con `ctx.user.id`, nunca desde lo que mande el cliente. | Si vienen del cliente, cualquiera puede registrar operaciones a nombre de otro. | 🔴 Alta | API-004 | Hecha |
| API-007 | Seed (`prisma/seed.ts`): roles, permisos, catálogos iniciales (métodos de pago, motivos de devolución y retiro, categorías) y el primer usuario administrador. | Sin esto no se puede entrar al sistema ni probarlo en una BD nueva. | 🔴 Alta | API-004 | Hecha — `prisma/seed.ts` (+ demo con `SEED_DEMO`) |
| API-008 | Módulo de constantes compartido con los valores permitidos de cada columna con CHECK (`payment_terms`, `line_type`, `movement_type`, `status`, `outcome`, `currency`…) y usarlo en los `z.enum(...)` de las entradas. | En TypeScript esas columnas son `string`; sin esto el contrato no dice qué valores son válidos y el cliente no puede armar los `select`. | 🟠 Media | — | Hecha — `src/server/domain/constants.ts` |
| API-009 | Traducir errores de Postgres (CHECK, FK, unique) a `TRPCError` con mensajes en español entendibles para el usuario. | Hoy un CHECK violado llega como error interno con el nombre técnico de la restricción. | 🟠 Media | — | Hecha — `src/server/api/errors.ts` |
| API-010 | Pruebas de integración contra un Postgres real (contenedor de prueba) para los flujos de venta, devolución, pago e inventario. | Las reglas importantes viven en la BD (CHECK y FK compuestas); solo se pueden probar con una BD real. | 🟠 Media | — | Hecha — `tests/flows.test.ts` (10 pruebas, base `motor_irm_test` en Docker) |

### Flujos del negocio

| ID | Tarea | Por qué | Prioridad | Depende de | Estado |
| --- | --- | --- | --- | --- | --- |
| API-011 | **Inventario:** CRUD de productos, cambio de precio (actualiza `list_price` + inserta en `product_price_history` en una transacción), ajustes (`AJUSTE_ENTRADA/SALIDA` con nota obligatoria) e inventario inicial. | Base de ventas y compras. | 🔴 Alta | API-003 | Hecha |
| API-012 | **Venta en mostrador:** crear factura + líneas + movimientos `VENTA` + stock en **una sola transacción**. Totales y precios se calculan en el servidor (no se confía en el precio que manda el cliente). Descuentos con autorización. | Es la operación más frecuente; si falla a medias, queda inventario o dinero mal. | 🔴 Alta | API-005, API-011 | Hecha — autorización con usuario/clave del dueño en el mismo mostrador |
| API-013 | **Pagos de clientes:** registrar pago + asignaciones a facturas o saldos iniciales. Validar en transacción que la suma asignada ≤ monto del pago y ≤ saldo de cada factura. Tipo de cambio cuando es USD. | Un CHECK no puede validar sumas entre filas; sin esto se puede pagar de más una factura. | 🔴 Alta | API-012, Q-020 | Hecha — reparto en córdobas (DEC-025); Q-020 sigue abierta |
| API-014 | **Cuentas por cobrar:** saldo por factura (total − devoluciones − pagos), saldo por cliente, vencidas (`due_date` / `extended_due_date`), saldos iniciales, cálculo de interés mensual. | Es uno de los problemas principales del negocio (créditos de memoria). | 🟠 Media | API-013, Q-009, Q-021 | Hecha — interés mensual **provisional** (Q-009, Q-021) |
| API-015 | **Órdenes de servicio:** recepción, asignar mecánico, cambios de estado (`service_order_status_change`), fallas adicionales con decisión del cliente, repuestos usados (`USO_SERVICIO`), cierre y facturación, cargo por cancelación. | Segundo flujo principal del negocio. | 🔴 Alta | API-001, API-012, Q-013, Q-019, Q-022 | Hecha — ver DEC-037; Q-013, Q-019, Q-022 pueden ajustar detalles |
| API-016 | **Devoluciones de clientes:** crear devolución desde una factura; validar cantidad devuelta ≤ vendida − ya devuelta; movimientos `DEVOLUCION_CLIENTE`. Definir cómo se registra el reembolso en efectivo (hoy no está en el esquema). | La cantidad acumulada no se puede validar con un CHECK, y el reembolso en dinero no tiene dónde guardarse. | 🟠 Media | API-012, Q-011 | En progreso — devolución hecha; falta dónde registrar el reembolso en efectivo (Q-011) |
| API-017 | **Compras:** CRUD de proveedores, factura de compra + líneas + movimientos `COMPRA`, devoluciones a proveedor (`DEVOLUCION_PROVEEDOR`) con la misma validación de cantidades, pagos a proveedor y saldo (incluye saldo inicial). | Es la entrada de inventario. | 🟠 Media | API-011, Q-018 | Hecha — devoluciones REPOSICION no bajan la deuda (supuesto, confirmar con Q-018) |
| API-018 | **Personal:** cálculo del pago semanal (comisiones de órdenes por `applied_commission_rate` − adelantos del período), marcar como pagado, adelantos, retiros de caja. | Hoy se calcula a mano cada sábado. | 🟠 Media | API-015, Q-017 | Hecha — DEC-030 y BR-103/BR-104 aplicadas |
| API-019 | **Garantías:** registrar reclamo sobre una orden anterior, resultado (cubierto, otra falla, fuera de plazo, reembolso), nueva orden si es otra falla, movimiento `GARANTIA`. | Completa el ciclo de servicio. | 🟡 Baja | API-015, Q-012 | Hecha (solo API) — Q-012 puede ajustar los resultados |
| API-020 | **Catálogos y administración:** CRUD de motivos, métodos de pago, descuentos, tipos de servicio, marcas/modelos, categorías, usuarios, roles y permisos. | Para que el negocio los mantenga sin tocar la BD. | 🟠 Media | API-005 | Hecha (solo API) |
| API-021 | **Búsquedas:** producto por código de barras o nombre, cliente por teléfono o cédula, moto por placa. | El mostrador tiene que ser rápido (objetivo del proyecto). | 🟠 Media | — | Hecha |
| API-022 | **Paginación:** reemplazar el `take: 50` fijo de los routers por paginación con cursor (marcado como `shortcut:` en el código). | Con datos reales las listas crecen y se cortan en 50. | 🟡 Baja | — | Hecha — cursor en todas las listas |
| API-023 | **Reportes:** ventas del día, cierre de caja (cobros − retiros − adelantos), productos con poco stock. | Lo que los dueños revisan a diario; el detalle depende de lo que respondan. | 🟡 Baja | Q-004, Q-007 | Hecha — versión provisional del cierre de caja (Q-004, Q-007) |

---
## Cliente (interfaz)

### Base

| ID | Tarea | Por qué | Prioridad | Depende de | Estado |
| --- | --- | --- | --- | --- | --- |
| CLI-001 | Pantalla de login, manejo de sesión, redirección cuando no hay sesión, logout. | Sin esto no se puede proteger nada. | 🔴 Alta | API-004 | Hecha |
| CLI-002 | Layout con navegación por área (Ventas, Taller, Inventario, Compras, Clientes, Personal); el menú muestra solo lo que el rol puede usar. | Reemplaza la página de inicio estática actual. | 🔴 Alta | CLI-001, API-005 | Hecha |
| CLI-003 | Elegir y montar la base de componentes (formularios, tablas, diálogos), por ejemplo shadcn/ui + react-hook-form con los mismos esquemas Zod de la API. | Todas las pantallas dependen de esto; decidirlo una vez evita estilos mezclados. | 🔴 Alta | — | Hecha — kit propio con Tailwind (`src/app/_components/ui.tsx`), sin shadcn/react-hook-form |
| CLI-004 | Formato de dinero y fechas: montos `Decimal` mostrados en NIO/USD con `Intl.NumberFormat("es-NI")`; **nunca** convertir a `Number` para hacer cuentas. | Los montos llegan como `Decimal` exacto; pasarlos a `float` introduce errores de centavos. | 🔴 Alta | — | Hecha — `src/lib/format.ts` |
| CLI-005 | Mostrar errores de la API: errores de validación Zod en el campo correspondiente del formulario, y el resto como aviso. | El `errorFormatter` de tRPC ya manda `zodError`; falta usarlo en la interfaz. | 🟠 Media | API-009, CLI-003 | Hecha — `src/lib/errors.ts` |

### Pantallas

| ID | Tarea | Por qué | Prioridad | Depende de | Estado |
| --- | --- | --- | --- | --- | --- |
| CLI-006 | **Punto de venta:** buscar producto (lector de código de barras / nombre), carrito de líneas, descuentos con autorización, contado o crédito, cliente opcional en contado, comprobante para imprimir. Pensado para teclado. | La operación más usada; tiene que ser tan rápida como hoy. | 🔴 Alta | API-012, API-021, CLI-003 | Hecha |
| CLI-007 | **Taller:** recepción (buscar o crear cliente y moto), tablero de órdenes por estado, asignar mecánico, fallas adicionales con la decisión del cliente, cierre y cobro. | Segundo flujo principal. | 🔴 Alta | API-015 | Hecha |
| CLI-008 | **Inventario:** lista y ficha de producto, stock, historial de movimientos, ajustes, cambio de precio con historial. | Control de existencias. | 🟠 Media | API-011 | Hecha |
| CLI-009 | **Clientes y motos:** CRUD, estado de cuenta (facturas, pagos, devoluciones, saldo inicial). | Responde "¿cuánto me debe este cliente?". | 🟠 Media | API-014 | En progreso — falta editar cliente, agregar otra moto y saldo inicial desde la ficha (la API ya lo tiene) |
| CLI-010 | **Abonos:** elegir cliente, ver facturas y saldos iniciales pendientes, repartir el pago entre ellos, moneda y tipo de cambio. | Registrar pagos parciales de créditos. | 🟠 Media | API-013 | Hecha |
| CLI-011 | **Devoluciones:** abrir una factura, elegir líneas y cantidades a devolver, motivo. | Afecta saldo e inventario. | 🟠 Media | API-016 | Hecha — botón «Devolución» en la factura |
| CLI-012 | **Compras:** ingreso de factura de compra, devoluciones a proveedor, pagos a proveedor, CRUD de proveedores. | Entrada de inventario y deudas con proveedores. | 🟠 Media | API-017 | En progreso — compras, pagos y proveedores; faltan devoluciones a proveedor y estado de cuenta |
| CLI-013 | **Personal:** pago semanal (detalle de comisiones y adelantos), adelantos, retiros de caja. | Reemplaza el cálculo a mano. | 🟠 Media | API-018 | Hecha |
| CLI-014 | **Garantías:** registrar reclamo desde una orden anterior y su resultado. | Completa el ciclo de servicio. | 🟡 Baja | API-019 | Pendiente |
| CLI-015 | **Administración:** catálogos, usuarios, roles y permisos. | Mantenimiento sin tocar la BD. | 🟠 Media | API-020 | En progreso — catálogos, usuarios y permisos por rol; faltan modelos de moto, tipos de servicio y descuentos (la API ya los tiene) |
| CLI-016 | **Inicio / reportes:** resumen del día (ventas, cobros, órdenes abiertas, poco stock). | Reemplaza la página de inicio estática. | 🟡 Baja | API-023 | Hecha — página de inicio |
| CLI-017 | Confirmar en qué dispositivos se usará (PC de mostrador, celular de los dueños) y adaptar el diseño. | Hoy los dueños trabajan con notas en el teléfono. | 🟡 Baja | Q-006 | Pendiente |

---
## Orden sugerido

1. Decisiones: **API-001**, **API-002**, **API-003**.
2. Seguridad y base: **API-004 → API-005 → API-006 → API-007**, **CLI-001 → CLI-002**, **CLI-003**, **CLI-004**.
3. Inventario (**API-011**, **CLI-008**) → venta (**API-012**, **CLI-006**) → pagos (**API-013**, **CLI-010**).
4. Taller (**API-015**, **CLI-007**) → personal (**API-018**, **CLI-013**).
5. Lo demás según lo que respondan los dueños en las preguntas abiertas.

---
## Registro 08-nov (Claude, a pedido de Kenry — reviewed: false)

- **Docker:** `docker-compose.yml` con PostgreSQL 17 en `localhost:5433`, base `motor_irm` y base de pruebas `motor_irm_test`. `.env.example` ya apunta ahí. Comandos en el README (`npm run db:setup`, `db:reset`, `npm test`…).
- **Migraciones nuevas:** `1_decisions_api_001_003` (DEC-037, DEC-038, DEC-039) y `2_app_session` (sesiones).
- **Verificado en la Mac de Kenry:** migraciones aplicadas, seed cargado, 10/10 pruebas de integración.
- **Siguen pendientes:** API-016 (reembolso), CLI-009, CLI-012 y CLI-015 (partes), CLI-014 (garantías), CLI-017 (dispositivos). Las preguntas abiertas (Q-xxx) pueden cambiar detalles de lo marcado como provisional.
