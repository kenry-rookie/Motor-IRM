---
id: DEC-005
project: "[[Motor IRM]]"
stage: S3
status: Tomada
date: 2026-10-23
participants: Devans, Gustavo, Kenry
source: IA (redactada por Claude a pedido de Kenry, con lo decidido por el equipo)
reviewed: true
---
**[[Motor IRM|← Hub]]** · **[[S3 - Develop a Conceptual Model - MIRM|S3]]** · **[[DEC-004 - No Product Compatibility Record - MIRM|← DEC-004]]**

# DEC-005 — Managua Trip Expenses as Cash Withdrawal

## Contexto

- Q-029 ([[SRC-02 - Second Interview Owners - MIRM|SRC-02]]): los gastos del viaje a Managua (combustible y comida) se recuperan en los precios.
- Q-061 ([[SRC-04 - Follow-up Answers Owners - MIRM|SRC-04]]): *"ellos retiran el dinero de caja para cubrir esos gastos, al asignar los precios que tendrá cada producto tienden a subirle ligeramente el precio tomando en cuenta eso. No usan cálculos específicos por lo tedioso de evaluar tantas facturas"*.
- Q-052 (SRC-04): los retiros *"Son de caja, todo lo que es administración lo hacen los dueños, no se anotan por el momento."*
- En un viaje se compra a **varios proveedores** y **muchos productos**. Repartir el gasto del viaje entre cada producto exige un cálculo que hoy los dueños no hacen.

## Criterios

1. Que el dinero que sale de la caja quede registrado (hoy se pierde).
2. Que el costo de los productos siga saliendo de la factura (fuente confiable).
3. Que no se obligue a los dueños a hacer cálculos que hoy no hacen.

## Opciones

| Opción | Cómo funciona | A favor | En contra |
| --- | --- | --- | --- |
| A — No registrar el gasto del viaje | Sigue como hoy | Nada nuevo | El dinero sale de caja sin dejar rastro; las ganancias se ven más altas de lo que son |
| B — Repartir el gasto entre los productos | El sistema divide el gasto del viaje entre los productos comprados y lo suma a su costo | Costo "real" por producto | Cálculo complejo con varias facturas y proveedores; los dueños no lo hacen hoy; mezcla costo de factura con estimaciones |
| C — Registrar el gasto como **retiro de caja** | El gasto del viaje se registra como retiro de caja; al registrar cada producto, el dueño fija el precio considerando el viaje, como hace hoy | La caja cuadra; el costo sigue siendo el de la factura; respeta la forma actual | El sistema no calcula cuánto del viaje corresponde a cada producto |

**Comparación con los criterios**

| Criterio | A | B | C |
| --- | --- | --- | --- |
| 1. Caja registrada | ❌ | ✅ | ✅ |
| 2. Costo de factura | ✅ | ❌ | ✅ |
| 3. Sin cálculos nuevos | ✅ | ❌ | ✅ |

## Decisión

**Elegimos:** C — El monto que se usa en los viajes de compra a Managua se registra como **retiro de caja**. El aumento del precio se deja **a la hora de registrar el producto**: el dueño lo considera al fijar el precio de venta.

**Por qué:** en un viaje se compra a varios proveedores y muchos productos; modelar la distribución del gasto en el precio de cada producto al ingresarlo es tedioso y no refleja cómo trabajan.

## Consecuencias

- **Lo que ganamos:** la caja refleja el dinero que sale por los viajes; el costo de cada producto sigue saliendo de la factura.
- **Lo que aceptamos perder:** no se sabe con exactitud cuánto del viaje corresponde a cada producto.
- **Cambio respecto a hoy:** los retiros de caja hoy *"no se anotan"* (Q-052). Con esta decisión, **los retiros de caja pasan a registrarse**.
- **Reglas que salen de aquí:** BR-075, BR-076 y BR-077.
- **Abierto (equipo, S3/S4):** si el retiro de caja se modela como un concepto propio o dentro de un movimiento general. Un dato para esa discusión: un retiro de caja mueve **dinero**, no productos.
- **Punto a confirmar (equipo):** esta nota interpreta *"modelar la distribución en los precios a la hora de ingresar cada producto"* como la razón para **no** hacer el reparto automático (opción B). Si querían decir que el sistema **sí** debe ayudar a repartirlo, corregir la decisión.
- **Cuándo revisarla:** si los dueños piden conocer el costo real por producto incluyendo el viaje.

## Historial

- 23-oct — Tomada por el equipo al inicio de S3. Redactada por Claude a pedido de Kenry. **Pendiente de revisión del equipo** (`reviewed: false`).
