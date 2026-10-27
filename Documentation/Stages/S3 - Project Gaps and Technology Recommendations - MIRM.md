---
project: "[[Motor IRM]]"
stage: S3
type: review
date: 2026-10-26
source: IA (revisión de toda la carpeta del proyecto y recomendación de tecnologías, redactada por Claude a pedido de Kenry)
reviewed: false
---
**[[Motor IRM|← Hub]]** · **[[S3 - Develop a Conceptual Model - MIRM|← S3]]** · **[[S3 - Conceptual Model - MIRM|Modelo conceptual]]** · **[[010 - Development - MIRM|🛠️ Development]]**

# S3 - Project Gaps and Technology Recommendations - MIRM

> [!warning] Hecho por IA — pendiente de revisión del equipo
> Parte A: lo que falta o se está olvidando registrar, después de revisar **toda** la carpeta del proyecto el 26-oct. Parte B: una recomendación de tecnologías **para discutir**; la decisión la escribe el equipo en DEC-006.

---

# Parte A — Lo que falta o se está olvidando registrar

**Prioridad:** 🔴 bloquea el avance o puede causar pérdida de información · 🟠 afecta la confianza en un resultado · 🟡 orden y claridad.

## A.1 Fuentes y evidencia

| # | Qué falta | Dónde | Prioridad | Qué hacer |
| --- | --- | --- | --- | --- |
| 1 | Las respuestas de los dueños del 26-oct estaban dentro de *Potential Entities*, sin fuente. Es el mismo patrón que hizo perder la primera entrevista (W-07). | Potential Entities | 🔴 | ✅ Hecho: [[SRC-05 - Owners Answers Oct 26 - MIRM\|SRC-05]]. A futuro: **toda respuesta de los dueños va primero a una `SRC`**, aunque sea de dos líneas. |
| 2 | Propiedades incompletas: entrevistador, entrevistados y medio. | SRC-01 (casi todas), SRC-02 y SRC-03 (*interviewees*), SRC-04 y SRC-05 (*interviewer*, *medium*) | 🟠 | Completarlas: sin eso no se sabe a quién volver a preguntar. |
| 3 | Respuesta cortada de Q-048 ("ellos registran lo que se hizo como…"). | SRC-04 | 🟠 | Completar o volver a preguntar: afecta a R-04 del modelo. |
| 4 | Interpretación de Q-065: la respuesta dice "descuentos" y la pregunta era sobre adelantos. | SRC-05 | 🟡 | Confirmar al revisar SRC-05. |

## A.2 Registros

| # | Qué falta | Dónde | Prioridad | Qué hacer |
| --- | --- | --- | --- | --- |
| 5 | **Requirements está vacía**: ningún FR, NFR ni caso de uso. Es criterio de cierre de S3 ("Requisitos, procesos y estados definidos") y define el **alcance** del programa. | Requirements | 🔴 | Escribir al menos los FR de la versión 1 (ver B.5) y los NFR que ya tienen fuente: vender rápido (Q-004), computadora con internet siempre (SRC-01), teléfono opcional (SRC-01), comprobante impreso (SRC-01), dos dueños y un encargado (Q-006). |
| 6 | Hay preguntas 🔴 abiertas que cambian el modelo: **Q-069** (¿un crédito agrupa varias operaciones?) y **Q-072** (inventario inicial). | Questions | 🔴 | Preguntarlas antes de S4. |
| 7 | Siguen abiertas desde S1: Q-002 (contacto de proveedores), Q-003 (vencimiento), Q-005 (qué quieren ver del comprobante), Q-057 (líquido de barra), Q-066 (marca del producto). | Questions | 🟠 | Q-005 define el comprobante, que es lo primero que verán los dueños. |
| 8 | Las 82 reglas siguen en **Borrador**: ninguna está *Validada* por los dueños. La puerta S2/S3 del Restart Plan pide validarlas. | Business Rules | 🟠 | Una llamada corta leyendo las reglas de los temas D, F y G (taller, mecánicos, créditos), que son las que más cambian el modelo. |
| 9 | Contenido nuevo sin revisar (`reviewed: false`): enunciado ampliado, DEC-003, Glossary, Questions, Traceability, SRC-04, SRC-05, Potential Entities, modelo conceptual y esta nota. | Varias | 🟠 | Repartir la revisión entre los tres. |
| 10 | El "punto a revisar" de DEC-003 (¿consumo interno o venta?) sigue sin respuesta. El modelo ya lo registra como venta (BR-055). | DEC-003 | 🟡 | Confirmarlo y marcar `reviewed`. |

