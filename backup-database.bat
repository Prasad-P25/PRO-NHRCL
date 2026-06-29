@echo off
setlocal enabledelayedexpansion
REM ================================================
REM PROTECTHER Audit Panel - Database Backup
REM Runs as the POSTGRES superuser so the dump is COMPLETE and restorable.
REM (The app role protecther_app has DML-only rights and must NOT be used here.)
REM The postgres password is read from pgpass.conf via PGPASSFILE - never hardcoded.
REM Safe to run unattended (Scheduled Task as SYSTEM): all paths are absolute and
REM SYSTEM can read pgpass.conf.
REM ================================================

set DB_HOST=localhost
set DB_PORT=5432
set DB_NAME=mahsr_safety
set DB_USER=postgres
set BACKUP_DIR=C:\PROJECTS\PRO-NHRCL\backups
set PG_DUMP="C:\Program Files\PostgreSQL\17\bin\pg_dump.exe"

REM Absolute pgpass path (do NOT rely on %APPDATA% - it differs under SYSTEM).
set PGPASSFILE=C:\Users\IT\AppData\Roaming\postgresql\pgpass.conf

if not exist "%PGPASSFILE%" (
    echo [ERROR] pgpass file not found: %PGPASSFILE%
    exit /b 1
)

REM Timestamp for filename
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set TIMESTAMP=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2%_%datetime:~8,2%-%datetime:~10,2%-%datetime:~12,2%

set BACKUP_FILE=%BACKUP_DIR%\%DB_NAME%_%TIMESTAMP%.dump

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

echo ================================================
echo PROTECTHER Database Backup
echo Timestamp : %TIMESTAMP%
echo Database  : %DB_NAME%  (as %DB_USER%)
echo Output    : %BACKUP_FILE%
echo ================================================

REM Custom-format compressed dump (primary; restore with pg_restore).
echo Creating compressed backup...
%PG_DUMP% -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -F c -f "%BACKUP_FILE%"
if errorlevel 1 (
    echo [ERROR] Backup failed!
    exit /b 1
)

for %%A in ("%BACKUP_FILE%") do set SIZE=%%~zA
echo [SUCCESS] Backup created: %BACKUP_FILE%  - !SIZE! bytes

REM Sanity check: a real dump is more than a few hundred bytes.
if !SIZE! LSS 1024 echo [WARN] Backup file is suspiciously small - check the database/connection.

REM Cleanup: keep last 7 days of ROUTINE dumps only. Routine files are named
REM <db>_<year>-... so the "_2*" mask matches them but NOT manual PRE_* safety dumps,
REM which are kept indefinitely.
echo Cleaning up routine backups older than 7 days...
forfiles /p "%BACKUP_DIR%" /m "%DB_NAME%_2*.dump" /d -7 /c "cmd /c del @path" 2>nul

echo ================================================
echo Backup completed.
echo ================================================
endlocal
