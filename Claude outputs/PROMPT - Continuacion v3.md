# Prompt de continuación — Motor IRM (v3, 10-nov-2026)

## 1. Dónde quedamos

- Repo `kenry-rookie/Motor-IRM`, carpeta `~/Documents/Motor-IRM`, rama **`modules`** (la rama `feature/docker-db-and-api` quedó intacta para la entrega de clase).
- Último commit: `1e2558d`. Migraciones aplicadas: `0_init` … `5_workshop_catalog_phones_filters`.
- **Hecho (Fase 1 completa + buena parte de 2 y 3):**
  - Responsable de orden mecánico o dueño (`staff.kind`, `can_repair`; dueño sin comisión) — DEC-041.
  - Saldos, comisiones y margen como vistas SQL (`src/server/domain/balances.ts`) — DEC-042.
  - Un solo servicio de búsqueda con filtros en la base (`search` router, `v_product_overview`, `v_customer_overview`, `v_supplier_product`) — DEC-043, DEC-049.
  - Marcas/modelos solo del catálogo — DEC-044. Login solo en `app_user` — DEC-045. Prisma + migraciones como única fuente; `db/01_schema.sql` generado con `npm run db:dump-schema` — DEC-040.
  - **SQL crudo sin fragmentos anidados** (`src/server/domain/sql.ts`): `Prisma.sql/raw/join` dentro de `$queryRaw` llega como jsonb bajo Next/Turbopack — DEC-046. Las pruebas de Vitest NO detectan esto: hay que probar también la app corriendo.
  - Teléfonos 8888-1111 / extranjero en UI, API y CHECK — DEC-047.
  - Trabajos del taller desde catálogo con categorías y rango de precio; `service_order_item` con trigger diferido; km y chasis; tablero con estado/responsable desde la tarjeta y arrastrar; botón Volver; historial de la moto — DEC-048.
  - Guardar permisos pide contraseña — DEC-050. Administración por opciones (`/admin/*`), Personal dentro, **Retiros de caja** aparte (`/retiros`).
  - Compras a pantalla completa (`/compras/nueva`) con catálogo con filtros, último costo por proveedor ▲/▼, precio de venta desde la línea, borrador; proveedores en tabla y ficha.
  - Seed con demo ampliada ficticia e idempotente (`prisma/demo-more.ts`).
- **Pendiente de confirmar:** que `npm test` (27 pruebas) y `npm run build` estén en verde tras el commit `1e2558d`, y **recorrer cada pantalla en la app corriendo** (todavía no se hizo después de la migración 5).

## 2. Cómo trabajar en mi máquina (importante)

- Uso macOS (MacBook Air M4). La app corre en mi Mac: Docker con PostgreSQL 17 en el puerto 5433 y `npm run dev` en `localhost:3000`.
- Tu terminal en mi máquina es una **VM Linux aislada**: sin Docker, sin red y sin poder correr los binarios de macOS. Ahí sí puedes:
  - leer y editar el repo en `$HOME/mnt/Motor-IRM`;
  - revisar tipos y lint en una copia: `rsync` del repo a `$HOME/work` sin `node_modules`, `.next` ni `generated`, con `node_modules` enlazado a los de mi carpeta. Luego `prisma generate --no-engine` (con `PRISMA_SCHEMA_ENGINE_BINARY` y `PRISMA_QUERY_ENGINE_LIBRARY` apuntando a los binarios darwin de `node_modules/@prisma/engines` y `PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1`), `node node_modules/typescript/bin/tsc --noEmit` y `node node_modules/eslint/bin/eslint.js src tests prisma/seed.ts scripts`. **Nunca** generes Prisma dentro de mi carpeta real: rompe mi cliente de macOS.
- El SQL nuevo pruébalo en un PostgreSQL de tu sandbox (si hay uno), aplicando las migraciones 0…N en una base vacía y en una con datos.
- `npm test`, `npm run build`, `npm run db:migrate` y `npm run db:seed` **los corro yo**: dame una sola línea para pegar y te paso la captura.
- Puedes probar la app con el **navegador integrado** en `http://localhost:3000`, entrando con el usuario y la clave de prueba de `.env` (`SEED_ADMIN_*`). No repitas la clave en el chat.
- Git: haz commits en `modules`, agregando solo los archivos que tocaste (**no** uses `git add -A`). La carpeta `Documentation/` está borrada a propósito en mi copia (tengo respaldo): las DEC nuevas van como archivos nuevos (sigue en **DEC-051**). Lo que actualice la bitácora, pendientes o preguntas va en `Documentation/Assets/Registro v2 Fase 1 - MIRM.md` o en una nota nueva.
- Trabaja por tareas con criterios claros, explica cada decisión en una DEC y **no** des nada por terminado sin pruebas en verde y sin revisarlo en la app.

## 3. Qué sigue (en este orden)

1. **Verificar lo hecho:** pruebas, `build` y recorrido por cada pantalla con el navegador (Resumen, Caja, Taller, Recepción, Inventario, Clientes, Compras, Proveedor, Administración y sus opciones, Retiros). Corregir lo que salga.
2. **Fase 4 · Caja y dinero** (lo más importante para el negocio real del 10-dic): apertura y cierre de caja con arqueo NIO/USD, numeración consecutiva interna (`document_sequence`), anulación solo por dueños hasta 3 días con motivo, reembolso desde caja, mora manual del 8 % (`late_charge`), límite de crédito opcional por cliente y por perfil.
3. **Lo que falta de la Fase 2 (taller):** presupuesto aprobado, reserva de repuestos al asignarlos a la orden, aviso por WhatsApp (enlace `wa.me` con plantilla editable y registro de avisos), pantalla de pago del mecánico revisable junto con el dueño, pantalla de garantías.
4. **Fase 5 · Inventario:** estantes y niveles (`E03-N2`), etiquetas con código de barras, códigos alternos, stock mínimo por producto, reposición sugerida por proveedor (y pasarla a la compra con un clic), conteo físico, costo promedio ponderado, cambio de precio masivo.
5. **Fase 6 · Operación:** bitácora de auditoría por trigger, bloqueo tras intentos fallidos y cambio de clave en el primer ingreso, respaldos automáticos con botón «Respaldar ahora», PWA con ícono, página de salud, importación desde Excel con vista previa, reportes exportables (Excel/PDF), impresión de ticket de 80 mm.
6. **Calidad:** E2E con Playwright midiendo los tiempos de §6.1, y una prueba de humo que llame a los endpoints con la app corriendo (para atrapar errores como el de DEC-046).

