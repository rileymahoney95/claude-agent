"""
Financial profile management for the finance CLI.

Handles loading, saving, and interactive prompting for user financial profile data.
Supports both JSON file storage and PostgreSQL database.
"""

import json
import re
from datetime import datetime
from typing import Optional

from colorama import Style

from config import PROFILE_PATH, DEFAULT_PROFILE, USE_DATABASE
from formatting import format_header


def _load_profile_json() -> dict:
    """Load financial profile from JSON file."""
    if PROFILE_PATH.exists():
        try:
            return json.loads(PROFILE_PATH.read_text())
        except (json.JSONDecodeError, IOError):
            pass
    return DEFAULT_PROFILE.copy()


def _save_profile_json(profile: dict) -> None:
    """Save financial profile to JSON file."""
    PROFILE_PATH.parent.mkdir(parents=True, exist_ok=True)
    profile["last_updated"] = datetime.now().strftime("%Y-%m-%d")
    PROFILE_PATH.write_text(json.dumps(profile, indent=2))


def load_profile() -> dict:
    """
    Load financial profile from storage.

    When USE_DATABASE is enabled, reads from database.
    """
    if USE_DATABASE:
        try:
            from database import get_profile
            db_profile = get_profile()
            # Merge with defaults to ensure all keys exist
            profile = DEFAULT_PROFILE.copy()
            profile.update(db_profile)
            return profile
        except Exception as e:
            print(f"Warning: Failed to read from database, falling back to JSON: {e}")

    return _load_profile_json()


def save_profile(profile: dict) -> None:
    """
    Save financial profile to storage.

    When USE_DATABASE is enabled, saves to both database and JSON (dual-write).
    """
    # Always save to JSON for backward compatibility
    _save_profile_json(profile)

    # Also save to database if enabled
    if USE_DATABASE:
        try:
            from database import save_profile as db_save_profile
            db_save_profile(profile)
        except Exception as e:
            print(f"Warning: Failed to save to database: {e}")


def profile_is_complete(profile: dict) -> bool:
    """Check if profile has essential data filled in."""
    cf = profile.get("monthly_cash_flow", {})
    if not cf.get("gross_income"):
        return False
    goals = profile.get("goals", {})
    if not any(g.get("description") for g in goals.values() if isinstance(g, dict)):
        return False
    return True


def prompt_number(prompt: str, current: Optional[float] = None) -> Optional[float]:
    """Prompt for a number, showing current value if any."""
    if current:
        display = f"{prompt} [{current:,.0f}]: "
    else:
        display = f"{prompt}: "
    try:
        user_input = input(display).strip()
        if not user_input and current:
            return current
        if not user_input:
            return None
        cleaned = user_input.replace(",", "").replace("$", "").replace("%", "")
        match = re.search(r'[\d.]+', cleaned)
        if match:
            return float(match.group())
        return current
    except (ValueError, EOFError, KeyboardInterrupt):
        return current


def prompt_text(prompt: str, current: Optional[str] = None) -> Optional[str]:
    """Prompt for text, showing current value if any."""
    if current:
        display = f"{prompt} [{current}]: "
    else:
        display = f"{prompt}: "
    try:
        user_input = input(display).strip()
        if not user_input and current:
            return current
        return user_input or None
    except (EOFError, KeyboardInterrupt):
        return current


def prompt_yesno(prompt: str, current: Optional[bool] = None) -> Optional[bool]:
    """Prompt for yes/no, showing current value if any."""
    current_str = "Yes" if current else "No" if current is not None else ""
    if current_str:
        display = f"{prompt} (y/n) [{current_str}]: "
    else:
        display = f"{prompt} (y/n): "
    try:
        user_input = input(display).strip().lower()
        if not user_input and current is not None:
            return current
        if user_input in ("y", "yes"):
            return True
        if user_input in ("n", "no"):
            return False
        return current
    except (EOFError, KeyboardInterrupt):
        return current


