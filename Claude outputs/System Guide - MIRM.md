---
title: System Guide - MIRM
project: Motor IRM
type: knowledge
created: 2026-11-11
created_by: ai
reviewed: false
tags: [motor-irm, arquitectura, t3-stack, postgresql, prisma, trpc, nextjs]
---

# Guía del sistema — Motor IRM

> Nota hecha por IA (`reviewed: false`). Explica **cómo está construido** Motor IRM: el stack, el recorrido de una petición, la base de datos y dónde vive cada regla del negocio. Las consultas de cada pantalla están en [[SQL Queries by Section - MIRM]].

---

## 1. La idea en una frase

Motor IRM es una **aplicación web** que corre **en la misma computadora** del negocio. El navegador (Safari, en modo app) muestra las pantallas; un **servidor Node.js** (Next.js) recibe las acciones, aplica las reglas y habla con **PostgreSQL**, donde viven los datos y las reglas más importantes.

```
┌─────────────── Computadora del negocio ───────────────────────────┐
│                                                                    │
│  Navegador (Safari app)       Servidor Node.js (Next.js)            │
│  ┌──────────────────┐  HTTP   ┌──────────────────────────────┐      │
│  │ React (pantallas)│ ──────► │ tRPC (API) → reglas → Prisma │      │
│  │ React Query      │ ◄────── │                              │      │
│  └──────────────────┘  JSON   └──────────────┬───────────────┘      │
│                                              │ SQL                  │
│                                   ┌──────────▼───────────┐          │
│                                   │ PostgreSQL 17        │          │
│                                   │ (Docker, puerto 5433)│          │
│                                   └──────────────────────┘          │
└────────────────────────────────────────────────────────────────────┘
```

---

## 2. El stack (T3 Stack), pieza por pieza

| Pieza | Qué es | Para qué la usamos aquí |
|---|---|---|
| **TypeScript** | JavaScript con **tipos** | El compilador detecta errores antes de correr (p. ej. usar un campo que no existe). Todo el proyecto está en TS. |
| **React** | Librería para construir interfaces con **componentes** | Cada pantalla y pieza (botón, tabla, diálogo) es un componente. |
| **Next.js** (App Router) | Framework sobre React que también es **servidor** | Da las rutas por carpetas (`src/app/(app)/facturas/page.tsx` → `/facturas`), compila y sirve la app. |
| **tRPC** | Forma de llamar funciones del servidor **desde el cliente como si fueran locales**, con tipos | `api.sales.create.useMutation()` en la pantalla llama a `sales.create` en el servidor. No hay que escribir URLs ni tipos a mano. |
| **React Query** (TanStack) | Caché de datos en el navegador | Guarda lo que vino del servidor, evita pedirlo dos veces, recarga cuando algo cambia (`invalidate`). tRPC lo usa por dentro. |
| **Zod** | Validación de datos | Cada procedimiento declara qué recibe (`z.object({ amount: zMoney })`). Si llega algo inválido, se rechaza antes de tocar la base. |
| **Prisma** | ORM: traduce código TS a SQL | `db.product.findMany({ where: { active: true } })` → `SELECT … FROM product WHERE active`. También maneja las **migraciones**. |
| **PostgreSQL 17** | La base de datos | Tablas, restricciones (`CHECK`, `UNIQUE`, `FK`), **triggers** y **vistas**. Aquí viven las reglas que nunca se deben romper. |
| **Tailwind CSS** | Estilos con clases utilitarias | `className="rounded-md bg-brand-600 px-4"`. Tema claro/oscuro. |
| **Docker** | Contenedores | Corre PostgreSQL sin instalarlo en la Mac (`docker-compose.yml`). |
| **Vitest** | Pruebas automáticas | `tests/flows.test.ts`: flujos completos contra una base de pruebas. |

**¿Por qué "T3"?** Es una plantilla (`create-t3-app`) que junta Next.js + TypeScript + tRPC + Prisma + Tailwind ya configurados para que se hablen bien.

---

## 3. Las carpetas del proyecto

