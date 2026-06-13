@echo off
setlocal enabledelayedexpansion
REM ================================================
REM PROTECTHER Audit Panel - Database Restore Script
REM Credentials are read from backend\.env (never hardcoded here)
REM ================================================

REM Defaults (overridden by backend\.env below)
set DB_HOST=localhost
set DB_PORT=5432
set DB_NAME=mahsr_safety
set DB_USER=postgres
set DB_PASSWORD=
set BACKUP_DIR=C:\PROJECTS\PRO-NHRCL\backups
set PSQL="C:\Program Files\PostgreSQL\17\bin\psql.exe"
set PG_RESTORE="C:\Program Files\PostgreSQL\17\bin\pg_restore.exe"
set ENV_FILE=C:\PROJECTS\PRO-NHRCL\backend\.env

REM Load DB_* values from backend\.env
if not exist "%ENV_FILE%" (
    echo [ERROR] Env file not found: %ENV_FILE%
    exit /b 1
)
for /f "usebackq eol=# tokens=1,* delims==" %%a in ("%ENV_FILE%") do (
    if /i "%%a"=="DB_HOST" set "DB_HOST=%%b"
    if /i "%%a"=="DB_PORT" set "DB_PORT=%%b"
    if /i "%%a"=="DB_NAME" set "DB_NAME=%%b"
    if /i "%%a"=="DB_USER" set "DB_USER=%%b"
    if /i "%%a"=="DB_PASSWORD" set "DB_PASSWORD=%%b"
)

if "%DB_PASSWORD%"=="" (
    echo [ERROR] DB_PASSWORD not found in %ENV_FILE%
    exit /b 1
)

REM Set password environment variable
set PGPASSWORD=%DB_PASSWORD%

echo ================================================
echo PROTECTHER Database Restore
echo ================================================
echo.

REM Check if backup file is provided
if "%~1"=="" (
    echo Available backups:
    echo ------------------
    dir /b "%BACKUP_DIR%\*.sql" "%BACKUP_DIR%\*.backup" 2>nul
    echo.
    echo Usage: restore-database.bat [backup_filename]
    echo Example: restore-database.bat mahsr_safety_2026-02-05_12-00-00.sql
    echo.
    goto :end
)

set BACKUP_FILE=%BACKUP_DIR%\%~1

REM Check if file exists
if not exist "%BACKUP_FILE%" (
    echo [ERROR] Backup file not found: %BACKUP_FILE%
    goto :end
)

echo WARNING: This will overwrite the current database!
echo Database: %DB_NAME%
echo Backup file: %BACKUP_FILE%
echo.
set /p CONFIRM="Are you sure you want to continue? (yes/no): "

if /i not "%CONFIRM%"=="yes" (
    echo Restore cancelled.
    goto :end
)

echo.
echo Restoring database...

REM Check file extension
if "%~x1"==".backup" (
    REM Compressed format - use pg_restore
    %PG_RESTORE% -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -c --if-exists "%BACKUP_FILE%"
) else (
    REM SQL format - use psql, stop on first error
    %PSQL% -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -v ON_ERROR_STOP=1 -f "%BACKUP_FILE%"
)

if errorlevel 1 (
    echo.
    echo [ERROR] Restore failed!
) else (
    echo.
    echo [SUCCESS] Database restored successfully!
)

:end
REM Clear password from environment
set PGPASSWORD=
endlocal
