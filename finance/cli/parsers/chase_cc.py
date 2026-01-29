"""
Chase credit card statement parser.

Parses monthly credit card statements from Chase (Sapphire Preferred, etc.).
"""

import re
from datetime import datetime
from typing import Optional

import pdfplumber


def is_chase_cc_statement(pdf_path: str) -> bool:
    """Check if a PDF is a Chase credit card statement."""
    try:
        with pdfplumber.open(pdf_path) as pdf:
            if len(pdf.pages) < 1:
                return False
            text = pdf.pages[0].extract_text() or ""
            upper = text.upper()
            return (
                ("SAPPHIRE" in upper or "CHASE" in upper or "CARDMEMBER" in upper)
                and "NEW BALANCE" in upper
                and "ACCOUNT NUMBER" in upper
            )
    except Exception:
        return False


def parse_chase_cc_statement(pdf_path: str) -> dict:
    """
    Parse a Chase credit card statement PDF.

    Returns:
        Dictionary with statement summary, transactions, and rewards.
    """
    with pdfplumber.open(pdf_path) as pdf:
        all_text = ""
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            all_text += page_text + "\n"

    result = {
        "statement_date": None,
        "card_type": _detect_card_type(all_text),
        "account_last_four": None,
        "period": {"start": None, "end": None},
        "summary": {
            "previous_balance": None,
            "payments_credits": None,
            "purchases": None,
            "fees": None,
            "interest": None,
            "new_balance": None,
            "credit_limit": None,
        },
        "transactions": [],
        "rewards": {"points_earned": None, "points_balance": None},
    }

    _extract_account_info(all_text, result)
    _extract_summary(all_text, result)
    _extract_transactions(all_text, result)
    _extract_rewards(all_text, result)

    # Statement date is the period end
    if result["period"]["end"]:
        result["statement_date"] = result["period"]["end"]

    return result


def _detect_card_type(text: str) -> str:
    """Detect Chase card type from statement text."""
    upper = text.upper()
    if "SAPPHIRE PREFERRED" in upper:
        return "chase_sapphire_preferred"
    if "SAPPHIRE RESERVE" in upper:
        return "chase_sapphire_reserve"
    if "FREEDOM UNLIMITED" in upper:
        return "chase_freedom_unlimited"
    if "FREEDOM FLEX" in upper:
        return "chase_freedom_flex"
    if "FREEDOM" in upper:
        return "chase_freedom"
    return "chase_credit_card"


def _extract_account_info(text: str, result: dict) -> None:
    """Extract account number and statement period."""
    # Account last four - pattern: "Account Number: ...1234" or "ending in 1234"
    acct_match = re.search(r'(?:Account\s*Number|ending\s+in)[:\s]*\.{0,10}\s*(\d{4})', text, re.IGNORECASE)
    if acct_match:
        result["account_last_four"] = acct_match.group(1)

    # Statement period - look for "Opening/Closing Date" or date range
    # Pattern: "Opening/Closing Date 12/06/25 - 01/05/26"
    period_match = re.search(
        r'Opening/Closing\s+Date\s+(\d{1,2}/\d{1,2}/\d{2,4})\s*[-–]\s*(\d{1,2}/\d{1,2}/\d{2,4})',
        text, re.IGNORECASE,
    )
    if period_match:
        result["period"]["start"] = _parse_date_mdy(period_match.group(1))
        result["period"]["end"] = _parse_date_mdy(period_match.group(2))
    else:
        # Alternative: "Statement Date: January 5, 2026" style
        stmt_date_match = re.search(
            r'(?:Statement\s+(?:Closing\s+)?Date|through)\s*:?\s*'
            r'([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})',
            text, re.IGNORECASE,
        )
        if stmt_date_match:
            try:
                date_str = stmt_date_match.group(1).replace(",", "")
                dt = datetime.strptime(date_str, "%B %d %Y")
                result["period"]["end"] = dt.strftime("%Y-%m-%d")
            except ValueError:
                pass


