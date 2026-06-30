<#
  setup-autostart.ps1  -  RUN ONCE, AS ADMINISTRATOR.

  Makes PROTECTHER survive an unattended reboot (e.g. power cut) with no one logged in:
    1. cloudflared -> Windows service (LocalSystem), so the tunnel is always up.
       (If this step can't complete, boot-start.bat starts the tunnel as a fallback.)
    2. "PROTECTHER-AutoStart" task -> runs boot-start.bat at startup as the IT account
       via S4U logon (runs whether logged on or not, NO stored password).
    3. "PROTECTHER-Database-Backup" task -> daily 02:00 backup as SYSTEM.
    4. Removes the old login-only Startup-folder shortcuts.

  Re-runnable. Logs everything to logs\setup-autostart.log and prints a verification
  summary at the end. One failing step does NOT abort the others.

  HOW TO RUN (the window title MUST say "Administrator"):
    Start menu -> type "PowerShell" -> right-click "Run as administrator" -> then:
      powershell -ExecutionPolicy Bypass -File C:\PROJECTS\PRO-NHRCL\setup-autostart.ps1
#>

$ROOT     = 'C:\PROJECTS\PRO-NHRCL'
$CF       = 'C:\Users\IT\Downloads\cloudflared.exe'
$CF_CONF  = 'C:\Users\IT\.cloudflared\config.yml'
$APP_USER = "$env:COMPUTERNAME\IT"

if (-not (Test-Path "$ROOT\logs")) { New-Item -ItemType Directory "$ROOT\logs" | Out-Null }
try { Start-Transcript -Path "$ROOT\logs\setup-autostart.log" -Append | Out-Null } catch {}

# --- Elevation check (loud, no stack trace) ---
$id = [Security.Principal.WindowsIdentity]::GetCurrent()
if (-not (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole(
      [Security.Principal.WindowsBuiltinRole]::Administrator)) {
  Write-Host ""
  Write-Host "  ##########################################################" -ForegroundColor Red
  Write-Host "  #  NOT RUNNING AS ADMINISTRATOR - nothing was changed.   #" -ForegroundColor Red
  Write-Host "  #  Close this window. Open PowerShell via right-click ->  #" -ForegroundColor Red
  Write-Host "  #  'Run as administrator' (title must say Administrator), #" -ForegroundColor Red
  Write-Host "  #  then re-run the same command.                          #" -ForegroundColor Red
  Write-Host "  ##########################################################" -ForegroundColor Red
  Write-Host ""
  try { Stop-Transcript | Out-Null } catch {}
  exit 1
}

Write-Host "== PROTECTHER auto-start setup (elevated OK) ==" -ForegroundColor Cyan
Write-Host "App account for boot task: $APP_USER"
$results = [ordered]@{}

# ---------------------------------------------------------------------------
# 1) cloudflared as a Windows service
# ---------------------------------------------------------------------------
Write-Host "`n[1/4] cloudflared service..." -ForegroundColor Cyan
try {
  $svc = Get-Service -Name 'cloudflared','Cloudflared' -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $svc) {
    Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    Write-Host "  installing service..."
    $out = & $CF service install 2>&1
    $out | ForEach-Object { Write-Host "    $_" }
    if ($LASTEXITCODE -ne 0) { throw "cloudflared service install exit $LASTEXITCODE" }
    Start-Sleep -Seconds 2
    $svc = Get-Service -Name 'cloudflared','Cloudflared' -ErrorAction SilentlyContinue | Select-Object -First 1
  }
  if (-not $svc) { throw "service not found after install" }

  # cloudflared's bare `service install` registers the exe with NO arguments, so the
  # service never runs our named tunnel (-> Cloudflare 530). Force the correct command
  # line: run the tunnel using the IT-profile config (neither path contains spaces, so
  # no inner quoting is needed). Stop first so the new binPath takes effect.
  $binPath = "$CF --config $CF_CONF tunnel run"
  Write-Host "  setting service command: $binPath"
  Stop-Service -Name $svc.Name -ErrorAction SilentlyContinue
  & sc.exe config $svc.Name binPath= $binPath | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "sc config binPath failed (exit $LASTEXITCODE)" }
  Set-Service -Name $svc.Name -StartupType Automatic
  Start-Service -Name $svc.Name

  # Verify the SERVICE actually routes before touching any fallback tunnel, so a bad
  # config can never take the site down here. Only once the service serves 200 do we
  # stop stray manual cloudflared instances so the service owns the single tunnel.
  $svcRoutes = $false
  for ($i=0; $i -lt 10; $i++) {
    Start-Sleep -Seconds 3
    try { if ((Invoke-WebRequest -UseBasicParsing 'https://api-audit.protecther.in/health' -TimeoutSec 8).StatusCode -eq 200) { $svcRoutes = $true; break } } catch {}
  }
  if ($svcRoutes) {
    $svcPid = (Get-CimInstance Win32_Service -Filter "Name='$($svc.Name)'").ProcessId
    Get-Process cloudflared -ErrorAction SilentlyContinue |
      Where-Object { $_.Id -ne $svcPid } | Stop-Process -Force -ErrorAction SilentlyContinue
    $results['cloudflared service'] = "OK ($($svc.Name) running and routing 200)"
  } else {
    $results['cloudflared service'] = "WARN: service started but site not 200 yet - left any fallback tunnel running; check creds/config access by LocalSystem"
  }
} catch {
  $results['cloudflared service'] = "FAILED: $($_.Exception.Message) - boot-start.bat will run the tunnel as a fallback"
}
Write-Host "  -> $($results['cloudflared service'])"

