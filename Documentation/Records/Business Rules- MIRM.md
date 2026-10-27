---
project: "[[Motor IRM]]"
type: records
record: Business Rules
next_id: BR-083
updated: 2026-10-26
source: IA (catálogo redactado por Claude a pedido de Kenry, a partir de SRC-01 a SRC-04 y DEC-003 a DEC-005)
---

# 📏 Business Rules — Motor IRM

**Valores permitidos**
- **Tipo:**
	- **Estructural:** qué existe y cómo se relaciona.
	- **Restricción:** qué no puede pasar.
	- **Derivación:** qué se calcula.
	- **Acción:** qué pasa cuando ocurre algo.
- **Estado:** Borrador (sin confirmar) · Validada (confirmada por el negocio) · Descartada.


## Cómo pasar de estas reglas al modelo conceptual (S3)

Cada tipo de regla le da algo distinto al modelo:

| Tipo | Qué aporta al modelo conceptual | Ejemplo |
| --- | --- | --- |
| **Estructural** (23) | Las **cosas que existen** (sustantivos → entidades candidatas) y **cómo se relacionan** (verbos → relaciones). | BR-041: "Una moto se identifica por su modelo y su color, y está asociada a un cliente." → *moto*, *cliente* y la relación entre ellos. |
| **Restricción** (26) | **Cuántos** y **cuándo**: cardinalidades, participación obligatoria u opcional, datos obligatorios. | BR-024: "Cada reparación la hace una sola persona" → una reparación tiene exactamente un responsable. |
| **Derivación** (8) | Datos que **se calculan** y no se guardan sueltos (atributos derivados). | BR-045: comisión = porcentaje × mano de obra cobrada. |
| **Acción** (22) | **Procesos** y **estados**: qué pasa cuando ocurre algo. | BR-026/027/028: falla adicional → consultada → aceptada o rechazada. |

> [!tip] Método sugerido (cada uno por separado, como dice el Restart Plan)
> 1. Lean solo las reglas **Estructurales** y subrayen sustantivos y verbos.
> 2. Con las **Restricciones**, anoten cuántos de cada lado tiene cada relación.
> 3. Con las **Derivaciones**, separen lo que se guarda de lo que se calcula.
> 4. Con las **Acciones**, dibujen los estados de una reparación y de un crédito.
> 5. Comparen entre los tres y registren en [[Traceability - MIRM|Traceability]] qué entidad o relación cubre cada regla.

## Catálogo
### A. Negocio y productos

*Segmentos del enunciado: 1, 6, 15*

| ID     | Regla                                                                                   | Tipo        | Fuente                                                                                                                       | Estado   | Versión |
| ------ | --------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------- | -------- | ------- |
| BR-001 | El negocio tiene dos actividades: la venta de productos y los trabajos de taller.       | Estructural | [[SRC-01 - First Conversation - MIRM\|SRC-01]] · [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-033)                 | Borrador | 1       |
| BR-002 | Una venta puede tener solo productos, sin moto ni reparación.                           | Estructural | [[SRC-01 - First Conversation - MIRM\|SRC-01]]                                                                               | Borrador | 1       |
| BR-003 | Una reparación puede incluir mano de obra, productos o ambos.                           | Estructural | [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-022) · [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-033)    | Borrador | 1       |
| BR-004 | Cada producto pertenece a una categoría (repuestos, accesorios, lubricantes, llantas…). | Estructural | [[SRC-04 - Follow-up Answers Owners - MIRM\|SRC-04]] (Q-062)                                                                 | Borrador | 1       |
| BR-005 | El aceite se vende únicamente por litro.                                                | Restricción | [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-024)                                                                  | Borrador | 1       |
| BR-006 | No se registra qué productos son compatibles con qué modelos de moto.                   | Restricción | [[DEC-004 - No Product Compatibility Record - MIRM\|DEC-004]] · [[SRC-04 - Follow-up Answers Owners - MIRM\|SRC-04]] (Q-063) | Borrador | 1       |

### B. Personas y permisos

*Segmentos del enunciado: 2, 15, 25*

