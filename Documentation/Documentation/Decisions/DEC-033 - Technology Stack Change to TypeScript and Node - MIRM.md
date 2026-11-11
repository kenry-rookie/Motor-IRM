---
id: DEC-033
project: "[[Motor IRM]]"
stage: S5
status: Tomada (detalles por definir en S8)
date: 2026-11-07
participants: Equipo (comunicada por Kenry)
replaces: "[[DEC-006 - Technology Stack - MIRM]]"
source: IA (redactada por Claude a pedido de Kenry, con lo que él comunicó el 07-nov)
reviewed: true
---
**[[Motor IRM|← Hub]]** · **[[DEC-006 - Technology Stack - MIRM|DEC-006 (reemplazada)]]** · **[[DEC-032 - Integrity Fixes From S5 Review - MIRM|← DEC-032]]** · **[[DEC-034 - DDL as Single Source of Truth - MIRM|DEC-034 →]]**

# DEC-033 — Technology Stack Change to TypeScript and Node

Reemplaza a [[DEC-006 - Technology Stack - MIRM|DEC-006]] (Django + Python + PostgreSQL).

## Contexto

- 07-nov: el equipo decide **no usar Django**.
- La base de datos no cambia: PostgreSQL, con el DDL propio (`01_schema.sql` v2) y las consultas de [[S5 - Business Queries - MIRM|Business Queries]].
- Entrega en clase: 11-nov (por confirmar con el docente). Entrega al negocio: 10-dic.

## Decisión

**Elegimos:**

| Pieza | Elección |
| --- | --- |
| Lenguaje | **TypeScript** |
| Servidor | **Node.js**, con una **API** |
| Base de datos | **PostgreSQL** (sin cambios) |
| Dónde corre | En **local** |
| Cómo se abre | Con su **ícono en el escritorio**, como una aplicación de escritorio |

**Por qué:** decisión del equipo (07-nov). *Motivos por completar por el equipo.*

## Por definir en S8 (arquitectura)

- Framework de la API y forma de acceder a la base (SQL directo con un driver o un *query builder*; ver [[DEC-034 - DDL as Single Source of Truth - MIRM|DEC-034]]).
- Cómo se ve como aplicación de escritorio (por ejemplo, aplicación web instalada desde el navegador o una ventana nativa) y con qué se construye la interfaz.
- Inicio de sesión y permisos (Dueño, Encargado) → los datos ya están en `staff` ([[DEC-035 - Staff Login Credentials - MIRM|DEC-035]]).
- Zona horaria en el programa (decisión D6, en conversación).

## Consecuencias

- **Cambia:** todo lo que en las notas decía "modelos de Django", `managed = False`, `inspectdb` o "permisos de Django" pasa a ser "la capa de datos/servicios del programa en TypeScript". La §6 del esquema dice ahora "Aplicación".
- **No cambia:** el DDL, las restricciones, las vistas planeadas y las consultas.
- **Cuándo revisarla:** si el docente pide otra tecnología, o si el tiempo no alcanza para el 11-nov.

## Historial

- 07-nov — Comunicada por Kenry. Redactada por Claude a pedido de Kenry; pendiente de revisión del equipo (completar los motivos).
