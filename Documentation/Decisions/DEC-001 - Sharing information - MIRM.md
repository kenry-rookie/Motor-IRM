# DEC-001 — Sharing information - MIRM

## Contexto

Somos un grupo de tres estudiantes en UNI, de la carrera de Ingeniería en Computación. Comenzamos de forma equivocada a la hora de documentar la información y el proceso, nos dejó una marca al perder información de la primer entrevista y documentando con IA. Además que todo lo documentaba Kenry; es el único que ha usado Obsidian hace meses.

En S0 se estableció que todos deberán tener acceso a la documentación importante, tienen que poder escribir, debido a la distribución de tareas.

Por lo tanto, como equipo hemos tomado la decisión de usar GitHub, pero con unos matices a tomar en cuenta. Sólo registrará: "LogBook", la carpeta "Records", la carpeta "Assets", la carpeta "Sources", la carpeta "Stage" con todo su contenido, la carpeta "Decisions" y "First Try Review". Para facilitar la documentación sin complicaciones y Kenry será quien documente lo demás en Obsidian al ser el único que tiene contacto directo con los dueños.

## Criterios

1. Que los tres puedan **escribir**, no solo leer.
2. Que haya contacto con la documentación y se pueda recurrir siempre que sea necesario.
3. Que quede **historial**: quién cambió qué y cuándo.
4. Mantiene la tranquilidad por su costo mínimo.
5. Que se pueda terminar una parte del proyecto en **menos de una semana**.

## Opciones

| Opción                                                                      | Cómo funciona                                                                           | A favor                                                                   | En contra                                                                                                                                 |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| A — Repositorio en GitHub + plugin Obsidian Git                             | El vault vive en un repositorio; cada uno lo clona y sincroniza con el plugin           | Todos escriben; historial completo; aprendemos Git, que vamos a necesitar | Hay que aprender Git ahora; si dos editan la misma nota a la vez hay conflictos; en celular funciona de forma limitada                    |
| B — Vault personal de Kenry y se comparten exportaciones                    | Ana documenta y comparte PDF o capturas                                                 | No hay nada que aprender                                                  | Solo Kenry escribe; las copias se desactualizan                                                                                           |
| C — Google Docs para el equipo y Obsidian solo para Kenry                   | El equipo escribe en Docs; Ana pasa lo importante a Obsidian                            | Muy fácil para todos                                                      | Dos fuentes de verdad; alguien tiene que copiar todo a mano                                                                               |
| D — Repositorio en GitHub sin unir con vault de Obsidian (privado de Kenry) | Lo mas importante vive en el repositorio remoto, lo demás lo registra Kenry en Obsidian | Todos escriben. Historial completo. Aprendemos Git.                       | Aprendemos Git/GitHub para el resto del proyecto y nos vamos familiarizando con .md para próximos proyectos y se puedan instalar Obsidian |


**Comparación con los criterios**

| Criterio                                           | A   | B   | C   | D   |
| -------------------------------------------------- | --- | --- | --- | --- |
| 1. Todos escriben                                  | ✅   | ❌   | ✅   | ✅   |
| 2. Contacto directo con información                | ✅   | ⚠️  | ❌   | ✅   |
| 3. Historial                                       | ✅   | ❌   | ⚠️  | ✅   |
| 4. Costo cero                                      | ✅   | ✅   | ✅   | ✅   |
| 5. Se avanza en una semana                         | ⚠️  | ✅   | ✅   | ✅   |
| 6. Doble escritura (posible dos fuentes de verdad) | ✅   | ⚠️  | ❌   | ❌   |

## Decisión

**Elegimos:** D — Repositorio en GitHub sin unir con vault de Obsidian (privado de Kenry).

**Por qué:** es la única opción que cumple con todos los criterios mas coherentes encontrados.

## Consecuencias

- **Lo que ganamos:** los tres documentan; historial de cada cambio; llegamos a la etapa de construcción sabiendo Git.
- **Lo que aceptamos perder:** Doble trabajo de parte de Kenry.
- **Riesgos y cómo los manejamos:**
	- Conflictos al editar la misma nota → cada uno sincroniza al empezar y al terminar; el documentador de la semana es el único que edita la bitácora.
	- Que no se sincronicen correctamente el repositorio con el vault.

## Historial

- 19-oct — Propuesta y cerrada la opción D.