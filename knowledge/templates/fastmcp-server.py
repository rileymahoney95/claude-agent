#!/usr/bin/env python3
"""
FastMCP Server Template

A minimal MCP server using the FastMCP Python SDK.
Includes pattern for wrapping synchronous code with async executors.

Usage:
1. Copy this template
2. Add your tools using @mcp.tool() decorator
3. Install: pip install mcp
4. Register in .mcp.json
"""

import asyncio
import json
import logging
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

from mcp.server.fastmcp import FastMCP

# Configure logging to stderr (required for stdio transport - stdout is for MCP protocol)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    stream=sys.stderr
)
logger = logging.getLogger(__name__)

# Path configuration
SCRIPT_DIR = Path(__file__).resolve().parent

# Initialize MCP server
mcp = FastMCP("my-server-name")

# Thread pool for running sync code without blocking
executor = ThreadPoolExecutor(max_workers=2)


# --- Helper Functions ---

def load_json_config(path: Path) -> dict[str, Any]:
    """Load JSON config file, returning empty dict if not found."""
    if not path.exists():
        return {}
    with open(path) as f:
        return json.load(f)


def save_json_config(path: Path, data: dict[str, Any]) -> None:
    """Save data to JSON config file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)


# --- Sync Function Example (to be wrapped) ---

def fetch_data_sync(query: str) -> dict:
    """
    Example synchronous function that might do I/O.
    Replace with your actual implementation.
    """
    # Simulating work
    import time
    time.sleep(0.1)
    return {"query": query, "result": "data"}


# --- MCP Tools ---

@mcp.tool()
async def my_async_tool(param: str) -> dict:
    """
    Example tool that wraps sync code.

    Args:
        param: Description of the parameter

    Returns:
        Dictionary with results
    """
    loop = asyncio.get_event_loop()

    try:
        result = await loop.run_in_executor(
            executor,
            fetch_data_sync,
            param
        )
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"Tool failed: {e}")
        return {"success": False, "error": str(e)}


@mcp.tool()
async def simple_tool(value: str, optional_flag: bool = False) -> dict:
    """
    Example simple tool without sync wrapping.

    Args:
        value: The main input value
        optional_flag: Optional boolean parameter

    Returns:
        Processed result
    """
    return {
        "processed": value.upper() if optional_flag else value,
        "flag_was_set": optional_flag
    }


# --- Entry Point ---

if __name__ == "__main__":
    mcp.run()
