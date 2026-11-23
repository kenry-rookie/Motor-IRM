# =====================================================================
#  Motor IRM — actualizar a una versión nueva (ACTUALIZAR.cmd).
#   1. Respaldo de la base ANTES de tocar nada.
#   2. Detiene el servidor.
#   3. Trae el código nuevo (git pull si la carpeta es un repositorio;
#      si no, copie antes los archivos nuevos encima de esta carpeta).
#   4. Librerías, migraciones (solo agregan, no borran) y compilación.
#   5. Vuelve a arrancar el servidor.
# =====================================================================
. "$PSScriptRoot\comun.ps1"
if (-not (Test-Admin)) { Stop-ConError 'Abra ACTUALIZAR.cmd (necesita permiso de administrador).' }
Set-Location $Root
$node = Find-Node
if (-not $node) { Stop-ConError 'No encuentro Node.js.' }
$npm = Join-Path (Split-Path $node) 'npm.cmd'

Write-Paso 'Respaldo antes de actualizar'
try { Write-Ok (Backup-Database 'antes-de-actualizar') } catch { Stop-ConError "No se pudo respaldar la base: $($_.Exception.Message). No se actualizó nada." }

Write-Paso 'Deteniendo el servidor'
Stop-Server
Write-Ok 'Detenido'

if (Test-Path (Join-Path $Root '.git')) {
  Write-Paso 'Trayendo la versión nueva (git pull)'
  $git = Get-Command git.exe -ErrorAction SilentlyContinue
  if ($git) { Invoke-Paso $git.Source @('pull', '--ff-only') 'git pull falló (¿hay cambios locales?)' }
  else { Write-Aviso 'Git no está instalado: se usa el código que ya está en la carpeta.' }
}

Write-Paso 'Librerías'
Invoke-Paso $npm @('ci', '--no-audit', '--no-fund') 'No se pudieron instalar las librerías'

Write-Paso 'Migraciones pendientes (no borran datos)'
Import-DotEnv | Out-Null
Invoke-Paso $node @('node_modules\prisma\build\index.js', 'migrate', 'deploy') 'No se pudieron aplicar las migraciones'
# Permisos y catálogos nuevos de la versión (el seed no duplica ni borra nada).
Invoke-Paso $node @('node_modules\prisma\build\index.js', 'db', 'seed') 'No se pudieron actualizar los datos iniciales'

Write-Paso 'Compilando'
Build-App $node

Write-Paso 'Arrancando'
if (-not (Start-Server)) { Stop-ConError "El servidor no respondió. Revise $LogDir\servidor.log" }
Write-Host ''
Write-Host '✓ Motor IRM actualizado.' -ForegroundColor Green
Read-Host 'Presione Enter para cerrar'
