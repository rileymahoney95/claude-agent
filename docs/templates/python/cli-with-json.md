# Python CLI Template with JSON Output

A minimal template for building Python CLI tools with dual output modes (human-readable and JSON).

## Minimal Template

```python
#!/usr/bin/env python3
"""
MyTool - Description of what this tool does.

Usage:
    mytool list
    mytool add "item text"
    mytool --json list
"""

import argparse
import json
import sys
from pathlib import Path

# Configuration
DATA_FILE = Path.home() / ".local/share/mytool/data.json"

# =============================================================================
# Data Access
# =============================================================================

def load_data() -> dict:
    """Load data from JSON file."""
    if not DATA_FILE.exists():
        return {"items": []}

    try:
        return json.loads(DATA_FILE.read_text())
    except json.JSONDecodeError:
        return {"items": []}


def save_data(data: dict) -> None:
    """Save data to JSON file."""
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(json.dumps(data, indent=2))


# =============================================================================
# Business Logic
# =============================================================================

def get_items() -> dict:
    """Get all items. Returns result dict."""
    data = load_data()
    return {
        "success": True,
        "items": data["items"],
        "count": len(data["items"])
    }


def add_item(text: str) -> dict:
    """Add a new item. Returns result dict."""
    if not text.strip():
        return {"success": False, "error": "Text cannot be empty"}

    data = load_data()
    item = {
        "id": len(data["items"]) + 1,
        "text": text.strip()
    }
    data["items"].append(item)
    save_data(data)

    return {"success": True, "item": item}


# =============================================================================
# Output Formatting
# =============================================================================

def print_error(message: str, use_json: bool = False):
    """Print error message."""
    if use_json:
        print(json.dumps({"success": False, "error": message}))
    else:
        print(f"Error: {message}", file=sys.stderr)


def print_success(message: str, use_json: bool = False, data: dict = None):
    """Print success message."""
    if use_json:
        print(json.dumps({"success": True, **(data or {})}))
    else:
        print(message)


def print_items(items: list[dict], use_json: bool = False):
    """Print list of items."""
    if use_json:
        print(json.dumps({
            "success": True,
            "items": items,
            "count": len(items)
        }))
    else:
        if not items:
            print("No items found.")
        else:
            print(f"\nFound {len(items)} items:")
            for item in items:
                print(f"  [{item['id']}] {item['text']}")
            print()


# =============================================================================
# CLI
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="MyTool - Tool description",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    # Global flags
    parser.add_argument("--json", action="store_true", help="Output as JSON")

    # Subcommands
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # list command
    list_parser = subparsers.add_parser("list", help="List all items")

    # add command
    add_parser = subparsers.add_parser("add", help="Add a new item")
    add_parser.add_argument("text", help="Item text")

    args = parser.parse_args()
    use_json = args.json

    # Default to list if no command
    if args.command is None:
        args.command = "list"

    # Execute command
    try:
        if args.command == "list":
            result = get_items()
            if result["success"]:
                print_items(result["items"], use_json=use_json)
            else:
                print_error(result["error"], use_json=use_json)
                sys.exit(1)

        elif args.command == "add":
            result = add_item(args.text)
            if result["success"]:
                print_success(
                    f"Added: {result['item']['text']}",
                    use_json=use_json,
                    data={"item": result["item"]}
                )
            else:
                print_error(result["error"], use_json=use_json)
                sys.exit(1)

    except KeyboardInterrupt:
        print("\nCancelled.")
        sys.exit(130)
    except Exception as e:
        print_error(str(e), use_json=use_json)
        sys.exit(1)


if __name__ == "__main__":
    main()
```

## With Colors (Colorama)

```python
#!/usr/bin/env python3
import argparse
import json
import sys
from pathlib import Path
from colorama import Fore, Style, init as colorama_init

# Initialize colorama
colorama_init()

DATA_FILE = Path.home() / ".local/share/mytool/data.json"

# ... data access functions ...

def print_error(message: str, use_json: bool = False):
    """Print error message."""
    if use_json:
        print(json.dumps({"success": False, "error": message}))
    else:
        print(f"{Fore.RED}Error: {message}{Style.RESET_ALL}", file=sys.stderr)


def print_success(message: str, use_json: bool = False, data: dict = None):
    """Print success message."""
    if use_json:
        print(json.dumps({"success": True, **(data or {})}))
    else:
        print(f"{Fore.GREEN}{message}{Style.RESET_ALL}")


def print_items(items: list[dict], use_json: bool = False):
    """Print list of items."""
    if use_json:
        print(json.dumps({"success": True, "items": items, "count": len(items)}))
    else:
        print(f"\n{Fore.CYAN}Items ({len(items)} total):{Style.RESET_ALL}")
        for item in items:
            print(f"  {Fore.YELLOW}[{item['id']}]{Style.RESET_ALL} {item['text']}")
        print()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--no-color", action="store_true", help="Disable colors")

    # ... rest of setup ...

    args = parser.parse_args()

    # Disable colors if requested
    if args.no_color:
        colorama_init(strip=True, convert=False)

    # ... command execution ...
```

## With Validation

