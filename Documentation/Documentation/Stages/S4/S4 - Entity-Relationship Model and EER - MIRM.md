---
project: "[[Motor IRM]]"
stage: S4
status: ✅ Cerrada (01-nov)
started: 2026-10-27
finished: 2026-11-01
source:
ai_edit: "Claude — 2026-10-27 y 2026-10-28: insumos, pendientes de S3, G-2 y DEC-008 decididas; 28-oct (tarde): decisiones 1, 4, 5, 9 y 10 registradas, recomendaciones para 3 y 6, escenarios, lo que pasa a S5 y criterio de cierre; 28-oct: resultado (MER/EER v1) y decisiones 3 y 6 como provisionales; 28-oct: acuerdo de DEC-010 (S4 se cierra después del 29-oct); decisión 8 al día (PostgreSQL para la entrega)"
reviewed: true
---
**[[Motor IRM|← Hub]]** · **[[S3 - Develop a Conceptual Model - MIRM|← S3]]** · **[[S3 - Conceptual Model - MIRM|Modelo conceptual]]**

# S4 - Entity-Relationship Model and EER - MIRM

## Objetivo de la etapa

Modelado de las entidades con sus atributos, siendo trazadas con relaciones, de ser necesario un modelo extendido, con justificaciones registradas en Decisions/, justificando todo con sus fuentes y reglas de negocio identificadas previamente.

Aquí no se hará normalización. Si surgen dudas o alguna incógnita que pueda influir el diseño hay que volver a una entrevista, modelarlo y posteriormente añadirlo al modelo entidad relación.
## Insumos

- [[S3 - Conceptual Model - MIRM|Modelo conceptual v2.1]] (entidades, relaciones, estados y generalizaciones G-1 a G-3; el conteo está solo en su §1)
- [[Business Rules - MIRM|Business Rules]] · [[Traceability - MIRM|Traceability]]
- Decisiones DEC-003 a DEC-009
- [[S3 - Develop a Conceptual Model - MIRM]]

## Qué hacer en el MER/EER

1. **Identificadores:** elegir la llave de cada entidad (natural o sustituta) y marcar las entidades débiles (por ejemplo, *Detalle de venta* depende de *Venta*).
2. **Cardinalidad y participación** formales para todas las relaciones, cada una citando su BR (en el modelo conceptual están en palabras).
3. **Atributos:** simples o compuestos, multivaluados (¿teléfonos?), derivados (borde punteado) e históricos.
4. **Arcos exclusivos** (R-25, R-26, R-27): resolverlos con generalización o dejarlos como restricción.
5. De ser necesario EER que se lleve acabo.
6. **Recorrido con escenarios** (sección *Escenarios*): cada uno se registra paso a paso sobre el MER; si alguno no se puede registrar, falta algo en el modelo o una pregunta.
7. **Diagramas:** todos en **Mermaid** dentro de la nota del [[S4 - ER and EER Model - MIRM|MER/EER v1]]: el MER en notación pata de gallo (por áreas) y el EER con diagramas de flujo (círculo `d`, entidades débiles, arco exclusivo).

## Decisiones que tomar en S4

