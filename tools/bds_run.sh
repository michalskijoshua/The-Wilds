#!/bin/bash
# Runs Bedrock Dedicated Server headless for scripted tests. Linux twin of bds_run.ps1.
# Console output goes to <server>/wilds_server.log. Commands are read from <server>/wilds_cmd.txt: append lines and they
# are sent to the server in order (each is echoed into the log as "> cmd"). "stop" shuts it down.
# Usage: tools/bds_run.sh <server> [max seconds, default 3600]      (blocks; run it with & or in another terminal)
SERVER=$(cd "${1:?usage: bds_run.sh <server> [seconds]}" && pwd); MAX=${2:-3600}
LOG="$SERVER/wilds_server.log"; CMD="$SERVER/wilds_cmd.txt"; FIFO="$SERVER/.wilds_stdin"
: > "$LOG"; : > "$CMD"; rm -f "$FIFO"; mkfifo "$FIFO"
cd "$SERVER"
LD_LIBRARY_PATH=. timeout "$MAX" ./bedrock_server < "$FIFO" >> "$LOG" 2>&1 &
SRV=$!
# feeder: holds the FIFO open and forwards new command lines
( exec > "$FIFO"
  tail -n +1 -f --pid=$SRV "$CMD" | while IFS= read -r line; do
    line=${line//$'\r'/}; [ -z "$line" ] && continue
    echo "> $line" >> "$LOG"; printf '%s\n' "$line"
  done ) &
FEED=$!
wait $SRV; code=$?
kill $FEED 2>/dev/null; pkill -P $FEED 2>/dev/null; wait $FEED 2>/dev/null
rm -f "$FIFO"
echo "[runner] server exited with code $code" >> "$LOG"
