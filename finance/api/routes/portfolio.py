"""Portfolio API routes."""

from fastapi import APIRouter, Query

from aggregator import get_unified_portfolio

router = APIRouter(tags=["portfolio"])


@router.get("/portfolio")
def get_portfolio(no_prices: bool = Query(False, description="Skip live crypto price fetch")):
    """Get unified portfolio view across all accounts.

    Returns portfolio aggregated from SoFi snapshots and manual holdings,
    with optional live crypto prices from CoinGecko.

    Note: This endpoint makes blocking HTTP calls (CoinGecko API).
    Using sync function so FastAPI runs it in a thread pool.
    """
    return get_unified_portfolio(include_crypto_prices=not no_prices)