```
Motor-IRM/
├── prisma/
│   ├── schema.prisma          ← el modelo de datos (tablas → modelos TS)
│   ├── migrations/            ← historial SQL de la base (0_init … 9b_…)
│   ├── seed.ts                ← datos iniciales (roles, permisos, catálogos, admin)
│   ├── demo-more.ts / demo-extra.ts ← datos de prueba
├── src/
│   ├── app/                   ← FRONTEND (pantallas) — Next.js App Router
│   │   ├── (app)/             ← pantallas con menú lateral (requieren sesión)
│   │   │   ├── page.tsx       → /            Resumen
│   │   │   ├── ventas/        → /ventas      Caja
│   │   │   ├── facturas/      → /facturas
│   │   │   ├── taller/        → /taller
│   │   │   ├── inventario/    → /inventario
│   │   │   ├── clientes/      → /clientes
│   │   │   ├── compras/       → /compras
│   │   │   ├── retiros/       → /retiros
│   │   │   ├── pagos/         → /pagos      Pago a mecánicos
│   │   │   └── admin/         → /admin      Administración
│   │   ├── imprimir/          ← factura y recibo para imprimir (sin menú)
│   │   ├── login/
│   │   ├── _components/       ← piezas reutilizables (ui.tsx, pickers, catalog…)
│   │   └── api/trpc/[trpc]/route.ts ← la "puerta" HTTP de tRPC
│   ├── server/                ← BACKEND
│   │   ├── api/
│   │   │   ├── root.ts        ← junta todos los routers
│   │   │   ├── trpc.ts        ← sesión, permisos (permissionProcedure)
│   │   │   ├── errors.ts      ← traduce errores de PostgreSQL a español
│   │   │   └── routers/       ← un router por área (sales, service, inventory…)
│   │   ├── domain/            ← lógica del negocio reutilizable
│   │   │   ├── billing.ts     ← crear factura, líneas, salida de stock, pago
│   │   │   ├── balances.ts    ← saldos (lee las vistas v_*)
│   │   │   ├── search.ts      ← búsqueda tolerante a errores + filtros
│   │   │   ├── commission.ts  ← comisiones de mecánicos
│   │   │   ├── inventory.ts   ← movimientos de kardex
│   │   │   ├── constants.ts   ← valores permitidos y validaciones Zod
│   │   │   └── money.ts       ← cálculos con Decimal (nunca float para dinero)
│   │   ├── auth/              ← contraseñas (hash), sesiones, permisos
│   │   └── db.ts              ← el cliente de Prisma
│   └── lib/                   ← utilidades compartidas (formato de dinero, fechas…)
├── scripts/desktop/           ← lanzador de escritorio, ícono, detener
├── tests/                     ← pruebas (Vitest)
└── docker-compose.yml         ← PostgreSQL en Docker
```

**Regla mental:** `src/app` = lo que se **ve**; `src/server` = lo que se **decide**; `prisma/migrations` = lo que se **garantiza**.

---

## 4. El recorrido de una acción (ejemplo: cobrar en Caja)

1. **Pantalla** (`src/app/(app)/ventas/page.tsx`): el usuario agrega productos y presiona *Cobrar*. El componente llama:
   ```ts
   const create = api.sales.create.useMutation();
   create.mutate({ customerId, lines, terms });
   ```
2. **tRPC cliente** convierte eso en una petición HTTP `POST /api/trpc/sales.create` con el cuerpo en JSON (usando **superjson** para que fechas y decimales viajen bien).
3. **`route.ts`** recibe la petición y se la pasa al router.
4. **`trpc.ts`** revisa la **cookie de sesión**: busca la sesión en `app_session`, carga el usuario y sus **permisos**. `permissionProcedure("ventas.crear")` rechaza si no los tiene.
5. **Zod** valida la entrada (montos con formato correcto, cantidades enteras, etc.).
6. **Router `sales.create`** abre una **transacción** (`db.$transaction`) y llama a `createInvoice` (`domain/billing.ts`):
   - toma los **precios de la base** (nunca confía en el precio que manda la pantalla),
   - inserta `sale_invoice`, sus `sale_invoice_line`,
   - inserta los `inventory_movement` de salida (`VENTA`),
   - si es de contado, inserta `customer_payment` + `customer_payment_allocation`.
7. **PostgreSQL** ejecuta los **triggers**: `tg_inventory_movement_apply_stock` baja `product.stock`; `tg_product_guard_stock` impide stock negativo; `tg_sale_invoice_line_min_price` impide rebajar un producto por debajo de su costo. Si algo falla, **toda la transacción se deshace** (no queda una factura sin su salida de stock).
8. La respuesta vuelve como JSON → React Query la guarda → la pantalla se actualiza y pregunta si imprimir.

> Si PostgreSQL rechaza algo (una restricción `ck_…`, `uq_…`, un trigger), `errors.ts` traduce el nombre de la restricción a un mensaje en español para el usuario.

---

## 5. Dónde vive cada regla (defensa en capas)

Una misma regla suele estar en **tres lugares**, a propósito:

