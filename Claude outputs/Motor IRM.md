---
type: project
kind: discovery
status: 🟢 Activo
stage: S8 en curso (construcción); S7 pendiente
next: Entrega de clase (12-nov) y luego Fase 4 · Caja y dinero
resume:
deadline: 2026-11-12
deadline_business: 2026-12-14
repo: https://github.com/kenry-rookie/Motor-IRM (rama modules)
sigla: MIRM
started: 2026-10-17
updated: 2026-11-10
ai_edit: "Claude — 2026-10-28 y 2026-11-01: enlace al MER/EER v1; next, tecnologías (SQL Server en Windows esta semana), DEC-009, modelo v2.1, enlaces a Assets y Archive; esquema relacional de S5 y DEC-010; PostgreSQL y uso local aceptados por el docente; 2026-11-07: cierre de S5, cambio a TypeScript/Node (DEC-033), DEC-029 a DEC-035 y SRC-08; 2026-11-10: tecnologías reales de S8 (Next.js, tRPC, Prisma, PostgreSQL 17 en Docker), DEC-037 a DEC-056 y estado de etapas"
reviewed: false
tags:
  - proyecto
  - portafolio
  - System
---
**[[Projects]]** · **[[010 - Development - MIRM|🛠️ Development]]** · **[[020 - LogBook - MIRM|📓 LogBook]]** · **[[Restart Plan - MIRM|🔁 Restart Plan]]**

# **Motor IRM**

> [!info] Ciclo 2
> Este es el **reinicio** del proyecto. El intento 1 quedó como historia en `First Version/` ([[Motor IRM - First Version]]). El método del ciclo 2 está en [[Restart Plan - MIRM]].
## **Descripción**

**Motor IRM** es un software orientado a la administración de un negocio de motocicletas.

El negocio combina la venta de repuestos, accesorios y lubricantes, además de la prestación de servicios mecánicos. Su operación depende principalmente de la experiencia y memoria de sus propietarios. Actualmente, gran parte de la información relacionada con compras, ventas, inventario, créditos, reparaciones, pagos y administración se maneja mediante procesos manuales, notas en el teléfono y conocimiento personal.

El propósito de Motor IRM es **transformar un negocio administrado mediante experiencia y memoria en un negocio administrado mediante información confiable**, manteniendo la rapidez y simplicidad que caracterizan su forma actual de trabajar.

---
## **Estado del proyecto**

El estado vive en las **propiedades** de esta nota (`stage`, `next`) y el detalle en el [[010 - Development - MIRM|Development]].

---
## Objetivos

 **De análisis y diseño**

- Identificar el flujo de trabajo del negocio.
- Reconocer y formalizar las reglas de negocio para mejorar el control de los datos.
- Realizar un modelado de datos coherente que sirva de base al software.

**Del sistema**

- Centralizar la administración de ventas, inventario, créditos y reparaciones.
- Reducir el tiempo que los propietarios dedican a tareas administrativas.
- Mantener la velocidad con la que opera actualmente el negocio.
- Preservar la integridad y fiabilidad de la información ante futuras actualizaciones y necesidades.

**Del proyecto**

- Desarrollar el software a partir del modelado de datos definido.

---
## **Tecnologías**

### En uso (S8, desde el 08-nov)

La aplicación es una **web local** que corre en la computadora del negocio; la base de datos vive en un contenedor Docker.

| Capa | Tecnología | Nota |
| --- | --- | --- |
| Base de datos | **PostgreSQL 17** (`postgres:17-alpine`) en **Docker Compose**, puerto 5433, zona horaria America/Managua | Extensiones `pg_trgm` y `unaccent` para la búsqueda |
| Esquema | **Migraciones de Prisma** revisadas a mano (`prisma/migrations/0_init` … `7_sale_invoice_void`) | Fuente única del esquema ([[DEC-040 - Prisma Migrations as Single Source of Truth - MIRM\|DEC-040]], reemplaza a DEC-034); `db/01_schema.sql` se genera con `pg_dump` |
| Acceso a datos | **Prisma ORM 6** + SQL explícito para vistas y consultas propias de PostgreSQL | [[DEC-046 - Raw SQL Without Nested Fragments - MIRM\|DEC-046]] |
| API | **tRPC 11** + **Zod** (validación) | Permisos por perfil; el servidor calcula precios y totales |
| Aplicación | **Next.js 15** (App Router) + **React 19** + **TypeScript 5** + **Tailwind CSS 4** | Se abre en `localhost:3000` |
| Pruebas | **Vitest 3** contra una base PostgreSQL real (`motor_irm_test`) | 34 casos de integración |
| Herramientas | Git + GitHub, Docker Desktop, DBeaver, VS Code, `pg_dump` para respaldos | — |

