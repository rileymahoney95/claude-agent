#!/usr/bin/env python3
"""
Finance CLI tool for parsing brokerage statements and updating financial planning templates.

Usage:
    finance parse <statement.pdf> [--no-update] [--json]
    finance history [--account <type>] [--json]
    finance summary [--json]
"""

import argparse
import json
import os
import sys
import fcntl
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional

from colorama import Fore, Style, init as colorama_init
from tabulate import tabulate

# Initialize colorama
colorama_init()

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from parsers.sofi_apex import parse_statement, is_sofi_apex_statement


# Paths relative to repository root
REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
DATA_DIR = REPO_ROOT / ".data" / "finance"
SNAPSHOTS_DIR = DATA_DIR / "snapshots"
TEMPLATE_PATH = REPO_ROOT / "personal" / "finance" / "FINANCIAL_PLANNING_PROMPT.md"
STATEMENTS_DIR = REPO_ROOT / "personal" / "finance" / "statements"
LOCK_FILE = DATA_DIR / ".lock"


# Formatting helpers
def format_dollars(value: float, width: int = 12) -> str:
    """Format a dollar value with color (green for positive)."""
    formatted = f"${value:>{width},.2f}"
    if value > 0:
        return f"{Fore.GREEN}{formatted}{Style.RESET_ALL}"
    return formatted


def format_pct(value: float, width: int = 6) -> str:
    """Format a percentage value."""
    return f"{value:>{width}.1f}%"


def format_header(text: str) -> str:
    """Format a section header."""
    return f"{Fore.CYAN}{Style.BRIGHT}{text}{Style.RESET_ALL}"


def format_label(text: str) -> str:
    """Format a label (dimmed)."""
    return f"{Style.DIM}{text}{Style.RESET_ALL}"


def format_success(text: str) -> str:
    """Format success message."""
    return f"{Fore.GREEN}✓{Style.RESET_ALL} {text}"


def format_error(text: str) -> str:
    """Format error message."""
    return f"{Fore.RED}✗{Style.RESET_ALL} {text}"


