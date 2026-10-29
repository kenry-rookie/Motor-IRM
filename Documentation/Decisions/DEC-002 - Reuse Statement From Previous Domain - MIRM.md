---
id: DEC-002
project: "[[Motor IRM]]"
stage: S0
status: Tomada
date: 2026-10-20
participants: Devans, Gustavo, Kenry
source: IA (redactada por Claude a pedido de Kenry, con lo decidido por el equipo)
ai_edit: "Claude — 2026-10-28: historial (revisada por el equipo)"
reviewed: true
---
**[[Motor IRM|← Hub]]** · **[[S1 - Discovery and Interview Preparation - MIRM|S1]]** · **[[DEC-001 - Sharing information - MIRM|← DEC-001]]**

# DEC-002 — Reuse Statement From Previous Domain

## Contexto

- El proyecto se entrega el **05-nov-2026**. El calendario de S0 asigna un día o menos a cada etapa de análisis, y el equipo ya acumula un retraso de hasta tres días.
- Del intento 1 existe un enunciado del dominio completo → [[Domain Statement - MIRM]]. Es la versión larga que menciona los porcentajes 50 %, 60 % y 100 %.
- La [[First Try Review - MIRM|revisión crítica]] señala tres problemas de ese material:
	- **W-01:** gran parte fue redactado por la IA, no por el equipo.
	- **W-08:** algunas respuestas de los dueños se interpretaron sin confirmarlas con ellos.
	- **W-12:** hay dos versiones del enunciado que se contradicen.
- Se encontró la primera conversación con los dueños → [[SRC-01 - First Conversation - MIRM]], que sirve para contrastar el enunciado con lo que ellos dijeron.
- El negocio queda a 200 km y las oportunidades de entrevistar a los dueños son pocas.

## Criterios (en orden de importancia)

1. **Tiempo:** poder llegar a la entrega del 08-nov.
2. **Evidencia:** que nada entre al modelo nuevo sin una fuente que lo respalde.
3. **Aprovechar** lo que ya se sabe del negocio, para no repetir preguntas a los dueños.
4. **No repetir los errores del intento 1** (W-01, W-08, W-12).

## Opciones

| Opción                                                  | Cómo funciona                                                                                                                     | A favor                                                                          | En contra                                                                                                                  |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| A — Empezar de cero                                     | Escribir un enunciado nuevo solo con la entrevista nueva                                                                          | Sin arrastrar errores ni contenido de la IA                                      | No alcanza el tiempo; se pierde lo que ya se sabe; obliga a repetir preguntas a los dueños                                 |
| B — Reutilizar el enunciado tal cual                    | Usar el enunciado anterior como verdadero y pasar al modelado                                                                     | Lo más rápido                                                                    | Arrastra todo lo señalado en W-01, W-08 y W-12; contradice la razón del reinicio                                           |
| C — Reutilizar el enunciado como **borrador a validar** | Segmentarlo por temas, contrastar cada segmento con SRC-01, registrar dudas y contradicciones, y validarlo en la entrevista nueva | Ahorra tiempo; aprovecha lo sabido; cada parte termina respaldada por una fuente | Riesgo de anclaje (ver el enunciado viejo condiciona lo que se pregunta); el trabajo de segmentar y contrastar toma tiempo |

**Comparación con los criterios**

| Criterio | A | B | C |
| --- | --- | --- | --- |
| 1. Tiempo | ❌ | ✅ | ⚠️ |
| 2. Evidencia | ✅ | ❌ | ✅ |
| 3. Aprovechar lo sabido | ❌ | ✅ | ✅ |
| 4. No repetir errores | ✅ | ❌ | ⚠️ |

## Decisión

**Elegimos:** C — reutilizar el enunciado anterior como **borrador a validar**.

**Por qué:** es la única opción que cumple la evidencia (2) y aprovecha lo sabido (3) dentro del tiempo disponible (1). A no alcanza a la entrega; B repite exactamente lo que llevó al reinicio.

**Qué enunciado se toma como base:** [[Domain Statement - MIRM]] (versión larga, con 50 % / 60 % / 100 %). Las otras versiones del intento 1 no se usan.

**Reglas para usarlo:**
- El enunciado reutilizado es un **borrador**. Ninguna parte se considera verdadera hasta tener una fuente (`SRC-xx`).
- Cada segmento se marca como: **respaldado** (coincide con una fuente), **sin fuente** o **contradicho** (una fuente dice otra cosa).
- Las dudas y contradicciones se registran en [[Questions - MIRM|Questions]] y se llevan a la entrevista.
- El enunciado nuevo se escribe en S2 a partir de los segmentos validados, no copiando el anterior.

## Consecuencias

- **Lo que ganamos:** tiempo; una lista concreta de qué confirmar con los dueños; menos preguntas repetidas.
- **Lo que aceptamos perder:** la independencia total de un enunciado nuevo. El borrador puede orientar las preguntas hacia lo que ya creíamos.
- **Riesgos y cómo los manejamos:**
	- *Anclaje* → en la entrevista se empieza con preguntas abiertas sobre cómo trabajan, antes de confirmar lo que dice el enunciado.
	- *Contenido redactado por la IA sin validar* → solo pasa a S2 lo que esté marcado como respaldado.
	- *Contradicciones entre el enunciado y SRC-01* → cada una se registra como pregunta, no se decide por intuición.
- **Cuándo revisarla:** si la entrevista con los dueños contradice partes centrales del enunciado (taller, mecánicos o créditos), se abre una DEC nueva para reescribir esas secciones desde cero.

## Historial

- 20-oct — Tomada por el equipo durante S0.
- 22-oct — Redactada por Claude a pedido de Kenry, con lo decidido por el equipo. Revisada por el equipo.