| Capa | Ejemplo (código de barras solo números) | Para qué |
|---|---|---|
| **Pantalla** (React) | El `Input` borra las letras al escribir | Comodidad: el usuario no puede equivocarse |
| **Servidor** (Zod/router) | `zOptBarcode` rechaza con mensaje | Seguridad: aunque alguien llame la API sin la pantalla |
| **Base de datos** (SQL) | `ck_product_barcode CHECK (barcode ~ '^[0-9]{8,14}$')` | Garantía final: **ningún** camino puede guardar un dato inválido |

Reglas que viven **solo o principalmente en PostgreSQL**:
- **Stock** = suma del kardex. Nadie escribe `product.stock`; lo mantiene un trigger (DEC-039). Un movimiento de inventario **no se edita ni se borra** (append-only).
- **Rebaja mínima**: un producto no se puede rebajar por debajo de su último costo.
- **Estados de una orden**: después de `ENTREGADA` o `CANCELADA` no se agrega ningún estado.
- **Anulación de factura**: solo un dueño, máximo 3 días, sin comisión ya pagada.
- **Un dueño no cobra comisión**; un mecánico pagado por el sistema tiene comisión entre 0 y 1 (el "100 %" = sin comisión).
- **Saldos** (lo que debe cada cliente, lo que se le debe a cada proveedor) se **calculan** con **vistas** (`v_invoice_balance`, `v_customer_balance`, `v_purchase_invoice_balance`…); no se guardan, así nunca quedan desactualizados.

---

## 6. La base de datos

### 6.1 Grupos de tablas

| Grupo | Tablas |
|---|---|
| **Seguridad** | `role`, `permission`, `role_permission`, `app_user`, `app_session` |
| **Personas** | `staff` (dueños, mecánicos, encargado), `staff_advance`, `staff_payout` |
| **Catálogos** | `product_category`, `product_brand`, `motorcycle_brand`, `motorcycle_model`, `service_category`, `service_type`, `payment_method`, `return_reason`, `cash_withdrawal_reason`, `discount` |
| **Clientes** | `customer`, `motorcycle`, `customer_opening_balance` (deudas de antes del sistema) |
| **Inventario** | `product`, `product_price_history`, `inventory_movement` (**kardex**) |
| **Ventas** | `sale_invoice`, `sale_invoice_line`, `sale_invoice_void`, `customer_return`, `customer_return_line`, `customer_payment`, `customer_payment_allocation` |
| **Taller** | `service_order`, `service_order_item`, `service_order_status_change`, `additional_fault`, `warranty_claim` |
| **Compras** | `supplier`, `purchase_invoice`, `purchase_invoice_line`, `supplier_return`, `supplier_return_line`, `supplier_payment` |
| **Caja** | `cash_withdrawal` |

### 6.2 Ideas de diseño importantes

- **Nada se borra**: facturas anuladas quedan con su anulación; productos y personas se **desactivan** (`active = false`); los movimientos de inventario son solo-agregar. Así hay **auditoría**: quién, cuándo, por qué.
- **Kardex**: cada entrada/salida es una fila en `inventory_movement` con su tipo (`COMPRA`, `VENTA`, `USO_SERVICIO`, `DEVOLUCION_CLIENTE`, `AJUSTE_ENTRADA`…). El stock es la suma.
- **Pagos con asignación**: un pago del cliente (`customer_payment`) se **reparte** entre facturas o deudas viejas (`customer_payment_allocation`). Un solo abono puede pagar varias facturas.
- **Historial de estados**: el estado actual de una orden es **el último** registro de `service_order_status_change` (vista `v_service_order_status`). Se guarda toda la historia.
- **Instantáneas**: la comisión del mecánico se copia a la orden (`applied_commission_rate`) al asignarla; si luego cambia su porcentaje, las órdenes viejas no cambian.
- **Dinero en `numeric(12,2)`** y en el código con `Decimal`, nunca `float` (los float tienen errores de redondeo: `0.1 + 0.2 ≠ 0.3`).
- **Hora de Managua**: las fechas se guardan como `timestamptz` y los "días" se calculan con `AT TIME ZONE 'America/Managua'` (DEC-038).

### 6.3 Vistas (consultas guardadas)

| Vista | Qué calcula |
|---|---|
| `v_invoice_balance` | Por factura: total, devuelto, pagado, **saldo**, días de atraso, si está anulada |
| `v_opening_balance_remaining` | Deudas de antes del sistema y cuánto queda |
| `v_customer_balance` | Por cliente: deuda total, deuda vencida, máximo atraso |
| `v_customer_overview` | Lo anterior + motos, marcas, última visita (para la lista de Clientes) |
| `v_product_margin` / `v_product_overview` | Último costo, margen %, vendidos en 90 días, proveedores que lo venden |
| `v_purchase_invoice_balance` | Por compra: total, devuelto, pagado, saldo, atraso |
| `v_supplier_balance` | Por proveedor: deuda inicial + compras pendientes |
| `v_service_order_status` | Estado actual de cada orden |
| `v_mechanic_unpaid_commission` | Órdenes entregadas cuya comisión aún no se paga |

