# TODO List Manager - Implementation Spec

A personal task management system with CLI and MCP server interfaces.

## Overview

| Component                        | Purpose                               |
| -------------------------------- | ------------------------------------- |
| `automations/tools/todos/`       | Core logic + CLI                      |
| `automations/mcp-servers/todos/` | MCP server (calls CLI via subprocess) |
| `.data/todos.json`               | Task persistence                      |
| `.config/todos-config.json`      | User preferences                      |

### Architecture Decision: Code Sharing

The MCP server uses **subprocess calls** to the CLI rather than importing shared code. This avoids:

- Separate virtual environments with duplicated dependencies
- `sys.path` manipulation to share modules across venvs
- Synchronization issues between two codebases

```
┌─────────────┐     subprocess      ┌─────────────────┐
│ MCP Server  │ ──────────────────▶ │ todos.py --json │
│ (server.py) │ ◀────────────────── │                 │
└─────────────┘     JSON output     └─────────────────┘
```

---

## Phase 1: Core Data Layer

### File Structure

```
automations/tools/todos/
├── todos.py          # Core logic + CLI
├── requirements.txt  # Dependencies
└── venv/             # Virtual environment
```

### Data Model (`.data/todos.json`)

```json
{
  "tasks": [
    {
      "id": "a1b2",
      "text": "Buy groceries",
      "category": "errands",
      "priority": "medium",
      "due": "2025-12-25",
      "status": "pending",
      "created": "2025-12-24T10:00:00Z",
      "completed": null
    }
  ],
  "categories": ["work", "personal", "errands", "health"]
}
```

### Field Definitions

| Field       | Type   | Required | Description                                  |
| ----------- | ------ | -------- | -------------------------------------------- |
| `id`        | string | yes      | Short unique ID (4-char hex)                 |
| `text`      | string | yes      | Task description (1-500 chars)               |
| `category`  | string | no       | User-defined category (lowercase, no spaces) |
| `priority`  | enum   | no       | `low`, `medium`, `high` (default: `medium`)  |
| `due`       | string | no       | ISO date (YYYY-MM-DD)                        |
| `status`    | enum   | yes      | `pending`, `completed`                       |
| `created`   | string | yes      | ISO timestamp (UTC)                          |
| `completed` | string | no       | ISO timestamp when marked done (UTC)         |

### Input Validation

| Field      | Constraint                                   |
| ---------- | -------------------------------------------- |
| `text`     | 1-500 characters, non-empty after trimming   |
| `category` | Lowercase alphanumeric + hyphens, 1-30 chars |
| `priority` | Must be exactly `low`, `medium`, or `high`   |
| `due`      | Valid date, can be past (shows as overdue)   |
| `id`       | 4 hex characters, auto-generated             |

### Config (`.config/todos-config.json`)

```json
{
  "default_priority": "medium",
  "default_category": null,
  "show_completed_days": 7
}
```

### Core Functions

```python
# Data access (with file locking)
def load_todos() -> dict
def save_todos(data: dict) -> None
def load_config() -> dict

# CRUD operations
def add_task(text: str, category: str = None, priority: str = "medium", due: str = None) -> dict
def get_tasks(status: str = None, category: str = None, priority: str = None) -> list[dict]
def complete_task(id_or_text: str) -> dict  # Fuzzy match support
def update_task(task_id: str, **updates) -> dict
def delete_task(task_id: str) -> bool

# Category management
def get_categories() -> list[str]
def add_category(name: str) -> list[str]
def remove_category(name: str) -> list[str]

# Utilities
def find_task(id_or_text: str) -> dict | list[dict]  # Returns list if ambiguous
def parse_due_date(value: str) -> str  # "tomorrow", "friday", "2025-12-25"
def generate_id() -> str  # 4-char hex
```

### File Locking

Use `fcntl.flock` to prevent concurrent modification:

