---
project: "[[000 - Motor IRM]]"
type: registro
registro: trazabilidad
updated:
---
**[[000 - Motor IRM|← Hub]]** · **[[010 - Development - MIRM|🛠️ Centro de trabajo]]** · **[[Glosario - MIRM|📖 Glosario]]** · **[[Preguntas - MIRM|❓ Preguntas]]** · **[[Reglas de negocio - MIRM|📏 Reglas]]** · **[[Requisitos - MIRM|📋 Requisitos]]** · **[[Trazabilidad - MIRM|🔗 Trazabilidad]]**

# 🔗 Matriz de trazabilidad — Motor IRM

> [!info] Cómo usar esta nota
> - **Qué guarda:** de dónde sale cada elemento del diseño y dónde se implementa cada regla o requisito.
> - **Cuándo se usa:** desde la etapa del **modelo conceptual (S3)**. Antes se deja vacía.
> - **Cómo se llena:** una fila por cada regla (`RN`) o requisito (`RF`). Las columnas se completan a medida que avanzan las etapas:
> 	- S3 → columna *conceptual*.
> 	- S5 → columna *relacional*.
> 	- S6 → columna *orientado a objetos*.
> - **Qué responde:**
> 	- ¿Está completo? → ninguna fila con huecos.
> 	- ¿Sobra algo? → todo elemento del modelo aparece en alguna fila.
> 	- ¿Qué hay que revisar si cambia una regla? → su fila.
> - **"Va en la aplicación":** si una regla no se puede garantizar en la base de datos, se escribe así en la columna relacional.
> - Guía completa: [[Knowledge - Cómo documentar un proyecto en Obsidian#3.7.5 Matriz de trazabilidad|Cómo documentar → Trazabilidad]]

**Valores permitidos**
- **Estado:** ⚪ Sin empezar · 🟡 Incompleta · ✅ Completa.

| Regla / requisito | Entidad o relación (conceptual) | Tabla o restricción (relacional) | Clase o método (OO) | Estado |
| ----------------- | ------------------------------- | -------------------------------- | ------------------- | ------ |
|                   |                                 |                                  |                     |        |
