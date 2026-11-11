---
id: DEC-044
project: "[[Motor IRM]]"
stage: S8
status: Tomada
date: 2026-11-10
participants: Kenry
source: IA (redactada e implementada por Claude a pedido de Kenry; prompt v2 §5.1.7 y §7.4)
reviewed: false
---
**[[Motor IRM|← Hub]]** · **[[DEC-043 - One Search, One Report, One Set of Pickers - MIRM|← DEC-043]]** · **[[DEC-045 - Login Only in App User - MIRM|DEC-045 →]]**

# DEC-044 — Motorcycle Brands and Models Only From Catalog

## Contexto

- La recepción en un paso (10-nov) creaba marca y modelo con lo que se escribía. Así podían quedar «Bajaj», «bajaj » y «Bajah» como tres marcas.

## Decisión

- `service.receive` recibe el **id** del modelo (`motorcycleModelId`); se eliminó el «find-or-create» por texto. La FK `fk_motorcycle_motorcycle_model_id` lo exige en la base.
- En la recepción y en «Nuevo cliente», marca y modelo se **eligen de listas** (`MotorcycleModelSelect`).
- Si falta, el botón **«+ Registrar marca o modelo»** solo aparece con el permiso `catalogos.gestionar` (dueños). Abre un diálogo encima y vuelve con el modelo elegido, sin perder lo ya escrito. A quien no tiene el permiso se le dice que se lo pida a un dueño.

**Por qué:** el catálogo crece en orden; los reportes por marca no se parten en variantes mal escritas.

## Consecuencias

- **Aceptamos:** un paso más cuando llega una marca nueva (pasa pocas veces).
- **Fase 2:** la recepción guardará el borrador para no perder nada si se cambia de pantalla.

## Historial

- 10-nov — Implementada por Claude a pedido de Kenry; pendiente de revisión del equipo.
