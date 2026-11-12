---
id: DEC-016
project: "[[Motor IRM]]"
stage: S5
transformation: T-01
status: Tomada
date: 2026-10-28
participants: Devans, Gustavo, Kenry
source: IA (redactada por Claude a pedido de Kenry, a partir de lo decidido y aplicado en el esquema y el DDL de la entrega del 29-oct)
reviewed: true
---
	**[[Motor IRM|← Hub]]** · **[[S5 - Relational Model and Normalization - MIRM|S5]]** · **[[S5 - Relational Schema - MIRM|Esquema relacional]]** · **[[DEC-015 - Opening Balances - MIRM|← DEC-015]]** · **[[DEC-017 - Billable Document Table Mapping - MIRM|DEC-017 →]]**

# DEC-016 — Surrogate Primary Keys

Decisión de transformación **T-01** del [[S5 - Relational Schema - MIRM|esquema relacional]] (§1).

## Contexto

- Hay que elegir la llave de cada tabla. Varias tablas apuntan a entidades débiles (el movimiento apunta a la línea de venta; la mano de obra a la falla adicional). Django trabaja de forma natural con una PK de una sola columna.

## Criterios

1. Que cada FK sea de una sola columna
2. Conservar la identidad del MER
3. Funcionar bien con Django

## Opciones

| Opción                        | Cómo funciona                                                 | A favor                                                       | En contra                                    |
| ----------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------- |
| A — Llave natural o compuesta | La débil usa (padre, número de línea) como PK                 | Fiel al MER                                                   | Cada FK hacia una débil tendría dos columnas |
| B — Llave sustituta + UQ      | `id_<tabla>` autonumérica; la clave natural queda como UNIQUE | FK de una columna; Django sin trucos; la UQ conserva la regla | Una columna más por tabla                    |

## Decisión

**Elegimos:** B — Llave sustituta `GENERATED ALWAYS AS IDENTITY` en entidades fuertes y débiles; la clave natural de la débil queda como UQ (por ejemplo, `uq_sale_detail_line (id_sale, line_no)`). Excepciones: las subclases y `credit` usan como PK la FK a su padre.

**Por qué:** Es la única que cumple los tres criterios.

## Consecuencias

- **Ganamos:** FK simples y modelos de Django directos.
- **Aceptamos:** Hay que acordarse de la UQ: sin ella, la regla de identidad del MER se pierde.
- **Cuándo revisarla:** Si Django o alguna herramienta exige llaves compuestas.

## Historial

- 28-oct — Tomada y aplicada en la entrega de la base de datos.
- 05-nov — Registrada como DEC al cerrar S5. Redactada por Claude a pedido de Kenry; pendiente de revisión del equipo.
