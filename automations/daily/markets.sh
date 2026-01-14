#!/bin/bash
# Markets wrapper script - passes all arguments to markets.py

SOURCE="${BASH_SOURCE[0]}"
while [ -L "$SOURCE" ]; do
  DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
  SOURCE="$(readlink "$SOURCE")"
  [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE"
done
SCRIPT_DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
"$SCRIPT_DIR/markets/venv/bin/python" "$SCRIPT_DIR/markets/markets.py" "$@"
