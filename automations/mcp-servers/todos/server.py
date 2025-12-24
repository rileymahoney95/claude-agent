#!/usr/bin/env python3
"""
TODO List Manager - MCP Server

Provides Claude with tools to manage personal tasks via the todos CLI.
Uses subprocess calls to the CLI with --json output.
"""

import json
import subprocess
import sys
from pathlib import Path

from mcp.server.fastmcp import FastMCP

# CLI path
CLI_PATH = Path.home() / "claude-agent/automations/tools/todos.sh"

# Initialize MCP server
mcp = FastMCP("todos")


def log(message: str):
    """Log to stderr (safe for stdio transport)."""
    print(f"[todos-mcp] {message}", file=sys.stderr)


def call_cli(*args) -> dict:
    """Call todos CLI and return parsed JSON output."""
    cmd = [str(CLI_PATH), "--json", *args]
    log(f"Running: {' '.join(cmd)}")

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30
        )

        if result.returncode != 0:
            # Try to parse JSON error
            try:
                return json.loads(result.stdout)
            except json.JSONDecodeError:
                return {
                    "success": False,
                    "error": result.stderr.strip() or result.stdout.strip() or "Unknown error"
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


# =============================================================================
# MCP Tools
# =============================================================================

@mcp.tool()
async def get_todos(
    status: str = "pending",
    category: str = None,
    priority: str = None,
    due: str = None,
    include_all: bool = False
) -> dict:
    """
    Get tasks with optional filters.

    Args:
        status: Filter by status - "pending", "completed", or "all"
        category: Filter by category name (e.g., "work", "personal")
        priority: Filter by priority - "low", "medium", or "high"
        due: Filter by due date - "today", "week", or "overdue"
        include_all: Include completed tasks in results

    Returns:
        Dictionary with:
        - success: True/False
        - tasks: List of task objects
        - count: Total number of tasks
        - pending_count: Number of pending tasks
        - overdue_count: Number of overdue tasks
    """
    args = ["list"]

    if include_all or status == "all":
        args.append("--all")
    if category:
        args.extend(["--category", category])
    if priority:
        args.extend(["--priority", priority])
    if due:
        args.extend(["--due", due])

    return call_cli(*args)


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
        category: Optional category name (lowercase, no spaces). Auto-created if new.
        priority: "low", "medium", or "high" (default: "medium")
        due: Due date - ISO format (YYYY-MM-DD), "today", "tomorrow", "friday", "next monday", etc.

    Returns:
        Dictionary with:
        - success: True/False
        - task: The created task object (if successful)
        - error: Error message (if failed)
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
async def complete_todo(task_id: str) -> dict:
    """
    Mark a task as completed.

    Args:
        task_id: The 4-character hex task ID (get from get_todos)

    Returns:
        Dictionary with:
        - success: True/False
        - task: The completed task object (if successful)
        - error: Error message (if failed)
        - matches: List of matching tasks (if ambiguous - use exact ID)
    """
    return call_cli("done", task_id)


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

    Args:
        task_id: The 4-character hex task ID
        text: New task description
        category: New category name (or empty string to clear)
        priority: New priority - "low", "medium", or "high"
        due: New due date (or empty string to clear)

    Returns:
        Dictionary with:
        - success: True/False
        - task: The updated task object (if successful)
        - error: Error message (if failed)
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
async def delete_todo(task_id: str) -> dict:
    """
    Permanently delete a task.

    Args:
        task_id: The 4-character hex task ID

    Returns:
        Dictionary with:
        - success: True/False
        - task: The deleted task object (if successful)
        - error: Error message (if failed)
    """
    return call_cli("remove", task_id, "--force")


@mcp.tool()
async def get_categories() -> dict:
    """
    Get available task categories.

    Returns:
        Dictionary with:
        - success: True/False
        - categories: List of category names
    """
    return call_cli("categories")


@mcp.tool()
async def add_category(name: str) -> dict:
    """
    Add a new category.

    Args:
        name: Category name (lowercase, alphanumeric with hyphens, 1-30 chars)

    Returns:
        Dictionary with:
        - success: True/False
        - categories: Updated list of all categories (if successful)
        - error: Error message (if failed)
    """
    return call_cli("categories", "add", name)


@mcp.tool()
async def delete_category(name: str) -> dict:
    """
    Remove a category. Fails if any tasks use this category.

    Args:
        name: Category name to remove

    Returns:
        Dictionary with:
        - success: True/False
        - categories: Updated list of all categories (if successful)
        - error: Error message (if failed, e.g., "Cannot remove: used by N tasks")
    """
    return call_cli("categories", "remove", name)


# =============================================================================
# Main
# =============================================================================

if __name__ == "__main__":
    log("Starting TODO MCP server...")
    mcp.run()
