---
id: DEC-009
project: "[[Motor IRM]]"
stage: S3
status: Cerrada
date: 2026-10-27
participants: Devans, Gustavo, Kenry
source: IA (mejorada por Claude a pedido de Kenry, con lo decidido por el equipo)
ai_edit: "Claude — 2026-10-28: cerrada (abono al crédito más antiguo; saldos iniciales a la decisión 6 de S4) e historial; navegación a DEC-010"
reviewed: true
---
**[[Motor IRM|← Hub]]** · **[[S3 - Conceptual Model - MIRM|Modelo conceptual]]** · **[[DEC-008 - Separate Brand Catalogs and Product Tier - MIRM|← DEC-008]]** · **[[DEC-010 - Advance to S5 Before Closing S4 - MIRM|DEC-010 →]]**

# DEC-009 — Credit per Operation

## Contexto

- El crédito se da tanto en **ventas** ([[SRC-01 - First Conversation - MIRM|SRC-01]]) como en **servicios mecánicos** ([[SRC-02 - Second Interview Owners - MIRM|SRC-02]], Q-035).
- Plazo normal de **un mes** (BR-064), extensible por confianza y pagable en dos partes (BR-066); 8 % por mes si se pide a tres meses (BR-068).
- Q-069: ¿un crédito agrupa varias operaciones del cliente o cada una es aparte?

## Criterios

1. Saber **qué** está vencido y desde cuándo.
2. Saber **cuánto debe en total** cada cliente.
3. Conservar el **historial de pagos**.

## Opciones

| Opción | Cómo funciona | A favor | En contra |
| --- | --- | --- | --- |
| A — Un crédito por operación | Cada venta o servicio al crédito es un crédito con su fecha de vencimiento | Vencimientos claros; el 8 % y la extensión se aplican a algo concreto | Hay que decidir a qué crédito va un pago "a la cuenta" |
| B — Una cuenta por cliente | Todos los cargos y pagos van a una sola cuenta | Simple de cobrar | No hay vencimiento claro por operación |

## Decisión

**Elegimos:** A — **Cada venta o servicio mecánico al crédito es un crédito aparte.** La **deuda total** del cliente **se deriva** (suma de sus créditos pendientes) y se **registran todos sus pagos**.

## Consecuencias

- **Ganamos:** los tres criterios. En *Cliente* aparecen como datos derivados: deuda total, ¿debe?, créditos vencidos.
- **Abono "a la cuenta" (resuelto 28-oct):** los dueños hoy solo restan el abono de la cuenta que anotan en el celular, sin decir a qué operación va ([[SRC-06 - Team Observations Oct 27 - MIRM|SRC-06]] §8). **Propuesta del equipo:** se aplica al **crédito más antiguo con saldo** y el sobrante pasa al siguiente (BR-096). No hace falta preguntarlo a los dueños.
- **Consecuencia para el MER:** un abono puede repartirse entre varios créditos → entidad ***Aplicación de pago*** (pago, documento, monto aplicado), en evaluación por el equipo en S4.
- **Saldos iniciales:** las deudas que ya existían antes del sistema (Q-078) pasan a la **decisión 6 de S4**.
- **Reglas:** BR-092, BR-096.
- **Cuándo revisarla:** si los dueños confirman que llevan una sola cuenta por cliente y no les sirve ver los créditos por separado.

## Historial

- 27-oct — Tomada por el equipo. Redactada por Claude a pedido de Kenry. Revisada por el equipo.
- 28-oct — **Cerrada** por el equipo: el abono va al crédito más antiguo (propuesta del equipo) y los saldos iniciales pasan a la decisión 6 de S4. Redactado por Claude a pedido de Kenry; pendiente de revisión del equipo.
- 28-oct - Revisado por el equipo y confirmada la decisión.
