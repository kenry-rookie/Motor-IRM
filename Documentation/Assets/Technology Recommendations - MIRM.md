---
project: "[[Motor IRM]]"
type: asset
date: 2026-10-27
source: IA (recomendación de Claude a pedido de Kenry; precios consultados en la web el 27-oct-2026)
ai_edit: "Claude — 2026-10-28: aviso de las respuestas del docente"
reviewed: false
---
**[[Motor IRM|← Hub]]** · **[[S4 - Entity-Relationship Model and EER - MIRM|S4]]** · **[[Project Gaps and Technology Recommendations - MIRM|Pendientes de S3]]**

# Technology Recommendations - MIRM

> [!success] Decisión tomada (28-oct)
> El equipo eligió Django + Python + PostgreSQL, en local, abierta desde el navegador instalada como aplicación → [[DEC-006 - Technology Stack - MIRM|DEC-006]]. El alojamiento para el negocio sigue pendiente (§5).

> [!warning] Actualización 28-oct (tarde)
> El docente confirmó que **no hace falta SQL Server** (PostgreSQL sirve: solo pide poder hacer las consultas) ni **presentar el servidor web** (basta con que corra en local). La §4 y lo que se dice de SQL Server en §1, §3, §6 y §7 **quedan sin efecto**; ver [[DEC-006 - Technology Stack - MIRM|DEC-006]].

> [!warning] Recomendación de la IA — la decisión es del equipo (DEC-006)
> Reemplaza y amplía la Parte B de [[Project Gaps and Technology Recommendations - MIRM|Pendientes y tecnologías]]. Los precios son de **octubre de 2026** y cambian seguido: verificarlos en la página oficial antes de presentárselos a los dueños.

---

## 1. La situación (actualizada el 27-oct)

| Hecho | Consecuencia |
| --- | --- |
| **Versión de clase (v1):** base de datos en **SQL Server** (29-oct, requisito del docente) y programa que funcione el **05-nov**. | El DDL de clase se escribe en T-SQL. El programa de clase se conecta a SQL Server. |
| **Versión para el negocio (v2):** **PostgreSQL**, entrega aproximada el **10-dic**. | Hay un mes más para hacerla sólida. |
| Kenry estará en el negocio unas semanas (vendiendo y registrando con los dueños) y dará soporte varios meses. | Una sola persona mantendrá el sistema: tiene que ser simple de entender y de arreglar. |
| PC del negocio con buenas especificaciones, internet siempre. | La opción **local** es viable. |
| Comprarán un **escáner de código de barras**; impresora sin decidir. | Formatos de comprobante **configurables**. |
| Solo los dueños administran; el encargado vende. | Usuarios con roles. |
| Equipo con poca experiencia programando; ruta de aprendizaje Python + PostgreSQL. | Una sola tecnología principal, bien documentada. |

---

## 2. ¿Python para el backend o para scripts? Para las dos cosas

**Backend:** sí. Con **Django**, Python es el servidor completo: recibe lo que se hace en la pantalla, consulta la base de datos, aplica las reglas (por ejemplo, que solo un dueño autorice un crédito) y arma las páginas que ve el usuario. No hace falta otro lenguaje para el servidor.

**Scripts:** también, para tareas que no son pantallas:
- **Carga inicial:** leer una hoja de Excel o CSV con productos, precios y existencias y cargarla en la base (puesta en marcha, P-08).
- **Respaldos automáticos** con `pg_dump`.
- **Pasar datos** de la versión de clase (SQL Server) a la del negocio (PostgreSQL), si hiciera falta.

**La interfaz** (lo que se ve) son páginas HTML que Django arma, con un poco de **HTMX** para que la pantalla de venta se actualice sin recargar. El comprobante es una página con estilos de impresión (`@media print`).

---

## 3. Arquitectura recomendada

**Django + PostgreSQL + plantillas con HTMX**, en un solo proyecto (un *monolito*), organizado por partes del negocio:

