@echo off
title PROTECTHER STAGING - Startup
echo ========================================
echo   PROTECTHER STAGING - Starting Services
echo   Backend :5001   Frontend :3001
echo   DB: mahsr_safety_staging
echo ========================================

:: Staging backend runs from SOURCE (reflects the current working tree / branch),
:: against the staging DB, on port 5001. Secrets/DB creds come from backend\.env;
:: the vars below override the prod ones for staging.
cd /d C:\PROJECTS\PRO-NHRCL\backend
set PORT=5001
set DB_NAME=mahsr_safety_staging
set NODE_ENV=production
set CORS_ORIGIN=https://staging-audit.protecther.in,http://localhost:3001
set APP_URL=https://staging-audit.protecther.in
start "STAGING Backend" cmd /k "npx ts-node-dev --transpile-only --no-notify src/index.ts"

timeout /t 3 /nobreak >nul

:: Staging frontend = the dist-staging build (points at staging-api), served on 3001.
cd /d C:\PROJECTS\PRO-NHRCL\frontend
start "STAGING Frontend" cmd /k "npx serve dist-staging -l 3001 -s"

echo.
echo Staging starting. URLs (via Cloudflare tunnel):
echo   https://staging-audit.protecther.in
echo   https://staging-api-audit.protecther.in
