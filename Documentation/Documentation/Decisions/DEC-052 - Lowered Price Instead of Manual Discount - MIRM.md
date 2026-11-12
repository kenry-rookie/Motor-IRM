---
id: DEC-052
project: "[[Motor IRM]]"
stage: S8
status: Tomada
date: 2026-11-10
participants: Kenry
source: IA (Claude, a pedido de Kenry)
reviewed: true
---
**[[Motor IRM|← Hub]]** · **[[DEC-051 - Finished Orders Cannot Be Cancelled - MIRM|← DEC-051]]**

# DEC-052 — Lowered Price Instead of Manual Discount

## Contexto

En Caja cada línea tenía un desplegable «Sin descuento / Monto manual…» y una casilla extra. Ocupaba espacio, apretaba el nombre del producto y se veía desordenado. En el negocio no se piensa en «descuento manual»: se le baja un poco el precio al cliente.

## Decisión

- Se quita el desplegable de descuento de Caja (venta y cobro del taller).
- El **precio por unidad** de cada línea se ve en un recuadro. **Doble clic** (o Enter) abre un panel pequeño con:
  - rebajas sugeridas de **2 %, 3 % y 5 %** (muestran el precio que queda);
  - «Otro precio» para escribirlo a mano;
  - «Volver al precio normal».
- Límites: nunca más que el precio de venta, **nunca menos que el último costo** (DEC-024). Si una sugerencia quedaría bajo el costo, se ve deshabilitada. El costo se muestra solo a quien puede ver compras.
- Bajar un precio sigue pidiendo `ventas.autorizar_descuento` (o la clave de un dueño).
- **Cómo se guarda:** la línea guarda el precio normal en `unit_price` y la diferencia en `discount_amount`. Así la factura sigue diciendo cuál era el precio y cuánto se rebajó, y las vistas de saldos, margen y comisiones no cambian.
- La API recibe `unitPrice` (el precio acordado) y calcula todo; el cliente nunca manda el total.
- **En la base:** trigger `tg_sale_invoice_line_min_price`: una línea de PRODUCTO con rebaja no puede cobrar por unidad menos que el último costo. Las líneas sin rebaja no se revisan (salen a precio de lista).
- El nombre del producto ahora es el texto más grande de la línea; la cantidad es un control angosto.

## Alternativas descartadas

- Guardar el precio rebajado directo en `unit_price` sin descuento: se perdería cuánto se rebajó y quién lo autorizó.
- Mantener los descuentos del catálogo en Caja: la API los sigue aceptando (`discountId`), pero la pantalla ya no los ofrece.

## Historial

- 10-nov — Implementada por Claude a pedido de Kenry; pendiente de revisión del equipo.
