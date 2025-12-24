#!/usr/bin/env python3
"""
MCP Server for Financial Briefing
Exposes financial data tools for Claude Code integration.
"""

import asyncio
import json
import logging
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
from typing import Any

from mcp.server.fastmcp import FastMCP

# Configure logging to stderr (required for stdio transport)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    stream=sys.stderr
)
logger = logging.getLogger(__name__)

# Path configuration
REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
DAILY_DIR = REPO_ROOT / "automations" / "daily"
CONFIG_DIR = REPO_ROOT / ".config"
WATCHLIST_PATH = CONFIG_DIR / "watchlist.json"

# Add daily directory to path for imports
sys.path.insert(0, str(DAILY_DIR))

from markets import (
    CryptoFetcher,
    StockFetcher,
    BriefingLogger,
    APIError,
    create_briefing_output
)

# Initialize MCP server
mcp = FastMCP("financial-briefing")

# Thread pool for sync operations
executor = ThreadPoolExecutor(max_workers=2)


def load_watchlist() -> dict[str, Any]:
    """Load watchlist from JSON config (MCP-safe version that doesn't exit)."""
    if not WATCHLIST_PATH.exists():
        return {"cryptocurrencies": [], "stocks": []}
    with open(WATCHLIST_PATH) as f:
        return json.load(f)


def save_watchlist(watchlist: dict[str, Any]) -> None:
    """Save watchlist to JSON config."""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    with open(WATCHLIST_PATH, "w") as f:
        json.dump(watchlist, f, indent=2)


@mcp.tool()
async def get_financial_briefing(
    crypto_only: bool = False,
    stocks_only: bool = False,
    log_to_file: bool = False
) -> dict:
    """
    Fetch financial briefing for tracked cryptocurrencies and stocks.

    Args:
        crypto_only: Only fetch cryptocurrency data
        stocks_only: Only fetch stock data
        log_to_file: Write briefing to log file

    Returns:
        Dictionary with timestamp, crypto data, stock data, and optional log_path
    """
    loop = asyncio.get_event_loop()
    watchlist = load_watchlist()

    crypto_data = None
    stock_data = None
    log_path = None

    # Fetch crypto data
    if not stocks_only:
        cryptos = watchlist.get("cryptocurrencies", [])
        if cryptos:
            try:
                fetcher = CryptoFetcher()
                crypto_data = await loop.run_in_executor(
                    executor, fetcher.fetch_prices, cryptos
                )
            except APIError as e:
                crypto_data = [{"error": str(e)}]

    # Fetch stock data (handles categorized structure)
    if not crypto_only:
        stocks_config = watchlist.get("stocks", {})
        # Handle both old flat array format and new categorized format
        if isinstance(stocks_config, list):
            # Legacy flat format
            if stocks_config:
                try:
                    fetcher = StockFetcher()
                    stock_data = {"individual": await loop.run_in_executor(
                        executor, fetcher.fetch_prices, stocks_config
                    )}
                except Exception as e:
                    stock_data = {"individual": [{"error": str(e)}]}
        else:
            # New categorized format
            stock_data = {}
            fetcher = StockFetcher()
            for category in ["index_funds", "etfs", "individual"]:
                category_stocks = stocks_config.get(category, [])
                if category_stocks:
                    try:
                        stock_data[category] = await loop.run_in_executor(
                            executor, fetcher.fetch_prices, category_stocks
                        )
                    except Exception as e:
                        stock_data[category] = [{"error": str(e)}]

    # Log to file if requested
    if log_to_file:
        try:
            log_output = create_briefing_output(crypto_data, stock_data, colored=False)
            briefing_logger = BriefingLogger()
            log_path = str(briefing_logger.write(log_output))
        except Exception as e:
            logger.error(f"Failed to write log: {e}")

    return {
        "timestamp": datetime.now().isoformat(),
        "crypto": crypto_data,
        "stocks": stock_data,
        "log_path": log_path
    }


@mcp.tool()
async def get_watchlist() -> dict:
    """
    Get the current watchlist of tracked cryptocurrencies and stocks.

    Returns:
        Dictionary with cryptocurrencies and stocks arrays
    """
    return load_watchlist()