| #   | Tema                                                      | Opciones                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Registrar en                                       |
| --- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 1   | **G-1 Documento cobrable** (Venta, Servicio mecánico)     | ✅ **Decidido por el equipo (28-oct): nueva entidad *Documento cobrable*** como superclase de *Venta* y *Servicio mecánico*, con lo común (cliente, fecha, número de comprobante, condición, rebaja, total, registrado por); *Pago de cliente* y *Crédito* se cuelgan de ella. Las restricciones (total o parcial, disjunta) se fijan al dibujar el EER.                                                                                                                                                                               | [[DEC-011 - Billable Document Superclass - MIRM|DEC-011]] |
| 2   | **G-2 Personal** (Dueño, Mecánico, Encargado)             | ✅ **Decidido por el equipo (28-oct): especialización disjunta.** Cada relación se cuelga de la subclase que la cumple: adelantos y pago semanal → Mecánico; retiros, créditos, rebajas y reclamos → Dueño; responsable del servicio → Personal (solo dueño o mecánico); registra ventas → Personal (solo dueño o encargado).                                                                                                                                                                                                          | [[DEC-012 - Staff Disjoint Specialization - MIRM|DEC-012]] |
| 3   | **G-3 Origen de movimiento**                              | 🟡 **Provisional en el [[S4 - ER and EER Model - MIRM\|MER v1]]** (falta que el equipo la confirme). Superclase de documentos · o seis relaciones opcionales. **Recomendación de la IA (28-oct):** arco exclusivo con restricción: los seis orígenes no comparten atributos (en EER serían una *categoría*, no una generalización como G-1).                                                                                                                                                                                          | [[DEC-014 - Exclusive Arc for Inventory Movement Origin - MIRM|DEC-014]] |
| 4   | **Cambio de estado** del servicio mecánico                | ✅ **Decidido por el equipo (28-oct): entidad débil *Cambio de estado*** de *Servicio mecánico* (propuesta de Gustavo): estado, fecha y hora, registrado por. Da la fecha de cierre para el pago semanal (BR-047) y conserva las vueltas de EN_PRUEBA.                                                                                                                                                                                                                                                                                 | [[DEC-013 - Status Change Weak Entity - MIRM|DEC-013]] |
| 5   | **Abono "a la cuenta"** de un cliente                     | ✅ **Cerrada en DEC-009 (28-oct):** se aplica al crédito más antiguo con saldo y el sobrante al siguiente (BR-096). Consecuencia: un abono puede repartirse entre varios créditos → ***Aplicación de pago*** (en evaluación por el equipo).                                                                                                                                                                                                                                                                                            | [[DEC-009 - Credit per Operation - MIRM\|DEC-009]] |
| 6   | **Saldos iniciales** (deudas que ya existían)             | 🟡 **Provisional en el [[S4 - ER and EER Model - MIRM\|MER v1]]** (falta que el equipo la confirme). Créditos y compras de *saldo inicial* · o un atributo de saldo de apertura. **Recomendación de la IA (28-oct):** clientes → una subclase *Saldo inicial* de *Documento cobrable*, sin líneas (crédito y pagos funcionan igual); proveedores → depende de Q-070 (mientras tanto, un atributo de saldo de apertura).                                                                                                               | [[DEC-015 - Opening Balances - MIRM|DEC-015]] |
| 7   | **DEC-008** Marcas                                        | ✅ **Tomada (28-oct):** *Marca_moto* y *Marca_producto* separadas; gama como atributo del producto.                                                                                                                                                                                                                                                                                                                                                                                                                                    | DEC-008                                            |
| 8   | **DEC-006** Tecnologías                                   | ✅ **Tomada (28-oct):** Django + Python + PostgreSQL, local, desde el navegador instalada como app; PostgreSQL también para la entrega del 29-oct (el docente lo aceptó el 28-oct). Sujeta a la revisión del docente.                                                                                                                                                                                                                                                                                                                  | [[DEC-006 - Technology Stack - MIRM\|DEC-006]]     |
| 9   | Rechazo de falla adicional con trabajo sin terminar       | ✅ **Ya aplicada** en el diagrama de estados: *ESPERA_CLIENTE → EN_PROCESO* ("rechaza con trabajo sin terminar").                                                                                                                                                                                                                                                                                                                                                                                                                      | Modelo §4.1                                        |
| 10  | **Detalle de servicio** (una entidad con *tipo de línea*) | ✅ **Decidido por el equipo (28-oct): nueva entidad *Producto usado en el servicio*** (producto, cantidad, precio unitario H; genera la salida de inventario); *Detalle de servicio* queda para la mano de obra (base de la comisión). El repuesto que trae el cliente va como descripción en la mano de obra, sin monto. **Cargo externo (torno): en evaluación**: es poco frecuente (normalmente el cliente lleva la pieza al torno); si se incluye, va aparte de la mano de obra para que no entre en la comisión (BR-045, BR-082). | Nota en el EER; BR-097 |

### Lo que no cambia la estructura (pasa a S5)

| Tema | Por qué puede esperar |
| --- | --- |
| **Costo de las salidas de inventario** (último costo o costo promedio) | El *costo unitario* (H) del movimiento existe en las dos opciones; cambia cómo se calcula, no las tablas. Afecta el reporte de ganancia. |
| **Anulación de una venta** (*estado*, atributo S) | Hay que definir qué pasa con sus movimientos y pagos; si no se define, se quita el atributo en la versión 1. |
| **Precio anterior** en *Historial de precio* | Se puede obtener de la fila anterior: es un tema de normalización (S5). |

## Preguntas abiertas que pueden cambiar el MER

