# MCP Server Template: Subprocess Pattern

Template for building MCP servers that wrap existing CLI tools using subprocess calls.

## Minimal Template

```python
#!/usr/bin/env python3
"""
MyTool MCP Server - Provides Claude with access to mytool CLI.

Uses subprocess calls to CLI with --json output for structured communication.
"""

import json
import subprocess
import sys
from pathlib import Path
from mcp.server.fastmcp import FastMCP

# =============================================================================
# Configuration
# =============================================================================

# Path to CLI wrapper script
CLI_PATH = Path.home() / "path/to/tools/mytool.sh"

# Initialize MCP server
mcp = FastMCP("mytool")


# =============================================================================
# Utilities
# =============================================================================

def log(message: str):
    """Log to stderr (safe for stdio transport)."""
    print(f"[mytool-mcp] {message}", file=sys.stderr)


def call_cli(*args) -> dict:
    """
    Call CLI with --json flag and return parsed output.

    Args:
        *args: Command-line arguments to pass to CLI

    Returns:
        dict: Parsed JSON response from CLI with at least {"success": bool}
    """
    cmd = [str(CLI_PATH), "--json", *args]
    log(f"Running: {' '.join(cmd)}")

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30
        )

        # Handle CLI errors
        if result.returncode != 0:
            # Try to parse JSON error from stdout
            try:
                return json.loads(result.stdout)
            except json.JSONDecodeError:
                return {
                    "success": False,
                    "error": result.stderr.strip() or result.stdout.strip() or "Unknown error"
                }

        # Parse successful response
        return json.loads(result.stdout)

    except subprocess.TimeoutExpired:
        return {"success": False, "error": "CLI command timed out after 30s"}

    except FileNotFoundError:
        return {"success": False, "error": f"CLI not found at {CLI_PATH}"}

    except json.JSONDecodeError as e:
        log(f"JSON parse error: {e}")
        return {"success": False, "error": f"Invalid JSON from CLI: {e}"}

    except Exception as e:
        log(f"Unexpected error: {e}")
        return {"success": False, "error": str(e)}


# =============================================================================
# MCP Tools
# =============================================================================

@mcp.tool()
async def get_items() -> dict:
    """
    Get all items from mytool.

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
    Add a new item to mytool.

    Args:
        text: Item description text

    Returns:
        Dictionary with:
        - success: True/False
        - item: Created item object (if successful)
        - error: Error message (if failed)
    """
    return call_cli("add", text)


# =============================================================================
# Main
# =============================================================================

if __name__ == "__main__":
    log("Starting MyTool MCP server...")
    mcp.run()
```

## With Multiple Tools

```python
#!/usr/bin/env python3
"""Task Manager MCP Server - Full CRUD operations."""

import json
import subprocess
import sys
from pathlib import Path
from mcp.server.fastmcp import FastMCP

CLI_PATH = Path.home() / "tools/tasks.sh"
mcp = FastMCP("tasks")

def log(message: str):
    print(f"[tasks-mcp] {message}", file=sys.stderr)

def call_cli(*args) -> dict:
    """Call CLI and return JSON result."""
    cmd = [str(CLI_PATH), "--json", *args]
    log(f"Running: {' '.join(cmd)}")

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

        if result.returncode != 0:
            try:
                return json.loads(result.stdout)
            except json.JSONDecodeError:
                return {"success": False, "error": result.stderr.strip()}

        return json.loads(result.stdout)

    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Command timed out"}
    except FileNotFoundError:
        return {"success": False, "error": f"CLI not found: {CLI_PATH}"}
    except json.JSONDecodeError as e:
        return {"success": False, "error": f"Invalid JSON: {e}"}
    except Exception as e:
        return {"success": False, "error": str(e)}


@mcp.tool()
async def get_tasks(
    status: str = None,
    category: str = None,
    limit: int = None
) -> dict:
    """
    Get tasks with optional filters.

    Args:
        status: Filter by status (e.g., "pending", "completed")
        category: Filter by category name
        limit: Maximum number of tasks to return

    Returns:
        Dictionary with success, tasks list, and count
    """
    args = ["list"]

    if status:
        args.extend(["--status", status])
    if category:
        args.extend(["--category", category])
    if limit:
        args.extend(["--limit", str(limit)])

    return call_cli(*args)


@mcp.tool()
async def add_task(
    text: str,
    category: str = None,
    priority: str = "medium",
    due: str = None
) -> dict:
    """
    Create a new task.

    Args:
        text: Task description (required)
        category: Optional category name
        priority: Priority level (low/medium/high)
        due: Due date (ISO format or natural language)

    Returns:
        Dictionary with success status and created task
    """
    args = ["add", text]

    if category:
        args.extend(["--category", category])
    if priority:
        args.extend(["--priority", priority])
    if due:
        args.extend(["--due", due])

    return call_cli(*args)


@mcp.tool()
async def complete_task(task_id: str) -> dict:
    """
    Mark a task as completed.

    Args:
        task_id: The task ID to complete

    Returns:
        Dictionary with success status and updated task
    """
    return call_cli("done", task_id)


@mcp.tool()
async def update_task(
    task_id: str,
    text: str = None,
    category: str = None,
    priority: str = None,
    due: str = None
) -> dict:
    """
    Update task fields. Only provided fields are changed.

    Args:
        task_id: The task ID to update
        text: New task text
        category: New category
        priority: New priority
        due: New due date

    Returns:
        Dictionary with success status and updated task
    """
    args = ["edit", task_id]

    if text is not None:
        args.extend(["--text", text])
    if category is not None:
        args.extend(["--category", category])
    if priority is not None:
        args.extend(["--priority", priority])
    if due is not None:
        args.extend(["--due", due])

    return call_cli(*args)


@mcp.tool()
async def delete_task(task_id: str) -> dict:
    """
    Permanently delete a task.

    Args:
        task_id: The task ID to delete

    Returns:
        Dictionary with success status and deleted task info
    """
    return call_cli("remove", task_id, "--force")


if __name__ == "__main__":
    log("Starting Tasks MCP server...")
    mcp.run()
```

