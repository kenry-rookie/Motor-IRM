# Motor IRM — detiene el servidor (DETENER.cmd). Vuelve a arrancar solo al reiniciar la PC,
# o con «Iniciar» en el Programador de tareas (tarea «Motor IRM - Servidor»).
. "$PSScriptRoot\comun.ps1"
if (-not (Test-Admin)) { Stop-ConError 'Abra DETENER.cmd (necesita permiso de administrador).' }
Stop-Server
Write-Ok 'Servidor detenido.'
Start-Sleep -Seconds 2
