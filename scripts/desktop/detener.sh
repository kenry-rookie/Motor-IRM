#!/bin/bash
# Detiene el servidor de Motor IRM (la base de datos en Docker sigue encendida;
# para apagarla también: npm run db:down).
PORT="${MOTOR_IRM_PORT:-3100}"
PID_FILE="$HOME/Library/Logs/MotorIRM/servidor.pid"
[ -f "$PID_FILE" ] && pkill -P "$(cat "$PID_FILE")" 2>/dev/null; kill "$(cat "$PID_FILE" 2>/dev/null)" 2>/dev/null
# Por si quedó algo escuchando en el puerto
PIDS="$(lsof -ti tcp:"$PORT" 2>/dev/null)"
[ -n "$PIDS" ] && kill $PIDS 2>/dev/null
rm -f "$PID_FILE"
echo "Motor IRM detenido."
