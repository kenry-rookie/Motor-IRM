---
id: DEC-013
project: "[[Motor IRM]]"
stage: S4
status: Tomada
date: 2026-10-28
participants: Devans, Gustavo, Kenry
source: IA (redactada por Claude a pedido de Kenry, con lo decidido por el equipo el 28-oct; propuesta original de Gustavo)
reviewed: true
---
**[[Motor IRM|← Hub]]** · **[[S4 - Entity-Relationship Model and EER - MIRM|S4]]** · **[[S4 - ER and EER Model - MIRM|MER/EER v1]]** · **[[DEC-012 - Staff Disjoint Specialization - MIRM|← DEC-012]]** · **[[DEC-014 - Exclusive Arc for Inventory Movement Origin - MIRM|DEC-014 →]]**

# DEC-013 — Status Change Weak Entity (Cambio de estado del servicio mecánico)

## Contexto

- El servicio mecánico pasa por varios estados (modelo conceptual §4.1):

| Estado | Significado |
| --- | --- |
| RECIBIDA | Llegó la moto; todavía no tiene responsable |
| EN_DIAGNOSTICO | Se busca la falla |
| EN_PROCESO | Se trabaja |
| ESPERA_REPUESTO | Falta un repuesto (BR-033) |
| ESPERA_CLIENTE | Se espera decisión del cliente sobre falla adicional |
| TERMINADA | Trabajo listo; falta la prueba, el cobro y la entrega |
| EN_PRUEBA | El cliente prueba la moto (BR-094, BR-095) |
| ENTREGADA | Cobrada o con crédito autorizado; el cliente se la llevó |
| CANCELADA | El cliente no sigue; se cobra lo trabajado (BR-080) |

- Las transiciones posibles están documentadas en el diagrama de estados ([[Diagrama_estados_servicio_mecanico.png]]) y en el modelo conceptual §4.1.
- Se necesita saber **cuándo** cambió de estado, **quién** lo registró y poder ver las vueltas (por ejemplo, EN_PRUEBA → EN_PROCESO → TERMINADA → ENTREGADA).
- La fecha de cierre (ENTREGADA o CANCELADA) define en qué semana se liquida la comisión del mecánico (BR-047).

## Criterios

1. Conservar el historial completo de cambios de estado, no solo el último.
2. Saber la fecha de cierre para el pago semanal (BR-047).
3. Poder registrar las vueltas de EN_PRUEBA sin perder información.

## Opciones

| Opción | Cómo funciona | A favor | En contra |
| --- | --- | --- | --- |
| A — Solo un atributo *estado_actual* en Servicio mecánico | Se sobrescribe en cada cambio | Más simple | No hay historial; no se sabe cuándo entró ni cuándo salió de cada estado |
| B — Entidad débil *Cambio de estado* (propuesta de Gustavo) | Cada transición es un registro: estado, fecha y hora, registrado por | Historial completo; la fecha de cierre es el último cambio a ENTREGADA o CANCELADA; las vueltas de EN_PRUEBA quedan registradas | Más filas; el estado actual se deriva (último cambio) |

## Decisión

**Elegimos:** B — **Entidad débil *Cambio de estado*** del *Servicio mecánico* (propuesta de Gustavo).

- **Entidad débil** identificada por servicio + fecha y hora del cambio.
- **Atributos:** estado (enum), fecha y hora, registrado por (R-44, Personal).
- **Participación total:** todo servicio tiene al menos un cambio (RECIBIDA al crearse, C-13).
- **Datos derivados del Servicio mecánico:**
  - *estado_actual* = estado del último cambio.
  - *received_at* (fecha de ingreso) = fecha del primer cambio (RECIBIDA).
  - *closed_at* (fecha de cierre) = fecha del cambio a ENTREGADA o CANCELADA.

## Consecuencias

- **Ganamos:** cumple los tres criterios. El historial completo permite al negocio ver todo el recorrido de la moto por el taller.
- **Aceptamos:** el estado actual se calcula (último cambio por fecha), lo que implica un JOIN o una subconsulta. En S5 se puede decidir guardar una copia del estado actual en la tabla del servicio por rapidez (con su propia DEC de transformación). Las transiciones válidas (diagrama de estados) se validan en la aplicación.
- **Cuándo revisarla:** si el historial de cambios no se necesita (poco probable dado BR-047).

## Historial

- 28-oct — Propuesta por Gustavo, decidida por el equipo durante la sesión de S4. Construcción EER registrada en el MER/EER v1 (§4 EER-2).
- 01-nov — DEC redactada por Claude a pedido de Kenry; pendiente de revisión del equipo.
