---
id: DEC-012
project: "[[Motor IRM]]"
stage: S4
status: Tomada
date: 2026-10-28
participants: Devans, Gustavo, Kenry
source: IA (redactada por Claude a pedido de Kenry, con lo decidido por el equipo el 28-oct)
reviewed: true
---
**[[Motor IRM|← Hub]]** · **[[S4 - Entity-Relationship Model and EER - MIRM|S4]]** · **[[S4 - ER and EER Model - MIRM|MER/EER v1]]** · **[[DEC-011 - Billable Document Superclass - MIRM|← DEC-011]]** · **[[DEC-013 - Status Change Weak Entity - MIRM|DEC-013 →]]**

# DEC-012 — Staff Disjoint Specialization (G-2: Personal)

## Contexto

- En el negocio hay tres roles: **Dueño**, **Mecánico** y **Encargado** (BR-007, BR-008).
- Cada rol tiene relaciones distintas:
  - **Mecánico:** adelantos (R-29), pago semanal (R-30), porcentaje de comisión (BR-044).
  - **Dueño:** retiros de caja (R-33), autorizar créditos (R-28), autorizar rebajas (R-34), atender reclamos (R-13), recibir compras (R-48), entregar adelantos (R-49), pagar semanalmente (R-50), cambiar precios (R-51).
  - **Encargado:** registrar ventas cuando no están los dueños (BR-008).
- Los tres comparten: registrar documentos cobrables (R-17, con restricción C-03) y registrar cambios de estado (R-44).
- Un dueño puede reparar una moto (BR-055), pero **sigue siendo dueño**: no gana comisión (BR-051).

## Criterios

1. Que cada relación se cuelgue de la subclase que la cumple (no del Personal genérico con un `IF` por rol).
2. Que un dueño que repara no necesite estar en dos subclases.
3. Que las restricciones C-02 y C-03 se puedan expresar en el modelo.

## Opciones

| Opción | Cómo funciona | A favor | En contra |
| --- | --- | --- | --- |
| A — Sin especialización | Un solo Personal con atributo *rol*; todas las relaciones salen de ahí | Simple | No impide que un encargado autorice créditos; la comisión del dueño tiene que ser cero "a mano" |
| B — Especialización solapada | Una persona puede ser Dueño y Mecánico a la vez | Cubre el caso del dueño que repara | Complica la lógica: ¿qué porcentaje aplica? Un dueño que repara no gana comisión (BR-051) |
| C — Especialización disjunta | Cada persona está en exactamente un rol | Cada relación se cuelga de su subclase; BR-051 se cumple naturalmente | No permite doble rol; el dueño que repara se modela como responsable desde *Personal* (R-05, C-02) |

## Decisión

**Elegimos:** C — **Especialización total y disjunta de Personal** en Dueño, Mecánico y Encargado.

- **Total:** todo Personal es exactamente uno de los tres (atributo definidor: *rol*).
- **Disjunta:** un dueño que repara sigue siendo Dueño; R-05 (responsable del servicio) sale de la superclase *Personal*, restringida por C-02 a "solo dueño o mecánico".
- Las relaciones específicas se cuelgan de la subclase correspondiente:
  - Adelantos y pago semanal → **Mecánico**
  - Retiros, créditos, rebajas, reclamos, compras, precios → **Dueño**
  - Registrar ventas → **Personal** (dueño o encargado, restricción C-03)

## Consecuencias

- **Ganamos:** cumple los tres criterios. BR-051 (dueño no gana comisión) se cumple de forma natural: solo Mecánico tiene porcentaje de comisión.
- **Aceptamos:** si en el futuro un encargado pudiera autorizar algo que hoy solo hace el Dueño, habría que mover esa relación a Personal con restricción. Pero hoy el negocio es claro: "solo se les llama a los dueños" (Q-010).
- **En S5:** la tabla `staff` tiene el `rol` como discriminador; `mechanic` tiene una tabla con `commission_rate`; las FK de relaciones específicas apuntan a la subclase.
- **Cuándo revisarla:** si el negocio crea un rol nuevo o si un encargado necesita permisos de dueño.

## Historial

- 28-oct — Decidido por el equipo durante la sesión de S4. Construcción EER registrada en el MER/EER v1 (§4 EER-1).
- 01-nov — DEC redactada por Claude a pedido de Kenry; pendiente de revisión del equipo.
