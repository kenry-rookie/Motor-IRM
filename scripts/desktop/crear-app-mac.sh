#!/bin/bash
# Crea (o vuelve a crear) el ícono "Motor IRM.app" en el Escritorio.
# No compila nada: sirve para rehacer solo el lanzador.
#
# El lanzador corre motor-irm.sh en primer plano y, si falla, muestra el error
# en una ventana (antes corría escondido y, si fallaba, no se veía nada).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$HOME/Desktop/Motor IRM.app"
LOG="$HOME/Library/Logs/MotorIRM/lanzador.log"
mkdir -p "$(dirname "$LOG")"
chmod +x "$HERE/motor-irm.sh" "$HERE/detener.sh" "$HERE/icono-mac.sh"

rm -rf "$APP"
osacompile -o "$APP" \
  -e 'try' \
  -e "  do shell script \"/bin/bash \" & quoted form of \"$HERE/motor-irm.sh\" & \" >> \" & quoted form of \"$LOG\" & \" 2>&1\"" \
  -e 'on error errMsg' \
  -e '  display dialog "Motor IRM no pudo abrir." & return & return & errMsg with title "Motor IRM" buttons {"OK"} default button 1 with icon stop' \
  -e 'end try'

bash "$HERE/icono-mac.sh" "$APP"

# El proyecto está en Documentos, que macOS protege: la app necesita permiso.
# Ese permiso queda atado a la firma de la app; como la app se acaba de
# rehacer, borramos el permiso viejo para que macOS vuelva a PREGUNTAR en el
# primer doble clic (si no, la bloquea en silencio: "Operation not permitted").
tccutil reset SystemPolicyDocumentsFolder ni.uni.motorirm.launcher >/dev/null 2>&1 || true
echo "  Al primer doble clic, macOS preguntará por la carpeta Documentos: dale «Permitir»."
echo "✓ Lanzador creado: $APP"