| App de Django | Entidades del modelo conceptual |
| --- | --- |
| `catalog` | Marca, Categoría, Producto, Historial de precio, Tipo de servicio |
| `inventory` | Movimiento de inventario |
| `purchasing` | Proveedor, Compra, Detalle de compra, Pago a proveedor, Devolución a proveedor |
| `sales` | Cliente, Venta, Detalle de venta, Devolución de cliente |
| `workshop` | Moto, Modelo, Servicio mecánico, Detalle, Falla adicional, Reclamo de garantía |
| `billing` | Pago de cliente, Crédito |
| `staff` | Personal, Adelanto, Pago semanal |
| `cash` | Retiro de caja |

**Reglas de construcción:**

1. **El DDL lo escriben ustedes en SQL** (archivos en el repositorio: `db/sqlserver/01_schema.sql` para clase y `db/postgres/01_schema.sql` para el negocio). Django usa esas tablas con modelos `managed = False`, o las aplica con migraciones `RunSQL`. Así el trabajo de Bases de Datos es visible y propio.
2. **Los datos derivados** (existencia, saldos, comisiones, deuda por proveedor y por cliente) son **vistas** en la base de datos.
3. **Formatos configurables:** los datos del negocio y el formato del comprobante (A4, ticket de 80 mm o de 58 mm) se guardan como configuración y se eligen sin tocar código.
4. **Escáner de barras:** un escáner USB funciona como un teclado: "escribe" el código y presiona Enter. La pantalla de venta tiene un campo de búsqueda siempre activo: se escanea y el producto aparece. No hace falta programar nada especial para el escáner.
5. **Usuarios y permisos:** el sistema de usuarios de Django con dos grupos: *Dueño* (todo) y *Encargado* (solo ventas).

**Por qué "escalable" con esto:** para este negocio, escalar no significa millones de usuarios, sino **poder seguir agregando funciones sin rehacer lo anterior**. Django lo permite con apps separadas, migraciones versionadas, pruebas y un panel de administración. Si después quieren una app para teléfono o una interfaz en React, se agrega una **API** (Django REST Framework o Django Ninja) sobre el mismo proyecto, sin tirar nada.

---

## 4. La versión de clase en SQL Server

| Tema | Qué hacer |
| --- | --- |
| **SQL Server en Mac (chip M4)** | SQL Server no se instala directamente en macOS. Se usa con **Docker** (imagen de SQL Server para Linux) con la emulación de Rosetta activada en Docker Desktop. **Verificar que funcione antes del 29-oct**; si da problemas, usar la PC con Windows de un compañero o la del laboratorio. |
| **Herramienta para escribir y probar SQL** | **DBeaver**: se conecta a SQL Server **y** a PostgreSQL, así que sirve para las dos versiones. |
| **Django con SQL Server** | Existe el conector `mssql-django`. Así el programa de clase y el del negocio comparten el código y solo cambia la conexión. |
| **Escribir el DDL dos veces** | El modelo relacional (S5) es el mismo; cambian detalles del dialecto: |

| Concepto | SQL Server (T-SQL) | PostgreSQL |
| --- | --- | --- |
| Llave autonumérica | `INT IDENTITY(1,1)` | `INT GENERATED ALWAYS AS IDENTITY` |
| Texto | `NVARCHAR(n)` | `VARCHAR(n)` o `TEXT` |
| Verdadero/falso | `BIT` | `BOOLEAN` |
| Fecha y hora | `DATETIME2` | `TIMESTAMP` |
| Dinero | `DECIMAL(12,2)` | `NUMERIC(12,2)` |
| Limitar filas | `SELECT TOP 10` | `LIMIT 10` |

**Consejo:** escriban primero el de PostgreSQL (el definitivo) y tradúzcanlo a T-SQL para clase. Las restricciones (`CHECK`, `FOREIGN KEY`, `UNIQUE`) y las vistas son casi iguales en los dos.

