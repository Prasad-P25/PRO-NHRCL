@echo off
title Refresh STAGING from PROD
echo This refreshes mahsr_safety_staging with a fresh copy of production.
echo (Staging data will be REPLACED by current prod data.)
echo.

set PGBIN=C:\Program Files\PostgreSQL\17\bin
set DUMP=%TEMP%\mahsr_prod_for_staging.dump

echo Dumping production...
"%PGBIN%\pg_dump.exe" -h localhost -U postgres -d mahsr_safety -F c -f "%DUMP%"
if %ERRORLEVEL% NEQ 0 ( echo [ERROR] pg_dump failed & pause & exit /b 1 )

echo Recreating staging DB...
"%PGBIN%\psql.exe" -h localhost -U postgres -d postgres -c "DROP DATABASE IF EXISTS mahsr_safety_staging;"
"%PGBIN%\psql.exe" -h localhost -U postgres -d postgres -c "CREATE DATABASE mahsr_safety_staging;"

echo Restoring into staging...
"%PGBIN%\pg_restore.exe" -h localhost -U postgres -d mahsr_safety_staging --no-owner "%DUMP%"

echo.
echo Done. Staging now mirrors production. Rebuild the staging frontend if it changed:
echo   cd frontend ^&^& npx vite build --mode staging --outDir dist-staging --emptyOutDir
echo Set PGPASSWORD before running, or configure %%APPDATA%%\postgresql\pgpass.conf
