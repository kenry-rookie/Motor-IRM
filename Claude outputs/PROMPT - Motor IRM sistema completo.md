# Prompt — Motor IRM: sistema completo de repuestos, inventario y taller de motos (v2)

> Cómo usarlo: pégalo completo a un agente de programación (Claude Code u otro) abierto en el repositorio `kenry-rookie/Motor-IRM`. Trabaja **por fases**, con criterios de aceptación medibles y sin rehacer lo que ya funciona. Versión 2 (10-nov-2026): incorpora las correcciones del equipo y las respuestas de los dueños.

---

## 1. Tu rol

Eres el ingeniero principal de producto (full-stack + base de datos + UX) de **Motor IRM**. Tu trabajo es llevar el sistema de "prototipo de clase" a **software profesional que un negocio real usa todos los días**. Decides con criterio, explicas cada decisión importante en una nota `DEC-xxx` y no inventas reglas del negocio: si falta un dato, lo dejas como pregunta abierta (`Q-xxx`) y eliges un valor por defecto seguro y fácil de cambiar.

**Regla de oro de diseño: el usuario no sabe nada de computadoras.** Cada pantalla tiene que entenderse sin explicación, con palabras del negocio, botones visibles y nada escondido.

## 2. El negocio y quién lo usa

- Tienda de **repuestos, accesorios y lubricantes de motos** + **taller mecánico** en el mismo local, en Nicaragua (America/Managua, UTC−6, sin horario de verano). Moneda principal **córdoba (NIO)**; también reciben **dólares (USD)** con el tipo de cambio que fijan los dueños.
- **Usuario principal: los 2 dueños.** No están sentados frente a la computadora: están en el negocio atendiendo. Cuando llega una venta, la registran rápido; cuando llega una moto, la reciben y asignan mecánico. **A veces un dueño repara la moto él mismo, y eso no genera comisión para nadie.**
- **El encargado casi nunca está** (quizá un día cada dos meses). No diseñes alrededor de él, pero el sistema debe permitir **crear un usuario nuevo y elegir sus permisos** para el día en que contraten a alguien.
- **Mecánicos:** el que cobra comisión (60 % de la mano de obra) es el que importa para los pagos. El mecánico "al 100 %" **no se paga por el sistema**; puede registrarse solo para que se sepa qué moto atiende, sin comisión.
- **No todos los clientes traen moto y no todos compran:** hay clientes que solo compran repuestos, otros que solo traen la moto y otros que hacen ambas cosas. La moto es opcional para un cliente.
- Trabajan **rápido**, pero quieren **información confiable**. Se cansan de lo que les parece complicado. Eso no autoriza a hacer algo incompleto: el sistema debe tener todo lo necesario, **presentado de forma simple**.

### Reglas confirmadas (no cambiar sin una DEC)
- En servicios se cobra **mano de obra + insumos**; **un responsable por moto** (mecánico o dueño).
- La **comisión** es solo sobre la mano de obra, solo para mecánicos con porcentaje, nunca para un dueño.
- El pago al mecánico es por **periodo trabajado**; lo no pagado pasa al siguiente pago; **un adelanto no puede pasar de lo ya ganado**.
- El inventario sale al **último costo** (provisional, DEC-024).
- **Régimen de cuota fija: no facturan IVA.** No modelar impuestos.
- **No necesitan numeración autorizada por la DGI**; sí una numeración interna consecutiva.
- **Anulaciones:** solo los dueños, **máximo 3 días** después de la factura.
- **Crédito:** sin límite por ahora (se maneja por confianza), pero debe existir el **ajuste** para poner un límite por cliente o por rol si lo deciden (por ejemplo, un encargado con límite y los dueños sin límite).
- **Mora:** 8 % mensual, **solo cuando un dueño decide aplicarla** a un crédito concreto. Nunca automática.
- **Devoluciones:** casi nunca pasan; el dinero se devuelve **en efectivo, de la caja**.
- **Aceite:** se vende **por unidad** (botellas de litro). En esta versión **todo es por unidades**.
- **Sin precios mayoristas ni de taller:** un solo precio de venta por producto.

## 3. Stack y restricciones (no cambiar)