## With Output Transformation

Sometimes you want to transform CLI output for better MCP usage:

```python
@mcp.tool()
async def get_task_summary() -> dict:
    """Get a summary of task statistics."""
    result = call_cli("list", "--all")

    if not result["success"]:
        return result

    tasks = result["tasks"]

    # Transform CLI output into summary
    summary = {
        "total": len(tasks),
        "pending": len([t for t in tasks if t["status"] == "pending"]),
        "completed": len([t for t in tasks if t["status"] == "completed"]),
        "overdue": len([t for t in tasks if t.get("overdue", False)]),
    }

    return {
        "success": True,
        "summary": summary,
        "tasks": tasks
    }
```

## With Environment Variables

Pass environment variables to CLI:

```python
def call_cli(*args, env: dict = None) -> dict:
    """Call CLI with optional environment variables."""
    cmd = [str(CLI_PATH), "--json", *args]
    log(f"Running: {' '.join(cmd)}")

    # Merge with current environment
    cli_env = os.environ.copy()
    if env:
        cli_env.update(env)

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30,
            env=cli_env
        )
        # ... rest of handling ...
    except Exception as e:
        return {"success": False, "error": str(e)}


@mcp.tool()
async def add_task(text: str, api_key: str = None) -> dict:
    """Add task, optionally with API key for external sync."""
    env = {"API_KEY": api_key} if api_key else None
    return call_cli("add", text, env=env)
```

## With Custom Error Handling

```python
class CLIError(Exception):
    """Custom exception for CLI errors."""
    pass


def call_cli(*args) -> dict:
    """Call CLI with enhanced error handling."""
    cmd = [str(CLI_PATH), "--json", *args]
    log(f"Running: {' '.join(cmd)}")

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30
        )

        # Parse response
        if result.returncode != 0:
            try:
                error_data = json.loads(result.stdout)
                log(f"CLI error: {error_data.get('error', 'Unknown')}")
                return error_data
            except json.JSONDecodeError:
                error_msg = result.stderr.strip() or "Unknown error"
                log(f"CLI error (unparsed): {error_msg}")
                return {"success": False, "error": error_msg}

        try:
            return json.loads(result.stdout)
        except json.JSONDecodeError as e:
            log(f"JSON parse error: {e}")
            log(f"Raw output: {result.stdout[:200]}")
            return {
                "success": False,
                "error": f"Invalid JSON from CLI: {e}",
                "raw_output": result.stdout[:200]
            }

    except subprocess.TimeoutExpired:
        log("CLI timeout after 30s")
        return {"success": False, "error": "Command timed out after 30 seconds"}

    except FileNotFoundError:
        log(f"CLI not found: {CLI_PATH}")
        return {
            "success": False,
            "error": f"CLI executable not found at {CLI_PATH}. Please check installation."
        }

    except Exception as e:
        log(f"Unexpected error: {type(e).__name__}: {e}")
        return {"success": False, "error": f"Internal error: {e}"}
```

## Directory Structure