Login con usuario y contraseña en `app_user` (scrypt, sesión con cookie HttpOnly) → [[DEC-045 - Login Only in App User - MIRM\|DEC-045]], reemplaza a DEC-035.

### Historial de la elección

- Prácticas de clase en **SQL Server sobre Windows** (antes de S5).
- **Python + Django + PostgreSQL** ([[DEC-006 - Technology Stack - MIRM|DEC-006]]) — **reemplazada**.
- **TypeScript + Node.js + PostgreSQL** ([[DEC-033 - Technology Stack Change to TypeScript and Node - MIRM|DEC-033]], 07-nov) — se concretó en S8 como Next.js + tRPC + Prisma.

### Por definir

- Empaquetado como app de escritorio con ícono (PWA) → Fase 6.
- Respaldos automáticos diarios y restauración → Fase 6.

---
## **Documentación**

| Etapa | Documento                                                   | Estado                                       |
| ----- | ----------------------------------------------------------- | -------------------------------------------- |
| —     | [[Restart Plan - MIRM]]                                     | 📘 Método del ciclo 2                        |
| —     | [[First Try Review - MIRM]]                                 | 🔍 Revisión del intento 1 (respondida en S0) |
| S0    | [[S0 - Start Of Cycle 2 - MIRM]]                            | ✅ Cerrada (19-oct)                           |
| S1    | [[S1 - Discovery and Interview Preparation - MIRM]]         | ✅ Cerrada (22-oct)                           |
| S2    | [[S2 - Interviews and Elaboration of the Statement - MIRM]] | ✅ Cerrada (23-oct)                           |
| S3    | [[S3 - Develop a Conceptual Model - MIRM]]                  | ✅ Cerrada (27-oct)                           |
| S4    | [[S4 - Entity-Relationship Model and EER - MIRM]]           | ✅ Cerrada (01-nov)                            |
| S5    | [[S5 - Relational Model and Normalization - MIRM]]          | ✅ Cerrada (07-nov)   |
| S6    | [[S6 - Object-Oriented Model and Requirements - MIRM]]      | ✅ Cerrada (07-nov)           |
| S7    | [[S7 - Verification - MIRM]]                                | ⚪ Pendiente (con datos reales, diciembre)    |
| S8    | Arquitectura y construcción                                 | 🟡 En curso (desde 08-nov)                    |

