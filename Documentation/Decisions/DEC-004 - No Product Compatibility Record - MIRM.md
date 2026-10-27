---
id: DEC-004
project: "[[Motor IRM]]"
stage: S3
status: Tomada
date: 2026-10-23
participants: Devans, Gustavo, Kenry
source: IA (redactada por Claude a pedido de Kenry, con lo decidido por el equipo)
reviewed: true
---
**[[Motor IRM|← Hub]]** · **[[S3 - Develop a Conceptual Model - MIRM|S3]]** · **[[DEC-003 - Internal Work on Own Motorcycle - MIRM|← DEC-003]]** · **[[DEC-005 - Managua Trip Expenses as Cash Withdrawal - MIRM|DEC-005 →]]**

# DEC-004 — No Product Compatibility Record

## Contexto

- El segmento 6 del [[Enhanced and Corroborated Domain Statement - MIRM|enunciado ampliado]] quedó: el borrador decía que un repuesto puede servir para varios modelos de moto, pero no se sabía si querían registrarlo.
- Q-015 ([[SRC-02 - Second Interview Owners - MIRM|SRC-02]]): *"Los dueños y mecánicos saben esas cosas."*
- Q-063 ([[SRC-04 - Follow-up Answers Owners - MIRM|SRC-04]]): con la experiencia del personal basta; dueños y mecánicos seguirán sabiendo la compatibilidad por experiencia.
	- La entrega es el 05-nov. Registrar compatibilidades es una relación muchos a muchos entre productos y modelos de moto que **alguien tendría que cargar y mantener**, para cientos de productos.
## Criterios

1. Que el sistema resuelva lo que hoy se pierde, no lo que ya funciona.
2. Tiempo hasta la entrega.
3. Que la información que se guarde se pueda mantener al día.

## Opciones

| Opción | Cómo funciona | A favor | En contra |
| --- | --- | --- | --- |
| A — Registrar compatibilidad producto–modelo | Cada producto lista los modelos de moto donde sirve | Una persona sin experiencia podría consultarlo | Nadie lo pidió; mucho trabajo de carga; se desactualiza; más complejidad en el modelo |
| B — No registrarla | La compatibilidad sigue en la experiencia de dueños y mecánicos | Coincide con lo que dijeron los dueños; modelo más simple | Si llega alguien sin experiencia, depende de que el mecánico le indique |

**Comparación con los criterios**

| Criterio | A | B |
| --- | --- | --- |
| 1. Resuelve lo que se pierde | ❌ | ✅ |
| 2. Tiempo | ❌ | ✅ |
| 3. Mantenible | ⚠️ | ✅ |

## Decisión

**Elegimos:** B — **No se registra la compatibilidad entre productos y modelos de moto.**

**Por qué:** los mecánicos y los dueños ya saben qué producto es compatible. Si otra persona sin experiencia empieza a administrar el sistema, no necesita saber la compatibilidad, porque el mecánico ya la sabe y le indica.

## Consecuencias

- **Lo que ganamos:** un modelo más simple y tiempo para lo que sí falta (inventario, créditos, pago de mecánicos).
- **Lo que aceptamos perder:** el sistema no puede sugerir repuestos según la moto.
- **Efecto en el modelo:** no existe relación entre producto y modelo de moto. El modelo de la moto se guarda solo para identificarla (Q-048), no para relacionarla con productos.
- **Regla que sale de aquí:** BR-006.
- **Cuándo revisarla:** si los dueños piden buscar repuestos por modelo, o si cambia el personal y la experiencia deja de estar en el taller. Puede quedar como mejora para una versión posterior.

## Historial

- 23-oct — Tomada por el equipo al inicio de S3. Redactada por Claude a pedido de Kenry. **Pendiente de revisión del equipo** (`reviewed: false`).
