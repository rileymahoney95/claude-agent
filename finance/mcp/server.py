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
# finance/mcp/server.py -> mcp -> finance -> finance.sh
CLI_PATH = Path(__file__).resolve().parent.parent / "finance.sh"


def call_cli(*args) -> dict:
    """Call the finance CLI and return parsed JSON output."""
    cmd = [str(CLI_PATH), *args, "--json"]
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
        filename: Name of the PDF file in personal/statements/
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


@mcp.tool()
async def pull_statement(
    latest_only: bool = False,
    no_update: bool = False
) -> dict:
    """
    Pull SoFi statements from Downloads, parse them, and show summary.

    By default, finds ALL SoFi/Apex statement PDFs in ~/Downloads,
    moves them to the statements directory, parses them, and saves snapshots.

    Args:
        latest_only: If True, only process the most recent statement (default: all)
        no_update: If True, don't update the planning template

    Returns:
        Dictionary with:
        - success: True/False
        - processed_count: Number of statements processed
        - statements: List of result objects for each statement
        - template_updated: Whether template was updated
        - errors: List of any errors encountered
    """
    args = ["pull"]
    if latest_only:
        args.append("--latest")
    if no_update:
        args.append("--no-update")
    return call_cli(*args)


@mcp.tool()
async def generate_planning_prompt() -> dict:
    """
    Generate a populated financial planning prompt.

    Creates a complete version of the planning template with:
    - Current asset values from account snapshots
    - Cash flow, household context, and tax info from saved profile
    - Financial goals from saved profile
    - Template instructions and examples stripped out

    The prompt is ready to paste directly into Claude for financial advice.

    Returns:
        Dictionary with:
        - success: True/False
        - prompt: The populated prompt text (ready to use with Claude)
        - accounts_included: List of account types in the prompt
        - as_of_dates: Dict of account_type -> statement date
    """
    return call_cli("plan")


@mcp.tool()
async def get_holdings() -> dict:
    """
    Get all manual holdings (crypto, bank accounts, other) with current values.

    Fetches live crypto prices from CoinGecko and combines with static
    bank/other account balances.

    Returns:
        Dictionary with:
        - success: True/False
        - crypto: List of crypto holdings with current prices and values
        - bank_accounts: List of bank account balances
        - other: List of other account balances (HSA, etc.)
        - total_value: Sum of all holdings
        - last_updated: When holdings were last manually updated
    """
    return call_cli("holdings")


@mcp.tool()
async def set_holding(
    path: str,
    value: float,
    notes: Optional[str] = None
) -> dict:
    """
    Set a holding value.

    Args:
        path: Dot-notation path for the holding:
            - crypto.BTC, crypto.ETH (quantity)
            - bank.hysa, bank.checking (balance)
            - other.hsa (balance)
        value: Numeric value (quantity for crypto, $ balance for others)
        notes: Optional notes (crypto only)

    Returns:
        Dictionary with:
        - success: True/False
        - error: Error message if failed
        - holding: The updated holding object
        - category: Which category was updated
    """
    args = ["holdings", "set", path, str(value)]
    if notes:
        args.extend(["--notes", notes])
    return call_cli(*args)


@mcp.tool()
async def check_holdings_freshness() -> dict:
    """
    Check if holdings data needs updating.

    Holdings become "stale" after 7 days without an update. This can be
    used by the advisor to prompt the user to refresh their balances.

    Returns:
        Dictionary with:
        - success: True/False
        - is_stale: True if > 7 days since last update
        - last_updated: Date of last update
        - days_since_update: Number of days since last update
        - message: Human-readable status message
    """
    return call_cli("holdings", "check")


@mcp.tool()
async def get_portfolio(include_prices: bool = True) -> dict:
    """
    Get unified portfolio view across all accounts.

    Aggregates multiple data sources into a single portfolio view:
    - SoFi account snapshots (Roth IRA, Brokerage, Traditional IRA)
    - Manual holdings (crypto, bank accounts, HSA)
    - Live crypto prices from CoinGecko

    Categories:
    - retirement: Roth IRA, Traditional IRA, 401k, HSA
    - taxable_equities: Brokerage account securities
    - crypto: Direct crypto holdings + crypto ETFs
    - cash: Bank accounts, FDIC deposits

    Args:
        include_prices: If True, fetch live crypto prices (default: True)

    Returns:
        Dictionary with:
        - success: True/False
        - as_of: Current date
        - data_freshness: When each data source was last updated
        - warnings: List of data staleness warnings
        - total_value: Total portfolio value
        - by_category: Breakdown by category with value, percentage, and assets
        - by_asset: List of individual assets with details
    """
    args = ["portfolio"]
    if not include_prices:
        args.append("--no-prices")
    return call_cli(*args)


@mcp.tool()
async def get_financial_advice(focus: str = "all") -> dict:
    """
    Analyzes portfolio and returns actionable financial recommendations.

    Synthesizes multiple data sources to provide personalized advice:
    - Current portfolio (SoFi statements + manual holdings)
    - Financial profile (goals, cash flow, constraints)
    - Market conditions (crypto, equities)

    Recommendations are prioritized (high/medium/low) based on:
    - Goal urgency (deadlines, on-track status)
    - Allocation drift from targets
    - Market opportunities

    Args:
        focus: What to focus on
            - "all": Complete analysis with all recommendations (default)
            - "goals": Goal progress and goal-related actions
            - "rebalance": Allocation analysis and rebalancing suggestions
            - "surplus": Where to direct monthly surplus

    Returns:
        Dictionary with:
        - success: True/False
        - portfolio_summary: Current values and allocation percentages
            - total_value: Total portfolio value
            - by_category: Breakdown by category (retirement, crypto, cash, etc.)
            - monthly_surplus: Available monthly surplus
        - goal_status: Status of each financial goal
            - target, current, progress_pct, deadline, on_track, monthly_needed
        - recommendations: Prioritized list of actions
            - type: "rebalance" | "surplus" | "opportunity" | "warning"
            - priority: "high" | "medium" | "low"
            - action: Specific recommended action
            - rationale: Why this is recommended
            - impact: Expected result of taking action
        - summary: Brief text summary of recommendations
        - data_freshness: When each data source was last updated
    """
    args = ["advise"]
    if focus and focus != "all":
        args.extend(["--focus", focus])
    return call_cli(*args)


if __name__ == "__main__":
    mcp.run()
