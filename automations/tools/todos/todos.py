#!/usr/bin/env python3
"""
TODO List Manager - CLI for personal task management.

Usage:
    todos                           # List pending tasks
    todos list --all                # Include completed tasks
    todos add "Task description"    # Add a new task
    todos done <id_or_text>         # Complete a task
    todos edit <id> --text "..."    # Edit a task
    todos remove <id>               # Delete a task
    todos categories                # List categories
"""

import argparse
import fcntl
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from colorama import Fore, Style, init as colorama_init
from dateutil import parser as date_parser
from dateutil.relativedelta import relativedelta, MO, TU, WE, TH, FR, SA, SU

# Initialize colorama for cross-platform color support
colorama_init()

# Path resolution
REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
DATA_DIR = REPO_ROOT / ".data"
CONFIG_DIR = REPO_ROOT / ".config"
TODOS_FILE = DATA_DIR / "todos.json"
ARCHIVE_FILE = DATA_DIR / "todos-archive.json"
CONFIG_FILE = CONFIG_DIR / "todos-config.json"
LOCK_FILE = DATA_DIR / "todos.json.lock"
ARCHIVE_LOCK_FILE = DATA_DIR / "todos-archive.json.lock"

# Validation constants
MAX_TEXT_LENGTH = 500
MAX_CATEGORY_LENGTH = 30
VALID_PRIORITIES = ["low", "medium", "high"]
VALID_STATUSES = ["pending", "completed"]

# Day name mapping for date parsing
DAY_MAP = {
    "monday": MO, "mon": MO,
    "tuesday": TU, "tue": TU, "tues": TU,
    "wednesday": WE, "wed": WE,
    "thursday": TH, "thu": TH, "thur": TH, "thurs": TH,
    "friday": FR, "fri": FR,
    "saturday": SA, "sat": SA,
    "sunday": SU, "sun": SU,
}


# =============================================================================
# Data Access
# =============================================================================

