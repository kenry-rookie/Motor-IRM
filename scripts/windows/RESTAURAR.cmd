@echo off
REM Motor IRM: RESTAURAR (pide permiso de administrador y ejecuta restaurar.ps1)
cd /d "%~dp0\..\.."
powershell -NoProfile -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoExit -NoProfile -ExecutionPolicy Bypass -File ""%CD%\scripts\windows\restaurar.ps1"" '"
