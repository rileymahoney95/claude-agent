"""
Holdings management for the finance CLI (Phase 1: Data Consolidation).

Manages manual holdings (crypto, bank accounts, other) not captured by brokerage statements.
Fetches live crypto prices from CoinGecko.
Supports both JSON file storage and PostgreSQL database.
"""

import json
import time
from datetime import datetime
from threading import Lock

import requests
from colorama import Fore, Style
from tabulate import tabulate

from config import (
    HOLDINGS_PATH,
    DEFAULT_HOLDINGS,
    COINGECKO_API_BASE,
    CRYPTO_ID_MAP,
    USE_DATABASE,
)
from formatting import format_header


# Simple in-memory cache for crypto prices (avoids duplicate CoinGecko calls)
_crypto_price_cache: dict = {}
_crypto_price_cache_time: float = 0
_crypto_price_cache_lock = Lock()
CRYPTO_PRICE_CACHE_TTL = 60  # seconds


def _load_holdings_json() -> dict:
    """Load holdings from JSON file."""
    if HOLDINGS_PATH.exists():
        try:
            return json.loads(HOLDINGS_PATH.read_text())
        except (json.JSONDecodeError, IOError):
            pass
    return DEFAULT_HOLDINGS.copy()


def _save_holdings_json(holdings: dict) -> None:
    """Save holdings to JSON file."""
    HOLDINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    holdings["last_updated"] = datetime.now().strftime("%Y-%m-%d")
    HOLDINGS_PATH.write_text(json.dumps(holdings, indent=2))


def load_holdings() -> dict:
    """
    Load holdings from storage.

    When USE_DATABASE is enabled, reads from database.
    """
    if USE_DATABASE:
        try:
            from database import get_all_holdings
            return get_all_holdings()
        except Exception as e:
            print(f"Warning: Failed to read from database, falling back to JSON: {e}")

    return _load_holdings_json()


def save_holdings(holdings: dict) -> None:
    """
    Save holdings to storage.

    When USE_DATABASE is enabled, saves to both database and JSON (dual-write).
    """
    # Always save to JSON for backward compatibility
    _save_holdings_json(holdings)

    # Note: Database updates are handled per-holding in set_holding
    # This function is mainly for bulk JSON updates


def fetch_crypto_prices(symbols: list) -> dict:
    """
    Fetch current USD prices for crypto symbols from CoinGecko.

    Uses in-memory caching (60s TTL) to avoid duplicate API calls when
    multiple endpoints request prices in quick succession.

    Args:
        symbols: List of crypto symbols (e.g., ["BTC", "ETH"])

    Returns:
        Dict of symbol -> price (USD), or symbol -> None if not found
    """
    global _crypto_price_cache, _crypto_price_cache_time

    # Check cache first
    with _crypto_price_cache_lock:
        cache_age = time.time() - _crypto_price_cache_time
        if cache_age < CRYPTO_PRICE_CACHE_TTL and _crypto_price_cache:
            # Return cached prices for requested symbols
            result = {}
            for sym in symbols:
                sym_upper = sym.upper()
                result[sym_upper] = _crypto_price_cache.get(sym_upper)
            return result

    ids_to_fetch = []
    symbol_to_id = {}
    for sym in symbols:
        sym_upper = sym.upper()
        if sym_upper in CRYPTO_ID_MAP:
            cg_id = CRYPTO_ID_MAP[sym_upper]
            ids_to_fetch.append(cg_id)
            symbol_to_id[sym_upper] = cg_id

    if not ids_to_fetch:
        return {sym.upper(): None for sym in symbols}

    try:
        url = f"{COINGECKO_API_BASE}/simple/price"
        params = {
            "ids": ",".join(ids_to_fetch),
            "vs_currencies": "usd"
        }

        # Fast timeout - don't let slow CoinGecko block the API
        response = requests.get(url, params=params, timeout=3)
        if response.status_code == 429:
            # Rate limited - return None prices rather than waiting
            return {sym.upper(): None for sym in symbols}
        response.raise_for_status()

        data = response.json()

        result = {}
        for sym, cg_id in symbol_to_id.items():
            if cg_id in data and "usd" in data[cg_id]:
                result[sym] = data[cg_id]["usd"]
            else:
                result[sym] = None

        for sym in symbols:
            if sym.upper() not in result:
                result[sym.upper()] = None

        # Update cache
        with _crypto_price_cache_lock:
            _crypto_price_cache = result.copy()
            _crypto_price_cache_time = time.time()

        return result

    except Exception:
        return {sym.upper(): None for sym in symbols}