@mcp.tool()
async def add_to_watchlist(
    asset_type: str,
    identifier: str,
    symbol: str,
    name: str,
    stock_category: str = "individual"
) -> dict:
    """
    Add a cryptocurrency or stock to the watchlist.

    Args:
        asset_type: Either "crypto" or "stock"
        identifier: For crypto: CoinGecko ID (e.g., "bitcoin"). For stocks: ticker symbol
        symbol: Display symbol (e.g., "BTC" or "AAPL")
        name: Full name (e.g., "Bitcoin" or "Apple Inc.")
        stock_category: For stocks: "index_funds", "etfs", or "individual" (default: "individual")

    Returns:
        Updated watchlist and success status
    """
    watchlist = load_watchlist()

    if asset_type == "crypto":
        existing_ids = [c["id"] for c in watchlist.get("cryptocurrencies", [])]
        if identifier in existing_ids:
            return {"success": False, "error": f"Crypto {identifier} already in watchlist"}

        if "cryptocurrencies" not in watchlist:
            watchlist["cryptocurrencies"] = []
        watchlist["cryptocurrencies"].append({
            "id": identifier,
            "symbol": symbol.upper(),
            "name": name
        })

    elif asset_type == "stock":
        # Validate category
        valid_categories = ["index_funds", "etfs", "individual"]
        if stock_category not in valid_categories:
            return {"success": False, "error": f"Invalid stock_category: {stock_category}. Use one of: {valid_categories}"}

        # Ensure stocks structure exists
        if "stocks" not in watchlist or isinstance(watchlist["stocks"], list):
            # Migrate from old format if needed
            old_stocks = watchlist.get("stocks", []) if isinstance(watchlist.get("stocks"), list) else []
            watchlist["stocks"] = {
                "index_funds": [],
                "etfs": [],
                "individual": old_stocks
            }

        # Check for duplicates across all categories
        for cat in valid_categories:
            existing_tickers = [s["ticker"] for s in watchlist["stocks"].get(cat, [])]
            if identifier.upper() in existing_tickers:
                return {"success": False, "error": f"Stock {identifier} already in watchlist ({cat})"}

        watchlist["stocks"][stock_category].append({
            "ticker": identifier.upper(),
            "name": name
        })
    else:
        return {"success": False, "error": f"Invalid asset_type: {asset_type}. Use 'crypto' or 'stock'"}

    save_watchlist(watchlist)
    return {"success": True, "watchlist": watchlist}


@mcp.tool()
async def remove_from_watchlist(
    asset_type: str,
    identifier: str
) -> dict:
    """
    Remove a cryptocurrency or stock from the watchlist.

    Args:
        asset_type: Either "crypto" or "stock"
        identifier: For crypto: CoinGecko ID. For stocks: ticker symbol

    Returns:
        Updated watchlist and success status
    """
    watchlist = load_watchlist()

    if asset_type == "crypto":
        original_count = len(watchlist.get("cryptocurrencies", []))
        watchlist["cryptocurrencies"] = [
            c for c in watchlist.get("cryptocurrencies", [])
            if c["id"] != identifier
        ]
        if len(watchlist["cryptocurrencies"]) == original_count:
            return {"success": False, "error": f"Crypto {identifier} not found in watchlist"}

    elif asset_type == "stock":
        stocks_config = watchlist.get("stocks", {})

        # Handle legacy flat format
        if isinstance(stocks_config, list):
            original_count = len(stocks_config)
            watchlist["stocks"] = [
                s for s in stocks_config
                if s["ticker"].upper() != identifier.upper()
            ]
            if len(watchlist["stocks"]) == original_count:
                return {"success": False, "error": f"Stock {identifier} not found in watchlist"}
        else:
            # New categorized format - search all categories
            found = False
            for category in ["index_funds", "etfs", "individual"]:
                category_stocks = stocks_config.get(category, [])
                original_count = len(category_stocks)
                watchlist["stocks"][category] = [
                    s for s in category_stocks
                    if s["ticker"].upper() != identifier.upper()
                ]
                if len(watchlist["stocks"][category]) < original_count:
                    found = True
                    break

            if not found:
                return {"success": False, "error": f"Stock {identifier} not found in watchlist"}
    else:
        return {"success": False, "error": f"Invalid asset_type: {asset_type}. Use 'crypto' or 'stock'"}

    save_watchlist(watchlist)
    return {"success": True, "watchlist": watchlist}


@mcp.tool()
async def get_single_asset_price(
    asset_type: str,
    identifier: str,
    name: str = ""
) -> dict:
    """
    Fetch price data for a single cryptocurrency or stock (not required to be in watchlist).

    Args:
        asset_type: Either "crypto" or "stock"
        identifier: CoinGecko ID for crypto (e.g., "bitcoin"), ticker for stocks (e.g., "TSLA")
        name: Optional display name

    Returns:
        Price data with all change percentages
    """
    loop = asyncio.get_event_loop()

    if asset_type == "crypto":
        try:
            fetcher = CryptoFetcher()
            result = await loop.run_in_executor(
                executor,
                fetcher.fetch_prices,
                [{"id": identifier, "symbol": identifier.upper(), "name": name or identifier}]
            )
            return {"success": True, "data": result[0] if result else None}
        except APIError as e:
            return {"success": False, "error": str(e)}

    elif asset_type == "stock":
        try:
            fetcher = StockFetcher()
            result = await loop.run_in_executor(
                executor,
                fetcher.fetch_prices,
                [{"ticker": identifier.upper(), "name": name or identifier}]
            )
            return {"success": True, "data": result[0] if result else None}
        except Exception as e:
            return {"success": False, "error": str(e)}
    else:
        return {"success": False, "error": f"Invalid asset_type: {asset_type}. Use 'crypto' or 'stock'"}


if __name__ == "__main__":
    mcp.run()