## A.3 Decisiones

| # | Qué falta | Prioridad | Qué hacer |
| --- | --- | --- | --- |
| 11 | **DEC-006 (tecnologías)** no existe y es criterio de cierre de S3. | 🔴 | Kenry la escribe (insumo: Parte B). |
| 12 | **Cambio de fecha de entrega:** el Hub dice `deadline: 2026-11-13`, pero DEC-002 y DEC-004 dicen 05-nov, y no hay ninguna nota que explique el cambio. | 🔴 | Registrarlo en el LogBook (fecha, quién lo dijo, por qué) y en el calendario nuevo. Es información que cambia todas las prioridades. |
| 13 | La discusión *Movimiento de inventario vs. Retiro de caja* tiene resultado en el modelo (son dos entidades), pero falta su decisión. | 🟠 | DEC-007. |
| 14 | Las generalizaciones (G-1 a G-3 del modelo conceptual) necesitarán su DEC en S4. | 🟡 | Anotarlo para S4. |

## A.4 Seguimiento del proyecto

| # | Qué falta | Dónde | Prioridad | Qué hacer |
| --- | --- | --- | --- | --- |
| 15 | **LogBook sin entradas desde el 23-oct.** Falta la sesión del 26-oct (discusión de entidades y respuestas de los dueños). *Aprendí* está vacío en las dos entradas del 23-oct. | LogBook | 🟠 | Escribirlo hoy (regla de S0: el mismo día). |
| 16 | **Calendario nuevo** pendiente (criterio de cierre de S3). El de S0 ya no sirve. | S3 | 🔴 | Ver propuesta en B.6. |
| 17 | Hub (`next`) y Development (*Próxima tarea*) desactualizados. La nota de S3 no lista como insumos SRC-04, SRC-05 ni Business Rules. | Hub, Development, S3 | 🟡 | ✅ Actualizados los enlaces; el texto de próxima tarea lo ajusta el equipo con el calendario. |
| 18 | S4 no tiene insumos escritos. | S4 | 🟡 | Insumos: modelo conceptual, Business Rules, Traceability, decisiones. |
| 19 | Sincronización con GitHub (DEC-001): lo que el equipo edita en el repositorio no llega solo al vault. | DEC-001 | 🟠 | Antes de cada reunión, comprobar que el vault y el repositorio coinciden. |

## A.5 Cosas del negocio que nadie ha pedido todavía (y harán falta)

| # | Qué falta | Por qué importa | Prioridad |
| --- | --- | --- | --- |
| 20 | **Datos reales:** lista de productos con precios, categorías, mecánicos con su porcentaje, proveedores. | S7 (verificación) los necesita, y sin ellos el sistema arranca vacío. Pedirlos **ya**, porque los dueños tardan en responder. | 🔴 |
| 21 | **Conteo inicial del inventario** (Q-072). | Sin existencias iniciales, el cálculo de existencia (BR-020) da números falsos desde el primer día. | 🔴 |
| 22 | **Respaldo de la información.** | Si la base de datos se pierde, se pierde todo lo que hoy está en la memoria de los dueños. Es un NFR. | 🟠 |
| 23 | **Privacidad:** se guardarán cédula, teléfono y dirección de clientes con crédito. | NFR de seguridad: solo los dueños deberían ver esos datos. | 🟠 |
| 24 | **Impresora** para los comprobantes (Q-075). | Define el formato del comprobante (hoja o ticket). | 🟡 |
| 25 | **Quién da soporte** después de la entrega, estando a 200 km. | Afecta dónde se instala el sistema (B.4). | 🟠 |

---

# Parte B — Recomendación de tecnologías

## B.1 Lo que condiciona la elección

