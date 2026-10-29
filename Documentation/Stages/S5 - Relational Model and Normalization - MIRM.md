---
project: "[[Motor IRM]]"
stage: S5
status: 🟡 En progreso — adelantada por la entrega del 29-oct
started: 2026-10-28
finished:
source: IA (nota de etapa redactada por Claude a pedido de Kenry)
ai_edit: "Claude — 2026-10-28: nota creada (objetivo, acuerdos de la entrega, insumos, entrega del 29-oct y criterio de cierre); PostgreSQL para la entrega y uso local (docente, 28-oct); enlace a la nota del DDL"
reviewed: false
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
> - No hace falta presentar el servidor web del sistema: basta con mostrar que corre en local (docente, 28-oct).

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

- [ ] Convenciones de nombres acordadas entre los dos que escriben (§2 del esquema).
- [ ] DDL en PostgreSQL escrito por el equipo, en dos archivos, con el reparto de la §9 del esquema.
- [ ] Ejecutado sin errores en PostgreSQL, en el orden de la §9.
- [ ] Prueba mínima: insertar una fila válida por tabla e intentar romper al menos un `CHECK` y una FK.
- [ ] Script en el repositorio (`db/postgres/`) y captura del esquema en [[Assets - MIRM|Assets]].

## Resultado

- [[S5 - Relational Schema - MIRM|Esquema relacional v1]] (versión de entrega, 28-oct): decisiones de transformación, convenciones, dominios con su tipo en PostgreSQL, diagramas Mermaid, diccionario por área, restricciones entre tablas, vistas, normalización, orden de creación y pistas para el DDL.
- [[S5 - DDL PostgreSQL - MIRM|DDL PostgreSQL]] (en construcción): copia documentada de `db/postgres/01_schema.sql`, con dos tablas de ejemplo probadas (`product`, `billable_document`) y el avance tabla por tabla.

## Criterio de cierre (después del 29-oct)

- [ ] Cada tabla tiene sus dependencias funcionales escritas y está en 3FN (o la desnormalización tiene su DEC).
- [ ] Cada BR de restricción tiene dónde se cumple (base de datos o aplicación).
- [ ] [[Traceability - MIRM|Traceability]] completa hasta tablas (columna relacional).
- [ ] Decisiones de transformación T-01 a T-12 registradas como DEC.
- [ ] Revisión de la IA respondida (en el chat) y cambios de S4 aplicados al esquema y al DDL.

➡️ Siguiente etapa: [[S6 - Object-Oriented Model and Requirements - MIRM]]
