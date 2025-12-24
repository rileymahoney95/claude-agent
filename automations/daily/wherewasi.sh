#!/bin/bash
# WherewasI wrapper script - passes all arguments to wherewasi.js

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "$SCRIPT_DIR/wherewasi/wherewasi.js" "$@"
