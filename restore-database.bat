@echo off
setlocal enabledelayedexpansion
REM ================================================
REM PROTECTHER Audit Panel - Database Restore
REM Runs as the POSTGRES superuser (restore needs DDL: DROP/CREATE).
REM The app role protecther_app has DML-only rights and CANNOT restore.
REM Password comes from pgpass.conf via PGPASSFILE - never hardcoded.
REM
REM Usage: restore-database.bat <backup_filename> [target_db]
REM   <backup_filename>  a file in the backups\ folder (.dump = custom, .sql = plain)
REM   [target_db]        optional; defaults to mahsr_safety. Use a throwaway name to
REM                      test-restore without touching production.
REM ================================================

set DB_HOST=localhost
set DB_PORT=5432
set DB_USER=postgres
set DEFAULT_DB=mahsr_safety
set BACKUP_DIR=C:\PROJECTS\PRO-NHRCL\backups
set PSQL="C:\Program Files\PostgreSQL\17\bin\psql.exe"
set PG_RESTORE="C:\Program Files\PostgreSQL\17\bin\pg_restore.exe"
set PGPASSFILE=C:\Users\IT\AppData\Roaming\postgresql\pgpass.conf

if not exist "%PGPASSFILE%" (
    echo [ERROR] pgpass file not found: %PGPASSFILE%
    exit /b 1
)

if "%~1"=="" (
    echo Available backups:
    echo ------------------
    dir /b "%BACKUP_DIR%\*.dump" "%BACKUP_DIR%\*.sql" "%BACKUP_DIR%\*.backup" 2>nul
    echo.
    echo Usage: restore-database.bat ^<backup_filename^> [target_db]
    echo Example: restore-database.bat mahsr_safety_2026-06-29_18-22-56.dump
    echo Test into a throwaway DB: restore-database.bat ^<file^> mahsr_safety_restoretest
    goto :end
)

set BACKUP_FILE=%BACKUP_DIR%\%~1
set DB_NAME=%~2
if "%DB_NAME%"=="" set DB_NAME=%DEFAULT_DB%

if not exist "%BACKUP_FILE%" (
    echo [ERROR] Backup file not found: %BACKUP_FILE%
    goto :end
)

echo ================================================
echo WARNING: this OVERWRITES database "%DB_NAME%"
echo Backup file: %BACKUP_FILE%
echo ================================================
set /p CONFIRM="Type yes to continue: "
if /i not "%CONFIRM%"=="yes" (
    echo Restore cancelled.
    goto :end
)

echo Restoring...
if /i "%~x1"==".sql" (
    REM Plain SQL dump - psql, stop on first error
    %PSQL% -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -v ON_ERROR_STOP=1 -f "%BACKUP_FILE%"
) else (
    REM Custom/compressed dump (.dump/.backup) - pg_restore, clean existing objects first
    %PG_RESTORE% -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% --clean --if-exists "%BACKUP_FILE%"
)

if errorlevel 1 (
    echo [ERROR] Restore reported errors - review output above.
) else (
    echo [SUCCESS] Database "%DB_NAME%" restored.
)

:end
endlocal
