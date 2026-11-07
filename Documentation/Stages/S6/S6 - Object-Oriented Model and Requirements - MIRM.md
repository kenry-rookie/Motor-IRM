---
project: "[[Motor IRM]]"
stage: S6
status: ✅ Cerrada completa (07-nov) — pendiente de revisión del equipo
started: 2026-11-07
finished: 2026-11-07
source: IA (nota de etapa redactada por Claude a pedido de Kenry, a partir de S5, DEC-006, el Restart Plan y la recomendación de tecnologías)
ai_edit: "Claude — 2026-10-27: nota creada con Requirements como pendiente (decisión del equipo); 2026-10-28: insumos y navegación desde S5; 2026-11-05: nota completa (objetivo, conceptos, qué hacer, alcance de la v1 y criterio de cierre); la arquitectura queda en S8 (decisión de Kenry, 05-nov); 2026-11-07: cambio a TypeScript/Node (DEC-033) y S5 cerrada; S6 ligera cerrada (DEC-036); modelo de clases completo"
reviewed: false
---
**[[Motor IRM|← Hub]]** · **[[S5 - Relational Model and Normalization - MIRM|← S5]]** · **[[S5 - Relational Schema - MIRM|Esquema relacional]]** · **[[S5 - DDL PostgreSQL - MIRM|DDL]]** · **[[Requirements - MIRM|📋 Requirements]]**

# S6 - Object-Oriented Model and Requirements - MIRM

## Objetivo de la etapa

Pasar el modelo de datos a **clases del dominio** (las que usará el programa en TypeScript) y escribir los **requisitos** del sistema (pendientes desde S3).

> [!info] Diferencia con S5
> - **S5** respondió *cómo se guardan los datos* (tablas, llaves, restricciones de una fila).
> - **S6** responde *quién hace qué con esos datos*: clases con responsabilidades.
> - Lo que una tabla no puede garantizar sola (todo lo que en [[Traceability - MIRM|Traceability]] dice **"va en la aplicación"**) **se lo tiene que llevar una clase**. Esa es la conexión entre las dos etapas.
> - Cada consulta de [[S5 - Business Queries - MIRM|Business Queries]] es una pregunta que el programa tendrá que responder: piensen qué clase la "sabe" responder.

## Acuerdos y cambios

- **05-nov:** la **arquitectura** (apps de Django, capas, estructura del repositorio, conexión con el DDL) se queda en **S8**, como dice el [[Restart Plan - MIRM|Restart Plan]] (decisión de Kenry).
- S6 se abre **con S5 cerrada** (regla 3). Si algo de S6 cambia una tabla → regla 6: se corrige el esquema y el DDL, y se anota en el LogBook.
- Fechas de entrega: clase (por confirmar con el docente) y negocio (10-dic).
- **07-nov:** S5 cerrada. El programa será **TypeScript + Node.js + PostgreSQL** ([[DEC-033 - Technology Stack Change to TypeScript and Node - MIRM|DEC-033]]), no Django; el DDL manda sobre el esquema ([[DEC-034 - DDL as Single Source of Truth - MIRM|DEC-034]]). Las restricciones "va en la aplicación" las llevan las clases de servicio del programa. *(Agregado por Claude; pendiente de revisión.)*

## Insumos

- [[S5 - Relational Schema - MIRM|Esquema relacional]] (§6: restricciones entre tablas) y [[S5 - DDL PostgreSQL - MIRM|DDL]] (los nombres exactos).
- [[Traceability - MIRM|Traceability]]: columna relacional llena (05-nov); aquí se llena la columna **OO**.
- [[S5 - Business Queries - MIRM|Consultas del negocio]].
- [[S3 - Conceptual Model - MIRM|Modelo conceptual]] (estados y procesos) · [[Diagrama_estados_servicio_mecanico.png|diagrama de estados]].
- [[S4 - ER and EER Model - MIRM|MER/EER]]: escenarios E1 a E9 (son casi los casos de uso).
- [[Business Rules - MIRM|Business Rules]]: 33 de **acción** y 8 de **derivación**.
- [[DEC-011 - Billable Document Superclass - MIRM|DEC-011]] · [[DEC-012 - Staff Disjoint Specialization - MIRM|DEC-012]] · [[DEC-013 - Status Change Weak Entity - MIRM|DEC-013]] · [[DEC-017 - Billable Document Table Mapping - MIRM|DEC-017]] · [[DEC-018 - Staff Table Mapping - MIRM|DEC-018]].
- [[Knowledge - Requisitos de software (FR, NFR y casos de uso)]].

---

## Conceptos que necesitas

| # | Concepto | Qué es, en corto | Por qué importa aquí |
| --- | --- | --- | --- |
| 1 | **Clase vs. tabla** | Una clase tiene datos **y comportamiento**; una tabla solo datos. | `payment_application` es una **clase de asociación** (une pago y documento con un monto). |
| 2 | **Asociación, agregación, composición, herencia** | Formas de relacionar clases, de la más débil a la más fuerte. | Una línea de venta no existe sin su venta (**composición**); un producto sí (**asociación**). Venta, Servicio y Saldo inicial **heredan** de Documento cobrable. |
| 3 | **Responsabilidad** | Lo que una clase **sabe** (atributos) y lo que **hace** (métodos). | Cada BR de acción necesita un "dueño": ¿quién cambia el estado de un servicio?, ¿quién reparte un abono? |
| 4 | **Máquina de estados** | Estados posibles y transiciones permitidas. | DEC-013: las transiciones válidas del servicio se validan en la aplicación. |
| 5 | **Caso de uso** | Lo que un actor logra con el sistema, paso a paso. | Los escenarios E1–E9 ya lo son, contados como historia. |
| 6 | **Diagrama de clases (UML)** | Clases, atributos, métodos y relaciones en un dibujo. | Es el producto principal de esta etapa (Mermaid `classDiagram`). |

