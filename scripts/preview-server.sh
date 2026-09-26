#!/usr/bin/env bash
# Keeps the production server alive for the cloud live preview.
#   bash scripts/preview-server.sh [port]
# Restarts the server automatically if it ever exits (crash, OOM, sandbox resume),
# so the preview URL never stays dead with a 502 longer than one restart.
set -u
PORT="${1:-3000}"
cd "$(dirname "$0")/.."

for attempt in $(seq 1 200); do
  echo "[preview] starting MarketLink on 0.0.0.0:${PORT} (attempt ${attempt}) $(date -u +%H:%M:%S)"
  npx next start -p "$PORT" -H 0.0.0.0
  code=$?
  echo "[preview] server exited with code ${code}; restarting in 2s"
  sleep 2
done
