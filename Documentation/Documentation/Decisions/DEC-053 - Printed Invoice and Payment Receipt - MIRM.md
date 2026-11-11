---
id: DEC-053
project: "[[Motor IRM]]"
stage: S8
status: Tomada
date: 2026-11-10
participants: Kenry
source: IA (Claude, a pedido de Kenry)
reviewed: true
---
**[[Motor IRM|← Hub]]** · **[[DEC-052 - Lowered Price Instead of Manual Discount - MIRM|← DEC-052]]**

# DEC-053 — Printed Invoice and Payment Receipt

## Decisión

- **Al cobrar** (venta o moto del taller) sale una ventana: «¿El cliente quiere factura impresa?» con «Imprimir factura» y «No imprimir». El aviso verde se queda.
- **Factura** (`/imprimir/factura/[id]`), tamaño carta, siempre negro sobre blanco aunque la app esté en modo oscuro:
  - encabezado **Motoservicios y Repuestos Rivera**, giro, dirección y teléfono;
  - recuadro FACTURA con número, fecha y condición (CONTADO / CRÉDITO, y vencimiento);
  - cliente y, si viene del taller, moto, placa, orden y kilometraje;
  - líneas (cantidad, descripción, precio, descuento si hubo, importe); la mano de obra y los trabajos externos se marcan;
  - total; al crédito: abonado, saldo pendiente, compromiso de pago y firma del cliente.
- **Recibo de abono** (`/imprimir/abono/[id]`): al registrar un abono también se pregunta si imprimirlo. Dice cuánto se recibió (y el equivalente si fue en dólares), a qué factura o saldo anterior se aplicó, cuánto queda de cada una y el saldo total. En la ficha del cliente hay una tabla «Abonos recibidos» para reimprimirlos.
- Las páginas de impresión están fuera del menú lateral, piden sesión y abren el diálogo de impresión solas (`?imprimir=1`).
- Los datos del negocio están en `src/lib/business.ts` **provisionalmente** (son genéricos). En la Fase 6 pasan a `app_setting` para que los dueños los cambien.
- El número que se imprime es el `id` con seis cifras (000031). La numeración consecutiva propia (`document_sequence`) llega en la Fase 4 y lo reemplazará.

## Historial

- 10-nov — Implementada por Claude a pedido de Kenry; pendiente de revisión del equipo.
