"""
AI-powered merchant categorization using Claude API.

Uses the Anthropic SDK to batch-categorize merchants, with DB caching
to minimize API calls across imports.
"""

import json
import os
from typing import Optional

from config import EXPENSE_CATEGORIES, get_ai_model
from database import get_cached_merchant_category, cache_merchant_category


def categorize_transactions(transactions: list) -> list:
    """
    Categorize transactions using cached mappings and Claude API for unknowns.

    1. Check merchant_categories DB table for known mappings
    2. Batch all uncached normalized merchants into a single Claude API call
    3. Cache new mappings in DB
    4. Apply categories to transactions

    Returns the transactions list with 'category' field populated.
    """
    # Collect unique uncategorized merchants
    uncached_merchants = set()
    for txn in transactions:
        if txn.get("category"):
            continue
        merchant = txn["normalized_merchant"]
        cached = get_cached_merchant_category(merchant)
        if cached:
            txn["category"] = cached["category"]
        else:
            uncached_merchants.add(merchant)

    # Batch categorize uncached merchants via Claude API
    if uncached_merchants:
        new_mappings = _batch_categorize(list(uncached_merchants))

        # Cache and apply
        for merchant, category in new_mappings.items():
            cache_merchant_category(merchant, category, confidence="ai")

        # Apply to transactions
        for txn in transactions:
            if not txn.get("category"):
                merchant = txn["normalized_merchant"]
                if merchant in new_mappings:
                    txn["category"] = new_mappings[merchant]

    return transactions


def _batch_categorize(merchants: list[str]) -> dict[str, str]:
    """
    Categorize a list of merchant names using Claude API.

    Returns a dict mapping normalized_merchant -> category.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError(
            "ANTHROPIC_API_KEY not set. Set it to enable AI categorization, "
            "or use --no-categorize to skip."
        )

    try:
        import anthropic
    except ImportError:
        raise RuntimeError(
            "anthropic package not installed. Run: pip install anthropic"
        )

    client = anthropic.Anthropic(api_key=api_key)
    model = get_ai_model("finance", "categorizer")

    categories_str = ", ".join(EXPENSE_CATEGORIES)
    merchants_list = "\n".join(f"- {m}" for m in merchants)

    prompt = f"""Categorize each merchant into exactly one of these categories:
{categories_str}

Merchants to categorize:
{merchants_list}

Respond with ONLY a JSON object mapping each merchant name (exactly as given) to its category.
Example: {{"merchant name": "Category"}}

Rules:
- Use the exact merchant names as keys (lowercase, as provided)
- Use the exact category names from the list above
- If unsure, use "Other"
- Restaurants, bars, cafes -> "Dining"
- Grocery stores, supermarkets -> "Groceries"
- Uber, Lyft, parking, tolls -> "Transportation"
- Netflix, Spotify, subscriptions -> "Subscriptions"
- Amazon, retail -> "Shopping"
- Gas stations -> "Gas"
- Hotels, airlines, travel -> "Travel"
- Gyms, fitness -> "Health & Fitness"
"""

    response = client.messages.create(
        model=model,
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )

    # Parse response
    response_text = response.content[0].text.strip()

    # Extract JSON from response (handle markdown code blocks)
    if "```" in response_text:
        json_match = response_text.split("```")[1]
        if json_match.startswith("json"):
            json_match = json_match[4:]
        response_text = json_match.strip()

    try:
        mappings = json.loads(response_text)
    except json.JSONDecodeError:
        return {}

    # Validate categories
    valid = {}
    for merchant, category in mappings.items():
        if category in EXPENSE_CATEGORIES:
            valid[merchant] = category
        else:
            valid[merchant] = "Other"

    return valid
