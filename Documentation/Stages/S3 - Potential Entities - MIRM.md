---
project: "[[Motor IRM]]"
stage: S3
type: stage-product
status: 🟡 Revisada por IA — pendiente de revisión del equipo
started: 2026-10-22
finished:
source: Equipo (lista y apuntes del 26-oct) + IA (revisión y recomendaciones de Claude, 26-oct)
reviewed: false
---
**[[Motor IRM|← Hub]]** · **[[S3 - Develop a Conceptual Model - MIRM|← S3]]** · **[[S3 - Conceptual Model - MIRM|Modelo conceptual →]]** · **[[Business Rules - MIRM|📏 Business Rules]]**

# S3 - Potential Entities - MIRM

El objetivo de esta fase es identificar **qué existe en el dominio** (entidades) y **cómo se relaciona entre sí**, en lenguaje natural, antes de formalizar atributos, claves o cardinalidades exactas.

> [!info] Qué cambió en esta nota (26-oct)
> - La **lista original del equipo** quedó intacta al final → [[#Versión del equipo (26-oct)]].
> - Las **respuestas de los dueños** que estaban aquí pasaron a su fuente → [[SRC-05 - Owners Answers Oct 26 - MIRM|SRC-05]], y de ahí a [[Questions - MIRM|Questions]] y [[Business Rules - MIRM|Business Rules]].
> - Arriba está la **revisión de la IA**: qué candidata se acepta, cuál se fusiona, cuál pasa a ser atributo y cuál se descarta, **siempre con su razón y su regla** (lo pide la puerta S3 del [[Restart Plan - MIRM|Restart Plan]]).
> - El resultado ya ordenado, con atributos y relaciones, está en el [[S3 - Conceptual Model - MIRM|modelo conceptual]].

## 1. Cómo se evaluó cada candidata

Una candidata es **entidad** si cumple las tres pruebas:

1. **Existe en el negocio** y alguna regla la nombra (fuente).
2. **Tiene datos propios** que hay que guardar (no es solo un dato de otra cosa).
3. **Hay varias** y cada una se distingue de las demás (tiene identidad).

Si falla la 2 o la 3, casi siempre es un **atributo** de otra entidad. Si su valor **se calcula** a partir de otros datos, es un **dato derivado** (una consulta o vista), no una entidad. Si dos candidatas tienen **los mismos datos y las mismas relaciones**, son **la misma entidad** con un campo que dice de qué tipo es.

## 2. Revisión de la lista del equipo

| # | Candidata del equipo | Veredicto | Queda como | Razón | Reglas |
| --- | --- | --- | --- | --- | --- |
| 1 | Productos | ✅ Aceptada | **Producto** | Cosa que se compra, se vende y se cuenta. Nombre en singular: una entidad representa *un* producto. | BR-004, BR-005, BR-014 a BR-016, BR-020 |
| 2 | Servicio_Mecánico | ✅ Aceptada (renombrada) | **Reparación** | Es el trabajo que se le hace a una moto. "Reparación" es como lo dicen en el negocio (glosario) y evita confundirlo con el *catálogo* de servicios (engrase, motor). | BR-003, BR-021 a BR-037, BR-080 |
| 3 | Detalle_Servicio_Mecánico | ✅ Aceptada (renombrada) | **Detalle de reparación** | Cada línea de lo que se cobra: mano de obra, producto de la tienda, producto del cliente o trabajo externo (torno). | BR-003, BR-027, BR-032, BR-037, BR-082 |
| 4 | Entrega_Motocicleta (+ "Motivo") | 🔁 Pasa a atributo y estado | **Reparación**: fecha de entrega + estado *Entregada* o *Cancelada* | La entrega ocurre **una vez por reparación** y no tiene datos propios aparte de la fecha. Una relación uno a uno sin datos propios es señal de atributo. El "motivo" (realizado o cancelado) es el **estado** de la reparación. | BR-035, BR-080 |
| 5 | Garantía_Servicio | 🔁 Aceptada (redefinida) | **Reclamo de garantía** | Lo que ocurre es un **reclamo** del cliente sobre una reparación anterior: tiene fecha, descripción y resultado. La interpretación del equipo (sin cobro, sin pago al mecánico, sin movimiento de inventario) no es del todo cierta: si falla **una pieza instalada**, la pieza se cambia y **sí sale del inventario** (BR-071). Lo del pago al mecánico y la devolución de dinero → Q-068. | BR-071 a BR-074 |
| 6 | Categoría_Producto | ✅ Aceptada | **Categoría de producto** | Se repite en muchos productos; tenerla aparte evita escribirla distinto cada vez. | BR-004 |
| 7 | Movimiento_Inventario | ✅ Aceptada | **Movimiento de inventario** | Registra **cada entrada y salida de producto** con su motivo. De aquí se calcula la existencia. | BR-020, BR-079 |
| 8 | Modelo_Moto | ✅ Aceptada | **Modelo de moto** | Identifica a la moto junto con el color (Q-048). Tenerlo como catálogo evita escribir el mismo modelo de varias formas. | BR-041 |
| 9 | Marca_Moto | 🔁 Pasa a atributo | **Modelo de moto**: marca | Ninguna regla pide datos de la marca aparte del nombre, y DEC-004 quitó la compatibilidad. Si algún día la marca necesita datos propios, se separa. | BR-041, DEC-004 |
| 10 | Retiro_Caja | ✅ Aceptada | **Retiro de caja** | Mueve **dinero**, no productos. Por eso no cabe en *Movimiento de inventario* (ver §4). | BR-011, BR-075 a BR-077 |
| 11 | Proveedor | ✅ Aceptada | **Proveedor** | | BR-012, BR-013, BR-017, BR-018 |
| 12 | Compra | ✅ Aceptada | **Compra** | Corresponde a una factura de compra. | BR-013, BR-017 |
| 13 | Detalle_Compra | ✅ Aceptada | **Detalle de compra** | Una línea por producto de la factura, con su costo. | BR-014 |
| 14 | Deuda_Proveedor | 🔁 Se reemplaza | **Pago a proveedor** (nueva) + saldo **derivado** | La deuda no se guarda: se **calcula** (total de la compra al crédito − pagos). Lo que sí existe y hay que registrar es cada **pago** al proveedor. | BR-017 |
| 15 | Credito_Cliente | 🔀 Fusionada | **Crédito** | Está repetida con "Crédito" (#25). | BR-062 a BR-068 |
| 16 | Devolución | ✂️ Se divide | **Devolución de cliente** y **Devolución a proveedor** | Son dos cosas distintas: una se relaciona con una **venta** (cambio o reembolso); la otra con una **compra** (producto dañado que cubre el proveedor). Distinta contraparte, distinto dinero, distinta relación. | BR-018, BR-069, BR-070 |
| 17 | Diagnóstico (DUDA) | 🔁 Pasa a atributo | **Reparación**: falla reportada + diagnóstico | El diagnóstico es parte de una reparación (BR-022), no algo que exista solo. Si se cobrara aparte, sería una línea de *Detalle de reparación* → Q-073. | BR-022 |
| 18 | Mecánico | 🔁 Se amplía | **Personal** (rol: dueño, mecánico o encargado) | Una reparación la puede hacer **un mecánico o un dueño** (BR-024, BR-051), y los dueños y el encargado **registran y autorizan** operaciones (BR-007 a BR-011). Con una sola entidad *Personal* y un rol se cubren los tres casos. Es candidata a **especialización** en S4 (EER). | BR-007 a BR-011, BR-024, BR-044, BR-051 |
| 19 | Pago_Mecánico | ✅ Aceptada (renombrada) | **Pago semanal** | Es el pago del sábado: agrupa las reparaciones de la semana y descuenta los adelantos. | BR-045 a BR-049, BR-081 |
| 20 | Adelanto_Pago_Mecánico | ✅ Aceptada | **Adelanto** | | BR-048, BR-049 |
| 21 | Historial_Reparacion | ❌ Descartada (derivado) | Consulta: *todas las reparaciones de una moto* | El historial no es algo nuevo que se registre: son las reparaciones que ya existen, filtradas por moto. Guardarlo aparte duplicaría datos y podrían no coincidir. | BR-042 |
| 22 | Cliente | ✅ Aceptada | **Cliente** | | BR-038 a BR-040 |
| 23 | Venta | ✅ Aceptada | **Venta** | | BR-002, BR-056, BR-060 |
| 24 | Detalle_Venta | ✅ Aceptada | **Detalle de venta** | Guarda el **precio con el que se vendió**, porque el precio del producto cambia (BR-016). | BR-016 |
| 25 | Crédito | ✅ Aceptada | **Crédito** | Tiene datos propios: plazo, vencimiento, extensión, interés y varios pagos. | BR-062 a BR-068 |
| 26 | Pago_Del_Cliente | ✅ Aceptada (renombrada) | **Pago de cliente** | Un cobro puede ser en córdobas o dólares, en efectivo o transferencia, y un crédito puede pagarse en dos partes. | BR-056 a BR-059, BR-066 |
| 27 | Pago_Tributario | 🔀 Fusionada | **Retiro de caja** (motivo: impuesto) | Tiene los mismos datos que un retiro (fecha, monto, motivo, quién lo hace) y las mismas relaciones. Separarlo solo tendría sentido si tuviera datos propios. | BR-078 |

**Resumen:** 27 candidatas → 17 aceptadas (algunas renombradas), 2 redefinidas o ampliadas (*Garantía* → *Reclamo de garantía*; *Mecánico* → *Personal*), 2 fusionadas, 3 pasan a atributo o estado, 1 se divide en dos, 1 se reemplaza y 1 se descarta por ser un dato derivado.

## 3. Entidades que faltaban (recomendadas)

| Recomendada | Por qué hace falta | Reglas |
| --- | --- | --- |
| **Moto** | La lista tiene *Modelo* y *Marca*, pero **no la moto misma**. Sin ella no hay a qué asociar las reparaciones ni el historial. Es la omisión más importante. | BR-041 a BR-043 |
| **Falla adicional** | Cuando el cliente **rechaza** una falla adicional, la moto se entrega **sin garantía sobre esa falla** (BR-028). Si no queda registrado que se le advirtió, no hay forma de responder un reclamo después. Las aceptadas generan líneas en el detalle. | BR-026 a BR-028 |
| **Pago a proveedor** | Reemplaza a *Deuda_Proveedor*: lo que se registra es el pago; la deuda se calcula. | BR-017 |
| **Devolución a proveedor** | Sale de dividir *Devolución*. | BR-018 |
| **Servicio** (catálogo, opcional) | Algunos servicios tienen precio de referencia (motor) y otros varían según la moto (engrase). Sirve para registrar más rápido, pero el precio final siempre se escribe en la línea. | BR-030, BR-031 |
| **Historial de precio** (versión 2) | Los dueños dijeron que sería bueno, pero no es necesario (Q-001). Se deja anotado para después. | BR-016, SRC-05 |

## 4. Sobre *Movimiento de inventario* vs. *Retiro de caja*

No son alternativas: **modelan cosas distintas**, y el modelo conceptual las tiene a las dos.

| | Movimiento de inventario | Retiro de caja |
| --- | --- | --- |
| Qué se mueve | **Productos** (cantidad) | **Dinero** (monto) |
| Se relaciona con | Un producto y el documento que lo originó (compra, venta, reparación, devolución, garantía) | El dueño que lo hizo y un motivo (viaje, limpieza, impuesto) |
| Ejemplo | Se usan 2 bujías en una reparación | Se sacan C$800 para el impuesto |

Si se forzara el retiro de caja dentro de *Movimiento de inventario*, la mitad de las filas tendrían "producto" y "cantidad" vacíos, y la otra mitad "monto" vacío. Eso indica que son **dos entidades**. Se recomienda registrar la elección en una decisión (DEC-007) para cerrar la discusión del equipo.

## 5. Sobre la pregunta de análisis (reparación cancelada)

Muy buena pregunta: encontró un caso que ninguna fuente había cubierto. Con la respuesta de los dueños (SRC-05) quedó la regla **BR-080**. En el modelo no se crea una entidad nueva: la reparación pasa al estado **Cancelada** y guarda el **monto cobrado por cancelación**. Queda abierto si el mecánico gana comisión de ese cobro → Q-067.

---

## Versión del equipo (26-oct)

> [!quote]- Lista original y apuntes del equipo (sin cambios)
> # S3 - Potential Entities - MIRM
>
> El objetivo de esta fase es identificar **qué existe en el dominio** (entidades) y **cómo se relaciona entre sí**, en lenguaje natural, antes de formalizar atributos, claves o cardinalidades exactas.
>
> ## 1.1 Entidades candidatas
>
> Productos
> Servicio_Mecánico
> Detalle_Servicio_Mecánico
>
> Entrega_Motocicleta (Puede tener una entidad "Motivo": realizado o cancelado)
> Garantía_Servicio (Según interpretación a las reglas del negocio, una garantía no genera ni un movimiento de inventario, no hay cobro al cliente, no hay pago a mecánico, no hay movimiento de invetario. A menos que se siga reportando la misma falla y los dueños decidan devolver el dinero)
>
> Categoría_Producto
> Movimiento_Inventario
> Modelo_Moto
> Marca_Moto
> Retiro_Caja
> Proveedor
> Compra 
> Detalle_Compra
> Deuda_Proveedor
> Credito_Cliente
> Devolución
> Diagnóstico (DUDA)
> Mecánico
> Pago_Mecánico
> Adelanto_Pago_Mecánico
> Historial_Reparacion
> Cliente
> Venta
> Detalle_Venta
> Crédito
> Pago_Del_Cliente
> Pago_Tributario
>
>
> Pregunta de Análisis
> ¿Qué pasa si hay una orden de trabajo que el cliente termina cancelando si hay un progreso previo hecho?
>
> RESPUESTA POR LOS DUEÑOS (26 DE OCTUBRE, 2026) Se cobra por desarmar la moto, por ejemplo, si el trabajo original era de C$1,800, se le cobran C$1,000
>
> Estado (Revisión: para revisar mas a detalle los estados de las motos que ocupan espacio en ese momento en el taller).
>
> Q-065
> Los descuentos si se descuentan del pago y únicamente en efectivo pagan en el negocio.
>
> Q-034
> Solo se le entrega al cliente un comprobante de lo que pagó para que reponga el dinero gastado.
>
> Q-001
> Si, sería bueno, a pesar de no ser una necesidad.
>
> Qué esperan del sistema y qué les hace perder más tiempo y dinero.?
>
> Solo que puedan dilatarse menos vendiendo.
