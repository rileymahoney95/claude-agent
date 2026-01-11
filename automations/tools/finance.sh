#!/bin/bash
# Finance CLI wrapper script
# Usage: finance parse <statement.pdf> | finance history | finance summary

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$SCRIPT_DIR/finance/venv/bin/python" "$SCRIPT_DIR/finance/finance.py" "$@"
