---
id: DEC-036
project: "[[Motor IRM]]"
stage: S6
status: Tomada — superada en parte el 07-nov (el modelo de clases completo ya se hizo)
date: 2026-11-07
participants: Kenry
source: IA (redactada por Claude a pedido de Kenry, con lo que él decidió al abrir S6)
reviewed: false
---
**[[Motor IRM|← Hub]]** · **[[S6 - Object-Oriented Model and Requirements - MIRM|S6]]** · **[[DEC-035 - Staff Login Credentials - MIRM|← DEC-035]]**

# DEC-036 — Lightweight S6 Before Programming

## Contexto

- Quedan unos 2 días para la entrega en clase (11-nov, por confirmar) y el programa no está empezado.
- El esquema ya está fijo y probado en el DDL v2, que manda sobre las tablas ([[DEC-034 - DDL as Single Source of Truth - MIRM|DEC-034]]); en TypeScript las tablas serán **tipos** de datos.
- Lo que el programa necesita de S6 es saber **quién cumple cada regla** que la base no puede garantizar, **qué entra en la versión 1** y **qué cambios de estado** se permiten en el servicio mecánico.

## Opciones

| Opción | Cómo funciona | A favor | En contra |
| --- | --- | --- | --- |
| A — S6 completa | Diagrama de clases de las 36 tablas con asociación, agregación y composición justificadas, más todo lo de B | Documentación OO completa | Uno o dos días que no cambian el código de la entrega |
| **B — S6 ligera** | Requisitos (FR, NFR, UC con columna *Versión 1*), módulos y servicios con sus métodos, cada regla de la aplicación con su método, diagrama de estados y un diagrama de clases solo de servicios | Lo justo para programar; llena la columna OO de la trazabilidad | El diagrama de clases completo queda pendiente |

## Decisión

**Elegimos:** B — S6 ligera → [[S6 - Domain Model and Services - MIRM|S6 - Domain Model and Services]] y [[Requirements - MIRM|Requirements]].

**Por qué:** permite empezar a programar hoy sin perder el control de las reglas.

## Consecuencias

- **Ganamos:** el alcance de la v1 queda escrito (FR con *Versión 1*) y ninguna regla "va en la aplicación" queda sin responsable.
- **Aceptamos:** el diagrama de clases completo se hace después de la entrega en clase, o antes si el docente lo pide como entregable (pendiente de confirmar con el docente o con Gustavo).
- **Cuándo revisarla:** si el docente pide el modelo orientado a objetos completo.

## Historial

- 07-nov — Tomada por Kenry. Redactada por Claude a pedido de Kenry; pendiente de revisión del equipo.
- 07-nov (madrugada) — Kenry pidió el modelo de clases completo: [[S6 - Domain Class Model - MIRM|Domain Class Model]]. Lo que esta DEC dejaba pendiente ya está hecho; se conserva como historia.
