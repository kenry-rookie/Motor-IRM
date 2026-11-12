---
project: "[[Motor IRM]]"
stage: S3
status: ✅ Cerrada
started: 2026-10-22
finished: 2026-10-27
source:
ai_edit: "Claude — 2026-10-27: resultado, cierre, calendario y resolución de observaciones; 2026-10-28: conteos quitados (el único está en el modelo §1) y DEC-008 marcada como superada"
reviewed: true
---
# S3 - Develop a Conceptual Model - MIRM

## Objetivo de la etapa

Es poder comenzar con la primer etapa de modelado de datos. Buscando a definir reglas y requisitos, identificar qué cosas existen y cómo se relacionan.

Se separaran términos que se consideren útiles en la nota [[Glossary - MIRM]] para poder llevar un registro, además, se comenzará a planear el mapa de traceabilidad.

Aquí no surgirán tablas, llaves primarias, eso corresponde a la siguiente etapa, esta etapa busca puramente definir reglas y requisitos, es decir, identificar procesos y posibles estados, todo lo que pueda proveer las entidades, relaciones; posteriormente separar correctamente las entidades y atributos.

También se va a definir otra tabla con calendario para las tareas posteriores conforme a la disponibilidad de la información. Se tiene que discutir correctamente ya las tecnologías a usar para este proyecto.
## Insumos

- [[Assets/Enhanced and Corroborated Domain Statement - MIRM|Enunciado nuevo]]
- [[Sources/SRC-02 - Second Interview Owners - MIRM|Respuestas de dueños]]
- [[Sources/SRC-03 - Mechanic Interview - MIRM|Respuestas de mecánicos]]
- [[SRC-04 - Follow-up Answers Owners - MIRM|SRC-04]] · [[SRC-05 - Owners Answers Oct 26 - MIRM|SRC-05]]
- [[Business Rules - MIRM|Business Rules]] y decisiones DEC-003 a DEC-005
- [[Glossary - MIRM]]
- Recomendaciones de tecnologías para utilizar.
- Arquitectura de software.
## Resultado

- [[S3 - Conceptual Model - MIRM|Modelo conceptual v2.1]]: entidades, atributos, relaciones, estados, 8 procesos, datos derivados y candidatas descartadas (el conteo está en su §1).
- [[Business Rules - MIRM|Business Rules]]: 93 reglas (BR-001 a BR-093).
- [[Traceability - MIRM|Traceability]]: columna conceptual llena para las 93 reglas.
- [[Glossary - MIRM|Glossary]]: 47 términos.
- [[Questions - MIRM|Questions]]: 79 preguntas (10 abiertas pasan a S4).
- Fuentes: [[SRC-04 - Follow-up Answers Owners - MIRM|SRC-04]] · [[SRC-05 - Owners Answers Oct 26 - MIRM|SRC-05]] · [[SRC-06 - Team Observations Oct 27 - MIRM|SRC-06]] (+ agregado en SRC-03).
- Decisiones: DEC-003 · DEC-004 · DEC-005 · [[DEC-007 - Inventory Movement and Cash Withdrawal - MIRM|DEC-007]] · [[DEC-008 - Separate Brand Catalogs and Product Tier - MIRM|DEC-008]] (tomada 28-oct: dos catálogos) · [[DEC-009 - Credit per Operation - MIRM|DEC-009]].
- [[Project Gaps and Technology Recommendations - MIRM|Pendientes]] y [[Technology Recommendations - MIRM|recomendación de tecnologías]].

## Calendario nuevo (27-oct)

| Etapa                                       | Fecha      | Producto                                                                |
| ------------------------------------------- | ---------- | ----------------------------------------------------------------------- |
| S3 — cierre                                 | 27-oct     | Modelo conceptual v2, reglas, decisiones                                |
| S4 — MER/EER                                | 28-oct     | Diagrama formal, generalizaciones con su DEC                            |
| S5 — Relacional y normalización             | 28-oct     | Esquema en 3FN y DDL escrito por el equipo                              |
| Base de datos en **SQL Server** (v1, clase) | 29-oct     | Requisito del docente; primeras consultas en clase                      |
| S6 — Orientado a objetos + **Requirements** | 31-oct     | Clases del dominio; FR, NFR y casos de uso                              |
| Entrega en clase                            | **05-nov** | Programa que funcione (v1)                                              |
| v2 para el negocio (PostgreSQL)             | ≈ 10-dic   | Todo el modelo, carga inicial, puesta en marcha con Kenry en el negocio |

> La fecha de entrega en clase **no cambió** (05-nov). El 13-nov que aparecía en el Hub era un error; la entrega real a los dueños puede ser hasta el 10-dic.

## Cierre

