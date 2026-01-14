"""Advice API routes."""

from typing import Literal

from fastapi import APIRouter, Query

from advisor import get_advice

router = APIRouter(tags=["advice"])


@router.get("/advice")
def get_financial_advice(
    focus: Literal["all", "goals", "rebalance", "surplus", "opportunities"] = Query(
        "all", description="Filter recommendations by focus area"
    ),
):
    """Get prioritized financial recommendations.

    Returns actionable advice based on goals, allocation drift,
    market opportunities, and surplus allocation strategies.

    Focus options:
    - all: All recommendation types
    - goals: Goal-related recommendations only
    - rebalance: Allocation drift recommendations only
    - surplus: Surplus allocation recommendations only
    - opportunities: Market opportunity recommendations only

    Note: This endpoint makes blocking HTTP calls (CoinGecko API via get_unified_portfolio).
    Using sync function so FastAPI runs it in a thread pool.
    """
    return get_advice(focus=focus)
