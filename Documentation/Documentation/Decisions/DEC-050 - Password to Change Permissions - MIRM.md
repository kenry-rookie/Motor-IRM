---
id: DEC-050
project: "[[Motor IRM]]"
stage: S8
status: Tomada
date: 2026-11-10
participants: Kenry
source: IA (Claude, a pedido de Kenry)
reviewed: true
---
**[[Motor IRM|← Hub]]** · **[[DEC-049 - Filters in the Database - MIRM|← DEC-049]]**

# DEC-050 — Password to Change Permissions

## Decisión

- Guardar los permisos de un perfil pide la **contraseña de quien guarda**, aunque sea un dueño con sesión abierta. Una computadora abierta en el mostrador no basta para repartir permisos.
- Los cambios se marcan en pantalla y se guardan juntos (un solo pedido de contraseña).
- Nadie puede quitarle a su propio perfil el permiso de administrar usuarios (para no quedarse sin acceso).
- El perfil «Dueño» recibe automáticamente los permisos nuevos que traiga una versión (el seed los agrega); los demás perfiles quedan como los dejaron los dueños.

## Historial

- 10-nov — Implementada por Claude a pedido de Kenry; pendiente de revisión del equipo.
