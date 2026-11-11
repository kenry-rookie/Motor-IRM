---
id: DEC-029
project: "[[Motor IRM]]"
stage: S5
transformation: Normalización
status: Tomada
date: 2026-11-07
participants: Kenry
source: IA (redactada por Claude a pedido de Kenry, con lo que él decidió al cerrar S5; aplicada y probada por Claude en 01_schema.sql v2)
reviewed: true
---
**[[Motor IRM|← Hub]]** · **[[S5 - Relational Model and Normalization - MIRM|S5]]** · **[[S5 - Normalization - MIRM|Normalización]]** · **[[DEC-028 - Naming Convention for Keys - MIRM|← DEC-028]]** · **[[DEC-030 - Mechanic Pay Period - MIRM|DEC-030 →]]**

# DEC-029 — Controlled Redundancy with Composite Foreign Keys

Resuelve N-1 y N-2 de la [[S5 - Normalization - MIRM|normalización]] (casos 1, 2 y 3) y deja registrado el caso 5.

## Contexto

- En 6 tablas hay un dato que se puede deducir siguiendo una FK (dependencia transitiva), pero **no se puede borrar** porque la columna que lo determina a veces es nula. Ejemplo: `supplier_payment.id_supplier` se deduce de la compra, pero un pago al saldo de apertura no tiene compra.
- Q-070 (SRC-07) se respondió: cada pago a un proveedor es de **una sola factura** (BR-101). No hace falta una tabla de aplicación de pagos a proveedores.

## Criterios

1. Que el dato repetido **no pueda contradecirse**.
2. No perder los casos con nulos (pago a la cuenta, servicio sin liquidar, movimiento sin origen).
3. Cambio pequeño en el DDL, antes de programar.

## Opciones

| Opción | Cómo funciona | A favor | En contra |
| --- | --- | --- | --- |
| A — Dejarlo en la aplicación | El programa revisa que coincidan | Sin cambios en el DDL | Si el programa falla o alguien inserta por SQL, el dato se contradice |
| **B — FK compuesta (patrón A)** | La FK apunta a la **pareja** en la tabla padre, que tiene una UQ de esa pareja; con `MATCH SIMPLE`, si una columna es nula la FK no se revisa | La base garantiza que coinciden; tres reglas de la §6 pasan a la base | Una UQ más en cada padre; nombres de restricción más largos |

## Decisión

**Elegimos:** B — 8 FK compuestas y 6 UQ de pareja (la cantidad del movimiento **no** se incluye; sigue en la aplicación, C-13).

| Caso | Tabla hija → FK compuesta | Padre (UQ de la pareja) | Regla que pasa a la base |
| --- | --- | --- | --- |
| 1 | `supplier_payment (id_purchase, id_supplier)` | `purchase` | C-08 |
| 2 | `mechanical_service (id_weekly_payout, id_responsible)` | `weekly_payout (id_weekly_payout, id_mechanic)` | C-10 (mismo mecánico) |
| 2 | `advance (id_weekly_payout, id_mechanic)` | `weekly_payout` | C-10 (mismo mecánico) |
| 2 | `service_labor (id_additional_fault, id_mechanical_service)` | `additional_fault` | La falla es del mismo servicio |
| 2 | `service_part (id_additional_fault, id_mechanical_service)` | `additional_fault` | La falla es del mismo servicio |
| 3 | `inventory_movement (id_purchase_detail, id_product)` | `purchase_detail` | El producto es el de la línea |
| 3 | `inventory_movement (id_sale_detail, id_product)` | `sale_detail` | El producto es el de la línea |
| 3 | `inventory_movement (id_service_part, id_product)` | `service_part` | El producto es el de la línea |

- Cada FK compuesta **reemplaza** a la FK simple de esa columna.
- **Hueco cerrado:** con `MATCH SIMPLE`, un servicio liquidado sin responsable no se revisaría. `ck_mechanical_service_payout_rate` ahora exige también `id_responsible` cuando hay pago.
- **Caso 5 (`customer_return.refund_amount`) — se conserva.** No se deduce de la línea: si la venta tuvo una rebaja general (`billable_document.discount`), lo que el cliente pagó por esa línea no es cantidad × precio. Es el dinero que de verdad salió de caja. La aplicación lo propone (BR-102) y valida que no pase de cantidad × precio.
- **Caso 4** se resolvió en [[DEC-030 - Mechanic Pay Period - MIRM|DEC-030]] (`period_end` no se deduce).

**Por qué:** cumple los tres criterios. Probado el 07-nov: intentos 38 a 46 de la tabla de pruebas del [[S5 - DDL PostgreSQL - MIRM|DDL]].

## Consecuencias

- **Ganamos:** C-08, la parte "mismo mecánico" de C-10 y la regla de la falla se cumplen en la base; el producto del movimiento no puede diferir del de su línea.
- **Aceptamos:** la redundancia sigue existiendo (controlada). En el programa (Node.js), el error llega como violación de FK: la capa de servicios debe validar antes para mostrar un mensaje claro.
- **Cuándo revisarla:** si un pago a proveedor llega a cubrir varias facturas (Q-070 cambiaría) → tabla `supplier_payment_application`.

## Historial

- 05-nov — Casos encontrados en la nota de normalización.
- 07-nov — Tomada por Kenry y aplicada en `01_schema.sql` v2. Redactada por Claude a pedido de Kenry; pendiente de revisión del equipo.
