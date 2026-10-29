---
id: DEC-010
project: "[[Motor IRM]]"
stage: S5
status: Tomada
date: 2026-10-28
participants: Devans, Gustavo, Kenry
source: IA (redactada por Claude a pedido de Kenry, con lo decidido por el equipo)
ai_edit: "Claude — 2026-10-28: nota creada; PostgreSQL para la entrega (docente, 28-oct)"
reviewed: false
---
**[[Motor IRM|← Hub]]** · **[[S5 - Relational Model and Normalization - MIRM|S5]]** · **[[DEC-009 - Credit per Operation - MIRM|← DEC-009]]**

# DEC-010 — Advance to S5 Before Closing S4

## Contexto

- El docente pide la base de datos el **29-oct**. Al principio se entendía que debía ser en SQL Server; el 28-oct confirmó que PostgreSQL sirve ([[DEC-006 - Technology Stack - MIRM|DEC-006]]).
- El 28-oct, S4 está en borrador: el [[S4 - ER and EER Model - MIRM|MER/EER v1]] existe, pero faltan el recorrido de escenarios, las decisiones 3 y 6 (provisionales) y las DEC de las construcciones EER.
- El Restart Plan pide cerrar cada etapa con su puerta antes de avanzar (regla 3).
- El modelo relacional es el más fiel a la base de datos: de él sale el DDL.

## Criterios

1. Entregar el 29-oct una base que funcione.
2. Que el DDL salga de un modelo documentado, no improvisado.
3. No perder lo que falta revisar de S4.

## Opciones

| Opción | Cómo funciona | A favor | En contra |
| --- | --- | --- | --- |
| A — Cerrar S4 y después hacer S5 | Respetar las puertas | Método completo | No se llega al 29-oct |
| B — Adelantar S5 y cerrar S4 y S5 después de la entrega | S5 se hace con el MER v1; las dos etapas se cierran juntas después del 29-oct | Se llega; el DDL sale de un esquema documentado | Puede haber cambios después de la entrega |
| C — Escribir el DDL sin modelo relacional | Directo del MER al SQL | Lo más rápido | El DDL no tendría un modelo detrás; falla el criterio 2 |

## Decisión

**Elegimos:** B — **S5 se adelanta para la entrega del 29-oct; S4 y S5 se cierran como equipo después de la entrega.**

- Para la entrega se usan como definitivas las decisiones provisionales del MER: 3 (arco exclusivo), 6 (saldos iniciales), *Aplicación de pago* y *Cargo externo*.
- El DDL de entrega lo escriben dos integrantes, en PostgreSQL, con el reparto de la §9 de [[S5 - Relational Schema - MIRM]].

**Por qué:** es la única opción que cumple los tres criterios.

## Consecuencias

- **Ganamos:** la entrega a tiempo, con un DDL que sale de un esquema documentado y trazable al MER.
- **Aceptamos:** cualquier cambio que salga del cierre de S4 y S5 después de la entrega. Se corrige el esquema, se registra en el LogBook y se ajusta el DDL (regla 6 del Restart Plan). El DDL entregado en clase puede no ser el final.
- **Cuándo revisarla:** después del 29-oct, al cerrar S4 y S5.

## Historial

- 28-oct — Tomada por el equipo. Redactada por Claude a pedido de Kenry; pendiente de revisión del equipo.
- 28-oct (tarde) — La entrega pasa a PostgreSQL (el docente confirmó el 28-oct que no hace falta SQL Server: PostgreSQL sirve, porque solo pide poder hacer las consultas). Redactado por Claude; pendiente de revisión del equipo.