| ID | Regla | Tipo | Fuente | Estado | Versión |
| --- | --- | --- | --- | --- | --- |
| BR-007 | Los dos dueños hacen todas las tareas administrativas: vender, cobrar, recibir productos, revisar inventario, decidir compras, administrar créditos, autorizar descuentos y calcular el pago de los mecánicos. | Estructural | [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-008) | Borrador | 1 |
| BR-008 | Cuando no están los dueños, un encargado atiende únicamente la parte de ventas. | Restricción | [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-006) · [[SRC-04 - Follow-up Answers Owners - MIRM\|SRC-04]] (Q-047) | Borrador | 1 |
| BR-009 | Solo un dueño puede autorizar un crédito; el encargado debe llamarlo. | Restricción | [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-010) | Borrador | 1 |
| BR-010 | Solo un dueño puede autorizar una rebaja. | Restricción | [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-008) | Borrador | 1 |
| BR-011 | Solo los dueños pueden hacer retiros de caja. | Restricción | [[SRC-04 - Follow-up Answers Owners - MIRM\|SRC-04]] (Q-052) | Borrador | 1 |

### C. Compras, proveedores e inventario

*Segmentos del enunciado: 3, 4, 5, 22*

| ID | Regla | Tipo | Fuente | Estado | Versión |
| --- | --- | --- | --- | --- | --- |
| BR-012 | El negocio compra a varios proveedores, y un producto no pertenece a un único proveedor. | Estructural | [[SRC-01 - First Conversation - MIRM\|SRC-01]] | Borrador | 1 |
| BR-013 | Toda compra a un proveedor viene respaldada por una factura de compra. | Estructural | [[SRC-01 - First Conversation - MIRM\|SRC-01]] | Borrador | 1 |
| BR-014 | El costo de un producto se toma de la factura de compra. | Derivación | [[SRC-01 - First Conversation - MIRM\|SRC-01]] | Borrador | 1 |
| BR-015 | El precio de venta lo fija un dueño a partir del costo y la ganancia que busca, procurando vender más barato que la competencia. | Derivación | [[SRC-01 - First Conversation - MIRM\|SRC-01]] | Borrador | 1 |
| BR-016 | Cuando llega una factura con un costo distinto, el dueño actualiza el precio de venta del producto. | Acción | [[SRC-01 - First Conversation - MIRM\|SRC-01]] | Borrador | 1 |
| BR-017 | A algunos proveedores se les compra al crédito. | Estructural | [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-032) | Borrador | 1 |
| BR-018 | Si un producto llega dañado, se devuelve al proveedor, que cubre la devolución. | Acción | [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-018) | Borrador | 1 |
| BR-019 | La grasa de los engrases no es mercancía del negocio: la compra el mecánico. | Restricción | [[SRC-03 - Mechanic Interview - MIRM\|SRC-03]] (Q-025) · [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-024) | Borrador | 1 |
| BR-020 | La existencia de un producto se calcula con sus entradas (compras, devoluciones de clientes) y sus salidas (ventas, repuestos usados en reparaciones, devoluciones al proveedor, consumo interno). | Derivación | [[SRC-01 - First Conversation - MIRM\|SRC-01]] · [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-018) · [[SRC-04 - Follow-up Answers Owners - MIRM\|SRC-04]] (Q-053) · [[DEC-003 - Internal Work on Own Motorcycle - MIRM\|DEC-003]] | Borrador | 1 |

### D. Taller: recepción, asignación y trabajo

*Segmentos del enunciado: 7, 8, 9, 10, 11, 14*

