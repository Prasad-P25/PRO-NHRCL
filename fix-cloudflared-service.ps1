<#
  fix-cloudflared-service.ps1  -  RUN AS ADMINISTRATOR.

  Repairs the cloudflared Windows service when it was installed with no arguments
  (bare exe -> never runs the tunnel -> Cloudflare 530), and the bad process is
  stuck in "Stop Pending" so Stop-Service hangs.

  Safe: it force-kills ONLY the hung service process, starts the service with the
  correct command, and verifies the site serves 200 BEFORE stopping any manual
  fallback tunnel. If the service won't route, the fallback is left running.
#>
$CF      = 'C:\Users\IT\Downloads\cloudflared.exe'
$CF_CONF = 'C:\Users\IT\.cloudflared\config.yml'
$SVC     = 'Cloudflared'
$HEALTH  = 'https://api-audit.protecther.in/health'

$id = [Security.Principal.WindowsIdentity]::GetCurrent()
if (-not (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole(
      [Security.Principal.WindowsBuiltinRole]::Administrator)) {
  Write-Host "NOT elevated - open PowerShell as Administrator and re-run." -ForegroundColor Red; exit 1
}

Write-Host "== Repairing '$SVC' service ==" -ForegroundColor Cyan

# 1) Set the correct command line (works regardless of current state).
$binPath = "$CF --config $CF_CONF tunnel run"
Write-Host "Setting binPath: $binPath"
& sc.exe config $SVC binPath= $binPath | Out-Null

# 2) Force the service to STOPPED: ask nicely, then kill the hung process if needed.
& sc.exe stop $SVC | Out-Null
$stopped = $false
for ($i=0; $i -lt 8; $i++) {
  Start-Sleep -Seconds 2
  $s = Get-CimInstance Win32_Service -Filter "Name='$SVC'"
  if ($s.State -eq 'Stopped') { $stopped = $true; break }
  if ($s.ProcessId -and $s.ProcessId -ne 0) {
    Write-Host "  force-killing hung service process pid $($s.ProcessId)..."
    & taskkill /F /PID $s.ProcessId 2>&1 | Out-Null
  }
}
$s = Get-CimInstance Win32_Service -Filter "Name='$SVC'"
Write-Host "  service state now: $($s.State)"

# 3) Start the service with the corrected command.
Set-Service -Name $SVC -StartupType Automatic
& sc.exe start $SVC | Out-Null

# 4) Verify the SERVICE routes before stopping the fallback tunnel.
Write-Host "Verifying the service routes (up to ~30s)..."
$svcPid = (Get-CimInstance Win32_Service -Filter "Name='$SVC'").ProcessId
$routes = $false
for ($i=0; $i -lt 10; $i++) {
  Start-Sleep -Seconds 3
  try { if ((Invoke-WebRequest -UseBasicParsing $HEALTH -TimeoutSec 8).StatusCode -eq 200) { $routes = $true; break } } catch {}
}

if ($routes) {
  Write-Host "Service is routing 200. Stopping any manual fallback tunnel so the service owns the single tunnel..." -ForegroundColor Green
  $svcPid = (Get-CimInstance Win32_Service -Filter "Name='$SVC'").ProcessId
  Get-Process cloudflared -ErrorAction SilentlyContinue |
    Where-Object { $_.Id -ne $svcPid } | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 3
  try { $final = (Invoke-WebRequest -UseBasicParsing $HEALTH -TimeoutSec 10).StatusCode } catch { $final = "ERR $($_.Exception.Message)" }
  Write-Host "`nRESULT: service '$SVC' OK; site (service-only) -> $final" -ForegroundColor Green
} else {
  Write-Host "`nRESULT: WARN - service started but site not 200 yet. Left the fallback tunnel running so you're not down. Likely LocalSystem can't read the tunnel credentials/config. Tell Claude." -ForegroundColor Yellow
}
Write-Host "`nFinal cloudflared processes:"
Get-CimInstance Win32_Process -Filter "Name='cloudflared.exe'" | Select-Object ProcessId, CommandLine | Format-List