def ensure_dirs():
    """Ensure required directories exist."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    SNAPSHOTS_DIR.mkdir(parents=True, exist_ok=True)


def save_snapshot(data: dict) -> Path:
    """Save parsed statement data as a snapshot."""
    ensure_dirs()

    # Generate filename from date and account type
    date_str = data.get("statement_date", datetime.now().strftime("%Y-%m-%d"))
    account_type = data.get("account_type", "unknown")
    filename = f"{date_str}_{account_type}.json"
    filepath = SNAPSHOTS_DIR / filename

    # Use file locking for safe concurrent access
    LOCK_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(LOCK_FILE, "w") as lock_file:
        fcntl.flock(lock_file, fcntl.LOCK_EX)
        try:
            # Write with atomic rename
            temp_file = filepath.with_suffix(".json.tmp")
            temp_file.write_text(json.dumps(data, indent=2))
            temp_file.rename(filepath)
        finally:
            fcntl.flock(lock_file, fcntl.LOCK_UN)

    return filepath


def load_snapshots(account_type: Optional[str] = None) -> list:
    """Load all snapshots, optionally filtered by account type."""
    ensure_dirs()
    snapshots = []

    for filepath in sorted(SNAPSHOTS_DIR.glob("*.json")):
        if filepath.name.startswith("."):
            continue
        try:
            data = json.loads(filepath.read_text())
            if account_type is None or data.get("account_type") == account_type:
                data["_filepath"] = str(filepath)
                snapshots.append(data)
        except (json.JSONDecodeError, IOError):
            continue

    return snapshots


def get_latest_snapshot(account_type: Optional[str] = None) -> Optional[dict]:
    """Get the most recent snapshot."""
    snapshots = load_snapshots(account_type)
    if not snapshots:
        return None
    # Sort by statement_date descending
    snapshots.sort(key=lambda x: x.get("statement_date", ""), reverse=True)
    return snapshots[0]


def update_template(data: dict) -> bool:
    """Update the financial planning template with new values."""
    if not TEMPLATE_PATH.exists():
        return False

    content = TEMPLATE_PATH.read_text()

    # Update the "Last Updated" date
    today = datetime.now().strftime("%Y-%m-%d")
    content = content.replace(
        "**Last Updated:** [DATE]",
        f"**Last Updated:** {today}"
    )

    # Find and update the Roth IRA row in "My Individual Assets" table
    # The table has format: | Asset | Value | Notes |
    roth_value = data["portfolio"]["total_value"]

    # Look for the Roth IRA line and update it
    lines = content.split("\n")
    updated_lines = []
    in_assets_table = False

    for line in lines:
        # Detect start of My Individual Assets table
        if "| Asset " in line and "| Value |" in line:
            in_assets_table = True
        # Detect end of table (empty line or new section)
        elif in_assets_table and (line.strip() == "" or line.startswith("###")):
            in_assets_table = False

        # Update Roth IRA row
        if in_assets_table and "Roth IRA" in line and "|" in line:
            parts = line.split("|")
            if len(parts) >= 4:
                # Update the value column (index 2, after Asset name)
                parts[2] = f" ${roth_value:,.2f} "
                line = "|".join(parts)

        updated_lines.append(line)

    new_content = "\n".join(updated_lines)

    # Write back with atomic save
    temp_file = TEMPLATE_PATH.with_suffix(".md.tmp")
    temp_file.write_text(new_content)
    temp_file.rename(TEMPLATE_PATH)

    return True


def cmd_parse(args):
    """Parse a statement PDF."""
    pdf_path = Path(args.statement)

    # If relative path, check in statements directory first
    if not pdf_path.is_absolute() and not pdf_path.exists():
        statements_path = STATEMENTS_DIR / pdf_path
        if statements_path.exists():
            pdf_path = statements_path

    if not pdf_path.exists():
        result = {"success": False, "error": f"File not found: {pdf_path}"}
        if args.json:
            print(json.dumps(result))
        else:
            print(f"Error: {result['error']}", file=sys.stderr)
        return 1

    # Detect statement type and parse
    if is_sofi_apex_statement(str(pdf_path)):
        try:
            data = parse_statement(str(pdf_path))
        except Exception as e:
            result = {"success": False, "error": f"Failed to parse statement: {e}"}
            if args.json:
                print(json.dumps(result))
            else:
                print(f"Error: {result['error']}", file=sys.stderr)
            return 1
    else:
        result = {"success": False, "error": "Unsupported statement format (only SoFi/Apex currently supported)"}
        if args.json:
            print(json.dumps(result))
        else:
            print(f"Error: {result['error']}", file=sys.stderr)
        return 1

    # Save snapshot
    snapshot_path = save_snapshot(data)

    # Update template unless --no-update
    template_updated = False
    if not args.no_update:
        template_updated = update_template(data)

    result = {
        "success": True,
        "snapshot_path": str(snapshot_path),
        "template_updated": template_updated,
        "data": data
    }

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print()
        print(format_header(f"Statement Parsed: {pdf_path.name}"))
        print()

        # Account info
        account_holder = data.get('account_holder', 'Unknown')
        account_type = data.get('account_type', 'Unknown').replace('_', ' ').title()
        period_start = data['period']['start']
        period_end = data['period']['end']
        total_value = data['portfolio']['total_value']
        holdings_count = len(data['portfolio']['holdings'])

        info = [
            ["Account", f"{account_holder} - {account_type}"],
            ["Period", f"{period_start} to {period_end}"],
            ["Total Value", f"{Fore.GREEN}${total_value:,.2f}{Style.RESET_ALL}"],
            ["Holdings", str(holdings_count)],
        ]
        print(tabulate(info, tablefmt="plain"))
        print()

        # Results
        print(format_success(f"Snapshot saved: {snapshot_path.name}"))
        if template_updated:
            print(format_success(f"Template updated: {TEMPLATE_PATH.name}"))
        print()

    return 0


def cmd_history(args):
    """List historical snapshots."""
    snapshots = load_snapshots(args.account)

    if not snapshots:
        result = {"success": True, "snapshots": [], "count": 0}
        if args.json:
            print(json.dumps(result))
        else:
            print(f"{Style.DIM}No snapshots found.{Style.RESET_ALL}")
        return 0

    if args.json:
        # Remove internal filepath from output
        for s in snapshots:
            s.pop("_filepath", None)
        result = {"success": True, "snapshots": snapshots, "count": len(snapshots)}
        print(json.dumps(result, indent=2))
    else:
        print()
        print(format_header(f"Financial History ({len(snapshots)} snapshots)"))
        print()

        # Build table data
        table_data = []
        for snap in snapshots:
            date = snap.get("statement_date", "Unknown")
            account = snap.get("account_type", "Unknown").replace('_', ' ').title()
            total = snap.get("portfolio", {}).get("total_value", 0)
            table_data.append([
                date,
                account,
                f"{Fore.GREEN}${total:>12,.2f}{Style.RESET_ALL}"
            ])

        headers = [
            f"{Style.DIM}Date{Style.RESET_ALL}",
            f"{Style.DIM}Account{Style.RESET_ALL}",
            f"{Style.DIM}Total Value{Style.RESET_ALL}"
        ]
        print(tabulate(table_data, headers=headers, tablefmt="plain"))
        print()

    return 0


def cmd_summary(args):
    """Show summary from latest snapshot."""
    latest = get_latest_snapshot()

    if not latest:
        result = {"success": False, "error": "No snapshots found"}
        if args.json:
            print(json.dumps(result))
        else:
            print(format_error("No snapshots found. Run 'finance parse <statement.pdf>' first."))
        return 1

    if args.json:
        latest.pop("_filepath", None)
        result = {"success": True, "data": latest}
        print(json.dumps(result, indent=2))
    else:
        account_holder = latest.get('account_holder', 'Unknown')
        account_type = latest.get('account_type', 'Unknown').replace('_', ' ').title()
        statement_date = latest.get('statement_date', 'Unknown')

        print()
        print(format_header(f"Portfolio Summary"))
        print(f"{Style.DIM}{account_holder} - {account_type} | As of {statement_date}{Style.RESET_ALL}")
        print()

        portfolio = latest.get("portfolio", {})
        total_value = portfolio.get('total_value', 0)
        securities_value = portfolio.get('securities_value', 0)
        fdic_deposits = portfolio.get('fdic_deposits', 0)

        # Portfolio totals table
        totals_data = [
            [f"{Fore.WHITE}{Style.BRIGHT}Total Value{Style.RESET_ALL}", f"{Fore.GREEN}{Style.BRIGHT}${total_value:>12,.2f}{Style.RESET_ALL}"],
            [f"{Style.DIM}Securities{Style.RESET_ALL}", f"${securities_value:>12,.2f}"],
            [f"{Style.DIM}FDIC Deposits{Style.RESET_ALL}", f"${fdic_deposits:>12,.2f}"],
        ]
        print(tabulate(totals_data, tablefmt="plain"))
        print()

        # Holdings table
        holdings = portfolio.get("holdings", [])
        if holdings:
            print(format_header("Holdings"))
            print()

            holdings_data = []
            for h in sorted(holdings, key=lambda x: x.get("value", 0), reverse=True):
                symbol = h['symbol']
                name = h.get('name', '')[:25]  # Truncate long names
                value = h.get('value', 0)
                pct = h.get('pct', 0)
                qty = h.get('quantity', 0)
                price = h.get('price', 0)

                holdings_data.append([
                    f"{Fore.YELLOW}{symbol}{Style.RESET_ALL}",
                    f"{Style.DIM}{name}{Style.RESET_ALL}",
                    f"{qty:,.2f}",
                    f"${price:,.2f}",
                    f"{Fore.GREEN}${value:>10,.2f}{Style.RESET_ALL}",
                    f"{pct:>5.1f}%"
                ])

            headers = [
                f"{Style.DIM}Symbol{Style.RESET_ALL}",
                f"{Style.DIM}Name{Style.RESET_ALL}",
                f"{Style.DIM}Qty{Style.RESET_ALL}",
                f"{Style.DIM}Price{Style.RESET_ALL}",
                f"{Style.DIM}Value{Style.RESET_ALL}",
                f"{Style.DIM}%{Style.RESET_ALL}"
            ]
            print(tabulate(holdings_data, headers=headers, tablefmt="plain"))
            print()

        # Income section
        income = latest.get("income", {})
        dividends_ytd = income.get('dividends', {}).get('ytd', 0)
        interest_ytd = income.get('interest', {}).get('ytd', 0)

        if dividends_ytd > 0 or interest_ytd > 0:
            print(format_header("Income (YTD)"))
            print()
            income_data = []
            if dividends_ytd > 0:
                income_data.append(["Dividends", f"{Fore.GREEN}${dividends_ytd:>10,.2f}{Style.RESET_ALL}"])
            if interest_ytd > 0:
                income_data.append(["Interest", f"{Fore.GREEN}${interest_ytd:>10,.2f}{Style.RESET_ALL}"])
            print(tabulate(income_data, tablefmt="plain"))
            print()

    return 0


def main():
    parser = argparse.ArgumentParser(
        description="Finance CLI for parsing statements and updating planning templates"
    )
    parser.add_argument("--json", action="store_true", help="Output as JSON")

    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # parse command
    parse_parser = subparsers.add_parser("parse", help="Parse a statement PDF")
    parse_parser.add_argument("statement", help="Path to the statement PDF")
    parse_parser.add_argument("--no-update", action="store_true",
                              help="Don't update the planning template")
    parse_parser.add_argument("--json", action="store_true", help="Output as JSON")

    # history command
    history_parser = subparsers.add_parser("history", help="List historical snapshots")
    history_parser.add_argument("--account", help="Filter by account type")
    history_parser.add_argument("--json", action="store_true", help="Output as JSON")

    # summary command
    summary_parser = subparsers.add_parser("summary", help="Show current allocation summary")
    summary_parser.add_argument("--json", action="store_true", help="Output as JSON")

    args = parser.parse_args()

    if args.command == "parse":
        return cmd_parse(args)
    elif args.command == "history":
        return cmd_history(args)
    elif args.command == "summary":
        return cmd_summary(args)
    else:
        parser.print_help()
        return 0


if __name__ == "__main__":
    sys.exit(main())