| ID     | Regla                                                                                                                                | Tipo        | Fuente                                                                                                                     | Estado   | Versión |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------ | ----------- | -------------------------------------------------------------------------------------------------------------------------- | -------- | ------- |
| BR-021 | Cuando un cliente trae una moto, lo atiende un dueño, que escucha qué tiene la moto y qué quiere el cliente.                         | Acción      | [[SRC-03 - Mechanic Interview - MIRM\|SRC-03]] (Q-037)                                                                     | Borrador | 1       |
| BR-022 | El alcance de una reparación lo define el cliente: si pide buscar la falla se diagnostica; si pide algo concreto, solo eso se hace.  | Restricción | [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-022)                                                                | Borrador | 1       |
| BR-023 | Los dueños asignan cada reparación.                                                                                                  | Acción      | [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-013)                                                                | Borrador | 1       |
| BR-024 | Cada reparación la hace una sola persona: un mecánico o un dueño.                                                                    | Restricción | [[SRC-03 - Mechanic Interview - MIRM\|SRC-03]] (Q-041) · [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-013)       | Borrador | 1       |
| BR-025 | Si todos los mecánicos están ocupados, se espera al primero que se desocupe o la reparación la hace un dueño.                        | Acción      | [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-013)                                                                | Borrador | 1       |
| BR-026 | Si aparece una falla adicional, se consulta al cliente antes de repararla.                                                           | Acción      | [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-022) · [[SRC-03 - Mechanic Interview - MIRM\|SRC-03]] (Q-022)       | Borrador | 1       |
| BR-027 | Si el cliente acepta la falla adicional, el trabajo y los repuestos se agregan a la reparación y a su precio.                        | Acción      | [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-022)                                                                | Borrador | 1       |
| BR-028 | Si el cliente rechaza la falla adicional, la moto se entrega sin garantía sobre esa falla.km                                         | Restricción | [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-022)                                                                | Borrador | 1       |
| BR-029 | La mano de obra se cobra por el trabajo hecho, no por el tiempo que la moto pase en el taller.                                       | Restricción | [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-019)                                                                | Borrador | 1       |
| BR-030 | Algunos servicios tienen precio estándar (por ejemplo, trabajos de motor).                                                           | Estructural | [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-016)                                                                | Borrador | 1       |
| BR-031 | El precio de un engrase depende de la moto (por ejemplo 400, 600 o 900).                                                             | Derivación  | [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-016) · [[SRC-04 - Follow-up Answers Owners - MIRM\|SRC-04]] (Q-055) | Borrador | 1       |
| BR-032 | El cliente puede traer sus propios repuestos y pagar solo la mano de obra.                                                           | Estructural | [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-033)                                                                | Borrador | 1       |
| BR-033 | Si falta un repuesto, primero se busca en otro lado y, si no se encuentra, se manda a traer de fuera; la moto se queda en el taller. | Acción      | [[SRC-03 - Mechanic Interview - MIRM\|SRC-03]] (Q-039) · [[SRC-01 - First Conversation - MIRM\|SRC-01]]                    | Borrador | 1       |
| BR-034 | Si el cliente no tiene dinero para una reparación de motor, se le pide que se lleve la moto.                                         | Acción      | [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-018 (ubicada por interpretación))                                   | Borrador | 1       |
| BR-035 | Las reparaciones las cobran los dueños.                                                                                              | Restricción | [[SRC-03 - Mechanic Interview - MIRM\|SRC-03]] (Q-040)                                                                     | Borrador | 1       |
| BR-036 | Las piezas nuevas las instalan los mecánicos; si una se daña al instalarla, la tienda asume el costo.                                | Acción      | [[SRC-04 - Follow-up Answers Owners - MIRM\|SRC-04]] (Q-056) · [[SRC-03 - Mechanic Interview - MIRM\|SRC-03]] (Q-036)      | Borrador | 1       |
| BR-037 | Algunos trabajos de una reparación se hacen fuera del taller, en el torno. El costo del torno se le repone al taller (BR-082). | Estructural | [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-034) | Borrador | 2 |
| BR-080 | Si el cliente cancela una reparación que ya tenía trabajo hecho, se le cobra el trabajo realizado (por ejemplo, el desarme); el monto lo define el dueño. | Acción | [[SRC-05 - Owners Answers Oct 26 - MIRM\|SRC-05]] | Borrador | 1 |
| BR-082 | Cuando alguien del taller paga un trabajo de torno, se le entrega al cliente el comprobante de lo pagado para que reponga ese dinero. | Acción | [[SRC-05 - Owners Answers Oct 26 - MIRM\|SRC-05]] (Q-034) | Borrador | 1 |

### E. Clientes y motos

*Segmentos del enunciado: 19, 20*

