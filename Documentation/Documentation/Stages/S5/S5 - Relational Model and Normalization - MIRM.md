---
project: "[[Motor IRM]]"
stage: S5
status: ✅ Cerrada (07-nov) — pendiente de revisión del equipo
started: 2026-10-28
finished: 2026-11-07
source: IA (nota de etapa redactada por Claude a pedido de Kenry)
ai_edit: "Claude — 2026-10-28: nota creada (objetivo, acuerdos de la entrega, insumos, entrega del 29-oct y criterio de cierre); PostgreSQL para la entrega y uso local (docente, 28-oct); enlace a la nota del DDL; 2026-10-29: convención de nombres; 2026-11-05: enlaces a DEC-016 a DEC-028; 2026-11-07: cierre de S5 (decisiones D1 a D12, DDL v2, DEC-029 a DEC-035, cambio a TypeScript/Node)"
reviewed: true
---
**[[Motor IRM|← Hub]]** · **[[S4 - Entity-Relationship Model and EER - MIRM|← S4]]** · **[[S5 - Relational Schema - MIRM|Esquema relacional]]**

# S5 - Relational Model and Normalization - MIRM

## Objetivo de la etapa

Traducir el MER/EER a **tablas en 3FN** con sus llaves y restricciones. El modelo relacional es el más fiel a la base de datos: de él sale directamente el **DDL** que escribe el equipo, en **PostgreSQL**: el mismo para la entrega en clase y para el programa.

## Acuerdos y cambios

> [!important] 28-oct — S5 se adelanta por la entrega en clase
> - La base de datos se entrega el **29-oct** en **PostgreSQL**: el docente confirmó el 28-oct que no hace falta SQL Server: PostgreSQL sirve, porque solo pide poder hacer las consultas. Para llegar, S5 se trabaja **antes de cerrar S4** → [[DEC-010 - Advance to S5 Before Closing S4 - MIRM|DEC-010]].
> - **S4 y S5 se cierran como equipo después de la entrega.** Los cambios que salgan de esa revisión (escenarios, decisiones 3 y 6, revisión de la IA) **se asumen**: se corrige el esquema, se registra en el LogBook y se ajusta el DDL (regla 6 del Restart Plan).
> - Para la entrega se usan como definitivas las decisiones provisionales del MER: 3 (arco exclusivo), 6 (saldos iniciales), *Aplicación de pago* y *Cargo externo*.
> - El DDL de entrega lo escriben **dos integrantes**, con el reparto de la §9 del esquema; quien use Windows instala PostgreSQL nativo.
> - **29-oct — Convención de nombres (decisión de Kenry):** la PK de cada tabla se llama `id_<tabla>` y cada FK se llama igual que la PK a la que apunta (`id_<rol>` si hay rol). Aplicada en el DDL y en las consultas; los diagramas y el diccionario del esquema se actualizan al cerrar S5.
> - No hace falta presentar el servidor web del sistema: basta con mostrar que corre en local (docente, 28-oct).

> [!important] 07-nov — Cierre de S5 (decisiones de Kenry sobre la revisión de la IA del 06-nov)
> | # | Decisión | Resultado |
> | --- | --- | --- |
> | D1 | Casos 1 a 3 de normalización | ✅ FK compuestas, sin incluir la cantidad → [[DEC-029 - Controlled Redundancy with Composite Foreign Keys - MIRM\|DEC-029]] |
> | D2 | Caso 4 (semana fija) | ✅ **No** se exige lunes: el periodo de pago es el que el mecánico trabajó ([[SRC-08 - Team Observations Nov 07 - MIRM\|SRC-08]]) → `period_start`/`period_end`, lo pendiente pasa al siguiente pago y el adelanto se compara con lo ganado (aviso, Q21) → [[DEC-030 - Mechanic Pay Period - MIRM\|DEC-030]] |
> | D3 | Caso 5 (`refund_amount`) | ✅ Se conserva (DEC-029) |
> | D4 | `purchase.discount` | ✅ Agregado → [[DEC-031 - Purchase Invoice Discount - MIRM\|DEC-031]] |
> | D5 · D7 · D8 | `clock_timestamp()` · vencimiento obligatorio en compras al crédito · C-15 | ✅ → [[DEC-032 - Integrity Fixes From S5 Review - MIRM\|DEC-032]] |
> | D6 | Zona horaria en el programa | 🟡 **En conversación.** Mientras tanto, la base fija `America/Managua` (no cambia ninguna columna). |
> | D9 | Quién manda en el esquema | ✅ El DDL → [[DEC-034 - DDL as Single Source of Truth - MIRM\|DEC-034]] |
> | D10 | Inicio de sesión | ✅ `staff.username` + `password_hash` → [[DEC-035 - Staff Login Credentials - MIRM\|DEC-035]] |
> | D11 | Índices de FK y coherencia de subclases | ⏭️ Para el 10-dic (DEC-032) |
> | D12 | Quién escribe y prueba el DDL v2 | Claude, por el tiempo (decisión de Kenry). 61 pruebas y 22 consultas, todas correctas. |
> - **Cambio de tecnología:** ya no se usa Django → **TypeScript + Node.js + PostgreSQL**, en local, con API y con ícono de escritorio → [[DEC-033 - Technology Stack Change to TypeScript and Node - MIRM|DEC-033]] (reemplaza a DEC-006).
> - **`03_seed_demo.sql` se perdió:** se rehace con la factura (Kenry la pasa después).
> - Redactado por Claude a pedido de Kenry; pendiente de revisión del equipo.

