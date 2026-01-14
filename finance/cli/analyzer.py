"""
Financial analyzer for the finance CLI (Phase 3: Analyzer).

Provides goal progress analysis, allocation analysis, and market context
to support financial recommendations.
"""

from datetime import datetime
from typing import Optional
import time

import requests
import yfinance as yf

from config import (
    COINGECKO_API_BASE,
    BASELINE_ALLOCATION,
    ALLOCATION_ADJUSTMENTS,
    OPPORTUNITY_THRESHOLDS,
    CATEGORY_ORDER,
)


# ============================================================================
# GOAL ANALYSIS
# ============================================================================

def calculate_months_between(start_date: str, end_date: str) -> int:
    """
    Calculate months between two YYYY-MM format dates.

    Args:
        start_date: Start date in YYYY-MM format
        end_date: End date in YYYY-MM format

    Returns:
        Number of months (positive if end > start)
    """
    start = datetime.strptime(start_date, "%Y-%m")
    end = datetime.strptime(end_date, "%Y-%m")
    return (end.year - start.year) * 12 + (end.month - start.month)


def get_goal_current_value(goal_type: str, portfolio: dict, profile: dict) -> Optional[float]:
    """
    Determine the current value toward a specific goal type.

    Mapping:
    - short_term (emergency fund): cash category value
    - medium_term: total portfolio value (runway for business venture)
    - long_term: total portfolio value (general wealth building)

    Args:
        goal_type: "short_term", "medium_term", or "long_term"
        portfolio: Dict from get_unified_portfolio()
        profile: Dict from load_profile()

    Returns:
        Current value toward goal, or None if not determinable
    """
    by_category = portfolio.get("by_category", {})

    if goal_type == "short_term":
        # Emergency fund maps to cash category
        cash_data = by_category.get("cash", {})
        return cash_data.get("value", 0)
    else:
        # Medium/long-term goals map to total portfolio
        return portfolio.get("total_value", 0)


def calculate_monthly_surplus(profile: dict) -> float:
    """
    Calculate monthly surplus from cash flow profile.

    Surplus = gross_income - shared_expenses - crypto_contributions
              - roth_contributions - hsa_contributions - discretionary

    Args:
        profile: Dict from load_profile()

    Returns:
        Monthly surplus amount
    """
    cf = profile.get("monthly_cash_flow", {})

    gross = cf.get("gross_income") or 0
    shared = cf.get("shared_expenses") or 0
    crypto = cf.get("crypto_contributions") or 0
    roth = cf.get("roth_contributions") or 0
    hsa = cf.get("hsa_contributions") or 0
    discretionary = cf.get("discretionary") or 0

    return gross - shared - crypto - roth - hsa - discretionary


def get_current_monthly_allocation(goal_type: str, profile: dict) -> Optional[float]:
    """
    Determine current monthly allocation toward a goal type.

    - short_term: surplus (what goes to savings/emergency fund)
    - medium_term: surplus (same logic, accumulating for runway)
    - long_term: total of surplus + retirement contributions

    Args:
        goal_type: "short_term", "medium_term", or "long_term"
        profile: Dict from load_profile()

    Returns:
        Monthly amount being allocated to this goal type
    """
    cf = profile.get("monthly_cash_flow", {})
    surplus = calculate_monthly_surplus(profile)

    if goal_type in ("short_term", "medium_term"):
        return surplus
    else:
        # Long-term includes retirement contributions
        roth = cf.get("roth_contributions") or 0
        hsa = cf.get("hsa_contributions") or 0
        return surplus + roth + hsa