```python
import fcntl

def save_todos(data: dict) -> None:
    lock_path = DATA_DIR / "todos.json.lock"
    with open(lock_path, 'w') as lock_file:
        fcntl.flock(lock_file, fcntl.LOCK_EX)  # Exclusive lock
        try:
            # Backup before write
            if TODOS_FILE.exists():
                shutil.copy(TODOS_FILE, TODOS_FILE.with_suffix('.json.bak'))
            # Write atomically
            temp_file = TODOS_FILE.with_suffix('.json.tmp')
            temp_file.write_text(json.dumps(data, indent=2))
            temp_file.rename(TODOS_FILE)
        finally:
            fcntl.flock(lock_file, fcntl.LOCK_UN)
```

### Dependencies

```
# requirements.txt
python-dateutil>=2.8.0   # Date parsing ("tomorrow", "next friday")
```

---

## Phase 2: CLI Interface

### Wrapper Script

```bash
# automations/tools/todos.sh
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/todos/venv/bin/activate"
python "$SCRIPT_DIR/todos/todos.py" "$@"
```

### Commands

#### List Tasks (default)

```bash
todos                           # All pending tasks
todos list                      # Same as above
todos list --all                # Include completed
todos list --category work      # Filter by category
todos list --priority high      # Filter by priority
todos list --due today          # Due today or overdue
```

**Output format:**

```
📋 TODOs (3 pending)

  HIGH
  [a1b2] Buy groceries          errands    📅 Dec 25

  MEDIUM
  [c3d4] Call mom               personal
  [e5f6] Review PR              work       📅 Dec 26

  LOW
  (none)
```

#### Add Task

```bash
todos add "Task description"
todos add "Task" --category work
todos add "Task" --priority high
todos add "Task" --due tomorrow
todos add "Task" -c work -p high -d "next monday"
```

**Output:**

```
✅ Added: "Buy groceries" [a1b2]
   Category: errands | Priority: medium | Due: Dec 25
```

#### Complete Task

```bash
todos done a1b2                 # By ID (exact match)
todos done groceries            # Fuzzy match on text
todos done "buy gro"            # Partial match
```

**Output:**

```
✅ Completed: "Buy groceries" [a1b2]
```

**Fuzzy match disambiguation** (when multiple tasks match):

```
$ todos done call
⚠️  Multiple tasks match "call":
  [a1b2] Call mom               personal
  [c3d4] Call dentist           health

Use the task ID to specify which one:
  todos done a1b2
```

#### Edit Task

```bash
todos edit a1b2 --text "New text"
todos edit a1b2 --priority high
todos edit a1b2 --due "next week"
todos edit a1b2 --category work
```

#### Remove Task

```bash
todos remove a1b2
todos rm a1b2                   # Alias
```

**Output with confirmation:**

```
$ todos remove a1b2
Delete "Buy groceries" [a1b2]? (y/N): y
🗑️  Deleted: "Buy groceries" [a1b2]
```

Use `--force` to skip confirmation:

```bash
todos remove a1b2 --force
```

#### Category Management

```bash
todos categories                # List categories
todos categories add "finance"  # Add new category
todos categories remove "old"   # Remove category
```

### CLI Flags

| Flag         | Short | Description                              |
| ------------ | ----- | ---------------------------------------- |
| `--category` | `-c`  | Filter or set category                   |
| `--priority` | `-p`  | Filter or set priority (low/medium/high) |
| `--due`      | `-d`  | Filter or set due date                   |
| `--all`      | `-a`  | Include completed tasks                  |
| `--json`     |       | Output as JSON (for MCP server)          |
| `--no-color` |       | Disable colored output                   |
| `--force`    | `-f`  | Skip confirmation prompts                |

### Error Handling

