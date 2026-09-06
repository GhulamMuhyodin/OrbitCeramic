@echo off
REM Orbit Ceramic database CLI wrapper
cd /d "%~dp0"

set PHP=php
if exist "C:\xampp\php\php.exe" set PHP=C:\xampp\php\php.exe

"%PHP%" bin\database %*
exit /b %ERRORLEVEL%