```
project/
├── .mcp.json                          # MCP configuration
├── automations/
│   ├── tools/
│   │   ├── mytool.sh                  # CLI wrapper script
│   │   └── mytool/
│   │       ├── mytool.py              # CLI implementation
│   │       ├── requirements.txt
│   │       └── venv/
│   └── mcp-servers/
│       └── mytool/
│           ├── server.py              # This MCP server
│           ├── requirements.txt       # Just: mcp
│           └── venv/
```

## Requirements File

```txt
# automations/mcp-servers/mytool/requirements.txt
mcp>=1.0.0
```

## Installation

```bash
# Create virtual environment for MCP server
cd automations/mcp-servers/mytool
python3 -m venv venv

# Activate and install
source venv/bin/activate
pip install -r requirements.txt

# Test the server
python server.py
# (Use Ctrl+C to stop)
```

## MCP Configuration

Add to `.mcp.json` in project root:

```json
{
  "mcpServers": {
    "mytool": {
      "type": "stdio",
      "command": "/absolute/path/to/automations/mcp-servers/mytool/venv/bin/python",
      "args": ["/absolute/path/to/automations/mcp-servers/mytool/server.py"]
    }
  }
}
```

Or with relative paths (if Claude Code runs from repo root):

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

## Testing

### Test CLI independently:
```bash
# Verify CLI works
./automations/tools/mytool.sh --json list

# Should output JSON
{"success": true, "items": [], "count": 0}
```

### Test MCP server locally:
```python
# test_server.py
import asyncio
from server import get_items, add_item

async def test():
    print("Testing add_item...")
    result = await add_item("Test task")
    print(f"Result: {result}")

    print("\nTesting get_items...")
    result = await get_items()
    print(f"Result: {result}")

asyncio.run(test())
```

```bash
cd automations/mcp-servers/mytool
source venv/bin/activate
python test_server.py
```

### Test in Claude Code:
1. Add server to `.mcp.json`
2. Restart Claude Code
3. Run `/mcp` to verify server loaded
4. Test in conversation:
   ```
   User: Use mytool to add a new task "Test from Claude"
   ```

## Common Patterns

### Handling optional parameters:
```python
@mcp.tool()
async def update_item(
    item_id: str,
    text: str = None,
    priority: str = None
) -> dict:
    """Update item. Only provided fields are changed."""
    args = ["edit", item_id]

    # Only add flags if values provided
    if text is not None:
        args.extend(["--text", text])
    if priority is not None:
        args.extend(["--priority", priority])

    return call_cli(*args)
```

### Handling boolean flags:
```python
@mcp.tool()
async def get_items(include_completed: bool = False) -> dict:
    """Get items, optionally including completed ones."""
    args = ["list"]

    if include_completed:
        args.append("--all")

    return call_cli(*args)
```

### Validating before calling CLI:
```python
@mcp.tool()
async def add_item(text: str, priority: str = "medium") -> dict:
    """Add item with validation."""
    # Validate in MCP server before calling CLI
    if not text.strip():
        return {"success": False, "error": "Text cannot be empty"}

    if priority not in ["low", "medium", "high"]:
        return {"success": False, "error": "Invalid priority"}

    return call_cli("add", text, "--priority", priority)
```

## Troubleshooting

### MCP server doesn't start:
- Check paths in `.mcp.json` are absolute or correct relative paths
- Verify venv has `mcp` installed: `venv/bin/pip list | grep mcp`
- Check stderr logs from Claude Code

### CLI not found:
- Verify `CLI_PATH` is correct absolute path
- Test CLI directly: `./path/to/cli.sh --json list`
- Make sure wrapper script is executable: `chmod +x cli.sh`

### JSON parsing errors:
- Verify CLI outputs valid JSON in `--json` mode
- Test: `./cli.sh --json list | python -m json.tool`
- Check CLI doesn't print debug info to stdout

### Timeout errors:
- Increase timeout in `subprocess.run(timeout=60)`
- Check if CLI operation is genuinely slow
- Add logging to see where time is spent

## Checklist

- [ ] MCP server logs to stderr, not stdout
- [ ] CLI supports `--json` flag for all commands
- [ ] `call_cli()` always passes `--json` flag
- [ ] Error responses include `{"success": false, "error": "..."}`
- [ ] All MCP tools have docstrings with Args/Returns
- [ ] Timeout is reasonable for CLI operations
- [ ] CLI_PATH is absolute path or verified relative path
- [ ] Tested CLI independently before testing MCP
- [ ] `.mcp.json` has correct paths to venv and server.py
- [ ] Requirements file includes `mcp>=1.0.0`
