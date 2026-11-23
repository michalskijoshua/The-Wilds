# Installs The Wilds (and optionally Guilds+) into a Bedrock Dedicated Server test world.
# Usage: powershell -File tools\bds_install.ps1 -Server <bds folder> [-Guilds <folder holding GuildsPlus_*_BP and _RP>] [-World WildsTest] [-Fresh]
param([Parameter(Mandatory)] [string]$Server, [string]$Guilds = "", [string]$World = "WildsTest", [switch]$Fresh, [switch]$NoWilds)
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$wdir = Join-Path $Server "worlds\$World"
if ($Fresh -and (Test-Path $wdir)) { Remove-Item $wdir -Recurse -Force }
New-Item -ItemType Directory -Force $wdir | Out-Null
$bp = @(); $rp = @()
function Add-Pack([string]$src, [string]$kind) {
  $m = Get-Content "$src\manifest.json" -Raw | ConvertFrom-Json
  $dest = Join-Path $Server ("{0}\{1}" -f $(if ($kind -eq "bp") { "behavior_packs" } else { "resource_packs" }), (Split-Path $src -Leaf))
  if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
  Copy-Item $src $dest -Recurse
  return [pscustomobject]@{ pack_id = $m.header.uuid; version = @($m.header.version) }
}
if ($Guilds) {
  $bp += Add-Pack (Get-ChildItem $Guilds -Directory -Filter "*_BP")[0].FullName "bp"
  $rp += Add-Pack (Get-ChildItem $Guilds -Directory -Filter "*_RP")[0].FullName "rp"
}
if (-not $NoWilds) { $bp += Add-Pack "$root\TheWilds_BP" "bp"; $rp += Add-Pack "$root\TheWilds_RP" "rp" }
ConvertTo-Json @($bp) | Set-Content "$wdir\world_behavior_packs.json" -Encoding ascii
ConvertTo-Json @($rp) | Set-Content "$wdir\world_resource_packs.json" -Encoding ascii
$props = Get-Content "$Server\server.properties"
$set = @{ "level-name" = $World; "allow-cheats" = "true"; "content-log-console-output-enabled" = "true"; "content-log-file-enabled" = "true";
  "content-log-level" = "warning"; "difficulty" = "normal"; "gamemode" = "creative" }
$props = $props | ForEach-Object { $k = ($_ -split "=", 2)[0]; if ($set.ContainsKey($k)) { "$k=$($set[$k])" } else { $_ } }
$props | Set-Content "$Server\server.properties" -Encoding ascii
"Installed into $wdir (BP: $($bp.Count), RP: $($rp.Count))"
