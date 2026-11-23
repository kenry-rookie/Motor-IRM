# =====================================================================
#  Motor IRM — lo abre el ícono del Escritorio.
#  Espera a que el servidor responda (al encender la PC tarda un poco) y
#  abre el sistema en su propia ventana de Edge, sin barra de direcciones.
# =====================================================================
. "$PSScriptRoot\comun.ps1"
Add-Type -AssemblyName System.Windows.Forms
# 127.0.0.1 y no "localhost": el servidor solo escucha en IPv4 y Windows prueba primero ::1.
$url = "http://127.0.0.1:$(Get-Port)"
$listo = $false
for ($i = 0; $i -lt 60; $i++) { if (Test-ServerUp) { $listo = $true; break }; Start-Sleep -Seconds 1 }
if (-not $listo) {
  [System.Windows.Forms.MessageBox]::Show(
    "El sistema todavía está arrancando o no está corriendo.`n`nEspere un minuto y vuelva a abrir Motor IRM. Si sigue igual, reinicie la computadora.",
    'Motor IRM', 'OK', 'Warning') | Out-Null
  exit 1
}
$edge = Find-Edge
if (-not $edge) { Start-Process $url; exit 0 }
# Perfil propio: la sesión de Motor IRM no se mezcla con el navegador de todos los días.
$perfil = Join-Path $env:LOCALAPPDATA 'MotorIRM\navegador'
New-Item -ItemType Directory -Force -Path $perfil | Out-Null
Start-Process -FilePath $edge -ArgumentList @("--app=$url", "--user-data-dir=`"$perfil`"", '--no-first-run', '--no-default-browser-check', '--start-maximized')
