# Builds dist\TheWilds_v<version>.mcaddon from TheWilds_BP and TheWilds_RP (version read from the BP manifest).
# Writes zip entries with forward slashes: Compress-Archive in Windows PowerShell 5.1 uses backslashes, which
# Android and Switch can fail to import.
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$ver = ((Get-Content "$root\TheWilds_BP\manifest.json" -Raw | ConvertFrom-Json).header.version) -join "."
$dist = "$root\dist"; New-Item -ItemType Directory -Force $dist | Out-Null
$out = "$dist\TheWilds_v$ver.mcaddon"; Remove-Item $out -ErrorAction SilentlyContinue
$zip = [System.IO.Compression.ZipFile]::Open($out, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($pack in "TheWilds_BP", "TheWilds_RP") {
    Get-ChildItem "$root\$pack" -Recurse -File | ForEach-Object {
      $entry = $pack + "/" + $_.FullName.Substring("$root\$pack\".Length).Replace("\", "/")
      [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $entry, [System.IO.Compression.CompressionLevel]::Optimal)
    }
  }
} finally { $zip.Dispose() }
"Built $out ($([math]::Round((Get-Item $out).Length / 1KB)) KB)"
