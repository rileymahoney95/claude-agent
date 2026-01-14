"""
SoFi/Apex Clearing statement parser.

Parses monthly brokerage statements from SoFi (cleared by Apex).
"""

import re
from datetime import datetime
from decimal import Decimal
from typing import Optional
import pdfplumber


def parse_statement(pdf_path: str) -> dict:
    """
    Parse a SoFi/Apex brokerage statement PDF.

    Args:
        pdf_path: Path to the PDF file

    Returns:
        Dictionary with extracted statement data
    """
    with pdfplumber.open(pdf_path) as pdf:
        result = {
            "statement_date": None,
            "account_type": None,
            "account_id": None,
            "account_holder": None,
            "period": {"start": None, "end": None},
            "portfolio": {
                "total_value": 0,
                "securities_value": 0,
                "fdic_deposits": 0,
                "holdings": []
            },
            "income": {
                "dividends": {"period": 0, "ytd": 0},
                "interest": {"period": 0, "ytd": 0}
            },
            "retirement": {}
        }

        # Find statement pages by looking for "PAGE X OF" pattern
        for i, page in enumerate(pdf.pages):
            text = page.extract_text() or ""

            # Skip pages without statement content
            if "ACCOUNT NUMBER" not in text:
                continue

            # Extract account info from first statement page found
            if result["account_id"] is None:
                _extract_account_info(text, result)

            # Page 1 has account summary with totals and income
            if "PAGE 1 OF" in text or "OPENING BALANCE" in text:
                _extract_account_summary(text, result)

            # Page 3 has portfolio holdings
            if "EQUITIES / OPTIONS" in text or "PORTFOLIO SUMMARY" in text:
                _extract_holdings_from_text(text, result)

            # Look for retirement info
            if "ROLLOVER CONTRIBUTION" in text or "ROTH CONVERSION" in text:
                _extract_retirement_info(text, result)

        # Set statement date from period end
        if result["period"]["end"]:
            result["statement_date"] = result["period"]["end"]

        return result


def _extract_account_info(text: str, result: dict) -> None:
    """Extract account number, holder, type, and period from text."""

    # Account number pattern: 2FV-75567-14 or similar
    account_match = re.search(r'ACCOUNT NUMBER\s+(\d*[A-Z]+-\d+-\d+)', text)
    if account_match:
        full_account = account_match.group(1)
        parts = full_account.split("-")
        # Mask middle digits for privacy in display
        result["account_id"] = parts[0] + "-" + parts[1][:2] + "XXX"

    # Account holder name - look for name before or near "APEX C/F"
    holder_match = re.search(r'([A-Z][A-Z]+\s+[A-Z]+)\s*\n.*APEX C/F', text, re.MULTILINE)
    if not holder_match:
        holder_match = re.search(r'([A-Z][A-Z]+\s+[A-Z]+)\s+APEX C/F', text)
    if holder_match:
        result["account_holder"] = holder_match.group(1).strip()

    # Account type from APEX C/F line
    if "ROTH IRA" in text.upper():
        result["account_type"] = "roth_ira"
    elif "TRADITIONAL IRA" in text.upper():
        result["account_type"] = "traditional_ira"
    elif "IRA" in text.upper():
        result["account_type"] = "ira"
    else:
        result["account_type"] = "brokerage"

    # Statement period - pattern: "December 1, 2025 - December 31, 2025"
    period_match = re.search(
        r'([A-Z][a-z]+\s+\d+,?\s+\d{4})\s*[-–]\s*([A-Z][a-z]+\s+\d+,?\s+\d{4})',
        text
    )
    if period_match:
        try:
            start_str = period_match.group(1).replace(",", "")
            end_str = period_match.group(2).replace(",", "")
            start_date = datetime.strptime(start_str, "%B %d %Y")
            end_date = datetime.strptime(end_str, "%B %d %Y")
            result["period"]["start"] = start_date.strftime("%Y-%m-%d")
            result["period"]["end"] = end_date.strftime("%Y-%m-%d")
        except ValueError:
            pass


