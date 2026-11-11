---
id: DEC-055
project: "[[Motor IRM]]"
stage: S8
status: Tomada
date: 2026-11-10
participants: Kenry
source: IA (Claude, a pedido de Kenry)
reviewed: true
---
**[[Motor IRM|← Hub]]** · **[[DEC-054 - Invoice Record, Charge Confirmation and Admin Menu - MIRM|← DEC-054]]**

# DEC-055 — Invoice Void

## Contexto

Kenry: «es muy posible que suceda» que una factura se haga mal. Las reglas confirmadas del prompt v2 (§2): solo los dueños anulan, máximo 3 días, con motivo, y se revierte con movimientos de signo contrario, **nunca borrando**.

## Decisión

- Tabla `sale_invoice_void` (1 a 1 con la factura; la factura es la PK): motivo, quién, cuándo, **efectivo devuelto** (`refund_amount` = lo que se había pagado) y la devolución que regresó los productos (FK compuesta a `customer_return` de esa misma factura).
- Al anular, en **una sola transacción**:
  1. los productos que no se habían devuelto regresan con una devolución de motivo «Anulación de factura» (movimientos `DEVOLUCION_CLIENTE` al costo con que salieron);
  2. se registra la anulación con lo pagado como efectivo devuelto.
- `v_invoice_balance`: una factura anulada tiene **saldo 0** y no vence; columna nueva `voided`. Así cuentas por cobrar y estados de cuenta la ignoran solos.
- `v_mechanic_unpaid_commission`: la mano de obra de una factura anulada no genera comisión.
- Reportes (Resumen): las anuladas no cuentan como venta; el efectivo devuelto resta de lo cobrado y del efectivo del periodo.
- **Reglas en la base** (trigger `tg_sale_invoice_void_check`): solo un usuario enlazado a una persona **Dueño** activa; máximo **3 días**; no si la comisión de esa orden ya se pagó; la anulación no se edita ni se borra. Otro trigger impide abonos y devoluciones nuevas sobre una factura anulada.
- Permiso nuevo `ventas.anular` (el perfil Dueño lo recibe al correr el seed).
- Pantalla: botón «Anular factura» en la factura (solo si aplica), ventana que dice qué pasará (productos que regresan, efectivo a devolver, comisión) y pide el motivo. La factura queda marcada «Anulada» en Facturas y la impresión lleva el sello ANULADA.

## Preguntas abiertas

- **Factura del taller anulada:** la orden queda «Entregada» con su factura anulada (una orden tiene una sola factura). Si hay que cobrarla otra vez, por ahora se recibe la moto como orden nueva. ¿Prefieren reabrir la misma orden? (Requiere cambiar la regla de una factura por orden.)
- El efectivo devuelto todavía no sale de una «caja abierta»: llega con la Fase 4 (apertura y cierre de caja).

## Historial

- 10-nov — Implementada por Claude a pedido de Kenry (migración `7_sale_invoice_void`); pendiente de revisión del equipo.
