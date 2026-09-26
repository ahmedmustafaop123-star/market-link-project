#!/usr/bin/env bash
# MarketLink Agri-Hub Pakistan: local server (macOS / Linux)
#   bash start.sh           → built-in database, opens browser automatically
#   bash start.sh docker    → Docker + PostgreSQL
cd "$(dirname "$0")"

if [ "$1" = "docker" ]; then
  echo "Starting with Docker (PostgreSQL included) → http://localhost:3000"
  exec docker compose up --build
fi

command -v node >/dev/null || { echo "Node.js 20+ is required: https://nodejs.org"; exit 1; }
exec node scripts/serve.cjs "$@"
