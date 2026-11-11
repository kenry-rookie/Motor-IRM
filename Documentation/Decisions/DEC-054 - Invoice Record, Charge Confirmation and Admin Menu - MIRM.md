---
id: DEC-054
project: "[[Motor IRM]]"
stage: S8
status: Tomada
date: 2026-11-10
participants: Kenry
source: IA (Claude, a pedido de Kenry)
reviewed: false
---
**[[Motor IRM|← Hub]]** · **[[DEC-053 - Printed Invoice and Payment Receipt - MIRM|← DEC-053]]**

# DEC-054 — Invoice Record, Charge Confirmation and Admin Menu

## 1. Registro de facturas

- Pantalla nueva **Facturas** (`/facturas`) en el menú, debajo de Caja: todo lo facturado en mostrador y taller.
- Filtros hechos por la base (DEC-049) sobre `v_invoice_balance`: periodo (Hoy, Últimos 7 días, Este mes, Todo o fechas), cliente sin tildes o número de factura, contado/crédito, estado (con saldo, vencidas, pagadas) y origen (mostrador o taller). El día se toma en hora de Managua.
- Arriba, totales de **todo lo que coincide** (no solo de la página): facturas, total facturado (menos devoluciones), cobrado y por cobrar.
- Cada fila abre la factura o la imprime de nuevo. La ficha de la factura ahora vuelve a «Facturas».
- API: `sales.searchInvoices` (paginación por offset, 50 por página).

## 2. Confirmar antes de cobrar

- «Cobrar» (o F9) ya no factura de inmediato: abre **«Realizar cobro»** con cliente, forma de pago, líneas y total.
  - **Cancelar** vuelve a la pestaña tal como estaba: se puede seguir agregando o cambiando.
  - **Cobrar** crea la factura; después se pregunta si imprimirla (DEC-053).
- Si el cobro falla (por ejemplo, sin existencias), el error se ve en la misma ventana y no se crea nada.

## 3. Administración en el menú lateral

- Las opciones de Administración salen como **sub-opciones bajo «Administración»** en el menú lateral cuando se está en esa área. Se quitó el recuadro de opciones de las pantallas de administración.
- Con el menú contraído (solo íconos) las sub-opciones se ven al pasar el mouse, igual que los nombres.

## Historial

- 10-nov — Implementada por Claude a pedido de Kenry; pendiente de revisión del equipo.
