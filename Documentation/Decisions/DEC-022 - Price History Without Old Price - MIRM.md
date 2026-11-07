---
id: DEC-022
project: "[[Motor IRM]]"
stage: S5
transformation: T-07
status: Tomada
date: 2026-10-28
participants: Devans, Gustavo, Kenry
source: IA (redactada por Claude a pedido de Kenry, a partir de lo decidido y aplicado en el esquema y el DDL de la entrega del 29-oct)
reviewed: true
---
**[[Motor IRM|← Hub]]** · **[[S5 - Relational Model and Normalization - MIRM|S5]]** · **[[S5 - Relational Schema - MIRM|Esquema relacional]]** · **[[DEC-021 - Movement Reason Includes Direction - MIRM|← DEC-021]]** · **[[DEC-023 - Sale Cancellation Out of Scope - MIRM|DEC-023 →]]**

# DEC-022 — Price History Without Old Price

Decisión de transformación **T-07** del [[S5 - Relational Schema - MIRM|esquema relacional]] (§1).

## Contexto

- El historial de precio guardaba precio anterior y nuevo. Además, al vender hay que leer el precio actual rápido.

## Criterios

1. Sin datos repetidos
2. Rapidez al vender

## Opciones

| Opción | Cómo funciona | A favor | En contra |
| --- | --- | --- | --- |
| A — `old_price` + `new_price` | Cada fila guarda los dos | Se lee el cambio en una fila | `old_price` repite el `new_price` de la fila anterior |
| B — Solo `new_price`; precio actual en `product` | El anterior es la fila anterior; `product.sale_price` = precio vigente | Sin repetir dentro del historial; venta rápida | `sale_price` repite el último `new_price` |

## Decisión

**Elegimos:** B — Sin `old_price`. `product.sale_price` guarda el precio actual como **redundancia controlada**: al cambiar el precio se actualiza el producto y se inserta el historial en la misma transacción.

**Por qué:** Se elimina una redundancia y se acepta otra a propósito, por rapidez en la venta.

## Consecuencias

- **Ganamos:** Venta sin buscar en el historial.
- **Aceptamos:** Si alguien cambia `sale_price` sin insertar historial, quedan distintos: lo controla la aplicación.
- **Cuándo revisarla:** Si se decide calcular el precio actual con una vista.

## Historial

- 28-oct — Tomada y aplicada en la entrega de la base de datos.
- 05-nov — Registrada como DEC al cerrar S5. Redactada por Claude a pedido de Kenry; pendiente de revisión del equipo.
