---
id: DEC-056
project: "[[Motor IRM]]"
stage: S8
status: Tomada
date: 2026-11-10
participants: Kenry
source: IA (Claude, a pedido de Kenry)
reviewed: false
---
**[[Motor IRM|← Hub]]** · **[[DEC-055 - Invoice Void - MIRM|← DEC-055]]**

# DEC-056 — Mechanic Pay as Its Own Area

## Decisión

- «Pago a mecánicos» sale de Administración y es un área propia del menú lateral, con dos sub-opciones: **Dar adelanto** y **Pagar periodo trabajado**.
- `/pagos`: lo que el mecánico tiene ganado sin cobrar (órdenes, adelantos, a pagar) y dos botones grandes que llevan a cada acción.
- `/pagos/adelanto`: muestra cuánto puede adelantar (lo ganado menos lo ya adelantado) y el botón «Dar adelanto». No deja escribir más de eso; la API también lo revisa.
- `/pagos/periodo`: Desde/Hasta, vista previa de lo que entra en el pago y el botón «Registrar pago» (con confirmación). Abajo, los pagos anteriores.
- El mecánico elegido viaja en la dirección (`?mecanico=ID`), así no se pierde al pasar de una pantalla a otra.
- `/admin/pagos` y `/personal` redirigen a `/pagos`.
- Se quitaron de la pantalla los códigos internos (BR-103, DEC-030).

## Historial

- 10-nov — Implementada por Claude a pedido de Kenry; pendiente de revisión del equipo.
