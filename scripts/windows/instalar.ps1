# =====================================================================
#  Motor IRM — instalación en la computadora Windows del negocio.
#  Se corre UNA vez (y se puede volver a correr: no borra datos).
#  Doble clic en INSTALAR.cmd (pide permiso de administrador).
#
#  Antes, instalar a mano (una sola vez):
#    1. Node.js 22 LTS  → https://nodejs.org  (instalador .msi, todo «Siguiente»)
#    2. PostgreSQL 17   → https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
#       Anote la contraseña del usuario «postgres» que le pide el instalador.
#       Puerto 5432. No hace falta Stack Builder.
#
#  Este script:
#    1. Revisa Node.js y PostgreSQL.
#    2. Crea el usuario y la base «motor_irm» (con una contraseña al azar) y el .env.
#    3. Instala las librerías, crea las tablas (migraciones) y los datos iniciales.
#    4. Compila la versión de producción.
#    5. Programa el servidor para que arranque solo al encender la PC y un
#       respaldo diario de la base.
#    6. Crea el ícono «Motor IRM» en el Escritorio de todos los usuarios.
#  No usa Docker.
# =====================================================================
param([switch]$Demo)
. "$PSScriptRoot\comun.ps1"
if (-not (Test-Admin)) { Stop-ConError 'Abra este instalador con INSTALAR.cmd (necesita permiso de administrador).' }
Set-Location $Root
Write-Host "Motor IRM — instalación en $Root" -ForegroundColor White

# ---- 1. Node.js y PostgreSQL ------------------------------------------------
Write-Paso 'Revisando Node.js'
$node = Find-Node
if (-not $node) { Stop-ConError 'No encuentro Node.js. Instale Node.js 22 LTS (https://nodejs.org) y vuelva a correr el instalador.' }
$version = (& $node --version).TrimStart('v')
if ([int]($version.Split('.')[0]) -lt 20) { Stop-ConError "Node.js $version es muy viejo: instale Node.js 22 LTS." }
$npm = Join-Path (Split-Path $node) 'npm.cmd'
Write-Ok "Node.js $version"

Write-Paso 'Revisando PostgreSQL'
$pgBin = Find-PgBin
if (-not $pgBin) { Stop-ConError 'No encuentro PostgreSQL. Instale PostgreSQL 17 y vuelva a correr el instalador.' }
$svc = Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
if ($svc) {
  Set-Service -Name $svc.Name -StartupType Automatic
  if ($svc.Status -ne 'Running') { Start-Service $svc.Name }
  Write-Ok "Servicio $($svc.Name) corriendo y con arranque automático"
} else {
  Write-Aviso 'No encontré el servicio de PostgreSQL; sigo y pruebo la conexión.'
}
$psql = Join-Path $pgBin 'psql.exe'

