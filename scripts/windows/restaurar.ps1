# =====================================================================
#  Motor IRM — restaurar un respaldo (RESTAURAR.cmd).
#  CUIDADO: la base vuelve a como estaba en ese respaldo; lo registrado
#  después se pierde. Antes de restaurar se hace un respaldo del estado
#  actual, por si hay que volver atrás.
# =====================================================================
. "$PSScriptRoot\comun.ps1"
if (-not (Test-Admin)) { Stop-ConError 'Abra RESTAURAR.cmd (necesita permiso de administrador).' }
$files = @(Get-ChildItem $BackupDir -Filter 'motor_irm_*.dump' | Sort-Object LastWriteTime -Descending | Select-Object -First 20)
if ($files.Count -eq 0) { Stop-ConError "No hay respaldos en $BackupDir" }
Write-Host 'Respaldos (el más reciente primero):'
for ($i = 0; $i -lt $files.Count; $i++) { Write-Host ("  {0,2}. {1}  ({2:N0} KB)" -f ($i + 1), $files[$i].Name, ($files[$i].Length / 1KB)) }
$n = Read-Host 'Número del respaldo a restaurar (Enter = cancelar)'
if (-not $n) { exit 0 }
$file = $files[[int]$n - 1]
Write-Host ''
Write-Host "Se restaurará $($file.Name). Todo lo registrado después de ese momento se pierde." -ForegroundColor Yellow
if ((Read-Host 'Escriba RESTAURAR para continuar') -cne 'RESTAURAR') { Write-Host 'Cancelado.'; exit 0 }

$vals = Read-DotEnv
$db = Split-DatabaseUrl $vals['DATABASE_URL']
$bin = Find-PgBin
Write-Paso 'Respaldo del estado actual (por si hay que volver)'
Write-Ok (Backup-Database 'antes-de-restaurar')
Write-Paso 'Deteniendo el servidor'
Stop-Server
Write-Paso "Restaurando $($file.Name)"
$env:PGPASSWORD = $db.Password
& (Join-Path $bin 'pg_restore.exe') -h $db.Host -p $db.Port -U $db.User -d $db.Database --clean --if-exists --no-owner $file.FullName
$code = $LASTEXITCODE
Remove-Item Env:PGPASSWORD
if ($code -ne 0) { Write-Aviso "pg_restore terminó con código $code (revise los mensajes; a veces son solo avisos)." }
Write-Paso 'Arrancando'
if (-not (Start-Server)) { Stop-ConError "El servidor no respondió. Revise $LogDir\servidor.log" }
Write-Host '✓ Respaldo restaurado.' -ForegroundColor Green
Read-Host 'Presione Enter para cerrar'
