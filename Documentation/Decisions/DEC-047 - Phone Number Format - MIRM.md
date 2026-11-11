---
id: DEC-047
project: "[[Motor IRM]]"
stage: S8
transformation: Modelo
status: Tomada
date: 2026-11-10
participants: Kenry
source: IA (Claude, a pedido de Kenry)
reviewed: false
---
**[[Motor IRM|← Hub]]** · **[[DEC-046 - Raw SQL Without Nested Fragments - MIRM|← DEC-046]]** · **[[DEC-048 - Workshop Jobs From Catalog - MIRM|DEC-048 →]]**

# DEC-047 — Phone Number Format

## Decisión

| Caso | Se guarda así |
| --- | --- |
| Nicaragua (8 dígitos) | `8888-1111` (sin +505) |
| EE. UU. / Canadá | `+1 305-555-1234` |
| Centroamérica (502–507) | `+506 8888-1111` |
| Otro país | `+4915123456789` |

- Una sola regla en tres lugares: el campo da formato mientras se escribe (`PhoneInput`, `src/lib/phone.ts`), la API normaliza (`zPhone`) y la base lo exige (`mirm_phone_valid`, CHECK `ck_*_phone_format` en cliente, personal y proveedor).
- Migración 5 normaliza lo existente (`85687080` → `8568-7080`). Lo que no se pudo entender deja el CHECK como `NOT VALID`: las filas nuevas y editadas siempre se revisan.

## Historial

- 10-nov — Implementada por Claude a pedido de Kenry; pendiente de revisión del equipo.