# ---- 2. Base de datos y .env ------------------------------------------------
$vals = Read-DotEnv
$envFile = Join-Path $Root '.env'
if ($vals['DATABASE_URL'] -and $vals['DATABASE_URL'] -notmatch 'localhost:5433') {
  Write-Paso 'Ya hay un .env con la base configurada: se usa el mismo'
  $db = Split-DatabaseUrl $vals['DATABASE_URL']
} else {
  Write-Paso 'Creando el usuario y la base de datos motor_irm'
  $port = Read-Host 'Puerto de PostgreSQL (Enter = 5432)'
  if (-not $port) { $port = '5432' }
  $sec = Read-Host 'Contraseña del usuario «postgres» (la que puso al instalar PostgreSQL)' -AsSecureString
  $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
  $chars = [char[]]'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  $appPass = -join (1..24 | ForEach-Object { $chars | Get-Random })
  & $psql -h localhost -p $port -U postgres -d postgres -v ON_ERROR_STOP=1 -q -c "DO `$`$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'motor_irm') THEN CREATE ROLE motor_irm LOGIN PASSWORD '$appPass'; ELSE ALTER ROLE motor_irm LOGIN PASSWORD '$appPass'; END IF; END `$`$;"
  if ($LASTEXITCODE -ne 0) { Remove-Item Env:PGPASSWORD; Stop-ConError 'No se pudo entrar a PostgreSQL: revise la contraseña de «postgres» y el puerto.' }
  $exists = & $psql -h localhost -p $port -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'motor_irm'"
  if ($exists -ne '1') {
    & $psql -h localhost -p $port -U postgres -d postgres -v ON_ERROR_STOP=1 -q -c "CREATE DATABASE motor_irm OWNER motor_irm ENCODING 'UTF8' TEMPLATE template0"
    if ($LASTEXITCODE -ne 0) { Remove-Item Env:PGPASSWORD; Stop-ConError 'No se pudo crear la base motor_irm.' }
    Write-Ok 'Base motor_irm creada'
  } else {
    Write-Ok 'La base motor_irm ya existía (no se toca su contenido)'
  }
  Remove-Item Env:PGPASSWORD

  Write-Paso 'Usuario administrador del sistema'
  $admin = Read-Host 'Nombre de usuario del dueño (Enter = admin)'
  if (-not $admin) { $admin = 'admin' }
  do {
    $p1 = Read-Host "Contraseña para «$admin» (mínimo 8 letras o números)" -AsSecureString
    $adminPass = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($p1))
  } while ($adminPass.Length -lt 8)

  $lines = @(
    '# Motor IRM — configuración de ESTA computadora (la creó scripts\windows\instalar.ps1).',
    '# No la comparta: tiene la contraseña de la base de datos.',
    "DATABASE_URL=`"postgresql://motor_irm:$appPass@localhost:$port/motor_irm?schema=public`"",
    "SEED_ADMIN_USERNAME=`"$admin`"",
    "SEED_ADMIN_PASSWORD=`"$adminPass`"",
    "SEED_DEMO=`"$(if ($Demo) { 'true' } else { 'false' })`"",
    'MOTOR_IRM_PORT="3100"',
    '# Copia extra de cada respaldo (memoria USB, carpeta de OneDrive…). Vacío = solo en respaldos\',
    'RESPALDO_COPIA=""'
  )
  # UTF-8 sin BOM (Prisma y Next leen .env así).
  [IO.File]::WriteAllLines($envFile, $lines, (New-Object Text.UTF8Encoding($false)))
  Write-Ok '.env creado'
}

# ---- 3. Librerías, tablas y datos iniciales ----------------------------------
Write-Paso 'Instalando las librerías (necesita internet; 2 a 5 minutos la primera vez)'
Invoke-Paso $npm @('ci', '--no-audit', '--no-fund') 'No se pudieron instalar las librerías'

Write-Paso 'Creando o actualizando las tablas (no borra datos)'
Import-DotEnv | Out-Null
Invoke-Paso $node @('node_modules\prisma\build\index.js', 'migrate', 'deploy') 'No se pudieron aplicar las migraciones'

Write-Paso 'Datos iniciales (permisos, catálogos, usuario administrador)'
Invoke-Paso $node @('node_modules\prisma\build\index.js', 'db', 'seed') 'No se pudieron cargar los datos iniciales'
# La contraseña del dueño ya no hace falta en el archivo: el usuario quedó creado.
$clean = [IO.File]::ReadAllLines($envFile) | ForEach-Object { $_ -replace '^SEED_ADMIN_PASSWORD=.*$', 'SEED_ADMIN_PASSWORD=""' }
[IO.File]::WriteAllLines($envFile, [string[]]$clean, (New-Object Text.UTF8Encoding($false)))

# ---- 4. Compilar --------------------------------------------------------------
Write-Paso 'Compilando la versión de producción (1 a 3 minutos)'
Stop-Server
Build-App $node

# ---- 5. Tareas programadas ----------------------------------------------------
Write-Paso 'Programando el arranque automático y el respaldo diario'
$ps = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
  -RestartCount 10 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
$action = New-ScheduledTaskAction -Execute $ps -WorkingDirectory $Root `
  -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Root\scripts\windows\iniciar-servidor.ps1`""
Register-ScheduledTask -TaskName $TaskServer -Action $action -Trigger (New-ScheduledTaskTrigger -AtStartup) `
  -Principal $principal -Settings $settings -Description 'Servidor de Motor IRM (http://localhost:3100)' -Force | Out-Null
Write-Ok "Tarea «$TaskServer»: arranca sola al encender la computadora"

$backupSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Hours 1)
$backupAction = New-ScheduledTaskAction -Execute $ps -WorkingDirectory $Root `
  -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Root\scripts\windows\respaldo.ps1`" -Motivo diario"
Register-ScheduledTask -TaskName $TaskBackup -Action $backupAction -Trigger (New-ScheduledTaskTrigger -Daily -At '6:40pm') `
  -Principal $principal -Settings $backupSettings -Description 'Respaldo diario de la base de Motor IRM (carpeta respaldos)' -Force | Out-Null
Write-Ok "Tarea «$TaskBackup»: todos los días a las 6:40 p. m. (si la PC está apagada, al encenderla)"

# ---- 6. Ícono -----------------------------------------------------------------
Write-Paso 'Creando el ícono «Motor IRM»'
$icon = Join-Path $Root 'scripts\windows\motor-irm.ico'
$shell = New-Object -ComObject WScript.Shell
foreach ($dir in @([Environment]::GetFolderPath('CommonDesktopDirectory'), (Join-Path ([Environment]::GetFolderPath('CommonPrograms')) ''))) {
  $lnk = $shell.CreateShortcut((Join-Path $dir 'Motor IRM.lnk'))
  $lnk.TargetPath = $ps
  $lnk.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Root\scripts\windows\abrir.ps1`""
  $lnk.WorkingDirectory = $Root
  $lnk.IconLocation = "$icon,0"
  $lnk.WindowStyle = 7
  $lnk.Description = 'Abrir Motor IRM'
  $lnk.Save()
}
Write-Ok 'Ícono en el Escritorio y en el menú Inicio'

# ---- Arrancar y primer respaldo -----------------------------------------------
Write-Paso 'Arrancando el sistema'
if (-not (Start-Server)) { Stop-ConError "El servidor no respondió. Revise $LogDir\servidor.log" }
Write-Ok "Motor IRM corre en http://localhost:$(Get-Port)"
try { $f = Backup-Database 'instalacion'; Write-Ok "Primer respaldo: $f" } catch { Write-Aviso "No se pudo hacer el primer respaldo: $($_.Exception.Message)" }

Write-Host ''
Write-Host '✓ Listo. Doble clic en «Motor IRM» en el Escritorio.' -ForegroundColor Green
Write-Host '  El sistema arranca solo cada vez que se enciende la computadora.'
Write-Host "  Respaldos: $BackupDir"
Write-Host ''
Read-Host 'Presione Enter para cerrar'
