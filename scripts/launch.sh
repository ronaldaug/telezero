#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Ports to check for conflicts (set PORT in .env to add more)
PORTS_IN_USE=()

check_port() {
  local port="$1"
  if [ -z "$port" ] || ! [[ "$port" =~ ^[0-9]+$ ]]; then return; fi
  if command -v lsof >/dev/null 2>&1; then
    if lsof -i ":$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
      PORTS_IN_USE+=("$port")
    fi
  fi
}

echo "=== TeleZero launch ==="
echo ""

# 1. Build
echo "Building..."
npm run build
echo ""

# 2. Optional port check (load .env if present)
if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$ROOT/.env" 2>/dev/null || true
  set +a
fi

# Check common ports and any PORT from .env
check_port 1337
check_port 3000
check_port 8080
check_port 5000
[ -n "${PORT:-}" ] && check_port "$PORT"


if [ ${#PORTS_IN_USE[@]} -gt 0 ]; then
  echo "Warning: the following ports appear to be in use:"
  for p in "${PORTS_IN_USE[@]}"; do
    echo "  - $p"
    if command -v lsof >/dev/null 2>&1; then
      lsof -i ":$p" -sTCP:LISTEN 2>/dev/null | tail -n +2 || true
    fi
  done
  echo ""
  if [ -t 0 ]; then
    read -r -p "Continue anyway? [y/N] " reply
    if [[ ! "$reply" =~ ^[yY] ]]; then
      echo "Aborted."
      exit 1
    fi
  else
    echo "Continuing (non-interactive)."
  fi
  echo ""
fi

# 3. Run app and dashboard concurrently
echo "Starting services..."
echo ""

# Trap to kill both processes on exit
cleanup() {
  echo ""
  echo "Shutting down services..."
  jobs -p | xargs -r kill 2>/dev/null
  exit
}
trap cleanup SIGINT SIGTERM EXIT

# Start main app in background
echo "  • Starting main app (Telegram bot + agent)..."
node dist/index.js &
MAIN_PID=$!

# Small delay to let main app initialize
sleep 1

# Start dashboard in background
echo "  • Starting dashboard on http://localhost:1337..."
npm run dashboard &
DASHBOARD_PID=$!

# Give services time to start
sleep 2

echo ""
echo "✅ All services started successfully"
echo ""
echo "  Main app PID: $MAIN_PID"
echo "  Dashboard PID: $DASHBOARD_PID"
echo "  Dashboard URL: http://localhost:1337"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for both processes
wait