def analyze_single_goal(
    goal_type: str,
    goal_data: dict,
    portfolio: dict,
    profile: dict
) -> dict:
    """
    Analyze progress toward a single goal.

    Args:
        goal_type: "short_term", "medium_term", or "long_term"
        goal_data: Dict with description, target, deadline
        portfolio: Dict from get_unified_portfolio()
        profile: Dict from load_profile()

    Returns:
        Analysis dict with progress metrics
    """
    description = goal_data.get("description")
    target = goal_data.get("target")
    deadline = goal_data.get("deadline")

    result = {
        "description": description,
        "target": target,
        "deadline": deadline,
    }

    if not description:
        result["status"] = "not_set"
        return result

    current = get_goal_current_value(goal_type, portfolio, profile)
    result["current"] = current

    # If no target, provide qualitative analysis only
    if target is None or target <= 0:
        result["progress_pct"] = None
        result["on_track"] = None
        result["monthly_required"] = None
        result["status"] = "qualitative"
        result["qualitative_note"] = "No numeric target set - track directional progress"
        return result

    # Calculate progress percentage
    progress_pct = (current / target) * 100 if target > 0 else 0
    result["progress_pct"] = round(progress_pct, 1)

    # Get current monthly allocation
    current_monthly = get_current_monthly_allocation(goal_type, profile)
    result["current_monthly"] = current_monthly

    # If no deadline, can't determine on_track status
    if not deadline:
        result["months_remaining"] = None
        result["monthly_required"] = None
        result["on_track"] = None
        result["months_at_current_pace"] = None
        result["status"] = "no_deadline"
        return result

    # Calculate months remaining
    today = datetime.now().strftime("%Y-%m")
    try:
        months_remaining = calculate_months_between(today, deadline)
    except ValueError:
        result["months_remaining"] = None
        result["monthly_required"] = None
        result["on_track"] = None
        result["status"] = "invalid_deadline"
        return result

    result["months_remaining"] = months_remaining

    # Calculate required monthly to hit goal
    remaining_amount = target - current
    if remaining_amount <= 0:
        result["monthly_required"] = 0
        result["on_track"] = True
        result["months_at_current_pace"] = 0
        result["status"] = "complete"
        return result

    if months_remaining <= 0:
        result["monthly_required"] = None
        result["on_track"] = False
        result["months_at_current_pace"] = None
        result["status"] = "past_deadline"
        return result

    monthly_required = remaining_amount / months_remaining
    result["monthly_required"] = round(monthly_required, 2)

    # Calculate months at current pace
    if current_monthly and current_monthly > 0:
        months_at_pace = remaining_amount / current_monthly
        result["months_at_current_pace"] = round(months_at_pace, 1)
    else:
        result["months_at_current_pace"] = None

    # Determine on_track status
    on_track = current_monthly >= monthly_required if current_monthly else False
    result["on_track"] = on_track
    result["status"] = "on_track" if on_track else "behind"

    return result


def analyze_goals(portfolio: dict, profile: dict) -> dict:
    """
    Analyze progress toward all financial goals.

    Args:
        portfolio: Dict from get_unified_portfolio()
        profile: Dict from load_profile()

    Returns:
        {
            "short_term": { ...goal analysis... },
            "medium_term": { ...goal analysis... },
            "long_term": { ...goal analysis... },
            "monthly_surplus": float,
            "summary": {
                "goals_on_track": int,
                "goals_behind": int,
                "goals_qualitative": int,
                "most_urgent": str or None
            }
        }
    """
    goals = profile.get("goals", {})
    surplus = calculate_monthly_surplus(profile)

    result = {
        "monthly_surplus": surplus,
    }

    on_track_count = 0
    behind_count = 0
    qualitative_count = 0
    most_urgent = None
    most_urgent_months = float('inf')

    for goal_type in ["short_term", "medium_term", "long_term"]:
        goal_data = goals.get(goal_type, {})
        analysis = analyze_single_goal(goal_type, goal_data, portfolio, profile)
        result[goal_type] = analysis

        status = analysis.get("status")
        if status == "on_track" or status == "complete":
            on_track_count += 1
        elif status == "behind" or status == "past_deadline":
            behind_count += 1
            months = analysis.get("months_remaining")
            if months is not None and months < most_urgent_months:
                most_urgent_months = months
                most_urgent = goal_type
        elif status in ("qualitative", "no_deadline"):
            qualitative_count += 1

    result["summary"] = {
        "goals_on_track": on_track_count,
        "goals_behind": behind_count,
        "goals_qualitative": qualitative_count,
        "most_urgent": most_urgent,
    }

    return result


# ============================================================================
# ALLOCATION ANALYSIS
# ============================================================================

