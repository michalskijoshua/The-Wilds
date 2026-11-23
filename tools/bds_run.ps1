# Runs Bedrock Dedicated Server headless for scripted tests.
# Console output goes to <Server>\wilds_server.log. Commands are read from <Server>\wilds_cmd.txt: append lines and they
# are sent to the server in order. "stop" shuts it down.
param([Parameter(Mandatory)] [string]$Server)
$log = Join-Path $Server "wilds_server.log"; $cmd = Join-Path $Server "wilds_cmd.txt"
Set-Content $log "" -Encoding ascii; Set-Content $cmd "" -Encoding ascii
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = Join-Path $Server "bedrock_server.exe"; $psi.WorkingDirectory = $Server
$psi.UseShellExecute = $false; $psi.RedirectStandardInput = $true; $psi.RedirectStandardOutput = $true; $psi.RedirectStandardError = $true
$psi.CreateNoWindow = $true
$p = New-Object System.Diagnostics.Process; $p.StartInfo = $psi
$writer = [IO.StreamWriter]::new($log, $true, [Text.Encoding]::UTF8); $writer.AutoFlush = $true
$sync = [hashtable]::Synchronized(@{ w = $writer })
$h = { if ($EventArgs.Data -ne $null) { $Event.MessageData.w.WriteLine($EventArgs.Data) } }
Register-ObjectEvent $p OutputDataReceived -Action $h -MessageData $sync | Out-Null
Register-ObjectEvent $p ErrorDataReceived -Action $h -MessageData $sync | Out-Null
[void]$p.Start(); $p.BeginOutputReadLine(); $p.BeginErrorReadLine()
# .NET Framework already sent a UTF-8 BOM down stdin when the process started; a blank first line absorbs it.
$in = New-Object IO.StreamWriter($p.StandardInput.BaseStream, (New-Object Text.UTF8Encoding $false)); $in.AutoFlush = $true
$in.WriteLine("")
$sent = 0
while (-not $p.HasExited) {
  Start-Sleep -Milliseconds 300
  $lines = @(Get-Content $cmd -ErrorAction SilentlyContinue | ForEach-Object { $_.Trim([char]0xFEFF, ' ') } | Where-Object { $_ -ne "" })
  while ($sent -lt $lines.Count) { $in.WriteLine($lines[$sent]); $writer.WriteLine("> " + $lines[$sent]); $sent++ }
}
Start-Sleep -Milliseconds 500
$writer.WriteLine("[runner] server exited with code $($p.ExitCode)"); $writer.Close()
