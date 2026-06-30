<#
  set-backup-account.ps1  -  RUN AS ADMINISTRATOR.

  Re-registers the daily PROTECTHER-Database-Backup task to run as the IT user
  (instead of SYSTEM) so it has network access to copy backups to the NAS.
  SYSTEM reaches the network as the MACHINE account, which the NAS share doesn't
  permit - so the off-site copy only works under a real user identity.

  You'll be prompted for the IT account's Windows password ONCE. Windows stores it
  encrypted (LSA secret); it is not written to disk by this script. After
  registering, it triggers the task once and checks that a new file lands on the NAS.
#>
$ROOT = 'C:\PROJECTS\PRO-NHRCL'
$NAS  = '\\PLLP_NAS\Protecther\IT\PROTECTHER-Audit-Backups'
$USER = "$env:COMPUTERNAME\IT"
$TASK = 'PROTECTHER-Database-Backup'

$id = [Security.Principal.WindowsIdentity]::GetCurrent()
if (-not (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole(
      [Security.Principal.WindowsBuiltinRole]::Administrator)) {
  Write-Host "NOT elevated - open PowerShell as Administrator and re-run." -ForegroundColor Red; exit 1
}

Write-Host "Re-registering '$TASK' to run as $USER (for NAS access)." -ForegroundColor Cyan
$sec = Read-Host "Enter the Windows password for $USER" -AsSecureString
$pw  = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
         [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))

$action  = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"$ROOT\backup-database.bat`"" -WorkingDirectory $ROOT
$trigger = New-ScheduledTaskTrigger -Daily -At '02:00'
$set     = New-ScheduledTaskSettingsSet -StartWhenAvailable

try {
  Unregister-ScheduledTask -TaskName $TASK -Confirm:$false -ErrorAction SilentlyContinue
  Register-ScheduledTask -TaskName $TASK -Action $action -Trigger $trigger -Settings $set `
    -User $USER -Password $pw -RunLevel Limited `
    -Description 'Daily pg_dump of mahsr_safety (keeps 7 days local, 30 on NAS) - runs as IT for NAS access' | Out-Null
  Write-Host "Registered. Triggering a test run..." -ForegroundColor Green
} catch {
  Write-Host "Register failed: $($_.Exception.Message)" -ForegroundColor Red; exit 1
}

# Test: run it now and confirm a fresh dump lands on the NAS.
$before = (Get-ChildItem $NAS -Filter '*.dump' -ErrorAction SilentlyContinue | Measure-Object).Count
Start-ScheduledTask -TaskName $TASK
Start-Sleep -Seconds 15
$info  = Get-ScheduledTask -TaskName $TASK | Get-ScheduledTaskInfo
$after = Get-ChildItem $NAS -Filter '*.dump' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime

Write-Host ("`nTask LastResult: 0x{0:X}" -f $info.LastTaskResult)
Write-Host "Newest NAS files:"
$after | Select-Object -Last 3 Name, LastWriteTime | Format-Table -AutoSize
if (($after | Measure-Object).Count -gt $before) {
  Write-Host "SUCCESS: a new backup reached the NAS - the daily 02:00 backup is now off-site." -ForegroundColor Green
} else {
  Write-Host "WARN: no new NAS file. If LastResult is 0x8007052E the password was wrong - re-run. Otherwise tell Claude." -ForegroundColor Yellow
}
