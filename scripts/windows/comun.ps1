# =====================================================================
#  Motor IRM — funciones compartidas de los scripts de Windows.
#  No se ejecuta solo: lo cargan los demás con  . "$PSScriptRoot\comun.ps1"
# =====================================================================
$ErrorActionPreference = 'Stop'
# Los >> de PowerShell 5.1 escriben en UTF-16: que el registro quede en UTF-8 como el resto.
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'
$Root     = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$LogDir   = Join-Path $Root 'logs'
$BackupDir = Join-Path $Root 'respaldos'
$TaskServer = 'Motor IRM - Servidor'
$TaskBackup = 'Motor IRM - Respaldo diario'
New-Item -ItemType Directory -Force -Path $LogDir, $BackupDir | Out-Null

function Write-Paso([string]$texto) { Write-Host ""; Write-Host "→ $texto" -ForegroundColor Cyan }
function Write-Ok([string]$texto)   { Write-Host "  ✓ $texto" -ForegroundColor Green }
function Write-Aviso([string]$texto){ Write-Host "  ! $texto" -ForegroundColor Yellow }
function Stop-ConError([string]$texto) {
  Write-Host ""
  Write-Host "✗ $texto" -ForegroundColor Red
  Write-Host ""
  Read-Host "Presione Enter para cerrar"
  exit 1
}

function Test-Admin {
  $p = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
  return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Lee el archivo .env (KEY="valor") a un diccionario.
function Read-DotEnv {
  $vals = @{}
  $file = Join-Path $Root '.env'
  if (Test-Path $file) {
    foreach ($line in Get-Content $file -Encoding UTF8) {
      if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?(.*?)"?\s*$' -and $line -notmatch '^\s*#') {
        $vals[$Matches[1]] = $Matches[2]
      }
    }
  }
  return $vals
}

# Pone las variables del .env en el proceso actual (para node, prisma, pg_dump).
function Import-DotEnv {
  $vals = Read-DotEnv
  foreach ($k in $vals.Keys) { Set-Item -Path "Env:$k" -Value $vals[$k] }
  return $vals
}

# postgresql://usuario:clave@host:puerto/base?schema=public → partes
function Split-DatabaseUrl([string]$url) {
  if ($url -notmatch '^postgres(?:ql)?://([^:]+):([^@]*)@([^:/]+):(\d+)/([^?]+)') { throw "DATABASE_URL no tiene el formato esperado." }
  return @{ User = [Uri]::UnescapeDataString($Matches[1]); Password = [Uri]::UnescapeDataString($Matches[2]); Host = $Matches[3]; Port = $Matches[4]; Database = $Matches[5] }
}

# Carpeta bin de PostgreSQL (la versión más nueva instalada).
function Find-PgBin {
  $candidatos = Get-ChildItem -Path "$env:ProgramFiles\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue |
    Sort-Object { [int]($_.Directory.Parent.Name -replace '\D', '') } -Descending
  if ($candidatos) { return $candidatos[0].Directory.FullName }
  $cmd = Get-Command psql.exe -ErrorAction SilentlyContinue
  if ($cmd) { return (Split-Path $cmd.Source) }
  return $null
}

function Find-Node {
  $cmd = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  foreach ($p in @("$env:ProgramFiles\nodejs\node.exe", "${env:ProgramFiles(x86)}\nodejs\node.exe")) { if (Test-Path $p) { return $p } }
  return $null
}

function Find-Edge {
  foreach ($p in @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe")) {
    if (Test-Path $p) { return $p }
  }
  foreach ($p in @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe")) {
    if (Test-Path $p) { return $p }
  }
  return $null
}

function Get-Port { $v = Read-DotEnv; if ($v['MOTOR_IRM_PORT']) { return $v['MOTOR_IRM_PORT'] } else { return '3100' } }

function Test-ServerUp {
  try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:$(Get-Port)/login" -UseBasicParsing -TimeoutSec 3
    return ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500)
  } catch { return $false }
}

# Corre un programa, muestra su salida y falla si termina con error.
function Invoke-Paso([string]$exe, [string[]]$argumentos, [string]$siFalla) {
  & $exe @argumentos
  if ($LASTEXITCODE -ne 0) { Stop-ConError "$siFalla (código $LASTEXITCODE). Revise los mensajes de arriba." }
}

# Compila la versión de producción en .next-prod (lo mismo que `npm run app:build` en la Mac,
# que en Windows no sirve porque usa la sintaxis VAR=valor de bash).
function Build-App([string]$node) {
  Import-DotEnv | Out-Null
  $env:NEXT_DIST_DIR = '.next-prod'
  Push-Location $Root
  try {
    Invoke-Paso $node @('node_modules\prisma\build\index.js', 'generate') 'No se pudo generar el cliente de Prisma'
    Invoke-Paso $node @('node_modules\next\dist\bin\next', 'build') 'Falló la compilación'
  } finally { Pop-Location }
}

# Respaldo con pg_dump (formato comprimido de PostgreSQL). Devuelve la ruta del archivo.
function Backup-Database([string]$motivo = 'manual') {
  $vals = Read-DotEnv
  if (-not $vals['DATABASE_URL']) { throw 'Falta DATABASE_URL en .env' }
  $db = Split-DatabaseUrl $vals['DATABASE_URL']
  $bin = Find-PgBin
  if (-not $bin) { throw 'No encuentro PostgreSQL (pg_dump.exe).' }
  $stamp = Get-Date -Format 'yyyy-MM-dd_HHmm'
  $file = Join-Path $BackupDir "motor_irm_${stamp}_$motivo.dump"
  $env:PGPASSWORD = $db.Password
  & (Join-Path $bin 'pg_dump.exe') -h $db.Host -p $db.Port -U $db.User -d $db.Database -F c -f $file
  $code = $LASTEXITCODE
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  if ($code -ne 0 -or -not (Test-Path $file)) { throw "pg_dump falló (código $code)." }
  # Copia extra (memoria USB, OneDrive…) si se configuró RESPALDO_COPIA en .env
  if ($vals['RESPALDO_COPIA'] -and (Test-Path $vals['RESPALDO_COPIA'])) {
    Copy-Item $file -Destination $vals['RESPALDO_COPIA'] -Force
  }
  # Se guardan los 60 más recientes.
  Get-ChildItem $BackupDir -Filter 'motor_irm_*.dump' | Sort-Object LastWriteTime -Descending | Select-Object -Skip 60 | Remove-Item -Force
  return $file
}

function Stop-Server {
  Stop-ScheduledTask -TaskName $TaskServer -ErrorAction SilentlyContinue
  # El servidor es node.exe corriendo next desde esta carpeta.
  Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine -like "*next*start*" -and $_.CommandLine -like "*$(Get-Port)*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Seconds 2
}

function Start-Server {
  Start-ScheduledTask -TaskName $TaskServer
  for ($i = 0; $i -lt 90; $i++) { if (Test-ServerUp) { return $true }; Start-Sleep -Seconds 1 }
  return $false
}
