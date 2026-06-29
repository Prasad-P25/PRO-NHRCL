@echo off
REM ================================================
REM PROTECTHER Audit Panel - Headless boot startup
REM Launched by the "PROTECTHER-AutoStart" scheduled task at system startup
REM (runs whether or not anyone is logged in). Starts the ALREADY-BUILT app:
REM   - backend  : node dist\index.js          (:5000)
REM   - frontend : npx serve dist -l 3000 -s    (:3000)
REM The Cloudflare tunnel runs as its OWN Windows service (cloudflared) - NOT here.
REM This script does NOT build; deploys/builds are a manual step. Output is logged
REM to logs\ because there is no console at boot.
REM ================================================
setlocal
set ROOT=C:\PROJECTS\PRO-NHRCL
set PG_ISREADY="C:\Program Files\PostgreSQL\17\bin\pg_isready.exe"
if not exist "%ROOT%\logs" mkdir "%ROOT%\logs"
set LOG=%ROOT%\logs\boot.log

echo [%DATE% %TIME%] boot-start invoked >> "%LOG%"

REM --- Wait up to ~60s for PostgreSQL to accept connections (service may still be starting) ---
set PGREADY=
for /l %%i in (1,1,30) do (
    %PG_ISREADY% -h localhost -p 5432 >nul 2>&1
    if not errorlevel 1 ( set PGREADY=1 & goto :pgok )
    timeout /t 2 /nobreak >nul
)
:pgok
if defined PGREADY (
    echo [%DATE% %TIME%] postgres ready >> "%LOG%"
) else (
    echo [%DATE% %TIME%] WARN postgres not ready after 60s, starting backend anyway >> "%LOG%"
)

REM --- Backend (skip if :5000 already listening) ---
netstat -ano | findstr ":5000 " | findstr LISTENING >nul 2>&1
if errorlevel 1 (
    echo [%DATE% %TIME%] starting backend >> "%LOG%"
    cd /d "%ROOT%\backend"
    start "PROTECTHER Backend" /min cmd /c "node dist\index.js >> ""%ROOT%\logs\boot-backend.log"" 2>&1"
) else (
    echo [%DATE% %TIME%] backend already running on :5000, skipping >> "%LOG%"
)

REM --- Frontend (skip if :3000 already listening) ---
netstat -ano | findstr ":3000 " | findstr LISTENING >nul 2>&1
if errorlevel 1 (
    echo [%DATE% %TIME%] starting frontend >> "%LOG%"
    cd /d "%ROOT%\frontend"
    start "PROTECTHER Frontend" /min cmd /c "npx serve dist -l 3000 -s >> ""%ROOT%\logs\boot-frontend.log"" 2>&1"
) else (
    echo [%DATE% %TIME%] frontend already running on :3000, skipping >> "%LOG%"
)

echo [%DATE% %TIME%] boot-start done >> "%LOG%"
endlocal
