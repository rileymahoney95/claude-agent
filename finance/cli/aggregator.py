"""
Portfolio aggregator for the finance CLI (Phase 2: Unified Portfolio View).

Synthesizes multiple data sources into a unified portfolio view:
- SoFi snapshots (Roth IRA, Brokerage, Traditional IRA)
- Manual holdings (crypto, bank accounts, other)
- Live crypto prices from CoinGecko
"""

import time
from datetime import datetime
from threading import Lock
from typing import Optional

from config import (
    RETIREMENT_ACCOUNT_TYPES,
    CRYPTO_ETF_SYMBOLS,
    CATEGORY_ORDER,
    CATEGORY_NAMES,
    ACCOUNT_ROW_NAMES,
    SNAPSHOT_STALE_DAYS,
    HOLDINGS_STALE_DAYS,
)
from snapshots import get_latest_by_account_type
from holdings import load_holdings, fetch_crypto_prices


# Portfolio result cache (avoids redundant computation when /advice calls get_unified_portfolio)
_portfolio_cache: dict = {}  # keyed by include_crypto_prices
_portfolio_cache_time: float = 0
_portfolio_cache_lock = Lock()
PORTFOLIO_CACHE_TTL = 30  # seconds


def categorize_account(account_type: str) -> str:
    """
    Map account type to portfolio category.

    Args:
        account_type: e.g., "roth_ira", "brokerage", "traditional_ira"

    Returns:
        Category: "retirement" or "taxable_equities"
    """
    if account_type in RETIREMENT_ACCOUNT_TYPES:
        return "retirement"
    return "taxable_equities"


def categorize_symbol(symbol: str, account_type: str) -> str:
    """
    Determine category for a specific holding symbol.

    Crypto ETFs are always categorized as "crypto" regardless of account.

    Args:
        symbol: e.g., "QQQ", "BTC", "BITO"
        account_type: The account containing this symbol

    Returns:
        Category for this specific symbol
    """
    if symbol.upper() in CRYPTO_ETF_SYMBOLS:
        return "crypto"
    return categorize_account(account_type)


def check_data_freshness(snapshots: dict, holdings: dict) -> tuple:
    """
    Determine freshness of each data source and generate warnings.

    Args:
        snapshots: Dict from get_latest_by_account_type()
        holdings: Dict from load_holdings()

    Returns:
        (freshness_dict, warnings_list)
    """
    today = datetime.now().date()
    freshness = {
        "sofi_snapshots": None,
        "holdings": None,
        "crypto_prices": "live"
    }
    warnings = []

    # Check snapshot freshness
    if snapshots:
        latest_date = None
        for snap in snapshots.values():
            date_str = snap.get("statement_date")
            if date_str:
                try:
                    snap_date = datetime.fromisoformat(date_str).date()
                    if latest_date is None or snap_date > latest_date:
                        latest_date = snap_date
                except ValueError:
                    pass

        if latest_date:
            freshness["sofi_snapshots"] = latest_date.isoformat()
            days_old = (today - latest_date).days
            if days_old > SNAPSHOT_STALE_DAYS:
                warnings.append(
                    f"SoFi snapshots are {days_old} days old. Consider running 'finance pull'."
                )
    else:
        warnings.append("No SoFi snapshots found. Run 'finance pull' to import statements.")

    # Check holdings freshness
    last_updated = holdings.get("last_updated")
    if last_updated:
        freshness["holdings"] = last_updated
        try:
            holdings_date = datetime.fromisoformat(last_updated).date()
            days_old = (today - holdings_date).days
            if days_old > HOLDINGS_STALE_DAYS:
                warnings.append(
                    f"Holdings last updated {days_old} days ago. Consider updating bank balances."
                )
        except ValueError:
            pass
    else:
        freshness["holdings"] = None

    return freshness, warnings


