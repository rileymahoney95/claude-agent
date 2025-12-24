# CLI Design Patterns for Automation Scripts

Best practices for building robust, user-friendly command-line tools based on the todos implementation.

## Core Principles

1. **Dual Output Modes**: Support both human-readable and machine-readable (JSON) output
2. **File Safety**: Use locking and atomic writes for concurrent access
3. **User Experience**: Fuzzy matching, natural language inputs, helpful errors
4. **Modularity**: Separate data access, business logic, and presentation

## Pattern: Global Flags Before Subcommands

Use argparse to support global flags that apply to all commands:

```python
parser = argparse.ArgumentParser()
# Global flags
parser.add_argument("--json", action="store_true", help="Output as JSON")
parser.add_argument("--no-color", action="store_true", help="Disable colors")

# Subcommands
subparsers = parser.add_subparsers(dest="command")
list_parser = subparsers.add_parser("list", help="List items")
add_parser = subparsers.add_parser("add", help="Add item")
```

**Usage:**
```bash
script --json list          # JSON output
script --no-color add "text"  # No colors
script list                 # Normal output
```

## Pattern: JSON Output Mode

Provide consistent JSON responses for programmatic use:

```python
def print_error(message: str, use_json: bool = False):
    if use_json:
        print(json.dumps({"success": False, "error": message}))
    else:
        print(f"{Fore.RED}Error: {message}{Style.RESET_ALL}", file=sys.stderr)

def print_success(message: str, use_json: bool = False, data: dict = None):
    if use_json:
        print(json.dumps({"success": True, **(data or {})}))
    else:
        print(f"{Fore.GREEN}{message}{Style.RESET_ALL}")
```

**Key points:**
- Always return `{"success": true/false}` for consistency
- Include relevant data in success responses
- Use stdout for all output (even errors in JSON mode)
- Return non-zero exit codes on failure

## Pattern: File Locking for Concurrent Access

Prevent data corruption when multiple processes access the same file:

```python
import fcntl
from pathlib import Path

LOCK_FILE = Path("/path/to/data.lock")

def save_data(data: dict):
    LOCK_FILE.touch()

    with open(LOCK_FILE, "w") as lock_file:
        fcntl.flock(lock_file, fcntl.LOCK_EX)
        try:
            # Backup before write
            if DATA_FILE.exists():
                shutil.copy(DATA_FILE, DATA_FILE.with_suffix(".bak"))

            # Atomic write
            temp_file = DATA_FILE.with_suffix(".tmp")
            temp_file.write_text(json.dumps(data, indent=2))
            temp_file.rename(DATA_FILE)
        finally:
            fcntl.flock(lock_file, fcntl.LOCK_UN)
```

**Benefits:**
- Exclusive lock prevents simultaneous writes
- Backup preserves data if write fails
- Atomic rename ensures file is never half-written
- Works across processes (unlike threading locks)

## Pattern: Fuzzy Matching with Disambiguation

Allow users to specify items by partial text, not just IDs:

```python
def find_item(id_or_text: str) -> dict | list[dict]:
    """Find by ID or text. Returns item, list of matches, or None."""
    # Try exact ID match first
    for item in items:
        if item["id"].lower() == id_or_text.lower():
            return item

    # Try text match
    matches = [i for i in items if id_or_text.lower() in i["text"].lower()]

    if len(matches) == 1:
        return matches[0]
    elif len(matches) > 1:
        return matches  # Disambiguation needed

    return None

# In command handler:
result = find_item(user_input)
if result is None:
    print_error(f"Not found: {user_input}")
elif isinstance(result, list):
    print_disambiguation(result, user_input)
else:
    process_item(result)
```

**User experience:**
```bash
$ todos done "buy milk"      # Finds by text
Completed: "Buy milk from store" [a3f2]

$ todos done "buy"            # Ambiguous
Multiple tasks match "buy":
  [a3f2] Buy milk from store
  [b7e1] Buy concert tickets
Use the task ID: todos done a3f2
```

## Pattern: Natural Language Date Parsing

Accept flexible date inputs using dateutil:

```python
from dateutil import parser as date_parser
from dateutil.relativedelta import relativedelta, MO, TU, WE, TH, FR

DAY_MAP = {
    "monday": MO, "mon": MO,
    "tuesday": TU, "tue": TU,
    # ... etc
}

def parse_due_date(value: str) -> str | None:
    """Parse natural language to ISO date (YYYY-MM-DD)."""
    value = value.lower().strip()
    today = datetime.now().date()

    # Special keywords
    if value == "today":
        return today.isoformat()
    elif value == "tomorrow":
        return (today + timedelta(days=1)).isoformat()

    # "next monday"
    if match := re.match(r"next\s+(\w+)", value):
        day_name = match.group(1)
        if day_name in DAY_MAP:
            next_day = today + relativedelta(weekday=DAY_MAP[day_name](+1))
            return next_day.isoformat()

    # "in 3 days", "in 2 weeks"
    if match := re.match(r"in\s+(\d+)\s+(day|week|month)s?", value):
        num = int(match.group(1))
        unit = match.group(2)
        if unit == "day":
            return (today + timedelta(days=num)).isoformat()
        elif unit == "week":
            return (today + timedelta(weeks=num)).isoformat()

    # Try parsing as date
    try:
        return date_parser.parse(value).date().isoformat()
    except ValueError:
        return None
```

