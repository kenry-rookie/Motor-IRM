@echo off
REM Motor IRM: ACTUALIZAR (pide permiso de administrador y ejecuta actualizar.ps1)
cd /d "%~dp0\..\.."
powershell -NoProfile -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoExit -NoProfile -ExecutionPolicy Bypass -File ""%CD%\scripts\windows\actualizar.ps1"" '"
