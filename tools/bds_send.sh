#!/bin/bash
# Sends console commands to a server started with bds_run.sh, waits, and prints the new log lines (filtered).
# Linux twin of bds_send.ps1.  Usage: tools/bds_send.sh <server> <wait seconds> "cmd one" "cmd two" ...
#   FILTER=<regex> overrides the default filter; FILTER=. shows everything.
SERVER=${1:?usage: bds_send.sh <server> <wait> cmd...}; WAIT=${2:-3}; shift 2
LOG="$SERVER/wilds_server.log"; CMD="$SERVER/wilds_cmd.txt"
FILTER=${FILTER:-'wilds-test|wilds\]|ERROR|Scripting|ironhome|guilds|Unknown|Syntax|summon|tickingarea|located|nearest|Teleported|Set the|Game rule|Changed|Filled|Added|Server started'}
start=$(wc -l < "$LOG")
for c in "$@"; do printf '%s\n' "$c" >> "$CMD"; done
sleep "$WAIT"
tail -n +"$((start + 1))" "$LOG" | grep -E -- "$FILTER|^> " | cut -c1-400
