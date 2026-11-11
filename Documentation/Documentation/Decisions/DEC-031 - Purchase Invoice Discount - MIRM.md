---
id: DEC-031
project: "[[Motor IRM]]"
stage: S5
transformation: Modelo
status: Tomada (Q-081 sigue abierta para los detalles)
date: 2026-11-07
participants: Kenry
source: IA (redactada por Claude a pedido de Kenry; aplicada y probada por Claude en 01_schema.sql v2)
reviewed: false
---
**[[Motor IRM|← Hub]]** · **[[S5 - Relational Model and Normalization - MIRM|S5]]** · **[[DEC-030 - Mechanic Pay Period - MIRM|← DEC-030]]** · **[[DEC-032 - Integrity Fixes From S5 Review - MIRM|DEC-032 →]]**

# DEC-031 — Purchase Invoice Discount

## Contexto

- La factura de compra del 23-oct trae un **descuento de C$ 6,525** (subtotal 93,212; total 86,687). Es **exactamente el 7 %** del subtotal.
- `purchase` no tenía dónde guardarlo: la deuda con el proveedor (Q19) salía C$ 6,525 más alta.
- Q-081 (¿siempre hay descuento?, ¿es sobre el total?) sigue sin respuesta.

## Criterios

1. Que el saldo con el proveedor sea el real.
2. Que la columna sirva sea cual sea la respuesta de Q-081.
3. Mismo estilo que la rebaja de las ventas (`billable_document.discount`).

## Opciones

| Opción | Cómo funciona | A favor | En contra |
| --- | --- | --- | --- |
| A — Esperar Q-081 | Nada por ahora | — | El saldo sale mal; después hay que tocar el DDL y el programa |
| **B — `purchase.discount` ahora** | Monto en córdobas, `NOT NULL DEFAULT 0`, CK `>= 0` | Sirve en todos los casos: descuento al total (se usa), por línea (ya viene en `unit_cost`, queda 0), excepcional (0) o porcentaje (se guarda el monto) | Que no pase del subtotal va en la aplicación (el subtotal está en las líneas) |

## Decisión

**Elegimos:** B — `purchase.discount NUMERIC(12,2) NOT NULL DEFAULT 0` con `ck_purchase_discount`.

- **Total de una compra** = Σ (cantidad × costo de sus líneas) − `discount`. Se calcula, no se guarda ([[DEC-020 - Derived Attributes as Views - MIRM|DEC-020]]).
- Consultas: **Q19** (saldo por proveedor) resta el descuento; **Q22** nueva (saldo de cada factura).
- El costo unitario (`purchase_detail.unit_cost`) se guarda **como viene en la factura**. Si el descuento debe repartirse en el costo de cada producto (para la ganancia y el "último costo" de [[DEC-024 - Exit Cost as Last Cost - MIRM|DEC-024]]) se decide con Q-081.

**Por qué:** cumple los tres criterios y no depende de la respuesta.

## Consecuencias

- **Ganamos:** la deuda con el proveedor y el saldo de cada factura son reales.
- **Aceptamos:** sin quién autorizó el descuento (lo da el proveedor, no un dueño).
- **Cuándo revisarla:** al responder Q-081 (¿siempre 7 %?, ¿lo toman en cuenta al fijar el precio de venta?).

## Historial

- 06-nov — Q-081 registrada.
- 07-nov — Tomada por Kenry y aplicada en `01_schema.sql` v2. Redactada por Claude a pedido de Kenry; pendiente de revisión del equipo.
