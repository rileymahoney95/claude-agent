#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$SCRIPT_DIR/todos/venv/bin/python" "$SCRIPT_DIR/todos/todos.py" "$@"