def calculate_recommended_allocation(
    profile: dict,
    goal_analysis: dict
) -> tuple[dict, str]:
    """
    Calculate recommended allocation based on goals and situation.

    Uses baseline allocation from config, then applies adjustments:
    - Urgent cash goal (< 12 months): +10-20% cash
    - Maxing Roth: Prioritize retirement
    - Life stage adjustments

    Args:
        profile: Dict from load_profile()
        goal_analysis: Dict from analyze_goals()

    Returns:
        (allocation_dict, reasoning_string)
    """
    # Start with baseline
    recommended = BASELINE_ALLOCATION.copy()
    adjustments = []

    # Check for urgent short-term goal
    short_term = goal_analysis.get("short_term", {})
    months_remaining = short_term.get("months_remaining")
    on_track = short_term.get("on_track")

    if months_remaining is not None and months_remaining <= 12 and not on_track:
        # Urgent cash goal - increase cash allocation
        if months_remaining <= 6:
            cash_boost = ALLOCATION_ADJUSTMENTS["urgent_goal_boost_high"]
            adjustments.append(f"Emergency fund deadline in {months_remaining} months (urgent)")
        else:
            cash_boost = ALLOCATION_ADJUSTMENTS["urgent_goal_boost_low"]
            adjustments.append(f"Emergency fund deadline in {months_remaining} months")

        # Boost cash, reduce crypto and equities proportionally
        recommended["cash"] += cash_boost
        crypto_reduction = cash_boost * 0.6  # 60% from crypto
        equities_reduction = cash_boost * 0.4  # 40% from equities
        recommended["crypto"] -= crypto_reduction
        recommended["taxable_equities"] -= equities_reduction

    # Check if maxing Roth
    tax = profile.get("tax_situation", {})
    if tax.get("roth_maxed"):
        # Already maxing, maintain retirement focus
        adjustments.append("Roth IRA maxed - maintaining retirement priority")

    # Life stage: baby coming - need extra liquidity buffer
    short_desc = short_term.get("description", "").lower() if short_term.get("description") else ""
    if "baby" in short_desc or "child" in short_desc:
        if recommended["cash"] < 30:
            extra_cash = 5
            recommended["cash"] += extra_cash
            recommended["crypto"] -= extra_cash
            adjustments.append("New baby expected - extra liquidity buffer")

    # Normalize to 100%
    total = sum(recommended.values())
    if total != 100:
        factor = 100 / total
        recommended = {k: round(v * factor, 1) for k, v in recommended.items()}

    reasoning = "; ".join(adjustments) if adjustments else "Standard allocation for high risk tolerance"

    return recommended, reasoning


def analyze_allocation(portfolio: dict, profile: dict, goal_analysis: dict = None) -> dict:
    """
    Compare current allocation to recommended targets.

    Args:
        portfolio: Dict from get_unified_portfolio()
        profile: Dict from load_profile()
        goal_analysis: Optional pre-computed goal analysis (will compute if None)

    Returns:
        {
            "current": { category: pct, ... },
            "recommended": { category: pct, ... },
            "reasoning": str,
            "drift": { category: drift_pct, ... },
            "significant_drifts": [ list of categories with |drift| > 5 ],
            "rebalance_needed": bool
        }
    """
    if goal_analysis is None:
        goal_analysis = analyze_goals(portfolio, profile)

    # Extract current allocation percentages
    by_category = portfolio.get("by_category", {})
    current = {}
    for cat in CATEGORY_ORDER:
        cat_data = by_category.get(cat, {})
        current[cat] = cat_data.get("pct", 0)

    # Calculate recommended
    recommended, reasoning = calculate_recommended_allocation(profile, goal_analysis)

    # Calculate drift
    drift = {}
    significant_drifts = []
    for cat in CATEGORY_ORDER:
        diff = current.get(cat, 0) - recommended.get(cat, 0)
        drift[cat] = round(diff, 1)
        if abs(diff) >= 5:
            significant_drifts.append(cat)

    # Rebalance needed if any drift > 7%
    rebalance_needed = any(abs(d) >= 7 for d in drift.values())

    return {
        "current": current,
        "recommended": recommended,
        "reasoning": reasoning,
        "drift": drift,
        "significant_drifts": significant_drifts,
        "rebalance_needed": rebalance_needed,
    }


# ============================================================================
# MARKET CONTEXT
# ============================================================================