### Criterio de cierre

- [x] Listado de reglas de negocio identificadas, cada una con su fuente. ✅ 2026-10-27
- [x] Requisitos, procesos y estados definidos. → **Procesos y estados ✅** (modelo conceptual §4). **Requisitos → S6** (decisión del equipo, 27-oct). ✅ 2026-10-28
- [x] Reglas, requisitos, procesos y estados se identificarán de forma individual (solo se registrará lo que se complemente como equipo). ✅ 2026-10-27 (revisión del equipo del 26 y 27-oct)
- [x] Un glosario más amplio. ✅ 2026-10-27
- [x] Lista de entidades con sus atributos correspondientes. ✅ 2026-10-27
- [x] Tabla de calendario nuevo. ✅ 2026-10-27
- [x] Tecnologías seleccionadas. → **Pasa a S4** (DEC-006, con la [[Technology Recommendations - MIRM|recomendación]] como insumo). ✅ 2026-10-28

> Se cierra S3 con lo que hay; las dudas y decisiones pendientes pasan a S4. Si al responderlas cambia el diseño, se vuelve brevemente al modelo conceptual o se modela directo sobre el MER.

### Resolución de las observaciones del equipo (Potential Entities, 27-oct)

| Observación | Resolución | Dónde |
| --- | --- | --- |
| Diagrama de estados | Adoptado (con *ESPERA_CLIENTE* y condiciones) | Modelo conceptual §4.1 |
| Marca_moto y Marca_producto (gamas alta, media, baja) | Una sola **Marca** + **gama** como atributo del producto → **superada por DEC-008 (28-oct): dos catálogos**, *Marca_moto* (E-27) y *Marca_producto* (E-28) | DEC-008, E-27, E-28, E-06, BR-089, BR-090 |
| Movimiento de inventario vs. Retiro de caja | Entidades separadas | DEC-007 |
| *Servicio_Mecánico* y no *Reparación* | Renombrada a **Servicio mecánico**; el catálogo pasa a **Tipo de servicio** | E-16, E-17, glosario |
| Deuda de cliente agrupada por separado y derivada, con historial de pagos | Crédito por operación; deuda total derivada en *Cliente* | DEC-009, BR-092, E-01, E-22 |
| Historial de precio | Entra en la versión 1 | E-26, R-37 |
| Atributos derivados en proveedores | Agregados | E-08 |
| Registrar los movimientos iniciales al montar el sistema | Proceso P-08; motivo *inventario inicial*; saldos → Q-078 | Modelo §4.5, Q-072, Q-078 |
| Q-048 corregida | Corregida en SRC-04; BR-043 v2 | SRC-04, BR-043 |
| Requerimientos | Pasan a S6, con nota de Knowledge | S6, [[Knowledge - Requisitos de software (FR, NFR y casos de uso)]] |
| Consumo interno = retiro de caja, no venta | Aplicado | DEC-003 (historial), DEC-007, BR-075 v2, BR-079 v2 |
| Tecnologías: recomendaciones completas y escalables | Nota nueva con planes, precios y opción local | [[Technology Recommendations - MIRM]] |
| Fecha de entrega | 05-nov en clase; ≈ 10-dic a los dueños | Hub, calendario |
| G-1 a G-3 a S4 | Agregadas | [[S4 - Entity-Relationship Model and EER - MIRM|S4]] |
| LogBook | Entradas del 26 y 27-oct | LogBook |
| Foto de factura recibida | Falta guardarla como fuente (SRC-07) | SRC-06 (notas) |
| Privacidad: solo los dueños administran | Restricción en *Personal*; NFR para S6 | E-01, E-02, SRC-06 |
| Formatos de comprobante ajustables + escáner de barras | Código de barras en *Producto*; formato configurable | BR-093, E-06, tecnologías §3 |
| Soporte a 200 km | Nota de Knowledge | [[Knowledge - Soporte y mantenimiento de un sistema en producción]] |
| ¿Python para backend o scripts? Planes, precios, cómo presentarlo | Respondido | Tecnologías §2 y §5 |
| "retiro_efectivo" | Explicado: retiro de caja ≠ adelanto ≠ pago semanal | Modelo conceptual, E-25 |
| Aceite = 1 litro como unidad | Se quita la unidad de medida; Q-079 para otros productos | E-06, E-07 |
| R-08: ¿el catálogo es necesario? | Catálogo de **tipos genéricos** (opcional) | E-16 |
| Q-067, Q-068, Q-071, Q-073, Q-075 | Respondidas (Q-075 sigue abierta) | Questions, BR-083 a BR-088 |

➡️ Siguiente etapa: [[S4 - Entity-Relationship Model and EER - MIRM]]
