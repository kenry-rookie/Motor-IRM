---
id: DEC-006
project: "[[Motor IRM]]"
stage: S4
status: Tomada (el docente aceptó PostgreSQL y el uso local, 28-oct)
date: 2026-10-28
participants: Devans, Gustavo, Kenry
source: IA (redactada por Claude a pedido de Kenry, con lo decidido por el equipo)
ai_edit: "Claude — 2026-10-28: enlace corregido e historial; respuestas del docente (sin SQL Server, sin presentar el servidor web)"
reviewed: true
---
**[[Motor IRM|← Hub]]** · **[[S4 - Entity-Relationship Model and EER - MIRM|S4]]** · **[[Technology Recommendations - MIRM|Recomendación de tecnologías]]** · **[[DEC-005 - Managua Trip Expenses as Cash Withdrawal - MIRM|← DEC-005]]** · **[[DEC-007 - Inventory Movement and Cash Withdrawal - MIRM|DEC-007 →]]**

# DEC-006 — Technology Stack

## Contexto

- El docente asignó una **aplicación web**. La base de datos de clase se entrega el **29-oct** y el programa debe funcionar el **05-nov**.
- **28-oct (respuestas del docente):** no hace falta SQL Server, PostgreSQL sirve (solo pide poder hacer las consultas); y no hace falta presentar el servidor web del sistema, basta con mostrar que corre en local.
- La versión para el negocio se entrega aproximadamente el **10-dic**, y después se seguirá desarrollando (v3). Kenry dará soporte en el negocio.
- El equipo tiene poca experiencia programando; la ruta de aprendizaje de Kenry es Python + PostgreSQL.
- La PC del negocio tiene buenas especificaciones e internet siempre. Comprarán un escáner de código de barras; la impresora no está decidida.
- Es el proyecto de **Bases de Datos**: el diseño y el SQL deben ser propios y visibles.
- Análisis completo: [[Technology Recommendations - MIRM]] y Parte B de [[Project Gaps and Technology Recommendations - MIRM]].

## Criterios

1. Llegar al **05-nov** con un programa que funcione.
2. Que **una sola persona** pueda mantenerlo después (soporte de Kenry).
3. Que el **SQL propio** (DDL, restricciones, vistas) sea visible.
4. Que pueda **crecer** después de la entrega sin rehacerlo.
5. **Costo** bajo o nulo para los dueños.
6. Cumplir lo que pide el docente: aplicación **web**.

## Opciones

| Opción | Cómo funciona | A favor | En contra |
| --- | --- | --- | --- |
| **A — Django + Python + PostgreSQL** | Un solo proyecto: Django es el servidor y arma las páginas | Usuarios, permisos, formularios y panel de administración incluidos; un solo lenguaje; encaja con la ruta Python + PostgreSQL | Interfaz menos "moderna" que una SPA (se compensa con HTMX si hace falta) |
| B — FastAPI + React + PostgreSQL | Una API en Python y una interfaz React aparte | Interfaz rica; separación clara | Dos aplicaciones que construir y conectar; login y permisos a mano; mucho riesgo con el tiempo disponible |
| C — Next.js (Node/TypeScript) | Interfaz y servidor en TypeScript | Un solo lenguaje | Lenguaje nuevo para el equipo; el ORM esconde el SQL |

**Forma de abrirla (para A):**

| Opción | Cómo se ve | Comentario |
| --- | --- | --- |
| **1 — Navegador, instalada como app** | Ícono en el escritorio; ventana propia sin barra de direcciones | Sin código extra; funciona sin internet; otros aparatos del WiFi pueden usarla |
| 2 — Ventana nativa (pywebview + PyInstaller, `.exe`) | Programa con su propia ventana | Más mantenimiento; PostgreSQL aparte igual; antivirus |
| 3 — App de escritorio pura (Tkinter/PyQt) | Sin navegador | Rehacer la interfaz; deja de ser web |

**Comparación con los criterios**

| Criterio | A | B | C |
| --- | --- | --- | --- |
| 1. Llegar al 05-nov | ✅ | ⚠️ | ❌ |
| 2. Lo mantiene una persona | ✅ | ⚠️ | ⚠️ |
| 3. SQL propio visible | ✅ | ✅ | ❌ |
| 4. Crecer después | ✅ | ✅ | ✅ |
| 5. Costo | ✅ | ✅ | ✅ |
| 6. Aplicación web | ✅ | ✅ | ✅ |

