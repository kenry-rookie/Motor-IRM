---
id: DEC-041
project: "[[Motor IRM]]"
stage: S8
transformation: Modelo
status: Tomada
date: 2026-11-10
participants: Kenry
source: IA (redactada e implementada por Claude a pedido de Kenry; prompt v2 §8.1, respuestas de los dueños del 10-nov)
reviewed: false
---
**[[Motor IRM|← Hub]]** · **[[DEC-040 - Prisma Migrations as Single Source of Truth - MIRM|← DEC-040]]** · **[[DEC-042 - Balances and Commissions as SQL Views - MIRM|DEC-042 →]]**

# DEC-041 — Order Responsible: Mechanic or Owner

## Contexto

- A veces **un dueño repara la moto él mismo**, y eso no genera comisión para nadie.
- El mecánico «al 100 %» se queda con toda su mano de obra y **no se paga por el sistema**; se registra solo para saber qué moto atiende.
- La app exigía porcentaje para asignar: un dueño o el mecánico al 100 % no podían ser responsables.

## Opciones

| Opción | Cómo funciona | A favor | En contra |
| --- | --- | --- | --- |
| A — Tabla aparte de «responsables» | Nueva entidad | Separa conceptos | Una tabla más para lo mismo que `staff` |
| **B — `staff.kind` + `staff.can_repair`** | `kind` = DUENO / MECANICO / ENCARGADO; `can_repair` dice quién puede ser responsable; `commission_rate` NULL = sin comisión | Mínimo cambio; las reglas quedan en la base | Hay que mirar `kind` además del porcentaje |

## Decisión

**Elegimos:** B. La columna `service_order.mechanic_staff_id` se mantiene (ahora significa «responsable»).

| Regla | Dónde |
| --- | --- |
| `kind` ∈ DUENO, MECANICO, ENCARGADO | `ck_staff_kind` |
| Un dueño no tiene porcentaje | `ck_staff_owner_no_commission` |
| Sin responsable no hay porcentaje | `ck_service_order_rate_needs_responsible` |
| Al asignar: activo y que repare | trigger `tg_service_order_check_responsible` |
| Si el responsable es dueño, la orden no lleva porcentaje | mismo trigger |
| Las órdenes sin porcentaje no aparecen en comisiones | vista `v_mechanic_unpaid_commission` |

- Migración `4_staff_kind_and_balance_views`: los datos existentes se clasifican solos (usuario con rol «Dueño…» → DUENO; usuario sin porcentaje → ENCARGADO; el resto → MECANICO).
- Pantalla **Personal → Personas del negocio** para registrar a los dueños y al mecánico al 100 % (sin porcentaje).
- El seed crea al primer dueño como persona enlazada al usuario administrador.

**Por qué:** refleja lo que dijeron los dueños sin tablas nuevas, y la base lo protege aunque la app tenga un error.

## Consecuencias

- **Ganamos:** el tablero muestra quién atiende cada moto, sea mecánico o dueño, y si genera comisión.
- **Aceptamos:** un responsable por orden (Q abierta: ¿qué pasa si un dueño ayuda al mecánico en la misma moto?).
- **Cuándo revisarla:** si se reparte la comisión entre dos personas.

## Historial

- 10-nov — Implementada por Claude a pedido de Kenry; pendiente de revisión del equipo.
