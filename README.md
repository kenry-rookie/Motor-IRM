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

### Requisitos

- **Node.js 20+** y npm.
- **Docker Desktop** abierto (la base de datos corre en un contenedor; no hace falta instalar PostgreSQL).

### Primera vez

```bash
npm install                 # librerías + genera el cliente de Prisma
cp .env.example .env        # variables locales (la conexión ya apunta a Docker)
npm run db:setup            # levanta PostgreSQL en Docker, crea las tablas y carga datos iniciales
npm run dev                 # http://localhost:3000  → usuario: admin / clave: cambiar-esta-clave
```

Con `SEED_DEMO="true"` (por defecto en `.env.example`) también se cargan productos, clientes, mecánicos y el usuario `encargado` / `encargado123`.

### Base de datos en Docker

`docker-compose.yml` define un solo servicio, `db` (PostgreSQL 17):

| Dato | Valor |
| --- | --- |
| Host / puerto **desde la Mac** | `localhost:5433` (no 5432, para no chocar con un PostgreSQL instalado en la Mac) |
| Usuario / contraseña | `motor_irm` / `motor_irm_dev` (solo desarrollo local) |
| Base de desarrollo | `motor_irm` |
| Base de pruebas | `motor_irm_test` (la crea `docker/postgres/init/` la primera vez) |
| Zona horaria | `America/Managua` (DEC-038) |
| Datos | volumen `motor-irm-pgdata`: sobreviven a apagar el contenedor |

La API se conecta con `DATABASE_URL` de `.env`:

```
postgresql://motor_irm:motor_irm_dev@localhost:5433/motor_irm?schema=public
```

Para verla con DBeaver, pgAdmin o TablePlus usa esos mismos datos.

| Comando | Qué hace |
| --- | --- |
| `npm run db:up` | Enciende el contenedor (y espera a que esté listo) |
| `npm run db:down` | Lo apaga; los datos se conservan |
| `npm run db:migrate` | Aplica las migraciones pendientes (`prisma/migrations`) |
| `npm run db:seed` | Roles, permisos, catálogos, usuario admin (y demo si `SEED_DEMO=true`) |
| `npm run db:setup` | `db:up` + `db:migrate` + `db:seed` |
| `npm run db:reset` | **Borra todos los datos** y vuelve a crear la base desde cero |
| `npm run db:psql` | Consola SQL dentro del contenedor |
| `npm run db:studio` | Prisma Studio (ver/editar datos en el navegador) |
| `npm run db:logs` | Ver el log de PostgreSQL |
| `npm test` | Pruebas de integración contra `motor_irm_test` (nunca toca `motor_irm`) |

### Cambios al esquema

> **No usar `prisma db push`.** Los CHECK, los índices `lower()`/`upper()` y los
> triggers de stock solo existen en las migraciones SQL; `db push` crea las tablas sin ellos.

1. Editar `prisma/schema.prisma`.
2. `npm run db:migrate:new -- --name <cambio>` genera la migración **sin aplicarla**.
3. Revisar el SQL generado y agregar a mano los CHECK/índices/triggers que Prisma no expresa.
4. `npm run db:migrate` y `npm test`.

### Estructura

```
docker-compose.yml              # PostgreSQL local
docker/postgres/init/           # scripts del primer arranque (crea la base de pruebas)
prisma/
  schema.prisma                 # modelo de datos (40 tablas)
  migrations/0_init/            # SQL inicial + CHECKs + índices lower()/upper()
  migrations/1_decisions_…/     # DEC-037 (orden con id propio), DEC-038 (zona horaria), DEC-039 (trigger de stock)
  migrations/2_app_session/     # sesiones de inicio de sesión
  seed.ts                       # datos iniciales
src/
  app/                          # pantallas (Next.js App Router)
    login/                      # inicio de sesión
    (app)/                      # todo lo que requiere sesión: inicio, ventas, taller, inventario, clientes
  server/
    db.ts                       # cliente de Prisma
    auth/                       # contraseñas (scrypt), sesiones, permisos
    domain/                     # reglas compartidas: valores permitidos, dinero, inventario, facturación
    api/
      trpc.ts                   # contexto, protectedProcedure, permissionProcedure, errores
      errors.ts                 # errores de PostgreSQL → mensajes en español
      root.ts                   # router principal: un router por área
      routers/                  # auth, admin, customer, inventory, sales, service, purchasing, staff, reports
  trpc/                         # cliente tRPC (React y llamadas desde el servidor)
  lib/                          # transformer (Decimal), formato de dinero/fechas, errores
tests/                          # pruebas de integración (Vitest + PostgreSQL real)
Documentation/                  # análisis y diseño
```
