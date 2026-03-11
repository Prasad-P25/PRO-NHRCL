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

:: Start Backend
echo Starting Backend Server...
cd /d C:\PROJECTS\PRO-NHRCL\backend
start "PROTECTHER Backend" cmd /k "npm run dev"
timeout /t 5 /nobreak >nul

:: Start Frontend
echo Starting Frontend Server...
cd /d C:\PROJECTS\PRO-NHRCL\frontend
start "PROTECTHER Frontend" cmd /k "npx vite --host"
timeout /t 5 /nobreak >nul

:: Start Cloudflare Tunnel
echo Starting Cloudflare Tunnel...
start "PROTECTHER Tunnel" cmd /k "C:\Users\IT\Downloads\cloudflared.exe tunnel run protecther-audit"

echo.
echo ========================================
echo   All services started!
echo   Frontend: https://audit.protecther.in
echo   API: https://api-audit.protecther.in
echo ========================================
echo.
echo You can close this window.
timeout /t 5