---

## Qué hacer

### 1. Requirements (pendiente desde S3)

Llenar [[Requirements - MIRM|Requirements]] siguiendo la nota de Knowledge:

- [ ] **FR** de la versión de clase (venta rápida, inventario, servicios mecánicos, créditos, pago semanal).
- [ ] **NFR** que ya tienen fuente: vender rápido (Q-004), PC con internet (SRC-01), comprobante impreso con formato ajustable y escáner de barras (SRC-06), solo los dueños administran y ven datos de clientes (SRC-06), respaldo diario.
- [ ] **Casos de uso:** Registrar venta, Recibir moto, Cobrar servicio, Registrar compra, Pagar a mecánicos, Cobrar crédito, Puesta en marcha.
- [ ] Columna **Versión 1** (clase) vs. versión del negocio (ver §3).

### 2. Modelo orientado a objetos

1. **Tabla de correspondencia tabla ↔ clase** (36 tablas): nombre de la clase y tipo (entidad, subclase, catálogo, clase de asociación, línea).
2. **Relaciones** con su tipo **justificado**. Pregunta guía: *si borro el todo, ¿la parte tiene sentido sola?*
3. **Responsabilidades:** cada BR de **acción** y de **derivación** → método o vista responsable. Llena la columna **OO** de Traceability.
4. Cada **"va en la aplicación"** de Traceability → qué clase lo controla.
5. **Diagrama de estados** del servicio mecánico (Mermaid `stateDiagram-v2`): 9 estados y solo las transiciones permitidas (incluida EN_PRUEBA → EN_PROCESO, BR-095).
6. **Diagrama de clases** (Mermaid `classDiagram`); uno por área si queda grande, como en S5.

### 3. Alcance de la versión 1 (propuesta: la decide el equipo en la columna *Versión 1*)

| Función | Clase | Negocio (10-dic) |
| --- | --- | --- |
| Iniciar sesión (Dueño, Encargado) | ✅ | ✅ |
| Catálogo de productos y precios | ✅ | ✅ |
| Compra → entra la existencia | ✅ | ✅ |
| Venta rápida con escáner → sale la existencia | ✅ | ✅ |
| Existencia y kárdex | ✅ | ✅ |
| Servicio mecánico con estados, mano de obra y productos | ✅ | ✅ |
| Cobro, crédito y abono | Básico | ✅ |
| Pago semanal con adelantos | Básico | ✅ |
| Comprobante imprimible | Formato fijo | Ajustado a su impresora (Q-075) |
| Devoluciones, garantías, retiros, pagos a proveedores | — | ✅ |
| Saldos iniciales, carga del inventario, respaldos | — | ✅ (con Kenry en el negocio) |

---

## Resultado

> [!important] 07-nov — S6 ligera ([[DEC-036 - Lightweight S6 Before Programming - MIRM|DEC-036]])
> Para empezar a programar: requisitos, servicios y estados.

> [!success] 07-nov (madrugada) — Modelo de clases completo
> Kenry pidió completar el modelo orientado a objetos: [[S6 - Domain Class Model - MIRM|Domain Class Model]] con las 36 clases, herencia, 57 relaciones con su tipo y multiplicidad, 14 enumeraciones y dónde se implementa cada método. DEC-036 queda superada en ese punto.

- [[S6 - Domain Model and Services - MIRM|Domain Model and Services]]: módulos y tablas, servicios y métodos, cada regla de la aplicación con su responsable, estados del servicio mecánico y diagrama de clases de servicios.
- [[Requirements - MIRM|Requirements]]: FR-01 a FR-21, NFR-01 a NFR-09 y UC-01 a UC-08, con columna *Versión 1*.
- [[Traceability - MIRM|Traceability]]: columna OO llena (105 reglas).
- [[S6 - Domain Class Model - MIRM|Domain Class Model]]: **modelo orientado a objetos completo** (clases, atributos, métodos, herencia, relaciones, enumeraciones, diagramas).

## Criterio de cierre

- [x] Requirements con FR, NFR y casos de uso, cada uno con su fuente y su columna *Versión 1*. ✅ 2026-11-07
- [x] Diagrama de clases del dominio completo: cada clase corresponde a una tabla ([[S6 - Domain Class Model - MIRM|Domain Class Model]]). ✅ 2026-11-07
- [x] Cada BR de acción y de derivación tiene su método o vista responsable (columna OO de Traceability). ✅ 2026-11-07
- [x] Cada "va en la aplicación" tiene su clase responsable. ✅ 2026-11-07
- [x] Diagrama de estados del servicio mecánico. ✅ 2026-11-07
- [x] Revisión de la IA respondida (en el chat). ✅ 2026-11-07

➡️ Siguiente etapa: [[S7 - Verification - MIRM]] · Arquitectura y construcción: S8.

## Lecturas

- Mermaid — *Class diagrams*: https://mermaid.js.org/syntax/classDiagram.html · *State diagrams*: https://mermaid.js.org/syntax/stateDiagram.html
- TypeScript — *Classes*: https://www.typescriptlang.org/docs/handbook/2/classes.html
- [[Restart Plan - MIRM|Restart Plan]] §4 (S6) y §5 (cómo pedir la revisión de la IA).