### 6.4 Triggers (reglas automáticas)

| Trigger | Qué hace |
|---|---|
| `tg_inventory_movement_apply_stock` | Suma/resta el movimiento a `product.stock` |
| `tg_inventory_movement_append_only` | Prohíbe editar o borrar movimientos |
| `tg_product_guard_stock` | Prohíbe stock negativo |
| `tg_sale_invoice_line_min_price` | Una rebaja no puede dejar el producto por debajo de su costo |
| `tg_service_order_status_guard` | Nada después de ENTREGADA/CANCELADA |
| `tg_service_order_check_responsible` | El responsable debe estar activo y reparar; un dueño sin comisión |
| `tg_service_order_has_items` / `…_keep_one` | Una orden siempre tiene al menos un trabajo |
| `tg_sale_invoice_void_check` | Reglas de anulación (dueño, 3 días, sin comisión pagada) |
| `tg_customer_payment_allocation_not_voided` / `tg_customer_return_not_voided` | Nada nuevo sobre una factura anulada |

### 6.5 Migraciones

Cada cambio a la base es un archivo SQL en `prisma/migrations/<nombre>/migration.sql`. Prisma guarda en la tabla `_prisma_migrations` cuáles ya se aplicaron. `npx prisma migrate deploy` aplica las pendientes **en orden alfabético de nombre** (por eso "10" iría antes que "9": las nuevas se llaman `9a`, `9b`…). **Una migración aplicada no se edita**: se crea otra.

Después de cambiar `schema.prisma` hay que correr `npx prisma generate` para regenerar el **cliente** (los tipos TS que usa el código).

---

## 7. Seguridad y sesión

- **Contraseñas**: se guarda solo un *hash* (`password.ts`), nunca la contraseña.
- **Sesión**: al entrar se crea un token aleatorio; en la base se guarda **su hash** (`app_session`) y al navegador se le da en una **cookie `HttpOnly`** (JavaScript no la puede leer). La cookie es "de sesión del navegador": se borra al cerrar la app. En el servidor dura máximo 14 h.
- **Permisos**: cada rol tiene permisos (`ventas.crear`, `inventario.gestionar`…). Cada procedimiento declara cuál exige. La pantalla oculta botones, pero **quien decide es el servidor**.

---

## 8. Cómo corre en la computadora

- **Desarrollo**: `npm run dev` → `http://localhost:3000`, recarga al guardar archivos.
- **Uso real**: el **lanzador** (`scripts/desktop/motor-irm.sh`, ícono IRM):
  1. abre Docker y levanta PostgreSQL,
  2. `prisma migrate deploy` (migraciones pendientes),
  3. si el código cambió: `prisma generate` + `next build` → carpeta `.next-prod`,
  4. `next start -p 3100` en segundo plano,
  5. abre la app de Safari (`~/Applications/Motor IRM.app`).
- Registro de errores: `~/Library/Logs/MotorIRM/servidor.log`.

---

## 9. Para estudiar (en este orden)

1. **JavaScript → TypeScript**: tipos, `async/await`, promesas, módulos (`import/export`).
2. **SQL y PostgreSQL**: JOIN, GROUP BY, subconsultas, transacciones, vistas, triggers. → [PostgreSQL Tutorial](https://www.postgresql.org/docs/current/tutorial.html)
3. **Cómo funciona la web**: HTTP, JSON, cookies. → [MDN: HTTP](https://developer.mozilla.org/es/docs/Web/HTTP)
4. **React**: componentes, props, estado (`useState`), efectos. → [react.dev/learn](https://react.dev/learn)
5. **Next.js App Router**. → [nextjs.org/docs](https://nextjs.org/docs)
6. **Prisma** (consultas y migraciones). → [prisma.io/docs](https://www.prisma.io/docs)
7. **tRPC + React Query**. → [trpc.io/docs](https://trpc.io/docs)

**Ejercicio sugerido:** sigue una acción de punta a punta (por ejemplo *Registrar pago a mecánico*): pantalla `pagos/periodo/page.tsx` → router `staff.createPayout` → vista `v_mechanic_unpaid_commission`. Escribe con tus palabras qué hace cada paso.