```python
# Constants
MAX_TEXT_LENGTH = 500

def validate_text(text: str) -> str | None:
    """Validate text. Returns error message or None if valid."""
    text = text.strip()
    if not text:
        return "Text cannot be empty"
    if len(text) > MAX_TEXT_LENGTH:
        return f"Text exceeds {MAX_TEXT_LENGTH} characters"
    return None


def add_item(text: str) -> dict:
    """Add item with validation."""
    # Validate
    if err := validate_text(text):
        return {"success": False, "error": err}

    # Add item
    data = load_data()
    item = {"id": generate_id(), "text": text.strip()}
    data["items"].append(item)
    save_data(data)

    return {"success": True, "item": item}
```

## With File Locking

```python
import fcntl
import shutil

LOCK_FILE = DATA_FILE.with_suffix(".lock")

def save_data(data: dict) -> None:
    """Save data with file locking and atomic write."""
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    LOCK_FILE.touch()

    with open(LOCK_FILE, "w") as lock_file:
        fcntl.flock(lock_file, fcntl.LOCK_EX)
        try:
            # Backup existing file
            if DATA_FILE.exists():
                shutil.copy(DATA_FILE, DATA_FILE.with_suffix(".json.bak"))

            # Atomic write
            temp_file = DATA_FILE.with_suffix(".json.tmp")
            temp_file.write_text(json.dumps(data, indent=2))
            temp_file.rename(DATA_FILE)
        finally:
            fcntl.flock(lock_file, fcntl.LOCK_UN)
```

## With Filters

```python
def get_items(status: str = None, limit: int = None) -> dict:
    """Get items with optional filters."""
    data = load_data()
    items = data["items"]

    # Filter by status
    if status:
        items = [i for i in items if i.get("status") == status]

    # Limit results
    if limit:
        items = items[:limit]

    return {
        "success": True,
        "items": items,
        "count": len(items)
    }


# In CLI
list_parser = subparsers.add_parser("list", help="List items")
list_parser.add_argument("--status", help="Filter by status")
list_parser.add_argument("--limit", type=int, help="Max items to show")

# In main()
if args.command == "list":
    result = get_items(status=args.status, limit=args.limit)
    # ...
```

## Project Structure

```
mytool/
├── mytool.py           # Main script
├── requirements.txt    # Dependencies
└── venv/              # Virtual environment

# If more complex:
mytool/
├── mytool.py          # CLI entry point
├── core.py            # Business logic
├── data.py            # Data access
├── output.py          # Formatting
├── requirements.txt
└── venv/
```

## Requirements File

**Minimal:**
```txt
# requirements.txt
```

**With colors:**
```txt
# requirements.txt
colorama>=0.4.6
```

**With date parsing:**
```txt
# requirements.txt
colorama>=0.4.6
python-dateutil>=2.8.2
```

## Setup Instructions

```bash
# Create virtual environment
cd mytool
python3 -m venv venv

# Activate and install dependencies
source venv/bin/activate
pip install -r requirements.txt

# Make script executable
chmod +x mytool.py

# Test
./mytool.py list
./mytool.py --json list
```

## Wrapper Script

Create `mytool.sh` for easy invocation:

```bash
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$SCRIPT_DIR/venv/bin/python" "$SCRIPT_DIR/mytool.py" "$@"
```

```bash
chmod +x mytool.sh

# Now run from anywhere:
./mytool.sh list
./mytool.sh --json add "test"
```

## Usage Examples

**Human-readable output:**
```bash
$ mytool list
Items (3 total):
  [1] First item
  [2] Second item
  [3] Third item

$ mytool add "New item"
Added: New item
```

**JSON output:**
```bash
$ mytool --json list
{"success": true, "items": [...], "count": 3}

$ mytool --json add "New item"
{"success": true, "item": {"id": 4, "text": "New item"}}
```

**Error handling:**
```bash
$ mytool add ""
Error: Text cannot be empty

$ mytool --json add ""
{"success": false, "error": "Text cannot be empty"}
```

## Testing

```python
# test_mytool.py
import json
import subprocess

def run_cli(*args):
    """Helper to run CLI and parse JSON output."""
    result = subprocess.run(
        ["./mytool.sh", "--json", *args],
        capture_output=True,
        text=True
    )
    return json.loads(result.stdout)

def test_add():
    result = run_cli("add", "Test item")
    assert result["success"] == True
    assert result["item"]["text"] == "Test item"

def test_list():
    result = run_cli("list")
    assert result["success"] == True
    assert "items" in result
    assert "count" in result

def test_invalid_input():
    result = run_cli("add", "")
    assert result["success"] == False
    assert "error" in result
```

## Checklist

- [ ] Script has shebang (`#!/usr/bin/env python3`)
- [ ] Supports `--json` flag for all commands
- [ ] Returns `{"success": true/false}` in JSON mode
- [ ] Exits with code 1 on error, 0 on success
- [ ] Handles KeyboardInterrupt (Ctrl+C)
- [ ] Creates data directory if missing
- [ ] Has helpful `--help` output
- [ ] All commands work with and without `--json`
- [ ] Errors go to stderr in human mode
- [ ] Errors go to stdout as JSON in JSON mode