| Condición | Fuente |
| --- | --- |
| Aplicación **web**, base de datos **PostgreSQL**. | Hub (asignado por el docente) |
| Entrega el **13-nov** (por confirmar, A.3 #12): quedan unas **dos semanas y media**, y todavía faltan S4 a S7. | Hub |
| Equipo de tres estudiantes, con poca experiencia programando. | — |
| Es el proyecto de **Bases de Datos**: el diseño, el DDL, las restricciones y las vistas tienen que verse y escribirse a mano. | Curso |
| Una computadora en el negocio, con internet siempre; teléfono opcional. Comprobantes impresos. | SRC-01 |
| Lo que más esperan los dueños: **vender más rápido**. | SRC-05 (Q-004) |
| El negocio queda a 200 km: actualizar y dar soporte a distancia. | DEC-002 |
| Debe poder crecer después (se seguirá usando en clases y mejorando para los dueños). | Equipo |

## B.2 Opciones

| | **A — Django + plantillas (HTMX)** | **B — FastAPI + React** | **C — Next.js (Node/TypeScript)** |
| --- | --- | --- | --- |
| Lenguaje | Python | Python (servidor) + JavaScript (interfaz) | TypeScript |
| Cómo funciona | Un solo proyecto: el servidor arma las páginas. HTMX actualiza partes de la página sin recargarla (útil para la pantalla de venta). | Dos proyectos: una API en Python y una interfaz React aparte que la consume. | Un proyecto con interfaz y servidor en el mismo lenguaje. |
| Viene incluido | Usuarios, contraseñas, permisos por grupo (Dueño, Encargado), formularios, panel de administración para catálogos, migraciones. | Validación de datos y documentación automática de la API. El resto (login, permisos, formularios) se arma a mano. | Rutas y páginas. Lo demás con librerías. |
| Tiempo hasta un programa que funcione | **El más corto.** | Medio-largo: dos proyectos, autenticación, CORS, estado de la interfaz. | Medio, pero hay que aprender el lenguaje. |
| Visibilidad del SQL propio (curso) | Buena si se usa **su propio DDL** (ver B.3). | Muy buena (SQL directo con psycopg). | Baja si se usa un ORM como Prisma. |
| Encaja con la ruta de aprendizaje Python + PostgreSQL | ✅ | ✅ | ❌ |
| Riesgo con el tiempo disponible | 🟢 Bajo | 🟠 Medio | 🔴 Alto |

## B.3 Recomendación

**Opción A — Django + plantillas con HTMX + PostgreSQL**, con estas condiciones:

1. **El esquema de la base de datos lo escriben ustedes en SQL** (DDL en archivos versionados en el repositorio, por ejemplo `db/01_schema.sql`, `db/02_views.sql`). Django se conecta a esas tablas con modelos `managed = False`, o aplica los archivos con migraciones `RunSQL`. Así el trabajo de Bases de Datos queda **visible y propio**: tablas, `CHECK`, llaves foráneas, vistas para existencia, saldos y comisiones.
2. **Los datos derivados** del modelo conceptual (§6) van como **vistas** en PostgreSQL, no calculados en Python. Es la parte del curso que más luce y garantiza que todos vean el mismo número.
3. **React queda para la versión 2**, si hace falta una interfaz más rica o una app para teléfono. Con la API que se puede agregar después, nada se pierde.
4. **El panel de administración de Django** sirve para los catálogos (productos, categorías, proveedores, personal) sin programar pantallas. El tiempo se invierte en las pantallas que importan: **venta rápida**, **reparación** y **pago semanal**.

**Por qué no B ahora:** React es una buena tecnología y está en "probables", pero significa construir y conectar **dos** aplicaciones, con login, permisos y manejo de errores en las dos, en dos semanas y media y aprendiendo a la vez. El riesgo es llegar al 13-nov con una interfaz bonita y la mitad de las funciones.

**Si el equipo prefiere B igual:** FastAPI + psycopg (SQL escrito por ustedes) + React con Vite, y recortar el alcance a lo *Imprescindible* de B.5.

## B.4 Herramientas de apoyo

| Necesidad | Recomendación | Por qué |
| --- | --- | --- |
| PostgreSQL en la Mac (desarrollo) | **Postgres.app** o **Docker** con `docker compose` | Postgres.app es lo más simple en macOS; Docker deja la misma versión para los tres. |
| Ver y probar la base | **pgAdmin** o **DBeaver** | Para escribir y probar el DDL y las consultas antes de programar. |
| Código y documentación | **Git + GitHub** (ya existe por DEC-001) | Una rama por función y *pull requests* revisados por otro compañero. |
| Entorno de Python | `venv` + `requirements.txt` | Que los tres tengan las mismas versiones. |
| Pruebas | Pruebas de Django / `pytest` y **datos reales** (A.5 #20) | S7 pide probar el modelo con datos reales. |
| Comprobante | Página con estilos de impresión (CSS `@media print`) | Funciona con cualquier impresora; si es de tickets (Q-075), se ajusta el ancho. |
| Respaldos | `pg_dump` programado | NFR de respaldo (A.5 #22). |
| Dónde instalarlo | **Para la clase:** local o en la nube. **Para el negocio:** en la nube con PostgreSQL administrado, porque permite actualizar y dar soporte a 200 km. | Comparar planes y precios vigentes antes de decidir; no dejarlo para la última semana. |

## B.5 Alcance sugerido para la versión 1

Ordenado por lo que pidieron los dueños (vender más rápido) y lo que hoy se pierde:

| Prioridad | Función | Entidades |
| --- | --- | --- |
| **Imprescindible** | Venta rápida con búsqueda de producto, comprobante impreso y existencia actualizada | E-06, E-07, E-13, E-14, E-21 |
| **Imprescindible** | Registrar compras (factura → entradas, costo, precio) e inventario inicial | E-08 a E-10, E-07 |
| **Imprescindible** | Reparaciones: recepción, estado, detalle, fallas adicionales, cobro | E-01, E-03, E-04, E-17 a E-19, E-21 |
| **Imprescindible** | Créditos y sus pagos | E-22, E-21 |
| **Imprescindible** | Pago semanal de mecánicos con adelantos | E-02, E-23, E-24 |
| Si da tiempo | Retiros de caja, devoluciones de cliente, reclamos de garantía, pagos a proveedores | E-11, E-15, E-20, E-25 |
| Versión 2 | Historial de precios, catálogo de servicios, devoluciones a proveedor con resolución, reportes avanzados, app para teléfono | E-12, E-16, E-26 |

## B.6 Calendario (propuesta para discutir)

| Etapa | Fechas | Producto |
| --- | --- | --- |
| S3 — cierre | mar 27-oct | Revisión del modelo conceptual, Requirements v1, DEC-006, DEC-007, calendario aprobado |
| S4 — MER/EER | 28 – 29-oct | Diagrama formal, generalizaciones con su DEC |
| S5 — Relacional y normalización | 30-oct – 2-nov | Esquema en 3FN y **DDL escrito por el equipo** |
| S6 — Orientado a objetos | 3-nov | Clases del dominio (las que usarán los modelos de Django) |
| S7 — Verificación | 4 – 5-nov | Base cargada con datos reales y consultas de prueba |
| S8 — Construcción | 5 – 12-nov | Funciones *Imprescindibles* de B.5 |
| Entrega | 13-nov | |

> En paralelo desde S4, **una persona** puede preparar el proyecto vacío (repositorio, Django, PostgreSQL, login con roles). Eso no depende del modelo y le ahorra días a S8.

## B.7 Lecturas

- Django: tutorial oficial (partes 1 a 4) → https://docs.djangoproject.com/ — y en particular "Integrating Django with a legacy database" (cómo usar tablas que ya existen).
- HTMX: documentación → https://htmx.org/docs/
- PostgreSQL: capítulos *Data Definition* (DDL y restricciones) y *Views* → https://www.postgresql.org/docs/current/
- Si eligen B: FastAPI → https://fastapi.tiangolo.com/ y React → https://react.dev/learn

Después de leer, una pregunta para el equipo: ¿qué se pierde y qué se gana si la existencia de un producto se calcula con una **vista** en PostgreSQL en vez de guardarse como un número que el programa actualiza?
