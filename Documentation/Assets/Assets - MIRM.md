---
project: "[[Motor IRM]]"
type: index
updated: 2026-10-28
source: IA (índice redactado por Claude a pedido de Kenry, a partir de la revisión del proyecto del 28-oct)
ai_edit: "Claude — 2026-10-28: nota creada; MER/EER en Mermaid (sin exportación por ahora); esquema relacional en Mermaid; esquema en PostgreSQL"
reviewed: false
---
**[[Motor IRM|← Hub]]** · **[[010 - Development - MIRM|🛠️ Development]]**

# 🗂️ Assets — Motor IRM

> [!info] Qué es esta carpeta
> - **Qué guarda:** archivos de **referencia** que se consultan pero no se editan como un registro vivo: imágenes y exportaciones de diagramas, enunciados, fotos de documentos del negocio y entregables.
> - **Qué no guarda:**
> 	- **La explicación de la evidencia:** la imagen puede vivir aquí, pero la nota que la explica es una fuente en `Sources/` (por ejemplo, la foto de la factura → SRC-07).
> 	- **Análisis y trabajo de etapa:** van en `Stages/`; lo que ya cumplió su función va en `Archive/`.
> 	- **Código y DDL:** viven en GitHub (`db/postgres/`); aquí solo el enlace o una captura.
> - **Fuente de verdad:** si un diagrama existe como Mermaid en una nota, **el Mermaid manda**; la imagen es una copia y se vuelve a exportar cuando cambia.

## Convenciones

- Nombre en inglés con ` - MIRM`; las exportaciones llevan la versión (`… v2.1 - MIRM.png`).
- Cada archivo se enlaza desde la nota que lo explica (columna *Dónde se usa*).
- **Privacidad:** nada con cédulas, direcciones o teléfonos de clientes en lo que se sube a GitHub (DEC-001). Un archivo de carga inicial con datos reales no se sube.
- **Estado:** ✅ Vigente · 📦 Histórico (se conserva como evidencia) · ⚠️ Por resolver.

## Inventario

| Archivo | Qué es | Etapa | Autor / fuente | Estado | Dónde se usa |
| --- | --- | --- | --- | --- | --- |
| [[Domain Statement - MIRM]] | Enunciado del intento 1, reutilizado como borrador. | S1 | Intento 1 | 📦 Histórico (lo reemplaza el enunciado ampliado) | DEC-002, S1 |
| [[Enhanced and Corroborated Domain Statement - MIRM]] | Enunciado ampliado y corroborado con SRC-01 a SRC-03. | S2 | Equipo + revisión IA | ✅ Vigente | S2, S3 |
| [[Technology Recommendations - MIRM]] | Recomendación de tecnologías, arquitectura, alojamiento y precios (oct-2026). | S3–S4 | IA (Claude) | ✅ Vigente como referencia | DEC-006 |
| [[Diagrama_estados_servicio_mecanico.png]] | Exportación del diagrama de estados del servicio mecánico (incluye EN_PRUEBA). | S3 | Equipo | ✅ Vigente (copia del Mermaid del modelo conceptual §4.1) | Modelo conceptual §4.1 · Potential Entities |
| `Screenshot 2026-10-27 at 11.01.35 PM.png` | Captura del borrador ER del equipo en Mermaid Live (personal, liquidacion_semanal, retiro_efectivo). Estaba en `Stages/` y el 28-oct ya no está en la carpeta del proyecto. | S3 | Equipo | ⚠️ Ubicarla, moverla aquí y renombrarla `Team ER Draft 2026-10-27 - MIRM.png` | Potential Entities |
| `Pasted image 20261027192526.png` | Imagen incrustada en *Potential Entities*. No está en la carpeta del proyecto (probablemente en la carpeta de adjuntos del vault). | S3 | Equipo | ⚠️ Ubicarla y moverla aquí | Potential Entities |

## Pendientes por agregar

| Archivo | Para qué | Cuándo |
| --- | --- | --- |
| Foto de la factura de compra | Imagen aquí y nota **SRC-07** en `Sources/`; también sirve como datos reales para probar la base. | Ya se recibió |
| Exportación del MER/EER (solo si hace falta una imagen) | Los diagramas viven en **Mermaid** dentro de [[S4 - ER and EER Model - MIRM]]; aquí solo se guarda una exportación con versión si alguien la necesita fuera de Obsidian. | Cuando se cierre S4 |
| Esquema en PostgreSQL | Captura del diagrama de la base creada (DBeaver o pgAdmin) + enlace al script en GitHub (`db/postgres/`). | 29-oct |
| Exportación del esquema relacional (solo si hace falta una imagen) | Los diagramas viven en **Mermaid** dentro de [[S5 - Relational Schema - MIRM]]. | Cuando se cierre S5 |
| Entregable del 05-nov | Lo que se presente en clase. | 05-nov |
| Plantilla del comprobante | Formato A4 o ticket, cuando se sepa la impresora (Q-075). | Versión del negocio |
| Plantilla de carga inicial | Excel o CSV de productos, existencias y saldos (P-08), **sin datos reales en GitHub**. | Puesta en marcha |

## Archivo (`Archive/`)

Notas del ciclo 2 que ya cumplieron su función. No se eliminan: guardan cómo se llegó al resultado.

| Nota | Por qué se archivó |
| --- | --- |
| [[Potential Entities And Observations- MIRM]] | Resuelta en S3 (cierre de S3 y modelo conceptual §10). Es la versión del equipo del 26-oct, con sus imágenes. |
| [[Project Gaps and Technology Recommendations - MIRM]] | Revisión de la IA del 26-oct: la Parte A se resolvió en S3 y la Parte B la reemplazó *Technology Recommendations*. |
