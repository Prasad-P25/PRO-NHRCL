@echo off
title PROTECTHER Audit Panel - Stop Services
echo ========================================
echo   PROTECTHER Audit Panel - Stopping Services
echo ========================================
echo.

:: Kill ONLY the Node processes started from this project (not every node.exe on the machine)
echo Stopping Node servers...
for /f "tokens=2 delims=," %%P in ('wmic process where "name='node.exe' and commandline like '%%PRO-NHRCL%%'" get processid /format:csv 2^>nul ^| findstr [0-9]') do (
    taskkill /F /PID %%P 2>nul
)

:: Kill Cloudflared
echo Stopping Cloudflare Tunnel...
taskkill /F /IM cloudflared.exe 2>nul

echo.
echo ========================================
echo   All services stopped!
echo ========================================
timeout /t 3