def _extract_account_summary(text: str, result: dict) -> None:
    """Extract account summary values from page 1."""

    # TOTAL PRICED PORTFOLIO: opening and closing values
    # Pattern: "TOTAL PRICED PORTFOLIO 61,580.91 68,340.45"
    total_match = re.search(r'TOTAL PRICED PORTFOLIO\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)', text)
    if total_match:
        result["portfolio"]["total_value"] = _parse_money(total_match.group(2))  # closing

    # FDIC Insured Deposits
    fdic_match = re.search(r'FDIC Insured Deposits\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)', text)
    if fdic_match:
        result["portfolio"]["fdic_deposits"] = _parse_money(fdic_match.group(2))  # closing

    # Securities value
    securities_match = re.search(r'Securities\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)', text)
    if securities_match:
        result["portfolio"]["securities_value"] = _parse_money(securities_match.group(2))  # closing

    # Income: Dividends and Interest
    # Pattern: "Dividends $196.81 $302.42" (period, ytd)
    div_match = re.search(r'Dividends\s+\$?([\d,]+\.?\d*)\s+\$?([\d,]+\.?\d*)', text)
    if div_match:
        result["income"]["dividends"]["period"] = _parse_money(div_match.group(1))
        result["income"]["dividends"]["ytd"] = _parse_money(div_match.group(2))

    # Pattern: "Bank Interest 0.01 0.16" (period, ytd)
    int_match = re.search(r'Bank Interest\s+([\d,]+\.?\d*)\s+([\d,]+\.?\d*)', text)
    if int_match:
        result["income"]["interest"]["period"] = _parse_money(int_match.group(1))
        result["income"]["interest"]["ytd"] = _parse_money(int_match.group(2))


def _extract_holdings_from_text(text: str, result: dict) -> None:
    """Extract individual holdings from portfolio text."""

    # Skip if we already have holdings
    if result["portfolio"]["holdings"]:
        return

    # Aggregate holdings by symbol (same ticker can appear in C and O accounts)
    holdings_map = {}

    # Pattern for holdings line:
    # "ARKK C 0.07199 $76.92 $5.54" or "QQQ C 49.89102 614.31 30,648.55"
    # Symbol, account type (C/O), quantity, price, market value
    holdings_pattern = re.compile(
        r'\b([A-Z]{2,5})\s+'  # Symbol (2-5 uppercase letters)
        r'([CO])\s+'  # Account type (C=Cash, O=Other/On-loan)
        r'([\d.]+)\s+'  # Quantity
        r'\$?([\d,]+\.?\d*)\s+'  # Price
        r'\$?([\d,]+\.?\d*)',  # Market value
        re.MULTILINE
    )

    # Known valid symbols to avoid false positives
    valid_symbols = {
        "ARKK", "QQQ", "VUG", "VB", "VWO", "VOO", "VTI", "SPY", "IVV",
        "SCHD", "VYM", "VXUS", "BND", "AGG", "VTIP", "VGSH", "VCIT",
        "VNQ", "VGT", "VHT", "VDC", "VPU", "AAPL", "MSFT", "GOOGL",
        "AMZN", "NVDA", "META", "TSLA", "BRK", "JPM", "V", "HD", "ISPAZ"
    }

    # Words that look like symbols but aren't
    invalid_symbols = {"THE", "AND", "FOR", "ETF", "SER", "PAY", "REC", "DIV"}

    for match in holdings_pattern.finditer(text):
        symbol = match.group(1)

        # Skip invalid symbols
        if symbol in invalid_symbols:
            continue

        # Only accept known symbols or symbols that appear with reasonable values
        quantity = _parse_number(match.group(3))
        price = _parse_money(match.group(4))
        value = _parse_money(match.group(5))

        # Sanity checks
        if not quantity or not price or not value:
            continue
        if value < 1:  # Skip tiny values (likely noise)
            continue
        if price < 0.01 or price > 10000:  # Reasonable price range
            continue

        # Additional check: only known symbols OR value > $100
        if symbol not in valid_symbols and value < 100:
            continue

        # Aggregate by symbol (handles C and O account types)
        if symbol in holdings_map:
            holdings_map[symbol]["quantity"] += quantity
            holdings_map[symbol]["value"] += value
        else:
            holdings_map[symbol] = {
                "symbol": symbol,
                "name": _get_holding_name(symbol),
                "quantity": quantity,
                "price": price,  # Use price from first occurrence
                "value": value,
            }

    # Convert map to list and calculate percentages
    total = result["portfolio"]["total_value"] or 1
    for symbol, holding in holdings_map.items():
        # Skip FDIC deposits (ISPAZ is the sweep account)
        if symbol == "ISPAZ":
            continue
        result["portfolio"]["holdings"].append({
            "symbol": holding["symbol"],
            "name": holding["name"],
            "quantity": round(holding["quantity"], 5),
            "price": round(holding["price"], 2),
            "value": round(holding["value"], 2),
            "pct": round(holding["value"] / total * 100, 2)
        })


