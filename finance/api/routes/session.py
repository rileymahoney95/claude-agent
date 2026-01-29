"""Session API routes for generating advisor session prompts."""

from typing import Literal

from fastapi import APIRouter, Query
from fastapi.responses import PlainTextResponse

from session import generate_session_prompt

router = APIRouter(tags=["session"])


@router.get("/session")
def get_session(
    format: Literal["json", "markdown"] = Query(
        "json", description="Response format: 'json' for structured data, 'markdown' for raw prompt"
    ),
):
    """Generate an advisor session prompt.

    Combines current portfolio snapshot, goal status, and recommendations
    into a comprehensive prompt for Claude financial planning sessions.

    Format options:
    - json: Returns structured data with prompt and metadata
    - markdown: Returns only the raw markdown prompt (for clipboard copy)

    Note: This endpoint makes blocking HTTP calls (CoinGecko API via get_unified_portfolio).
    Using sync function so FastAPI runs it in a thread pool.
    """
    result = generate_session_prompt()

    if not result.get("success"):
        return result

    if format == "markdown":
        return PlainTextResponse(
            content=result.get("prompt", ""),
            media_type="text/markdown"
        )

    return result
