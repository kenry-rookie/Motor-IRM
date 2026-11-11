---
id: DEC-035
project: "[[Motor IRM]]"
stage: S5
transformation: Modelo
status: Tomada
date: 2026-11-07
participants: Kenry
source: IA (redactada por Claude a pedido de Kenry; adaptada de la recomendación D10, hecha para Django, al cambio a TypeScript/Node; aplicada y probada por Claude en 01_schema.sql v2)
reviewed: true
---
**[[Motor IRM|← Hub]]** · **[[DEC-018 - Staff Table Mapping - MIRM|DEC-018]]** · **[[DEC-034 - DDL as Single Source of Truth - MIRM|← DEC-034]]**

# DEC-035 — Staff Login Credentials

## Contexto

- La versión de clase incluye **iniciar sesión** (Dueño y Encargado) — alcance de [[S6 - Object-Oriented Model and Requirements - MIRM|S6]].
- La recomendación D10 unía `staff` con la tabla de usuarios de Django. Con TypeScript/Node ([[DEC-033 - Technology Stack Change to TypeScript and Node - MIRM|DEC-033]]) no existe esa tabla: el usuario se guarda en la propia base.
- Los mecánicos no usan el sistema.

## Opciones

| Opción | Cómo funciona | A favor | En contra |
| --- | --- | --- | --- |
| **A — Columnas en `staff`** | `username` y `password_hash`, nulos para quien no inicia sesión | Una tabla menos; el rol ya está en `staff` | Columnas vacías en los mecánicos |
| B — Tabla `app_user` aparte (1:1 con `staff`) | Usuario separado del personal | Separa datos de acceso | Una tabla y una FK más, sin columnas propias que lo justifiquen |

## Decisión

**Elegimos:** A — Columnas en `staff`.

| Columna / restricción | Qué hace |
| --- | --- |
| `username VARCHAR(30)` | Nombre de usuario; nulo si no inicia sesión |
| `password_hash VARCHAR(255)` | **Hash** de la contraseña (nunca la contraseña); lo calcula el programa (por ejemplo con bcrypt o argon2) |
| `uq_staff_username` (índice sobre `lower(username)`) | No hay dos usuarios iguales, sin importar mayúsculas |
| `ck_staff_login_pair` | Usuario y hash van juntos |
| `ck_staff_login_role` | Un mecánico no tiene usuario |
| `ck_staff_username` | El usuario no es texto vacío |

- El rol para los permisos sale de `staff.role` (DUENO, ENCARGADO). Un usuario desactivado (`active = false`) no puede entrar: **va en la aplicación**.

**Por qué:** es lo mínimo para el inicio de sesión, sin tablas nuevas.

## Consecuencias

- **Ganamos:** los permisos (C-03) se leen del mismo `staff` que registra las operaciones.
- **Aceptamos:** sin historial de accesos ni recuperación de contraseña (para el 10-dic, si hace falta).
- **Cuándo revisarla:** si un mecánico necesita entrar al sistema (por ejemplo, para ver sus servicios).

## Historial

- 06-nov — Recomendada como D10 (versión Django).
- 07-nov — Aceptada por Kenry y adaptada a TypeScript/Node. Pruebas 52 a 54. Redactada por Claude a pedido de Kenry; pendiente de revisión del equipo.