| ID | Regla | Tipo | Fuente | Estado | Versión |
| --- | --- | --- | --- | --- | --- |
| BR-038 | Una venta rápida de contado no necesita identificar al cliente. | Restricción | [[SRC-01 - First Conversation - MIRM\|SRC-01]] | Borrador | 1 |
| BR-039 | De un cliente de taller se registra su nombre y su número de teléfono. | Estructural | [[SRC-04 - Follow-up Answers Owners - MIRM\|SRC-04]] (Q-048) | Borrador | 1 |
| BR-040 | Para dar un crédito, el cliente debe dar además su cédula y su dirección. | Restricción | [[SRC-04 - Follow-up Answers Owners - MIRM\|SRC-04]] (Q-048) · [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-023) | Borrador | 1 |
| BR-041 | Una moto se identifica por su modelo y su color, y está asociada a un cliente. | Estructural | [[SRC-04 - Follow-up Answers Owners - MIRM\|SRC-04]] (Q-048) | Borrador | 1 |
| BR-042 | Se lleva el historial de los trabajos hechos a cada moto, porque con él se calcula el pago de los mecánicos. | Estructural | [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-014) | Borrador | 1 |
| BR-043 | Si la moto cambia de dueño, lo que se le hizo sigue registrado. (Respuesta cortada en la fuente: confirmar.) | Estructural | [[SRC-04 - Follow-up Answers Owners - MIRM\|SRC-04]] (Q-048) | Borrador | 1 |

### F. Mecánicos y pago

*Segmentos del enunciado: 12, 13, 14, 21*

| ID | Regla | Tipo | Fuente | Estado | Versión |
| --- | --- | --- | --- | --- | --- |
| BR-044 | Cada mecánico tiene su propio porcentaje de comisión, acordado sin contrato (hoy uno al 60 % y otro al 100 %). | Estructural | [[SRC-04 - Follow-up Answers Owners - MIRM\|SRC-04]] (Q-045) · [[SRC-01 - First Conversation - MIRM\|SRC-01]] | Borrador | 1 |
| BR-045 | La comisión de un mecánico es su porcentaje sobre la mano de obra cobrada en las reparaciones que hizo. | Derivación | [[SRC-01 - First Conversation - MIRM\|SRC-01]] · [[SRC-04 - Follow-up Answers Owners - MIRM\|SRC-04]] (Q-055) | Borrador | 1 |
| BR-046 | Los mecánicos se pagan cada semana, normalmente el sábado; si hay feriado se paga otro día. | Acción | [[SRC-01 - First Conversation - MIRM\|SRC-01]] · [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-017) | Borrador | 1 |
| BR-047 | La comisión de una reparación al crédito se paga en la semana del trabajo, aunque el cliente no haya pagado. | Restricción | [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-035) | Borrador | 1 |
| BR-048 | Se pueden dar adelantos pequeños a un mecánico, también a media semana, sin un límite fijo. | Acción | [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-031) · [[SRC-03 - Mechanic Interview - MIRM\|SRC-03]] (Q-031) | Borrador | 1 |
| BR-049 | El pago semanal de un mecánico es su comisión menos los adelantos de la semana. | Derivación | [[SRC-01 - First Conversation - MIRM\|SRC-01]] · [[SRC-05 - Owners Answers Oct 26 - MIRM\|SRC-05]] (Q-065) | Borrador | 2 |
| BR-050 | Una rebaja en una reparación se acuerda con el mecánico, porque reduce su comisión. | Restricción | [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-030) | Borrador | 1 |
| BR-051 | Si un dueño hace la reparación, la mano de obra se cobra normal y no se paga comisión: queda como ganancia de los dueños. | Acción | [[SRC-04 - Follow-up Answers Owners - MIRM\|SRC-04]] (Q-046) | Borrador | 1 |
| BR-052 | El pago de los mecánicos no depende de horas ni de asistencia, y no se controla la asistencia. | Restricción | [[SRC-04 - Follow-up Answers Owners - MIRM\|SRC-04]] (Q-059) | Borrador | 1 |
| BR-053 | Un mecánico puede reparar su propia moto en el taller solo cuando el taller está vacío. | Restricción | [[SRC-04 - Follow-up Answers Owners - MIRM\|SRC-04]] (Q-060) | Borrador | 1 |
| BR-054 | El trabajo de un mecánico sobre su propia moto no genera mano de obra cobrable ni comisión. | Restricción | [[DEC-003 - Internal Work on Own Motorcycle - MIRM\|DEC-003]] | Borrador | 1 |
| BR-055 | Si un mecánico usa productos de la tienda en su propia moto, los paga como una venta normal. | Acción | [[SRC-04 - Follow-up Answers Owners - MIRM\|SRC-04]] (Q-060) · [[DEC-003 - Internal Work on Own Motorcycle - MIRM\|DEC-003]] | Borrador | 1 |
| BR-081 | A los mecánicos se les paga únicamente en efectivo. | Restricción | [[SRC-05 - Owners Answers Oct 26 - MIRM\|SRC-05]] (Q-065) | Borrador | 1 |