def ensure_data_dir():
    """Ensure data directory exists."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def ensure_config_dir():
    """Ensure config directory exists."""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)


def load_todos() -> dict:
    """Load todos from JSON file. Creates default structure if missing."""
    ensure_data_dir()
    if not TODOS_FILE.exists():
        return {"tasks": [], "categories": ["work", "personal", "errands", "health"]}
    try:
        return json.loads(TODOS_FILE.read_text())
    except json.JSONDecodeError:
        # Try to restore from backup
        backup = TODOS_FILE.with_suffix(".json.bak")
        if backup.exists():
            try:
                data = json.loads(backup.read_text())
                save_todos(data)
                return data
            except json.JSONDecodeError:
                pass
        # Return default if all else fails
        return {"tasks": [], "categories": ["work", "personal", "errands", "health"]}


def save_todos(data: dict) -> None:
    """Save todos to JSON file with file locking and atomic write."""
    ensure_data_dir()
    LOCK_FILE.touch()

    with open(LOCK_FILE, "w") as lock_file:
        fcntl.flock(lock_file, fcntl.LOCK_EX)
        try:
            # Backup before write
            if TODOS_FILE.exists():
                shutil.copy(TODOS_FILE, TODOS_FILE.with_suffix(".json.bak"))

            # Write atomically
            temp_file = TODOS_FILE.with_suffix(".json.tmp")
            temp_file.write_text(json.dumps(data, indent=2))
            temp_file.rename(TODOS_FILE)
        finally:
            fcntl.flock(lock_file, fcntl.LOCK_UN)


def load_archive() -> dict:
    """Load archive from JSON file. Creates default structure if missing."""
    ensure_data_dir()
    if not ARCHIVE_FILE.exists():
        return {"tasks": []}
    try:
        return json.loads(ARCHIVE_FILE.read_text())
    except json.JSONDecodeError:
        return {"tasks": []}


def save_archive(data: dict) -> None:
    """Save archive to JSON file with file locking and atomic write."""
    ensure_data_dir()
    ARCHIVE_LOCK_FILE.touch()

    with open(ARCHIVE_LOCK_FILE, "w") as lock_file:
        fcntl.flock(lock_file, fcntl.LOCK_EX)
        try:
            # Backup before write
            if ARCHIVE_FILE.exists():
                shutil.copy(ARCHIVE_FILE, ARCHIVE_FILE.with_suffix(".json.bak"))

            # Write atomically
            temp_file = ARCHIVE_FILE.with_suffix(".json.tmp")
            temp_file.write_text(json.dumps(data, indent=2))
            temp_file.rename(ARCHIVE_FILE)
        finally:
            fcntl.flock(lock_file, fcntl.LOCK_UN)


def load_config() -> dict:
    """Load config from JSON file. Creates default if missing."""
    ensure_config_dir()
    if not CONFIG_FILE.exists():
        default_config = {
            "default_priority": "medium",
            "default_category": None,
            "show_completed_days": 7,
            "recipient_phone_number": None
        }
        CONFIG_FILE.write_text(json.dumps(default_config, indent=2))
        return default_config
    try:
        return json.loads(CONFIG_FILE.read_text())
    except json.JSONDecodeError:
        return {
            "default_priority": "medium",
            "default_category": None,
            "show_completed_days": 7,
            "recipient_phone_number": None
        }


# =============================================================================
# Utilities
# =============================================================================

def generate_id() -> str:
    """Generate a unique 4-character hex ID."""
    import secrets
    data = load_todos()
    existing_ids = {task["id"] for task in data["tasks"]}

    for _ in range(100):  # Avoid infinite loop
        new_id = secrets.token_hex(2)  # 4 hex chars
        if new_id not in existing_ids:
            return new_id

    # Fallback: use longer ID
    return secrets.token_hex(4)


def parse_due_date(value: str) -> str | None:
    """Parse natural language date to ISO format (YYYY-MM-DD)."""
    if not value:
        return None

    value = value.lower().strip()
    today = datetime.now().date()

    # Handle special keywords
    if value == "today":
        return today.isoformat()
    elif value == "tomorrow":
        return (today + timedelta(days=1)).isoformat()
    elif value == "yesterday":
        return (today - timedelta(days=1)).isoformat()

    # Handle "next <day>"
    next_match = re.match(r"next\s+(\w+)", value)
    if next_match:
        day_name = next_match.group(1)
        if day_name in DAY_MAP:
            next_day = today + relativedelta(weekday=DAY_MAP[day_name](+1))
            # If it's the same day, go to next week
            if next_day == today:
                next_day = today + relativedelta(weekday=DAY_MAP[day_name](+2))
            return next_day.isoformat()

    # Handle day names (this or next occurrence)
    if value in DAY_MAP:
        next_day = today + relativedelta(weekday=DAY_MAP[value](+1))
        return next_day.isoformat()

    # Handle relative days
    in_match = re.match(r"in\s+(\d+)\s+(day|week|month)s?", value)
    if in_match:
        num = int(in_match.group(1))
        unit = in_match.group(2)
        if unit == "day":
            return (today + timedelta(days=num)).isoformat()
        elif unit == "week":
            return (today + timedelta(weeks=num)).isoformat()
        elif unit == "month":
            return (today + relativedelta(months=num)).isoformat()

    # Try to parse as date
    try:
        parsed = date_parser.parse(value, dayfirst=False)
        return parsed.date().isoformat()
    except (ValueError, TypeError):
        return None


def format_date(iso_date: str) -> str:
    """Format ISO date for display (e.g., 'Dec 25')."""
    if not iso_date:
        return ""
    try:
        d = datetime.fromisoformat(iso_date).date()
        return d.strftime("%b %d").replace(" 0", " ")
    except ValueError:
        return iso_date


def is_overdue(iso_date: str | None) -> bool:
    """Check if a date is before today."""
    if not iso_date:
        return False
    try:
        due = datetime.fromisoformat(iso_date).date()
        return due < datetime.now().date()
    except ValueError:
        return False


def send_notification(title: str, message: str, subtitle: str = "") -> bool:
    """Send a macOS notification via osascript."""
    # Escape double quotes in strings
    title = title.replace('"', '\\"')
    message = message.replace('"', '\\"')
    subtitle = subtitle.replace('"', '\\"')

    script = f'display notification "{message}" with title "{title}"'
    if subtitle:
        script = f'display notification "{message}" with title "{title}" subtitle "{subtitle}"'

    result = subprocess.run(
        ["osascript", "-e", script],
        capture_output=True,
        text=True
    )
    return result.returncode == 0


def send_imessage(recipient: str, message: str) -> bool:
    """Send iMessage via AppleScript."""
    # Escape for AppleScript
    escaped_message = message.replace('\\', '\\\\').replace('"', '\\"')
    escaped_recipient = recipient.replace('\\', '\\\\').replace('"', '\\"')

    applescript = f'''
    tell application "Messages"
        set targetService to 1st service whose service type = iMessage
        set targetBuddy to buddy "{escaped_recipient}" of targetService
        send "{escaped_message}" to targetBuddy
    end tell
    '''

    result = subprocess.run(
        ['osascript', '-e', applescript],
        capture_output=True,
        text=True,
        timeout=10
    )
    return result.returncode == 0


# =============================================================================
# Validation
# =============================================================================

def validate_text(text: str) -> str | None:
    """Validate task text. Returns error message or None if valid."""
    text = text.strip()
    if not text:
        return "Task text cannot be empty"
    if len(text) > MAX_TEXT_LENGTH:
        return f"Task text exceeds {MAX_TEXT_LENGTH} characters"
    return None


def validate_category(category: str) -> str | None:
    """Validate category name. Returns error message or None if valid."""
    if not category:
        return None
    if not re.match(r"^[a-z0-9-]+$", category):
        return "Invalid category: use lowercase letters, numbers, and hyphens only"
    if len(category) > MAX_CATEGORY_LENGTH:
        return f"Category name exceeds {MAX_CATEGORY_LENGTH} characters"
    return None


def validate_priority(priority: str) -> str | None:
    """Validate priority. Returns error message or None if valid."""
    if priority not in VALID_PRIORITIES:
        return f"Invalid priority: must be {'/'.join(VALID_PRIORITIES)}"
    return None


# =============================================================================
# CRUD Operations
# =============================================================================

def add_task(text: str, category: str = None, priority: str = None, due: str = None) -> dict:
    """Add a new task. Returns the created task or error dict."""
    config = load_config()

    # Validate inputs
    text = text.strip()
    if err := validate_text(text):
        return {"success": False, "error": err}

    if category:
        category = category.lower().strip()
        if err := validate_category(category):
            return {"success": False, "error": err}
    else:
        category = config.get("default_category")

    priority = priority or config.get("default_priority", "medium")
    if err := validate_priority(priority):
        return {"success": False, "error": err}

    if due:
        parsed_due = parse_due_date(due)
        if parsed_due is None:
            return {"success": False, "error": f"Invalid due date: {due}"}
        due = parsed_due

    # Create task
    task = {
        "id": generate_id(),
        "text": text,
        "category": category,
        "priority": priority,
        "due": due,
        "status": "pending",
        "created": datetime.now(timezone.utc).isoformat() + "Z",
        "completed": None
    }

    # Save
    data = load_todos()

    # Auto-add category if not exists
    if category and category not in data["categories"]:
        data["categories"].append(category)

    data["tasks"].append(task)
    save_todos(data)

    return {"success": True, "task": task}


def get_archived_tasks(category: str = None, limit: int = None) -> list[dict]:
    """Get archived tasks with optional filters."""
    archive = load_archive()
    tasks = archive.get("tasks", [])

    # Filter by category
    if category:
        category = category.lower()
        tasks = [t for t in tasks if t.get("category") == category]

    # Sort by archived_at (most recent first)
    tasks.sort(key=lambda t: t.get("archived_at", ""), reverse=True)

    # Limit results
    if limit:
        tasks = tasks[:limit]

    return tasks


def get_tasks(status: str = None, category: str = None, priority: str = None,
              due_filter: str = None, include_all: bool = False) -> list[dict]:
    """Get tasks with optional filters."""
    data = load_todos()
    config = load_config()
    tasks = data["tasks"]

    # Filter by status
    if status == "pending":
        tasks = [t for t in tasks if t["status"] == "pending"]
    elif status == "completed":
        tasks = [t for t in tasks if t["status"] == "completed"]
    elif not include_all:
        # By default, show pending + recently completed
        show_days = config.get("show_completed_days", 7)
        cutoff = datetime.now(timezone.utc) - timedelta(days=show_days)
        tasks = [
            t for t in tasks
            if t["status"] == "pending" or (
                t["status"] == "completed" and
                t.get("completed") and
                datetime.fromisoformat(t["completed"].rstrip("Z")) > cutoff
            )
        ]

    # Filter by category
    if category:
        category = category.lower()
        tasks = [t for t in tasks if t.get("category") == category]

    # Filter by priority
    if priority:
        priority = priority.lower()
        tasks = [t for t in tasks if t.get("priority") == priority]

    # Filter by due date
    if due_filter:
        today = datetime.now().date()
        if due_filter == "today":
            tasks = [t for t in tasks if t.get("due") and (
                datetime.fromisoformat(t["due"]).date() <= today
            )]
        elif due_filter == "week":
            week_end = today + timedelta(days=7)
            tasks = [t for t in tasks if t.get("due") and (
                datetime.fromisoformat(t["due"]).date() <= week_end
            )]
        elif due_filter == "overdue":
            tasks = [t for t in tasks if is_overdue(t.get("due"))]

    return tasks


def find_task(id_or_text: str) -> dict | list[dict]:
    """Find task by ID or text. Returns task, list of matches, or None."""
    data = load_todos()
    id_or_text = id_or_text.lower().strip()

    # Try exact ID match first
    for task in data["tasks"]:
        if task["id"].lower() == id_or_text:
            return task

    # Try text match (only pending tasks)
    pending = [t for t in data["tasks"] if t["status"] == "pending"]
    matches = [t for t in pending if id_or_text in t["text"].lower()]

    if len(matches) == 1:
        return matches[0]
    elif len(matches) > 1:
        return matches

    return None


def complete_task(id_or_text: str) -> dict:
    """Mark a task as completed. Returns result dict."""
    result = find_task(id_or_text)

    if result is None:
        return {"success": False, "error": f"Task not found: {id_or_text}"}

    if isinstance(result, list):
        return {
            "success": False,
            "error": "Multiple tasks match",
            "matches": result
        }

    task = result
    if task["status"] == "completed":
        return {"success": False, "error": f"Task already completed: {task['text']}"}

    # Update task
    data = load_todos()
    for t in data["tasks"]:
        if t["id"] == task["id"]:
            t["status"] = "completed"
            t["completed"] = datetime.now(timezone.utc).isoformat() + "Z"
            task = t
            break

    save_todos(data)
    return {"success": True, "task": task}


def update_task(task_id: str, **updates) -> dict:
    """Update task fields. Returns result dict."""
    data = load_todos()
    task_id = task_id.lower().strip()

    # Find task
    task = None
    for t in data["tasks"]:
        if t["id"].lower() == task_id:
            task = t
            break

    if task is None:
        return {"success": False, "error": f"Task not found: {task_id}"}

    # Validate and apply updates
    if "text" in updates and updates["text"]:
        text = updates["text"].strip()
        if err := validate_text(text):
            return {"success": False, "error": err}
        task["text"] = text

    if "category" in updates:
        category = updates["category"]
        if category:
            category = category.lower().strip()
            if err := validate_category(category):
                return {"success": False, "error": err}
            # Auto-add category
            if category not in data["categories"]:
                data["categories"].append(category)
        task["category"] = category

    if "priority" in updates and updates["priority"]:
        priority = updates["priority"].lower()
        if err := validate_priority(priority):
            return {"success": False, "error": err}
        task["priority"] = priority

    if "due" in updates:
        due = updates["due"]
        if due:
            parsed = parse_due_date(due)
            if parsed is None:
                return {"success": False, "error": f"Invalid due date: {due}"}
            task["due"] = parsed
        else:
            task["due"] = None

    save_todos(data)
    return {"success": True, "task": task}


def delete_task(task_id: str) -> dict:
    """Delete a task. Returns result dict."""
    data = load_todos()
    task_id = task_id.lower().strip()

    # Find and remove task
    for i, task in enumerate(data["tasks"]):
        if task["id"].lower() == task_id:
            deleted = data["tasks"].pop(i)
            save_todos(data)
            return {"success": True, "task": deleted}

    return {"success": False, "error": f"Task not found: {task_id}"}


# =============================================================================
# Category Management
# =============================================================================

def get_categories() -> list[str]:
    """Get list of categories."""
    data = load_todos()
    return data.get("categories", [])


def add_category(name: str) -> dict:
    """Add a new category. Returns result dict."""
    name = name.lower().strip()

    if err := validate_category(name):
        return {"success": False, "error": err}

    data = load_todos()
    if name in data["categories"]:
        return {"success": False, "error": f"Category already exists: {name}"}

    data["categories"].append(name)
    save_todos(data)
    return {"success": True, "categories": data["categories"]}


def remove_category(name: str) -> dict:
    """Remove a category. Fails if tasks use it. Returns result dict."""
    name = name.lower().strip()
    data = load_todos()

    if name not in data["categories"]:
        return {"success": False, "error": f"Category not found: {name}"}

    # Check if any tasks use this category
    using = [t for t in data["tasks"] if t.get("category") == name]
    if using:
        return {
            "success": False,
            "error": f'Cannot remove "{name}": used by {len(using)} task(s)'
        }

    data["categories"].remove(name)
    save_todos(data)
    return {"success": True, "categories": data["categories"]}


# =============================================================================
# Archive
# =============================================================================

def archive_tasks(before_date: str = None, archive_all: bool = False) -> dict:
    """
    Move completed tasks to archive file.

    Args:
        before_date: Archive tasks completed before this date (ISO format or natural language)
        archive_all: If True, archive ALL completed tasks

    Default: Archive completed tasks older than 30 days

    Returns: {"success": bool, "archived_count": int, "tasks": [...]}
    """
    data = load_todos()
    archive = load_archive()

    # Determine cutoff date
    if archive_all:
        cutoff = None  # No cutoff - archive all completed
    elif before_date:
        parsed = parse_due_date(before_date)
        if parsed is None:
            return {"success": False, "error": f"Invalid date: {before_date}"}
        cutoff = datetime.fromisoformat(parsed)
    else:
        # Default: 30 days ago
        cutoff = datetime.now(timezone.utc) - timedelta(days=30)

    # Find tasks to archive
    to_archive = []
    remaining = []

    for task in data["tasks"]:
        if task["status"] != "completed":
            remaining.append(task)
            continue

        # Check if task should be archived
        should_archive = False
        if archive_all:
            should_archive = True
        elif task.get("completed"):
            try:
                completed_dt = datetime.fromisoformat(task["completed"].rstrip("Z"))
                # Make timezone-aware if needed
                if completed_dt.tzinfo is None:
                    completed_dt = completed_dt.replace(tzinfo=timezone.utc)
                if cutoff.tzinfo is None:
                    cutoff = cutoff.replace(tzinfo=timezone.utc)
                should_archive = completed_dt < cutoff
            except (ValueError, TypeError):
                # If we can't parse the date, don't archive
                pass

        if should_archive:
            # Add archived_at timestamp
            task["archived_at"] = datetime.now(timezone.utc).isoformat() + "Z"
            to_archive.append(task)
        else:
            remaining.append(task)

    if not to_archive:
        return {"success": True, "archived_count": 0, "tasks": []}

    # Update both files atomically (lock both)
    archive["tasks"].extend(to_archive)
    data["tasks"] = remaining

    save_todos(data)
    save_archive(archive)

    return {"success": True, "archived_count": len(to_archive), "tasks": to_archive}


# =============================================================================
# Reminders
# =============================================================================

def cmd_remind(overdue_only: bool = False, dry_run: bool = False,
               use_json: bool = False, imessage: bool = False) -> dict:
    """Check for overdue/due-soon tasks and send notifications."""
    data = load_todos()
    config = load_config()
    tasks = [t for t in data["tasks"] if t["status"] == "pending"]
    today = datetime.now().date()

    overdue = []
    due_today = []

    for task in tasks:
        if not task.get("due"):
            continue
        due_date = datetime.fromisoformat(task["due"]).date()
        if due_date < today:
            overdue.append(task)
        elif due_date == today and not overdue_only:
            due_today.append(task)

    notifications_sent = 0

    # iMessage mode: send single combined message
    if imessage:
        recipient = config.get("recipient_phone_number")
        if not recipient:
            error_msg = "recipient_phone_number not configured in .config/todos-config.json"
            if use_json:
                print(json.dumps({"success": False, "error": error_msg}))
            else:
                print_error(error_msg)
            return {"success": False, "error": error_msg}

        if not overdue and not due_today:
            if use_json:
                print(json.dumps({"success": True, "overdue_count": 0,
                                  "due_today_count": 0, "notifications_sent": 0}))
            else:
                print(f"{Fore.GREEN}No tasks due.{Style.RESET_ALL}")
            return {"success": True, "overdue_count": 0,
                    "due_today_count": 0, "notifications_sent": 0}

        # Format iMessage
        lines = ["📋 Task Reminders"]
        if overdue:
            lines.append(f"\n⚠️ OVERDUE ({len(overdue)}):")
            for t in overdue[:5]:  # Limit to 5
                lines.append(f"• {t['text'][:40]}")
            if len(overdue) > 5:
                lines.append(f"  ...and {len(overdue) - 5} more")
        if due_today:
            lines.append(f"\n📅 DUE TODAY ({len(due_today)}):")
            for t in due_today[:5]:
                lines.append(f"• {t['text'][:40]}")
            if len(due_today) > 5:
                lines.append(f"  ...and {len(due_today) - 5} more")

        message = "\n".join(lines)

        if dry_run:
            print(f"Would send iMessage to {recipient}:\n{message}")
        else:
            if send_imessage(recipient, message):
                notifications_sent = 1
                if not use_json:
                    print(f"{Fore.GREEN}iMessage sent to {recipient}{Style.RESET_ALL}")
            else:
                if not use_json:
                    print_error("Failed to send iMessage")

        result = {
            "success": notifications_sent > 0 or dry_run,
            "overdue_count": len(overdue),
            "due_today_count": len(due_today),
            "notifications_sent": notifications_sent,
            "dry_run": dry_run,
            "imessage": True
        }
        if use_json:
            print(json.dumps(result))
        return result

    # macOS notification mode (default)
    if overdue:
        count = len(overdue)
        title = "Overdue Tasks"
        if count == 1:
            message = overdue[0]["text"][:50]
        else:
            message = f"{count} tasks overdue"

        if dry_run:
            print(f"Would notify: {title} - {message}")
        else:
            if send_notification(title, message):
                notifications_sent += 1

    if due_today:
        count = len(due_today)
        title = "Due Today"
        if count == 1:
            message = due_today[0]["text"][:50]
        else:
            message = f"{count} tasks due today"

        if dry_run:
            print(f"Would notify: {title} - {message}")
        else:
            if send_notification(title, message):
                notifications_sent += 1

    result = {
        "success": True,
        "overdue_count": len(overdue),
        "due_today_count": len(due_today),
        "notifications_sent": notifications_sent,
        "dry_run": dry_run
    }

    if use_json:
        print(json.dumps(result))
    elif not dry_run:
        total = len(overdue) + len(due_today)
        if total == 0:
            print(f"{Fore.GREEN}No tasks due.{Style.RESET_ALL}")
        else:
            print(f"{Fore.GREEN}Sent {notifications_sent} notification(s).{Style.RESET_ALL}")
            if overdue:
                print(f"  - {len(overdue)} overdue")
            if due_today:
                print(f"  - {len(due_today)} due today")

    return result


# =============================================================================
# Output Formatting
# =============================================================================

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


def format_task_line(task: dict, show_status: bool = False) -> str:
    """Format a single task for display."""
    parts = []

    # Status indicator
    if show_status and task["status"] == "completed":
        parts.append(f"{Fore.GREEN}[done]{Style.RESET_ALL}")

    # ID
    parts.append(f"{Fore.CYAN}[{task['id']}]{Style.RESET_ALL}")

    # Text (truncate if too long)
    text = task["text"]
    if len(text) > 40:
        text = text[:37] + "..."
    parts.append(f"{text:<40}")

    # Category
    if task.get("category"):
        parts.append(f"{Fore.YELLOW}{task['category']:<12}{Style.RESET_ALL}")
    else:
        parts.append(" " * 12)

    # Due date
    if task.get("due"):
        due_str = format_date(task["due"])
        if is_overdue(task["due"]) and task["status"] == "pending":
            parts.append(f"{Fore.RED}OVERDUE {due_str}{Style.RESET_ALL}")
        else:
            parts.append(f"{Fore.BLUE}{due_str}{Style.RESET_ALL}")

    return "  " + " ".join(parts)


def print_task_list(tasks: list[dict], show_all: bool = False, use_json: bool = False):
    """Print formatted task list."""
    if use_json:
        pending = [t for t in tasks if t["status"] == "pending"]
        overdue = [t for t in pending if is_overdue(t.get("due"))]
        print(json.dumps({
            "success": True,
            "tasks": tasks,
            "count": len(tasks),
            "pending_count": len(pending),
            "overdue_count": len(overdue)
        }))
        return

    pending = [t for t in tasks if t["status"] == "pending"]
    completed = [t for t in tasks if t["status"] == "completed"]

    if not tasks:
        print(f"\n{Fore.YELLOW}No tasks found.{Style.RESET_ALL}\n")
        return

    # Group pending by priority
    print(f"\nTODOs ({len(pending)} pending)")
    print("-" * 60)

    for priority in ["high", "medium", "low"]:
        priority_tasks = [t for t in pending if t.get("priority") == priority]
        if priority_tasks:
            color = {
                "high": Fore.RED,
                "medium": Fore.YELLOW,
                "low": Fore.WHITE
            }[priority]
            print(f"\n  {color}{priority.upper()}{Style.RESET_ALL}")
            for task in priority_tasks:
                print(format_task_line(task))

    # Show completed if requested
    if show_all and completed:
        print(f"\n  {Fore.GREEN}COMPLETED{Style.RESET_ALL}")
        for task in completed[:10]:  # Limit to recent 10
            print(format_task_line(task, show_status=True))
        if len(completed) > 10:
            print(f"  ... and {len(completed) - 10} more completed tasks")

    print()


def print_task_added(task: dict, use_json: bool = False):
    """Print task added confirmation."""
    if use_json:
        print(json.dumps({"success": True, "task": task}))
        return

    print(f"\n{Fore.GREEN}Added:{Style.RESET_ALL} \"{task['text']}\" [{task['id']}]")
    details = []
    if task.get("category"):
        details.append(f"Category: {task['category']}")
    details.append(f"Priority: {task['priority']}")
    if task.get("due"):
        details.append(f"Due: {format_date(task['due'])}")
    print(f"   {' | '.join(details)}\n")


def print_task_completed(task: dict, use_json: bool = False):
    """Print task completed confirmation."""
    if use_json:
        print(json.dumps({"success": True, "task": task}))
        return

    print(f"\n{Fore.GREEN}Completed:{Style.RESET_ALL} \"{task['text']}\" [{task['id']}]\n")


def print_task_deleted(task: dict, use_json: bool = False):
    """Print task deleted confirmation."""
    if use_json:
        print(json.dumps({"success": True, "task": task}))
        return

    print(f"\n{Fore.YELLOW}Deleted:{Style.RESET_ALL} \"{task['text']}\" [{task['id']}]\n")


def print_disambiguation(matches: list[dict], search_term: str, use_json: bool = False):
    """Print disambiguation message for multiple matches."""
    if use_json:
        print(json.dumps({
            "success": False,
            "error": "Multiple tasks match",
            "matches": matches
        }))
        return

    print(f"\n{Fore.YELLOW}Multiple tasks match \"{search_term}\":{Style.RESET_ALL}")
    for task in matches:
        print(format_task_line(task))
    print(f"\nUse the task ID to specify which one:\n  todos done {matches[0]['id']}\n")


def print_categories(categories: list[str], use_json: bool = False):
    """Print category list."""
    if use_json:
        print(json.dumps({"success": True, "categories": categories}))
        return

    print(f"\n{Fore.CYAN}Categories:{Style.RESET_ALL}")
    for cat in sorted(categories):
        print(f"  - {cat}")
    print()


def print_archived_list(tasks: list[dict], use_json: bool = False):
    """Print formatted archived task list."""
    if use_json:
        print(json.dumps({
            "success": True,
            "tasks": tasks,
            "count": len(tasks)
        }))
        return

    if not tasks:
        print(f"\n{Fore.YELLOW}No archived tasks.{Style.RESET_ALL}\n")
        return

    print(f"\nArchived Tasks ({len(tasks)})")
    print("-" * 60)

    for task in tasks:
        parts = []
        parts.append(f"{Fore.MAGENTA}[archived]{Style.RESET_ALL}")
        parts.append(f"{Fore.CYAN}[{task['id']}]{Style.RESET_ALL}")

        text = task["text"]
        if len(text) > 40:
            text = text[:37] + "..."
        parts.append(f"{text:<40}")

        if task.get("category"):
            parts.append(f"{Fore.YELLOW}{task['category']:<12}{Style.RESET_ALL}")

        if task.get("archived_at"):
            try:
                archived_dt = datetime.fromisoformat(task["archived_at"].rstrip("Z"))
                archived_str = archived_dt.strftime("%b %d").replace(" 0", " ")
                parts.append(f"{Fore.WHITE}archived {archived_str}{Style.RESET_ALL}")
            except ValueError:
                pass

        print("  " + " ".join(parts))

    print()


# =============================================================================
# CLI
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Personal TODO list manager",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--no-color", action="store_true", help="Disable colored output")

    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # List command (default)
    list_parser = subparsers.add_parser("list", help="List tasks")
    list_parser.add_argument("--all", "-a", action="store_true", help="Include completed tasks")
    list_parser.add_argument("--category", "-c", help="Filter by category")
    list_parser.add_argument("--priority", "-p", choices=VALID_PRIORITIES, help="Filter by priority")
    list_parser.add_argument("--due", "-d", choices=["today", "week", "overdue"], help="Filter by due date")

    # Add command
    add_parser = subparsers.add_parser("add", help="Add a new task")
    add_parser.add_argument("text", help="Task description")
    add_parser.add_argument("--category", "-c", help="Category")
    add_parser.add_argument("--priority", "-p", choices=VALID_PRIORITIES, help="Priority level")
    add_parser.add_argument("--due", "-d", help="Due date (e.g., 'tomorrow', 'friday', '2025-12-25')")

    # Done command
    done_parser = subparsers.add_parser("done", help="Mark a task as completed")
    done_parser.add_argument("task", help="Task ID or text to match")

    # Edit command
    edit_parser = subparsers.add_parser("edit", help="Edit a task")
    edit_parser.add_argument("task_id", help="Task ID")
    edit_parser.add_argument("--text", "-t", help="New task text")
    edit_parser.add_argument("--category", "-c", help="New category")
    edit_parser.add_argument("--priority", "-p", choices=VALID_PRIORITIES, help="New priority")
    edit_parser.add_argument("--due", "-d", help="New due date")

    # Remove command
    remove_parser = subparsers.add_parser("remove", aliases=["rm"], help="Delete a task")
    remove_parser.add_argument("task_id", help="Task ID")
    remove_parser.add_argument("--force", "-f", action="store_true", help="Skip confirmation")

    # Categories command
    cat_parser = subparsers.add_parser("categories", help="Manage categories")
    cat_subparsers = cat_parser.add_subparsers(dest="cat_command")
    cat_add = cat_subparsers.add_parser("add", help="Add a category")
    cat_add.add_argument("name", help="Category name")
    cat_remove = cat_subparsers.add_parser("remove", help="Remove a category")
    cat_remove.add_argument("name", help="Category name")

    # Remind command
    remind_parser = subparsers.add_parser("remind", help="Check and notify for due tasks")
    remind_parser.add_argument("--dry-run", action="store_true",
                               help="Show what would be notified without sending")
    remind_parser.add_argument("--overdue-only", action="store_true",
                               help="Only notify for overdue tasks")
    remind_parser.add_argument("--imessage", action="store_true",
                               help="Send reminder via iMessage instead of macOS notification")

    # Archive command
    archive_parser = subparsers.add_parser("archive", help="Archive old completed tasks")
    archive_parser.add_argument("--before", help="Archive tasks completed before this date")
    archive_parser.add_argument("--all", "-a", action="store_true",
                                dest="archive_all", help="Archive all completed tasks")

    # Archived command (view archived tasks)
    archived_parser = subparsers.add_parser("archived", help="View archived tasks")
    archived_parser.add_argument("--category", "-c", help="Filter by category")
    archived_parser.add_argument("--limit", "-n", type=int, default=20,
                                 help="Max number of tasks to show (default: 20)")

    args = parser.parse_args()
    use_json = args.json

    # Disable colors if requested
    if args.no_color:
        colorama_init(strip=True, convert=False)

    # Default to list if no command
    if args.command is None:
        args.command = "list"
        args.all = False
        args.category = None
        args.priority = None
        args.due = None

    # Execute command
    try:
        if args.command == "list":
            tasks = get_tasks(
                category=args.category,
                priority=args.priority,
                due_filter=args.due,
                include_all=args.all
            )
            print_task_list(tasks, show_all=args.all, use_json=use_json)

        elif args.command == "add":
            result = add_task(
                text=args.text,
                category=args.category,
                priority=args.priority,
                due=args.due
            )
            if result["success"]:
                print_task_added(result["task"], use_json=use_json)
            else:
                print_error(result["error"], use_json=use_json)
                sys.exit(1)

        elif args.command == "done":
            result = complete_task(args.task)
            if result["success"]:
                print_task_completed(result["task"], use_json=use_json)
            elif result.get("matches"):
                print_disambiguation(result["matches"], args.task, use_json=use_json)
                sys.exit(1)
            else:
                print_error(result["error"], use_json=use_json)
                sys.exit(1)

        elif args.command == "edit":
            updates = {}
            if args.text:
                updates["text"] = args.text
            if args.category is not None:
                updates["category"] = args.category
            if args.priority:
                updates["priority"] = args.priority
            if args.due is not None:
                updates["due"] = args.due

            if not updates:
                print_error("No updates specified", use_json=use_json)
                sys.exit(1)

            result = update_task(args.task_id, **updates)
            if result["success"]:
                if use_json:
                    print(json.dumps({"success": True, "task": result["task"]}))
                else:
                    print(f"\n{Fore.GREEN}Updated:{Style.RESET_ALL} \"{result['task']['text']}\" [{result['task']['id']}]\n")
            else:
                print_error(result["error"], use_json=use_json)
                sys.exit(1)

        elif args.command in ["remove", "rm"]:
            # Confirm deletion unless --force
            if not args.force and not use_json:
                data = load_todos()
                task = None
                for t in data["tasks"]:
                    if t["id"].lower() == args.task_id.lower():
                        task = t
                        break

                if task:
                    response = input(f"Delete \"{task['text']}\" [{task['id']}]? (y/N): ")
                    if response.lower() != "y":
                        print("Cancelled.")
                        sys.exit(0)

            result = delete_task(args.task_id)
            if result["success"]:
                print_task_deleted(result["task"], use_json=use_json)
            else:
                print_error(result["error"], use_json=use_json)
                sys.exit(1)

        elif args.command == "categories":
            if args.cat_command == "add":
                result = add_category(args.name)
                if result["success"]:
                    if use_json:
                        print(json.dumps(result))
                    else:
                        print(f"\n{Fore.GREEN}Added category:{Style.RESET_ALL} {args.name}\n")
                else:
                    print_error(result["error"], use_json=use_json)
                    sys.exit(1)

            elif args.cat_command == "remove":
                result = remove_category(args.name)
                if result["success"]:
                    if use_json:
                        print(json.dumps(result))
                    else:
                        print(f"\n{Fore.YELLOW}Removed category:{Style.RESET_ALL} {args.name}\n")
                else:
                    print_error(result["error"], use_json=use_json)
                    sys.exit(1)

            else:
                # List categories
                categories = get_categories()
                print_categories(categories, use_json=use_json)

        elif args.command == "remind":
            cmd_remind(
                overdue_only=args.overdue_only,
                dry_run=args.dry_run,
                use_json=use_json,
                imessage=args.imessage
            )

        elif args.command == "archive":
            result = archive_tasks(
                before_date=args.before,
                archive_all=args.archive_all
            )
            if result["success"]:
                if use_json:
                    print(json.dumps(result))
                else:
                    count = result["archived_count"]
                    if count == 0:
                        print(f"\n{Fore.YELLOW}No tasks to archive.{Style.RESET_ALL}\n")
                    else:
                        print(f"\n{Fore.GREEN}Archived {count} task(s).{Style.RESET_ALL}\n")
            else:
                print_error(result["error"], use_json=use_json)
                sys.exit(1)

        elif args.command == "archived":
            tasks = get_archived_tasks(
                category=args.category,
                limit=args.limit
            )
            print_archived_list(tasks, use_json=use_json)

    except KeyboardInterrupt:
        print("\nCancelled.")
        sys.exit(130)
    except Exception as e:
        print_error(str(e), use_json=use_json)
        sys.exit(1)


if __name__ == "__main__":
    main()
