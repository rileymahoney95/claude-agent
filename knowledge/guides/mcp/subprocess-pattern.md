# MCP Server: Subprocess Pattern

A pattern for building MCP servers that wrap existing CLI tools, keeping business logic in the CLI and MCP server thin.

## Architecture

```
┌─────────────────┐
│  Claude Code    │
└────────┬────────┘
         │ MCP Protocol (stdio)
         ↓
┌─────────────────┐
│  MCP Server     │  (thin wrapper)
│  server.py      │  - Exposes tools
└────────┬────────┘  - Calls CLI with --json
         │ subprocess
         ↓
┌─────────────────┐
│  CLI Tool       │  (business logic)
│  tool.py        │  - Data access
└─────────────────┘  - Validation
                     - Operations
```

## Why This Pattern?

**Benefits:**
1. **Separation of concerns**: CLI handles logic, MCP handles integration
2. **Standalone CLI**: Tool works without MCP
3. **Simplified MCP**: No business logic in server, just translation
4. **Language flexibility**: CLI and MCP can be in different languages
5. **Easier testing**: Test CLI independently
6. **Reusability**: Same CLI can be used by multiple integrations

**When to use:**
- You want a CLI tool that's also MCP-accessible
- Business logic is complex (better in dedicated CLI)
- Tool needs to work in both interactive and programmatic modes
- You want to keep MCP server minimal

**When NOT to use:**
- Tool only needs MCP access (write native MCP server)
- Performance is critical (subprocess overhead)
- Tool requires streaming/real-time interaction

## Implementation

### Step 1: CLI with JSON Output Mode

Build your CLI with a `--json` flag that outputs structured data:

```python
#!/usr/bin/env python3
import argparse
import json
import sys

def add_item(text: str) -> dict:
    """Add item. Returns result dict."""
    # ... business logic ...
    return {"success": True, "item": item}

def get_items() -> dict:
    """Get items. Returns result dict."""
    items = # ... load items ...
    return {"success": True, "items": items, "count": len(items)}

def print_json(data: dict):
    """Print JSON to stdout."""
    print(json.dumps(data))

def print_human(message: str):
    """Print human-readable output."""
    print(message)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", action="store_true", help="Output as JSON")

    subparsers = parser.add_subparsers(dest="command")

    list_parser = subparsers.add_parser("list", help="List items")
    add_parser = subparsers.add_parser("add", help="Add item")
    add_parser.add_argument("text", help="Item text")

    args = parser.parse_args()

    # Execute command
    if args.command == "list":
        result = get_items()
        if args.json:
            print_json(result)
        else:
            print_human(f"Found {result['count']} items")

    elif args.command == "add":
        result = add_item(args.text)
        if args.json:
            print_json(result)
        else:
            if result["success"]:
                print_human(f"Added: {result['item']['text']}")
            else:
                print(f"Error: {result['error']}", file=sys.stderr)
                sys.exit(1)

if __name__ == "__main__":
    main()
```

**CLI JSON Response Format:**
```json
{
  "success": true,
  "item": { "id": "a3f2", "text": "Example" }
}
```

```json
{
  "success": false,
  "error": "Item not found"
}
```

### Step 2: Wrapper Script for Environment Setup

Create a shell wrapper to handle venv activation and paths:

```bash
#!/bin/bash
# tools/mytool.sh
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$SCRIPT_DIR/mytool/venv/bin/python" "$SCRIPT_DIR/mytool/mytool.py" "$@"
```

Make it executable:
```bash
chmod +x tools/mytool.sh
```

**Why a wrapper?**
- Activates virtual environment automatically
- Makes CLI runnable from any directory
- Simplifies path resolution
- Consistent pattern across all tools

### Step 3: MCP Server (Subprocess Wrapper)

Create a FastMCP server that calls the CLI:

```python
#!/usr/bin/env python3
"""MCP Server for MyTool - wraps CLI with subprocess calls."""

import json
import subprocess
import sys
from pathlib import Path
from mcp.server.fastmcp import FastMCP

# Path to CLI wrapper script
CLI_PATH = Path.home() / "path/to/tools/mytool.sh"

# Initialize MCP
mcp = FastMCP("mytool")

def log(message: str):
    """Log to stderr (safe for stdio transport)."""
    print(f"[mytool-mcp] {message}", file=sys.stderr)

def call_cli(*args) -> dict:
    """Call CLI with --json flag and parse output."""
    cmd = [str(CLI_PATH), "--json", *args]
    log(f"Running: {' '.join(cmd)}")

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30
        )

        # Parse JSON response
        if result.returncode != 0:
            # Try to parse JSON error
            try:
                return json.loads(result.stdout)
            except json.JSONDecodeError:
                return {
                    "success": False,
                    "error": result.stderr.strip() or result.stdout.strip()
                }

        return json.loads(result.stdout)

    except subprocess.TimeoutExpired:
        return {"success": False, "error": "CLI command timed out"}
    except FileNotFoundError:
        return {"success": False, "error": f"CLI not found at {CLI_PATH}"}
    except json.JSONDecodeError as e:
        return {"success": False, "error": f"Invalid JSON from CLI: {e}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@mcp.tool()
async def get_items() -> dict:
    """
    Get all items.

    Returns:
        Dictionary with:
        - success: True/False
        - items: List of item objects
        - count: Total number of items
    """
    return call_cli("list")

@mcp.tool()
async def add_item(text: str) -> dict:
    """
    Add a new item.

    Args:
        text: Item description

    Returns:
        Dictionary with:
        - success: True/False
        - item: Created item object (if successful)
        - error: Error message (if failed)
    """
    return call_cli("add", text)

if __name__ == "__main__":
    log("Starting MyTool MCP server...")
    mcp.run()
```

### Step 4: MCP Configuration