def fetch_crypto_market_data() -> dict:
    """
    Fetch crypto market data (BTC, ETH) with 7d and 30d changes.

    Returns:
        {
            "btc": { "price": float, "change_7d": float, "change_30d": float },
            "eth": { "price": float, "change_7d": float, "change_30d": float },
            "error": str or None
        }
    """
    try:
        url = f"{COINGECKO_API_BASE}/coins/markets"
        params = {
            "vs_currency": "usd",
            "ids": "bitcoin,ethereum",
            "sparkline": "false",
            "price_change_percentage": "7d,30d"
        }

        for attempt in range(3):
            response = requests.get(url, params=params, timeout=10)
            if response.status_code == 429:
                time.sleep(5 * (attempt + 1))
                continue
            response.raise_for_status()
            break
        else:
            return {"btc": None, "eth": None, "error": "Rate limited"}

        data = response.json()
        result = {"error": None}

        for coin in data:
            coin_id = coin.get("id")
            key = "btc" if coin_id == "bitcoin" else "eth" if coin_id == "ethereum" else None
            if key:
                result[key] = {
                    "price": coin.get("current_price"),
                    "change_7d": coin.get("price_change_percentage_7d_in_currency"),
                    "change_30d": coin.get("price_change_percentage_30d_in_currency"),
                }

        return result

    except Exception as e:
        return {"btc": None, "eth": None, "error": str(e)}


def fetch_sp500_data() -> dict:
    """
    Fetch S&P 500 data using VOO as proxy.

    Returns:
        {
            "price": float,
            "change_7d": float,
            "change_30d": float,
            "error": str or None
        }
    """
    try:
        ticker = yf.Ticker("VOO")
        hist = ticker.history(period="3mo")

        if hist.empty:
            return {"price": None, "change_7d": None, "change_30d": None, "error": "No data"}

        close = hist["Close"].dropna()
        current_price = close.iloc[-1]

        # 7d change (5 trading days)
        change_7d = None
        if len(close) > 5:
            price_7d = close.iloc[-6]
            change_7d = ((current_price - price_7d) / price_7d) * 100

        # 30d change (~21 trading days)
        change_30d = None
        if len(close) > 21:
            price_30d = close.iloc[-22]
            change_30d = ((current_price - price_30d) / price_30d) * 100

        return {
            "price": round(current_price, 2),
            "change_7d": round(change_7d, 2) if change_7d else None,
            "change_30d": round(change_30d, 2) if change_30d else None,
            "error": None,
        }

    except Exception as e:
        return {"price": None, "change_7d": None, "change_30d": None, "error": str(e)}


def detect_opportunities(crypto_data: dict, sp500_data: dict) -> list:
    """
    Detect market opportunities based on thresholds.

    Args:
        crypto_data: From fetch_crypto_market_data()
        sp500_data: From fetch_sp500_data()

    Returns:
        List of opportunity dicts
    """
    opportunities = []
    thresholds = OPPORTUNITY_THRESHOLDS

    # Check BTC
    btc = crypto_data.get("btc")
    if btc and btc.get("change_7d") is not None:
        change = btc["change_7d"]
        if change <= thresholds["crypto_strong_dca"]:
            opportunities.append({
                "asset": "BTC",
                "signal": "7d_drop",
                "magnitude": round(change, 1),
                "priority": "high",
                "suggestion": "Significant dip - strong DCA signal if aligned with strategy",
            })
        elif change <= thresholds["crypto_potential_dca"]:
            opportunities.append({
                "asset": "BTC",
                "signal": "7d_drop",
                "magnitude": round(change, 1),
                "priority": "medium",
                "suggestion": "Potential DCA opportunity",
            })

    # Check ETH
    eth = crypto_data.get("eth")
    if eth and eth.get("change_7d") is not None:
        change = eth["change_7d"]
        if change <= thresholds["crypto_strong_dca"]:
            opportunities.append({
                "asset": "ETH",
                "signal": "7d_drop",
                "magnitude": round(change, 1),
                "priority": "high",
                "suggestion": "Significant dip - strong DCA signal if aligned with strategy",
            })
        elif change <= thresholds["crypto_potential_dca"]:
            opportunities.append({
                "asset": "ETH",
                "signal": "7d_drop",
                "magnitude": round(change, 1),
                "priority": "medium",
                "suggestion": "Potential DCA opportunity",
            })

    # Check S&P 500
    if sp500_data.get("change_7d") is not None:
        change_7d = sp500_data["change_7d"]
        change_30d = sp500_data.get("change_30d")

        if change_30d is not None and change_30d <= thresholds["sp500_correction"]:
            opportunities.append({
                "asset": "S&P 500",
                "signal": "30d_drop",
                "magnitude": round(change_30d, 1),
                "priority": "high",
                "suggestion": "Correction territory - consider adding to index positions",
            })
        elif change_7d <= thresholds["sp500_pullback"]:
            opportunities.append({
                "asset": "S&P 500",
                "signal": "7d_drop",
                "magnitude": round(change_7d, 1),
                "priority": "medium",
                "suggestion": "Market pullback - consider adding to positions",
            })

    return opportunities


