#!/bin/bash
# Finance CLI wrapper script
# Usage: finance parse <statement.pdf> | finance history | finance summary | finance advise

SOURCE="${BASH_SOURCE[0]}"
while [ -L "$SOURCE" ]; do
  DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
  SOURCE="$(readlink "$SOURCE")"
  [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE"
done
SCRIPT_DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
"$SCRIPT_DIR/venv/bin/python" "$SCRIPT_DIR/cli/finance.py" "$@"