| Error                   | Exit Code | Message                                         |
| ----------------------- | --------- | ----------------------------------------------- |
| Task not found          | 1         | `❌ Task not found: {id_or_text}`               |
| Multiple matches        | 1         | Shows disambiguation list (see above)           |
| Invalid priority        | 1         | `❌ Invalid priority: must be low/medium/high`  |
| Invalid category format | 1         | `❌ Invalid category: use lowercase, no spaces` |
| Empty task text         | 1         | `❌ Task text cannot be empty`                  |
| Corrupted data file     | 1         | `❌ Data file corrupted. Restored from backup.` |
| Category not found      | 1         | `❌ Category not found: {name}`                 |
| Category in use         | 1         | `❌ Cannot remove "{name}": used by N tasks`    |

---

## Phase 3: MCP Server

### File Structure

```
automations/mcp-servers/todos/
├── server.py         # MCP server (calls CLI via subprocess)
├── requirements.txt  # Dependencies
└── venv/             # Virtual environment
```

### Implementation Pattern

The MCP server calls the CLI with `--json` flag:

```python
import subprocess
import json

CLI_PATH = Path.home() / "claude-agent/automations/tools/todos.sh"

def call_cli(*args) -> dict:
    """Call todos CLI and return parsed JSON output."""
    result = subprocess.run(
        [str(CLI_PATH), *args, "--json"],
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        return {"success": False, "error": result.stderr.strip()}
    return json.loads(result.stdout)
```

### MCP Tools

#### `get_todos`

```python
@mcp.tool()
async def get_todos(
    status: str = "pending",      # "pending", "completed", "all"
    category: str = None,
    priority: str = None,
    include_overdue: bool = True
) -> dict:
    """
    Get tasks with optional filters.

    Returns:
        {
            "tasks": [...],
            "count": 5,
            "overdue_count": 1
        }
    """
```

#### `add_todo`

```python
@mcp.tool()
async def add_todo(
    text: str,
    category: str = None,
    priority: str = "medium",
    due: str = None
) -> dict:
    """
    Create a new task.

    Args:
        text: Task description (1-500 characters)
        category: Optional category name (lowercase, no spaces)
        priority: "low", "medium", or "high"
        due: Due date (ISO format, "tomorrow", "next monday", etc.)

    Returns:
        {"success": True, "task": {...}}
        {"success": False, "error": "..."}
    """
```

#### `complete_todo`

```python
@mcp.tool()
async def complete_todo(task_id: str) -> dict:
    """
    Mark a task as completed.

    Use exact task ID to avoid ambiguity. Get IDs from get_todos.

    Returns:
        {"success": True, "task": {...}}
        {"success": False, "error": "Task not found: ..."}
    """
```

#### `update_todo`

```python
@mcp.tool()
async def update_todo(
    task_id: str,
    text: str = None,
    category: str = None,
    priority: str = None,
    due: str = None
) -> dict:
    """
    Update task fields. Only provided fields are changed.

    Returns:
        {"success": True, "task": {...}}
        {"success": False, "error": "..."}
    """
```

#### `delete_todo`

```python
@mcp.tool()
async def delete_todo(task_id: str) -> dict:
    """
    Permanently delete a task.

    Returns:
        {"success": True, "deleted_id": "a1b2"}
        {"success": False, "error": "..."}
    """
```

#### `get_categories`

```python
@mcp.tool()
async def get_categories() -> dict:
    """
    Get available task categories.

    Returns:
        {"categories": ["work", "personal", "errands"]}
    """
```

#### `add_category`

```python
@mcp.tool()
async def add_category(name: str) -> dict:
    """
    Add a new category.

    Args:
        name: Category name (lowercase, no spaces, 1-30 chars)

    Returns:
        {"success": True, "categories": [...]}
        {"success": False, "error": "..."}
    """
```

#### `delete_category`

```python
@mcp.tool()
async def delete_category(name: str) -> dict:
    """
    Remove a category. Fails if any tasks use this category.

    Returns:
        {"success": True, "categories": [...]}
        {"success": False, "error": "Cannot remove: used by N tasks"}
    """
```