# ---------------------------------------------------------------------------
# 2) AtStartup task -> boot-start.bat  (S4U: no password, no login needed)
# ---------------------------------------------------------------------------
Write-Host "`n[2/4] PROTECTHER-AutoStart task..." -ForegroundColor Cyan
try {
  Unregister-ScheduledTask -TaskName 'PROTECTHER-AutoStart' -Confirm:$false -ErrorAction SilentlyContinue
  $action  = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"$ROOT\boot-start.bat`"" -WorkingDirectory $ROOT
  $trigger = New-ScheduledTaskTrigger -AtStartup
  $trigger.Delay = 'PT30S'
  $princ   = New-ScheduledTaskPrincipal -UserId $APP_USER -LogonType S4U -RunLevel Limited
  $set     = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
                -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
  Register-ScheduledTask -TaskName 'PROTECTHER-AutoStart' -Action $action -Trigger $trigger `
    -Principal $princ -Settings $set -Description 'Start PROTECTHER backend+frontend at boot' | Out-Null
  $results['PROTECTHER-AutoStart'] = "OK (runs as $APP_USER at startup, S4U)"
} catch { $results['PROTECTHER-AutoStart'] = "FAILED: $($_.Exception.Message)" }
Write-Host "  -> $($results['PROTECTHER-AutoStart'])"

# ---------------------------------------------------------------------------
# 3) Daily backup task -> backup-database.bat  (as SYSTEM, 02:00)
# ---------------------------------------------------------------------------
Write-Host "`n[3/4] PROTECTHER-Database-Backup task..." -ForegroundColor Cyan
try {
  Unregister-ScheduledTask -TaskName 'PROTECTHER-Database-Backup' -Confirm:$false -ErrorAction SilentlyContinue
  $bAction  = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"$ROOT\backup-database.bat`"" -WorkingDirectory $ROOT
  $bTrigger = New-ScheduledTaskTrigger -Daily -At '02:00'
  $bPrinc   = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
  $bSet     = New-ScheduledTaskSettingsSet -StartWhenAvailable
  Register-ScheduledTask -TaskName 'PROTECTHER-Database-Backup' -Action $bAction -Trigger $bTrigger `
    -Principal $bPrinc -Settings $bSet -Description 'Daily pg_dump of mahsr_safety (keeps 7 days)' | Out-Null
  $results['PROTECTHER-Database-Backup'] = "OK (daily 02:00 as SYSTEM)"
} catch { $results['PROTECTHER-Database-Backup'] = "FAILED: $($_.Exception.Message)" }
Write-Host "  -> $($results['PROTECTHER-Database-Backup'])"

# ---------------------------------------------------------------------------
# 4) Remove old login-only Startup shortcuts
# ---------------------------------------------------------------------------
Write-Host "`n[4/4] Removing old Startup-folder shortcuts..." -ForegroundColor Cyan
try {
  $startup = [Environment]::GetFolderPath('Startup')
  $removed = @()
  foreach ($n in 'PROTECTHER Audit.lnk','PROTECTHER-Startup.lnk') {
    $p = Join-Path $startup $n
    if (Test-Path $p) { Remove-Item $p -Force; $removed += $n }
  }
  $results['Old shortcuts'] = if ($removed) { "removed: $($removed -join ', ')" } else { "none present" }
} catch { $results['Old shortcuts'] = "FAILED: $($_.Exception.Message)" }
Write-Host "  -> $($results['Old shortcuts'])"

# ---------------------------------------------------------------------------
# Verification summary
# ---------------------------------------------------------------------------
Write-Host "`n================ VERIFICATION ================" -ForegroundColor Cyan
foreach ($k in $results.Keys) {
  $v = $results[$k]
  $color = if ($v -like 'FAILED*') { 'Red' } else { 'Green' }
  Write-Host ("  {0,-28} {1}" -f $k, $v) -ForegroundColor $color
}
Write-Host "`nLive state:" -ForegroundColor Cyan
Get-Service -Name 'cloudflared','Cloudflared' -ErrorAction SilentlyContinue | Format-Table Name,Status,StartType -AutoSize
Get-ScheduledTask -TaskName 'PROTECTHER-AutoStart','PROTECTHER-Database-Backup' -ErrorAction SilentlyContinue |
  Select-Object TaskName, State, @{n='RunAs';e={$_.Principal.UserId}} | Format-Table -AutoSize
Write-Host "Done. A reboot is the real test. Log: $ROOT\logs\setup-autostart.log" -ForegroundColor Green
try { Stop-Transcript | Out-Null } catch {}
