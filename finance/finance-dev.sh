#!/bin/bash
# Finance development environment startup script
# Starts API server and web app (SQLite database is auto-managed)
# Usage: finance-dev [--stop] [--restart] [--status] [--quiet]

set -e

# Global flags
QUIET=false

SOURCE="${BASH_SOURCE[0]}"
while [ -L "$SOURCE" ]; do
  DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
  SOURCE="$(readlink "$SOURCE")"
  [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE"
done
SCRIPT_DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

# Ports
API_PORT=8000
WEB_PORT=3000

# PID file location
PID_DIR="$SCRIPT_DIR/.pids"

# Database location
DB_PATH="$SCRIPT_DIR/.data/finance.db"

log_info() { echo -e "${GREEN}✓${NC} $1"; }
log_warn() { echo -e "${YELLOW}⚠${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }

# Check if a port has a LISTENING process (not just connections)
is_port_in_use() {
  lsof -iTCP:"$1" -sTCP:LISTEN -t >/dev/null 2>&1
}

# Get PIDs listening on a port
get_listening_pids() {
  lsof -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null
}

# Kill process and all its children
kill_process_tree() {
  local pid=$1
  # Kill child processes first
  pkill -P "$pid" 2>/dev/null || true
  # Then kill the main process
  kill -9 "$pid" 2>/dev/null || true
}

# Status check
status() {
  echo "Finance Dev Environment Status"
  echo "==============================="

  if [ -f "$DB_PATH" ]; then
    local db_size=$(du -h "$DB_PATH" | cut -f1)
    log_info "Database: SQLite ($db_size)"
  else
    log_warn "Database: Not initialized (will be created on first use)"
  fi

  if is_port_in_use $API_PORT; then
    log_info "API Server: Running on port $API_PORT"
  else
    log_warn "API Server: Not running"
  fi

  if is_port_in_use $WEB_PORT; then
    log_info "Web App: Running on port $WEB_PORT"
  else
    log_warn "Web App: Not running"
  fi
}

# Stop all services
stop() {
  echo "Stopping Finance Dev Environment..."

  # Stop web app (Next.js on port 3000)
  local web_pids=$(get_listening_pids $WEB_PORT)
  if [ -n "$web_pids" ]; then
    log_info "Stopping web app..."
    for pid in $web_pids; do
      kill_process_tree "$pid"
    done
  fi

  # Also check saved PID
  if [ -f "$PID_DIR/web.pid" ]; then
    local saved_pid=$(cat "$PID_DIR/web.pid")
    kill_process_tree "$saved_pid"
    rm -f "$PID_DIR/web.pid"
  fi

  # Stop API server
  local api_pids=$(get_listening_pids $API_PORT)
  if [ -n "$api_pids" ]; then
    log_info "Stopping API server..."
    for pid in $api_pids; do
      kill_process_tree "$pid"
    done
  fi

  # Also check saved PID
  if [ -f "$PID_DIR/api.pid" ]; then
    local saved_pid=$(cat "$PID_DIR/api.pid")
    kill_process_tree "$saved_pid"
    rm -f "$PID_DIR/api.pid"
  fi

  # Clean up PID directory
  rm -rf "$PID_DIR" 2>/dev/null || true

  log_info "All services stopped"
}

# Start all services
start() {
  echo "Starting Finance Dev Environment..."
  echo ""

  # Create log and PID directories
  mkdir -p "$SCRIPT_DIR/.logs"
  mkdir -p "$PID_DIR"

  # 1. Start API server
  if is_port_in_use $API_PORT; then
    log_info "API server already running on port $API_PORT"
  else
    log_info "Starting API server (port $API_PORT)..."
    cd "$SCRIPT_DIR/api"
    "$SCRIPT_DIR/venv/bin/uvicorn" main:app \
      --host 0.0.0.0 --port $API_PORT --reload > "$SCRIPT_DIR/.logs/api.log" 2>&1 &
    echo $! > "$PID_DIR/api.pid"

    # Wait for API to be ready
    echo -n "   Waiting for API..."
    for i in {1..15}; do
      if curl -s "http://localhost:$API_PORT/health" >/dev/null 2>&1 || is_port_in_use $API_PORT; then
        echo " ready!"
        break
      fi
      echo -n "."
      sleep 1
    done
  fi

  # 2. Start web app
  if is_port_in_use $WEB_PORT; then
    log_info "Web app already running on port $WEB_PORT"
  else
    log_info "Starting web app (port $WEB_PORT)..."
    cd "$SCRIPT_DIR/web"
    npm run dev > "$SCRIPT_DIR/.logs/web.log" 2>&1 &
    echo $! > "$PID_DIR/web.pid"

    # Wait for web app to be ready
    echo -n "   Waiting for web app..."
    for i in {1..20}; do
      if is_port_in_use $WEB_PORT; then
        echo " ready!"
        break
      fi
      echo -n "."
      sleep 1
    done
  fi

  echo ""
  echo "==============================="
  log_info "Finance Dev Environment Ready!"
  echo ""
  echo "  📊 Web App:    http://localhost:$WEB_PORT"
  echo "  🔌 API:        http://localhost:$API_PORT"
  echo "  📚 API Docs:   http://localhost:$API_PORT/docs"
  echo "  🗄️  Database:   SQLite at .data/finance.db"
  echo ""
  echo "  📋 Logs:       finance-dev --logs"
  echo "  🛑 Stop:       finance-dev --stop"

  # If not quiet, tail the logs
  if [ "$QUIET" = false ]; then
    echo ""
    echo "Tailing logs (Ctrl+C to detach, services keep running)..."
    echo "==============================="
    tail -f "$SCRIPT_DIR/.logs/api.log" "$SCRIPT_DIR/.logs/web.log"
  fi
}

# Tail logs
logs() {
  if [ ! -d "$SCRIPT_DIR/.logs" ]; then
    log_error "No logs found. Start services first with 'finance-dev'"
    exit 1
  fi

  echo "Tailing logs (Ctrl+C to stop)..."
  echo "==============================="
  tail -f "$SCRIPT_DIR/.logs/api.log" "$SCRIPT_DIR/.logs/web.log"
}

# Parse arguments
case "${1:-}" in
  --stop|-s)
    stop
    ;;
  --restart|-r)
    stop
    echo ""
    start
    ;;
  --status)
    status
    ;;
  --logs|-l)
    logs
    ;;
  --quiet|-q)
    QUIET=true
    start
    ;;
  --help|-h)
    echo "Usage: finance-dev [--stop] [--restart] [--status] [--logs] [--quiet]"
    echo ""
    echo "Options:"
    echo "  (no args)     Start all services and tail logs"
    echo "  --quiet, -q   Start all services without tailing logs"
    echo "  --logs, -l    Tail logs from running services"
    echo "  --stop, -s    Stop all services"
    echo "  --restart, -r Stop then start all services"
    echo "  --status      Show status of all services"
    echo "  --help, -h    Show this help"
    echo ""
    echo "Database: Uses SQLite at .data/finance.db (no Docker required)"
    ;;
  "")
    start
    ;;
  *)
    echo "Unknown option: $1"
    echo "Run 'finance-dev --help' for usage"
    exit 1
    ;;
esac