- **T3:** Next.js (App Router) + React + TypeScript + Tailwind v4 + **tRPC** + **Prisma** + **PostgreSQL 17** en **Docker** (`docker-compose.yml`, puerto 5433).
- **Web local:** corre en la computadora del negocio, que tiene cable de red con internet. Se abre como app de escritorio (**PWA** con ícono). **No se publica en internet**: nada de acceso remoto ni vistas para celulares de los mecánicos.
- **La base de datos es la última línea de defensa:** toda regla expresable en PostgreSQL (CHECK, FK compuestas, UNIQUE, triggers, vistas) va en la base, además de validarse en la app. Es también el proyecto de la clase de Bases de Datos: el SQL debe ser visible y explicable.
- Migraciones **solo** con `prisma migrate dev --create-only` + SQL revisado a mano. **Nunca** `prisma db push`.
- Dinero **siempre** `Decimal`/`NUMERIC`. Instantes en `TIMESTAMPTZ`; días en `DATE`. Cantidades en **unidades enteras**.
- Interfaz en **español de Nicaragua**, claro y corto. Código, tablas y commits en inglés.
- Cada operación de negocio en **una sola transacción**. El cliente nunca manda precios, totales ni el usuario que registra: el servidor los calcula y toma `ctx.user`.

## 4. Lo que ya existe (respétalo y mejóralo)

- Esquema Prisma de 40 tablas + migraciones `0_init`, `1_decisions_api_001_003` (orden de servicio con id propio, `TIMESTAMPTZ`, **stock mantenido por trigger**, kardex de solo inserción), `2_app_session`, `3_fuzzy_search` (`pg_trgm` + `unaccent`).
- Login con sesiones (scrypt, cookie HttpOnly), permisos por rol, traducción de errores de PostgreSQL a español.
- Routers: auth, admin, customer, inventory, sales, service, purchasing, staff, reports. Pruebas de integración con Vitest contra `motor_irm_test` (16 pruebas).
- Interfaz blanca, Caja con pestañas (varios cobros a la vez), búsqueda tolerante a errores, recepción en un paso, Resumen con gráficas.
- Documentación en `Documentation/` (DEC, SRC, BR, Q, bitácora, nota de pendientes). **Léela antes de cambiar reglas.**

## 5. Diagnóstico: huecos y redundancias

### 5.1 Redundancias y contradicciones (resolver primero)
1. **Dos esquemas en el repo:** `db/01_schema.sql` (DDL del equipo) y el esquema Prisma (el que corre). DEC-034 dice que manda el DDL, pero la app usa Prisma. Propón una DEC que reemplace a DEC-034 (recomendado: Prisma + SQL de migraciones como única fuente; `db/` se regenera con `pg_dump --schema-only` para la clase). Borra `db/02_seed_demo.sql` (duplicado viejo de `03`).
2. **Login en dos lugares:** DEC-035 lo pone en `staff`; Prisma usa `app_user`. Deja uno solo (recomendado `app_user`, enlazado 0..1 con `staff`) y actualiza la DEC.
3. **Saldos calculados en TypeScript** (estado de cuenta, cuentas por cobrar y por pagar, comisiones): pásalos a **vistas SQL** (`v_invoice_balance`, `v_customer_balance`, `v_supplier_balance`, `v_mechanic_unpaid_commission`, `v_product_margin`).
4. **Búsqueda duplicada** (`inventory.search`, `listProducts({search})`, `customer.list({search})`): un solo servicio de búsqueda y un solo componente.
5. **`reports.daySummary` y `reports.period` se solapan:** uno solo con periodo; "hoy" es un preset.
6. Selectores de cliente, producto y moto repetidos: un solo `CustomerPicker`, `ProductPicker` y `MotorcyclePicker`.
7. **La recepción crea marcas y modelos de moto escribiéndolos** (find-or-create). Esto permite duplicados ("Bajaj", "bajaj ", "Bajah"). **Quitarlo:** ver §7.4.

### 5.2 Huecos de negocio