def _extract_retirement_info(text: str, result: dict) -> None:
    """Extract retirement account information."""

    # Look for contribution patterns
    # ROLLOVER CONTRIBUTION 2025 XX,XXX.XX
    rollover_match = re.search(r'ROLLOVER CONTRIBUTION\s+(\d{4})\s+([\d,]+\.?\d*)', text)
    if rollover_match:
        year = rollover_match.group(1)
        key = f"rollover_{year}"
        if key not in result["retirement"]:
            result["retirement"][key] = _parse_money(rollover_match.group(2))

    # ROTH CONVERSION AMOUNT 2025 X,XXX.XX
    conversion_match = re.search(r'ROTH CONVERSION AMOUNT\s+(\d{4})\s+([\d,]+\.?\d*)', text)
    if conversion_match:
        year = conversion_match.group(1)
        key = f"roth_conversion_{year}"
        if key not in result["retirement"]:
            result["retirement"][key] = _parse_money(conversion_match.group(2))

    # Regular contributions (but not ROLLOVER CONTRIBUTION - use negative lookbehind)
    contrib_match = re.search(r'(?<!ROLLOVER )CONTRIBUTION\s+(\d{4})\s+([\d,]+\.?\d*)', text)
    if contrib_match:
        year = contrib_match.group(1)
        key = f"contribution_{year}"
        if key not in result["retirement"]:
            result["retirement"][key] = _parse_money(contrib_match.group(2))


def _parse_money(value: str) -> float:
    """Parse a money string to float."""
    if not value:
        return 0.0
    try:
        # Remove $ and commas
        cleaned = str(value).replace("$", "").replace(",", "").strip()
        return float(cleaned)
    except (ValueError, AttributeError):
        return 0.0


def _parse_number(value: str) -> Optional[float]:
    """Parse a number string to float."""
    if not value:
        return None
    try:
        cleaned = str(value).replace(",", "").strip()
        return float(cleaned)
    except (ValueError, AttributeError):
        return None


def _get_holding_name(symbol: str) -> str:
    """Get the full name for common symbols."""
    names = {
        "ARKK": "ARK Innovation ETF",
        "QQQ": "Invesco QQQ Trust",
        "VUG": "Vanguard Growth ETF",
        "VB": "Vanguard Small-Cap ETF",
        "VWO": "Vanguard FTSE Emerging Markets ETF",
        "VOO": "Vanguard S&P 500 ETF",
        "VTI": "Vanguard Total Stock Market ETF",
        "SPY": "SPDR S&P 500 ETF",
        "IVV": "iShares Core S&P 500 ETF",
        "SCHD": "Schwab US Dividend Equity ETF",
        "VYM": "Vanguard High Dividend Yield ETF",
        "VXUS": "Vanguard Total International Stock ETF",
        "BND": "Vanguard Total Bond Market ETF",
        "AGG": "iShares Core US Aggregate Bond ETF",
    }
    return names.get(symbol, symbol)


def is_sofi_apex_statement(pdf_path: str) -> bool:
    """Check if a PDF is a SoFi/Apex statement."""
    try:
        with pdfplumber.open(pdf_path) as pdf:
            if len(pdf.pages) < 1:
                return False
            first_page_text = pdf.pages[0].extract_text() or ""
            # Look for Apex Clearing indicators
            return "APEX" in first_page_text.upper() and (
                "CLEARING" in first_page_text.upper() or
                "SoFi" in first_page_text
            )
    except Exception:
        return False
