# =====================================================================
#  Motor IRM — respaldo de la base de datos.
#  Lo ejecuta la tarea «Motor IRM - Respaldo diario» (todos los días) y
#  también RESPALDAR.cmd cuando se quiera uno a mano.
#  Guarda en respaldos\ los 60 más recientes; si en .env está
#  RESPALDO_COPIA="E:\MotorIRM" (memoria USB, OneDrive…), copia ahí también.
# =====================================================================
param([string]$Motivo = 'diario')
. "$PSScriptRoot\comun.ps1"
$log = Join-Path $LogDir 'respaldos.log'
try {
  $file = Backup-Database $Motivo
  Add-Content $log "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] OK $file" -Encoding UTF8
  Write-Ok "Respaldo guardado: $file"
} catch {
  Add-Content $log "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] ERROR $($_.Exception.Message)" -Encoding UTF8
  Write-Host "✗ $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
