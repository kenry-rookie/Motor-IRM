---
id: SRC-08
project: "[[Motor IRM]]"
type: observation
date: 2026-11-07
observer: Kenry (conocimiento del negocio; su hermano trabaja en este taller)
interviewees:
medium: Observación del equipo, dada en el chat al cerrar S5 (no es respuesta directa de los dueños)
source: IA (transcrita por Claude tal como Kenry la escribió; sin interpretar)
reviewed: false
---
**[[Motor IRM|← Hub]]** · **[[S5 - Relational Model and Normalization - MIRM|S5]]** · **[[Questions - MIRM|❓ Questions]]** · **[[Business Rules - MIRM|📏 Business Rules]]** · **[[SRC-07 - Owners Answers Nov 06 - MIRM|← SRC-07]]**

# SRC-08 — Team Observations Nov 07

> [!warning] Tipo de fuente: observación
> Igual que [[SRC-06 - Team Observations Oct 27 - MIRM|SRC-06]]: **no** son palabras de los dueños. Es conocimiento del negocio que aporta Kenry al revisar el caso 4 de la [[S5 - Normalization - MIRM|normalización]] (¿la semana de pago es fija?). Se confirma con los dueños → Q-084 y Q-085.

---

## 1. El periodo que se le paga a un mecánico no es fijo

> "La semana casi nunca termina antes en el negocio, pero si un mecánico dice que no llegará a trabajar viernes, ni sábado, se le tiene que pagar el jueves. Las semanas pueden empezar el lunes, pero si el mecánico llega a trabajar desde el miércoles y trabaja hasta sábado, entonces se paga desde miércoles a sábado. Incluso peor, si empieza el martes y termina el jueves, esa fue su semana y ya."

> "Dejar el pago semanal y luego asociar los trabajos a él por semana; si da la casualidad que enfermó y se le debía la semana pasada, entonces hay que saber resolver esos casos también."

## 2. El adelanto no debería pasar de lo que ya trabajó

> "Al darle el adelanto debería de verificarse si con lo que ha trabajado esa semana puede cubrir ese adelanto, no vaya a ser que pide 500 y solo lleva 200 según su comisión."

---
## Qué cambia

- **BR-046 v3** (el periodo de pago es el que el mecánico trabajó) y **BR-104** (lo que no se le pagó se liquida en el siguiente pago) → [[DEC-030 - Mechanic Pay Period - MIRM|DEC-030]].
- **BR-103** (el adelanto se compara con la comisión pendiente) → validación en la aplicación; consulta Q21 de [[S5 - Business Queries - MIRM|Business Queries]].
- Contradice en parte la respuesta de Q-017 (SRC-02, SRC-07: "de lunes a sábado"): la semana *normal* sigue siendo de lunes a sábado; esta fuente agrega las excepciones.
