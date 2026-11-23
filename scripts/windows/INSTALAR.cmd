@echo off
REM Motor IRM: INSTALAR (pide permiso de administrador y ejecuta instalar.ps1)
cd /d "%~dp0\..\.."
powershell -NoProfile -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoExit -NoProfile -ExecutionPolicy Bypass -File ""%CD%\scripts\windows\instalar.ps1"" '"
