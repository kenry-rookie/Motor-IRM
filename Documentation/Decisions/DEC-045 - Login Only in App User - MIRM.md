---
id: DEC-045
project: "[[Motor IRM]]"
stage: S8
transformation: Modelo
status: Tomada
date: 2026-11-10
participants: Kenry
source: IA (redactada por Claude a pedido de Kenry; prompt v2 §5.1.2)
replaces: DEC-035
reviewed: true
---
**[[Motor IRM|← Hub]]** · **[[DEC-035 - Staff Login Credentials - MIRM|← DEC-035 (reemplazada)]]** · **[[DEC-044 - Motorcycle Brands and Models Only From Catalog - MIRM|← DEC-044]]**

# DEC-045 — Login Only in App User

Reemplaza a [[DEC-035 - Staff Login Credentials - MIRM|DEC-035]].

## Contexto

- DEC-035 ponía usuario y contraseña en `staff`. El esquema que corre (Prisma, DEC-040) los tiene en `app_user`, con sesiones en `app_session`. Las dos notas se contradecían.

## Decisión

- El login vive **solo** en `app_user` (usuario, hash scrypt, rol, activo, último ingreso), enlazado **0..1** con `staff` (`uq_app_user_staff_id`).
- Una persona del negocio puede no tener usuario (mecánicos); un usuario puede no ser persona del taller (una cuenta técnica).
- El rol para permisos sale de `app_user.role_id`, no de `staff`.

**Por qué:** es lo que ya está implementado y probado, y separa «quién trabaja aquí» (staff) de «quién entra al sistema» (app_user). Eso permite crear un usuario con permisos elegidos el día que contraten a alguien (Fase 6).

## Historial

- 10-nov — Redactada por Claude a pedido de Kenry; pendiente de revisión del equipo.