**Caja y dinero** (aprobado tal cual)
- **Apertura y cierre de caja:** por defecto **una caja por día** (la abre un dueño en la mañana con un fondo inicial y la cierra en la noche). Ventas por método, abonos, retiros, adelantos y reembolsos; **arqueo** (conteo de billetes y monedas NIO/USD); diferencia faltante/sobrante; quién abrió y quién cerró.
- **Reembolso en efectivo de devoluciones**, que sale de la caja abierta.
- **Anulación de facturas:** solo dueños, máximo 3 días, con motivo obligatorio. Revierte inventario y pagos con movimientos de signo contrario, nunca borrando.
- **Numeración interna consecutiva** de facturas, recibos y notas de crédito (sin huecos, configurable).
- **Cuentas por pagar** con antigüedad (0–30, 31–60, 61–90, +90 días) y vencimientos a proveedores.
- **Crédito:** límite opcional por cliente y por rol en Ajustes (vacío = sin límite); antigüedad de saldos por cliente; botón **"Aplicar mora (8 %)"** por crédito vencido, que solo puede usar un dueño.

**Productos e inventario**
- **Stock mínimo por producto** (hoy el umbral es global = 2) → lista de **reposición sugerida** agrupada por proveedor.
- **Códigos alternos:** varios códigos de barras por producto y el código del proveedor.
- **Ubicación en estantes** (no hay bodega; ver §8.6): estante numerado + nivel de arriba hacia abajo.
- **Costo promedio ponderado** además del último costo, y **margen** por producto.
- **Conteo físico:** hoja de conteo por estante, diferencias y ajuste en bloque con un solo motivo.
- **Cambio de precio masivo** por % y por categoría o marca.
- **Etiquetas con código de barras** para productos sin código (incluyen la ubicación).
- **Productos sin movimiento** y análisis ABC.
- **Fuera de esta versión:** compatibilidad repuesto–modelo de moto, unidades de medida, precios mayoristas o listas de precios.

**Compras a proveedores (hoy es la peor pantalla; rehacerla)** — ver §6.4.

**Taller**
- **El servicio se elige de una lista, no se escribe** (ver §7).
- **Recepción:** se registra lo que realmente miran: **kilometraje** (opcional: las motos nuevas sin circular no tienen), **color** y **número de chasis**. No combustible, no fotos, no firma.
- **Presupuesto** aprobado por el cliente antes de trabajar (opcional por orden).
- **Reserva de repuestos** al asignarlos a una orden (hoy salen del inventario recién al cobrar: DEC-037).
- **Historial de la moto:** servicios, kilometrajes y repuestos usados.
- **Aviso al cliente por WhatsApp** ("su moto está lista"): ver §9.
- **Pago del mecánico revisable** por dueño y mecánico, juntos, en una pantalla clara: órdenes, mano de obra, comisión, adelantos, total.
- Garantías: tienen API pero no pantalla.
- **Fuera de esta versión:** fecha prometida de entrega, recordatorios de mantenimiento, vista del mecánico en celular.

**Usuarios y permisos**
- Pantalla **"Usuarios"** clara para un dueño: crear usuario, elegir a quién pertenece, elegir un **perfil** ("Dueño", "Encargado") y, si hace falta, ajustar permisos uno por uno con palabras simples ("Puede vender al crédito", "Puede anular facturas"…), no con códigos.
- Desactivar un usuario (nunca borrarlo) y restablecer su contraseña.

**Seguridad y operación**
- **Bitácora de auditoría** (`audit_log`: quién, qué, antes/después, cuándo) por trigger en precios, ajustes, anulaciones, créditos, mora, usuarios y permisos.
- Bloqueo tras intentos fallidos de login; cambio de clave obligatorio en el primer ingreso.
- **Respaldos automáticos** (`pg_dump` diario con rotación, botón "Respaldar ahora", restauración documentada).
- Página de **salud del sistema** (base conectada, último respaldo, versión).
- **Importación inicial desde Excel/CSV** (clientes, saldos iniciales, productos con stock y ubicación), con vista previa y validación fila por fila.

## 6. Experiencia de usuario: estándar profesional

### 6.1 Metas de velocidad (criterios de aceptación medibles)
| Tarea | Meta |
|---|---|
| Venta de contado de 1–3 productos con lector de código | **≤ 10 s** |
| Venta buscando el producto con el mouse | **≤ 20 s** |
| Recibir una moto de un cliente conocido | **≤ 20 s** |
| Recibir moto + cliente nuevo | **≤ 45 s** |
| Cambiar el estado o el responsable de una orden | **1 clic** desde el tablero |
| Registrar un abono | **≤ 15 s** |
| Registrar una compra de 10 productos | **≤ 2 min** |

