# 🔍 Revisión crítica del intento 1

> [!warning] Qué es y qué NO es esta nota
> - **Es** una lista de **puntos débiles** de todo lo producido en el intento 1, cada uno con **evidencia** (dónde se ve) y **por qué importa**. Al final hay **casos posibles** del negocio que el trabajo actual no contempla.
> - **No es** una lista de soluciones. Aquí no se propone nada, a propósito: pensar las respuestas le toca al equipo.
> - Es una nota de tipo **revisión** (qué son y cómo se responden: [[Knowledge - Cómo documentar un proyecto en Obsidian#3.8 Revisiones (Reviews)|Cómo documentar → Revisiones]]).
> - Varios de estos puntos son **responsabilidad mía** (gran parte del intento 1 la produje yo como IA). Se señalan igual.

> [!info] Cómo leer cada punto
> - **W-xx** = punto débil (*weakness*). **C-xx** = caso posible no contemplado.
> - **Evidencia** = nota y sección donde se ve. Si no la encuentras o no estás de acuerdo, eso también es una respuesta válida.
> - **Severidad:**
> 	- 🔴 **Alta** → puede cambiar entidades o relaciones, o invalida una conclusión importante.
> 	- 🟠 **Media** → cambia reglas, cálculos, restricciones o la confianza en un resultado.
> 	- 🟡 **Baja** → claridad, orden o documentación.

---
## Resumen

| Grupo | Puntos | 🔴 | 🟠 | 🟡 |
| --- | --- | --- | --- | --- |
| A. Proceso y método | W-01 … W-06 | 2 | 4 | 0 |
| B. Evidencia y validación con los dueños | W-07 … W-11 | 3 | 2 | 0 |
| C. Enunciado y alcance | W-12 … W-18 | 6 | 1 | 0 |
| D. Reglas de negocio y conceptos | W-19 … W-23 | 1 | 4 | 0 |
| E. Modelo de datos | W-24 … W-40 | 2 | 11 | 4 |
| F. Modelo orientado a objetos | W-41 … W-43 | 0 | 2 | 1 |
| G. Documentación | W-44 … W-48 | 0 | 2 | 3 |
| H. Viabilidad y uso real | W-49 … W-51 | 2 | 0 | 1 |
| I. Casos posibles | C-01 … C-20 | — | — | — |

---
## A. Proceso y método

### W-01 🔴 El núcleo del trabajo tuvo autoría externa al equipo
- **Qué:** el enunciado consolidado, el Data Model v1 y v2, el relacional, el modelo OO y las decisiones DEC-001 a DEC-005 fueron redactados por la IA; el equipo revisó y aprobó después.
- **Evidencia:** `S2 - Data Model v1` (*"Esto es una decisión de diseño, no un hecho del brief… te la dejo modelada"*); `S2 - Data Model v2` (fases escritas en segunda persona: *"lo que distingue tu entrega"*); en la bitácora del 12-oct y 13-oct los modelos los "hace" Claude; `S2 - Modelo relacional` §1, donde Kenry escribe las definiciones **después** de que el modelo ya existía.
- **Por qué importa:** el equipo aprende a **justificar** decisiones ajenas, no a **tomarlas**. Las inconsistencias que nadie pensó por sí mismo no se detectan, y en una exposición o con el docente cuesta defender lo que no se razonó.

### W-02 🔴 La validación con el negocio llegó después de modelar
- **Qué:** el orden real fue enunciado → MER/EER → relacional → **preguntas a los dueños** → rehacer.
- **Evidencia:** `S2 - Preguntas para los dueños` creada el 12-oct, el mismo día que el relacional v1; el relacional v2 del 13-oct cambió 2 tablas y 6 decisiones por las respuestas (`Modelo relacional` §0, historial v2).
- **Por qué importa:** cada respuesta tardía obliga a deshacer trabajo, y el trabajo deshecho deja residuos (ver W-12, W-44).

### W-03 🟠 Etapas declaradas "cerradas" o "vigentes" con pendientes abiertos
- **Qué:** varias notas dicen que algo está terminado cuando sus propios criterios de cierre no se cumplen.
- **Evidencia:** `S2 - Data Model v2` tiene `status: ✅ Vigente`, pero el relacional v2 lo contradice en crédito, mecánico, garantía y marcas; `010 - Development` dice "S2 cerrada en lo técnico" con P1 (estructural) sin responder; el criterio de cierre del relacional tiene "Revisado con el equipo / docente" sin marcar.
- **Por qué importa:** si "cerrado" no significa cumplir una lista verificable, nadie sabe en qué estado está realmente el proyecto.

### W-04 🟠 Decisiones que se revierten en menos de 48 horas
- **Qué:** DEC-004 pasó de "mecánico solo en la orden" (12-oct) a "mecánico en cada trabajo" (13-oct). DEC-003 pasó de "pago → un documento" a "pago + aplicación".
- **Evidencia:** `DEC-004` y `DEC-003`, secciones *Contexto* y *Por qué cambió*.
- **Por qué importa:** una decisión que cambia tan rápido indica que se tomó **sin la información suficiente**. El problema no es corregir, sino haber decidido antes de saber.

### W-05 🟠 Entregables formales producidos antes de cerrar las validaciones
- **Qué:** el reporte .docx y las diapositivas presentan el modelo como "validado con el negocio" y "listo para implementarse".
- **Evidencia:** `Assets/Motor IRM - Avance Modelo Relacional y MOO.docx` §5.2 y §10 (*"coherentes entre sí, listos para la implementación"*), con P1, P17, P20 y P21 sin respuesta y sin revisión del docente.
- **Por qué importa:** lo que se presenta en clase se convierte en compromiso. Si luego cambia, hay que explicar por qué se dijo que estaba listo.

### W-06 🟠 El trabajo del equipo no está registrado
- **Qué:** no hay rastro de aportes, discusiones ni desacuerdos de los compañeros; todo pasa por una persona y la IA.
- **Evidencia:** `020 - LogBook` escrito en primera persona del singular; la nota `Para Claude` la redacta una sola persona; ninguna nota menciona a otro integrante.
- **Por qué importa:** en un proyecto de equipo, lo que no está registrado no existe para el docente ni para el propio equipo. Además, una sola perspectiva no detecta lo que las otras verían.

---
## B. Evidencia y validación con los dueños

### W-07 🔴 No existe la evidencia primaria
- **Qué:** no hay ninguna nota con lo que los dueños dijeron **textualmente**, ni con lo observado en el negocio. Solo hay síntesis redactadas.
- **Evidencia:** `S1 - Descubrimiento` es un resumen redactado; `S2 - Guía de observación` planifica qué observar, pero no existe nota de lo observado; `020 - LogBook` dice *"Las entradas anteriores a hoy son una reconstrucción"*.
- **Por qué importa:** sin la fuente, cuando una conclusión resulta dudosa no hay a dónde volver. Todo lo posterior se apoya en interpretaciones de interpretaciones.

### W-08 🔴 Las respuestas de los dueños se interpretaron sin devolverles la interpretación
- **Qué:** respuestas ambiguas se convirtieron en estructuras complejas sin confirmar con los dueños que eso era lo que querían decir.
- **Evidencia:**
	- **P9:** *"se anota lo que ha consumido… para ir sumando para cobrarle"* → se convirtió en cuenta corriente con reparto FIFO automático (`DEC-003`). El "FIFO" no lo dijo nadie del negocio.
	- **P4:** *"se le paga la misma semana que realizó el trabajo"* → se convirtió en "la fecha de registro del trabajo define la semana" (`DEC-004`).
	- **P5:** *"casi imposible"* → aun así cambió la estructura (mecánico en cada trabajo).
- **Por qué importa:** el modelo puede representar con precisión algo que el negocio **no hace**.

### W-09 🟠 Pocas voces del negocio
- **Qué:** las respuestas parecen venir de un solo dueño, y los mecánicos (afectados directos por la comisión) nunca fueron consultados.
- **Evidencia:** `S2 - Preguntas` P11: *"Me explicó el dueño…"*; el proyecto menciona dos propietarios; ninguna fuente de mecánicos.
- **Por qué importa:** dos dueños pueden trabajar distinto, y los mecánicos conocen detalles del taller (tiempos, insumos, quién termina qué) que los dueños quizá no.

### W-10 🟠 Preguntas que el propio equipo planificó y nunca hizo
- **Qué:** la Guía de observación tenía preguntas prioritarias que no aparecen respondidas en ningún lado.
- **Evidencia:** `S2 - Guía de observación` §13: *"¿Cómo se determina el límite [de crédito]?"*, *"¿Quién autoriza la devolución?"*, *"¿Cómo se determina el nuevo precio de venta?"*, *"¿Qué ocurre cuando una compra contiene productos con problemas?"*, *"¿Qué información de la factura debe conservarse?"*.
- **Por qué importa:** son preguntas que el equipo ya sabía que eran importantes; quedaron como supuestos implícitos.

### W-11 🔴 Una pregunta estructural sigue abierta y el modelo se declaró listo
- **Qué:** cómo se compran, miden y cobran aceites y grasas (P1) no tiene respuesta.
- **Evidencia:** `S2 - Preguntas` P1 vacía; `Modelo relacional` asume `unidad_medida` única por producto.
- **Por qué importa:** de esa respuesta depende cómo se cuenta el inventario y cómo se calcula el costo (ver W-24).

---
## C. Enunciado y alcance

### W-12 🔴 Existen dos enunciados "oficiales" que se contradicen
- **Qué:** la nota del enunciado nunca se actualizó; el enunciado ampliado vive solo en el .docx.
- **Evidencia:** `S2 - Enunciado del dominio` (`status: ✅ Consolidado`) dice *"40 %… 50 %… 100 %"*; el .docx §4.4 dice 50 %, 60 % y 100 %. La nota además no menciona créditos acumulados, autorización de trabajos ni catálogo de servicios.
- **Por qué importa:** el enunciado es la base de todo. Si hay dos, cualquier modelo es "correcto" según cuál se lea.

### W-13 🔴 El alcance de la primera versión nunca se definió
- **Qué:** no existe una lista de qué entra y qué no entra en la versión 1.
- **Evidencia:** `010 - Development` roadmap, S3 *"Alcance de la versión 1"* sin hacer; el relacional tiene 25 tablas sin prioridad; `S2 - Context Brief` §22: *"Formalizar únicamente lo necesario"*.
- **Por qué importa:** sin alcance no se puede saber si 25 tablas son demasiadas o pocas, ni qué se puede construir en el tiempo de la clase.

### W-14 🔴 Necesidades del descubrimiento sin destino
- **Qué:** necesidades y preguntas del S1 que no se modelaron ni se excluyeron explícitamente.
- **Evidencia:** `S1` *Necesidades*: *"Llevar control de caja"*; *Preguntas*: *"¿Cuánto dinero existe en caja?"*, *"¿Cuánto dinero está invertido en inventario?"*; `S2 - Enunciado` mapa: *Administración → Caja, Costos, Utilidades*; `Context Brief` §21. En el modelo no hay caja, y en las preguntas P19 se asumió "caja fuera de la versión 1" sin que nadie lo decidiera.
- **Por qué importa:** el problema central del S1 era justamente no poder responder esas preguntas.

### W-15 🔴 La "utilidad real" no se puede calcular con lo que se registra
- **Qué:** el modelo registra ingresos, costo de productos y comisiones, pero no otras salidas de dinero.
- **Evidencia:** `Context Brief` §21: *"Pagar compromisos. Realizar reinversiones"* y *"diferenciar Ingreso, Cobro, Costo, Pago, Utilidad"*; `Context Brief` §7: los dueños *"viajan personalmente para adquirir mercancía"*; el .docx §4.6 promete *"cuál es la utilidad real"*.
- **Por qué importa:** se prometió una respuesta que el modelo no puede dar.

### W-16 🔴 El entorno fiscal y monetario no se investigó
- **Qué:** nunca se preguntó por impuestos, requisitos de los comprobantes ni moneda.
- **Evidencia:** ninguna nota menciona IVA ni requisitos de facturación; el relacional dice *"Dinero: NUMERIC(12,2) (córdobas)"* como supuesto; el enunciado habla de *"generar comprobantes o facturas"*; los dueños regresaron de Estados Unidos y los proveedores pueden manejar precios en otra moneda.
- **Por qué importa:** impuestos, numeración de comprobantes o una segunda moneda pueden cambiar la estructura de documentos, precios y costos.

### W-17 🔴 No hay requisitos no funcionales
- **Qué:** se asumió "aplicación web" sin conocer cómo y dónde se usaría.
- **Evidencia:** ninguna nota registra en qué dispositivo trabajarían los dueños (celular, computadora), si hay internet estable en el local, cuánto tiempo aceptan por operación, ni respaldo de la información.
- **Por qué importa:** el `Context Brief` §22 dice *"mínima fricción operativa"*: sin medir la fricción, no se puede saber si el diseño la cumple.

### W-18 🟠 "Solo los dueños usarán el sistema" tiene consecuencias no analizadas
- **Qué:** si solo los dueños registran, todo lo que pasa en el taller depende de que ellos lo anoten, y no hay forma de saber cuál de los dos hizo cada cosa.
- **Evidencia:** `S2 - Preguntas` P19; ninguna tabla guarda quién registró, modificó o anuló.
- **Por qué importa:** carga de trabajo concentrada en dos personas y ningún rastro si hay un error o una diferencia de dinero.

---
## D. Reglas de negocio y conceptos

### W-19 🟠 No hay glosario y varias palabras tienen más de un significado
- **Evidencia:**
	- **"Servicio":** es el `tipo` de documento (`'servicio'`), es una tabla (`servicio` = catálogo) y es la actividad del taller.
	- **"Crédito":** deuda de un documento (12-oct) o cuenta acumulada del cliente (13-oct).
	- **"Garantía":** del producto, del proveedor o de la reparación (P11, P17).
	- **"Repuesto / insumo / producto":** se renombró una tabla por esto (`DEC-005`).
- **Por qué importa:** si las palabras no significan lo mismo para todos, el equipo, el docente y los dueños pueden estar de acuerdo en frases que entienden distinto.

### W-20 🟠 Las reglas de negocio están dispersas, sin ID ni fuente
- **Evidencia:** reglas en `S1` (lista sin ID), `Data Model v2` §1.3 (numeradas 1–9), `Modelo OO` §7 (R-01 a R-23), dentro de los DEC y en el .docx §7.5. Ninguna indica de qué fuente salió.
- **Por qué importa:** no se puede saber si una regla se modeló, si está repetida, si cambió o quién la dijo.

### W-21 🟠 Reglas del descubrimiento que desaparecieron sin decisión
- **Evidencia:**
	- `S1`: *"Las devoluciones solo se aceptan cuando el producto no ha sido abierto"* → no hay atributo ni validación en ningún modelo, pero el .docx §4.5 lo repite como vigente.
	- `Context Brief` §20: *"Venta a empleado"* como caso distinto → no aparece.
- **Por qué importa:** una regla que se pierde sin una decisión escrita es un hueco invisible.

### W-22 🔴 Decisiones de diseño presentadas como reglas del negocio
- **Qué:** varias "reglas" del modelo OO no vinieron de los dueños.
- **Evidencia:** `Modelo OO` §7: R-09 (abonos FIFO), R-16 (avisar sin bloquear cuando no hay stock, que depende de P21 sin responder), R-12 (semana cerrada no editable), R-19 (no anular con pagos), R-22 (no entregar con trabajos propuestos). Ninguna tiene fuente en el negocio.
- **Por qué importa:** cuando una decisión técnica se disfraza de regla del negocio, nadie la cuestiona, y el negocio queda obligado a trabajar como el sistema decidió (contradice *"el sistema se adapta al negocio"*).

### W-23 🟠 Ingreso, cobro y pago se mezclan en el cálculo de comisiones
- **Evidencia:** `DEC-004`: al mecánico se le paga por trabajo hecho aunque el cliente quede al crédito (P4); `Context Brief` §21 pide distinguir ingreso, cobro y pago.
- **Por qué importa:** el negocio paga comisiones con dinero que todavía no cobró. Esa diferencia afecta la caja (W-14) y no está representada.

---
## E. Modelo de datos

### W-24 🔴 Una sola unidad de medida por producto
- **Evidencia:** `Modelo relacional` → `producto.unidad_medida`; P1 sin respuesta.
- **Por qué importa:** si se compra por galón o cubeta y se vende o usa por litro u onza, el stock y el costo por unidad quedan inconsistentes.

### W-25 🟠 El costo de lo vendido es "el último costo de compra"
- **Evidencia:** `detalle_venta.costo_unitario` = copia de `producto.costo_referencia`, que se actualiza con cada compra (R-21). No hay método de valuación del inventario, y el costo de traer la mercancía (viajes, transporte) no entra en ningún costo.
- **Por qué importa:** la utilidad calculada puede estar distorsionada aunque cada número individual sea "correcto".

### W-26 🟠 El descuento y la comisión no se hablan
- **Evidencia:** `documento_cobrable.descuento_monto` se aplica al total; `v_comision_mecanico` calcula sobre `valor_mano_obra` sin descuento.
- **Por qué importa:** si el dueño rebaja el total de una reparación, no está definido si eso afecta la mano de obra, los productos o ambos, ni quién absorbe la rebaja.

### W-27 🔴 Devoluciones y garantías solo existen para ventas de mostrador
- **Evidencia:** `devolucion.id_detalle_venta` es la única referencia; `producto_orden` no puede devolverse ni reclamarse; el reclamo al proveedor (P11) no se relaciona con proveedor ni compra.
- **Por qué importa:** un repuesto instalado en el taller que falla es probablemente el caso de garantía **más común** del negocio, y no tiene dónde registrarse.

### W-28 🟠 No existe la deuda con los proveedores
- **Evidencia:** `compra` no tiene condición de pago ni pagos; `Context Brief` §21: *"pagar compromisos"*.
- **Por qué importa:** si se compra a crédito, el negocio debe dinero que el sistema no ve.

### W-29 🟠 Todo pago tiene que aplicarse a un documento existente
- **Evidencia:** `aplicacion_pago` requiere `id_documento`; R-08: *"el pago no puede quedar con dinero sin aplicar"*.
- **Por qué importa:** un adelanto antes de que exista la orden, un pago mayor que la deuda o un saldo a favor no tienen dónde registrarse.

### W-30 🟠 Anticipo mayor que lo generado por el mecánico
- **Evidencia:** `pago_mecanico` y `v_comision_mecanico`: el saldo puede quedar negativo y no hay forma de que pase a la semana siguiente; R-12 cierra la semana.
- **Por qué importa:** una deuda del mecánico con el negocio quedaría invisible.

### W-31 🟠 No se puede atender sin registrar cliente y moto
- **Evidencia:** `orden_servicio.id_motocicleta` NOT NULL y `motocicleta.id_cliente` NOT NULL.
- **Por qué importa:** un servicio rápido (inflar una llanta, ajustar un freno) obliga a crear un cliente y una moto, o a inventar registros "genéricos" que ensucian los datos.

### W-32 🟡 Una persona con varios papeles
- **Evidencia:** `mecanico.id_cliente` para cobrarle al mecánico; `Data Model v2` §3.3 había rechazado la idea de "Persona".
- **Por qué importa:** los datos de una misma persona pueden quedar duplicados e inconsistentes, y la decisión original quedó contradicha sin registrarse.

### W-33 🟠 La coherencia del inventario depende solo del programa
- **Evidencia:** `movimiento_inventario`: el CHECK permite **cero** orígenes con `motivo = 'compra'`; nada impide `motivo = 'venta'` con `tipo = 'entrada'`; nada garantiza que cada línea tenga su movimiento; el `tipo` del documento no se verifica contra su tabla hija (`DEC-001`, consecuencias).
- **Por qué importa:** un error de programación o una edición manual deja el stock mal, sin que la base de datos lo impida.

### W-34 🟠 No está definido cuándo existe un "comprobante"
- **Evidencia:** la orden nace al ingresar la moto con total C$0; `numero_comprobante` es opcional; P9 sugiere que al cliente con crédito *"se le va sumando"*, tal vez sin un comprobante por cada consumo.
- **Por qué importa:** "documento", "orden", "factura" y "comprobante" pueden ser cosas distintas para el negocio.

### W-35 🟠 La compatibilidad tiene un costo de mantenimiento no evaluado
- **Evidencia:** tabla `compatibilidad` (producto × modelo); nadie preguntó cuántos productos y modelos existen ni quién cargaría esos datos.
- **Por qué importa:** una tabla que nadie puede mantener queda vacía, y entonces no sirve para lo que se diseñó.

### W-36 🟠 Productos con variantes y combos
- **Evidencia:** `producto` no distingue tallas ni colores; no existen "paquetes" (P1 mencionaba que el servicio podría tener un precio que ya incluye el insumo).
- **Por qué importa:** un casco en 4 tallas o un "cambio de aceite completo" a precio fijo no tienen una forma clara de registrarse ni de descontarse del inventario.

### W-37 🟡 El precio sugerido del servicio no depende de la moto
- **Evidencia:** `servicio.precio_sugerido` único; P3: *"un estándar… podría variar con otros modelos de motos"*.
- **Por qué importa:** la sugerencia puede ser casi siempre incorrecta.

### W-38 🟡 La semana de pago es rígida
- **Evidencia:** `periodo_pago`: CHECK lunes y `fecha_fin = fecha_inicio + 5`.
- **Por qué importa:** feriados, semanas cortas o pagos adelantados (Semana Santa, fin de año) quedan fuera de lo que la base permite.

### W-39 🟠 No hay rastro de quién hizo qué
- **Evidencia:** ninguna tabla guarda usuario ni fecha de modificación; `anulado` es un booleano sin motivo ni responsable.
- **Por qué importa:** con dinero de por medio y dos dueños, una diferencia no se puede explicar.

### W-40 🟡 Por defecto todo trabajo está "autorizado"
- **Evidencia:** `trabajo_realizado.estado DEFAULT 'autorizado'`; P15: *"se le consulta al cliente"*.
- **Por qué importa:** el valor por defecto permite saltarse justo lo que el negocio dijo que hace.

---
## F. Modelo orientado a objetos

### W-41 🟠 El modelo OO se derivó de las tablas, no del comportamiento del negocio
- **Evidencia:** `Modelo OO`: *"Entrada: Modelo relacional"*; la máquina de estados (por ejemplo TERMINADA → EN_PROCESO) y las reglas de cancelación no salieron de los dueños.
- **Por qué importa:** el modelo OO termina siendo un espejo de las tablas con métodos agregados, y los comportamientos inventados pasan por reales.

### W-42 🟠 Casos de uso sin requisitos ni actores reales detrás
- **Evidencia:** CU-01 a CU-14 en `Modelo OO` §5 aparecen antes de cualquier requisito funcional; el roadmap pone "requisitos" en S3, **después**.
- **Por qué importa:** los casos de uso describen funciones que alguien imaginó, no metas de los usuarios.

### W-43 🟡 El modelo incluye código y presupone tecnología
- **Evidencia:** `Modelo OO` §3 y §4 con pseudocódigo Python y SQL escritos por la IA; el lenguaje todavía no se ha decidido.
- **Por qué importa:** contradice el objetivo de aprender escribiendo, y ata el modelo a una tecnología antes de tiempo.

---
## G. Documentación

### W-44 🟠 La fuente de verdad está fragmentada
- **Evidencia:** las reglas viven en 5 lugares (W-20); el enunciado en 2 (W-12); el modelo de datos en draw.io, Mermaid, tablas del .docx y `Data Model v2` "vigente".
- **Por qué importa:** cuando dos documentos dicen cosas distintas, nadie sabe cuál manda.

### W-45 🟡 Convenciones propias rotas
- **Evidencia:** `030 - Contexto para Claude` (la Methodology reserva `030` para el Changelog y llama a esto "Kickoff IA"); `Plan de reinicio` y `Para Claude` sin convención.
- **Por qué importa:** las convenciones existen para no pensar dónde va cada cosa; rotas, obligan a recordar excepciones.

### W-46 🟠 Las propiedades de autoría no se usaron
- **Evidencia:** la Methodology pide `source: IA` y `revisado: true`; las notas de S2 tienen `revisado: false` o `source:` vacío.
- **Por qué importa:** no se puede saber qué validó el equipo y qué no.

### W-47 🟡 Notas que mezclan propósitos
- **Evidencia:** `Modelo OO` = modelo + guía de programación + pseudocódigo + reglas + ejercicios; `Modelo relacional` = diccionario + historial + retroalimentación + ejercicios.
- **Por qué importa:** una nota con muchos propósitos es difícil de revisar y de mantener al día.

### W-48 🟡 Historia reconstruida
- **Evidencia:** `020 - LogBook`: *"Las entradas anteriores a hoy son una reconstrucción a partir de las fechas de los archivos"*.
- **Por qué importa:** el registro de agosto y septiembre no es confiable como evidencia del proceso.

---
## H. Viabilidad y uso real

### W-49 🔴 La carga de registro contradice la filosofía del proyecto
- **Evidencia:** para un cambio de aceite el modelo exige cliente, moto (modelo, color), orden, trabajo con estado, insumos con cantidad decimal, pago y aplicación (`Modelo OO` §11, ejercicio 2); `S1`: los dueños *"no desean dedicar una cantidad considerable de tiempo a registrar información"*.
- **Por qué importa:** si registrar toma más que trabajar, el sistema no se usa, y un sistema sin datos no resuelve nada.

### W-50 🔴 No se sabe cómo arranca el inventario
- **Evidencia:** `S1`: *"El inventario se controla visualmente"*; el kardex supone que todo stock nace de una compra o un ajuste registrado.
- **Por qué importa:** sin un conteo inicial, el stock está mal desde el primer día y todo lo que depende de él también.

### W-51 🟡 Dos objetivos que compiten
- **Evidencia:** `000 - Motor IRM`: proyecto de clase (70 % de la nota) **y** sistema real para los dueños; `Context Brief` §1 menciona además la asignatura futura de Administración de Bases de Datos.
- **Por qué importa:** los plazos de la clase y las necesidades del negocio pueden pedir cosas distintas, y eso no está escrito en ningún lado.

---
## I. Casos posibles no contemplados

> Situaciones **realistas** en un taller y tienda de repuestos. No se afirma que ocurran en este negocio: son preguntas que el modelo actual no sabe responder.

| Caso | Situación | Qué parte del trabajo pone a prueba |
| --- | --- | --- |
| C-01 | El cliente trae **su propio repuesto** (comprado en otro lado) y solo paga la mano de obra. A la semana el repuesto falla | Producto que no es del inventario; responsabilidad de la garantía |
| C-02 | El cliente deja un **adelanto** para que se encargue una pieza que no hay. La pieza no llega o el cliente desiste | Pagos sin documento; pedidos a proveedor; devolución de dinero |
| C-03 | Una parte del trabajo se **envía a otro taller** (torno, rectificación, soldadura) con un costo externo | Costos del servicio que no son productos ni mano de obra propia |
| C-04 | Un repuesto **instalado en el taller** falla a los tres días | Garantía de productos de orden (W-27) |
| C-05 | El cliente **no regresa** por su moto durante semanas; el trabajo está hecho y la comisión ya pagada | Órdenes terminadas sin entregar; dinero comprometido |
| C-06 | Al entregar, el dueño rebaja el total "por ser cliente de siempre" | Descuento vs comisión (W-26) |
| C-07 | El proveedor factura en **dólares** y el tipo de cambio sube | Moneda, costos y precios (W-16) |
| C-08 | Se compra una **cubeta de 5 galones**; se vende por litro y se usa por onza en el taller | Unidades y conversión (W-24) |
| C-09 | Un **conteo físico** encuentra 3 bujías menos que el sistema | Pérdidas, robo, ajustes y su responsable |
| C-10 | Se descubre el lunes que la venta del lunes anterior se registró **con el producto equivocado**; la semana ya se pagó | Corrección de errores en periodos cerrados |
| C-11 | Un cliente **paga de más** o deja saldo a favor para su próxima visita | Pagos sin aplicar (W-29) |
| C-12 | Otro mecánico o taller compra con **precio especial** | Listas de precios o tipos de cliente |
| C-13 | "Cambio de aceite completo" a **precio fijo** que incluye aceite y filtro | Combos; separación de mano de obra e insumos para la comisión |
| C-14 | Los **dos dueños** registran a la vez desde dos dispositivos y uno anula algo del otro | Concurrencia, auditoría (W-39) |
| C-15 | **Se va el internet** una tarde con el taller lleno | Requisitos no funcionales (W-17) |
| C-16 | El mecánico **daña una pieza nueva** durante la instalación | Pérdida de inventario; quién la paga; efecto en la orden |
| C-17 | Un mecánico pide un **anticipo mayor** que lo generado y falta toda la semana siguiente | Saldos negativos entre semanas (W-30) |
| C-18 | Un cliente con deuda **vende su moto**; la moto vuelve al taller con otro dueño | Historial de la moto vs deuda del cliente |
| C-19 | Un cliente **cambia un casco** por otra talla más cara | Devolución + nueva venta + diferencia de precio |
| C-20 | Un servicio de **5 minutos** sin cobro o con cobro mínimo | Registro mínimo (W-31, W-49) |

---
## Cómo responder esta revisión (para el equipo)

> Esto **no** es una propuesta de solución: es la forma de dejar registro de lo que el equipo piense.

Para cada W y cada C, el equipo escribe en la columna correspondiente de la tabla de respuestas (o en una nota de respuesta):

| ID | ¿Estamos de acuerdo? | Por qué | ¿A qué etapa del ciclo 2 afecta? |
| --- | --- | --- | --- |
| W-01 | | | |
| … | | | |

Rechazar un punto **con argumentos** es una respuesta tan válida como aceptarlo.
