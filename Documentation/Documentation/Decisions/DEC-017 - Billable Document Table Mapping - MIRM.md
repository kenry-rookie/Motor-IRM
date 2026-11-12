---
id: DEC-017
project: "[[Motor IRM]]"
stage: S5
transformation: T-02
status: Tomada
date: 2026-10-28
participants: Devans, Gustavo, Kenry
source: IA (redactada por Claude a pedido de Kenry, a partir de lo decidido y aplicado en el esquema y el DDL de la entrega del 29-oct)
reviewed: true
---
**[[Motor IRM|← Hub]]** · **[[S5 - Relational Model and Normalization - MIRM|S5]]** · **[[S5 - Relational Schema - MIRM|Esquema relacional]]** · **[[DEC-016 - Surrogate Primary Keys - MIRM|← DEC-016]]** · **[[DEC-018 - Staff Table Mapping - MIRM|DEC-018 →]]**

# DEC-017 — Billable Document Table Mapping

Decisión de transformación **T-02** del [[S5 - Relational Schema - MIRM|esquema relacional]] (§1).

## Contexto

- [[DEC-011 - Billable Document Superclass - MIRM|DEC-011]] decidió en el EER que Venta, Servicio mecánico y Saldo inicial son subclases de Documento cobrable. En S5 hay que decidir cómo se convierte eso en tablas.

## Criterios

1. Pagos y créditos apuntan a una sola tabla
2. Sin columnas vacías según el tipo
3. Que una línea de venta no pueda colgar de un servicio

## Opciones

| Opción | Cómo funciona | A favor | En contra |
| --- | --- | --- | --- |
| A — Una sola tabla | Todo en `billable_document`, con columnas que se usan según `kind` | Sin JOIN | Muchas columnas nulas; una línea de venta podría apuntar a un servicio |
| B — Una tabla por subclase, sin padre | `sale`, `mechanical_service` y `opening_balance` separadas | Tablas limpias | Pagos y créditos tendrían que apuntar a tres tablas |
| C — Tabla padre + una por subclase | `billable_document` con `kind`; cada subclase con PK = FK al padre | Pagos a una tabla; sin nulos por tipo; `sale_detail` apunta a `sale` | Un JOIN para leer el documento completo; `kind` y la subclase deben coincidir |

## Decisión

**Elegimos:** C — `billable_document` (discriminador `kind`) + `sale`, `mechanical_service` y `opening_balance`, cuya PK es a la vez FK al documento.

**Por qué:** Es la única que cumple los tres criterios. `sale` no tiene columnas propias, pero es necesaria para que `sale_detail` solo pueda apuntar a una venta.

## Consecuencias

- **Ganamos:** Un solo lugar para pagos y créditos; Django lo maneja con herencia multitabla.
- **Aceptamos:** **Redundancia controlada:** `kind` repite lo que dice la fila de la subclase. Que coincidan lo garantiza la aplicación (§6 del esquema).
- **Cuándo revisarla:** Si aparece un nuevo tipo de documento.

## Historial

- 28-oct — Tomada y aplicada en la entrega de la base de datos.
- 05-nov — Registrada como DEC al cerrar S5. Redactada por Claude a pedido de Kenry; pendiente de revisión del equipo.
