@echo off
title PROTECTHER Audit Panel - Startup Script
echo ========================================
echo   PROTECTHER Audit Panel - Starting Services
echo ========================================
echo.

:: Wait for network to be ready
echo Waiting for network...
timeout /t 10 /nobreak >nul

:: Start PostgreSQL if not running (optional - uncomment if needed)
:: net start postgresql-x64-14

:: Build and Start Backend
echo Building Backend...
cd /d C:\PROJECTS\PRO-NHRCL\backend
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Backend build failed!
    pause
    exit /b 1
)
echo Starting Backend Server...
start "PROTECTHER Backend" cmd /k "npm start"
timeout /t 5 /nobreak >nul

:: Build and Start Frontend
echo Building Frontend...
cd /d C:\PROJECTS\PRO-NHRCL\frontend
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Frontend build failed!
    pause
    exit /b 1
)
echo Starting Frontend Server...
start "PROTECTHER Frontend" cmd /k "npx serve dist -l 3000"
timeout /t 5 /nobreak >nul

:: Start Cloudflare Tunnel
echo Starting Cloudflare Tunnel...
start "PROTECTHER Tunnel" cmd /k "C:\Users\IT\Downloads\cloudflared.exe tunnel run mahsr-safety"

echo.
echo ========================================
echo   All services started!
echo   Frontend: https://audit.protecther.in
echo   API: https://api-audit.protecther.in
echo ========================================
echo.
echo You can close this window.
timeout /t 5
