"""
AI-powered spending insights using Claude API.

Analyzes credit card transaction data to generate actionable insights
about spending patterns, anomalies, and trends. Results are cached
in the database to minimize API calls.
"""

import json
import os
from datetime import datetime, date

from config import get_ai_model
from database import (
    init_database,
    get_expense_summary,
    get_month_over_month,
    get_cc_transactions,
    get_cached_insights,
    save_insights,
)
from recurring import detect_recurring


# Default model ID (will be overridden by central config if available)
INSIGHT_MODEL = get_ai_model("finance", "insights")


def get_spending_insights(months: int = 3, refresh: bool = False) -> dict:
    """
    Generate AI-powered spending insights from transaction data.

    Args:
        months: Number of months of data to analyze
        refresh: If True, bypass cache and regenerate

    Returns:
        {success, insights, generated_at, months_analyzed, cached}
        or {success: False, error: "..."}
    """
    init_database()

    # Build cache key from current month and analysis window
    current_month = date.today().strftime("%Y-%m")
    month_key = f"{current_month}_{months}m"

    # Check cache unless refresh requested
    if not refresh:
        cached = get_cached_insights(month_key)
        if cached:
            return {
                "success": True,
                "insights": cached["insights"],
                "generated_at": cached["generated_at"],
                "months_analyzed": cached["months_analyzed"],
                "cached": True,
            }

    # Gather data
    summary = get_expense_summary(months)
    if summary["transaction_count"] == 0:
        return {
            "success": False,
            "error": "No expense data found. Import credit card statements first.",
        }

    mom = get_month_over_month(months)
    recurring = detect_recurring()

    # Get individual purchase transactions for the period
    date_range = summary.get("date_range", {})
    transactions = get_cc_transactions(
        start_date=date_range.get("start"),
        end_date=date_range.get("end"),
        txn_type="purchase",
    )

    # Build prompt
    prompt = _build_prompt(summary, mom, recurring, transactions, months)

    # Call Claude API
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return {
            "success": False,
            "error": "ANTHROPIC_API_KEY not set. Required for spending insights.",
        }

    try:
        import anthropic
    except ImportError:
        return {
            "success": False,
            "error": "anthropic package not installed. Run: pip install anthropic",
        }

    try:
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model=INSIGHT_MODEL,
            max_tokens=2048,
            system="You are a personal finance analyst. Analyze spending data and provide actionable insights. Be specific with numbers and percentages. Focus on patterns that are useful for budgeting decisions.",
            messages=[{"role": "user", "content": prompt}],
        )

        response_text = response.content[0].text.strip()
        insights = _parse_response(response_text)

        if not insights:
            return {
                "success": False,
                "error": "Failed to parse insights from AI response.",
            }

        # Cache results
        save_insights(month_key, months, insights, INSIGHT_MODEL)

        return {
            "success": True,
            "insights": insights,
            "generated_at": datetime.now().isoformat(),
            "months_analyzed": months,
            "cached": False,
        }

    except Exception as e:
        return {
            "success": False,
            "error": f"AI analysis failed: {e}",
        }


def _build_prompt(
    summary: dict,
    mom: list,
    recurring: list,
    transactions: list,
    months: int,
) -> str:
    """Build the analysis prompt from gathered data."""
    parts = []

    parts.append(f"Analyze my credit card spending over the last {months} month(s).\n")

    # Category breakdown
    parts.append("## Spending by Category")
    total = summary["total_purchases"]
    parts.append(f"Total spending: ${total:,.2f} across {summary['transaction_count']} transactions\n")
    for cat in summary["by_category"]:
        pct = (cat["total"] / total * 100) if total > 0 else 0
        parts.append(f"- {cat['category']}: ${cat['total']:,.2f} ({pct:.1f}%) [{cat['count']} txns]")

    # Month-over-month trend
    if len(mom) > 1:
        parts.append("\n## Monthly Totals")
        for m in mom:
            parts.append(f"- {m['month']}: ${m['purchases']:,.2f} ({m['transaction_count']} txns)")

        # Compute current vs prior average
        current = mom[-1]["purchases"] if mom[-1]["purchases"] else 0
        prior_months = [m["purchases"] for m in mom[:-1] if m["purchases"]]
        if prior_months:
            avg_prior = sum(prior_months) / len(prior_months)
            if avg_prior > 0:
                change_pct = ((current - avg_prior) / avg_prior) * 100
                parts.append(f"\nCurrent month: ${current:,.2f} vs prior average: ${avg_prior:,.2f} ({change_pct:+.1f}%)")

    # Recurring charges
    if recurring:
        parts.append("\n## Recurring Charges")
        monthly_recurring = 0
        for r in recurring:
            parts.append(f"- {r['merchant']}: ${r['avg_amount']:,.2f}/mo ({r.get('category', 'Uncategorized')})")
            monthly_recurring += r["avg_amount"]
        parts.append(f"\nTotal recurring: ${monthly_recurring:,.2f}/mo")

    # Top merchants by spend
    merchant_totals = {}
    for txn in transactions:
        m = txn["normalized_merchant"]
        merchant_totals[m] = merchant_totals.get(m, 0) + txn["amount"]

    top_merchants = sorted(merchant_totals.items(), key=lambda x: -x[1])[:15]
    if top_merchants:
        parts.append("\n## Top Merchants")
        for merchant, amount in top_merchants:
            parts.append(f"- {merchant}: ${amount:,.2f}")

    # Large transactions (potential outliers)
    large_txns = sorted(transactions, key=lambda t: -t["amount"])[:10]
    if large_txns:
        parts.append("\n## Largest Transactions")
        for txn in large_txns:
            parts.append(
                f"- {txn['transaction_date']}: {txn['normalized_merchant']} "
                f"${txn['amount']:,.2f} ({txn.get('category', 'Uncategorized')})"
            )

    parts.append("""
## Instructions

Provide 3-7 insights as a JSON array. Each insight must have these fields:
- "type": one of "trend", "anomaly", "saving_opportunity", "pattern", "warning"
- "severity": one of "info", "moderate", "important"
- "title": short headline (5-10 words)
- "description": 1-2 sentence explanation with specific numbers
- "data": object with relevant numbers (e.g. {"amount": 150.00, "category": "Dining", "change_pct": 25.0})

Focus on:
1. Unusual spending spikes or drops vs prior months
2. Categories where spending is notably high
3. Potential savings from recurring charges
4. Large one-time purchases that skew the data
5. Positive trends worth maintaining

Respond with ONLY the JSON array, no other text.""")

    return "\n".join(parts)


def _parse_response(response_text: str) -> list | None:
    """Parse the AI response into a list of insights."""
    text = response_text.strip()

    # Handle markdown code blocks
    if "```" in text:
        parts = text.split("```")
        if len(parts) >= 2:
            text = parts[1]
            if text.startswith("json"):
                text = text[4:]
            text = text.strip()

    try:
        insights = json.loads(text)
    except json.JSONDecodeError:
        return None

    if not isinstance(insights, list):
        return None

    # Validate required fields
    required = {"type", "severity", "title", "description", "data"}
    valid = []
    for insight in insights:
        if not isinstance(insight, dict):
            continue
        if required.issubset(insight.keys()):
            valid.append(insight)

    return valid if valid else None
