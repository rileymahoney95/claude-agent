#!/bin/bash
# Finance API server wrapper script
# Usage: finance-api [--reload] [--port PORT] [--db]
#
# Options:
#   --reload    Enable auto-reload for development
#   --port      Port to run on (default: 8000)
#   --db        Enable PostgreSQL database (default: JSON files)

SOURCE="${BASH_SOURCE[0]}"
while [ -L "$SOURCE" ]; do
  DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
  SOURCE="$(readlink "$SOURCE")"
  [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE"
done
SCRIPT_DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"

# Default options
PORT=8000
RELOAD=""
export FINANCE_USE_DATABASE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --reload)
      RELOAD="--reload"
      shift
      ;;
    --port)
      PORT="$2"
      shift 2
      ;;
    --db)
      export FINANCE_USE_DATABASE=true
      shift
      ;;
    -h|--help)
      echo "Usage: finance-api [--reload] [--port PORT] [--db]"
      echo ""
      echo "Options:"
      echo "  --reload    Enable auto-reload for development"
      echo "  --port      Port to run on (default: 8000)"
      echo "  --db        Enable PostgreSQL database (default: JSON files)"
      echo ""
      echo "Examples:"
      echo "  finance-api                  # Start on port 8000 (JSON mode)"
      echo "  finance-api --reload         # Start with auto-reload"
      echo "  finance-api --db             # Start with PostgreSQL backend"
      echo "  finance-api --port 3001      # Start on port 3001"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: finance-api [--reload] [--port PORT] [--db]"
      exit 1
      ;;
  esac
done

cd "$SCRIPT_DIR/api"
exec "$SCRIPT_DIR/venv/bin/uvicorn" main:app --host 0.0.0.0 --port "$PORT" $RELOAD