**Usage:**
```bash
add "Task" --due tomorrow
add "Task" --due "next friday"
add "Task" --due "in 3 days"
add "Task" --due "2025-12-25"
```

## Pattern: Validation with Clear Error Messages

Validate inputs and return actionable error messages:

```python
def validate_text(text: str) -> str | None:
    """Returns error message or None if valid."""
    text = text.strip()
    if not text:
        return "Text cannot be empty"
    if len(text) > MAX_LENGTH:
        return f"Text exceeds {MAX_LENGTH} characters"
    return None

def validate_category(category: str) -> str | None:
    if not re.match(r"^[a-z0-9-]+$", category):
        return "Use lowercase letters, numbers, and hyphens only"
    return None

# Use walrus operator for concise validation
if err := validate_text(text):
    return {"success": False, "error": err}
```

## Pattern: Colorized Terminal Output

Use colorama for cross-platform colored output:

```python
from colorama import Fore, Style, init as colorama_init

# Initialize at startup
colorama_init()

# Disable colors if requested
if args.no_color:
    colorama_init(strip=True, convert=False)

# Use in output
print(f"{Fore.GREEN}Success!{Style.RESET_ALL}")
print(f"{Fore.RED}Error: {message}{Style.RESET_ALL}", file=sys.stderr)
```

**Color conventions:**
- Green: Success, completed items
- Red: Errors, overdue items
- Yellow: Warnings, categories
- Cyan: IDs, metadata
- Blue: Dates, info

## Pattern: Configuration with Defaults

Load config from file with sensible defaults:

```python
CONFIG_FILE = Path("~/.config/app/config.json").expanduser()

def load_config() -> dict:
    """Load config, create with defaults if missing."""
    if not CONFIG_FILE.exists():
        default_config = {
            "default_priority": "medium",
            "show_completed_days": 7
        }
        CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
        CONFIG_FILE.write_text(json.dumps(default_config, indent=2))
        return default_config

    try:
        return json.loads(CONFIG_FILE.read_text())
    except json.JSONDecodeError:
        return default_config  # Fallback on corrupt file
```

## Pattern: Graceful Error Handling

Handle errors consistently across the application:

```python
def main():
    try:
        # Command execution
        if args.command == "add":
            result = add_item(args.text)
            if result["success"]:
                print_success("Added!", data=result)
            else:
                print_error(result["error"])
                sys.exit(1)

    except KeyboardInterrupt:
        print("\nCancelled.")
        sys.exit(130)  # Standard SIGINT exit code

    except Exception as e:
        print_error(str(e))
        sys.exit(1)
```

## Complete CLI Structure Template

```python
#!/usr/bin/env python3
import argparse
import json
import sys
from pathlib import Path
from colorama import Fore, Style, init as colorama_init

colorama_init()

# Constants
DATA_FILE = Path("~/.local/share/app/data.json").expanduser()

# Data access functions
def load_data(): ...
def save_data(data): ...

# Business logic functions
def add_item(text, **kwargs): ...
def get_items(**filters): ...

# Output functions
def print_error(msg, use_json=False): ...
def print_success(msg, use_json=False, data=None): ...

# CLI
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", action="store_true")

    subparsers = parser.add_subparsers(dest="command")

    list_parser = subparsers.add_parser("list")
    add_parser = subparsers.add_parser("add")
    add_parser.add_argument("text")

    args = parser.parse_args()

    try:
        if args.command == "list":
            items = get_items()
            print_items(items, use_json=args.json)
        elif args.command == "add":
            result = add_item(args.text)
            if result["success"]:
                print_success("Added!", use_json=args.json, data=result)
            else:
                print_error(result["error"], use_json=args.json)
                sys.exit(1)
    except KeyboardInterrupt:
        print("\nCancelled.")
        sys.exit(130)
    except Exception as e:
        print_error(str(e), use_json=args.json)
        sys.exit(1)

if __name__ == "__main__":
    main()
```

## Testing Checklist

- [ ] Works with and without --json flag
- [ ] Handles concurrent access (test with parallel invocations)
- [ ] Validates all inputs with clear error messages
- [ ] Returns appropriate exit codes (0=success, 1=error, 130=SIGINT)
- [ ] Creates data/config directories if missing
- [ ] Recovers from corrupted data files (uses backup)
- [ ] Handles KeyboardInterrupt gracefully
- [ ] Colors can be disabled
- [ ] Help text is clear and complete
