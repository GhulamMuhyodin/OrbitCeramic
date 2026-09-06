@echo off
title Orbit API
cd /d "%~dp0public"

if not exist "C:\xampp\php\php.exe" (
  echo ERROR: C:\xampp\php\php.exe not found
  pause
  exit /b 1
)

if not exist "router.php" (
  echo ERROR: router.php missing in public\
  pause
  exit /b 1
)

echo.
echo ========================================
echo   Orbit API starting...
echo   http://localhost:8080/api/v1/health
echo ========================================
echo.
echo Keep this window OPEN. Press Ctrl+C to stop.
echo.

"C:\xampp\php\php.exe" -S localhost:8080 router.php
pause
