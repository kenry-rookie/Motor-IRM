---
id: DEC-014
project: "[[Motor IRM]]"
stage: S4
status: Tomada
date: 2026-10-28
participants: Devans, Gustavo, Kenry
source: IA (redactada por Claude a pedido de Kenry; recomendación de la IA aceptada por el equipo)
reviewed: true
---
**[[Motor IRM|← Hub]]** · **[[S4 - Entity-Relationship Model and EER - MIRM|S4]]** · **[[S4 - ER and EER Model - MIRM|MER/EER v1]]** · **[[DEC-013 - Status Change Weak Entity - MIRM|← DEC-013]]** · **[[DEC-015 - Opening Balances - MIRM|DEC-015 →]]**

# DEC-014 — Exclusive Arc for Inventory Movement Origin (G-3: Origen del movimiento)

## Contexto

- Un *Movimiento de inventario* (entrada o salida de un producto) siempre tiene un origen: una línea de compra, una línea de venta, un producto usado en un servicio, una devolución de cliente, una devolución a proveedor, o un reclamo de garantía (BR-020).
- Excepción: inventario inicial y ajuste no tienen un origen externo (BR-079, C-04).
- En S3, esto se planteaba como relaciones opcionales (R-25 a R-27); en S4 hay que resolver si se unifican como una superclase o se deja como arco exclusivo.
- **El arco es obligado:** todo movimiento de inventario que no sea ajuste o inventario inicial debe tener exactamente un origen (C-04). Esta obligatoriedad se decidió al revisar el uso del arco: sin ella, se podrían registrar movimientos sin origen ni motivo, lo que contradice el control que busca el sistema.

## Criterios

1. Que cada movimiento se pueda trazar a su origen (qué compra, qué venta, qué servicio lo generó).
2. Que no se invente una superclase artificial que no represente nada del negocio.
3. Que la restricción se pueda implementar en PostgreSQL.

## Opciones

| Opción | Cómo funciona | A favor | En contra |
| --- | --- | --- | --- |
| A — Superclase *Origen del movimiento* | Los seis orígenes heredan de una entidad común | Se relacionan con un solo lugar | Los seis no comparten atributos; la superclase sería artificial (falla criterio 2) |
| B — Seis relaciones opcionales sin restricción | Cada origen es una FK nullable | Simple en SQL | No impide que un movimiento tenga dos orígenes o ninguno |
| C — Arco exclusivo con restricción | Seis FK opcionales + `CHECK` que garantice exactamente una (o ninguna si es ajuste/inventario inicial) | Trazabilidad completa; no inventa entidades; el CHECK es directo | Seis columnas opcionales en la tabla de movimientos |

## Decisión

**Elegimos:** C — **Arco exclusivo con restricción (`CHECK`)**, obligado para movimientos normales.

- En EER puro sería una **categoría** (tipo unión): el origen es *uno de* varios tipos distintos que no comparten atributos.
- En S5, la tabla `inventory_movement` tiene seis FK opcionales (una por origen) y un `CHECK` que verifica:
  - Si el motivo **no** es 'ajuste' ni 'inventario_inicial': exactamente una FK es NOT NULL.
  - Si el motivo **es** 'ajuste' o 'inventario_inicial': todas las FK son NULL.
- **Restricción formal (C-04):** un movimiento tiene como máximo un origen; ninguno solo si el motivo es *inventario inicial* o *ajuste*, y el motivo coincide con el origen.

## Consecuencias

- **Ganamos:** cumple los tres criterios. Un movimiento se traza a su origen con una sola consulta (la FK que no es NULL), sin necesidad de una tabla intermedia.
- **Aceptamos:** seis columnas opcionales en `inventory_movement`; la mayoría tendrá solo una llena. Si en el futuro aparece un séptimo origen (por ejemplo, transferencia entre bodegas), se agrega una FK y se actualiza el CHECK.
- **Cuándo revisarla:** si el número de orígenes crece mucho (más de ~10), en cuyo caso conviene una tabla de relación polimórfica en lugar de FK por origen.

## Historial

- 28-oct — Recomendación de la IA como decisión provisional en el MER v1; registrada como arco exclusivo (§4 EER-3, C-04).
- 01-nov — Revisada y aceptada por el equipo al cerrar S4. DEC redactada por Claude a pedido de Kenry; pendiente de revisión del equipo.