### G. Ventas, pagos y créditos

*Segmentos del enunciado: 15, 16, 17*

| ID | Regla | Tipo | Fuente | Estado | Versión |
| --- | --- | --- | --- | --- | --- |
| BR-056 | Un cliente puede pagar en efectivo, por transferencia a la cuenta del dueño o al crédito. | Estructural | [[SRC-01 - First Conversation - MIRM\|SRC-01]] | Borrador | 1 |
| BR-057 | La moneda principal es el córdoba; también se aceptan dólares. | Estructural | [[SRC-04 - Follow-up Answers Owners - MIRM\|SRC-04]] (Q-051) · [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-027) | Borrador | 1 |
| BR-058 | Un pago en dólares se convierte con el tipo de cambio que fijan los dueños. | Derivación | [[SRC-04 - Follow-up Answers Owners - MIRM\|SRC-04]] (Q-051) | Borrador | 1 |
| BR-059 | El vuelto se da normalmente en córdobas. | Acción | [[SRC-04 - Follow-up Answers Owners - MIRM\|SRC-04]] (Q-051) | Borrador | 1 |
| BR-060 | Al cliente se le entrega un comprobante impreso. | Acción | [[SRC-01 - First Conversation - MIRM\|SRC-01]] | Borrador | 1 |
| BR-061 | Las rebajas no siguen un porcentaje fijo: el dueño las define en el momento, sobre todo cuando el cliente compra bastante. | Restricción | [[SRC-01 - First Conversation - MIRM\|SRC-01]] · [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-010) | Borrador | 1 |
| BR-062 | Todo crédito pertenece a un cliente identificado. | Estructural | [[SRC-01 - First Conversation - MIRM\|SRC-01]] · [[SRC-04 - Follow-up Answers Owners - MIRM\|SRC-04]] (Q-048) | Borrador | 1 |
| BR-063 | Un crédito no tiene límite de monto: se da por confianza. | Restricción | [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-009) | Borrador | 1 |
| BR-064 | El plazo normal de un crédito es de un mes. | Estructural | [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-020) | Borrador | 1 |
| BR-065 | Un crédito se paga completo al terminar el plazo. | Restricción | [[SRC-04 - Follow-up Answers Owners - MIRM\|SRC-04]] (Q-049) | Borrador | 1 |
| BR-066 | Por confianza, un dueño puede alargar el plazo de un crédito; en ese caso puede pagarse en dos partes. | Acción | [[SRC-04 - Follow-up Answers Owners - MIRM\|SRC-04]] (Q-049) · [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-020) | Borrador | 1 |
| BR-067 | Un crédito de un mes no tiene intereses. | Restricción | [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-021) | Borrador | 1 |
| BR-068 | Un crédito pedido a tres meses cobra un 8 % por cada mes. | Derivación | [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-021) · [[SRC-04 - Follow-up Answers Owners - MIRM\|SRC-04]] (Q-050) | Borrador | 1 |

### H. Devoluciones y garantías

*Segmentos del enunciado: 18*

| ID | Regla | Tipo | Fuente | Estado | Versión |
| --- | --- | --- | --- | --- | --- |
| BR-069 | Un producto devuelto todavía empacado puede cambiarse por otro o devolverse el dinero. | Acción | [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-011) · [[SRC-04 - Follow-up Answers Owners - MIRM\|SRC-04]] (Q-053) | Borrador | 1 |
| BR-070 | No se aceptan devoluciones de productos eléctricos ni maltratados. | Restricción | [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-011) | Borrador | 1 |
| BR-071 | Si una moto regresa por la misma falla, o falla una pieza instalada, se repara sin cobrar (garantía). | Acción | [[SRC-03 - Mechanic Interview - MIRM\|SRC-03]] (Q-043) · [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-012) | Borrador | 1 |
| BR-072 | La garantía de una reparación dura pocos días: el cliente debe avisar lo antes posible (tres días ya se considera mucho). | Restricción | [[SRC-04 - Follow-up Answers Owners - MIRM\|SRC-04]] (Q-054) | Borrador | 1 |
| BR-073 | Si el reclamo es por una falla distinta de lo trabajado, se le explica al cliente y se le ofrece repararla como un trabajo nuevo, con su propia garantía. | Acción | [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-012) · [[SRC-03 - Mechanic Interview - MIRM\|SRC-03]] (Q-040) | Borrador | 1 |
| BR-074 | Los reclamos los atiende un dueño, que revisa la moto para verificar el daño. | Acción | [[SRC-03 - Mechanic Interview - MIRM\|SRC-03]] (Q-043) · [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-012) | Borrador | 1 |