### 6.2 Principios
- **Mouse primero, teclado como atajo.** Todo se puede hacer con clics y botones visibles. Los atajos (F2, F8, F9, Ctrl+K) existen para quien los aprenda, pero **cada atajo tiene su botón real** al lado (por ejemplo, un botón "Buscar" junto al campo de búsqueda, no solo "F2").
- **Botones grandes y con texto**, no solo íconos. Objetivos de clic ≥ 40 px.
- **Siempre se sabe dónde se está y cómo volver:** título de la pantalla, **migas de pan** ("Taller › Orden #12") y botón **"← Volver a …"** en toda pantalla de detalle.
- **Mínimo de campos obligatorios** y **valores por defecto inteligentes**: último método de pago, fecha de hoy, cliente de contado.
- **Nada de cadenas de ventanas.** Crear un cliente o un producto *dentro* del flujo donde se necesita (excepto marcas y modelos de moto: §7.4).
- **Borradores automáticos:** nada se pierde al cambiar de pantalla o recargar (ya existe en Caja; extenderlo a recepción y compras).
- **Confirmación sin bloquear:** avisos breves con **Deshacer** para lo reversible; confirmación clara solo para lo irreversible (anular, cerrar caja, aplicar mora).
- **Errores que dicen cómo arreglarlo**, junto al campo; nunca mensajes técnicos.
- **Ayuda en la pantalla:** textos cortos bajo los campos que lo necesiten; estado vacío que dice qué hacer.
- **Impresión directa:** ticket térmico de 80 mm y tamaño carta; comprobante de recepción de la moto.
- **Accesible:** contraste AA, foco visible, funciona en 1366×768 y en tablet.
- Tema blanco ya definido (rojo de la marca solo en acciones principales; estados verde/ámbar/rojo con texto). Una sola biblioteca de componentes.

### 6.3 Taller (tablero)
- Tablero por estados con tarjetas grandes. **El estado y el responsable se cambian desde la tarjeta** (menú desplegable en la tarjeta) **o arrastrándola** a otra columna. No hace falta entrar a la orden para eso.
- Detalle de la orden con **"← Volver al taller"** y migas de pan.
- El responsable puede ser un **mecánico** o un **dueño**; en la tarjeta se ve quién es y si genera comisión.

### 6.4 Compras a proveedores (rehacer)
- Pantalla de compra a pantalla completa, no un diálogo pequeño.
- **Botón "Ver todos los productos"** que abre el catálogo completo (con buscador, filtros por categoría y marca, y la ubicación), y desde ahí **agregar a la compra con un clic**. En la misma vista, **"+ Producto nuevo"** sin salir de la compra.
- Al agregar un producto, la línea muestra **el último costo pagado a ese proveedor** (y la fecha), **no el precio de venta**, para comparar con el costo nuevo. Si el costo sube o baja, se marca con ▲/▼ y el %.
- Opción de **actualizar el precio de venta** desde la misma línea cuando cambia el costo (mostrando el margen resultante).
- Totales, descuento de la factura y crédito o contado en un panel fijo, como en Caja.
- La lista de **reposición sugerida** de ese proveedor se puede pasar a la compra con un clic.

## 7. Servicios mecánicos: lista primero, sin texto libre sin control

La base no entiende lo que se escribe, pero sí puede obligar a que exista estructura. La app guía.

1. **Al recibir una moto, lo primero es la lista de servicios del negocio** (cambio de aceite, engrase, frenos…) en botones o casillas, agrupados por categoría. Se eligen uno o varios. Se puede añadir una **nota** (por ejemplo, "dice que suena al frenar"), pero la nota nunca reemplaza al servicio.
2. **Si el servicio no está en la lista:** botón **"+ Agregar servicio al catálogo"**, ahí mismo, que pide nombre, categoría y precio de referencia, y que **solo puede usar un dueño** (permiso `catalogos.gestionar`). Así el catálogo crece en orden en lugar de llenarse de texto suelto. **No existe un servicio "Otro" de texto libre.**
3. **Base de datos:**
   - Nueva tabla `service_order_item(service_order_id, service_type_id, notes)`: toda orden **debe** tener ≥ 1 servicio del catálogo (trigger *deferrable* que lo verifica al confirmar la transacción).
   - En `sale_invoice_line`: CHECK `line_type = 'MANO_OBRA' ⇒ service_type_id IS NOT NULL` (salvo las fallas adicionales, que ya apuntan a su falla).
   - `service_type` gana `category` y un **rango de precio** permitido (mín/máx); cobrar fuera del rango pide la clave de un dueño.
