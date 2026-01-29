"""
Recurring charge detection across credit card statements.

Identifies merchants that appear consistently across multiple months
with similar amounts.
"""

from database import get_connection
from config import RECURRING_MIN_MONTHS, RECURRING_AMOUNT_VARIANCE


def detect_recurring() -> list[dict]:
    """
    Detect recurring charges by analyzing transaction history.

    A charge is considered recurring if:
    - Same normalized_merchant appears in >= RECURRING_MIN_MONTHS distinct months
    - Amount variance is < RECURRING_AMOUNT_VARIANCE (20%)

    Returns list of recurring charge records sorted by average amount descending.
    """
    with get_connection() as conn:
        cur = conn.cursor()

        # Group by merchant, get monthly stats
        cur.execute("""
            SELECT
                normalized_merchant,
                category,
                COUNT(*) as total_occurrences,
                COUNT(DISTINCT STRFTIME('%Y-%m', transaction_date)) as months_seen,
                AVG(amount) as avg_amount,
                MIN(amount) as min_amount,
                MAX(amount) as max_amount,
                MIN(transaction_date) as first_seen,
                MAX(transaction_date) as last_seen
            FROM cc_transactions
            WHERE type = 'purchase'
            GROUP BY normalized_merchant
            HAVING months_seen >= ?
            ORDER BY avg_amount DESC
        """, (RECURRING_MIN_MONTHS,))

        results = []
        for row in cur.fetchall():
            avg = row["avg_amount"]
            min_amt = row["min_amount"]
            max_amt = row["max_amount"]

            # Check amount variance
            if avg > 0:
                variance = (max_amt - min_amt) / avg
            else:
                variance = 0

            if variance > RECURRING_AMOUNT_VARIANCE:
                continue

            results.append({
                "merchant": row["normalized_merchant"],
                "category": row["category"],
                "avg_amount": round(avg, 2),
                "min_amount": round(min_amt, 2),
                "max_amount": round(max_amt, 2),
                "months_seen": row["months_seen"],
                "total_occurrences": row["total_occurrences"],
                "first_seen": row["first_seen"],
                "last_seen": row["last_seen"],
                "is_active": True,  # Could check if last_seen is recent
            })

    # Mark transactions as recurring in the database
    _mark_recurring_transactions(results)

    return results


def _mark_recurring_transactions(recurring_list: list[dict]) -> None:
    """Update is_recurring flag on matching transactions."""
    if not recurring_list:
        return

    merchants = [r["merchant"] for r in recurring_list]

    with get_connection() as conn:
        cur = conn.cursor()
        # Reset all
        cur.execute("UPDATE cc_transactions SET is_recurring = 0")
        # Set recurring
        placeholders = ",".join("?" * len(merchants))
        cur.execute(f"""
            UPDATE cc_transactions
            SET is_recurring = 1
            WHERE normalized_merchant IN ({placeholders})
        """, merchants)
