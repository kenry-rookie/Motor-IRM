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

- PostgreSQL — Sistema gestor de base de datos.
- Aplicación **web** (asignado por el docente).
- **T3 Stack** — Next.js (App Router) + React + TypeScript + Tailwind CSS.
- **tRPC** — contrato tipado de extremo a extremo entre cliente y API (sin escribir tipos a mano).
- **Prisma ORM** — acceso a datos y migraciones.

### Por definir

- Autenticación (las tablas `app_user`, `role`, `permission` ya existen).
- Herramientas de despliegue.
- Infraestructura y alojamiento.

---
## Desarrollo

```bash
npm install                 # también genera el cliente de Prisma
cp .env.example .env        # DATABASE_URL apunta a una BD local de prueba
./start-database.sh         # opcional: levanta Postgres en Docker/Podman con ese URL
npm run db:migrate          # aplica prisma/migrations a la BD
npm run dev                 # http://localhost:3000
```

> **No usar `prisma db push`.** Los CHECK y los índices únicos sin distinción de
> mayúsculas (`lower(name)`) solo existen en `prisma/migrations/0_init/migration.sql`;
> `db push` crea las tablas sin ellos. Cambios al esquema: editar
> `prisma/schema.prisma` y correr `npx prisma migrate dev --name <cambio>`.

### Estructura

```
prisma/
  schema.prisma                 # modelo de datos (39 tablas)
  migrations/0_init/            # SQL inicial + CHECKs + índices lower()/upper()
src/
  app/                          # páginas (Next.js App Router)
  server/
    db.ts                       # cliente de Prisma
    api/
      root.ts                   # router principal: un router por área
      routers/                  # customer, inventory, sales, service, purchasing, staff
  trpc/                         # cliente tRPC (React y llamadas desde el servidor)
  lib/transformer.ts            # SuperJSON + Decimal (montos exactos, nunca float)
Documentation/                  # análisis y diseño
```