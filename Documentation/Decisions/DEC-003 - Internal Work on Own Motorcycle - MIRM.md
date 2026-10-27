---
id: DEC-003
project: "[[Motor IRM]]"
stage: S3
status: Tomada
date: 2026-10-23
participants: Devans, Gustavo, Kenry
source: IA (redactada por Claude a pedido de Kenry, con lo decidido por el equipo)
reviewed: false
---
**[[Motor IRM|← Hub]]** · **[[S3 - Develop a Conceptual Model - MIRM|S3]]** · **[[DEC-002 - Reuse Statement From Previous Domain - MIRM|← DEC-002]]** · **[[DEC-004 - No Product Compatibility Record - MIRM|DEC-004 →]]**

# DEC-003 — Internal Work on Own Motorcycle

## Contexto

- El segmento 21 del [[Enhanced and Corroborated Domain Statement - MIRM|enunciado ampliado]] (*Consumo interno*) quedó 🟡: el caso del mecánico que repara su propia moto venía del borrador, sin fuente.
- En [[SRC-04 - Follow-up Answers Owners - MIRM|SRC-04]] (Q-060) los dueños confirmaron: *"Un mecánico puede reparar su propia moto, pero el taller tiene que estar vacío por el espacio que ocupa, si ocupa productos de la tienda los paga normalmente. En ese caso solo sería una venta mas, no se va a cobrar a sí mismo"*.
- El negocio tiene tres formas en que un producto o un trabajo sale del negocio: la **venta**, el **servicio a un cliente** (reparación) y el **consumo interno**. Si no se distinguen, el inventario y las comisiones dan números falsos: por ejemplo, una reparación del mecánico sobre su moto contaría como mano de obra y le generaría comisión.

## Criterios

1. Que el pago de los mecánicos refleje solo trabajos cobrados a clientes.
2. Que el inventario cuadre: todo producto que sale tiene una razón registrada.
3. Que se respete la forma actual de trabajar (sin crear procesos nuevos).

## Opciones

| Opción | Cómo funciona | A favor | En contra |
| --- | --- | --- | --- |
| A — Tratarlo como una reparación más | Se registra una reparación con el mecánico como cliente | No hay casos especiales | Genera mano de obra y comisión que no existen; ensucia los ingresos |
| B — No registrar nada | El trabajo y los productos quedan fuera del sistema | Lo más simple | Los productos usados descuadran el inventario |
| C — Sin mano de obra; los productos se registran | El trabajo no genera mano de obra ni comisión; los productos que use salen del inventario y se le cobran | Refleja lo que dijeron los dueños; el inventario cuadra | Hay que distinguir consumo interno, venta y servicio a cliente |

**Comparación con los criterios**

| Criterio | A | B | C |
| --- | --- | --- | --- |
| 1. Pago correcto | ❌ | ✅ | ✅ |
| 2. Inventario cuadra | ✅ | ❌ | ✅ |
| 3. Forma actual | ⚠️ | ✅ | ✅ |

## Decisión

**Elegimos:** C — El trabajo interno de un mecánico sobre su propia moto **no genera mano de obra cobrable**, pero **sí genera consumo de inventario** si usa productos comerciales. Se deben distinguir **consumo interno**, **venta** y **servicio a cliente**.

**Por qué:** es la única opción que cumple los tres criterios.

## Consecuencias

- **Lo que ganamos:** comisiones correctas e inventario que cuadra.
- **Lo que aceptamos:** el modelo debe poder clasificar toda salida de producto según su motivo.
- **Reglas que salen de aquí:** BR-054, BR-055 y BR-079 en [[Business Rules - MIRM|Business Rules]].
- **Punto a revisar (equipo):** según Q-060, el mecánico **paga** los productos (*"solo sería una venta mas"*). Entonces, en este caso concreto, la salida del producto es una **venta** al mecánico y no un consumo interno sin cobro. Confirmen si "consumo interno" queda para otras salidas sin cobro (por ejemplo, algo de la tienda usado para limpieza) o si este caso se registra solo como venta.
- **Relación con lo que siguen evaluando:** usar un único *movimiento de inventario* con motivo o separar un *retiro de caja* se decide en S3/S4. Esta decisión solo fija **qué se distingue**, no **cómo se modela**.
- **Cuándo revisarla:** si los dueños dicen que algunos productos se usan en la moto del mecánico sin cobrárselos.

## Historial

- 23-oct — Tomada por el equipo al inicio de S3. Redactada por Claude a pedido de Kenry. **Pendiente de revisión del equipo** (`reviewed: false`).
