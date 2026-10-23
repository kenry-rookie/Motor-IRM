---
project: "[[Motor IRM]]"
stage: S2
type: stage-product
status: 🟡 Pendiente de revisión del equipo
date: 2026-10-23
based_on: "[[S1 - Segmented Domain Statement - MIRM]]"
evidence:
  - SRC-01
  - SRC-02
  - SRC-03
source: IA (ampliación redactada por Claude a pedido de Kenry, a partir de SRC-01, SRC-02 y SRC-03)
reviewed: false
---
**[[Motor IRM|← Hub]]** · **[[S2 - Interviews and Elaboration of the Statement - MIRM|← S2]]** · **[[S1 - Segmented Domain Statement - MIRM|Enunciado segmentado (S1)]]** · **[[Questions - MIRM|❓ Questions]]** · **[[Glossary - MIRM|📖 Glossary]]**

# Enhanced and Corroborated Domain Statement - MIRM

> [!warning] Hecho por IA — pendiente de revisión del equipo
> Esta nota la redactó Claude a partir de las fuentes. Ninguna parte se considera definitiva hasta que el equipo la revise y marque `reviewed` en las propiedades. Si al revisar no están de acuerdo con una interpretación, se corrige el segmento y se anota en el LogBook.

> [!info] Cómo leer esta nota
> - Mantiene los **24 segmentos** del [[S1 - Segmented Domain Statement - MIRM|enunciado segmentado]], en el mismo orden y con los mismos nombres, y agrega el **segmento 25** (usuarios), que en S1 estaba en la tabla *"Lo que SRC-01 dice y el enunciado no menciona"*.
> - Cada segmento tiene: **Enunciado ampliado** (el texto que reemplaza al borrador), **Estado**, **Cambio** respecto a S1, **Evidencia** (citas textuales), **Preguntas respondidas** y **Lo que sigue abierto**.
> - **Regla de redacción (DEC-002):** el enunciado ampliado solo afirma lo que alguna fuente dice. Lo que no tiene fuente se quitó del texto o quedó como cita del borrador marcada *"sin fuente"*, y su duda está en [[Questions - MIRM|Questions]].
> - **Estado:** ✅ Respaldado · 🟡 Parcial · ⚪ Sin fuente · ❌ Contradicho · — No aplica.
> - **Cambio:** *Ampliado* (se agregó información) · *Corregido* (una fuente contradijo el borrador y se reescribió) · *Sin cambio* · *Nuevo*.
> - **Para S3:** solo los segmentos ✅ entran al modelo conceptual → [[#Qué entra a S3]].

## Resumen

| #   | Segmento                                                                                         | Estado S1      | Estado S2     | Cambio     |
| --- | ------------------------------------------------------------------------------------------------ | -------------- | ------------- | ---------- |
| 1   | [[#1. Actividades del negocio\|Actividades del negocio]]                                         | 🟡 Parcial     | ✅ Respaldado | Ampliado   |
| 2   | [[#2. Situación actual de la información\|Situación actual de la información]]                   | ✅ Respaldado  | ✅ Respaldado | Ampliado   |
| 3   | [[#3. Inventario: cómo se controla hoy\|Inventario: cómo se controla hoy]]                       | ✅ Respaldado  | ✅ Respaldado | Ampliado   |
| 4   | [[#4. Compras y precios\|Compras y precios]]                                                     | ✅ Respaldado  | ✅ Respaldado | Ampliado   |
| 5   | [[#5. Inventario: qué debe registrarse\|Inventario: qué debe registrarse]]                       | ⚪ Sin fuente  | 🟡 Parcial    | Ampliado   |
| 6   | [[#6. Productos, marcas y compatibilidad\|Productos, marcas y compatibilidad]]                   | 🟡 Parcial     | 🟡 Parcial    | Ampliado   |
| 7   | [[#7. Taller: recepción y asignación\|Taller: recepción y asignación]]                           | 🟡 Parcial     | ✅ Respaldado | Corregido  |
| 8   | [[#8. Taller: reparaciones que crecen\|Taller: reparaciones que crecen]]                         | ⚪ Sin fuente  | ✅ Respaldado | Ampliado   |
| 9   | [[#9. Mano de obra\|Mano de obra]]                                                               | ⚪ Sin fuente  | ✅ Respaldado | Corregido  |
| 10  | [[#10. Taller: reparaciones de varios días\|Taller: reparaciones de varios días]]                | 🟡 Parcial     | ✅ Respaldado | Ampliado   |
| 11  | [[#11. Productos e insumos usados en el taller\|Productos e insumos usados en el taller]]        | ❌ Contradicho | ✅ Respaldado | Corregido  |
| 12  | [[#12. Mecánicos: porcentajes, pago y adelantos\|Mecánicos: porcentajes, pago y adelantos]]      | 🟡 Parcial     | 🟡 Parcial    | Ampliado   |
| 13  | [[#13. Mecánicos: horario y asistencia\|Mecánicos: horario y asistencia]]                        | ⚪ Sin fuente  | ⚪ Sin fuente | Sin cambio |
| 14  | [[#14. Mecánico responsable y apoyo\|Mecánico responsable y apoyo]]                              | ⚪ Sin fuente  | ✅ Respaldado | Corregido  |
| 15  | [[#15. Ventas y servicios\|Ventas y servicios]]                                                  | 🟡 Parcial     | ✅ Respaldado | Ampliado   |
| 16  | [[#16. Pagos y créditos\|Pagos y créditos]]                                                      | ✅ Respaldado  | ✅ Respaldado | Ampliado   |
| 17  | [[#17. Descuentos\|Descuentos]]                                                                  | 🟡 Parcial     | ✅ Respaldado | Ampliado   |
| 18  | [[#18. Devoluciones y garantías\|Devoluciones y garantías]]                                      | ⚪ Sin fuente  | ✅ Respaldado | Ampliado   |
| 19  | [[#19. Clientes\|Clientes]]                                                                      | 🟡 Parcial     | ✅ Respaldado | Ampliado   |
| 20  | [[#20. Motocicletas\|Motocicletas]]                                                              | ❌ Contradicho | ✅ Respaldado | Corregido  |
| 21  | [[#21. Consumo interno\|Consumo interno]]                                                        | ⚪ Sin fuente  | 🟡 Parcial    | Ampliado   |
| 22  | [[#22. Proveedores\|Proveedores]]                                                                | ✅ Respaldado  | ✅ Respaldado | Ampliado   |
| 23  | [[#23. Información económica\|Información económica]]                                            | ✅ Respaldado  | ✅ Respaldado | Ampliado   |
| 24  | [[#24. Propósito de la solución\|Propósito de la solución]]                                      | — No aplica    | — No aplica   | Sin cambio |
| 25  | [[#25. Usuarios y condiciones de uso\|Usuarios y condiciones de uso]]                            | —              | ✅ Respaldado | Nuevo      |

**Balance:** S1 tenía 6 segmentos ✅; S2 deja **19 ✅**, 4 🟡, 1 ⚪ y ningún ❌.

---

## 1. Actividades del negocio

**Enunciado ampliado**

El negocio se dedica a dos actividades relacionadas entre sí: la reparación y el mantenimiento de motocicletas en el taller, y la venta de repuestos, accesorios y lubricantes.

Las dos actividades pueden ocurrir por separado o juntas: un cliente puede llegar solo a comprar un producto, solo a pedir un trabajo de taller, o pedir una reparación en la que se usan repuestos de la tienda.

El cliente también puede traer sus propios repuestos y pedir únicamente la reparación; el negocio lo acepta. Algunos trabajos se hacen fuera del taller, en un torno: a veces el cliente lleva la pieza y otras veces la lleva alguien del taller.

**Estado:** ✅ Respaldado · **Cambio:** Ampliado

**Evidencia:**
- SRC-01: "Solo venden, no llevan de cabeza ni cuaderno." / "Solo saben en el taller por que van anotando en las notas de el telefono."
- SRC-02 (Q-033): "Si, se acepta."
- SRC-02 (Q-034): "A veces va el cliente, otras veces van del taller."

**Preguntas respondidas:** Q-033 · Q-034 (parcial)

**Lo que sigue abierto:**
- Se quitó *"neumáticos"* del texto: ninguna fuente lo menciona → Q-062.
- Cómo se le cobra al cliente el trabajo del torno cuando lo lleva alguien del taller → Q-034 (sigue abierta).

---

## 2. Situación actual de la información

**Enunciado ampliado**

La operación del negocio es mayoritariamente informal. La información depende de la memoria de los dueños y de los mecánicos, de mirar los estantes y de notas ocasionales en el celular. Tienen una computadora, pero no la usan para nada.

Los dos dueños hacen todas las tareas administrativas: venden, cobran, reciben productos, revisan el inventario, deciden qué comprar, administran los créditos, autorizan descuentos y calculan el pago de los mecánicos.

No existe un registro centralizado de las ventas, el inventario, los créditos pendientes, los trabajos del taller ni la situación económica del negocio.

**Estado:** ✅ Respaldado · **Cambio:** Ampliado

**Evidencia:**
- SRC-01: "Solo venden, no llevan de cabeza ni cuaderno." / "van anotando en las notas de el telefono." / "Si tienen computadora. Pero no la usan para absolutamente nada."
- SRC-02 (Q-008): en las ocho tareas la respuesta fue "Ambos dueños".

**Preguntas respondidas:** Q-008

**Lo que sigue abierto:**
- Qué les hace perder más tiempo y dinero → Q-007 (preguntada en SRC-02, sin respuesta registrada).

---

## 3. Inventario: cómo se controla hoy

**Enunciado ampliado**

Una de las principales necesidades es tener un control confiable del inventario. Hoy la existencia de cada producto se conoce mirando los estantes y por lo que los dueños recuerdan de la mercancía. Los dos dueños revisan el inventario.

**Estado:** ✅ Respaldado · **Cambio:** Ampliado

**Evidencia:**
- SRC-01: "Al ojo, calculan con lo que saben"
- SRC-02 (Q-008): "Quien revisa inventario: Ambos dueños"

**Preguntas respondidas:** Q-008

---

## 4. Compras y precios

**Enunciado ampliado**

Los dos dueños deciden qué comprar y reciben la mercancía. Compran a distintos proveedores: los llaman por teléfono, los proveedores pasan vendiendo o los dueños viajan a Managua. Compran de forma variada, más o menos cada quince días o cuando ven que hace falta algo.

El precio de venta se fija a partir de la factura de compra y de la ganancia que quieren obtener, procurando vender más barato que la competencia. Cuando llega una factura con un costo nuevo, el precio se actualiza según esa factura. Cuando viajan a Managua, el combustible y la comida del viaje se recuperan en los precios de los productos.

A algunos proveedores se les paga al crédito.

**Estado:** ✅ Respaldado · **Cambio:** Ampliado

**Evidencia:**
- SRC-01: "Llaman a los proveedores, o pasan proveedores vendiendo, otras veces van a Managua" / "Compran de forma variada, cada quince dias. O cuando ven que van necesitando algo." / "Solo establecen el precio segun la ganancia, procurando vender mas barato que la competencia." / "Si tiene un producto a un precio, se actualizan segun lo nuevo."
- SRC-02 (Q-008): "Quien recibe productos: Ambos dueños" / "Quien decide que comprar: Ambos dueños"
- SRC-02 (Q-029): "Si lo hacen, combustible y comida."
- SRC-02 (Q-032): "Pagan al crédito a algunos proveedores."

**Preguntas respondidas:** Q-008 · Q-029 · Q-032

**Lo que sigue abierto:**
- Si necesitan saber cuál era el precio anterior de un producto → Q-001 (no estaba en ningún guion).
- Cómo reparten el gasto del viaje entre los productos → Q-061.

---

## 5. Inventario: qué debe registrarse

**Enunciado ampliado**

Hoy no se registran las entradas ni las salidas de mercancía. Según las fuentes, la existencia real de un producto cambia por estas situaciones, que el sistema deberá poder reflejar:

- **Compras** a proveedores.
- **Ventas** directas en la tienda.
- **Repuestos usados en reparaciones**, que se cobran al cliente.
- **Productos que llegan dañados** del proveedor: el proveedor cubre la devolución (todos los proveedores lo hacen).
- **Cambios** de productos que el cliente devuelve todavía empacados (ver segmento 18).
- **Retiros** para otros usos que no son venta, por ejemplo para limpieza (ver segmento 21).

> **Borrador sin fuente (no entra a S3):** *"…productos dañados […] y posibles ajustes de inventario."* Ninguna fuente habla de ajustes por conteo ni de productos que vencen.

**Estado:** 🟡 Parcial · **Cambio:** Ampliado

**Evidencia:**
- SRC-02 (Q-018): "Los proveedores cubren la devolucion. Todos los proveedores."
- SRC-02 (Q-026): "Si se pueden dejar algunos retiros, porque a veces se agarra para otras cosas, por ejemplo para limpieza."
- SRC-02 (Q-011): "Pueden cambiar producto, cuando lleva empacado."

**Preguntas respondidas:** Q-018 · Q-026 (parcial) · Q-011

**Lo que sigue abierto:**
- Si algunos productos vencen → Q-003 (no estaba en ningún guion).
- Si los retiros son de dinero, de productos o de ambos → Q-052.

---

## 6. Productos, marcas y compatibilidad

**Enunciado ampliado**

Los productos pertenecen a distintas categorías, marcas y proveedores. El negocio es autorizado de las marcas UMA y Motoplaza.

La compatibilidad entre repuestos y modelos de moto la conocen los dueños y los mecánicos por experiencia: con la circulación y viendo la moto saben qué repuestos usa.

> **Borrador sin fuente (no entra a S3):** *"…un mismo repuesto puede ser compatible con diferentes modelos o marcas de motocicletas."* Es probable, pero nadie lo dijo, y tampoco dijeron si quieren que el sistema guarde esa compatibilidad.

**Estado:** 🟡 Parcial · **Cambio:** Ampliado

**Evidencia:**
- SRC-01: "Se pide circulación, si ven la moto ya saben los repuestos que usan." / "Son autorizados de UMA y motoplaza"
- SRC-02 (Q-015): "Los dueños y mecánicos saben esas cosas."

**Preguntas respondidas:** Q-015

**Lo que sigue abierto:**
- Qué categorías de productos venden → Q-062.
- Si les serviría que el sistema guarde qué repuestos sirven para qué modelos → Q-063.
- Qué implica ser autorizados de UMA y Motoplaza → Q-064.

---

## 7. Taller: recepción y asignación

**Enunciado ampliado**

El taller hace trabajos de diagnóstico, reparación y mantenimiento de motocicletas. Cuando llega un cliente con su moto, habla con uno de los dueños: le explica lo que tiene la moto y lo que quiere que se le haga.

El alcance del trabajo lo define el cliente: si pide que se busque la falla, se diagnostica; si pide algo concreto, solo eso se hace.

Los dueños asignan el trabajo: le dicen directamente al mecánico que tiene esa moto. Si todos los mecánicos están ocupados, esperan al primero que se desocupe o el propio dueño hace el trabajo. Los mecánicos procuran terminar rápido.

**Estado:** ✅ Respaldado · **Cambio:** Corregido (el borrador decía *"el propietario o responsable puede atender"*; las fuentes confirman que son los dueños y agregan que un dueño puede hacer el trabajo).

**Evidencia:**
- SRC-03 (Q-037): "El cliente habla con el dueño, le explican lo que tiene la moto, lo que el cliente quiere hacer."
- SRC-02 (Q-022): "Si el cliente le dice que vea la falla, si solo dicen que haga algo solo eso se soluciona."
- SRC-02 (Q-013): "Los dueños. Uno mismo le dice al mecanico que tiene la moto. Esperan al que se desocupe primero o lo hace el dueño."
- SRC-03 (Q-013): "Normalmente se asigna el trabajo, se procura terminar rapido todo."

**Preguntas respondidas:** Q-013 · Q-037

**Lo que sigue abierto:**
- Cuando un dueño hace la reparación, cómo se cuenta esa mano de obra → Q-046.

---

## 8. Taller: reparaciones que crecen

**Enunciado ampliado**

Durante una reparación puede aparecer una falla adicional, distinta de la que el cliente pidió reparar. En ese caso se consulta con el cliente:

- Si **acepta**, el trabajo o el repuesto se agrega a la reparación y se suma al precio.
- Si **no acepta**, la moto se entrega así y no se da garantía sobre esa falla, porque se le advirtió.

Por eso una reparación puede crecer mientras está en el taller: se le pueden agregar trabajos y repuestos según lo que se encuentre y lo que decida el cliente.

**Estado:** ✅ Respaldado · **Cambio:** Ampliado

**Evidencia:**
- SRC-02 (Q-022): "Se consulta con el cliente, si el cliente dice que si lo cambia, es un agregado al precio. Si el cliente dice que no, se le entrega asi, no se le da garantia de que saldra bien porque uno le advirió."
- SRC-03 (Q-022): "Se habla con el cliente que confirme, si la quiere cambiar bueno, si no tambien"

**Preguntas respondidas:** Q-022

---

## 9. Mano de obra

**Enunciado ampliado**

El precio de la mano de obra no siempre es fijo. Algunos servicios tienen precio estandarizado, por ejemplo los trabajos de motor; otros varían, como los engrases, que pueden costar 400 o 600.

Se cobra por el trabajo realizado, no por el tiempo que la moto pase en el taller.

> **Borrador sin fuente (no entra a S3):** *"…puede depender del tipo de motocicleta, la complejidad del trabajo y las condiciones específicas de la reparación."* Nadie dijo de qué depende el precio.

**Estado:** ✅ Respaldado · **Cambio:** Corregido (se quitó la explicación de qué hace variar el precio, que no tenía fuente).

**Evidencia:**
- SRC-02 (Q-016): "Hay engrases que valen 400, otras 600. Si estandarizan, por ejemplo motor."
- SRC-02 (Q-019): "Se cobra por trabajo."

**Preguntas respondidas:** Q-016 · Q-019

**Lo que sigue abierto:**
- De qué depende que un engrase cueste 400 o 600 (y en qué moneda) → Q-055.

---

## 10. Taller: reparaciones de varios días

**Enunciado ampliado**

Una reparación puede terminar el mismo día o quedarse varios días en el taller. Las causas confirmadas son:

- **Falta un repuesto:** primero se busca en otro lado; si no se encuentra, se manda a traer de fuera (Managua). Si se pide y no llega el mismo día, llega al siguiente. Mientras tanto la moto se queda en el taller y se mantiene contacto con el cliente.
- **No se encuentra la falla rápido:** la moto queda en espera, se atienden otras motos y se sigue revisando cuando el taller está vacío. Según el mecánico, la falla siempre se encuentra. Que el taller se llene de motos así es muy poco probable, y habría alternativas de espacio.

No se cobra por el tiempo que la moto pase en el taller. Si el cliente no tiene dinero para una reparación de motor, se le pide que se lleve la moto, porque no hay espacio para tenerla.

Hoy el estado de cada moto se lleva de memoria.

**Estado:** ✅ Respaldado · **Cambio:** Ampliado

**Evidencia:**
- SRC-01: "Solo queda en el taller. En contacto con el cliente." / "Se pide de Managua. Cuando no llega el mismo dia, se pide y se entrega al siguiente dia." / "Todo en la mente"
- SRC-03 (Q-039): "Lo mandas a otro lado, si no encuentran en ningun lado se manda a traer fuera."
- SRC-03 (Q-038): "Cuando el cliente no sabe que falla tiene, siempre se encuentra la falla."
- SRC-03 (Q-019): "Cuando una moto no se le encuentra la falla, se pueden atender otras motos, cuando está vacío el taller se está observando la moto que está en espera." / "Es muy poco probable que se llene de motos que no encuentran la falla, pero se pueden tener alternativas de espacio."
- SRC-02 (Q-019): "Se cobra por trabajo."
- SRC-02 (respuesta escrita bajo Q-018): "Si no tiene riales para repararla y es para el motor, se le dice que se la lleve mejor por que no hay espacio para tenerla."

**Preguntas respondidas:** Q-019 · Q-038 · Q-039

> [!note] Interpretación de la IA
> La frase *"Si no tiene riales para repararla…"* quedó escrita debajo de Q-018 (proveedores), pero habla de una moto en el taller. Se ubicó aquí. **Confirmar al revisar.**

---

## 11. Productos e insumos usados en el taller

**Enunciado ampliado**

Los repuestos que se usan en una reparación se le cobran al cliente.

La grasa de los engrases **no es mercancía del negocio**: la compran los propios mecánicos, y al cliente solo se le cobra el engrase como servicio. El aceite se vende únicamente por litro. Los dueños llaman **insumos** a los líquidos (*"líquido de barra"*) y lubricantes.

Según los dueños, las piezas nuevas las instalan ellos, no los mecánicos. Según el mecánico, si una pieza se daña al instalarla —sea eléctrica o no— el costo lo asume la tienda. Si el cliente trae una pieza nueva y falla, el taller tiene probadores para verificarla.

**Estado:** ✅ Respaldado · **Cambio:** Corregido. El borrador decía que la grasa sale del inventario del negocio dentro de un precio global; el intento 1 decía que los insumos se cobran aparte. Las fuentes dicen otra cosa: el engrase se cobra como servicio y **la grasa es del mecánico**. Ya no hay un consumo de grasa del inventario que controlar.

**Evidencia:**
- SRC-03 (Q-025): "Solo cobran el engrase. El mecánico cobra su grasa, todos los mecánicos compran su grasa."
- SRC-02 (Q-024): "El aceite lo venden por litro, solo por litro. La grasa se tiene solo para lo que se usa en los engrases." / "Los insumos se le dicen a los liquido de barra y lubricantes asi."
- SRC-02 (Q-036): "No pasa eso, los dueños la ponen, no los mecánicos."
- SRC-03 (Q-036): "Depende si es electrónica, se cambia normal, la tienda la paga; si no es eléctrico igual la tienda. Si el cliente lleva la pieza nueva y falla, ellos tienen probadores para verificar y se revisa correctamente."

**Preguntas respondidas:** Q-024 · Q-025 · Q-036

**Lo que sigue abierto:**
- Cómo se reparte el cobro del engrase entre el mecánico (que pone la grasa) y el negocio → Q-055.
- Quién instala las piezas nuevas: dueños (SRC-02) o mecánicos (SRC-03) → Q-056. Prioridad baja: en los dos casos la pérdida la asume la tienda.
- Qué es el *"líquido de barra"* → Q-057.

---

## 12. Mecánicos: porcentajes, pago y adelantos

**Enunciado ampliado**

Los mecánicos son los principales trabajadores del negocio. No tienen contrato formal ni salario fijo: ganan una **comisión** (porcentaje) sobre la mano de obra de los trabajos que hacen. El dinero lo recibe el dueño, que va acumulando lo que corresponde a cada mecánico.

El pago es **semanal**, normalmente el sábado. Si hay un feriado se paga otro día; por ejemplo, en Semana Santa se paga el miércoles.

Se dan **adelantos** algunas veces, también a media semana, y siempre son de poco dinero. No hay un límite definido.

Si una reparación queda al crédito, el mecánico recibe su comisión esa misma semana, aunque el cliente todavía no haya pagado: dar crédito es decisión de los dueños. Si se hace una rebaja en una reparación, los dueños se ponen de acuerdo con el mecánico.

Los dueños quieren llevar el historial de los trabajos de cada moto, porque así se calcula el pago de los mecánicos (ver segmento 20). Hoy todo se anota en el celular.

> **Contradicción abierta — porcentajes:** SRC-01 dice *"les paga el 50% al otro 60%. Y una excepción con 100%"*. SRC-03 dice *"60% por ahora solo hay dos"*. No se sabe si hoy hay dos mecánicos al 60 % o si el entrevistado habló solo de su porcentaje → Q-045.

**Estado:** 🟡 Parcial · **Cambio:** Ampliado. Respaldado: pago semanal, adelantos, comisión en trabajos al crédito, rebajas acordadas. Contradicho: los valores de los porcentajes y cuántos mecánicos hay.

**Evidencia:**
- SRC-01: "Recibe los riales el dueño, asi va acumulando, y se le cancela a fin de semana el porcentaje que se acordó(no tienen contratos formales). Lo apunta en el celular, les paga el 50% al otro 60%. Y una excepción con 100%."
- SRC-03 (Q-042): "Ganan por porcentaje de comisión 60% por ahora solo hay dos."
- SRC-02 (Q-017): "En ejemplos de semana santa pagan el miercoles."
- SRC-02 (Q-031): "Se paga el mero día de pago. Pero a veces se les da adelantos. No siempre y es poco adelante."
- SRC-03 (Q-031): "Si, pero poco."
- SRC-02 (Q-035): "Se le paga normal la semana, depende de nosotros si damos al crédito."
- SRC-02 (Q-030): "Se le rebaja poco, se ponen de a cuerdo con el mecánico."
- SRC-02 (Q-014): "Si, es bueno, porque asi se les paga a los mecanicos."

**Preguntas respondidas:** Q-017 · Q-030 · Q-031 · Q-035 · Q-042

**Lo que sigue abierto:**
- Cuántos mecánicos hay hoy, qué porcentaje gana cada uno y si los adelantos se descuentan del pago del sábado → Q-045.
- El borrador decía que el pago es *"en efectivo"*: ninguna fuente lo dice; se quitó del texto (incluido en Q-045).

---

## 13. Mecánicos: horario y asistencia

**Enunciado ampliado**

No hay información nueva. Este tema no se preguntó en ningún guion.

> **Borrador sin fuente (no entra a S3):** *"Aunque existe un horario general de trabajo, la duración real de una jornada puede variar según las reparaciones en proceso y los trabajadores pueden ausentarse sin que exista actualmente un sistema formal de control de asistencia."*

Lo único respaldado es indirecto: como los mecánicos ganan por comisión (segmento 12), el pago no depende de las horas trabajadas.

**Estado:** ⚪ Sin fuente · **Cambio:** Sin cambio

**Lo que sigue abierto:**
- Si hay horario y si necesitan controlar asistencia → Q-059. Sugerencia: si no se responde antes de S3, dejarlo fuera de la versión 1.

---

## 14. Mecánico responsable y apoyo

**Enunciado ampliado**

Cada moto se asigna a un mecánico, y cada mecánico repara lo que le corresponde: no se reparten motos entre mecánicos ni se divide el pago de una reparación. Si no hay un mecánico libre, el trabajo lo puede hacer un dueño (segmento 7).

Cuando un cliente regresa con un reclamo, lo atiende el dueño (segmento 18).

**Estado:** ✅ Respaldado · **Cambio:** Corregido. El borrador planteaba que una reparación podía necesitar *"apoyo o intervención adicional de otros trabajadores"*; el mecánico dice que eso no pasa.

**Evidencia:**
- SRC-03 (Q-041): "Cada mecánico repara lo que le corresponde."
- SRC-02 (Q-013): "Esperan al que se desocupe primero o lo hace el dueño."
- SRC-03 (Q-043): "Se responde con el dueño."

**Preguntas respondidas:** Q-041 · Q-012 (parcial)

**Lo que sigue abierto:**
- Q-046 (dueño que repara).

---

## 15. Ventas y servicios

**Enunciado ampliado**

El negocio hace ventas directas de productos y cobra los trabajos del taller. Una venta puede ser solo de productos, sin ninguna moto de por medio; una reparación puede incluir productos, mano de obra o ambos. Una venta no siempre está relacionada con una reparación.

Los dos dueños venden y cobran, tanto en la tienda como en el taller. Cuando no están, dejan un encargado. Al cliente se le entrega un comprobante impreso.

**Estado:** ✅ Respaldado · **Cambio:** Ampliado

**Evidencia:**
- SRC-01: "¿Necesitan imprimir comprobantes? Si."
- SRC-02 (Q-008): "Quien vende: Ambos dueños" / "Quien cobra: Ambos dueños"
- SRC-02 (Q-006): "Dejan un encargado."
- SRC-03 (Q-040): "Cobran los dueños"

**Preguntas respondidas:** Q-008 · Q-040 (parcial)

**Lo que sigue abierto:**
- Qué datos del comprobante quieren ver como historial → Q-005 (preguntada en SRC-02, sin respuesta registrada).
- Qué puede hacer el encargado → Q-047.

---

## 16. Pagos y créditos

**Enunciado ampliado**

Los clientes pagan en efectivo (córdobas o dólares), por transferencia a la cuenta del dueño o al crédito.

El crédito se da **por confianza** y **sin límite**. Lo administran los dueños; cuando no están, se les llama para que autoricen. Para dar crédito se pediría la cédula y el número de teléfono del cliente. Hoy los créditos se anotan en las notas del celular.

El plazo normal es de **un mes**: algunos clientes pagan antes, a otros se les da un poco más de tiempo, y algunos se atrasan, sobre todo los que no son del pueblo. No se cobran intereses: se cobra el total. Si un cliente pidiera tres meses, se le cobraría un 8 % más, aunque nadie lo ha pedido todavía.

El sistema deberá identificar las operaciones al crédito, asociarlas al cliente y registrar los pagos hasta cancelar la deuda, para saber cuánto se debe sin depender de la memoria.

**Estado:** ✅ Respaldado · **Cambio:** Ampliado

**Evidencia:**
- SRC-01: "Transferencia a la cuenta de el dueño." / "Dan credito. Por confianza, anotan en las notas del celular"
- SRC-02 (Q-009): "no tienen limites, pura confianza."
- SRC-02 (Q-010): "Solo se les llama a los dueños y le piden el crédito."
- SRC-02 (Q-020): "Se pagan para un mes nada mas, a veces llegan antes, a veces se les da un poco mas. Hay algunos que se dilatan porque no son del pueblo."
- SRC-02 (Q-021): "No se ponen intereses, se cobra el total. Si dicen que es para tres meses se cobra mas, pero nadie ha pedido aún. Al 8%."
- SRC-02 (Q-023): "Cuando es al crédito si se pediría con el numero de telefono."
- SRC-02 (Q-027): "Si"

**Preguntas respondidas:** Q-009 · Q-010 · Q-020 · Q-021 · Q-023 · Q-027

**Lo que sigue abierto:**
- Si un crédito se puede pagar por partes (abonos) → Q-049.
- Si el 8 % es total o mensual → Q-050.
- Qué tipo de cambio usan con los dólares → Q-051.

---

## 17. Descuentos

**Enunciado ampliado**

Los descuentos (rebajas) son pocos: casi no los piden. Cuando un cliente compra bastante, se le rebaja un poco. En una reparación también se puede rebajar un poco, y los dueños se ponen de acuerdo con el mecánico, porque afecta su comisión. Los autorizan los dueños. No siguen un porcentaje fijo: se calculan en el momento y no se registran.

**Estado:** ✅ Respaldado · **Cambio:** Ampliado

**Evidencia:**
- SRC-01: "Cuando es por mayor si se le rebaja." / "Solo calculan, no lo registran."
- SRC-02 (Q-010): "Casi no piden descuentos, cuando es bastantes le rebajan poco."
- SRC-02 (Q-008): "Quien autoriza descuentos: Ambos dueños"
- SRC-02 (Q-030): "Se le rebaja poco, se ponen de a cuerdo con el mecánico."

**Preguntas respondidas:** Q-008 · Q-010 · Q-030

---

## 18. Devoluciones y garantías

**Enunciado ampliado**

**Productos vendidos.** Un cliente puede cambiar un producto si todavía está empacado. No se cambian los productos eléctricos ni los que fueron maltratados.

**Productos comprados.** Si un producto llega dañado del proveedor, el proveedor cubre la devolución. Todos los proveedores lo hacen.

**Reparaciones.** Si una moto regresa por la misma falla o una pieza instalada falla, no se le cobra al cliente: es garantía. El dueño revisa la moto para verificar cuál es el daño. Si la falla es distinta de lo que se trabajó, se le explica al cliente y se le pregunta si quiere repararla; si acepta, ese trabajo nuevo también tiene garantía. No hay garantía sobre una falla adicional que el cliente decidió no reparar (segmento 8). Los reclamos los atiende el dueño.

**Estado:** ✅ Respaldado · **Cambio:** Ampliado (en S1 no había ninguna fuente).

**Evidencia:**
- SRC-02 (Q-011): "Pueden cambiar producto, cuando lleva empacado. Si es algo electrico o maltrataron el producto no se cambia."
- SRC-02 (Q-018): "Los proveedores cubren la devolucion. Todos los proveedores."
- SRC-02 (Q-012): "La garantía, se revisa correctamente en caso de verificar cual es el daño. Si es algo distinto de lo que no trabajaron se le explica a el cliente. Le preguntan si lo va a reparar para darle garantía."
- SRC-03 (Q-043): "Se responde con el dueño." / "Se le responde el cliente. No se le cobra, es por garantía."
- SRC-03 (Q-040): "le responden al cliente por alguna garantía se le responde, si es ajeno al trabajo se le explcica."

**Preguntas respondidas:** Q-011 · Q-012 · Q-018 · Q-043

**Lo que sigue abierto:**
- Si al devolver un producto se puede devolver el dinero o solo se cambia → Q-053.
- Cuánto tiempo dura la garantía de una reparación → Q-054.

---

## 19. Clientes

**Enunciado ampliado**

En las ventas rápidas no se guarda información del cliente. En las reparaciones tampoco se pide cédula. En los créditos sí se pediría la cédula y el número de teléfono.

La información del cliente importa sobre todo en las operaciones que necesitan seguimiento: créditos y reparaciones.

**Estado:** ✅ Respaldado · **Cambio:** Ampliado

**Evidencia:**
- SRC-01: "Para ventas rapidas no, normalmente no llevan información de los clientes."
- SRC-02 (Q-023): "No, realmente no. Cuando es al crédito si se pediría con el numero de telefono."

**Preguntas respondidas:** Q-023

**Lo que sigue abierto:**
- Qué datos mínimos del cliente se guardan en una reparación (nombre, teléfono…) → Q-048.

---

## 20. Motocicletas

**Enunciado ampliado**

Los trabajadores identifican las motos por el cliente y viéndolas; se pide la circulación.

Los dueños quieren llevar el **historial de los trabajos hechos a cada moto**, sobre todo porque con él se calcula el pago de los mecánicos.

**Estado:** ✅ Respaldado · **Cambio:** Corregido. En SRC-01 dijeron que el historial de reparaciones anteriores *"no es importante realmente"*; en SRC-02, ante la pregunta directa, dicen que sí, *"porque asi se les paga a los mecanicos"*. Se toma SRC-02: es la fuente más reciente y la pregunta fue directa. Las dos respuestas no chocan del todo: lo que no les interesa es la historia técnica antigua; lo que sí les interesa es el registro de trabajos para pagar.

**Evidencia:**
- SRC-01: "Se pide circulación, si ven la moto ya saben los repuestos que usan." / "No, realmente no. Muy anteriormente no es importante realmente…"
- SRC-02 (Q-014): "Si, es bueno, porque asi se les paga a los mecanicos." / "Si por pagos a los mecánicos."

**Preguntas respondidas:** Q-014 (actualizada)

**Lo que sigue abierto:**
- Qué datos identifican a una moto (placa, marca, modelo…) → Q-048.

---

## 21. Consumo interno

**Enunciado ampliado**

Hay salidas que no son ventas ni servicios a clientes: a veces se retira algo para otros usos, por ejemplo para limpieza. Estas salidas deben distinguirse de las ventas.

> **Borrador sin fuente (no entra a S3):** *"…un mecánico puede realizar trabajos sobre su propia motocicleta cuando no posee otro trabajo pendiente […] si utiliza un producto perteneciente al inventario comercial del negocio, deberá adquirirlo…"*

**Estado:** 🟡 Parcial · **Cambio:** Ampliado

**Evidencia:**
- SRC-02 (Q-026): "Si se pueden dejar algunos retiros, porque a veces se agarra para otras cosas, por ejemplo para limpieza."

**Preguntas respondidas:** Q-026 (parcial)

**Lo que sigue abierto:**
- Si los retiros son de dinero, de productos o de ambos → Q-052.
- Si los mecánicos reparan su propia moto en el taller y cómo pagan los productos → Q-060.

---

## 22. Proveedores

**Enunciado ampliado**

El negocio trabaja con varios proveedores, pero no lleva un registro formal de ellos. Les compra por teléfono, cuando pasan vendiendo o viajando a Managua. Un mismo producto se puede comprar a distintos proveedores según la disponibilidad.

Todos los proveedores cubren la devolución de productos que llegan dañados. A algunos proveedores se les paga al crédito.

**Estado:** ✅ Respaldado · **Cambio:** Ampliado

**Evidencia:**
- SRC-01: "Llaman a los proveedores, o pasan proveedores vendiendo, otras veces van a Managua"
- SRC-02 (Q-018): "Los proveedores cubren la devolucion. Todos los proveedores."
- SRC-02 (Q-032): "Pagan al crédito a algunos proveedores."

**Preguntas respondidas:** Q-018 · Q-032

**Lo que sigue abierto:**
- Qué datos de contacto de los proveedores usan → Q-002 (no estaba en ningún guion).

---

## 23. Información económica

**Enunciado ampliado**

Los dueños no saben cuánto venden al día, cuánto corresponde a ventas y a servicios, cuánto deben los clientes ni cuánto ganan. El dinero que recibe el dueño se acumula y una parte se reinvierte en mercancía.

Además de las ventas, los servicios y las compras, hay otros movimientos de dinero que afectan la situación del negocio:

- La **comisión** de los mecánicos y sus **adelantos** (segmento 12).
- Los **retiros** para otros usos (segmento 21).
- Los **gastos de viaje** a Managua, que se recuperan en los precios (segmento 4).
- Las **deudas con proveedores** al crédito (segmento 22).
- Un **impuesto mensual fijo** de 800 córdobas.
- Pagos en **dólares** (segmento 16).

El sistema deberá registrar estas operaciones para que el negocio sepa qué vende, qué servicios hace, cuánto inventario tiene, cuánto le deben, cuánto debe pagar a los mecánicos y cómo se comportan sus ingresos, costos y ganancias.

**Estado:** ✅ Respaldado · **Cambio:** Ampliado

**Evidencia:**
- SRC-01: "¿Cómo saben cuánto vendieron al final del día? — No saben, literalmente nada." / "Recibe los riales el dueño, asi va acumulando"
- SRC-02 (Q-028): "Mensual se paga, son 800 cordobas."
- SRC-02 (Q-026), (Q-029), (Q-032), (Q-027): ver segmentos 21, 4, 22 y 16.

**Preguntas respondidas:** Q-028

**Lo que sigue abierto:**
- Q-007 (qué les hace perder dinero), sin respuesta registrada.

---

## 24. Propósito de la solución

**Enunciado ampliado**

El propósito de Motor IRM no es convertir el negocio en una estructura burocrática ni obligar a los trabajadores a seguir procesos complejos. La solución debe adaptarse al flujo natural de ventas y reparaciones, manteniendo la rapidez de la atención diaria, pero estableciendo controles mínimos donde hoy la información se pierde, depende solo de la memoria o impide conocer la realidad económica y operativa del negocio.

**Estado:** — No aplica (es la intención del proyecto, no un hecho del negocio) · **Cambio:** Sin cambio

**Lo que sigue abierto:**
- Qué esperan los dueños del sistema → Q-004 (preguntada en SRC-02, sin respuesta registrada). Esta respuesta es la que valida o corrige este segmento.

---

## 25. Usuarios y condiciones de uso

**Enunciado ampliado**

Usarán el sistema **los dos dueños**. Cuando no están, queda un **encargado**.

El negocio tiene una computadora que compraron pensando en tener algún día un sistema, y siempre tiene internet. No es necesario usar el sistema desde el teléfono, pero no lo descartan.

**Estado:** ✅ Respaldado · **Cambio:** Nuevo. SRC-01 decía *"principalmente uno de ellos, el mayor"*; SRC-02 dice *"Los dos dueños"*. Se toma SRC-02 (más reciente y respuesta directa).

**Evidencia:**
- SRC-02 (Q-006): "Los dos dueños." / "Dejan un encargado."
- SRC-01: "Tienen una pensada para ver si algun dia tenian un sistema." / "Siempre tiene" (internet) / "No necesariamente, pero no se descarta si pudieran usarlo." (teléfono)

**Preguntas respondidas:** Q-006

**Lo que sigue abierto:**
- Quién es el encargado y qué puede hacer en el sistema → Q-047.

---

## Contradicciones entre fuentes

| #   | Tema                         | Una fuente dice                                           | Otra fuente dice                                       | Cómo quedó                                                          |
| --- | ---------------------------- | --------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------- |
| 1   | Porcentajes de los mecánicos | SRC-01: 50 %, 60 % y una excepción con 100 %              | SRC-03: "60% por ahora solo hay dos"                   | **Abierta** → Q-045 (seg. 12)                                       |
| 2   | Historial de motos           | SRC-01: "no es importante realmente"                      | SRC-02: "Si, es bueno, porque asi se les paga…"        | Se toma SRC-02 (seg. 20)                                            |
| 3   | Grasa en los engrases        | Borrador: grasa del inventario; intento 1: insumos aparte | SRC-02 / SRC-03: se cobra el engrase; grasa del mecánico | Corregido (seg. 11)                                               |
| 4   | Quién instala piezas nuevas  | SRC-02: "los dueños la ponen, no los mecánicos"           | SRC-03: describe cómo se resuelve si se daña al instalarla | **Abierta**, baja → Q-056 (seg. 11)                             |
| 5   | Usuarios del sistema         | SRC-01: "principalmente uno de ellos, el mayor"           | SRC-02: "Los dos dueños"                               | Se toma SRC-02 (seg. 25)                                            |
| 6   | Apoyo entre mecánicos        | Borrador: puede haber apoyo de otros trabajadores         | SRC-03: "Cada mecánico repara lo que le corresponde."  | Corregido (seg. 14)                                                 |

---

## Qué entra a S3

**Segmentos ✅ (base del modelo conceptual):** 1, 2, 3, 4, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 20, 22, 23, 25.

**Segmentos 🟡:** solo entra la parte del texto ampliado que tiene evidencia; las citas marcadas *"Borrador sin fuente"* **no** entran. Son el 5, 6, 12 y 21.

**Segmento ⚪:** el 13 no entra.

**Preguntas 🔴 que conviene resolver durante S3** (pueden cambiar entidades o relaciones):

| ID    | Tema                                         | Por qué afecta al modelo                                                         |
| ----- | -------------------------------------------- | -------------------------------------------------------------------------------- |
| Q-045 | Cuántos mecánicos y qué porcentaje tiene cada uno | Define si el porcentaje es de cada mecánico o uno general.                  |
| Q-046 | Dueño que hace una reparación                | Define si "quien repara" puede ser un dueño y no solo un mecánico.               |
| Q-047 | Encargado                                    | Define los usuarios y qué puede registrar cada uno.                              |
| Q-048 | Datos de la moto y del cliente en reparaciones | Define qué se guarda para identificar motos y clientes.                        |
| Q-049 | Abonos a créditos                            | Define si un crédito tiene uno o varios pagos.                                   |
| Q-063 | Compatibilidad repuesto–modelo               | Define si existe la relación entre productos y modelos de moto.                  |
| Q-004 | Qué esperan del sistema                      | Define el alcance de la versión 1.                                               |
| Q-007 | Qué les hace perder más tiempo y dinero      | Define qué resolver primero.                                                     |

---

## Notas de la ampliación (para la revisión del equipo)

- **Q-004, Q-005 y Q-007** aparecen en SRC-02 sin respuesta. Si los dueños sí respondieron y falta transcribirlo, completar SRC-02 y actualizar los segmentos 2, 15, 23 y 24.
- **SRC-03:** el guion era para el mecánico de 100 %, pero la respuesta habla de 60 %. Confirmar a quién se entrevistó → Q-058 (equipo).
- **"400 u 600"** (engrases): la fuente no dice la moneda; se asume córdobas, pero no se escribió en el texto.
- **"líquido de barra"** se dejó tal como se dijo; puede ser una forma local de llamar a otro producto (Q-057).
- La frase sobre el cliente sin dinero para reparar el motor estaba escrita debajo de Q-018; se ubicó en el segmento 10.
- Redactado por Claude el 2026-10-23 a pedido de Kenry. Las citas son textuales (con la ortografía original de la transcripción).
