---
id: SRC-06
project: "[[Motor IRM]]"
type: observation
date: 2026-10-27
observer: Kenry (experiencia propia en talleres y ventas de repuestos informales; su hermano trabaja en este taller)
interviewees:
medium: Observación y experiencia del equipo (no es respuesta directa de los dueños)
source: IA (redactada por Claude a partir de lo que Kenry contó en el chat del 27-oct y de sus apuntes en Potential Entities)
ai_edit: "Claude — 2026-10-28: §7 (prueba de la moto) y §8 (abonos), contados por Kenry en el chat"
reviewed: false
---
**[[Motor IRM|← Hub]]** · **[[S3 - Develop a Conceptual Model - MIRM|S3]]** · **[[Questions - MIRM|❓ Questions]]**

# SRC-06 — Team Observations Oct 27

> [!warning] Tipo de fuente: observación
> Esta fuente **no** son palabras de los dueños. Es conocimiento del negocio que aporta el equipo: Kenry trabajó en talleres y ventas de repuestos parecidos, y su hermano trabaja en este taller. Es evidencia válida, pero lo que dice debe **confirmarse con los dueños con un ejemplo concreto** (por ejemplo, el kit de pistón de la XTZ 125) antes de pasar las reglas a *Validada*.

---

## 1. Marcas y gamas de un mismo repuesto

> "Suelen tener el mismo repuesto en distintas marcas, muchas veces ofrecen el repuesto original de la marca de la moto que lo fabrica, y tienen otras gamas que son 'de calidad media' y reducen precios, además de ofrecer también el mismo producto en su 'versión económica', lógicamente tienen precios distintos todos."

> "Normalmente se ofrece el producto, siguiendo la lógica anterior." *(cuando el cliente pide un repuesto)*

> "Al ser con tantos proveedores con que trabajan preguntan por marcas y otras gamas que el proveedor quiera ofrecerles." *(al comprar a proveedores)*

**Ejemplo:** el kit de pistón de la Yamaha XTZ 125 se vende en marca Yamaha (más caro, original), en marca Vini (calidad-precio) y en alguna marca genérica (económico).

**Gamas** (apuntes del 27-oct): alta (original), media (calidad-precio) y baja (genérica o económica).

## 2. Garantía de los productos

> "Las garantías suceden con pocos proveedores, normalmente no todos cubren eso."

## 3. Estados de una moto en el taller

> "No tienen formalizado el proceso." *(respuesta a Q-071)*

Los estados los define el equipo (diagrama del 27-oct en el [[S3 - Conceptual Model - MIRM|modelo conceptual]]).

## 4. Equipo para el comprobante y la venta

> "Tambien compraran un escaner de barra." *(lo que dijeron los dueños, contado por Kenry)*

> "El sistema tiene que ser capaz de permitirnos ajustar los formatos, porque eso se sabrá hasta cuando vaya a entregarse." *(impresora sin decidir: Q-075)*

## 5. Puesta en marcha

> "Hay que poder registrar cada movimiento inicial del negocio para cuando lo vayamos a montar y registrar todo." Kenry estará en el negocio unas semanas ayudando a vender y registrar con los dueños.

## 6. Quién administra

> "Solo los dueños van a administrar este sistema." *(el encargado solo atiende ventas, BR-008)*

## 7. Prueba de la moto al entregarla *(agregado 28-oct)*

> "Estamos seguros que siempre se pide al cliente que recibe su moto, es vida real." *(Kenry, 28-oct, sobre la prueba de la moto antes de recibirla)*

El diagrama de estados del equipo agrega el estado *EN_PRUEBA*: si en la prueba falla lo trabajado, se corrige **sin cobro**; si aparece otra falla, se consulta como falla adicional. → BR-094, BR-095. Es un agregado del equipo; se confirma con los dueños **solo para el registro** (Q-080).

## 8. Abonos de los clientes *(agregado 28-oct)*

> "El abono ellos solo restan de la cuenta que anotan en el celular […] es un negocio informal, nosotros estamos formalizando como equipo, propuesta nuestra, ellos solo saben de dinero que les paguen y ya." *(Kenry, 28-oct)*

Los dueños no distinguen a qué operación va un abono. Cómo se aplica en el sistema es **propuesta del equipo** → DEC-009, BR-096.

---

## Notas sobre esta fuente

- Las secciones 1 y 2 son experiencia del equipo en negocios **parecidos**; hay que confirmarlas en **este** negocio.
- Los dueños enviaron la **foto de una factura de compra** (sin lista completa de productos). Falta guardarla en el proyecto como fuente de documento (por ejemplo, `SRC-07 - Purchase Invoice Photo`), porque sirve para probar la base de datos y para confirmar la sección 1.
