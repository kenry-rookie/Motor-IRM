# ❓ Preguntas abiertas — Motor IRM

> Cómo usar esta nota
> - **Qué guarda:** todo lo que **no sabemos** y alguien (dueños, mecánicos, docente) debe responder.
> - **Cuándo agregar una fila:** cuando aparece una duda, cuando algo "parece obvio" pero nadie lo confirmó, o cuando una fuente se puede entender de dos formas.
> - **ID:** `Q-001`, `Q-002`… en orden. **Nunca se reutiliza** un ID, aunque la pregunta se descarte. Actualiza `siguiente_id` en las propiedades.
> - **Cómo escribirla:** abierta, sin inducir la respuesta. ❌ "¿Ustedes cobran por litro?" → ✅ "¿Cómo cobran el aceite que se usa en un servicio?"
> - **Cuando se responde:** se anota la respuesta **y la fuente** donde quedó registrada (`FTE-xx`). Lo que cambie se pasa a Glosario, Reglas o Requisitos.
> - Guía completa: [[Knowledge - Cómo documentar un proyecto en Obsidian#3.7.2 Preguntas abiertas|Cómo documentar → Preguntas]]


**Valores permitidos**
- **Prioridad:** 🔴 Alta (puede cambiar entidades o relaciones) · 🟠 Media (cambia reglas o cálculos) · 🟡 Baja (detalle).
- **Estado:** Abierta · Respondida · Descartada.
- **A quién:** Dueños · Mecánicos · Docente · Equipo.

| ID  | Pregunta | Por qué importa | Prioridad | A quién | Estado | Respuesta | Fuente de la respuesta |
| --- | -------- | --------------- | --------- | ------- | ------ | --------- | ---------------------- |
| Q-001 | ¿Cada cuánto y cómo cambian los precios de los productos? ¿Necesitan consultar cuándo cambió un precio y cuál era el anterior? | Define si hay que conservar cuándo cambió un precio y cuál era el anterior. | 🟠 Media | Dueños | Abierta | | |
| Q-002 | ¿Qué datos de contacto de cada proveedor usan realmente (persona, teléfono, correo…)? ¿Puede un proveedor tener varios contactos? | Define qué datos se guardan de cada proveedor y si un proveedor puede tener varios contactos. | 🔴 Alta | Dueños | Abierta | | |
| Q-003 | ¿Algunos productos vencen o se deterioran con el tiempo (aceites, baterías, llantas…)? | Si vencen, hace falta controlar lotes y fechas de vencimiento en el inventario. | 🔴 Alta | Dueños | Abierta | | |
| Q-004 | ¿Qué esperan del sistema? ¿Qué quisieran que haga y les resuelva? ¿Cómo imaginan que se manejará? | Define el alcance de la primera versión: qué debe hacer el programa. | 🔴 Alta | Dueños | Abierta |  |  |
| Q-005 | ¿Qué información de la factura (comprobante) quisieran ver como historial? | Define qué se guarda de cada venta y qué se imprime al cliente. | 🟠 Media | Dueños | Abierta |  |  |
| Q-006 | ¿Quién va a manejar el sistema? ¿Quién lo administra cuando los dueños no están? | Define quiénes son los usuarios. SRC-01 dice "principalmente uno de ellos, el mayor": confirmar. | 🔴 Alta | Dueños | Abierta |  |  |
| Q-007 | ¿Qué les hace perder más tiempo? ¿Qué problema quisieran solucionar primero? ¿Qué errores ocurren más? ¿Hay algo que les haga perder dinero? | Define las prioridades: qué tiene que resolver primero el programa. | 🔴 Alta | Dueños | Abierta |  |  |
| Q-008 | ¿Quién hace cada tarea: vender, cobrar, calcular los pagos a mecánicos, recibir productos, autorizar descuentos, revisar inventario, administrar créditos, decidir qué comprar? | Define quién registra cada operación y quién necesita ver qué. | 🔴 Alta | Dueños | Abierta |  |  |
| Q-009 | ¿Cómo se determina el límite de crédito de un cliente? | Define si existe un límite y quién lo decide. | 🟠 Media | Dueños | Abierta |  |  |
| Q-010 | Cuando no están los dueños, ¿cómo se manejan los créditos y los descuentos? | Define si otras personas otorgan créditos o descuentos. | 🟠 Media | Dueños | Abierta |  |  |
| Q-011 | ¿Quién autoriza la devolución de un producto y cómo se maneja (dinero, producto, daño)? | Define cómo afecta una devolución al dinero y al inventario. | 🟠 Media | Dueños | Abierta |  |  |
| Q-012 | Cuando hay un reclamo por una moto reparada, ¿cómo se maneja? ¿Qué pasa si el mecánico que la reparó no está o está ocupado? ¿Hay algún acuerdo entre dueños y mecánicos? | Define cómo se registran los reclamos y quién responde por ellos. | 🟠 Media | Dueños, Mecánico | Abierta |  |  |
| Q-013 | ¿Quién asigna los trabajos y cómo se asignan cuando todos los mecánicos están ocupados? | Define cómo se asigna un mecánico a cada moto. | 🔴 Alta | Dueños, Mecánico | Abierta |  |  |
| Q-014 | ¿Les serviría llevar historial de las motos y de las reparaciones anteriores? | Define si se guarda el historial de cada moto. | 🟡 Baja | Dueños | Respondida | "No, realmente no. Muy anteriormente no es importante realmente…" (sobre reparaciones anteriores) | [[SRC-01 - First Conversation - MIRM\|SRC-01]] (se repite en el guion para confirmar) |
| Q-015 | ¿Quién conoce la compatibilidad de los productos con los modelos de moto? | Define si la compatibilidad se registra y quién la mantiene. | 🟠 Media | Dueños | Abierta |  |  |
| Q-016 | ¿Hay precios estándar para los servicios? ¿Cómo los trabajan? (ejemplos) | Define si existen servicios con precio de referencia. | 🟠 Media | Dueños | Abierta |  |  |
| Q-017 | Si hay inconvenientes el sábado, ¿se paga a los mecánicos otro día? | Define si la semana de pago es fija. | 🟡 Baja | Dueños | Abierta |  |  |
| Q-018 | ¿Qué pasa con una compra a un proveedor que trae productos dañados o con problemas? | Define cómo se registra un producto dañado que llega del proveedor. | 🟠 Media | Dueños | Abierta |  |  |
| Q-019 | Cuando una moto pasa mucho tiempo en el taller (por ejemplo, sin encontrar la falla), ¿se cobra algo? ¿Ha pasado que se junten muchas? | Define qué pasa con las motos que se quedan mucho tiempo. | 🟡 Baja | Dueños, Mecánico | Abierta |  |  |
| Q-020 | ¿Cómo se cancelan (pagan) los créditos? ¿Se pueden pagar por partes? | Define cómo se registran los abonos y el saldo de un cliente. | 🔴 Alta | Dueños | Abierta |  |  |
| Q-021 | ¿Los créditos tienen intereses? ¿Cómo se calculan? | Define si el saldo de un crédito crece con el tiempo. | 🟠 Media | Dueños | Abierta |  |  |
| Q-022 | Si aparece una falla adicional durante una reparación, ¿se consulta al cliente? ¿Qué pasa si acepta y si no? | Define cómo crece una reparación y quién lo autoriza. | 🔴 Alta | Dueños, Mecánico | Abierta |  |  |
| Q-023 | ¿Piensan pedir cédula para las reparaciones? | Define qué datos del cliente se piden. | 🟡 Baja | Dueños | Abierta |  |  |
| Q-024 | ¿Cómo se compran, se cobran y se miden el aceite y la grasa? ¿Qué unidades usan? | Define cómo se cuentan en el inventario los productos que se venden por partes. | 🔴 Alta | Dueños | Abierta |  |  |
| Q-025 | En un engrase o un cambio de aceite, ¿la grasa o el aceite se cobran aparte o van dentro del precio del servicio? ¿Alguien anota cuánto se usó? | El enunciado y el intento 1 dicen cosas distintas (segmento 11). | 🔴 Alta | Mecánico, Dueños | Abierta |  |  |
| Q-026 | Además de compras, ventas y servicios, ¿qué otras salidas tienen el inventario o la caja (pérdidas, retiros de dinero para gastos)? | Define qué otros movimientos de dinero y de productos hay que registrar. | 🟠 Media | Dueños | Abierta |  |  |
| Q-027 | ¿En qué moneda les pagan los clientes y les cobran los proveedores? ¿Aceptan dólares? | Define si se manejan una o dos monedas. | 🟠 Media | Dueños | Abierta |  |  |
| Q-028 | ¿Cómo manejan los impuestos del negocio? | Define si los precios y comprobantes incluyen impuestos. | 🟠 Media | Dueños | Abierta |  |  |
| Q-029 | Cuando viajan a Managua a comprar, ¿cómo se toma en cuenta lo gastado en el viaje? | Define si el costo real de un producto incluye el viaje. | 🟡 Baja | Dueños | Abierta |  |  |
| Q-030 | Si se hace un descuento a una reparación, ¿cómo afecta lo que gana el mecánico? | Define si el descuento reduce la mano de obra del mecánico. | 🔴 Alta | Dueños | Abierta |  |  |
| Q-031 | ¿Cómo funcionan los adelantos a los mecánicos? ¿Hay un límite? ¿Qué pasa si piden más de lo que generaron? | Define cómo se descuentan los adelantos del pago semanal. | 🟠 Media | Dueños, Mecánico | Abierta |  |  |
| Q-032 | ¿Pagan a algunos proveedores al crédito? | Define si el negocio tiene deudas con proveedores. | 🟠 Media | Dueños | Abierta |  |  |
| Q-033 | ¿Aceptan que un cliente traiga sus propios repuestos y solo pague la reparación? | Define si una reparación puede usar productos que no son del inventario. | 🟠 Media | Dueños | Abierta |  |  |
| Q-034 | Cuando se manda algo al torno (trabajo externo), ¿cómo se le cobra al cliente? | Define cómo se registran los trabajos hechos fuera del taller. | 🟠 Media | Dueños | Abierta |  |  |
| Q-035 | Si una reparación queda al crédito, ¿al mecánico se le paga su comisión esa semana o cuando paga el cliente? | Define cuándo se cuenta la mano de obra para el pago del mecánico. | 🔴 Alta | Dueños | Abierta |  |  |
| Q-036 | Si un mecánico daña una pieza nueva durante la instalación, ¿cómo se maneja? | Define quién absorbe la pérdida y cómo se registra. | 🟠 Media | Dueños, Mecánico | Abierta |  |  |
| Q-037 | ¿Qué pasa con una moto desde que llega hasta que se entrega? (la última reparada) | Recorrido real de una reparación contado por quien la hace. | 🔴 Alta | Mecánico | Abierta |  |  |
| Q-038 | Cuando no se encuentra la falla rápido, ¿qué se hace y cuánto tiempo puede pasar? | Define cómo se ve el diagnóstico en el tiempo. | 🟠 Media | Mecánico | Abierta |  |  |
| Q-039 | Cuando falta un repuesto en la tienda, ¿qué se hace y qué pasa con la moto mientras tanto? | Define qué pasa con una reparación que espera un repuesto. | 🟠 Media | Mecánico | Abierta |  |  |
| Q-040 | ¿Cómo se sabe que una moto está lista? ¿Quién avisa al cliente y quién cobra? | Define cómo termina una reparación. | 🟠 Media | Mecánico | Abierta |  |  |
| Q-041 | ¿Alguna vez otro mecánico ayudó o terminó una moto ajena? ¿Cómo se repartió el pago? | Define si una reparación puede tener más de un mecánico. | 🔴 Alta | Mecánico | Abierta |  |  |
| Q-042 | ¿Cómo se calculó el último pago del sábado? | Cálculo real del pago semanal, contado por un mecánico. | 🟠 Media | Mecánico | Abierta |  |  |
| Q-043 | ¿Cómo se manejan las garantías de repuestos o accesorios nuevos al instalarlos? ¿Qué pasa cuando una moto regresa por la misma falla o una pieza nueva falla? | Define cómo se registran las garantías de lo instalado en el taller. | 🔴 Alta | Mecánico | Abierta |  |  |
| Q-044 | ¿Qué es lo que más se olvida o se pierde en el taller? | Muestra qué información se pierde hoy en el taller. | 🟡 Baja | Mecánico | Abierta |  |  |