| Pregunta | Qué cambiaría |
| --- | --- |
| Q-070 ¿Un pago a proveedor cubre varias facturas? | R-22 pasa a muchos a muchos o el pago se relaciona con el proveedor. |
| Q-078 Saldos iniciales | Decisión 6. |
| Q-077 ¿Qué proveedores dan garantía? | Atributo *da garantía*. |
| Q-079 ¿Otros productos por medida? | Unidad de medida en *Producto*. |
| Q-002 Contacto de proveedores · Q-003 Vencimiento · Q-005 Comprobante · Q-057 Líquido de barra · Q-074 Devolución a proveedor · Q-075 Impresora | Atributos; no cambian la estructura. |
| Q-080 Prueba de la moto (solo para el registro) | Nada: EN_PRUEBA ya está en el modelo (BR-094, BR-095). |

## Escenarios para recorrer el MER

Situaciones reales sacadas de las fuentes. Se recorren sobre el MER **antes** de pasar a S5: cada paso tiene que poder registrarse con las entidades y relaciones del modelo.

| # | Escenario | Qué pone a prueba | Reglas / fuente | Resultado |
| --- | --- | --- | --- | --- |
| E1 | Venta rápida de contado, sin identificar al cliente: se escanea el producto y se imprime el comprobante. | Venta sin cliente, detalle, movimiento de inventario, comprobante. | BR-038, BR-060, BR-093 · P-01 | ✅ Documento cobrable (kind=venta, terms=contado, cliente=NULL, C-01 lo permite porque es contado) → Detalle de venta (producto por código de barras BR-093, cantidad, precio unitario H) → Movimiento de inventario (salida, origen=detalle de venta, arco exclusivo R-25b) → comprobante (receipt_number). |
| E2 | Venta al crédito a un cliente nuevo (da cédula y dirección). Semanas después hace dos abonos "a la cuenta"; el segundo termina de pagar ese crédito y paga una parte de otro más nuevo. | Documento cobrable, crédito, pagos, *Aplicación de pago*. | BR-040, BR-062, BR-066, BR-092, BR-096 | ✅ Cliente (cédula y dirección, BR-040, C-06) → Documento cobrable (kind=venta, terms=crédito, cliente obligatorio C-01) → Crédito (débil 1:1, R-27, vencimiento un mes) → Pago de cliente → Aplicación de pago (M:N, monto aplicado al crédito más antiguo BR-096; el sobrante del segundo abono pasa al crédito más nuevo). |
| E3 | Entra una XTZ 125 para buscar la falla → diagnóstico → falla adicional aceptada → falta un repuesto → terminada → en la prueba falla lo trabajado → se corrige sin cobro → se entrega al crédito. | *Cambio de estado*, falla adicional, *Producto usado en el servicio*, crédito sobre un servicio. | BR-021 a BR-027, BR-033, BR-094, BR-095, BR-009 | ✅ Moto (XTZ 125, R-02 modelo, R-01 cliente) → Doc cobrable (kind=servicio, R-03 moto) → Cambios de estado: RECIBIDA → EN_DIAGNOSTICO → EN_PROCESO → ESPERA_CLIENTE (falla adicional R-09, decisión=aceptada BR-027) → EN_PROCESO → ESPERA_REPUESTO (BR-033) → EN_PROCESO → TERMINADA → EN_PRUEBA → EN_PROCESO (falla de lo trabajado, sin cobro BR-095) → TERMINADA → ENTREGADA. Producto usado (R-39, R-07), mano de obra (R-06). Crédito (R-27, autorizado R-28 dueño). |
| E4 | El cliente cancela después del desarme: el trabajo era de C$1,800 y se cobran C$1,000; el mecánico es del 60 %. | Monto por cancelación, comisión sobre lo cobrado. | BR-080, BR-083 · SRC-05 | ✅ Servicio mecánico (cancellation_amount=1000) → Cambio de estado a CANCELADA → comisión D = 60% × 1000 = 600 (BR-083). Pago semanal liquida la comisión en la semana del cierre (R-31, C-10). |
| E5 | El cliente trae su propio repuesto y una pieza necesita torno (el cliente la lleva o, si el taller paga, el cliente repone). | Mano de obra con repuesto del cliente; *cargo externo* (¿se usaría?). | BR-032, BR-037, BR-082 | ✅ Mano de obra (R-06, tipo=producto del cliente, descripción del repuesto, sin monto de producto BR-032). Cargo externo (R-45, entidad débil: monto del torno, descripción; BR-097: si el taller paga, se registra como cargo externo en la factura, no como retiro de caja; confirmación de reposición antes de cerrar). |
| E6 | Sábado: pago semanal de un mecánico al 60 % con dos adelantos; otro al 100 %; un servicio hecho por un dueño no suma comisión; uno al crédito sí suma. | Pago semanal, adelantos, porcentaje aplicado, fecha de cierre del servicio. | BR-044 a BR-051, BR-081 | ✅ Pago semanal (R-30, mecánico del 60%) → liquida servicios cerrados esa semana (R-31, C-10, fecha de cierre del último Cambio de estado) → comisión D = 60% × mano de obra cobrada → descuenta 2 adelantos (R-32) → monto neto D. Mecánico al 100%: igual. Servicio de un dueño: sin porcentaje aplicado (BR-051, C-09), comisión=0, no entra en pago semanal. Servicio al crédito: sí suma comisión (BR-035, se paga esa semana al mecánico). |
| E7 | Compra al crédito a un proveedor; un producto llega dañado y se devuelve; el dueño cambia un precio de venta; se hacen dos pagos al proveedor. | Compra, devolución a proveedor, historial de precio, pagos a proveedor. | BR-013 a BR-018 · Q-070 | ✅ Compra (R-20, proveedor, condición=crédito) → Detalle de compra (R-21, producto R-41, costo unitario H) → Movimiento de inventario (entrada, R-25a). Devolución a proveedor (R-23, ligada a la línea) → Movimiento (salida, R-25e). Historial de precio (R-37, débil de Producto, cambio por dueño R-51). Pago a proveedor (R-42, al proveedor; R-22 con la compra, provisional hasta Q-070). |
| E8 | Reclamo de garantía a los dos días: misma falla; se cambia una pieza que asume la tienda. | Reclamo, movimiento por garantía, revisión sin cobro. | BR-071, BR-072, BR-085, BR-086 | ✅ Reclamo de garantía (R-11, servicio original; fecha, plazo BR-072; atendido por dueño R-13 BR-074) → sin cobro (BR-085) → pieza nueva: Movimiento de inventario (salida por garantía, R-25f; la tienda asume BR-086) → si el cliente paga la pieza: R-38 genera una Venta. Revisión: nuevo servicio (R-12, originado por el reclamo). |
| E9 | Puesta en marcha: se cargan las existencias iniciales y un cliente que ya debía antes del sistema. | Inventario inicial, saldo inicial (decisión 6). | P-08 · Q-078 | ✅ Existencias: Movimiento de inventario (motivo=inventario_inicial, sin origen externo, C-04 permite NULL). Cliente con deuda: Doc cobrable (kind=saldo_inicial, subclase Saldo inicial DEC-015, monto de lo que debía) → Crédito (R-27, vencimiento según acuerdo) → pagos y abonos funcionan igual (BR-096). Proveedor con deuda: saldo de apertura en Proveedor (atributo, provisional DEC-015). |