def build_asset_list(
    snapshots: dict,
    holdings: dict,
    crypto_prices: dict
) -> list:
    """
    Build the by_asset list from all data sources.

    Args:
        snapshots: Dict from get_latest_by_account_type()
        holdings: Dict from load_holdings()
        crypto_prices: Dict of symbol -> USD price

    Returns:
        List of asset dicts sorted by value descending
    """
    assets = []

    # Process snapshots (securities and FDIC deposits)
    for account_type, snap in snapshots.items():
        portfolio = snap.get("portfolio", {})
        statement_date = snap.get("statement_date")
        account_name = ACCOUNT_ROW_NAMES.get(account_type, account_type.replace("_", " ").title())

        # Securities value (excluding crypto ETFs which get categorized separately)
        securities_value = 0.0
        crypto_etf_value = 0.0
        crypto_etf_names = []
        top_holdings = []

        for holding in portfolio.get("holdings", []):
            symbol = holding.get("symbol", "")
            value = holding.get("value", 0)

            if symbol.upper() in CRYPTO_ETF_SYMBOLS:
                crypto_etf_value += value
                crypto_etf_names.append(symbol)
            else:
                securities_value += value
                if len(top_holdings) < 3:
                    top_holdings.append(symbol)

        # Add securities as account asset
        if securities_value > 0:
            category = categorize_account(account_type)
            assets.append({
                "name": account_name,
                "category": category,
                "value": securities_value,
                "source": "snapshot",
                "as_of": statement_date,
                "details": {
                    "top_holdings": top_holdings
                }
            })

        # Add crypto ETFs separately
        if crypto_etf_value > 0:
            for holding in portfolio.get("holdings", []):
                symbol = holding.get("symbol", "")
                if symbol.upper() in CRYPTO_ETF_SYMBOLS:
                    assets.append({
                        "name": f"{symbol} ({account_name})",
                        "category": "crypto",
                        "value": holding.get("value", 0),
                        "source": "snapshot",
                        "as_of": statement_date,
                        "details": {
                            "symbol": symbol,
                            "quantity": holding.get("quantity"),
                            "price": holding.get("price")
                        }
                    })

        # Add FDIC deposits as cash
        fdic = portfolio.get("fdic_deposits", 0)
        if fdic > 0:
            assets.append({
                "name": f"FDIC Deposits ({account_name})",
                "category": "cash",
                "value": fdic,
                "source": "snapshot",
                "as_of": statement_date
            })

    # Process holdings - crypto
    for symbol, data in holdings.get("crypto", {}).items():
        qty = data.get("quantity", 0)
        price = crypto_prices.get(symbol)
        value = qty * price if price else None

        if value and value > 0:
            assets.append({
                "name": symbol,
                "category": "crypto",
                "value": value,
                "source": "holdings",
                "as_of": holdings.get("last_updated"),
                "details": {
                    "quantity": qty,
                    "price": price,
                    "notes": data.get("notes")
                }
            })

    # Process holdings - bank accounts
    for key, data in holdings.get("bank_accounts", {}).items():
        balance = data.get("balance", 0)
        if balance > 0:
            assets.append({
                "name": data.get("name", key.replace("_", " ").title()),
                "category": "cash",
                "value": balance,
                "source": "holdings",
                "as_of": holdings.get("last_updated")
            })

    # Process holdings - other (HSA goes to retirement, others to cash)
    for key, data in holdings.get("other", {}).items():
        balance = data.get("balance", 0)
        if balance > 0:
            # HSA is considered retirement savings
            category = "retirement" if key.lower() == "hsa" else "cash"
            assets.append({
                "name": data.get("name", key.replace("_", " ").title()),
                "category": category,
                "value": balance,
                "source": "holdings",
                "as_of": holdings.get("last_updated")
            })

    # Sort by value descending
    assets.sort(key=lambda x: x.get("value", 0), reverse=True)

    return assets


def build_category_summary(assets: list, total_value: float) -> dict:
    """
    Aggregate assets into by_category structure.

    Args:
        assets: List from build_asset_list()
        total_value: Total portfolio value for percentage calculation

    Returns:
        Dict with category -> {value, pct, assets}
    """
    categories = {cat: {"value": 0.0, "pct": 0.0, "assets": []} for cat in CATEGORY_ORDER}

    for asset in assets:
        cat = asset.get("category")
        if cat in categories:
            categories[cat]["value"] += asset.get("value", 0)
            categories[cat]["assets"].append(asset["name"])

    # Calculate percentages
    if total_value > 0:
        for cat in categories:
            categories[cat]["pct"] = round(categories[cat]["value"] / total_value * 100, 1)

    return categories


def get_unified_portfolio(include_crypto_prices: bool = True) -> dict:
    """
    Aggregates all data sources into a single portfolio view.

    Uses short-lived caching (30s TTL) to avoid redundant computation
    when multiple endpoints request portfolio data in quick succession.

    Args:
        include_crypto_prices: If True, fetch live prices from CoinGecko

    Returns:
        {
            "success": True/False,
            "error": str (only if success=False),
            "as_of": "2026-01-13",
            "data_freshness": {...},
            "warnings": [...],
            "total_value": float,
            "by_category": {...},
            "by_asset": [...]
        }
    """
    global _portfolio_cache, _portfolio_cache_time

    cache_key = str(include_crypto_prices)

    # Check cache first
    with _portfolio_cache_lock:
        cache_age = time.time() - _portfolio_cache_time
        if cache_age < PORTFOLIO_CACHE_TTL and cache_key in _portfolio_cache:
            return _portfolio_cache[cache_key]

    try:
        # Load data sources
        snapshots = get_latest_by_account_type()
        holdings = load_holdings()

        # Check if we have any data
        has_snapshots = bool(snapshots)
        has_holdings = bool(
            holdings.get("crypto") or
            holdings.get("bank_accounts") or
            holdings.get("other")
        )

        if not has_snapshots and not has_holdings:
            return {
                "success": False,
                "error": "No portfolio data found. Run 'finance pull' to import statements or 'finance holdings set' to add holdings."
            }

        # Fetch crypto prices if needed
        crypto_prices = {}
        if include_crypto_prices:
            crypto_symbols = list(holdings.get("crypto", {}).keys())
            if crypto_symbols:
                crypto_prices = fetch_crypto_prices(crypto_symbols)

        # Check data freshness
        freshness, warnings = check_data_freshness(snapshots, holdings)

        # Update freshness for crypto prices
        if not include_crypto_prices:
            freshness["crypto_prices"] = "skipped"
        elif not crypto_prices:
            freshness["crypto_prices"] = "unavailable"

        # Build asset list
        assets = build_asset_list(snapshots, holdings, crypto_prices)

        # Calculate total value
        total_value = sum(asset.get("value", 0) for asset in assets)

        # Build category summary
        by_category = build_category_summary(assets, total_value)

        result = {
            "success": True,
            "as_of": datetime.now().strftime("%Y-%m-%d"),
            "data_freshness": freshness,
            "warnings": warnings,
            "total_value": round(total_value, 2),
            "by_category": by_category,
            "by_asset": assets
        }

        # Update cache
        with _portfolio_cache_lock:
            _portfolio_cache[cache_key] = result
            _portfolio_cache_time = time.time()

        return result

    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to aggregate portfolio: {str(e)}"
        }