4. **Marcas y modelos de moto solo del catálogo:** en la recepción, marca y modelo se **eligen de listas** de lo ya registrado (la base ya lo exige con la FK a `motorcycle_model`). Si no existen, botón **"Registrar marca/modelo"** que abre el apartado de catálogo de motos (solo dueños) y vuelve a la recepción con el borrador intacto. Se elimina el "find-or-create" por texto de `service.receive`.
5. Si lo que se intenta cobrar como mano de obra se parece a un **producto** del inventario, sugerir agregarlo como repuesto.

## 8. Modelo de datos: cambios propuestos (explicar y aprobar antes de migrar)

Cada cambio va con su DEC y su explicación (qué problema resuelve, qué alternativa se descartó). Convención de nombres `pk_`, `fk_`, `uq_`, `ck_`.

1. **Responsable de la orden: mecánico o dueño, con o sin comisión.**
   `staff` gana `kind` (`DUENO`, `MECANICO`, `ENCARGADO`) y `can_repair BOOLEAN`. `commission_rate` sigue siendo opcional: **NULL = no cobra comisión** (dueños y el mecánico al 100 %). CHECK: `kind = 'DUENO' ⇒ commission_rate IS NULL`. En la orden, `applied_commission_rate` queda NULL cuando el responsable no cobra comisión, y la vista de comisiones lo ignora. Hoy la app **exige** porcentaje para asignar: eso se corrige.
2. **Datos de recepción reales:** `motorcycle.chassis_number` (opcional, único sin distinguir mayúsculas) y `service_order.odometer_km` (opcional, ≥ 0). `motorcycle.plate` ya es opcional (motos nuevas).
3. **Servicios de la orden:** `service_order_item` + CHECK de mano de obra (§7.3). `service_type.category`, `min_price`, `max_price` con `ck_service_type_price_range`.
4. **Caja:** `cash_session` (fecha, abrió, cerró, fondo inicial, estado; único por día abierto) y `cash_count` (denominación, cantidad, moneda). Ventas, abonos, retiros, adelantos y reembolsos apuntan a la `cash_session` abierta.
5. **Anulación y reembolso:** `invoice_void` (factura, motivo, dueño, fecha; trigger que rechaza si pasaron más de 3 días o si quien anula no es dueño) y `customer_refund` (devolución, monto, caja).
6. **Ubicación en estantes:** tabla `shelf` (código asignado por el equipo, p. ej. `E01`…`E12`, descripción, cantidad de niveles) + `product.shelf_id` y `product.shelf_level` (1 = el nivel de arriba). Nomenclatura que se imprime en etiquetas y se ve en Caja y Compras: **`E03-N2`** = estante 3, nivel 2 contado de arriba hacia abajo. CHECK: el nivel no puede pasar de los niveles del estante (trigger o FK compuesta).
7. **Último costo por proveedor:** vista `v_supplier_product_last_cost` (de `purchase_invoice_line`). No hace falta tabla nueva.
8. **Crédito y mora:** `customer.credit_limit NUMERIC NULL` (NULL = sin límite), límite por rol en `app_setting`; tabla `late_charge` (crédito, % aplicado, monto, fecha, dueño que la aplicó) para la mora manual del 8 %.
9. **Numeración:** `document_sequence` (tipo de documento, siguiente número) con bloqueo de fila al tomar el número.
10. **Códigos alternos:** `product_code` (producto, código, tipo).
11. **Stock mínimo:** `product.min_stock`. **Conteo físico:** `stock_count` + `stock_count_line`.
12. **Auditoría y ajustes:** `audit_log`, `app_setting` (datos del negocio, tipo de cambio del día, límites, % de mora).
13. Vistas: §5.1.3 + `v_receivables_aging`, `v_payables_aging`, `v_reorder_suggestion`, `v_stock_valuation`, `v_dead_stock`.

**No agregar en esta versión:** IVA o impuestos, unidades de medida, listas de precios, compatibilidad por modelo, fecha prometida, recordatorios, checklist de combustible y fotos.

## 9. Aviso por WhatsApp

