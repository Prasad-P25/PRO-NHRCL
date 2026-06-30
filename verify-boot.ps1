<# verify-boot.ps1 - run after a reboot to confirm the whole stack came up on its own. #>
Write-Host "==== PROTECTHER post-reboot verification ====" -ForegroundColor Cyan

Write-Host "`n[cloudflared service]" -ForegroundColor Cyan
Get-CimInstance Win32_Service -Filter "Name='cloudflared'" |
  Select-Object Name, State, StartMode, StartName, ProcessId | Format-List

Write-Host "[local ports]" -ForegroundColor Cyan
foreach ($p in 5000,3000) {
  $up = Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue
  "{0,-6} {1}" -f $p, $(if ($up) { 'LISTENING' } else { 'DOWN' })
}

Write-Host "`n[public endpoints]" -ForegroundColor Cyan
$u = @(
 @{n='prod API   '; u='https://api-audit.protecther.in/health'},
 @{n='prod FE    '; u='https://audit.protecther.in/'},
 @{n='staging API'; u='https://staging-api-audit.protecther.in/health'},
 @{n='staging FE '; u='https://staging-audit.protecther.in/'})
foreach ($x in $u) {
  try   { "{0} -> {1}" -f $x.n, (Invoke-WebRequest -UseBasicParsing $x.u -TimeoutSec 15).StatusCode }
  catch { "{0} -> ERR {1}" -f $x.n, $_.Exception.Message }
}

Write-Host "`n[scheduled tasks]" -ForegroundColor Cyan
'PROTECTHER-AutoStart','PROTECTHER-Database-Backup' | ForEach-Object {
  $t = Get-ScheduledTask -TaskName $_ -ErrorAction SilentlyContinue
  if ($t) { $i = $t | Get-ScheduledTaskInfo; "  {0} : {1}  last=0x{2:X}" -f $_, $t.State, $i.LastTaskResult }
  else    { "  $_ : (not visible from non-admin - check registry)" }
}

Write-Host "`n[boot.log tail]" -ForegroundColor Cyan
if (Test-Path C:\PROJECTS\PRO-NHRCL\logs\boot.log) { Get-Content C:\PROJECTS\PRO-NHRCL\logs\boot.log -Tail 7 }
Write-Host "`nIf all four endpoints are 200, the unattended boot worked." -ForegroundColor Green