### I. Caja y economía

*Segmentos del enunciado: 21, 23*

| ID | Regla | Tipo | Fuente | Estado | Versión |
| --- | --- | --- | --- | --- | --- |
| BR-075 | Un retiro de caja es dinero que los dueños sacan para gastos que no son compras de mercancía (por ejemplo, limpieza o viajes). | Estructural | [[SRC-04 - Follow-up Answers Owners - MIRM\|SRC-04]] (Q-052) · [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-026) | Borrador | 1 |
| BR-076 | Los gastos de un viaje de compras a Managua (combustible y comida) se registran como retiro de caja. | Acción | [[DEC-005 - Managua Trip Expenses as Cash Withdrawal - MIRM\|DEC-005]] · [[SRC-04 - Follow-up Answers Owners - MIRM\|SRC-04]] (Q-061) | Borrador | 1 |
| BR-077 | El gasto de un viaje no se reparte entre los productos comprados: el dueño lo toma en cuenta al fijar el precio de venta. | Restricción | [[DEC-005 - Managua Trip Expenses as Cash Withdrawal - MIRM\|DEC-005]] · [[SRC-04 - Follow-up Answers Owners - MIRM\|SRC-04]] (Q-061) | Borrador | 1 |
| BR-078 | El negocio paga un impuesto fijo mensual (hoy 800 córdobas). | Estructural | [[SRC-02 - Second Interview Owners - MIRM\|SRC-02]] (Q-028) | Borrador | 1 |
| BR-079 | Toda salida de un producto tiene un motivo: venta, uso en la reparación de un cliente, devolución al proveedor o consumo interno. | Estructural | [[DEC-003 - Internal Work on Own Motorcycle - MIRM\|DEC-003]] | Borrador | 1 |

## Pendientes que afectan a las reglas

| Pregunta | Reglas afectadas | Qué falta |
| --- | --- | --- |
| Q-048 (cortada) | BR-043 | El final de la respuesta sobre la moto que cambia de dueño. |
| Q-001 (respondida, SRC-05) | BR-016 | Deseable, no necesario: el historial de precios queda para la versión 2. |
| Q-003 | BR-020 | Si algunos productos vencen. |
| Q-067 | BR-080 | Si la reparación cancelada genera comisión. |
| Q-069 | BR-062 | Si un crédito agrupa varias operaciones del cliente. |
| Q-072 | BR-020 | Inventario inicial y ajustes por conteo. |
| DEC-003 (punto a revisar) | BR-020, BR-054, BR-055, BR-079 | Si "consumo interno" se queda solo para salidas sin cobro. |
| DEC-005 (punto a confirmar) | BR-075, BR-076, BR-077 | Si el gasto del viaje no se reparte entre los productos (interpretación de la IA). |
| Equipo (S3/S4) | BR-020, BR-075, BR-079 | Movimiento de inventario general o retiro de caja como concepto propio. |

## Notas

- **Reglas que se quitaron** del borrador del enunciado por falta de fuente: la marca de los productos (→ Q-066), los productos que vencen (→ Q-003) y los ajustes de inventario por conteo.
- **Cambios respecto al enunciado de S2** (que no se reescribe porque esa etapa está cerrada): SRC-04 resolvió la contradicción de los porcentajes (BR-044), dio fuente al horario (BR-052) y al trabajo del mecánico sobre su moto (BR-053, BR-054), y corrigió quién instala las piezas (BR-036: los mecánicos).
- **Interpretación de la IA:** BR-034 sale de una frase escrita debajo de Q-018 en SRC-02 (ver segmento 10 del enunciado ampliado).
- Redactado por Claude el 2026-10-23 a pedido de Kenry.