- **Fase 1 (recomendada):** botón **"Avisar por WhatsApp"** en la orden. Abre WhatsApp (Web o Escritorio) en la computadora con el mensaje ya escrito, usando un enlace `https://wa.me/505XXXXXXXX?text=…`. El dueño solo presiona Enviar. No cuesta nada, no necesita cuenta de empresa y funciona con internet en la máquina. Mensajes con plantilla editable en Ajustes ("Hola {cliente}, su {moto} ya está lista. Total: {total}. Motor IRM").
- **Fase 2 (evaluar):** **WhatsApp Business Platform (Cloud API de Meta)** para enviar sin intervención. Requiere cuenta de empresa verificada, un número dedicado, plantillas aprobadas por Meta y tiene costo por conversación. Revisar requisitos y precios vigentes antes de decidir; no implementar sin una DEC.
- Registrar cada aviso (orden, fecha, quién) para saber si ya se avisó.

## 10. Reportes (filtrables por periodo y exportables a Excel/PDF)

Ventas por periodo, método de pago, categoría y marca · **utilidad bruta y margen** · productos más y menos vendidos · ABC · sin movimiento · valuación del inventario por estante · reposición sugerida por proveedor · cuentas por cobrar y por pagar con antigüedad · cierre de caja · comisiones por mecánico · trabajo del taller por responsable (incluidos los dueños, sin comisión) · servicios más pedidos · anulaciones, devoluciones y moras aplicadas · auditoría.

## 11. Calidad técnica (no negociable)

- Pruebas de integración por flujo (venta, devolución con reembolso, anulación dentro y fuera de los 3 días, abono, mora, apertura y cierre de caja, recepción → cobro con dueño y con mecánico, compra → devolución, pago a mecánico, conteo físico) contra PostgreSQL real, y E2E con Playwright para los flujos críticos midiendo los tiempos de §6.1.
- `npm run check`, `npm test` y `npm run build` en verde antes de cada commit.
- Cada migración probada en base vacía y con datos; `v_product_stock_mismatch` siempre en 0 filas.
- Sin `any`, sin `float` para dinero, sin lógica de negocio en componentes de React.
- Cada decisión en `Documentation/Decisions/DEC-0xx` (formato existente, `reviewed: false`), y actualizar la nota de pendientes y la bitácora.

## 12. Plan por fases (cada fase funcionando y probada)

1. **Limpieza:** §5.1 y el cambio de responsable mecánico/dueño (§8.1).
2. **Taller:** servicios desde lista y catálogo (§7), marcas y modelos solo de catálogo, km y chasis, tablero con cambio de estado y responsable desde la tarjeta, botón Volver, presupuesto, reserva de repuestos, historial, aviso por WhatsApp (fase 1), pantalla de pago del mecánico.
3. **Compras:** pantalla nueva (§6.4), último costo por proveedor, reposición sugerida.
4. **Caja y dinero:** apertura y cierre de caja, numeración, anulación de 3 días, reembolso, mora manual, límites opcionales.
5. **Inventario:** estantes y niveles, etiquetas, códigos alternos, stock mínimo, conteo físico, costo promedio y margen, cambio de precio masivo.
6. **Usuarios y operación:** pantalla de usuarios y perfiles, auditoría, respaldos, PWA, página de salud, importación desde Excel, reportes de §10.

## 13. Preguntas abiertas (registrar como Q y usar el valor por defecto)
- ¿La caja se abre y se cierra una vez al día, o cada dueño cuenta la caja al cambiar de turno? **Por defecto: una vez al día.**
- ¿Cuántos estantes y cuántos niveles tiene cada uno? (lo define el equipo al visitar el negocio).
- ¿Con qué porcentaje se queda el mecánico del 60 % si un dueño le ayuda en la misma moto? **Por defecto: un solo responsable por orden.**

## 14. Qué NO hacer
- No rehacer desde cero lo que funciona: trigger de stock, CHECK, sesiones y búsqueda ya están probados.
- No agregar librerías grandes sin justificarlas en una DEC.
- No mover reglas de la base a la app "para que sea más fácil".
- No dejar funciones solo con atajo de teclado: todo atajo tiene su botón.
- No implementar nada de la lista "fuera de esta versión".
- No usar datos personales reales en semillas ni pruebas.
- No marcar nada como terminado sin pruebas en verde.