> En *Resultado*: ✅ se registra completo · ❌ no se puede (qué falta) · ❓ generó una pregunta (Q-xxx).

## Acuerdos y cambios

- **28-oct:** S5 se adelanta por la entrega en clase del 29-oct. **S4 se cierra como equipo después de la entrega**, y los cambios que salgan se asumen y se llevan al esquema y al DDL ([[DEC-010 - Advance to S5 Before Closing S4 - MIRM|DEC-010]]).

## Resultado

- [[S4 - ER and EER Model - MIRM|MER/EER v1]] (borrador, 28-oct): decisiones aplicadas, entidades e identificadores, diagramas en Mermaid (MER por áreas y EER), relaciones con cardinalidad, participación y BR, y restricciones C-01 a C-13. Pendiente de revisión del equipo y del recorrido de escenarios.

## Criterio de cierre

- [x] MER/EER terminado y revisado por IA para cuestionar puntos débiles (respuesta en el chat). ✅ 2026-10-28
- [x] Cada cardinalidad cita una BR. ✅ 2026-11-01
- [x] Todos los escenarios se pueden registrar (o generaron una pregunta resuelta). ✅ 2026-11-01
- [x] Construcciones EER (G-1 a G-3) registradas, cada una con su DEC (DEC-011 a DEC-015). ✅ 2026-11-01
- [x] Decisiones 3 y 6 tomadas o pasadas explícitamente a S5 (1, 2, 4, 5, 7 a 10 tomadas el 28-oct). ✅ 2026-10-28

➡️ Siguiente etapa: [[S5 - Relational Model and Normalization - MIRM]] (adelantada por la entrega del 29-oct).