**Decisiones:**
- [[DEC-001 - Sharing information - MIRM|DEC-001]] (compartir documentación en GitHub)
- [[DEC-002 - Reuse Statement From Previous Domain - MIRM|DEC-002]] (reutilizar el enunciado como borrador).
- [[DEC-003 - Internal Work on Own Motorcycle - MIRM|DEC-003]] (trabajo del mecánico en su propia moto).
- [[DEC-004 - No Product Compatibility Record - MIRM|DEC-004]] (no registrar compatibilidad de productos).
- [[DEC-005 - Managua Trip Expenses as Cash Withdrawal - MIRM|DEC-005]] (gastos de viaje como retiro de caja).
- [[DEC-006 - Technology Stack - MIRM|DEC-006]] (Django + Python + PostgreSQL, local, desde el navegador) — **reemplazada por DEC-033**.
- [[DEC-007 - Inventory Movement and Cash Withdrawal - MIRM|DEC-007]] (inventario y caja separados).
- [[DEC-008 - Separate Brand Catalogs and Product Tier - MIRM|DEC-008]] (marcas de moto y de producto separadas, y gama).
- [[DEC-009 - Credit per Operation - MIRM|DEC-009]] (un crédito por operación; el abono va al crédito más antiguo).
- [[DEC-010 - Advance to S5 Before Closing S4 - MIRM|DEC-010]] (S5 se adelanta por la entrega del 29-oct; S4 y S5 se cierran después).
- [[DEC-011 - Billable Document Superclass - MIRM|DEC-011]] (G-1: Documento cobrable como superclase de Venta y Servicio mecánico).
- [[DEC-012 - Staff Disjoint Specialization - MIRM|DEC-012]] (G-2: especialización disjunta de Personal).
- [[DEC-013 - Status Change Weak Entity - MIRM|DEC-013]] (Cambio de estado como entidad débil del Servicio mecánico).
- [[DEC-014 - Exclusive Arc for Inventory Movement Origin - MIRM|DEC-014]] (G-3: arco exclusivo para el origen del movimiento de inventario).
- [[DEC-015 - Opening Balances - MIRM|DEC-015]] (saldos iniciales: subclase para clientes, atributo para proveedores).
- [[DEC-016 - Surrogate Primary Keys - MIRM|DEC-016]] (llaves sustitutas + UQ).
- [[DEC-017 - Billable Document Table Mapping - MIRM|DEC-017]] (tablas del documento cobrable).
- [[DEC-018 - Staff Table Mapping - MIRM|DEC-018]] (tablas del personal).
- [[DEC-019 - Inventory Movement Origin Mapping - MIRM|DEC-019]] (FK del origen del movimiento).
- [[DEC-020 - Derived Attributes as Views - MIRM|DEC-020]] (derivados como vistas).
- [[DEC-021 - Movement Reason Includes Direction - MIRM|DEC-021]] (el motivo incluye la dirección).
- [[DEC-022 - Price History Without Old Price - MIRM|DEC-022]] (historial sin precio anterior; precio actual en producto).
- [[DEC-023 - Sale Cancellation Out of Scope - MIRM|DEC-023]] (anulación de venta fuera de la entrega).
- [[DEC-024 - Exit Cost as Last Cost - MIRM|DEC-024]] (costo de salida = último costo (provisional)).
- [[DEC-025 - Currency Handling - MIRM|DEC-025]] (monedas y tipo de cambio).
- [[DEC-026 - Value Lists as Check Constraints - MIRM|DEC-026]] (listas fijas con CHECK).
- [[DEC-027 - No Cascade Delete - MIRM|DEC-027]] (sin borrado en cascada).
- [[DEC-028 - Naming Convention for Keys - MIRM|DEC-028]] (convención id_tabla).
- [[DEC-029 - Controlled Redundancy with Composite Foreign Keys - MIRM|DEC-029]] (FK compuestas: casos 1 a 3 y 5 de la normalización).
- [[DEC-030 - Mechanic Pay Period - MIRM|DEC-030]] (pago al mecánico por periodo trabajado).
- [[DEC-031 - Purchase Invoice Discount - MIRM|DEC-031]] (descuento de la factura de compra).
- [[DEC-032 - Integrity Fixes From S5 Review - MIRM|DEC-032]] (correcciones de la revisión de S5).
- [[DEC-033 - Technology Stack Change to TypeScript and Node - MIRM|DEC-033]] (TypeScript + Node.js + PostgreSQL; reemplaza DEC-006).
- [[DEC-034 - DDL as Single Source of Truth - MIRM|DEC-034]] (el DDL manda sobre el esquema) — **reemplazada por DEC-040**.
- [[DEC-035 - Staff Login Credentials - MIRM|DEC-035]] (usuario y contraseña en staff) — **reemplazada por DEC-045**.
- [[DEC-036 - Lightweight S6 Before Programming - MIRM|DEC-036]] (S6 ligera antes de programar).
- [[DEC-037 - Service Order Own Id - MIRM|DEC-037]] (la orden de servicio tiene id propio; la factura se enlaza al cobrar).
- [[DEC-038 - Timestamps With Time Zone - MIRM|DEC-038]] (instantes en TIMESTAMPTZ, días en DATE).
- [[DEC-039 - Stock Maintained by Trigger - MIRM|DEC-039]] (stock mantenido por trigger; kardex de solo inserción).
- [[DEC-040 - Prisma Migrations as Single Source of Truth - MIRM|DEC-040]] (migraciones de Prisma como única fuente del esquema; reemplaza DEC-034).
- [[DEC-041 - Order Responsible Mechanic or Owner - MIRM|DEC-041]] (responsable de la orden: mecánico o dueño; el dueño no cobra comisión).
- [[DEC-042 - Balances and Commissions as SQL Views - MIRM|DEC-042]] (saldos, comisiones y margen como vistas SQL).
- [[DEC-043 - One Search, One Report, One Set of Pickers - MIRM|DEC-043]] (un solo servicio de búsqueda, un reporte y un juego de selectores).
- [[DEC-044 - Motorcycle Brands and Models Only From Catalog - MIRM|DEC-044]] (marcas y modelos de moto solo del catálogo).
- [[DEC-045 - Login Only in App User - MIRM|DEC-045]] (login solo en app_user; reemplaza DEC-035).
- [[DEC-046 - Raw SQL Without Nested Fragments - MIRM|DEC-046]] (SQL crudo sin fragmentos anidados).
- [[DEC-047 - Phone Number Format - MIRM|DEC-047]] (formato de teléfono 8888-1111 / extranjero).
- [[DEC-048 - Workshop Jobs From Catalog - MIRM|DEC-048]] (trabajos del taller desde un catálogo con categorías y rango de precio).
- [[DEC-049 - Filters in the Database - MIRM|DEC-049]] (filtros hechos por la base de datos).
- [[DEC-050 - Password to Change Permissions - MIRM|DEC-050]] (guardar permisos pide contraseña).
- [[DEC-051 - Finished Orders Cannot Be Cancelled - MIRM|DEC-051]] (una orden terminada no se cancela).
- [[DEC-052 - Lowered Price Instead of Manual Discount - MIRM|DEC-052]] (precio rebajado en caja, nunca bajo el costo).
- [[DEC-053 - Printed Invoice and Payment Receipt - MIRM|DEC-053]] (factura y recibo de abono imprimibles).
- [[DEC-054 - Invoice Record, Charge Confirmation and Admin Menu - MIRM|DEC-054]] (registro de facturas, confirmar cobro, menú de Administración).
- [[DEC-055 - Invoice Void - MIRM|DEC-055]] (anulación de facturas: solo dueños, 3 días).
- [[DEC-056 - Mechanic Pay as Its Own Area - MIRM|DEC-056]] (Pago a mecánicos como área propia).

