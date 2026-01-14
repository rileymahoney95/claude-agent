"""
Projection settings and asset class mapping utilities.

Handles projection configuration persistence, historical data retrieval,
and portfolio-to-asset-class mapping for the projection feature.
"""

import json
from datetime import date, datetime, timedelta
from typing import Optional

from config import (
    DEFAULT_PROJECTION_SETTINGS,
    CRYPTO_ETF_SYMBOLS,
    USE_DATABASE,
)
from profile import load_profile, save_profile


def get_projection_settings() -> dict:
    """
    Load projection settings from profile, merged with defaults.

    Returns settings with all fields guaranteed to be present.
    """
    profile = load_profile()
    settings = profile.get("projection_settings") or {}

    # Start with defaults
    result = DEFAULT_PROJECTION_SETTINGS.copy()

    # Merge top-level settings
    for key in ["inflation_rate", "withdrawal_rate", "target_retirement_age", "current_age"]:
        if key in settings and settings[key] is not None:
            result[key] = settings[key]

    # Handle nested expected_returns
    default_returns = DEFAULT_PROJECTION_SETTINGS.get("expected_returns", {}).copy()
    user_returns = settings.get("expected_returns") or {}
    default_returns.update(user_returns)
    result["expected_returns"] = default_returns

    return result


def update_projection_settings(updates: dict) -> dict:
    """
    Validate and update projection settings in profile.

    Args:
        updates: Partial settings to update

    Returns:
        {"success": True, "settings": {...}} or {"success": False, "error": "..."}
    """
    profile = load_profile()
    current = (profile.get("projection_settings") or {}).copy()

    # Validate return percentages (0-50% reasonable range)
    if "expected_returns" in updates:
        for asset_class, rate in updates["expected_returns"].items():
            if not isinstance(rate, (int, float)) or not 0 <= rate <= 50:
                return {"success": False, "error": f"Return rate for {asset_class} must be 0-50%"}
        # Merge with existing
        current_returns = current.get("expected_returns") or {}
        current_returns.update(updates["expected_returns"])
        current["expected_returns"] = current_returns

    # Validate other fields
    if "inflation_rate" in updates:
        rate = updates["inflation_rate"]
        if not isinstance(rate, (int, float)) or not 0 <= rate <= 20:
            return {"success": False, "error": "Inflation rate must be 0-20%"}
        current["inflation_rate"] = rate

    if "withdrawal_rate" in updates:
        rate = updates["withdrawal_rate"]
        if not isinstance(rate, (int, float)) or not 1 <= rate <= 10:
            return {"success": False, "error": "Withdrawal rate must be 1-10%"}
        current["withdrawal_rate"] = rate

    if "target_retirement_age" in updates:
        age = updates["target_retirement_age"]
        if not isinstance(age, int) or not 40 <= age <= 100:
            return {"success": False, "error": "Target retirement age must be 40-100"}
        current["target_retirement_age"] = age

    if "current_age" in updates:
        age = updates["current_age"]
        if not isinstance(age, int) or not 18 <= age <= 99:
            return {"success": False, "error": "Current age must be 18-99"}
        current["current_age"] = age

    # Save to profile
    profile["projection_settings"] = current
    profile["last_updated"] = date.today().isoformat()
    save_profile(profile)

    # Return merged with defaults
    return {"success": True, "settings": get_projection_settings()}


def map_portfolio_to_asset_classes(portfolio: dict) -> dict:
    """
    Map account categories to asset classes for projection calculations.

    The portfolio uses account categories (retirement, taxable_equities, crypto, cash)
    which need to be mapped to asset classes (equities, bonds, crypto, cash) for
    return calculations.

    Args:
        portfolio: Result from get_unified_portfolio() with by_category structure

    Returns:
        {equities: float, bonds: float, crypto: float, cash: float}
    """
    by_category = portfolio.get("by_category", {})

    # retirement + taxable_equities -> equities (both are equity holdings)
    # crypto -> crypto
    # cash -> cash
    # bonds -> bonds (0 if not tracked)

    retirement_value = by_category.get("retirement", {}).get("value", 0) or 0
    equities_value = by_category.get("taxable_equities", {}).get("value", 0) or 0
    crypto_value = by_category.get("crypto", {}).get("value", 0) or 0
    cash_value = by_category.get("cash", {}).get("value", 0) or 0

    return {
        "equities": retirement_value + equities_value,
        "bonds": 0,  # Not currently tracked
        "crypto": crypto_value,
        "cash": cash_value,
    }


