@echo off
REM ================================================
REM PROTECTHER Audit Panel - Database Restore Script
REM ================================================

REM Configuration
set DB_HOST=localhost
set DB_PORT=5432
set DB_NAME=mahsr_safety
set DB_USER=postgres
set DB_PASSWORD=WtIxYDqnjwKhcXkm6appxYRFTUxhfvCE
set BACKUP_DIR=C:\PROJECTS\PRO-NHRCL\backups
set PSQL="C:\Program Files\PostgreSQL\17\bin\psql.exe"
set PG_RESTORE="C:\Program Files\PostgreSQL\17\bin\pg_restore.exe"

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
    REM SQL format - use psql
    %PSQL% -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -f "%BACKUP_FILE%"
)

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [SUCCESS] Database restored successfully!
) else (
    echo.
    echo [ERROR] Restore failed!
)

:end
REM Clear password from environment
set PGPASSWORD=