def _extract_summary(text: str, result: dict) -> None:
    """Extract account summary (balances, payments, purchases)."""
    summary = result["summary"]

    # Previous Balance
    prev_match = re.search(r'Previous\s+Balance\s+\$?([\d,]+\.\d{2})', text, re.IGNORECASE)
    if prev_match:
        summary["previous_balance"] = _parse_money(prev_match.group(1))

    # Payments and Credits (usually negative)
    pay_match = re.search(r'Payment(?:s)?(?:,?\s*Credits)?(?:\s+and\s+Other\s+Credits)?\s+-?\$?([\d,]+\.\d{2})', text, re.IGNORECASE)
    if pay_match:
        summary["payments_credits"] = -_parse_money(pay_match.group(1))

    # Purchases
    purch_match = re.search(r'(?:New\s+)?Purchases?\s+(?:and\s+Adjustments\s+)?\+?\$?([\d,]+\.\d{2})', text, re.IGNORECASE)
    if purch_match:
        summary["purchases"] = _parse_money(purch_match.group(1))

    # Fees
    fees_match = re.search(r'Fees\s+(?:Charged\s+)?\+?\$?([\d,]+\.\d{2})', text, re.IGNORECASE)
    if fees_match:
        summary["fees"] = _parse_money(fees_match.group(1))

    # Interest
    int_match = re.search(r'Interest\s+Charged\s+\+?\$?([\d,]+\.\d{2})', text, re.IGNORECASE)
    if int_match:
        summary["interest"] = _parse_money(int_match.group(1))

    # New Balance
    new_bal_match = re.search(r'New\s+Balance\s+\$?([\d,]+\.\d{2})', text, re.IGNORECASE)
    if new_bal_match:
        summary["new_balance"] = _parse_money(new_bal_match.group(1))

    # Credit Limit / Total Credit Line
    limit_match = re.search(r'(?:Total\s+)?Credit\s+(?:Limit|Line)\s+\$?([\d,]+(?:\.\d{2})?)', text, re.IGNORECASE)
    if limit_match:
        summary["credit_limit"] = _parse_money(limit_match.group(1))


def _extract_transactions(text: str, result: dict) -> None:
    """Extract individual transactions from statement text."""
    period_start = result["period"].get("start")
    period_end = result["period"].get("end")

    # Transaction pattern: MM/DD  description  amount
    # Chase statements typically show: "12/07 TST*BLONDIES SPORTS BAR Fort Lauderda FL 131.28"
    # or with a separate post date: "12/07 12/08 TST*BLONDIES SPORTS BAR Fort Lauderda FL 131.28"
    txn_pattern = re.compile(
        r'^(\d{1,2}/\d{1,2})\s+'          # Transaction date MM/DD
        r'(?:\d{1,2}/\d{1,2}\s+)?'         # Optional post date MM/DD
        r'(.+?)\s+'                         # Description (non-greedy)
        r'(-?[\d,]+\.\d{2})$',             # Amount
        re.MULTILINE,
    )

    # Determine which section we're in to classify transaction type
    lines = text.split('\n')
    current_section = None
    section_markers = {
        'payment': re.compile(r'PAYMENT(?:S)?,?\s*CREDITS', re.IGNORECASE),
        'purchase': re.compile(r'PURCHASE(?:S)?', re.IGNORECASE),
    }

    for line in lines:
        line_stripped = line.strip()

        # Detect section headers
        for section_name, pattern in section_markers.items():
            if pattern.search(line_stripped) and len(line_stripped) < 60:
                current_section = section_name

        match = txn_pattern.match(line_stripped)
        if not match:
            continue

        date_str = match.group(1)
        description = match.group(2).strip()
        amount_str = match.group(3)
        amount = _parse_money(amount_str)

        # Skip zero amounts
        if amount == 0:
            continue

        # Resolve full date
        full_date = _resolve_transaction_date(date_str, period_start, period_end)

        # Determine transaction type
        if current_section == 'payment' or amount < 0:
            txn_type = "payment" if amount < 0 or "PAYMENT" in description.upper() else "credit"
            amount = abs(amount)
        else:
            txn_type = "purchase"

        result["transactions"].append({
            "date": full_date,
            "description": description,
            "normalized_merchant": _normalize_merchant(description),
            "amount": round(amount, 2),
            "type": txn_type,
        })


