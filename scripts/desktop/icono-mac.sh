#!/bin/bash
# Pone el ícono IRM al lanzador "Motor IRM.app" del Escritorio.
#
# Por qué hace falta todo esto: en macOS recientes, osacompile mete el ícono
# genérico de AppleScript dentro de Assets.car y lo señala en Info.plist con
# CFBundleIconName. macOS usa ESE ícono antes que applet.icns, así que hay que
# quitar los dos, volver a firmar la app (cambió su contenido) y avisarle al
# Finder/Dock que refresquen su caché de íconos.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
APP="${1:-$HOME/Desktop/Motor IRM.app}"
RES="$APP/Contents/Resources"
[ -d "$APP" ] || { echo "✗ No existe $APP (corre primero: npm run app:install)"; exit 1; }

TMP="$(mktemp -d)"; SET="$TMP/icon.iconset"; mkdir "$SET"
for s in 16 32 128 256 512; do
  sips -z $s $s "$HERE/icon-1024.png" --out "$SET/icon_${s}x${s}.png" >/dev/null
  sips -z $((s*2)) $((s*2)) "$HERE/icon-1024.png" --out "$SET/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$SET" -o "$RES/applet.icns"
rm -rf "$TMP"

rm -f "$RES/Assets.car"
/usr/libexec/PlistBuddy -c "Delete :CFBundleIconName" "$APP/Contents/Info.plist" 2>/dev/null || true
/usr/libexec/PlistBuddy -c "Set :CFBundleIconFile applet" "$APP/Contents/Info.plist" 2>/dev/null \
  || /usr/libexec/PlistBuddy -c "Add :CFBundleIconFile string applet" "$APP/Contents/Info.plist"

# osacompile no le pone identificador a la app; sin él macOS no puede guardar
# bien su permiso para Documentos (ni tccutil puede reiniciarlo).
PL="$APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier ni.uni.motorirm.launcher" "$PL" 2>/dev/null \
  || /usr/libexec/PlistBuddy -c "Add :CFBundleIdentifier string ni.uni.motorirm.launcher" "$PL"

codesign --force --deep --sign - "$APP" >/dev/null 2>&1 || true   # firma local (ad-hoc)
touch "$APP"
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$APP" >/dev/null 2>&1 || true
killall Finder Dock >/dev/null 2>&1 || true

echo "✓ Ícono aplicado a $APP"
