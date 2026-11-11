#!/bin/bash
# =====================================================================
#  Motor IRM — lanzador (lo ejecuta el ícono "Motor IRM" del escritorio)
#
#   1. Si el sistema ya está corriendo, solo abre la ventana.
#   2. Si no: abre Docker Desktop → levanta PostgreSQL → aplica migraciones
#      pendientes (nunca borran datos) → compila si el código cambió →
#      arranca el servidor en modo producción → abre la ventana.
#
#  Registro: ~/Library/Logs/MotorIRM/servidor.log
# =====================================================================
set -u

DIR="$(cd "$(dirname "$0")/../.." && pwd)"
PORT="${MOTOR_IRM_PORT:-3100}"   # 3000 queda libre para `npm run dev`
URL="http://localhost:$PORT"
LOG_DIR="$HOME/Library/Logs/MotorIRM"
LOG="$LOG_DIR/servidor.log"
PID_FILE="$LOG_DIR/servidor.pid"
mkdir -p "$LOG_DIR"

# Una app abierta desde el Finder no carga tu .zshrc, así que no "ve" node ni
# docker. El instalador guardó el PATH de tu Terminal en .path; si no existe,
# probamos las rutas típicas (Homebrew, Docker Desktop, nvm).
if [ -f "$DIR/scripts/desktop/.path" ]; then
  PATH="$(cat "$DIR/scripts/desktop/.path")"
else
  PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.docker/bin:/usr/bin:/bin:/usr/sbin:/sbin"
  [ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
fi
export PATH

notify() { osascript -e "display notification \"$1\" with title \"Motor IRM\"" >/dev/null 2>&1; }
fail() {
  echo "[$(date '+%F %T')] ERROR: $1" >>"$LOG"
  osascript -e "display dialog \"$1\" with title \"Motor IRM\" buttons {\"OK\"} default button 1 with icon stop" >/dev/null 2>&1
  exit 1
}
is_up() { curl -s -o /dev/null --max-time 2 "$URL/login"; }

# Ventana propia, sin barra de direcciones: Chrome/Edge/Brave en modo "app".
# Si no hay ninguno, el navegador por defecto.
open_window() {
  echo "[$(date '+%F %T')] Abriendo la ventana en $URL" >>"$LOG"
  # 1) La app instalada, con su propio ícono en el Dock:
  #    - Safari → Archivo → Agregar al Dock (queda en ~/Applications/Motor IRM.app).
  #      Es la recomendada: ventana limpia, sin botón de "Desinstalar".
  #    - o Brave/Chrome/Edge → Instalar Motor IRM (~/Applications/<Navegador> Apps/).
  local pwa=""
  [ -d "$HOME/Applications/Motor IRM.app" ] && pwa="$HOME/Applications/Motor IRM.app"
  [ -z "$pwa" ] && pwa="$(find "$HOME/Applications" -maxdepth 2 -path "*Apps.localized/Motor IRM*.app" -print -quit 2>/dev/null)"
  if [ -n "$pwa" ]; then
    echo "  con la app instalada: $pwa" >>"$LOG"
    open "$pwa"
    return
  fi
  # 2) Si no, ventana en modo app del navegador (en el Dock sale el ícono del navegador).
  for app in "Google Chrome" "Microsoft Edge" "Brave Browser"; do
    if open -Ra "$app" >/dev/null 2>&1; then
      echo "  con $app (modo app)" >>"$LOG"
      open -na "$app" --args --app="$URL" || open "$URL"
      return
    fi
  done
  open "$URL"
}

cd "$DIR" || fail "No encuentro la carpeta del proyecto: $DIR"
echo "[$(date '+%F %T')] Iniciando desde $DIR" >>"$LOG"

command -v node >/dev/null 2>&1 || fail "No encuentro Node.js. Vuelve a correr: npm run app:install"
command -v docker >/dev/null 2>&1 || fail "No encuentro Docker. Instala y abre Docker Desktop."


# 1) Docker Desktop
if ! docker info >/dev/null 2>&1; then
  open -ga Docker
  for _ in $(seq 1 90); do docker info >/dev/null 2>&1 && break; sleep 2; done
  docker info >/dev/null 2>&1 || fail "Docker Desktop no arrancó. Ábrelo a mano y vuelve a intentar."
fi

# 2) Base de datos
docker compose up -d --wait db >>"$LOG" 2>&1 \
  || fail "No se pudo iniciar la base de datos. Revisa ~/Library/Logs/MotorIRM/servidor.log"

# Servidor ya corriendo (y la base ya revisada arriba): solo abrir la ventana.
if is_up; then
  echo "[$(date '+%F %T')] El servidor ya estaba corriendo" >>"$LOG"
  open_window
  exit 0
fi

# 3) Migraciones pendientes (deploy solo agrega; nunca resetea ni borra datos)
npx --no-install prisma migrate deploy >>"$LOG" 2>&1 \
  || fail "No se pudieron aplicar las migraciones. Revisa ~/Library/Logs/MotorIRM/servidor.log"

# 4) Compilar si no hay versión de producción o si el código cambió desde la última
BUILD_ID=".next-prod/BUILD_ID"
if [ ! -f "$BUILD_ID" ] || [ -n "$(find src prisma public package.json next.config.js -newer "$BUILD_ID" -print -quit 2>/dev/null)" ]; then
  notify "Preparando la versión nueva del sistema (1–2 minutos)…"
  npm run app:build >>"$LOG" 2>&1 \
    || fail "Falló la compilación. Revisa ~/Library/Logs/MotorIRM/servidor.log"
fi

# 5) Servidor en segundo plano (sigue corriendo aunque cierres la ventana)
NODE_ENV=production NEXT_DIST_DIR=.next-prod \
  nohup npx --no-install next start -p "$PORT" </dev/null >>"$LOG" 2>&1 &
echo $! >"$PID_FILE"
disown 2>/dev/null

for _ in $(seq 1 60); do is_up && break; sleep 1; done
is_up || fail "El servidor no respondió. Revisa ~/Library/Logs/MotorIRM/servidor.log"

open_window