def set_holding(path: str, value: float, notes: str = None) -> dict:
    """
    Set a holding value.

    Args:
        path: Dot-notation path (e.g., "crypto.BTC", "bank.hysa", "other.hsa")
        value: Numeric value (quantity for crypto, balance for others)
        notes: Optional notes (crypto only, ignored for bank/other)

    Returns:
        {"success": True/False, "error": str, "holding": dict, "category": str}
    """
    # Always load from JSON for the update
    holdings = _load_holdings_json()

    parts = path.lower().split(".")
    if len(parts) != 2:
        return {"success": False, "error": f"Invalid path format: {path}. Use: crypto.BTC, bank.hysa, other.hsa"}

    category, key = parts

    category_map = {
        "crypto": "crypto",
        "bank": "bank_accounts",
        "bank_accounts": "bank_accounts",
        "other": "other",
    }

    if category not in category_map:
        return {"success": False, "error": f"Invalid category: {category}. Use: crypto, bank, other"}

    actual_category = category_map[category]

    if value < 0:
        return {"success": False, "error": "Value cannot be negative"}

    if actual_category == "crypto":
        key = key.upper()
        if key not in holdings["crypto"]:
            holdings["crypto"][key] = {}
        holdings["crypto"][key]["quantity"] = value
        if notes:
            holdings["crypto"][key]["notes"] = notes
        holding = {"symbol": key, "quantity": value, "notes": holdings["crypto"][key].get("notes")}
    else:
        if key not in holdings[actual_category]:
            holdings[actual_category][key] = {"name": key.replace("_", " ").title()}
        holdings[actual_category][key]["balance"] = value
        holding = {"key": key, "balance": value, "name": holdings[actual_category][key].get("name", key)}

    # Save to JSON
    _save_holdings_json(holdings)

    # Also save to database if enabled
    if USE_DATABASE:
        try:
            from database import set_holding as db_set_holding
            db_set_holding(actual_category, key, value, notes)
        except Exception as e:
            print(f"Warning: Failed to save to database: {e}")

    return {"success": True, "holding": holding, "category": actual_category}


def delete_holding(path: str) -> dict:
    """
    Delete a holding by path.

    Args:
        path: Dot-notation path (e.g., "crypto.BTC", "bank.hysa", "other.hsa")

    Returns:
        {"success": True/False, "error": str}
    """
    # Always load from JSON for the update
    holdings = _load_holdings_json()

    parts = path.lower().split(".")
    if len(parts) != 2:
        return {"success": False, "error": f"Invalid path format: {path}. Use: crypto.BTC, bank.hysa, other.hsa"}

    category, key = parts

    category_map = {
        "crypto": "crypto",
        "bank": "bank_accounts",
        "bank_accounts": "bank_accounts",
        "other": "other",
    }

    if category not in category_map:
        return {"success": False, "error": f"Invalid category: {category}. Use: crypto, bank, other"}

    actual_category = category_map[category]

    # For crypto, key is uppercase
    if actual_category == "crypto":
        key = key.upper()

    # Check if the holding exists
    if key not in holdings.get(actual_category, {}):
        return {"success": False, "error": f"Holding not found: {path}"}

    # Delete the holding from JSON
    del holdings[actual_category][key]
    _save_holdings_json(holdings)

    # Also delete from database if enabled
    if USE_DATABASE:
        try:
            from database import delete_holding as db_delete_holding
            db_delete_holding(actual_category, key)
        except Exception as e:
            print(f"Warning: Failed to delete from database: {e}")

    return {"success": True, "deleted": {"category": actual_category, "key": key}}


def check_holdings_freshness() -> dict:
    """
    Check if holdings data is fresh (updated within 7 days).

    Returns:
        {
            "success": True,
            "is_stale": bool,
            "last_updated": str or None,
            "days_since_update": int or None,
            "message": str
        }
    """
    holdings = load_holdings()
    last_updated = holdings.get("last_updated")

    if not last_updated:
        return {
            "success": True,
            "is_stale": True,
            "last_updated": None,
            "days_since_update": None,
            "message": "Holdings have never been updated. Run 'finance holdings set' to add your holdings."
        }

    try:
        last_date = datetime.fromisoformat(last_updated).date()
        today = datetime.now().date()
        days_since = (today - last_date).days

        if days_since > 7:
            return {
                "success": True,
                "is_stale": True,
                "last_updated": last_updated,
                "days_since_update": days_since,
                "message": f"Holdings last updated {days_since} days ago. Consider updating bank balances."
            }
        else:
            return {
                "success": True,
                "is_stale": False,
                "last_updated": last_updated,
                "days_since_update": days_since,
                "message": f"Holdings are current (updated {days_since} days ago)."
            }
    except ValueError:
        return {
            "success": True,
            "is_stale": True,
            "last_updated": last_updated,
            "days_since_update": None,
            "message": "Cannot parse last_updated date. Consider running 'finance holdings set' to refresh."
        }


