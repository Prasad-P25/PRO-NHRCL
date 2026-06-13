@echo off
setlocal enabledelayedexpansion
REM ================================================
REM PROTECTHER Audit Panel - Database Backup Script
REM Credentials are read from backend\.env (never hardcoded here)
REM ================================================

REM Defaults (overridden by backend\.env below)
set DB_HOST=localhost
set DB_PORT=5432
set DB_NAME=mahsr_safety
set DB_USER=postgres
set DB_PASSWORD=
set BACKUP_DIR=C:\PROJECTS\PRO-NHRCL\backups
set PG_DUMP="C:\Program Files\PostgreSQL\17\bin\pg_dump.exe"
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

REM Create timestamp for filename
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set TIMESTAMP=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2%_%datetime:~8,2%-%datetime:~10,2%-%datetime:~12,2%

REM Backup filename
set BACKUP_FILE=%BACKUP_DIR%\%DB_NAME%_%TIMESTAMP%.sql

REM Set password environment variable
set PGPASSWORD=%DB_PASSWORD%

REM Create backup directory if not exists
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

echo ================================================
echo PROTECTHER Database Backup
echo ================================================
echo Timestamp: %TIMESTAMP%
echo Database: %DB_NAME%
echo Backup file: %BACKUP_FILE%
echo ================================================

REM Run pg_dump (--clean --if-exists so the .sql restores cleanly over an existing DB)
echo Creating backup...
%PG_DUMP% -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% --clean --if-exists -F p -f "%BACKUP_FILE%"

if errorlevel 1 (
    echo.
    echo [ERROR] Backup failed!
    set PGPASSWORD=
    exit /b 1
)

echo.
echo [SUCCESS] Backup created successfully!
echo File: %BACKUP_FILE%
for %%A in ("%BACKUP_FILE%") do set SIZE=%%~zA
echo Size: !SIZE! bytes

echo.
echo Creating compressed backup...
%PG_DUMP% -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -F c -f "%BACKUP_FILE%.backup"
if errorlevel 1 (
    echo [WARN] Compressed backup failed.
) else (
    echo [SUCCESS] Compressed backup: %BACKUP_FILE%.backup
)

REM Cleanup old backups (keep last 7 days)
echo.
echo Cleaning up old backups (keeping last 7 days)...
forfiles /p "%BACKUP_DIR%" /s /m *.sql /d -7 /c "cmd /c del @path" 2>nul
forfiles /p "%BACKUP_DIR%" /s /m *.backup /d -7 /c "cmd /c del @path" 2>nul

echo.
echo ================================================
echo Backup completed!
echo ================================================

REM Clear password from environment
set PGPASSWORD=
endlocal