---

## 5. ¿Dónde se instala para el negocio?

### 5.1 Opciones y precios (octubre de 2026)

| Opción | Qué incluye | Precio aproximado al mes | A favor | En contra |
| --- | --- | --- | --- | --- |
| **A — Local en la PC del negocio** | Django y PostgreSQL instalados en su PC | **US$0** (más un disco externo y, recomendable, un UPS) | Sin pagos mensuales; funciona aunque se caiga el internet; la PC ya es buena | Si la PC se daña o la roban y no hay respaldo, se pierde todo; el soporte a distancia necesita una herramienta de acceso remoto; solo se usa dentro del negocio |
| **B — Render** | Servidor web (512 MB) **US$7** + PostgreSQL (256 MB) **US$6**; plan de espacio de trabajo *Hobby* sin costo | **≈ US$13** (≈ C$480) | Precio fijo; se publica con `git push`; respaldos de la base en planes pagados; fácil para principiantes | Pago mensual en dólares con tarjeta; si se cae el internet, no se puede vender |
| **C — Railway (Hobby)** | US$5 al mes que incluyen US$5 de uso; se paga por memoria (US$10 por GB al mes), CPU (US$20 por vCPU al mes) y disco (US$0.15 por GB) | **≈ US$5–15** (variable) | Puede salir más barato | El cobro cambia cada mes según el uso: más difícil de explicar a los dueños |
| **D — DigitalOcean** | Servidor desde US$4 (512 MB); respaldos +20 %; PostgreSQL administrado desde US$15 | **≈ US$5–20** | Mucho control | Hay que administrar un servidor Linux: no recomendable ahora |
| **E — Neon (solo base de datos)** | Plan gratuito: 1 GB por proyecto, se apaga tras 5 minutos sin uso; plan *Launch* por uso (US$0.106 por hora de cómputo, US$0.35 por GB) con 7 días de restauración | **US$0–5** + el servidor web (por ejemplo, Render US$7) | Base de datos barata con restauración a un momento anterior | Dos servicios que configurar; el plan gratuito no es para un negocio real |

*Tipo de cambio de referencia: unos C$36–37 por dólar (verificar).* *PythonAnywhere tiene planes desde US$5 y US$12 al mes, pero no confirmé si incluye PostgreSQL.*

### 5.2 Recomendación

- **Para clase (05-nov):** local en sus Mac (SQL Server en Docker). No hace falta pagar nada.
- **Para el negocio (diciembre):** depende de **una pregunta práctica**: *¿los dueños pueden pagar en dólares con tarjeta cada mes?*
  - **Si pueden: opción B (Render).** Precio fijo, respaldos incluidos, y Kenry puede actualizar y corregir desde Managua sin viajar 200 km.
  - **Si no pueden o no quieren: opción A (local)**, con estas tres condiciones que no se negocian:
    1. **Respaldo automático diario** con `pg_dump` a un disco externo **y** a una nube (por ejemplo, la cuenta de Google Drive de los dueños).
    2. **Acceso remoto** para el soporte (por ejemplo, Tailscale o AnyDesk; verificar planes gratuitos para uso personal).
    3. **UPS** (batería) para que un apagón no corte la base de datos a mitad de una venta.

La aplicación es la misma en los dos casos: solo cambia dónde corre. Se puede empezar local y pasar a la nube después, restaurando un respaldo.

### 5.3 Cómo presentárselo a los dueños

No les hablen de servidores ni de bases de datos. Háblenles de **lo que ganan y lo que cuesta**, con una hoja como esta:

