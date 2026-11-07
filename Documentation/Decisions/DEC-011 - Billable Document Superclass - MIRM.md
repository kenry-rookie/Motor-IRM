---
id: DEC-011
project: "[[Motor IRM]]"
stage: S4
status: Tomada
date: 2026-10-28
participants: Devans, Gustavo, Kenry
source: IA (redactada por Claude a pedido de Kenry, con lo decidido por el equipo el 28-oct)
reviewed: true
---
**[[Motor IRM|← Hub]]** · **[[S4 - Entity-Relationship Model and EER - MIRM|S4]]** · **[[S4 - ER and EER Model - MIRM|MER/EER v1]]** · **[[DEC-010 - Advance to S5 Before Closing S4 - MIRM|← DEC-010]]** · **[[DEC-012 - Staff Disjoint Specialization - MIRM|DEC-012 →]]**

# DEC-011 — Billable Document Superclass (G-1: Documento cobrable)

## Contexto

- En S3 (modelo conceptual), *Venta* y *Servicio mecánico* son entidades independientes que comparten varios atributos y relaciones: cliente, número de comprobante, condición (contado o crédito), rebaja, quién registra.
- *Pago de cliente* y *Crédito* necesitan relacionarse con **ambas** (la venta **o** el servicio), lo que en S3 se resolvía con dos arcos exclusivos (R-26 y R-27).
- En S4 hay que decidir si esos arcos se mantienen o si conviene una superclase.

## Criterios

1. Eliminar la duplicación de atributos comunes entre Venta y Servicio mecánico.
2. Que *Pago de cliente* y *Crédito* se relacionen con **un solo lugar** (sin arcos exclusivos).
3. Que se pueda agregar un tercer tipo de documento sin rehacer las relaciones de pago y crédito.

## Opciones

| Opción | Cómo funciona | A favor | En contra |
| --- | --- | --- | --- |
| A — Mantener arcos exclusivos | R-26 y R-27 siguen apuntando a Venta **o** a Servicio | No cambia el modelo conceptual | Duplica atributos; cada nuevo tipo de operación cobrable requiere modificar los arcos |
| B — Superclase *Documento cobrable* | Venta y Servicio mecánico son subclases; lo común (cliente, comprobante, condición, rebaja, registrado por) vive en la superclase | Un solo lugar para pagos y créditos; extensible | Un nivel más de herencia |

## Decisión

**Elegimos:** B — **Nueva entidad *Documento cobrable*** como superclase de *Venta* y *Servicio mecánico*.

- **Especialización total y disjunta**, definida por atributo (`kind`: venta, servicio, saldo_inicial).
- Lo que es común vive **una sola vez** en la superclase: cliente (R-04, opcional según C-01), número de comprobante, condición, rebaja (con C-05), total derivado, registrado por (R-17, con C-03).
- *Pago de cliente* (R-26) y *Crédito* (R-27) se relacionan con *Documento cobrable*: desaparecen los arcos exclusivos de S3.
- *Saldo inicial de cliente* es la tercera subclase (ver [[DEC-015 - Opening Balances - MIRM|DEC-015]]).

## Consecuencias

- **Ganamos:** cumple los tres criterios. El modelo es más limpio: un pago va a "un documento cobrable", sin importar si por debajo es una venta o un servicio.
- **Aceptamos:** en S5 la superclase se convierte en una tabla con un discriminador (`kind`) y las subclases en tablas con FK al documento, lo que añade un JOIN para leer una venta completa. Django lo maneja de forma natural con herencia de modelos.
- **Cuándo revisarla:** si aparece un tipo de operación cobrable que no comparte cliente, comprobante ni condición con los actuales.

## Historial

- 28-oct — Decidido por el equipo durante la sesión de S4. Construcción EER registrada en el MER/EER v1 (§4 EER-1).
- 01-nov — DEC redactada por Claude a pedido de Kenry; pendiente de revisión del equipo.
- 05-nov - Confirmado por el equipo.