def get_historical_portfolio(months: int = 12) -> dict:
    """
    Get historical portfolio data mapped to asset classes.

    Aggregates snapshots by month, taking the latest snapshot per account type,
    and maps holdings to asset classes.

    Args:
        months: Number of months of history to return

    Returns:
        {
            "success": True,
            "data_points": [{"date": ..., "total_value": ..., "by_asset_class": {...}}],
            "range": {"start": ..., "end": ..., "months_requested": ..., "months_available": ...}
        }
    """
    if USE_DATABASE:
        return _get_historical_from_database(months)
    else:
        return _get_historical_from_json(months)


def _get_historical_from_database(months: int) -> dict:
    """Get historical data from SQLite database."""
    from collections import defaultdict
    from database import get_connection

    with get_connection() as conn:
        cur = conn.cursor()

        # Get latest snapshot per month per account type using subquery (SQLite DISTINCT ON equivalent)
        cur.execute("""
            SELECT
                s.statement_date,
                strftime('%Y-%m', s.statement_date) as month,
                s.account_type,
                s.total_value,
                s.fdic_deposits,
                s.holdings
            FROM snapshots s
            INNER JOIN (
                SELECT
                    strftime('%Y-%m', statement_date) as month,
                    account_type,
                    MAX(statement_date) as max_date
                FROM snapshots
                WHERE statement_date >= DATE('now', '-' || ? || ' months')
                GROUP BY strftime('%Y-%m', statement_date), account_type
            ) latest ON strftime('%Y-%m', s.statement_date) = latest.month
                    AND s.account_type = latest.account_type
                    AND s.statement_date = latest.max_date
            ORDER BY s.statement_date
        """, (months,))

        rows = cur.fetchall()

    if not rows:
        return {
            "success": True,
            "data_points": [],
            "range": {
                "start": None,
                "end": None,
                "months_requested": months,
                "months_available": 0,
            }
        }

    # Aggregate by month in Python (SQLite doesn't have jsonb_agg)
    by_month = defaultdict(lambda: {"total_value": 0, "total_fdic": 0, "details": []})
    for row in rows:
        month_key = row["month"]
        by_month[month_key]["total_value"] += float(row["total_value"]) if row["total_value"] else 0
        by_month[month_key]["total_fdic"] += float(row["fdic_deposits"]) if row["fdic_deposits"] else 0
        by_month[month_key]["details"].append({
            "account_type": row["account_type"],
            "holdings": row["holdings"],
            "fdic_deposits": row["fdic_deposits"],
        })

    data_points = []
    for month_key in sorted(by_month.keys()):
        month_data = by_month[month_key]
        by_asset_class = _extract_asset_classes_from_details(
            month_data["details"],
            month_data["total_fdic"]
        )
        data_points.append({
            "date": f"{month_key}-01",  # First of month
            "total_value": month_data["total_value"],
            "by_asset_class": by_asset_class,
        })

    return {
        "success": True,
        "data_points": data_points,
        "range": {
            "start": data_points[0]["date"],
            "end": data_points[-1]["date"],
            "months_requested": months,
            "months_available": len(data_points),
        }
    }


