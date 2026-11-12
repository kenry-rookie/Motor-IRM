#!/bin/bash
# =====================================================================
#  Motor IRM — instalación en la Mac (se corre UNA vez, desde la Terminal):
#
#     npm run app:install
#
#  Hace: guarda tu PATH (para que el ícono encuentre node y docker),
#  aplica migraciones, compila la versión de producción y crea el ícono
#  "Motor IRM" en el Escritorio.
# =====================================================================
set -euo pipefail

DIR="$(cd "$(dirname "$0")/../.." && pwd)"
HERE="$DIR/scripts/desktop"
APP="$HOME/Desktop/Motor IRM.app"
cd "$DIR"

echo "→ Guardando el PATH de esta Terminal…"
echo "$PATH" >"$HERE/.path"
chmod +x "$HERE/motor-irm.sh" "$HERE/detener.sh"

echo "→ Revisando Docker y la base de datos…"
docker info >/dev/null 2>&1 || { echo "✗ Abre Docker Desktop y vuelve a correr este comando."; exit 1; }
docker compose up -d --wait db

echo "→ Aplicando migraciones pendientes (no borra datos)…"
npx prisma migrate deploy

echo "→ Compilando la versión de producción (1–2 minutos)…"
npm run app:build

echo "→ Creando el ícono en el Escritorio…"
bash "$HERE/crear-app-mac.sh"

echo ""
echo "✓ Listo. Doble clic en \"Motor IRM\" en tu Escritorio."
echo "  (Puedes arrastrarlo al Dock. Para detener el servidor: npm run app:stop)"
