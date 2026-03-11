@echo off
REM ================================================
REM Setup Daily Database Backup Task
REM Run this script as Administrator
REM ================================================

echo ================================================
echo Setting up Daily Database Backup Task
echo ================================================
echo.

REM Check for admin privileges
net session >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] This script requires Administrator privileges.
    echo Please right-click and select "Run as administrator"
    pause
    exit /b 1
)

REM Task configuration
set TASK_NAME=PROTECTHER-Database-Backup
set BACKUP_SCRIPT=C:\PROJECTS\PRO-NHRCL\backup-database.bat
set BACKUP_TIME=02:00

echo Task Name: %TASK_NAME%
echo Backup Script: %BACKUP_SCRIPT%
echo Scheduled Time: %BACKUP_TIME% (daily)
echo.

REM Delete existing task if exists
schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1

REM Create new scheduled task
schtasks /create /tn "%TASK_NAME%" /tr "\"%BACKUP_SCRIPT%\"" /sc daily /st %BACKUP_TIME% /ru SYSTEM /rl HIGHEST /f

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [SUCCESS] Scheduled task created successfully!
    echo.
    echo Task Details:
    schtasks /query /tn "%TASK_NAME%" /fo LIST
    echo.
    echo The database will be automatically backed up daily at %BACKUP_TIME%
    echo Backups are stored in: C:\PROJECTS\PRO-NHRCL\backups
    echo Old backups (older than 7 days) are automatically deleted.
) else (
    echo.
    echo [ERROR] Failed to create scheduled task.
)

echo.
pause
