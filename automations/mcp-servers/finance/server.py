#!/usr/bin/env python3
"""
Finance MCP Server - Parse brokerage statements and manage financial planning.

This server bridges to the finance CLI tool for all operations.
"""

import json
import subprocess
from pathlib import Path
from typing import Optional

from mcp.server.fastmcp import FastMCP

# Initialize MCP server
mcp = FastMCP("finance")

# Path to CLI tool
CLI_PATH = Path(__file__).resolve().parent.parent.parent / "tools" / "finance.sh"


def call_cli(*args) -> dict:
    """Call the finance CLI and return parsed JSON output."""
    cmd = [str(CLI_PATH), "--json", *args]
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=60
        )
        if result.stdout.strip():
            return json.loads(result.stdout)
        else:
            return {
                "success": False,
                "error": result.stderr or "No output from CLI"
            }
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Command timed out"}
    except json.JSONDecodeError as e:
        return {"success": False, "error": f"Failed to parse CLI output: {e}"}
    except Exception as e:
        return {"success": False, "error": str(e)}


@mcp.tool()
async def parse_statement(
    filename: str,
    no_update: bool = False
) -> dict:
    """
    Parse a brokerage statement PDF and save a snapshot.

    Args:
        filename: Name of the PDF file in personal/finance/statements/
        no_update: If True, don't update the planning template

    Returns:
        Dictionary with:
        - success: True/False
        - snapshot_path: Path to saved snapshot
        - template_updated: Whether template was updated
        - data: Parsed statement data (account info, holdings, income, etc.)
    """
    args = ["parse", filename]
    if no_update:
        args.append("--no-update")
    return call_cli(*args)


@mcp.tool()
async def get_finance_history(
    account: Optional[str] = None
) -> dict:
    """
    List historical financial snapshots.

    Args:
        account: Filter by account type (e.g., "roth_ira", "brokerage")

    Returns:
        Dictionary with:
        - success: True/False
        - snapshots: List of snapshot objects with date, account type, and values
        - count: Number of snapshots
    """
    args = ["history"]
    if account:
        args.extend(["--account", account])
    return call_cli(*args)


@mcp.tool()
async def get_finance_summary() -> dict:
    """
    Get a summary of the latest financial snapshot.

    Returns:
        Dictionary with:
        - success: True/False
        - data: Latest snapshot data including portfolio, holdings, and income
    """
    return call_cli("summary")


if __name__ == "__main__":
    mcp.run()