def determine_market_sentiment(crypto_data: dict) -> str:
    """
    Determine overall market sentiment based on crypto performance.

    Returns: "extreme_fear", "fear", "neutral", "greed", or "extreme_greed"
    """
    btc = crypto_data.get("btc", {})
    eth = crypto_data.get("eth", {})

    btc_7d = btc.get("change_7d", 0) if btc else 0
    eth_7d = eth.get("change_7d", 0) if eth else 0

    avg_change = (btc_7d + eth_7d) / 2 if btc_7d and eth_7d else btc_7d or eth_7d

    if avg_change <= -15:
        return "extreme_fear"
    elif avg_change <= -5:
        return "fear"
    elif avg_change >= 15:
        return "extreme_greed"
    elif avg_change >= 5:
        return "greed"
    return "neutral"


def get_market_context() -> dict:
    """
    Fetch relevant market data for recommendations.

    Returns:
        {
            "crypto": {
                "btc": { price, change_7d, change_30d },
                "eth": { price, change_7d, change_30d },
                "market_sentiment": str
            },
            "equities": {
                "sp500_price": float,
                "sp500_7d_change": float,
                "sp500_30d_change": float
            },
            "opportunities": [ ... ],
            "fetch_errors": [ ... ] or None
        }
    """
    crypto_data = fetch_crypto_market_data()
    sp500_data = fetch_sp500_data()

    errors = []
    if crypto_data.get("error"):
        errors.append(f"Crypto: {crypto_data['error']}")
    if sp500_data.get("error"):
        errors.append(f"S&P 500: {sp500_data['error']}")

    opportunities = detect_opportunities(crypto_data, sp500_data)
    sentiment = determine_market_sentiment(crypto_data)

    return {
        "crypto": {
            "btc": crypto_data.get("btc"),
            "eth": crypto_data.get("eth"),
            "market_sentiment": sentiment,
        },
        "equities": {
            "sp500_price": sp500_data.get("price"),
            "sp500_7d_change": sp500_data.get("change_7d"),
            "sp500_30d_change": sp500_data.get("change_30d"),
        },
        "opportunities": opportunities,
        "fetch_errors": errors if errors else None,
    }


# ============================================================================
# UNIFIED ANALYSIS
# ============================================================================

def get_full_analysis(portfolio: dict, profile: dict, include_market: bool = True) -> dict:
    """
    Run all analyses and return unified result.

    This is the main entry point for Phase 4 (Advisor) to call.

    Args:
        portfolio: Dict from get_unified_portfolio()
        profile: Dict from load_profile()
        include_market: Whether to fetch live market data

    Returns:
        {
            "goals": { ...from analyze_goals... },
            "allocation": { ...from analyze_allocation... },
            "market": { ...from get_market_context... } or None,
            "monthly_surplus": float,
            "total_portfolio_value": float,
        }
    """
    goal_analysis = analyze_goals(portfolio, profile)
    allocation_analysis = analyze_allocation(portfolio, profile, goal_analysis)
    market_context = get_market_context() if include_market else None

    return {
        "goals": goal_analysis,
        "allocation": allocation_analysis,
        "market": market_context,
        "monthly_surplus": goal_analysis.get("monthly_surplus", 0),
        "total_portfolio_value": portfolio.get("total_value", 0),
    }