Add to `.mcp.json` in project root:

```json
{
  "mcpServers": {
    "mytool": {
      "type": "stdio",
      "command": "/path/to/mcp-server/venv/bin/python",
      "args": ["/path/to/mcp-server/server.py"]
    }
  }
}
```

Or use relative paths from repo root:

```json
{
  "mcpServers": {
    "mytool": {
      "type": "stdio",
      "command": "automations/mcp-servers/mytool/venv/bin/python",
      "args": ["automations/mcp-servers/mytool/server.py"]
    }
  }
}
```

## Directory Structure

```
automations/
├── tools/
│   ├── mytool.sh              # Wrapper script
│   └── mytool/
│       ├── mytool.py          # CLI implementation
│       ├── requirements.txt   # Python dependencies
│       └── venv/              # Virtual environment
└── mcp-servers/
    └── mytool/
        ├── server.py          # MCP server
        ├── requirements.txt   # mcp dependency
        └── venv/              # Separate venv for MCP
```

## Error Handling

The MCP server should handle all subprocess errors gracefully:

```python
def call_cli(*args) -> dict:
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30,
            check=False  # Don't raise on non-zero exit
        )

        # Handle CLI errors
        if result.returncode != 0:
            # CLI should output JSON error to stdout when using --json
            try:
                return json.loads(result.stdout)
            except json.JSONDecodeError:
                # Fallback: parse stderr
                return {
                    "success": False,
                    "error": result.stderr.strip() or "Unknown error"
                }

        # Parse successful response
        try:
            return json.loads(result.stdout)
        except json.JSONDecodeError as e:
            return {
                "success": False,
                "error": f"Invalid JSON from CLI: {e}"
            }

    except subprocess.TimeoutExpired:
        return {"success": False, "error": f"Command timed out after 30s"}

    except FileNotFoundError:
        return {"success": False, "error": f"CLI not found: {CLI_PATH}"}

    except Exception as e:
        log(f"Unexpected error: {e}")
        return {"success": False, "error": f"Internal error: {e}"}
```

## Testing

### Test CLI independently:
```bash
# Human-readable output
./tools/mytool.sh list
./tools/mytool.sh add "Test item"

# JSON output
./tools/mytool.sh --json list
./tools/mytool.sh --json add "Test item"
```

### Test MCP server locally:
```python
# test_server.py
import asyncio
from server import get_items, add_item

async def test():
    # Test add
    result = await add_item("Test task")
    print("Add result:", result)

    # Test list
    result = await get_items()
    print("List result:", result)

asyncio.run(test())
```

### Test in Claude Code:
1. Add server to `.mcp.json`
2. Restart Claude Code
3. Run `/mcp` to verify server loaded
4. Test tools in conversation

## Logging Best Practices

**MCP server logging:**
- Always log to stderr (stdout is reserved for MCP protocol)
- Include server name in log prefix
- Log subprocess commands for debugging
- Log errors but avoid sensitive data

```python
def log(message: str):
    print(f"[mytool-mcp] {message}", file=sys.stderr)

def call_cli(*args) -> dict:
    cmd = [str(CLI_PATH), "--json", *args]
    log(f"Running: {' '.join(cmd)}")  # Debug

    # ... execute ...

    if result.returncode != 0:
        log(f"CLI error: {result.stderr}")  # Error
```

**View MCP logs:**
- Check Claude Code output/console
- Logs appear in stderr stream
- Useful for debugging subprocess issues

## Performance Considerations

**Subprocess overhead:**
- Each tool call spawns new process (~10-50ms)
- Acceptable for user-facing tasks
- May be slow for high-frequency operations

**Optimization strategies:**
1. Batch operations in CLI (add multiple items in one call)
2. Cache frequently accessed data
3. Consider native MCP server for performance-critical tools

**When subprocess is fine:**
- User-triggered actions (clicks, commands)
- Operations take >100ms anyway (file I/O, network)
- Simplicity > performance optimization

## Common Pitfalls

1. **Forgetting --json flag**: Always pass `--json` to CLI
2. **Wrong error handling**: CLI should output JSON errors when in --json mode
3. **Path issues**: Use absolute paths or wrapper script
4. **Timeout too short**: CLI operations might need >10s
5. **Not checking success field**: Always check `result["success"]`

## Variations

### Pass-through arguments:
```python
@mcp.tool()
async def add_item(text: str, priority: str = "medium") -> dict:
    args = ["add", text]
    if priority:
        args.extend(["--priority", priority])
    return call_cli(*args)
```

### Transform CLI output for MCP:
```python
@mcp.tool()
async def get_pending_items() -> dict:
    result = call_cli("list", "--status", "pending")
    if result["success"]:
        # Transform for MCP consumers
        return {
            "success": True,
            "items": result["items"],
            "summary": f"{len(result['items'])} pending tasks"
        }
    return result
```

### Multiple CLI tools in one MCP server:
```python
CLI1_PATH = Path.home() / "tools/tool1.sh"
CLI2_PATH = Path.home() / "tools/tool2.sh"

def call_cli(cli_path: Path, *args) -> dict:
    # ... shared subprocess logic ...

@mcp.tool()
async def tool1_action() -> dict:
    return call_cli(CLI1_PATH, "action")

@mcp.tool()
async def tool2_action() -> dict:
    return call_cli(CLI2_PATH, "action")
```

## Summary

The subprocess pattern is ideal when:
- You want a standalone CLI tool
- Business logic is complex
- Simplicity and maintainability matter
- Performance overhead is acceptable

**Key implementation points:**
1. CLI must support `--json` flag with consistent response format
2. Use wrapper script for environment setup
3. MCP server is thin: just subprocess + JSON parsing
4. Handle all subprocess errors gracefully
5. Log to stderr, never stdout
