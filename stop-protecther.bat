@echo off
title PROTECTHER Audit Panel - Stop Services
echo ========================================
echo   PROTECTHER Audit Panel - Stopping Services
echo ========================================
echo.

:: Kill Node processes (backend & frontend)
echo Stopping Node servers...
taskkill /F /IM node.exe 2>nul

:: Kill Cloudflared
echo Stopping Cloudflare Tunnel...
taskkill /F /IM cloudflared.exe 2>nul

echo.
echo ========================================
echo   All services stopped!
echo ========================================
timeout /t 3
