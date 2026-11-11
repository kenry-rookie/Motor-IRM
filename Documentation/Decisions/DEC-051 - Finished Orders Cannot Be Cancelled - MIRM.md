---
id: DEC-051
project: "[[Motor IRM]]"
stage: S8
status: Tomada
date: 2026-11-10
participants: Kenry
source: IA (Claude, a pedido de Kenry)
reviewed: false
---
**[[Motor IRM|← Hub]]** · **[[DEC-050 - Password to Change Permissions - MIRM|← DEC-050]]**

# DEC-051 — Finished Orders Cannot Be Cancelled

## Contexto

En la orden #9 (estado «Terminada») aparecía el botón «Cancelar orden». Si el trabajo ya se hizo, cancelar la orden deja la mano de obra y los repuestos sin cobrar y sin explicación.

## Decisión

- Una orden **Terminada** o **En prueba** no se cancela: se cobra en caja.
- Una orden **Entregada** o **Cancelada** ya no cambia de estado (antes lo revisaba solo la API).
- Las dos reglas viven en la base: trigger `tg_service_order_status_guard` (BEFORE INSERT en `service_order_status_change`), que mira el último estado de la orden. Mensajes: `tg_service_order_cancel_finished` y `tg_service_order_status_closed`.
- La API lo revisa antes (`service.cancel`) para dar el mensaje sin crear nada; la pantalla de la orden ya no muestra el botón en esos estados.

## Alternativa descartada

- Bloquearlo solo en la pantalla: la regla se saltaría desde otra pantalla o desde SQL.

## Salida si hace falta

Si una orden quedó «Terminada» por error, se devuelve a «En proceso» desde el tablero y entonces sí se puede cancelar. Queda en el historial quién lo hizo.

## Historial

- 10-nov — Implementada por Claude a pedido de Kenry (migración `6_order_status_guard_min_price`); pendiente de revisión del equipo.