## Decisión

**Elegimos:** **A — Django + Python + PostgreSQL**, ejecutándose **en local** y abierta **desde el navegador, instalada como aplicación (opción 1)**. Es lo que el equipo presentará al docente.

| Pieza | Elección |
| --- | --- |
| Lenguaje | Python |
| Framework (servidor e interfaz) | Django, con plantillas HTML; HTMX como apoyo opcional para la pantalla de venta (se decide al construir) |
| Base de datos (entrega del 29-oct y programa) | PostgreSQL |
| Esquema | DDL escrito por el equipo, en archivos versionados (`db/postgres/`). Django usa esas tablas (`managed = False` o migraciones `RunSQL`). |
| Datos derivados | Vistas en la base de datos (existencia, saldos, comisiones, deudas) |
| Forma de uso | Navegador, instalada como aplicación (ícono y ventana propia) |
| Servidor en la PC | Django como servicio que arranca solo, con un servidor de producción (por ejemplo, Waitress en Windows), no `runserver` |
| Comprobante | Plantilla HTML con CSS `@media print`; formato configurable (A4 o ticket) |
| Escáner de barras | Campo de búsqueda siempre activo (el escáner USB funciona como teclado) |
| Usuarios | Sistema de usuarios de Django con grupos *Dueño* y *Encargado* |
| Respaldos | `pg_dump` programado diario |
| Herramientas | Git + GitHub, `venv` + `requirements.txt`, DBeaver o pgAdmin (PostgreSQL), Docker o Postgres.app |

**Por qué:** es la única opción que cumple los seis criterios. React (antes en "probables") queda descartado por ahora: dos aplicaciones en una semana es el mayor riesgo para el 05-nov.

## Margen: lo que puede cambiar con el docente

| Si el docente pide… | Qué hacemos | ¿Cambia esta DEC? |
| --- | --- | --- |
| Que se use **solo desde el navegador**, sin instalar como app | Se abre en una pestaña normal. No cambia nada técnico: la opción 1 ya es el navegador. | No |
| Que el **programa** use **SQL Server** (no solo la entrega del 29-oct) | Django se conecta con `mssql-django`; se usa el DDL de `db/sqlserver/`. Las vistas y restricciones se traducen. | Sí → DEC nueva |
| Que se **publique en internet** (no local) | Se despliega en la nube (por ejemplo, Render) sin cambiar el código. | Sí → DEC nueva (alojamiento) |
| Otra tecnología obligatoria (framework o lenguaje) | Se evalúa contra los mismos criterios. | Sí → DEC nueva |

## Consecuencias

- **Ganamos:** un solo lenguaje y un solo proyecto; usuarios, permisos y administración incluidos; SQL propio visible; funciona sin internet; crecer después sin rehacer (API con Django REST Framework o Django Ninja si se quiere app para teléfono o React).
- **Aceptamos:**
  - una interfaz más sencilla que la de una SPA;
  - (desde el 28-oct ya no hay dos versiones del DDL: el docente aceptó PostgreSQL también para la entrega).
- **Fuera de esta DEC:** dónde se instala para el negocio (local en su PC o en la nube). Se decide con los dueños, según si pueden pagar en dólares con tarjeta (ver [[Technology Recommendations - MIRM]] §5) → futura DEC de alojamiento.
- **Cuándo revisarla:** si el docente cambia algún requisito (tabla "Margen"), si los dueños piden una app para teléfono, o si el desarrollo con Django no alcanza para el 05-nov.

## Historial

- 28-oct — Tomada por el equipo, sujeta a la revisión del docente. Redactada por Claude a pedido de Kenry. Revisada por el equipo.
- 28-oct (tarde) — **Respuestas del docente** (contadas por Kenry): no es necesario SQL Server, PostgreSQL sirve porque solo pide poder hacer las consultas; y no es necesario presentar el servidor web, basta con que corra en local. Se quita SQL Server de esta decisión: un solo DDL en PostgreSQL. Redactado por Claude; pendiente de revisión del equipo.
- Al hablar con el maestro, la opción A se cierra como la opción a utilizar, cumple con algo limpio y aceptable por el maestro, se utilizará unicamente PostgreSQL sin meterse con SQL Server. Además, deberá de haber una forma de ejecutarse desde el navegador solo para "comprobarle al maestro" lo que hicimos.
