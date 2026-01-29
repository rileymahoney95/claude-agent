"""Expenses API routes for credit card transaction analysis."""

import shutil
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Query, UploadFile, File, HTTPException

from database import (
    init_database,
    get_cc_transactions,
    get_cc_statements,
    get_expense_summary,
    get_month_over_month,
    get_all_merchant_categories,
    cache_merchant_category,
    update_transaction_categories,
    save_cc_statement,
    save_cc_transactions,
    get_cached_merchant_category,
)
from config import EXPENSE_CATEGORIES
from parsers.chase_cc import is_chase_cc_statement, parse_chase_cc_statement
from recurring import detect_recurring
from insights import get_spending_insights

router = APIRouter(tags=["expenses"])


@router.get("/expenses")
def list_expenses(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    category: Optional[str] = Query(None, description="Filter by category"),
    merchant: Optional[str] = Query(None, description="Filter by merchant (partial match)"),
    limit: Optional[int] = Query(None, description="Limit number of results"),
):
    """List credit card transactions with optional filters."""
    init_database()
    transactions = get_cc_transactions(
        start_date=start_date,
        end_date=end_date,
        category=category,
        merchant=merchant,
        limit=limit,
    )
    return {"success": True, "transactions": transactions, "count": len(transactions)}


@router.get("/expenses/summary")
def expense_summary(
    months: int = Query(1, description="Number of months to include"),
):
    """Get expense summary with category breakdown."""
    init_database()
    summary = get_expense_summary(months)
    return {"success": True, **summary}


@router.get("/expenses/recurring")
def recurring_expenses():
    """Get detected recurring charges."""
    init_database()
    recurring = detect_recurring()
    return {"success": True, "recurring": recurring, "count": len(recurring)}


@router.get("/expenses/month-over-month")
def month_over_month(
    months: int = Query(6, description="Number of months to compare"),
):
    """Get monthly spending comparison."""
    init_database()
    data = get_month_over_month(months)
    return {"success": True, "months": data}


@router.get("/expenses/statements")
def list_cc_statements():
    """List all imported credit card statements."""
    init_database()
    statements = get_cc_statements()
    return {"success": True, "statements": statements, "count": len(statements)}


@router.post("/expenses/import")
def import_cc_statement(
    file: UploadFile = File(..., description="Credit card statement PDF"),
    no_categorize: bool = Query(False, description="Skip AI categorization"),
):
    """Upload and process a credit card statement PDF.

    Note: PDF parsing and optional AI categorization are blocking.
    Using sync function so FastAPI runs it in a thread pool.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp_path = Path(tmp.name)
        try:
            content = file.file.read()
            tmp.write(content)
            tmp.flush()

            if not is_chase_cc_statement(str(tmp_path)):
                tmp_path.unlink()
                raise HTTPException(
                    status_code=400,
                    detail="File is not a recognized Chase credit card statement",
                )

            data = parse_chase_cc_statement(str(tmp_path))
            tmp_path.unlink()

        except HTTPException:
            raise
        except Exception as e:
            if tmp_path.exists():
                tmp_path.unlink()
            raise HTTPException(status_code=500, detail=f"Parse failed: {e}")

    init_database()

    statement_id = save_cc_statement(data, source_file=file.filename)

    # Apply cached categories
    for txn in data["transactions"]:
        cached = get_cached_merchant_category(txn["normalized_merchant"])
        if cached:
            txn["category"] = cached["category"]

    # AI categorization
    if not no_categorize:
        try:
            from categorizer import categorize_transactions
            data["transactions"] = categorize_transactions(data["transactions"])
        except Exception:
            pass  # Gracefully skip

    txn_count = save_cc_transactions(statement_id, data["transactions"])

    # Invalidate insights cache since new data was imported
    try:
        from database import invalidate_insights_cache
        invalidate_insights_cache()
    except Exception:
        pass

    return {
        "success": True,
        "statement_id": statement_id,
        "card_type": data["card_type"],
        "statement_date": data["statement_date"],
        "transactions_imported": txn_count,
        "new_balance": data["summary"].get("new_balance"),
        "total_purchases": data["summary"].get("purchases"),
    }


@router.get("/expenses/categories")
def list_categories():
    """Get all merchant->category mappings."""
    init_database()
    categories = get_all_merchant_categories()
    return {"success": True, "categories": categories, "count": len(categories)}


@router.put("/expenses/categories/{merchant}")
def set_category(merchant: str, body: dict):
    """Override a merchant's category.

    Body: {"category": "Dining"}
    """
    category = body.get("category")
    if not category or category not in EXPENSE_CATEGORIES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid category. Valid: {', '.join(EXPENSE_CATEGORIES)}",
        )

    init_database()
    cache_merchant_category(merchant.lower(), category, confidence="manual")
    updated = update_transaction_categories(merchant.lower(), category)

    return {
        "success": True,
        "merchant": merchant.lower(),
        "category": category,
        "transactions_updated": updated,
    }


@router.get("/expenses/insights")
def spending_insights(
    months: int = Query(3, description="Number of months to analyze"),
):
    """Get AI-powered spending insights (cached)."""
    result = get_spending_insights(months=months)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to generate insights"))
    return result


@router.post("/expenses/insights/refresh")
def refresh_spending_insights(
    months: int = Query(3, description="Number of months to analyze"),
):
    """Regenerate spending insights (bypass cache)."""
    result = get_spending_insights(months=months, refresh=True)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Failed to generate insights"))
    return result
