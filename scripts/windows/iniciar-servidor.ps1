# =====================================================================
#  Motor IRM — arranca el servidor (lo ejecuta la tarea programada
#  «Motor IRM - Servidor» al encender la computadora). No se cierra:
#  mientras corre, el sistema está disponible en http://localhost:3100
#
#   1. Espera a que PostgreSQL esté listo.
#   2. Aplica migraciones pendientes (migrate deploy: solo agrega, nunca borra).
#   3. Arranca Next.js en modo producción, solo para esta computadora (127.0.0.1).
#  Registro: logs\servidor.log
# =====================================================================
. "$PSScriptRoot\comun.ps1"
$ErrorActionPreference = 'Continue'
$log = Join-Path $LogDir 'servidor.log'
if ((Test-Path $log) -and (Get-Item $log).Length -gt 5MB) { Move-Item $log "$log.anterior" -Force }
function Log([string]$t) { Add-Content -Path $log -Value "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $t" -Encoding UTF8 }

Set-Location $Root
$vals = Import-DotEnv
$env:NODE_ENV = 'production'
$env:NEXT_DIST_DIR = '.next-prod'
$port = Get-Port
$node = Find-Node
if (-not $node) { Log 'ERROR: no encuentro node.exe'; exit 1 }

# 1) PostgreSQL listo
$db = Split-DatabaseUrl $vals['DATABASE_URL']
$bin = Find-PgBin
for ($i = 0; $i -lt 90; $i++) {
  & (Join-Path $bin 'pg_isready.exe') -h $db.Host -p $db.Port -q
  if ($LASTEXITCODE -eq 0) { break }
  Start-Sleep -Seconds 2
}
Log "Iniciando (PostgreSQL listo: $($LASTEXITCODE -eq 0))"

# 2) Migraciones pendientes
& $node 'node_modules\prisma\build\index.js' migrate deploy *>> $log
if ($LASTEXITCODE -ne 0) { Log 'ERROR: no se pudieron aplicar las migraciones'; exit 1 }

# 3) Servidor (bloquea mientras corre)
Log "Servidor en http://127.0.0.1:$port"
& $node 'node_modules\next\dist\bin\next' start -p $port -H 127.0.0.1 *>> $log
Log "El servidor se detuvo (código $LASTEXITCODE)"
exit $LASTEXITCODE