def prompt_for_profile(profile: dict) -> dict:
    """Interactively prompt for all profile sections."""
    print()
    print(format_header("Financial Profile Setup"))
    print(f"{Style.DIM}This saves to .config/profile.json for future sessions{Style.RESET_ALL}")
    print(f"{Style.DIM}Press Enter to keep current value or skip{Style.RESET_ALL}")

    # Monthly Cash Flow
    print()
    print(format_header("Monthly Cash Flow"))
    print(f"{Style.DIM}  (All values in $/month){Style.RESET_ALL}")
    cf = profile.get("monthly_cash_flow", {})
    cf["gross_income"] = prompt_number("  Gross income", cf.get("gross_income"))
    cf["shared_expenses"] = prompt_number("  Shared expenses contribution", cf.get("shared_expenses"))
    cf["crypto_contributions"] = prompt_number("  Crypto contributions", cf.get("crypto_contributions"))
    cf["roth_contributions"] = prompt_number("  Roth IRA contributions", cf.get("roth_contributions"))
    cf["hsa_contributions"] = prompt_number("  HSA contributions", cf.get("hsa_contributions"))
    cf["discretionary"] = prompt_number("  Personal discretionary", cf.get("discretionary"))
    profile["monthly_cash_flow"] = cf

    # Household Context
    print()
    print(format_header("Household Context"))
    hc = profile.get("household_context", {})
    hc["wife_income"] = prompt_number("  Wife's annual income", hc.get("wife_income"))
    hc["wife_assets"] = prompt_number("  Wife's assets (approx)", hc.get("wife_assets"))
    hc["mortgage_payment"] = prompt_number("  Mortgage payment ($/month)", hc.get("mortgage_payment"))
    hc["mortgage_rate"] = prompt_number("  Mortgage rate (%)", hc.get("mortgage_rate"))
    hc["mortgage_balance"] = prompt_number("  Mortgage balance", hc.get("mortgage_balance"))
    hc["home_value"] = prompt_number("  Home value", hc.get("home_value"))
    profile["household_context"] = hc

    # Tax Situation
    print()
    print(format_header("Tax Situation"))
    tax = profile.get("tax_situation", {})
    tax["filing_status"] = prompt_text("  Filing status", tax.get("filing_status"))
    tax["federal_bracket"] = prompt_number("  Marginal federal bracket (%)", tax.get("federal_bracket"))
    tax["state_tax"] = prompt_number("  State income tax (%)", tax.get("state_tax"))
    tax["roth_maxed"] = prompt_yesno("  Roth IRA maxed this year?", tax.get("roth_maxed"))
    tax["backdoor_required"] = prompt_yesno("  Backdoor Roth required?", tax.get("backdoor_required"))
    tax["has_401k"] = prompt_yesno("  401(k) available?", tax.get("has_401k"))
    tax["hsa_eligible"] = prompt_yesno("  HSA eligible?", tax.get("hsa_eligible"))
    profile["tax_situation"] = tax

    # Goals
    print()
    print(format_header("Financial Goals"))
    goals = profile.get("goals", {})

    print(f"{Style.DIM}  Short-term (6-12 months):{Style.RESET_ALL}")
    st = goals.get("short_term", {})
    st["description"] = prompt_text("    Goal description", st.get("description"))
    st["target"] = prompt_number("    Target amount ($)", st.get("target"))
    st["deadline"] = prompt_text("    Deadline (e.g., 2025-06)", st.get("deadline"))
    goals["short_term"] = st

    print(f"{Style.DIM}  Medium-term (1-5 years):{Style.RESET_ALL}")
    mt = goals.get("medium_term", {})
    mt["description"] = prompt_text("    Goal description", mt.get("description"))
    mt["target"] = prompt_number("    Target amount ($)", mt.get("target"))
    mt["deadline"] = prompt_text("    Deadline", mt.get("deadline"))
    goals["medium_term"] = mt

    print(f"{Style.DIM}  Long-term (5-10+ years):{Style.RESET_ALL}")
    lt = goals.get("long_term", {})
    lt["description"] = prompt_text("    Goal description", lt.get("description"))
    lt["target"] = prompt_number("    Target amount ($)", lt.get("target"))
    lt["deadline"] = prompt_text("    Deadline", lt.get("deadline"))
    goals["long_term"] = lt

    profile["goals"] = goals
    print()

    return profile


def prompt_for_session_questions() -> list:
    """Ask user what they want help with this session."""
    print()
    print(format_header("Session Questions"))
    print(f"{Style.DIM}What do you want help with? (Enter up to 3, press Enter to skip){Style.RESET_ALL}")
    print()

    questions = []
    for i in range(3):
        try:
            q = input(f"  Question {i+1}: ").strip()
            if not q:
                break
            questions.append(q)
        except (EOFError, KeyboardInterrupt):
            break

    return questions