### Dependencies

```
# requirements.txt
mcp>=1.0.0
```

Note: `python-dateutil` is NOT needed here since the MCP server calls the CLI.

---

## Phase 4: Integration

### Shell Alias

Add to `~/.zshrc`:

```bash
alias todos="~/claude-agent/automations/tools/todos.sh"
```

### Claude Desktop Config

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "todos": {
      "command": "/Users/rileymahoney/claude-agent/automations/mcp-servers/todos/venv/bin/python",
      "args": [
        "/Users/rileymahoney/claude-agent/automations/mcp-servers/todos/server.py"
      ]
    }
  }
}
```

### Cursor MCP Config

Add to `.mcp.json` in project root:

```json
{
  "mcpServers": {
    "todos": {
      "type": "stdio",
      "command": "/Users/rileymahoney/claude-agent/automations/mcp-servers/todos/venv/bin/python",
      "args": [
        "/Users/rileymahoney/claude-agent/automations/mcp-servers/todos/server.py"
      ]
    }
  }
}
```

---

## Implementation Order

### Step 1: Core Data Layer

- [ ] Create `automations/tools/todos/` directory
- [ ] Set up virtual environment
- [ ] Implement `todos.py` with core functions
- [ ] Add file locking for concurrent access
- [ ] Add input validation
- [ ] Create initial `.data/todos.json` structure
- [ ] Create default `.config/todos-config.json`

### Step 2: CLI Interface

- [ ] Add argparse CLI to `todos.py`
- [ ] Implement all commands (list, add, done, edit, remove, categories)
- [ ] Add `--json` output mode for MCP integration
- [ ] Add fuzzy match disambiguation
- [ ] Add colored terminal output
- [ ] Add error messages with exit codes
- [ ] Create `todos.sh` wrapper script
- [ ] Test all CLI commands

### Step 3: MCP Server

- [ ] Create `automations/mcp-servers/todos/` directory
- [ ] Set up virtual environment with `mcp` package
- [ ] Implement `server.py` using subprocess calls to CLI
- [ ] Test with Claude Code (`/mcp` verification)

### Step 4: Integration

- [ ] Add shell alias to `~/.zshrc`
- [ ] Configure Claude Desktop MCP
- [ ] Update `.mcp.json` for Cursor
- [ ] Update `CLAUDE.md` with documentation
- [ ] Test end-to-end with both interfaces

---

## Example Interactions

### CLI Session

```bash
$ todos add "Prepare taxes" -c work -p high -d "april 15"
✅ Added: "Prepare taxes" [f7a8]
   Category: work | Priority: high | Due: Apr 15

$ todos add "Call dentist" -c health
✅ Added: "Call dentist" [b2c3]
   Category: health | Priority: medium

$ todos
📋 TODOs (2 pending)

  HIGH
  [f7a8] Prepare taxes          work       📅 Apr 15

  MEDIUM
  [b2c3] Call dentist           health

$ todos done dentist
✅ Completed: "Call dentist" [b2c3]

$ todos done --json b2c3
{"success": true, "task": {"id": "b2c3", "text": "Call dentist", ...}}
```

### CLI Error Examples

```bash
$ todos done nonexistent
❌ Task not found: nonexistent

$ todos add "Task" --priority extreme
❌ Invalid priority: must be low/medium/high

$ todos categories remove work
❌ Cannot remove "work": used by 3 tasks
```

### Claude Desktop Conversation

> **You:** What's on my todo list?
>
> **Claude:** You have 2 pending tasks:
>
> - **Prepare taxes** (work, high priority) - due April 15
> - **Buy groceries** (errands)
>
> **You:** Add a reminder to call mom on Saturday
>
> **Claude:** Added "Call mom" with due date Saturday, December 28.
>
> **You:** I finished the taxes
>
> **Claude:** Marked "Prepare taxes" as completed!
