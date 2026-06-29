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

:: Stop the Cloudflare tunnel. It runs as a service now, so stop the SERVICE
:: (a plain taskkill would just be respawned by the service manager).
:: Needs admin; falls back to taskkill if it isn't a service / not elevated.
echo Stopping Cloudflare Tunnel...
net stop cloudflared 2>nul || taskkill /F /IM cloudflared.exe 2>nul

echo.
echo ========================================
echo   All services stopped!
echo ========================================
timeout /t 3