## Insumos

- [[S4 - ER and EER Model - MIRM|MER/EER v1]] (borrador) y [[S4 - Entity-Relationship Model and EER - MIRM|decisiones de S4]]
- [[Business Rules - MIRM|Business Rules]] · [[Traceability - MIRM|Traceability]]
- [[DEC-006 - Technology Stack - MIRM|DEC-006]] (PostgreSQL para la entrega y para el programa)

## Qué hacer

1. Transformar el MER/EER a tablas con reglas explícitas (entidades, débiles, especializaciones, relaciones 1:1, 1:N y M:N) → decisiones T-01 a T-12.
2. Columnas con dominio, nulos, PK, FK, UQ y CK.
3. **Normalización:** escribir las dependencias funcionales de cada tabla y comprobar 1FN, 2FN y 3FN.
4. Cada BR de **restricción** → dónde se cumple (CK en la base o "va en la aplicación").
5. Cada BR de **derivación** → vista.
6. Orden de creación y reparto del DDL.

## Entrega del 29-oct

- [x] Convenciones de nombres acordadas entre los dos que escriben (§2 del esquema). ✅ 2026-11-05
- [x] DDL en PostgreSQL escrito por el equipo, en dos archivos, con el reparto de la §9 del esquema. ✅ 2026-11-05
- [x] Ejecutado sin errores en PostgreSQL, en el orden de la §9. ✅ 2026-11-05
- [x] Prueba mínima: insertar una fila válida por tabla e intentar romper al menos un `CHECK` y una FK. ✅ 2026-11-05
- [x] Script en el repositorio (`db/postgres/`) y captura del esquema en [[Assets - MIRM|Assets]]. ✅ 2026-11-05

## Resultado

- [[S5 - Relational Schema - MIRM|Esquema relacional v1]] (versión de entrega, 28-oct): decisiones de transformación, convenciones, dominios con su tipo en PostgreSQL, diagramas Mermaid, diccionario por área, restricciones entre tablas, vistas, normalización, orden de creación y pistas para el DDL.
- [[S5 - DDL PostgreSQL - MIRM|DDL PostgreSQL]] **v2 (07-nov)**: copia documentada de `db/postgres/01_schema.sql`, con 61 pruebas.
- [[S5 - Normalization - MIRM|Normalización]]: DF de las 36 tablas; los cinco casos resueltos (07-nov).
- [[S5 - Business Queries - MIRM|Consultas del negocio]]: método, patrones y **22** consultas probadas sobre el DDL v2.
- **Decisiones de transformación (05-nov):** [[DEC-016 - Surrogate Primary Keys - MIRM|DEC-016]] · [[DEC-017 - Billable Document Table Mapping - MIRM|DEC-017]] · [[DEC-018 - Staff Table Mapping - MIRM|DEC-018]] · [[DEC-019 - Inventory Movement Origin Mapping - MIRM|DEC-019]] · [[DEC-020 - Derived Attributes as Views - MIRM|DEC-020]] · [[DEC-021 - Movement Reason Includes Direction - MIRM|DEC-021]] · [[DEC-022 - Price History Without Old Price - MIRM|DEC-022]] · [[DEC-023 - Sale Cancellation Out of Scope - MIRM|DEC-023]] · [[DEC-024 - Exit Cost as Last Cost - MIRM|DEC-024]] · [[DEC-025 - Currency Handling - MIRM|DEC-025]] · [[DEC-026 - Value Lists as Check Constraints - MIRM|DEC-026]] · [[DEC-027 - No Cascade Delete - MIRM|DEC-027]] · [[DEC-028 - Naming Convention for Keys - MIRM|DEC-028]] (redactadas por Claude; pendientes de revisión).
- **Decisiones del cierre (07-nov):** [[DEC-029 - Controlled Redundancy with Composite Foreign Keys - MIRM|DEC-029]] · [[DEC-030 - Mechanic Pay Period - MIRM|DEC-030]] · [[DEC-031 - Purchase Invoice Discount - MIRM|DEC-031]] · [[DEC-032 - Integrity Fixes From S5 Review - MIRM|DEC-032]] · [[DEC-033 - Technology Stack Change to TypeScript and Node - MIRM|DEC-033]] · [[DEC-034 - DDL as Single Source of Truth - MIRM|DEC-034]] · [[DEC-035 - Staff Login Credentials - MIRM|DEC-035]] · fuente [[SRC-08 - Team Observations Nov 07 - MIRM|SRC-08]].

## Criterio de cierre (después del 29-oct)

- [x] Cada tabla tiene sus dependencias funcionales escritas y está en 3FN (o la desnormalización tiene su DEC). ✅ 2026-11-07
- [x] Cada BR de restricción tiene dónde se cumple (base de datos o aplicación). ✅ 2026-11-06
- [x] [[Traceability - MIRM|Traceability]] completa hasta tablas (columna relacional). ✅ 2026-11-06
- [x] Decisiones de transformación T-01 a T-12 registradas como DEC (DEC-016 a DEC-028). ✅ 2026-11-06
- [x] Revisión de la IA respondida (en el chat) y cambios de S4 aplicados al esquema y al DDL. ✅ 2026-11-07

➡️ Siguiente etapa: [[S6 - Object-Oriented Model and Requirements - MIRM]] · después [[S7 - Verification - MIRM]]
