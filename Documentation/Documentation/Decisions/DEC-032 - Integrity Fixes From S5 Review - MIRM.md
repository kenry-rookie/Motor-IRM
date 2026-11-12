---
id: DEC-032
project: "[[Motor IRM]]"
stage: S5
transformation: Restricciones
status: Tomada
date: 2026-11-07
participants: Kenry
source: IA (redactada por Claude a pedido de Kenry, a partir de la revisión de la IA del 06-nov; aplicada y probada por Claude en 01_schema.sql v2)
reviewed: true
---
**[[Motor IRM|← Hub]]** · **[[S5 - Relational Model and Normalization - MIRM|S5]]** · **[[DEC-031 - Purchase Invoice Discount - MIRM|← DEC-031]]** · **[[DEC-033 - Technology Stack Change to TypeScript and Node - MIRM|DEC-033 →]]**

# DEC-032 — Integrity Fixes From S5 Review

Correcciones pequeñas que salieron de la revisión del DDL (06-nov). Se agrupan porque ninguna cambia la estructura.

## Contexto y decisiones

| # | Problema encontrado | Prueba | Decisión |
| --- | --- | --- | --- |
| R-1 | `LOCALTIMESTAMP` da la hora de **inicio de la transacción**: dos cambios de estado guardados en la misma transacción tenían la misma hora y violaban `uq_status_change_service_time`. Lo mismo en `price_history`. | Reproducido el 06-nov | Default **`clock_timestamp()::timestamp`** (hora real de cada fila) en `status_change.changed_at` y `price_history.changed_at`. Prueba 59. |
| R-3 | Una compra **al crédito sin vencimiento** se aceptaba. | Reproducido el 06-nov | `ck_purchase_due_date`: crédito ⇔ hay vencimiento, y el vencimiento no es anterior a la compra (mismo estilo que `ck_supplier_opening_pair`). Pruebas 9, 47 y 48. |
| R-4 | `customer_payment` no tiene cliente: un abono podría repartirse entre documentos de **dos clientes**. | — | Nueva restricción **C-15** (§6 del esquema): los documentos de un mismo pago son del mismo cliente. **Va en la aplicación** (DEC-009 se mantiene). |
| R-8 | Nombre fuera de la convención. | — | `uq_price_history_product_time` → `uq_price_history_id_product_changed_at`. |

## Para el 10-dic (no cambian la entrega en clase)

- **R-5 Índices** en columnas FK que se consultan mucho: `inventory_movement (id_product, moved_at)` (kárdex) y `payment_application (id_billable_document)` (lo pagado de cada documento).
- **R-6** Coherencia de subclases con FK compuesta (`staff.role` ↔ `owner`/`mechanic`; `kind` ↔ subclase del documento), la idea de la §10 del esquema.

## Consecuencias

- **Ganamos:** el registro de estados funciona aunque el programa guarde varios en una transacción; las compras al crédito siempre tienen vencimiento.
- **Aceptamos:** C-15 depende del programa.

## Historial

- 06-nov — Encontradas en la revisión de la IA (respondida en el chat).
- 07-nov — Tomadas por Kenry y aplicadas en `01_schema.sql` v2. Redactada por Claude a pedido de Kenry; pendiente de revisión del equipo.
