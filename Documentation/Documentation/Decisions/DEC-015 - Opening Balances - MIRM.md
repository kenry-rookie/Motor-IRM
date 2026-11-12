---
id: DEC-015
project: "[[Motor IRM]]"
stage: S4
status: Tomada
date: 2026-10-28
participants: Devans, Gustavo, Kenry
source: IA (redactada por Claude a pedido de Kenry; recomendación de la IA aceptada por el equipo)
reviewed: true
---
**[[Motor IRM|← Hub]]** · **[[S4 - Entity-Relationship Model and EER - MIRM|S4]]** · **[[S4 - ER and EER Model - MIRM|MER/EER v1]]** · **[[DEC-014 - Exclusive Arc for Inventory Movement Origin - MIRM|← DEC-014]]** · **[[DEC-016 - Surrogate Primary Keys - MIRM|DEC-016 →]]**

# DEC-015 — Opening Balances (Saldos iniciales)

## Contexto

- Cuando el sistema arranque, algunos clientes ya deben dinero y el negocio ya le debe a algunos proveedores (Q-078).
- Si los saldos iniciales no se registran, las deudas calculadas empezarían en cero y estarían mal.
- Hay que prever este caso para que al cargar los registros reales todo funcione correctamente; y si no existen deudas al momento de arrancar, que el mecanismo quede disponible por cualquier cosa.

## Criterios

1. Que la deuda total del cliente y la del proveedor sean correctas desde el día uno.
2. Que los créditos, pagos y abonos de un saldo inicial funcionen igual que los de una venta o servicio (sin casos especiales en el código).
3. Que si no hay deudas previas, el mecanismo no estorbe.

## Opciones

### Para clientes

| Opción | Cómo funciona | A favor | En contra |
| --- | --- | --- | --- |
| A — Atributo *saldo de apertura* en Cliente | Un número que se resta al calcular la deuda | Simple | No tiene vencimiento, ni crédito, ni pagos; los abonos no se pueden aplicar a un saldo que no es un documento |
| B — Subclase *Saldo inicial* de Documento cobrable ([[DEC-011 - Billable Document Superclass - MIRM\|DEC-011]]) | Una deuda anterior es un documento cobrable sin líneas, con su crédito y sus pagos | Pagos y créditos funcionan igual; la deuda total se calcula sin caso especial | Un registro más por cada deuda anterior |

### Para proveedores

| Opción | Cómo funciona | A favor | En contra |
| --- | --- | --- | --- |
| X — Atributo *saldo de apertura* en Proveedor | Un número que se resta; se ajusta manualmente al pagar | Simple; basta mientras Q-070 no se responda | No hay historial de pagos sobre ese saldo |
| Y — Compra de saldo inicial (análoga a la opción B) | Una compra sin líneas | Consistente | Q-070 (un pago cubre varias facturas) puede cambiar la estructura |

## Decisión

**Elegimos:**

- **Clientes:** B — **Subclase *Saldo inicial de cliente*** de *Documento cobrable* (tercera subclase de G-1, [[DEC-011 - Billable Document Superclass - MIRM|DEC-011]]).
  - Es un documento cobrable sin líneas (solo el monto y una descripción opcional).
  - Genera un *Crédito* con su fecha de vencimiento y su saldo.
  - Los pagos se aplican exactamente igual que a cualquier otro documento (Aplicación de pago, BR-096).
  - Si no hay deudas anteriores, simplemente no se crean registros de este tipo.
- **Proveedores:** X — **Atributo *saldo de apertura*** en *Proveedor* (provisional mientras Q-070 no se responda).
  - Se registra el monto que se le debe al proveedor al arrancar.
  - Se ajusta manualmente cuando se paga.
  - Cuando se responda Q-070 (si un pago cubre varias facturas), se decidirá si conviene una compra de saldo inicial o si basta con el atributo.

## Consecuencias

- **Ganamos:** cumple los tres criterios para clientes. Para proveedores, cumple el criterio 1 de forma básica (el saldo es correcto) y el criterio 3 (no estorba si no hay deudas).
- **Aceptamos:** la parte de proveedores es provisional. El atributo *saldo de apertura* no tiene historial de pagos: si un proveedor tiene saldo inicial y se le hacen pagos parciales, el ajuste del atributo es manual o se hace en la aplicación. Esto se resuelve cuando se responda Q-070.
- **Cuándo revisarla:** cuando se responda Q-070 y Q-078.

## Historial

- 28-oct — Recomendación de la IA como decisión provisional en el MER v1 (§3 diagramas A y C, §4 EER-1).
- 01-nov — Revisada y aceptada por el equipo al cerrar S4. DEC redactada por Claude a pedido de Kenry; pendiente de revisión del equipo.
