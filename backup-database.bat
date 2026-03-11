@echo off
REM ================================================
REM PROTECTHER Audit Panel - Database Backup Script
REM ================================================

REM Configuration
set DB_HOST=localhost
set DB_PORT=5432
set DB_NAME=mahsr_safety
set DB_USER=postgres
set DB_PASSWORD=WtIxYDqnjwKhcXkm6appxYRFTUxhfvCE
set BACKUP_DIR=C:\PROJECTS\PRO-NHRCL\backups
set PG_DUMP="C:\Program Files\PostgreSQL\17\bin\pg_dump.exe"

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

REM Run pg_dump
echo Creating backup...
%PG_DUMP% -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -F p -f "%BACKUP_FILE%"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [SUCCESS] Backup created successfully!
    echo File: %BACKUP_FILE%

    REM Get file size
    for %%A in ("%BACKUP_FILE%") do set SIZE=%%~zA
    echo Size: %SIZE% bytes

    REM Also create a compressed backup
    echo.
    echo Creating compressed backup...
    %PG_DUMP% -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -F c -f "%BACKUP_FILE%.backup"

    if %ERRORLEVEL% EQU 0 (
        echo [SUCCESS] Compressed backup: %BACKUP_FILE%.backup
    )
) else (
    echo.
    echo [ERROR] Backup failed!
    exit /b 1
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
