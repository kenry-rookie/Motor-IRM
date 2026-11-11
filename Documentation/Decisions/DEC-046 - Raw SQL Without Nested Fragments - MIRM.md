---
id: DEC-046
project: "[[Motor IRM]]"
stage: S8
status: Tomada
date: 2026-11-10
participants: Kenry
source: IA (Claude, a pedido de Kenry; error encontrado por Kenry en su Mac)
reviewed: true
---
**[[Motor IRM|← Hub]]** · **[[DEC-045 - Login Only in App User - MIRM|← DEC-045]]** · **[[DEC-047 - Phone Number Format - MIRM|DEC-047 →]]**

# DEC-046 — Raw SQL Without Nested Fragments

## Contexto

- Con la app corriendo (Next.js + Turbopack), Clientes, Compras y Resumen fallaban: `argument of AND must be type boolean, not type jsonb` y `date_trunc(jsonb, date)`.
- Causa: un fragmento `Prisma.sql` / `Prisma.raw` / `Prisma.join` **dentro** de un `$queryRaw` no se reconocía como SQL y llegaba a PostgreSQL como un parámetro JSON. Las pruebas (Vitest) no empaquetan con Next, por eso pasaban.
- Resumen ya estaba roto desde el 10-nov (usaba `Prisma.raw`); nadie lo había notado.

## Decisión

- Ningún fragmento anidado. El SQL se arma como texto en `src/server/domain/sql.ts` (clase `Sql`) y **solo valores** van como parámetros (`$1`, `$2`…), con `$queryRawUnsafe`.
- Lo único que se pega al texto: listas de enteros revisadas una por una (`intList`) y palabras fijas elegidas de una lista blanca (orden, granularidad). Nunca texto que escribió el usuario.
- **Lección:** después de cambios en SQL crudo, probar también la app corriendo, no solo `npm test`.

## Historial

- 10-nov — Implementada por Claude; probada en la app de Kenry con el navegador.
