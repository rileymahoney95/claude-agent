"""Holdings API routes."""

from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from holdings import (
    load_holdings,
    set_holding,
    delete_holding,
    check_holdings_freshness,
    fetch_crypto_prices,
    build_holdings_json,
)

router = APIRouter(tags=["holdings"])


class HoldingUpdate(BaseModel):
    """Request body for updating a holding."""

    value: float
    notes: Optional[str] = None


@router.get("/holdings")
def get_holdings():
    """Get all holdings with live crypto prices.

    Returns crypto holdings with current prices, bank accounts,
    and other manually tracked accounts.

    Note: Makes blocking HTTP calls to CoinGecko for prices.
    Using sync function so FastAPI runs it in a thread pool.
    """
    holdings = load_holdings()
    crypto_symbols = list(holdings.get("crypto", {}).keys())
    prices = fetch_crypto_prices(crypto_symbols) if crypto_symbols else {}
    return build_holdings_json(holdings, prices)


@router.put("/holdings/{category}/{key}")
def update_holding(category: str, key: str, update: HoldingUpdate):
    """Update a single holding value.

    Args:
        category: One of 'crypto', 'bank', or 'other'
        key: The holding key (e.g., 'BTC', 'hysa', 'hsa')
        update: New value and optional notes

    Note: File I/O is blocking. Using sync function so FastAPI runs it in a thread pool.
    """
    path = f"{category}.{key}"
    result = set_holding(path, update.value, update.notes)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


@router.delete("/holdings/{category}/{key}")
def remove_holding(category: str, key: str):
    """Delete a holding.

    Args:
        category: One of 'crypto', 'bank', or 'other'
        key: The holding key (e.g., 'BTC', 'hysa', 'hsa')

    Note: File I/O is blocking. Using sync function so FastAPI runs it in a thread pool.
    """
    path = f"{category}.{key}"
    result = delete_holding(path)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


@router.get("/holdings/freshness")
def get_freshness():
    """Check if holdings data is stale.

    Returns staleness status based on 7-day threshold.

    Note: File I/O is blocking. Using sync function so FastAPI runs it in a thread pool.
    """
    return check_holdings_freshness()
