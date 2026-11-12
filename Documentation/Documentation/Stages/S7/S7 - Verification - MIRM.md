---
project: "[[Motor IRM]]"
stage: S7
status: ⚪ Pendiente
started:
finished:
source: IA (nota de etapa redactada por Claude a pedido de Kenry, a partir del Restart Plan y de lo ya hecho en S5)
ai_edit: "Claude — 2026-11-05: nota creada (objetivo, lo que ya se hizo en S5, qué hacer y criterio de cierre); 2026-11-07: estado tras el DDL v2"
reviewed: true
---
**[[Motor IRM|← Hub]]** · **[[S6 - Object-Oriented Model and Requirements - MIRM|← S6]]** · **[[S5 - DDL PostgreSQL - MIRM|DDL]]** · **[[S5 - Business Queries - MIRM|Consultas]]**

# S7 - Verification - MIRM

## Objetivo de la etapa

Demostrar que el modelo **funciona con datos reales** antes de construir la aplicación. Es la última puerta del modelado: después viene S8 (arquitectura y construcción).

> [!info] Por qué esta etapa es corta
> Gran parte de S7 se adelantó en S5 por la entrega del 29-oct. Lo que falta es **recorrer el negocio completo con `INSERT` reales** y recibir la mirada del docente.

## Lo que ya se hizo en S5

- [x] El DDL corre sin errores en PostgreSQL 16 (36 tablas).
- [x] Restricciones probadas: v1 37 intentos; **v2 (07-nov) 61 casos, todos correctos** ([[S5 - DDL PostgreSQL - MIRM|DDL]] §5.2).
- [ ] Datos de prueba realistas: la factura real de 64 líneas. **El `03_seed_demo.sql` se perdió (07-nov)**: se rehace con la factura, ajustado al DDL v2.
- [x] 22 consultas del negocio probadas sobre el DDL v2 ([[S5 - Business Queries - MIRM|Business Queries]]).

## Insumos

- [[S4 - ER and EER Model - MIRM|MER/EER]]: escenarios **E1 a E9**.
- [[S5 - DDL PostgreSQL - MIRM|DDL]] y `db/postgres/` en el repositorio.
- [[S6 - Object-Oriented Model and Requirements - MIRM|S6]]: casos de uso y diagrama de estados.
- Respuestas de los dueños de la entrevista de noviembre (SRC-07).
- `First Version/` (modelos del intento 1).

## Qué hacer

1. **Escenarios como `INSERT`:** escribir cada escenario E1–E9 como un script (`db/postgres/04_scenarios.sql`), en el orden en que pasa en el negocio, dentro de `BEGIN; … COMMIT;`. Si un escenario no se puede registrar → falta algo en el modelo (regla 6).
2. **Consultas contra los escenarios:** después de cada escenario, correr la consulta que lo comprueba (por ejemplo, después de E3 la existencia; después del abono, el saldo del crédito).
3. **Vistas de §7 del esquema** (`02_views.sql`), si el equipo decide crearlas aquí ([[DEC-020 - Derived Attributes as Views - MIRM|DEC-020]]). Su lógica ya está en las consultas Q04, Q07, Q11, Q15–Q17 y Q19.
4. **Instalación desde cero:** en una base vacía, ejecutar `01` → `02` → `03` → `04` sin errores. Es el ensayo de lo que se hará en la PC del negocio.
5. **Comparación con el intento 1:** ¿qué detecta el modelo nuevo que el viejo no? ¿Hay algo del viejo que el nuevo perdió?
6. **Revisión final:** IA (en el chat) y **docente**. Cada observación del docente se anota con su respuesta.

## Criterio de cierre

- [ ] Los escenarios E1–E9 corren como `INSERT` sin errores (o generaron una pregunta resuelta).
- [ ] Cada pregunta del negocio tiene su consulta funcionando sobre los escenarios.
- [ ] La base se instala desde cero con los scripts, en orden.
- [ ] Comparación con el intento 1 escrita.
- [ ] Observaciones del docente respondidas.
- [ ] Revisión de la IA respondida (en el chat).
- ✅ **Modelado cerrado** → S8: requisitos detallados de la versión 1, arquitectura, tecnologías, Git/GitHub, hosting.

➡️ Siguiente etapa: S8 - Architecture and Construction - MIRM

## Lecturas

- PostgreSQL — *INSERT*: https://www.postgresql.org/docs/current/sql-insert.html
- PostgreSQL — *Transactions*: https://www.postgresql.org/docs/current/tutorial-transactions.html
- PostgreSQL — *CREATE VIEW*: https://www.postgresql.org/docs/current/sql-createview.html
- [[Restart Plan - MIRM|Restart Plan]] §4 (S7).