def _get_historical_from_json(months: int) -> dict:
    """Get historical data from JSON files."""
    from collections import defaultdict
    from snapshots import load_snapshots

    cutoff = datetime.now() - timedelta(days=months * 30)
    all_snapshots = load_snapshots()

    # Group by month
    monthly = defaultdict(list)
    for snap in all_snapshots:
        date_str = snap.get("statement_date")
        if not date_str:
            continue
        try:
            snap_date = datetime.fromisoformat(date_str)
            if snap_date >= cutoff:
                month_key = snap_date.strftime("%Y-%m")
                monthly[month_key].append(snap)
        except ValueError:
            continue

    if not monthly:
        return {
            "success": True,
            "data_points": [],
            "range": {
                "start": None,
                "end": None,
                "months_requested": months,
                "months_available": 0,
            }
        }

    # For each month, get latest per account type and aggregate
    data_points = []
    for month_key in sorted(monthly.keys()):
        month_snaps = monthly[month_key]

        # Get latest per account type
        by_account = {}
        for snap in sorted(month_snaps, key=lambda x: x.get("statement_date", "")):
            account_type = snap.get("account_type")
            if account_type:
                by_account[account_type] = snap

        # Aggregate
        total_value = sum(
            s.get("portfolio", {}).get("total_value", 0)
            for s in by_account.values()
        )

        total_fdic = sum(
            s.get("portfolio", {}).get("fdic_deposits", 0) or 0
            for s in by_account.values()
        )

        # Build details structure
        details = [
            {
                "account_type": s.get("account_type"),
                "holdings": s.get("portfolio", {}).get("holdings", []),
                "fdic_deposits": s.get("portfolio", {}).get("fdic_deposits"),
            }
            for s in by_account.values()
        ]

        by_asset_class = _extract_asset_classes_from_details(details, total_fdic)

        data_points.append({
            "date": f"{month_key}-01",  # First of month
            "total_value": total_value,
            "by_asset_class": by_asset_class,
        })

    return {
        "success": True,
        "data_points": data_points,
        "range": {
            "start": data_points[0]["date"],
            "end": data_points[-1]["date"],
            "months_requested": months,
            "months_available": len(data_points),
        }
    }


def _extract_asset_classes_from_details(details: list, total_fdic: float) -> dict:
    """
    Extract asset class values from snapshot details.

    Args:
        details: List of {account_type, holdings, fdic_deposits} dicts
        total_fdic: Pre-summed FDIC deposits

    Returns:
        {equities: float, bonds: float, crypto: float, cash: float}
    """
    equities = 0.0
    crypto = 0.0

    for detail in details:
        holdings = detail.get("holdings", [])
        if isinstance(holdings, str):
            holdings = json.loads(holdings)

        for holding in holdings:
            symbol = (holding.get("symbol") or "").upper()
            value = holding.get("value", 0) or 0

            if symbol in CRYPTO_ETF_SYMBOLS:
                crypto += value
            else:
                equities += value

    return {
        "equities": round(equities, 2),
        "bonds": 0,  # Not tracked
        "crypto": round(crypto, 2),
        "cash": round(total_fdic, 2),
    }


def validate_scenario_settings(settings: dict) -> tuple[bool, Optional[str]]:
    """
    Validate scenario settings JSONB structure.

    Args:
        settings: Scenario settings dict

    Returns:
        (is_valid, error_message or None)
    """
    # Check allocation_overrides
    if settings.get("allocation_overrides") is not None:
        alloc = settings["allocation_overrides"]
        if not isinstance(alloc, dict):
            return False, "allocation_overrides must be an object"

        valid_keys = {"equities", "bonds", "crypto", "cash"}
        for key, value in alloc.items():
            if key not in valid_keys:
                return False, f"allocation_overrides contains invalid key: {key}"
            if not isinstance(value, (int, float)) or not 0 <= value <= 100:
                return False, f"allocation_overrides.{key} must be 0-100"

        total = sum(alloc.values())
        if abs(total - 100) > 0.1:
            return False, f"allocation_overrides must sum to 100, got {total:.1f}"

    # Check return_overrides
    if settings.get("return_overrides") is not None:
        returns = settings["return_overrides"]
        if not isinstance(returns, dict):
            return False, "return_overrides must be an object"

        valid_keys = {"equities", "bonds", "crypto", "cash"}
        for key, value in returns.items():
            if key not in valid_keys:
                return False, f"return_overrides contains invalid key: {key}"
            if not isinstance(value, (int, float)) or not 0 <= value <= 50:
                return False, f"return_overrides.{key} must be 0-50%"

    # Check monthly_contribution
    contrib = settings.get("monthly_contribution")
    if contrib is not None:
        if not isinstance(contrib, (int, float)) or contrib < 0:
            return False, "monthly_contribution must be a non-negative number"

    # Check projection_months
    months = settings.get("projection_months")
    if months is not None:
        if not isinstance(months, int) or not 60 <= months <= 480:
            return False, "projection_months must be an integer 60-480"

    return True, None
