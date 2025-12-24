#!/bin/bash
# Markets wrapper script - passes all arguments to markets.py

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$SCRIPT_DIR/markets/venv/bin/python" "$SCRIPT_DIR/markets/markets.py" "$@"