> **Opción 1 — En internet (≈ C$480 al mes)**
> - Su información se guarda fuera del negocio: si la computadora se daña, no se pierde nada.
> - Kenry puede arreglar cualquier problema desde Managua el mismo día.
> - Se paga con tarjeta, en dólares, cada mes.
> - Si se va el internet, no se puede registrar hasta que vuelva.
>
> **Opción 2 — En la computadora del negocio (sin pago mensual)**
> - Funciona aunque no haya internet.
> - Hay que comprar un disco externo y, recomendable, una batería (UPS).
> - Cada día se guarda una copia automática; si la computadora se daña, se recupera desde la copia.
> - Para arreglar algo a distancia, Kenry se conecta con un programa de acceso remoto.

Y una comparación que sí entienden: **hoy no saben cuánto venden al día ni cuánto les deben**. Un crédito olvidado en el celular puede costar más que un año de alojamiento.

---

## 6. Herramientas de apoyo

| Necesidad | Herramienta | Para qué |
| --- | --- | --- |
| PostgreSQL en la Mac | **Postgres.app** o **Docker** | Desarrollo de la v2. Docker ya hará falta para SQL Server. |
| Escribir y probar SQL | **DBeaver** | Sirve para SQL Server y PostgreSQL. |
| Código y documentación | **Git + GitHub** | Una rama por función y *pull requests* revisados. |
| Entorno de Python | `venv` + `requirements.txt` | Mismas versiones para los tres. |
| Pruebas | Pruebas de Django / `pytest` + datos reales (la foto de la factura) | S7. |
| Comprobante | Plantilla HTML + CSS `@media print` | A4 o ticket, configurable. |
| Respaldos | `pg_dump` programado | Ver [[Knowledge - Soporte y mantenimiento de un sistema en producción]]. |

---

## 7. Plan por versiones

| Versión | Cuándo | Qué | Base de datos |
| --- | --- | --- | --- |
| v1 — clase | 29-oct (base) · 05-nov (programa) | Esquema completo + las funciones imprescindibles (venta rápida, inventario, servicios, créditos, pago semanal) | SQL Server |
| v2 — negocio | ≈ 10-dic | Todo el modelo, carga inicial, respaldos, comprobante ajustado a su impresora, puesta en marcha con Kenry presente | PostgreSQL |
| v3 — mejoras | 2027 | Lo que pidan los dueños al usarlo; API si quieren usarlo desde el teléfono | PostgreSQL |

---

## 8. Cómo podría quedar DEC-006 (para que la escriba el equipo)

- **Contexto:** sección 1 de esta nota.
- **Criterios:** tiempo hasta el 05-nov, que una persona pueda mantenerlo, SQL propio visible, crecer después, costo para los dueños.
- **Opciones:** Django + HTMX · FastAPI + React · Next.js (comparación en la Parte B de la nota de pendientes).
- **Decisión:** la que elijan, con su porqué.
- **Consecuencias:** qué se gana, qué se acepta perder, cuándo revisarla (por ejemplo, si piden una app para teléfono).
- **La decisión de alojamiento** (local o nube) puede ir aparte, en DEC-010, cuando respondan los dueños.

---

## Fuentes de los precios

- [Render — Pricing](https://render.com/pricing) · [Render — Compute plans update](https://render.com/docs/compute-plans-update)
- [Railway — Pricing plans](https://docs.railway.com/pricing/plans)
- [Neon — Pricing](https://neon.com/pricing)
- [Kuberns — DigitalOcean pricing 2026](https://kuberns.com/blogs/digitalocean-pricing/) (fuente secundaria: verificar en la página oficial)
- [Capterra — PythonAnywhere pricing](https://www.capterra.com/p/234268/PythonAnywhere/pricing/) (fuente secundaria)

## Lecturas

- Django: tutorial oficial y "Integrating Django with a legacy database" → https://docs.djangoproject.com/
- HTMX → https://htmx.org/docs/
- PostgreSQL: *Data Definition* y *Views* → https://www.postgresql.org/docs/current/
- `mssql-django` (Django con SQL Server) → buscar el repositorio oficial de Microsoft en GitHub.
