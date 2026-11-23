# Motor IRM en Windows (sin Docker)

Instalación para la computadora del negocio. Los dueños solo usan el ícono
**Motor IRM** del Escritorio; todo lo demás lo hace quien instala (Kenry).

## Lo que queda instalado

| Pieza | Qué hace |
| --- | --- |
| PostgreSQL 17 (servicio de Windows) | La base de datos. Arranca sola con Windows. |
| Tarea **Motor IRM - Servidor** | Arranca el sistema al encender la PC (aunque nadie haya entrado a Windows). Si se cae, se vuelve a levantar sola. Solo atiende a esta computadora (`127.0.0.1:3100`). |
| Tarea **Motor IRM - Respaldo diario** | Copia de la base todos los días a las 6:40 p. m. (si la PC estaba apagada, al encenderla). |
| Ícono **Motor IRM** (Escritorio y menú Inicio) | Abre el sistema en su propia ventana de Edge, sin barra de direcciones ni opción de «desinstalar». |
| `respaldos\` | Los últimos 60 respaldos (`.dump`). Con `RESPALDO_COPIA` en `.env` también se copian a una USB u OneDrive. |
| `logs\` | `servidor.log` y `respaldos.log`, para revisar errores. |

## Instalar (una vez)

1. Instalar **Node.js 22 LTS** (https://nodejs.org, instalador `.msi`, todo «Siguiente»).
2. Instalar **PostgreSQL 17** (https://www.enterprisedb.com/downloads/postgres-postgresql-downloads):
   anotar la contraseña de `postgres`, puerto `5432`, sin Stack Builder.
3. Copiar la carpeta del proyecto a **`C:\MotorIRM`** (sin `node_modules`, `.next`, `.next-prod` ni `.env`):
   con `git clone` o copiando la carpeta.
4. Doble clic en `C:\MotorIRM\scripts\windows\INSTALAR.cmd` → «Sí» al permiso de administrador.
   Pide: el puerto, la contraseña de `postgres`, y el usuario y contraseña del dueño.
   La primera vez necesita internet (descarga las librerías).
5. Doble clic en **Motor IRM** en el Escritorio y entrar con ese usuario.

`INSTALAR.cmd` se puede volver a correr: no borra datos (reusa el `.env` que ya existe).

## Día a día

- Encender la PC → esperar un minuto → **Motor IRM**.
- Si el ícono dice «todavía está arrancando»: esperar un minuto y abrir otra vez.

## Mantenimiento

| Archivo | Para qué |
| --- | --- |
| `RESPALDAR.cmd` | Un respaldo ahora (antes de algo delicado). |
| `ACTUALIZAR.cmd` | Versión nueva: respalda, detiene, `git pull`, librerías, migraciones, compila y arranca. |
| `RESTAURAR.cmd` | Volver a un respaldo (pide escribir RESTAURAR; antes respalda el estado actual). |
| `DETENER.cmd` | Detener el servidor (vuelve a arrancar al reiniciar la PC). |

## Si algo falla

- `logs\servidor.log` dice por qué no arrancó.
- Programador de tareas → «Motor IRM - Servidor» → Historial.
- PostgreSQL: `services.msc` → `postgresql-x64-17` debe estar «En ejecución» y «Automático».

> Escrito por Claude (23-nov-2026) a pedido de Kenry; **no está probado en Windows todavía**:
> hacer el ensayo completo en otra PC antes del 10-dic (ver Development en Obsidian).
