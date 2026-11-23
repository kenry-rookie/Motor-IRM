@echo off
REM Motor IRM: DETENER (pide permiso de administrador y ejecuta detener.ps1)
cd /d "%~dp0\..\.."
powershell -NoProfile -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoExit -NoProfile -ExecutionPolicy Bypass -File ""%CD%\scripts\windows\detener.ps1"" '"
