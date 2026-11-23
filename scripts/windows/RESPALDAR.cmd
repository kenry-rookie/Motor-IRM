@echo off
REM Motor IRM: respaldo manual de la base (queda en la carpeta respaldos)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0respaldo.ps1" -Motivo manual
pause
