---
id: DEC-008
project: "[[Motor IRM]]"
stage: S3
status: Tomada
date: 2026-10-27
participants: Devans, Gustavo, Kenry
source: IA (redactada por Claude; la opción la eligió el equipo el 28-oct)
ai_edit: "Claude — 2026-10-28: historial (revisada por el equipo)"
reviewed: true
---
**[[Motor IRM|← Hub]]** · **[[S3 - Conceptual Model - MIRM|Modelo conceptual]]** · **[[DEC-007 - Inventory Movement and Cash Withdrawal - MIRM|← DEC-007]]** · **[[DEC-009 - Credit per Operation - MIRM|DEC-009 →]]**

# DEC-008 — Separate Brand Catalogs and Product Tier

## Contexto

- Q-048 ([[SRC-04 - Follow-up Answers Owners - MIRM|SRC-04]]): las motos se identifican por **modelo y color**.
- [[SRC-06 - Team Observations Oct 27 - MIRM|SRC-06]]: un mismo repuesto se vende en **varias marcas y gamas** (kit de pistón XTZ 125: Yamaha, Vini, genérico), cada una con su precio. A los proveedores también se les compra por marca.
- **Yamaha es a la vez marca de motos y de repuestos.**
- DEC-004: no se registra la compatibilidad entre productos y modelos de moto.

## Criterios

1. Que una marca se escriba **siempre igual** (sin "UMA", "Uma" y "U.M.A." a la vez).
2. Que cada marca de un repuesto pueda ser un producto con su propio precio y existencia.
3. No reintroducir la compatibilidad de forma disimulada (DEC-004).
4. El menor número de entidades que cumpla lo anterior.

## Opciones

| Opción | Cómo funciona | A favor | En contra |
| --- | --- | --- | --- |
| A — Marca como texto | Modelo y producto guardan la marca escrita | Sin entidades nuevas | Falla el criterio 1 |
| B — *Marca de moto* y *Marca de producto* | Dos catálogos separados | Cada uno tiene solo lo suyo | Yamaha queda escrita dos veces; dos catálogos iguales |
| C — Una sola *Marca* | La usan *Modelo de moto* y *Producto* | Un catálogo; Yamaha una vez | Habrá marcas que solo tienen productos (Vini, genéricas): no es un problema |

## Decisión

**Elegimos:** B — **Dos entidades: *Marca de moto* y *Marca de producto*.**
- *Marca de moto* se relaciona con *Modelo de moto* (cada modelo tiene una marca).
- *Marca de producto* se relaciona con *Producto* (cada producto tiene una marca; las genéricas también se registran, por ejemplo "Genérico").

**Por qué:** cada catálogo tiene solo lo suyo. Al registrar una moto no aparecen marcas que solo hacen repuestos (Vini, genéricas), y al registrar un producto no aparecen marcas que solo hacen motos. El significado de cada una queda claro.

**Gama del producto:** atributo del **producto**, con los valores *alta (original)*, *media (calidad-precio)* y *baja (genérica)*. Lo escribe el dueño. **No se calcula** a partir de la marca de la moto, porque eso exigiría compatibilidad (DEC-004).

## Consecuencias

- **Ganamos:** marcas consistentes dentro de cada catálogo; las tres versiones de un repuesto aparecen juntas al buscar por nombre, cada una con marca, gama, precio y existencia.
- **Aceptamos:** las marcas que hacen motos y repuestos (Yamaha, UMA) quedan escritas en los dos catálogos. Saber "todo lo de Yamaha" exigiría unir por el nombre.
- **Aceptamos:** no hay una entidad que agrupe "el mismo repuesto en varias marcas". Para la versión 1 basta con una **regla de nombres** (por ejemplo, "Kit pistón XTZ 125") acordada al cargar el inventario. Agruparlos queda para una versión posterior.
- **Reglas:** BR-089, BR-090.
- **Cuándo revisarla:** si buscar por nombre no alcanza para vender rápido, se agrega la entidad que agrupa las variantes.

## Historial

- 27-oct — Propuesta de la IA: una sola *Marca*.
- 28-oct — **Tomada por el equipo: opción B (dos catálogos).** Redactada por Claude a pedido de Kenry. Revisada por el equipo.
