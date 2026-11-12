### Quick Review as Context for Claude. - MIRM - 01-Nov
Revisión de Traceability, para encontrar la forma de llenar los cuadros vacíos. Igual con Review.

---
Hay que escribir la DEC correspondiente para documentar que como equipo se decidió usar un documento cobrable, esto para poder identificar correctamente una venta, o un servicio y a la hora de entregar la factura salgan ambos.

---

También registrar la DEC de el arco exclusivo, leyendo información sobre el uso me queda claro que si es neceario para el movimiento de inventario. Leyendo tiene que ser obligado en el movimiento inventario y registrarse correctamente en el MER o modelo relacional posterior, ideando correctamente a la hora de modelar la base de datos.

---

Otra DEC a registrar es:

| 2   | **G-2 Personal** (Dueño, Mecánico, Encargado)             | ✅ **Decidido por el equipo (28-oct): especialización disjunta.** Cada relación se cuelga de la subclase que la cumple: adelantos y pago semanal → Mecánico; retiros, créditos, rebajas y reclamos → Dueño; responsable del servicio → Personal (solo dueño o mecánico); registra ventas → Personal (solo dueño o encargado).                                                                                                                                                                                                          | DEC nueva (escribirla con el EER)                  |
| --- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |

---
Registrar la otra DEC

| 4   | **Cambio de estado** del servicio mecánico                | ✅ **Decidido por el equipo (28-oct): entidad débil *Cambio de estado*** de *Servicio mecánico* (propuesta de Gustavo): estado, fecha y hora, registrado por. Da la fecha de cierre para el pago semanal (BR-047) y conserva las vueltas de EN_PRUEBA.                                                                                                                                                                                                                                                                                 | DEC nueva                                          |
| --- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
Ingresar los estados encontrados en: [[Diagrama_estados_servicio_mecanico.png]]

---
Hay que ingresar la siguiente DEC

| 6   | **Saldos iniciales** (deudas que ya existían)             | 🟡 **Provisional en el [[S4 - ER and EER Model - MIRM\|MER v1]]** (falta que el equipo la confirme). Créditos y compras de *saldo inicial* · o un atributo de saldo de apertura. **Recomendación de la IA (28-oct):** clientes → una subclase *Saldo inicial* de *Documento cobrable*, sin líneas (crédito y pagos funcionan igual); proveedores → depende de Q-070 (mientras tanto, un atributo de saldo de apertura).                                                                                                               | DEC nueva                                          |
| --- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |

Tomando en cuenta una posible deuda existente, que se pueda realizar correctamente, en caso que no tengan a la hora de hacer los registros reales, que quede por cualquier cosa, previendo este caso.

---
2. **Aplicación de pago** (escenario E2) y **Cargo externo** (escenario E5). Si el taller paga el torno, ese dinero **sale de caja**: ¿basta con el cargo externo o también se registra como retiro? ✅
Como equipo estuvimos revisando esto que se reporta en el MER, en el modelo relacional se modela, revisando bien el diagrama completo. Pero algo que tuve en duda fueron dos cosas:

Supongamos que se hace una reparación, surgió algo y se tiene que llevar al torno, resulta que el cliente no está. Se le consulta y se lleva al torno, ese dinero tiene que salir de caja. Se reporta como cargo externo a la reparación (no como retiro de caja); ¿Cómo sabe el programa que ese dinero volvió a caja nuevamente? Pensamos en otro estado, para verificar que si fue entregado nuevamente el cargo, a nivel de sistema, se registra el cargo externo en la factura y permite cerrar la factura para pagar luego de confirmar que si fue devuelto.

---

6. **Interés del crédito:** BR-068 dice 8 % por mes, pero no si se calcula sobre el total o sobre lo que queda debiendo. Cambia el atributo derivado *monto* del crédito, no la estructura.✅  
En este caso se cobra sobre lo que se sigue debiendo, el cliente lo aclaró desde el día de la entrevista, pero olvidé anotarlo.

---

Finalmente para cerrar S4, recorre los escenarios E1 a E9, tomando en cuenta toda la información en el vault.

Luego de esto, esta nota yo mismo (Kenry) la eliminaré.