# Motor IRM

---
**Motor IRM** es un software orientado a la administración de un negocio de motocicletas.

El negocio combina la venta de repuestos, accesorios y lubricantes, además de la prestación de servicios mecánicos. Su operación depende principalmente de la experiencia y memoria de sus propietarios. Actualmente, gran parte de la información relacionada con compras, ventas, inventario, créditos, reparaciones, pagos y administración se maneja mediante procesos manuales, notas en el teléfono y conocimiento personal.

El propósito de Motor IRM es **transformar un negocio administrado mediante experiencia y memoria en un negocio administrado mediante información confiable**, manteniendo la rapidez y simplicidad que caracterizan su forma actual de trabajar.

---
## **Estado del proyecto**

El estado vive en las **propiedades** de esta nota (`stage`, `next`) y el detalle en el [[010 - Development - MIRM|Development]].

---
## Objetivos

 **De análisis y diseño**

- Identificar el flujo de trabajo del negocio.
- Reconocer y formalizar las reglas de negocio para mejorar el control de los datos.
- Realizar un modelado de datos coherente que sirva de base al software.

**Del sistema**

- Centralizar la administración de ventas, inventario, créditos y reparaciones.
- Reducir el tiempo que los propietarios dedican a tareas administrativas.
- Mantener la velocidad con la que opera actualmente el negocio.
- Preservar la integridad y fiabilidad de la información ante futuras actualizaciones y necesidades.

**Del proyecto**

- Desarrollar el software a partir del modelado de datos definido.

---
## **Tecnologías**

### Definidas

- **TypeScript + Node.js** — programa con una **API**.
- **PostgreSQL** — base de datos, con el DDL propio como única fuente de verdad ([[DEC-034 - DDL as Single Source of Truth - MIRM|DEC-034]]) y vistas.
- En **local**, con su **ícono en el escritorio** como una aplicación de escritorio. Para clase basta con mostrar que corre en local (no se presenta el servidor web).
- Git + GitHub, DBeaver, Docker o Postgres.app, `pg_dump` para respaldos.


### Por definir

- Alojamiento para el negocio (local en su PC o en la nube) → futura DEC, según los dueños.
- Framework de la API, interfaz y cómo se empaqueta como app de escritorio → S8 (DEC-033).

---
