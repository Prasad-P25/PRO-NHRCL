<#
  setup-autostart.ps1  -  RUN ONCE, AS ADMINISTRATOR.

  Makes PROTECTHER survive an unattended reboot (e.g. power cut) with no one logged in:

    1. cloudflared -> Windows service (LocalSystem), so the tunnel is always up.
    2. "PROTECTHER-AutoStart" scheduled task -> runs boot-start.bat at system startup
       as the IT account using S4U logon (runs whether logged on or not, NO stored
       password, local resources only - which is all the app needs).
    3. "PROTECTHER-Database-Backup" scheduled task -> daily 02:00 backup as SYSTEM.
    4. Removes the old Startup-folder shortcuts (login-only) so the app isn't
       double-launched when someone logs in.

  Re-runnable: it removes/recreates the tasks and only installs the service if missing.

  How to run:
    Right-click Windows PowerShell -> "Run as administrator", then:
      powershell -ExecutionPolicy Bypass -File C:\PROJECTS\PRO-NHRCL\setup-autostart.ps1
#>

$ErrorActionPreference = 'Stop'
$ROOT     = 'C:\PROJECTS\PRO-NHRCL'
$CF       = 'C:\Users\IT\Downloads\cloudflared.exe'
$CF_CONF  = 'C:\Users\IT\.cloudflared\config.yml'
$APP_USER = "$env:COMPUTERNAME\IT"

function Assert-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  if (-not (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole(
        [Security.Principal.WindowsBuiltinRole]::Administrator)) {
    throw "Not elevated. Re-run this in an Administrator PowerShell."
  }
}

Assert-Admin
Write-Host "== PROTECTHER auto-start setup ==" -ForegroundColor Cyan
Write-Host "App account for boot task: $APP_USER"

# ---------------------------------------------------------------------------
# 1) cloudflared as a Windows service
# ---------------------------------------------------------------------------
Write-Host "`n[1/4] cloudflared service..." -ForegroundColor Cyan
$svc = Get-Service -Name 'cloudflared' -ErrorAction SilentlyContinue
if (-not $svc) { $svc = Get-Service -Name 'Cloudflared' -ErrorAction SilentlyContinue }
if ($svc) {
  Write-Host "  service '$($svc.Name)' already exists - leaving install as-is."
} else {
  # Stop any manually-started tunnel first so we don't run two instances.
  Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Write-Host "  installing service (config: $CF_CONF)..."
  & $CF --config $CF_CONF service install
  if ($LASTEXITCODE -ne 0) { throw "cloudflared service install failed (exit $LASTEXITCODE)" }
  $svc = Get-Service -Name 'cloudflared','Cloudflared' -ErrorAction SilentlyContinue | Select-Object -First 1
}
if ($svc) {
  Set-Service -Name $svc.Name -StartupType Automatic
  if ($svc.Status -ne 'Running') { Start-Service -Name $svc.Name }
  Write-Host "  service '$($svc.Name)': $((Get-Service $svc.Name).Status), StartType Automatic" -ForegroundColor Green
}

# ---------------------------------------------------------------------------
# 2) AtStartup task -> boot-start.bat  (S4U: no password, no login needed)
# ---------------------------------------------------------------------------
Write-Host "`n[2/4] PROTECTHER-AutoStart task..." -ForegroundColor Cyan
Unregister-ScheduledTask -TaskName 'PROTECTHER-AutoStart' -Confirm:$false -ErrorAction SilentlyContinue
$action  = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"$ROOT\boot-start.bat`"" -WorkingDirectory $ROOT
$trigger = New-ScheduledTaskTrigger -AtStartup
$trigger.Delay = 'PT30S'   # let services settle after boot
$princ   = New-ScheduledTaskPrincipal -UserId $APP_USER -LogonType S4U -RunLevel Limited
$set     = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
              -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName 'PROTECTHER-AutoStart' -Action $action -Trigger $trigger `
  -Principal $princ -Settings $set -Description 'Start PROTECTHER backend+frontend at boot (tunnel = cloudflared service)' | Out-Null
Write-Host "  registered (runs as $APP_USER at startup, whether logged on or not)." -ForegroundColor Green

# ---------------------------------------------------------------------------
# 3) Daily backup task -> backup-database.bat  (as SYSTEM, 02:00)
# ---------------------------------------------------------------------------
Write-Host "`n[3/4] PROTECTHER-Database-Backup task..." -ForegroundColor Cyan
Unregister-ScheduledTask -TaskName 'PROTECTHER-Database-Backup' -Confirm:$false -ErrorAction SilentlyContinue
$bAction  = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"$ROOT\backup-database.bat`"" -WorkingDirectory $ROOT
$bTrigger = New-ScheduledTaskTrigger -Daily -At '02:00'
$bPrinc   = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$bSet     = New-ScheduledTaskSettingsSet -StartWhenAvailable   # run after wake if PC was off at 02:00
Register-ScheduledTask -TaskName 'PROTECTHER-Database-Backup' -Action $bAction -Trigger $bTrigger `
  -Principal $bPrinc -Settings $bSet -Description 'Daily pg_dump of mahsr_safety (keeps 7 days)' | Out-Null
Write-Host "  registered (daily 02:00 as SYSTEM)." -ForegroundColor Green

# ---------------------------------------------------------------------------
# 4) Remove old login-only Startup shortcuts (boot task replaces them)
# ---------------------------------------------------------------------------
Write-Host "`n[4/4] Removing old Startup-folder shortcuts..." -ForegroundColor Cyan
$startup = [Environment]::GetFolderPath('Startup')
foreach ($n in 'PROTECTHER Audit.lnk','PROTECTHER-Startup.lnk') {
  $p = Join-Path $startup $n
  if (Test-Path $p) { Remove-Item $p -Force; Write-Host "  removed $n" } else { Write-Host "  (absent) $n" }
}

Write-Host "`n== Done. Reboot to verify the full stack comes up on its own. ==" -ForegroundColor Green
Write-Host "Quick checks after reboot:"
Write-Host "  Get-Service cloudflared ; Get-ScheduledTask PROTECTHER-AutoStart,PROTECTHER-Database-Backup"
Write-Host "  Get-Content $ROOT\logs\boot.log -Tail 6"
