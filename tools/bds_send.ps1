# Sends console commands to a server started with bds_run.ps1, waits, and prints the new log lines (filtered).
# Usage: powershell -File tools\bds_send.ps1 -Server <bds folder> -Wait 5 "cmd one" "cmd two"
[CmdletBinding(PositionalBinding = $false)]
param([Parameter(Mandatory)] [string]$Server, [int]$Wait = 3, [string]$Filter = "wilds-test|wilds\]|ERROR|Scripting|ironhome|Unknown|Syntax|summon|tickingarea|located|nearest|Teleported|Set the|Game rule|Changed|Filled|Added|Server started", [Parameter(ValueFromRemainingArguments)] [string[]]$Commands)
$log = Join-Path $Server "wilds_server.log"; $cmd = Join-Path $Server "wilds_cmd.txt"
$start = (Get-Content $log).Count
foreach ($c in $Commands) { Add-Content $cmd $c -Encoding ascii }
Start-Sleep -Seconds $Wait
Get-Content $log | Select-Object -Skip $start | Where-Object { $_ -match $Filter -or $_ -like "> *" } |
  ForEach-Object { if ($_.Length -gt 400) { $_.Substring(0, 400) + "..." } else { $_ } }