def _extract_rewards(text: str, result: dict) -> None:
    """Extract rewards points information."""
    # Points earned this period
    earned_match = re.search(
        r'(?:Total\s+points\s+earned|Points\s+Earned)\s+(?:this\s+period\s+)?:?\s*([\d,]+)',
        text, re.IGNORECASE,
    )
    if earned_match:
        result["rewards"]["points_earned"] = int(earned_match.group(1).replace(",", ""))

    # Total/available points balance
    balance_match = re.search(
        r'(?:Available\s+points?|Total\s+points?\s+available|Points\s+Balance)\s*:?\s*([\d,]+)',
        text, re.IGNORECASE,
    )
    if balance_match:
        result["rewards"]["points_balance"] = int(balance_match.group(1).replace(",", ""))


def _normalize_merchant(description: str) -> str:
    """
    Normalize a merchant description for matching across statements.

    Strips common prefixes (TST*, SQ*, SP ), location suffixes,
    and standardizes casing.
    """
    name = description

    # Remove common POS prefixes
    prefixes = [
        r'^TST\*\s*',
        r'^SQ\s*\*\s*',
        r'^SP\s+',
        r'^SQU\*\s*',
        r'^PAYPAL\s*\*\s*',
        r'^AMZN\s+',
        r'^AMAZON\.COM\*\s*',
        r'^DD\s+',
        r'^CKE\*\s*',
        r'^CHK\*\s*',
        r'^UBER\s*\*\s*',
    ]
    for prefix in prefixes:
        name = re.sub(prefix, '', name, flags=re.IGNORECASE)

    # Remove trailing location (City ST or City XX XXXXX patterns)
    # Match: "Fort Lauderda FL", "New York NY 10001", "800-123-4567"
    name = re.sub(r'\s+\d{3}[-.]?\d{3}[-.]?\d{4}\s*$', '', name)  # Phone numbers
    name = re.sub(r'\s+[A-Z]{2}\s+\d{5}(?:-\d{4})?\s*$', '', name)  # State + ZIP
    name = re.sub(r'\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+[A-Z]{2}\s*$', '', name)  # City State
    name = re.sub(r'\s+[A-Z]{2,}\s+[A-Z]{2}\s*$', '', name)  # CITY ST (all caps city)

    # Remove trailing hash/reference numbers
    name = re.sub(r'\s*#\d+\s*$', '', name)

    # Clean up whitespace
    name = re.sub(r'\s+', ' ', name).strip()

    return name.lower()


def _resolve_transaction_date(
    date_str: str,
    period_start: Optional[str],
    period_end: Optional[str],
) -> str:
    """
    Resolve MM/DD to full YYYY-MM-DD using statement period for year context.

    Transaction dates near period boundaries may cross year boundaries
    (e.g., December statement with January transactions).
    """
    parts = date_str.split("/")
    month = int(parts[0])
    day = int(parts[1])

    if period_end:
        try:
            end_date = datetime.strptime(period_end, "%Y-%m-%d")
            # If transaction month is greater than end month, it's likely
            # from the previous year (e.g., Dec transaction on Jan statement)
            if month > end_date.month and month - end_date.month > 6:
                year = end_date.year - 1
            else:
                year = end_date.year
            return f"{year}-{month:02d}-{day:02d}"
        except ValueError:
            pass

    if period_start:
        try:
            start_date = datetime.strptime(period_start, "%Y-%m-%d")
            return f"{start_date.year}-{month:02d}-{day:02d}"
        except ValueError:
            pass

    # Fallback to current year
    return f"{datetime.now().year}-{month:02d}-{day:02d}"


def _parse_date_mdy(date_str: str) -> Optional[str]:
    """Parse MM/DD/YY or MM/DD/YYYY to YYYY-MM-DD."""
    try:
        # Try 4-digit year first
        for fmt in ("%m/%d/%Y", "%m/%d/%y"):
            try:
                dt = datetime.strptime(date_str.strip(), fmt)
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                continue
    except Exception:
        pass
    return None


def _parse_money(value: str) -> float:
    """Parse a money string to float."""
    if not value:
        return 0.0
    try:
        cleaned = str(value).replace("$", "").replace(",", "").strip()
        return float(cleaned)
    except (ValueError, AttributeError):
        return 0.0
