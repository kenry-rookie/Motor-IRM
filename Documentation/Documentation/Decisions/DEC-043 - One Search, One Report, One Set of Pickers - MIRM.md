---
id: DEC-043
project: "[[Motor IRM]]"
stage: S8
status: Tomada
date: 2026-11-10
participants: Kenry
source: IA (redactada e implementada por Claude a pedido de Kenry; prompt v2 §5.1.4–6)
reviewed: false
---
**[[Motor IRM|← Hub]]** · **[[DEC-042 - Balances and Commissions as SQL Views - MIRM|← DEC-042]]** · **[[DEC-044 - Motorcycle Brands and Models Only From Catalog - MIRM|DEC-044 →]]**

# DEC-043 — One Search, One Report, One Set of Pickers

## Contexto

- La búsqueda por texto estaba en tres lugares (`inventory.search`, `listProducts({search})`, `customer.list({search})`).
- `reports.daySummary` y `reports.period` calculaban cosas parecidas de dos maneras.
- Los selectores de producto, cliente y moto se repetían en varias pantallas.

## Decisión

- **Búsqueda:** un router `search` (`search.products`, `search.customers`) sobre el mismo servicio de `src/server/domain/search.ts`. Las listas paginadas solo navegan y filtran. Un solo componente de caja de búsqueda (`SearchField`) con botón **Buscar** visible.
- **Reportes:** solo `reports.period`. «Hoy» es el preset `from = to = hoy`. Devuelve además dinero por método, retiros, adelantos, neto de caja, órdenes abiertas y poco stock.
- **Selectores:** `src/app/_components/pickers.tsx` es el único lugar: `ProductPicker`, `CustomerPicker`, `MotorcyclePicker`, `MotorcycleModelSelect`, `ResponsibleSelect`.

**Por qué:** una regla, un lugar; menos pantallas que se comportan distinto.

## Consecuencias

- **Ganamos:** arreglar la búsqueda o un selector una vez arregla todas las pantallas.
- **Aceptamos:** las pantallas de lista hacen una consulta distinta cuando hay texto.

## Historial

- 10-nov — Implementada por Claude a pedido de Kenry; pendiente de revisión del equipo.
