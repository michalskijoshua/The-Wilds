#!/bin/bash
# Installs The Wilds (and optionally Guilds+) into a Bedrock Dedicated Server test world. Linux twin of bds_install.ps1.
# Usage: tools/bds_install.sh -s <bds folder> [-g <folder holding *_BP and *_RP, e.g. Guilds+ build/>] [-w WildsTest] [-f] [-n]
#   -f  fresh world (delete it first)    -n  no Wilds (baseline: Guilds+ alone)
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
SERVER=""; GUILDS=""; WORLD=WildsTest; FRESH=0; NOWILDS=0
while getopts "s:g:w:fn" o; do case $o in
  s) SERVER=$OPTARG;; g) GUILDS=$OPTARG;; w) WORLD=$OPTARG;; f) FRESH=1;; n) NOWILDS=1;;
  *) echo "usage: $0 -s <server> [-g <guilds folder>] [-w world] [-f] [-n]"; exit 2;; esac; done
[ -n "$SERVER" ] || { echo "missing -s <server>"; exit 2; }
WDIR="$SERVER/worlds/$WORLD"
[ $FRESH = 1 ] && rm -rf "$WDIR"
mkdir -p "$WDIR"
BP=(); RP=()
add_pack() {  # <src> <bp|rp> -> prints {"pack_id":..,"version":[..]}
  local src=${1%/} kind=$2 sub=behavior_packs
  [ "$kind" = rp ] && sub=resource_packs
  local dest="$SERVER/$sub/$(basename "$src")"
  rm -rf "$dest"; cp -r "$src" "$dest"
  python3 -I -c 'import json,sys; h=json.load(open(sys.argv[1]))["header"]; print(json.dumps({"pack_id":h["uuid"],"version":h["version"]}))' "$src/manifest.json"
}
first() { find "$1" -maxdepth 1 -mindepth 1 -type d -name "$2" | sort | head -1; }
if [ -n "$GUILDS" ]; then
  BP+=("$(add_pack "$(first "$GUILDS" '*BP')" bp)"); RP+=("$(add_pack "$(first "$GUILDS" '*RP')" rp)")
fi
if [ $NOWILDS = 0 ]; then
  BP+=("$(add_pack "$ROOT/TheWilds_BP" bp)"); RP+=("$(add_pack "$ROOT/TheWilds_RP" rp)")
fi
join() { local IFS=,; echo "[$*]"; }
join "${BP[@]}" > "$WDIR/world_behavior_packs.json"
join "${RP[@]}" > "$WDIR/world_resource_packs.json"
P="$SERVER/server.properties"
for kv in "level-name=$WORLD" allow-cheats=true content-log-console-output-enabled=true content-log-file-enabled=true \
          content-log-level=warning difficulty=normal gamemode=creative; do
  k=${kv%%=*}
  if grep -q "^$k=" "$P"; then sed -i "s|^$k=.*|$kv|" "$P"; else echo "$kv" >> "$P"; fi
done
echo "Installed into $WDIR (BP: ${#BP[@]}, RP: ${#RP[@]})"
