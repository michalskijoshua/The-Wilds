# P0-1 static check: does The Wilds share any identifier or UUID with another pack set (Guilds+)?
# Usage: powershell -File tools\check_collisions.ps1 -Other "<folder with the other packs' BP and RP>"
param([Parameter(Mandatory)] [string]$Other, [string]$Wilds = "")
if (-not $Wilds) { $Wilds = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path) }

function Get-Ids([string]$root) {
  $ids = @{}
  $add = { param($kind, $v, $f) if ($v) { $k = "$kind|$v"; if (-not $ids.ContainsKey($k)) { $ids[$k] = $f } } }
  Get-ChildItem $root -Recurse -Include *.json -File | ForEach-Object {
    $f = $_.FullName; $t = Get-Content $f -Raw
    foreach ($m in [regex]::Matches($t, '"identifier"\s*:\s*"([^"]+)"')) { & $add "identifier" $m.Groups[1].Value $f }
    foreach ($m in [regex]::Matches($t, '"uuid"\s*:\s*"([0-9a-fA-F-]{36})"')) { & $add "uuid" $m.Groups[1].Value.ToLower() $f }
    foreach ($m in [regex]::Matches($t, '"((?:animation|controller\.animation|controller\.render)\.[^"]+)"\s*:\s*\{')) { & $add "anim/rc" $m.Groups[1].Value $f }
    if ($_.Name -eq 'item_texture.json' -or $_.Name -eq 'terrain_texture.json') {
      try { (Get-Content $f -Raw | ConvertFrom-Json).texture_data.PSObject.Properties.Name | ForEach-Object { & $add "texture_key" $_ $f } } catch { }
    }
  }
  $ids
}
$a = Get-Ids $Wilds; $b = Get-Ids $Other
$hits = $a.Keys | Where-Object { $b.ContainsKey($_) }
$prefix = $a.Keys | Where-Object { $_ -like 'identifier|*' -and $_ -notlike 'identifier|wilds:*' -and $_ -notlike 'identifier|geometry.*' }
"Wilds ids: $($a.Count)   other ids: $($b.Count)"
if ($prefix) { "Wilds identifiers without the wilds: prefix:"; $prefix } else { "All Wilds identifiers use wilds: (geometry ids excepted)." }
if ($hits) { "COLLISIONS:"; $hits | ForEach-Object { "  $_   wilds: $($a[$_])   other: $($b[$_])" }; exit 1 } else { "No collisions." }