def build_holdings_json(holdings: dict, crypto_prices: dict) -> dict:
    """Build JSON output structure for holdings command."""
    total_value = 0.0
    crypto_data = []

    for symbol, data in holdings.get("crypto", {}).items():
        qty = data.get("quantity", 0)
        price = crypto_prices.get(symbol)
        value = qty * price if price else None
        if value:
            total_value += value
        crypto_data.append({
            "symbol": symbol,
            "quantity": qty,
            "price": price,
            "value": value,
            "notes": data.get("notes")
        })

    bank_data = []
    for key, data in holdings.get("bank_accounts", {}).items():
        balance = data.get("balance", 0)
        total_value += balance
        bank_data.append({
            "key": key,
            "name": data.get("name", key),
            "balance": balance
        })

    other_data = []
    for key, data in holdings.get("other", {}).items():
        balance = data.get("balance", 0)
        total_value += balance
        other_data.append({
            "key": key,
            "name": data.get("name", key),
            "balance": balance
        })

    return {
        "success": True,
        "crypto": crypto_data,
        "bank_accounts": bank_data,
        "other": other_data,
        "total_value": total_value,
        "last_updated": holdings.get("last_updated")
    }


def display_holdings(holdings: dict, crypto_prices: dict) -> None:
    """Display all holdings with current values."""
    print()
    print(format_header("Holdings"))
    last_updated = holdings.get("last_updated", "Never")
    print(f"{Style.DIM}Last updated: {last_updated}{Style.RESET_ALL}")
    print()

    total_value = 0.0
    has_data = False

    # Crypto section
    crypto = holdings.get("crypto", {})
    if crypto:
        has_data = True
        print(format_header("Cryptocurrency"))
        rows = []
        for symbol, data in crypto.items():
            qty = data.get("quantity", 0)
            price = crypto_prices.get(symbol)
            if price:
                value = qty * price
                total_value += value
                rows.append([
                    f"{Fore.YELLOW}{symbol}{Style.RESET_ALL}",
                    f"{qty:.6f}".rstrip('0').rstrip('.'),
                    f"${price:,.2f}",
                    f"{Fore.GREEN}${value:,.2f}{Style.RESET_ALL}",
                    data.get("notes", "")
                ])
            else:
                rows.append([
                    f"{Fore.YELLOW}{symbol}{Style.RESET_ALL}",
                    f"{qty:.6f}".rstrip('0').rstrip('.'),
                    "N/A",
                    "N/A",
                    data.get("notes", "")
                ])

        headers = [
            f"{Style.DIM}Symbol{Style.RESET_ALL}",
            f"{Style.DIM}Quantity{Style.RESET_ALL}",
            f"{Style.DIM}Price{Style.RESET_ALL}",
            f"{Style.DIM}Value{Style.RESET_ALL}",
            f"{Style.DIM}Notes{Style.RESET_ALL}"
        ]
        print(tabulate(rows, headers=headers, tablefmt="plain"))
        print()

    # Bank accounts section
    bank = holdings.get("bank_accounts", {})
    if bank:
        has_data = True
        print(format_header("Bank Accounts"))
        rows = []
        for key, data in bank.items():
            balance = data.get("balance", 0)
            total_value += balance
            rows.append([
                data.get("name", key),
                f"{Fore.GREEN}${balance:,.2f}{Style.RESET_ALL}"
            ])
        headers = [
            f"{Style.DIM}Account{Style.RESET_ALL}",
            f"{Style.DIM}Balance{Style.RESET_ALL}"
        ]
        print(tabulate(rows, headers=headers, tablefmt="plain"))
        print()

    # Other accounts section
    other = holdings.get("other", {})
    if other:
        has_data = True
        print(format_header("Other Accounts"))
        rows = []
        for key, data in other.items():
            balance = data.get("balance", 0)
            total_value += balance
            rows.append([
                data.get("name", key),
                f"{Fore.GREEN}${balance:,.2f}{Style.RESET_ALL}"
            ])
        headers = [
            f"{Style.DIM}Account{Style.RESET_ALL}",
            f"{Style.DIM}Balance{Style.RESET_ALL}"
        ]
        print(tabulate(rows, headers=headers, tablefmt="plain"))
        print()

    if not has_data:
        print(f"{Style.DIM}No holdings found. Use 'finance holdings set' to add holdings.{Style.RESET_ALL}")
        print()
        print("Examples:")
        print("  finance holdings set crypto.BTC 0.5")
        print("  finance holdings set bank.hysa 12000")
        print("  finance holdings set other.hsa 2000")
        print()
        return

    # Total
    print("-" * 40)
    print(f"{Style.BRIGHT}Total Value: {Fore.GREEN}${total_value:,.2f}{Style.RESET_ALL}")
    print()
