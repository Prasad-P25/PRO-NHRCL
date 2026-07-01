<#
  restart-backend.ps1  -  RUN AS ADMINISTRATOR.

  Restarts ONLY the PROTECTHER backend (:5000) so it reloads backend\.env
  (e.g. after changing email/SMTP or other settings). The frontend (:3000) and
  the Cloudflare tunnel are left untouched.

  The running backend was launched by the boot task in session 0, so a normal
  (non-elevated) session can't stop it — hence admin is required.
#>
$BACKEND = 'C:\PROJECTS\PRO-NHRCL\backend'

$id = [Security.Principal.WindowsIdentity]::GetCurrent()
if (-not (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole(
      [Security.Principal.WindowsBuiltinRole]::Administrator)) {
  Write-Host "NOT elevated - open PowerShell as Administrator and re-run." -ForegroundColor Red; exit 1
}

Write-Host "Restarting PROTECTHER backend (:5000)..." -ForegroundColor Cyan

# Stop whatever is listening on :5000
$p = (Get-NetTCPConnection -State Listen -LocalPort 5000 -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess
if ($p) {
  Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
  Write-Host "  stopped old backend (pid $p)"
  Start-Sleep -Seconds 2
} else { Write-Host "  nothing was on :5000" }

# Start a fresh backend (loads the current backend\.env). Prebuilt dist, no rebuild.
Start-Process -FilePath 'cmd.exe' -ArgumentList '/c','node dist\index.js' -WorkingDirectory $BACKEND -WindowStyle Hidden
Write-Host "  started new backend"

# Wait for health
$ok = $false
for ($i = 0; $i -lt 15; $i++) {
  Start-Sleep -Seconds 2
  try { if ((Invoke-WebRequest -UseBasicParsing 'http://localhost:5000/health' -TimeoutSec 3).StatusCode -eq 200) { $ok = $true; break } } catch {}
}
if ($ok) {
  Write-Host "`nBackend is up and healthy on :5000 (new .env loaded)." -ForegroundColor Green
} else {
  Write-Host "`nBackend did not come up on :5000 within ~30s - check backend\logs." -ForegroundColor Yellow
}
