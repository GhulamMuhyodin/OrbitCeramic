@echo off
REM Orbit API — MUST use router.php or /api/* returns "No such file or directory"
cd /d "%~dp0public"
echo.
echo  Orbit API  http://localhost:8080
echo  Health     http://localhost:8080/api/v1/health
echo  Bootstrap  http://localhost:8080/api/v1/bootstrap
echo.
echo  Do NOT run: php -S localhost:8080
echo  Use this script (includes router.php)
echo.
"C:\xampp\php\php.exe" -S localhost:8080 router.php