**Fuentes:**
- [[SRC-01 - First Conversation - MIRM|SRC-01]] (primera conversación, intento 1).
- [[SRC-02 - Second Interview Owners - MIRM|SRC-02]] (segunda entrevista a los dueños, 23-oct).
- [[SRC-03 - Mechanic Interview - MIRM|SRC-03]] (entrevista a un mecánico, 23-oct).
- [[SRC-04 - Follow-up Answers Owners - MIRM|SRC-04]] (respuestas de seguimiento de los dueños, Q-045 a Q-064, 23-oct).
- [[SRC-05 - Owners Answers Oct 26 - MIRM|SRC-05]] (respuestas de los dueños del 26-oct: reparación cancelada, adelantos, torno, alcance).
- [[SRC-06 - Team Observations Oct 27 - MIRM|SRC-06]] (observaciones del equipo: marcas y gamas, estados, escáner, puesta en marcha).
- [[SRC-07 - Owners Answers Nov 06 - MIRM|SRC-07]] (respuestas de los dueños del 06-nov: vencimientos, contacto y crédito de proveedores, anulaciones).
- [[SRC-08 - Team Observations Nov 07 - MIRM|SRC-08]] (observación de Kenry: periodos de pago de los mecánicos y adelantos).

**Guiones (producto de S1):** [[S1 - Owners Interview Guide - MIRM|Guion de los dueños]] · [[S1 - Mechanic Interview Guide - MIRM|Guion del mecánico]] · [[S1 - Segmented Domain Statement - MIRM|Enunciado segmentado]]

**Modelo (producto de S3):** [[S3 - Conceptual Model - MIRM|Modelo conceptual v2.1]] · [[Technology Recommendations - MIRM|Recomendación de tecnologías]] · [[Project Gaps and Technology Recommendations - MIRM|Pendientes de S3]] (archivada)

**MER/EER (producto de S4):** [[S4 - ER and EER Model - MIRM|MER/EER v1 (borrador)]]

**Esquema relacional (producto de S5):** [[S5 - Relational Schema - MIRM|Esquema relacional v2]] · [[S5 - DDL PostgreSQL - MIRM|DDL v2]] · [[S5 - Normalization - MIRM|Normalización]] · [[S5 - Business Queries - MIRM|Consultas]]

**Enunciado (producto de S2):** [[Enhanced and Corroborated Domain Statement - MIRM|Enunciado ampliado y corroborado]]

**Modelo orientado a objetos (producto de S6):** [[S6 - Domain Class Model - MIRM|Modelo de clases]] · [[S6 - Domain Model and Services - MIRM|Servicios y estados]] · [[Requirements - MIRM|Requirements]]

**Construcción (S8):** [[Registro v2 Fase 1 - MIRM|Registro de las fases]] · `db/01_schema.sql` (esquema generado) · `motor_irm.sql` (base completa para la clase)

**Registros:** [[Glossary - MIRM|Glossary]] · [[Questions - MIRM|Questions]] · [[Business Rules - MIRM|Business Rules]] · [[Requirements - MIRM|Requirements]] · [[Traceability - MIRM|Traceability]].

**Assets y archivo:** [[Assets - MIRM|Índice de Assets]] (imágenes, enunciados y entregables) · `Archive/` (notas del ciclo 2 que ya cumplieron su función).



