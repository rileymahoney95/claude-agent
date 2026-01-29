"""
CLI command handlers for the finance CLI.

Each cmd_* function handles a specific subcommand.
"""

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

from colorama import Fore, Style
from tabulate import tabulate

from config import (
    REPO_ROOT,
    TEMPLATE_PATH,
    STATEMENTS_DIR,
    PROFILE_PATH,
    DEFAULT_PROFILE,
    USE_DATABASE,
)
from formatting import format_header, format_success, format_error
from profile import (
    load_profile,
    save_profile,
    profile_is_complete,
    prompt_for_profile,
    prompt_for_session_questions,
)
from holdings import (
    load_holdings,
    set_holding,
    check_holdings_freshness,
    fetch_crypto_prices,
    build_holdings_json,
    display_holdings,
)
from aggregator import get_unified_portfolio
from advisor import get_advice
from snapshots import (
    save_snapshot,
    load_snapshots,
    get_latest_snapshot,
    get_latest_by_account_type,
)
from templates import (
    update_template,
    populate_template,
    populate_cash_flow,
    populate_household_context,
    populate_tax_situation,
    populate_goals,
    populate_questions,
    strip_template_meta,
    prompt_for_missing_assets,
)

# Import parser from parsers module
sys.path.insert(0, str(Path(__file__).parent))
from parsers.sofi_apex import parse_statement, is_sofi_apex_statement


def cmd_plan(args):
    """Generate a populated financial planning prompt."""
    if not TEMPLATE_PATH.exists():
        result = {"success": False, "error": f"Template not found: {TEMPLATE_PATH}"}
        if args.json:
            print(json.dumps(result))
        else:
            print(format_error(result["error"]))
        return 1

    template = TEMPLATE_PATH.read_text()

    latest_by_type = get_latest_by_account_type()

    if not latest_by_type:
        result = {"success": False, "error": "No snapshots found. Run 'finance pull' first."}
        if args.json:
            print(json.dumps(result))
        else:
            print(format_error(result["error"]))
        return 1

    populated = populate_template(template, latest_by_type)

    accounts_included = list(latest_by_type.keys())
    as_of_dates = {k: v.get('statement_date') for k, v in latest_by_type.items()}

    profile = load_profile()

    if not args.json:
        if not profile_is_complete(profile):
            print()
            print(f"{Fore.YELLOW}No financial profile found.{Style.RESET_ALL}")
            print(f"{Style.DIM}Setting up profile for complete planning prompts...{Style.RESET_ALL}")
            profile = prompt_for_profile(profile)
            save_profile(profile)
            print(format_success(f"Profile saved to: {PROFILE_PATH}"))

    populated = populate_cash_flow(populated, profile)
    populated = populate_household_context(populated, profile)
    populated = populate_tax_situation(populated, profile)
    populated = populate_goals(populated, profile)

    if not args.json:
        populated = prompt_for_missing_assets(populated)
        questions = prompt_for_session_questions()
        if questions:
            populated = populate_questions(populated, questions)

    populated = strip_template_meta(populated)

    if args.json:
        result = {
            "success": True,
            "prompt": populated,
            "accounts_included": accounts_included,
            "as_of_dates": as_of_dates
        }
        print(json.dumps(result, indent=2))
    else:
        output_path = REPO_ROOT / "finance" / "templates" / "PLANNING_SESSION.md"
        should_save = not getattr(args, 'no_save', False)
        should_copy = not getattr(args, 'no_copy', False)

        print()

        if should_save:
            output_path.write_text(populated)
            print(format_success(f"Saved to: {output_path}"))

        if should_copy:
            try:
                subprocess.run(['pbcopy'], input=populated.encode(), check=True)
                print(format_success("Copied to clipboard"))
            except FileNotFoundError:
                print(format_error("pbcopy not found (macOS only)"))
            except subprocess.CalledProcessError as e:
                print(format_error(f"Failed to copy to clipboard: {e}"))

        print()
        print(f"{Style.DIM}Accounts included: {', '.join(accounts_included)}{Style.RESET_ALL}")
        for account, date in as_of_dates.items():
            print(f"{Style.DIM}  {account}: as of {date}{Style.RESET_ALL}")

    return 0


def cmd_plan_advisor(args):
    """Generate an advisor session prompt with recommendations."""
    from session import generate_session_prompt

    if not getattr(args, 'json', False):
        print(f"{Style.DIM}Generating advisor session...{Style.RESET_ALL}")

    result = generate_session_prompt()

    if not result.get("success"):
        if args.json:
            print(json.dumps(result))
        else:
            print(format_error(result.get("error", "Failed to generate session")))
        return 1

    if args.json:
        print(json.dumps(result, indent=2))
        return 0

    prompt = result["prompt"]
    output_path = REPO_ROOT / "finance" / "templates" / "ADVISOR_SESSION.md"
    should_save = not getattr(args, 'no_save', False)
    should_copy = not getattr(args, 'no_copy', False)

    print()

    if should_save:
        output_path.write_text(prompt)
        print(format_success(f"Saved to: {output_path}"))

    if should_copy:
        try:
            subprocess.run(['pbcopy'], input=prompt.encode(), check=True)
            print(format_success("Copied to clipboard"))
        except FileNotFoundError:
            print(format_error("pbcopy not found (macOS only)"))
        except subprocess.CalledProcessError as e:
            print(format_error(f"Failed to copy to clipboard: {e}"))

    # Summary stats
    data = result.get("data", {})
    recs = data.get("recommendations", {})
    high_count = len(recs.get("high", []))
    total_count = sum(len(v) for v in recs.values())

    print()
    print(f"{Style.DIM}Session includes: {total_count} recommendations ({high_count} high priority){Style.RESET_ALL}")
    print(f"{Style.DIM}Generated at: {data.get('generated_at', 'unknown')}{Style.RESET_ALL}")

    return 0


def cmd_profile(args):
    """View or edit financial profile."""
    profile = load_profile()

    if args.json:
        print(json.dumps(profile, indent=2))
        return 0

    if getattr(args, 'reset', False):
        profile = DEFAULT_PROFILE.copy()
        profile = prompt_for_profile(profile)
        save_profile(profile)
        print(format_success(f"Profile saved to: {PROFILE_PATH}"))
        return 0

    if getattr(args, 'edit', False):
        profile = prompt_for_profile(profile)
        save_profile(profile)
        print(format_success(f"Profile saved to: {PROFILE_PATH}"))
        return 0

    print()
    print(format_header("Financial Profile"))
    print(f"{Style.DIM}Last updated: {profile.get('last_updated', 'Never')}{Style.RESET_ALL}")
    print()

    print(format_header("Monthly Cash Flow"))
    cf = profile.get("monthly_cash_flow", {})
    for key, label in [
        ("gross_income", "Gross Income"),
        ("shared_expenses", "Shared Expenses"),
        ("crypto_contributions", "Crypto Contributions"),
        ("roth_contributions", "Roth Contributions"),
        ("hsa_contributions", "HSA Contributions"),
        ("discretionary", "Discretionary"),
    ]:
        val = cf.get(key)
        if val:
            print(f"  {label}: ${val:,.0f}/month")
        else:
            print(f"  {label}: {Style.DIM}not set{Style.RESET_ALL}")
    print()

    print(format_header("Household Context"))
    hc = profile.get("household_context", {})
    for key, label, fmt in [
        ("wife_income", "Wife's Income", "${:,.0f}/year"),
        ("wife_assets", "Wife's Assets", "~${:,.0f}"),
        ("mortgage_payment", "Mortgage Payment", "${:,.0f}/month"),
        ("mortgage_rate", "Mortgage Rate", "{:.2f}%"),
        ("mortgage_balance", "Mortgage Balance", "${:,.0f}"),
        ("home_value", "Home Value", "${:,.0f}"),
    ]:
        val = hc.get(key)
        if val:
            print(f"  {label}: {fmt.format(val)}")
        else:
            print(f"  {label}: {Style.DIM}not set{Style.RESET_ALL}")
    print()

    print(format_header("Tax Situation"))
    tax = profile.get("tax_situation", {})
    print(f"  Filing Status: {tax.get('filing_status') or f'{Style.DIM}not set{Style.RESET_ALL}'}")
    if tax.get("federal_bracket"):
        print(f"  Federal Bracket: {tax['federal_bracket']}%")
    if tax.get("state_tax"):
        print(f"  State Tax: {tax['state_tax']}%")
    print(f"  Roth Maxed: {'Yes' if tax.get('roth_maxed') else 'No'}")
    print(f"  401(k) Available: {'Yes' if tax.get('has_401k') else 'No'}")
    print(f"  HSA Eligible: {'Yes' if tax.get('hsa_eligible') else 'No'}")
    print()

    print(format_header("Goals"))
    goals = profile.get("goals", {})
    for term, label in [("short_term", "Short-term"), ("medium_term", "Medium-term"), ("long_term", "Long-term")]:
        g = goals.get(term, {})
        desc = g.get("description")
        if desc:
            target = g.get("target")
            deadline = g.get("deadline")
            target_str = f" (${target:,.0f})" if target else ""
            deadline_str = f" by {deadline}" if deadline else ""
            print(f"  {label}: {desc}{target_str}{deadline_str}")
        else:
            print(f"  {label}: {Style.DIM}not set{Style.RESET_ALL}")
    print()

    print(f"{Style.DIM}Run 'finance profile --edit' to update{Style.RESET_ALL}")
    return 0


def cmd_holdings(args):
    """Handle holdings command and subcommands."""

    if getattr(args, 'holdings_command', None) == 'set':
        result = set_holding(
            path=args.path,
            value=args.value,
            notes=getattr(args, 'notes', None)
        )

        if args.json:
            print(json.dumps(result))
        else:
            if result["success"]:
                holding = result["holding"]
                if result["category"] == "crypto":
                    print(format_success(f"Set {holding['symbol']}: {holding['quantity']:.6f}".rstrip('0').rstrip('.')))
                else:
                    print(format_success(f"Set {holding['name']}: ${holding['balance']:,.2f}"))
            else:
                print(format_error(result["error"]))

        return 0 if result["success"] else 1

    if getattr(args, 'holdings_command', None) == 'check':
        result = check_holdings_freshness()

        if args.json:
            print(json.dumps(result))
        else:
            if result["is_stale"]:
                print(f"{Fore.YELLOW}Warning:{Style.RESET_ALL} {result['message']}")
            else:
                print(format_success(result["message"]))

        return 0

    holdings = load_holdings()

    crypto_symbols = list(holdings.get("crypto", {}).keys())
    crypto_prices = {}
    if crypto_symbols:
        if not args.json:
            print(f"{Style.DIM}Fetching crypto prices...{Style.RESET_ALL}")
        crypto_prices = fetch_crypto_prices(crypto_symbols)

    if args.json:
        output = build_holdings_json(holdings, crypto_prices)
        print(json.dumps(output, indent=2))
    else:
        display_holdings(holdings, crypto_prices)

    return 0


def cmd_parse(args):
    """Parse a statement PDF."""
    pdf_path = Path(args.statement)

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

    snapshot_path = save_snapshot(data)

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

        account_holder = data.get('account_holder') or 'Unknown'
        account_type = (data.get('account_type') or 'Unknown').replace('_', ' ').title()
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
        for s in snapshots:
            s.pop("_filepath", None)
        result = {"success": True, "snapshots": snapshots, "count": len(snapshots)}
        print(json.dumps(result, indent=2))
    else:
        print()
        print(format_header(f"Financial History ({len(snapshots)} snapshots)"))
        print()

        table_data = []
        for snap in snapshots:
            date = snap.get("statement_date") or "Unknown"
            account = (snap.get("account_type") or "Unknown").replace('_', ' ').title()
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
        account_holder = latest.get('account_holder') or 'Unknown'
        account_type = (latest.get('account_type') or 'Unknown').replace('_', ' ').title()
        statement_date = latest.get('statement_date') or 'Unknown'

        print()
        print(format_header("Portfolio Summary"))
        print(f"{Style.DIM}{account_holder} - {account_type} | As of {statement_date}{Style.RESET_ALL}")
        print()

        portfolio = latest.get("portfolio", {})
        total_value = portfolio.get('total_value', 0)
        securities_value = portfolio.get('securities_value', 0)
        fdic_deposits = portfolio.get('fdic_deposits', 0)

        totals_data = [
            [f"{Fore.WHITE}{Style.BRIGHT}Total Value{Style.RESET_ALL}", f"{Fore.GREEN}{Style.BRIGHT}${total_value:>12,.2f}{Style.RESET_ALL}"],
            [f"{Style.DIM}Securities{Style.RESET_ALL}", f"${securities_value:>12,.2f}"],
            [f"{Style.DIM}FDIC Deposits{Style.RESET_ALL}", f"${fdic_deposits:>12,.2f}"],
        ]
        print(tabulate(totals_data, tablefmt="plain"))
        print()

        holdings = portfolio.get("holdings", [])
        if holdings:
            print(format_header("Holdings"))
            print()

            holdings_data = []
            for h in sorted(holdings, key=lambda x: x.get("value", 0), reverse=True):
                symbol = h['symbol']
                name = h.get('name', '')[:25]
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


def _process_single_statement(source_pdf: Path, quiet: bool = False) -> dict:
    """Move, parse, and save a single statement."""
    STATEMENTS_DIR.mkdir(parents=True, exist_ok=True)
    dest_pdf = STATEMENTS_DIR / source_pdf.name

    try:
        shutil.move(str(source_pdf), str(dest_pdf))
    except Exception as e:
        return {"success": False, "error": f"Failed to move file: {e}", "source_path": str(source_pdf)}

    if not quiet:
        print(format_success(f"Moved: {source_pdf.name}"))
        print(f"{Style.DIM}  From: {source_pdf.parent}{Style.RESET_ALL}")
        print(f"{Style.DIM}  To:   {dest_pdf.parent}{Style.RESET_ALL}")

    try:
        data = parse_statement(str(dest_pdf))
    except Exception as e:
        return {"success": False, "error": f"Failed to parse statement: {e}", "source_path": str(source_pdf), "dest_path": str(dest_pdf)}

    snapshot_path = save_snapshot(data)

    if not quiet:
        print(format_success(f"Snapshot saved: {snapshot_path.name}"))

    return {
        "success": True,
        "source_path": str(source_pdf),
        "dest_path": str(dest_pdf),
        "snapshot_path": str(snapshot_path),
        "data": data
    }


def _display_statement_summary(data: dict):
    """Display a formatted summary of a parsed statement."""
    account_holder = data.get('account_holder') or 'Unknown'
    account_type = (data.get('account_type') or 'Unknown').replace('_', ' ').title()
    statement_date = data.get('statement_date') or 'Unknown'

    print(format_header("Portfolio Summary"))
    print(f"{Style.DIM}{account_holder} - {account_type} | As of {statement_date}{Style.RESET_ALL}")
    print()

    portfolio = data.get("portfolio", {})
    total_value = portfolio.get('total_value', 0)
    securities_value = portfolio.get('securities_value', 0)
    fdic_deposits = portfolio.get('fdic_deposits', 0)

    totals_data = [
        [f"{Fore.WHITE}{Style.BRIGHT}Total Value{Style.RESET_ALL}", f"{Fore.GREEN}{Style.BRIGHT}${total_value:>12,.2f}{Style.RESET_ALL}"],
        [f"{Style.DIM}Securities{Style.RESET_ALL}", f"${securities_value:>12,.2f}"],
        [f"{Style.DIM}FDIC Deposits{Style.RESET_ALL}", f"${fdic_deposits:>12,.2f}"],
    ]
    print(tabulate(totals_data, tablefmt="plain"))
    print()

    holdings = portfolio.get("holdings", [])
    if holdings:
        print(format_header("Holdings"))
        print()

        holdings_data = []
        for h in sorted(holdings, key=lambda x: x.get("value", 0), reverse=True):
            symbol = h['symbol']
            name = h.get('name', '')[:25]
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


def cmd_pull(args):
    """Pull statement(s) from Downloads, parse, and show summary."""
    downloads_dir = Path.home() / "Downloads"

    if not downloads_dir.exists():
        result = {"success": False, "error": f"Downloads directory not found: {downloads_dir}"}
        if args.json:
            print(json.dumps(result))
        else:
            print(format_error(result["error"]))
        return 1

    pdf_files = list(downloads_dir.glob("*.pdf"))
    statements = []

    for pdf in pdf_files:
        try:
            if is_sofi_apex_statement(str(pdf)):
                statements.append(pdf)
        except Exception:
            continue

    if not statements:
        result = {"success": False, "error": "No SoFi/Apex statements found in Downloads. Download a statement first."}
        if args.json:
            print(json.dumps(result))
        else:
            print(format_error(result["error"]))
        return 1

    statements.sort(key=lambda f: f.stat().st_mtime, reverse=True)

    if getattr(args, 'latest', False):
        to_process = [statements[0]]
    else:
        to_process = statements

    if not args.json:
        print()
        if len(to_process) > 1:
            print(format_header(f"Processing {len(to_process)} statements"))
            print()

    results = []
    processed_data = []
    errors = []

    for source_pdf in to_process:
        result = _process_single_statement(source_pdf, quiet=args.json)
        results.append(result)

        if result["success"]:
            processed_data.append(result["data"])
        else:
            errors.append(result)

        if not args.json and len(to_process) > 1:
            print()

    template_updated = False
    if not args.no_update and processed_data:
        template_updated = update_template(processed_data[0], all_snapshots=processed_data)

    if not args.json and template_updated:
        print(format_success(f"Template updated: {TEMPLATE_PATH.name}"))
        print()

    if args.json:
        if len(to_process) == 1:
            result = results[0]
            result["template_updated"] = template_updated
            print(json.dumps(result, indent=2))
        else:
            batch_result = {
                "success": len(errors) == 0,
                "processed_count": len(processed_data),
                "statements": results,
                "template_updated": template_updated,
                "errors": errors
            }
            print(json.dumps(batch_result, indent=2))
    else:
        for result in results:
            if result["success"]:
                _display_statement_summary(result["data"])

    return 0 if not errors else 1


def cmd_portfolio(args):
    """Display unified portfolio view across all accounts."""
    if not getattr(args, 'json', False):
        print(f"{Style.DIM}Aggregating portfolio data...{Style.RESET_ALL}")

    result = get_unified_portfolio(
        include_crypto_prices=not getattr(args, 'no_prices', False)
    )

    if args.json:
        print(json.dumps(result, indent=2))
        return 0 if result["success"] else 1

    if not result["success"]:
        print(format_error(result.get("error", "Unknown error")))
        return 1

    print()
    print(format_header("UNIFIED PORTFOLIO"))
    print(f"{Style.DIM}As of: {result['as_of']}{Style.RESET_ALL}")
    print()

    # Total value
    total = result["total_value"]
    print(f"{Style.BRIGHT}TOTAL VALUE: {Fore.GREEN}${total:,.2f}{Style.RESET_ALL}")
    print()

    # Category breakdown
    print(format_header("BY CATEGORY"))
    print()

    by_category = result.get("by_category", {})
    from config import CATEGORY_ORDER, CATEGORY_NAMES

    for cat in CATEGORY_ORDER:
        if cat not in by_category:
            continue
        data = by_category[cat]
        value = data.get("value", 0)
        pct = data.get("pct", 0)
        assets = data.get("assets", [])

        cat_name = CATEGORY_NAMES.get(cat, cat.replace("_", " ").title())

        # Category row
        print(f"  {cat_name:<22} {Fore.GREEN}${value:>12,.2f}{Style.RESET_ALL}  {pct:>5.1f}%")

        # Asset list (truncated to first 3)
        if assets:
            display_assets = assets[:3]
            if len(assets) > 3:
                display_assets.append(f"+{len(assets) - 3} more")
            assets_str = ", ".join(display_assets)
            print(f"  {Style.DIM}  {assets_str}{Style.RESET_ALL}")

    print()

    # Data freshness
    print(format_header("DATA FRESHNESS"))
    freshness = result.get("data_freshness", {})

    sofi_date = freshness.get("sofi_snapshots")
    if sofi_date:
        try:
            from datetime import datetime
            snap_date = datetime.fromisoformat(sofi_date).date()
            today = datetime.now().date()
            days_ago = (today - snap_date).days
            if days_ago == 0:
                days_str = "today"
            elif days_ago == 1:
                days_str = "1 day ago"
            else:
                days_str = f"{days_ago} days ago"
            print(f"  {Style.DIM}SoFi snapshots: {sofi_date} ({days_str}){Style.RESET_ALL}")
        except ValueError:
            print(f"  {Style.DIM}SoFi snapshots: {sofi_date}{Style.RESET_ALL}")
    else:
        print(f"  {Style.DIM}SoFi snapshots: None{Style.RESET_ALL}")

    holdings_date = freshness.get("holdings")
    if holdings_date:
        print(f"  {Style.DIM}Holdings: {holdings_date}{Style.RESET_ALL}")
    else:
        print(f"  {Style.DIM}Holdings: Not set{Style.RESET_ALL}")

    crypto_status = freshness.get("crypto_prices", "unknown")
    print(f"  {Style.DIM}Crypto prices: {crypto_status.title()}{Style.RESET_ALL}")
    print()

    # Warnings
    warnings = result.get("warnings", [])
    if warnings:
        for warning in warnings:
            print(f"{Fore.YELLOW}Warning:{Style.RESET_ALL} {warning}")
        print()

    return 0


def cmd_advise(args):
    """Generate and display financial recommendations."""
    if not getattr(args, 'json', False):
        print(f"{Style.DIM}Analyzing portfolio and generating recommendations...{Style.RESET_ALL}")

    focus = getattr(args, 'focus', 'all')
    result = get_advice(focus)

    if args.json:
        print(json.dumps(result, indent=2))
        return 0 if result.get("success") else 1

    if not result.get("success"):
        print(format_error(result.get("error", "Unknown error")))
        return 1

    _display_advice(result)
    return 0


def _display_advice(result: dict):
    """Display formatted financial advice output matching the spec."""
    from datetime import datetime
    from config import CATEGORY_NAMES

    print()

    # Header
    today = datetime.now().strftime("%B %d, %Y")
    width = 67

    # Use Unicode box-drawing characters
    TOP_LEFT = "┌"
    TOP_RIGHT = "┐"
    BOTTOM_LEFT = "└"
    BOTTOM_RIGHT = "┘"
    HORIZONTAL = "─"
    VERTICAL = "│"
    T_LEFT = "├"
    T_RIGHT = "┤"

    def box_top():
        print(TOP_LEFT + HORIZONTAL * (width - 2) + TOP_RIGHT)

    def box_bottom():
        print(BOTTOM_LEFT + HORIZONTAL * (width - 2) + BOTTOM_RIGHT)

    def box_divider():
        print(T_LEFT + HORIZONTAL * (width - 2) + T_RIGHT)

    # ANSI escape pattern for stripping color codes
    import re
    ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')

    def visible_len(text: str) -> int:
        """Get visible length of text excluding ANSI codes."""
        return len(ansi_escape.sub('', text))

    def truncate_text(text: str, max_len: int) -> str:
        """Truncate text to max visible length, preserving ANSI codes."""
        visible = 0
        result = []
        i = 0
        while i < len(text):
            # Check for ANSI escape sequence
            match = ansi_escape.match(text, i)
            if match:
                result.append(match.group())
                i = match.end()
            else:
                if visible < max_len:
                    result.append(text[i])
                    visible += 1
                i += 1
        return ''.join(result)

    def box_line(text: str, indent: int = 2):
        """Print a line inside the box with proper padding."""
        max_content_width = width - 2 - indent
        vis_len = visible_len(text)
        if vis_len > max_content_width:
            text = truncate_text(text, max_content_width)
            vis_len = visible_len(text)
        padding = width - 2 - indent - vis_len
        if padding < 0:
            padding = 0
        print(f"{VERTICAL}{' ' * indent}{text}{' ' * padding}{VERTICAL}")

    def box_empty():
        print(VERTICAL + " " * (width - 2) + VERTICAL)

    # Title bar
    box_top()
    title = "FINANCIAL ADVISOR"
    title_padding = width - 4 - len(title) - len(today)
    box_line(f"{Style.BRIGHT}{title}{Style.RESET_ALL}{' ' * title_padding}{today}")
    box_divider()

    # Portfolio summary
    ps = result.get("portfolio_summary", {})
    total = ps.get("total_value", 0)
    surplus = ps.get("monthly_surplus", 0)

    box_empty()
    box_line(f"{Style.BRIGHT}PORTFOLIO: {Fore.GREEN}${total:,.0f}{Style.RESET_ALL}")

    by_category = ps.get("by_category", {})
    for i, cat in enumerate(["retirement", "taxable_equities", "crypto", "cash"]):
        if cat in by_category:
            val = by_category[cat].get("value", 0)
            pct = by_category[cat].get("pct", 0)
            name = CATEGORY_NAMES.get(cat, cat.replace("_", " ").title())
            prefix = "└─" if i == 3 else "├─"
            box_line(f"{prefix} {name:<20} {Fore.GREEN}${val:>10,.0f}{Style.RESET_ALL}  ({pct:>4.1f}%)")

    box_empty()
    box_line(f"{Style.DIM}MONTHLY SURPLUS: ${surplus:,.0f}{Style.RESET_ALL}")
    box_empty()
    box_divider()

    # Goal Progress section
    box_line(f"{Style.BRIGHT}GOAL PROGRESS{Style.RESET_ALL}")
    box_divider()
    box_empty()

    goal_details = result.get("goal_details", [])
    if not goal_details:
        box_line(f"{Style.DIM}No goals configured. Run 'finance profile --edit' to set goals.{Style.RESET_ALL}")
    else:
        for goal in goal_details:
            desc = goal.get("description", "Goal")
            target = goal.get("target")
            current = goal.get("current", 0)
            progress = goal.get("progress_pct")
            deadline = goal.get("deadline")
            months = goal.get("months_remaining")
            monthly_req = goal.get("monthly_required")
            monthly_curr = goal.get("current_monthly")
            on_track = goal.get("on_track")
            status = goal.get("status")

            # Goal header with progress
            if target:
                progress_str = f"${current:,.0f} / ${target:,.0f}"
                pct_str = f" ({progress:.0f}%)" if progress is not None else ""
                box_line(f"[*] {desc}: {Fore.CYAN}{progress_str}{Style.RESET_ALL}{pct_str}")
            else:
                box_line(f"[*] {desc}")

            # Deadline info
            if deadline:
                if months is not None:
                    if months > 0:
                        deadline_formatted = _format_deadline(deadline)
                        box_line(f"    Deadline: {deadline_formatted} ({months} months)", indent=2)
                    else:
                        box_line(f"    {Fore.RED}Deadline passed{Style.RESET_ALL}", indent=2)

            # Status
            if status == "behind" or status == "past_deadline":
                box_line(f"    Status: {Fore.YELLOW}OFF TRACK{Style.RESET_ALL}", indent=2)
            elif status == "on_track" or status == "complete":
                box_line(f"    Status: {Fore.GREEN}ON TRACK{Style.RESET_ALL}", indent=2)
            elif status == "qualitative":
                box_line(f"    Status: {Style.DIM}Tracking qualitatively{Style.RESET_ALL}", indent=2)

            # Monthly requirement vs current
            if monthly_req is not None and monthly_curr is not None:
                box_line(f"    └─ Need: ${monthly_req:,.0f}/mo  │  Current: ${monthly_curr:,.0f}/mo", indent=2)

            box_empty()

    box_divider()

    # Recommendations
    box_line(f"{Style.BRIGHT}RECOMMENDATIONS{Style.RESET_ALL}")
    box_divider()

    recommendations = result.get("recommendations", [])

    if not recommendations:
        box_empty()
        box_line(f"{Style.DIM}No recommendations at this time.{Style.RESET_ALL}")
        box_empty()
    else:
        # Group by priority
        high_priority = [r for r in recommendations if r["priority"] == "high"]
        medium_priority = [r for r in recommendations if r["priority"] == "medium"]
        low_priority = [r for r in recommendations if r["priority"] == "low"]

        rec_num = 1

        if high_priority:
            box_empty()
            box_line(f"{Fore.RED}{Style.BRIGHT}!! HIGH PRIORITY{Style.RESET_ALL}")
            box_empty()
            for rec in high_priority:
                _print_recommendation_v2(rec, rec_num, width, box_line, box_empty)
                rec_num += 1

        if medium_priority:
            box_empty()
            box_line(f"{Fore.YELLOW}{Style.BRIGHT}>> CONSIDER{Style.RESET_ALL}")
            box_empty()
            for rec in medium_priority:
                _print_recommendation_v2(rec, rec_num, width, box_line, box_empty)
                rec_num += 1

        if low_priority:
            box_empty()
            box_line(f"{Fore.GREEN}{Style.BRIGHT}-- INFO{Style.RESET_ALL}")
            box_empty()
            for rec in low_priority:
                _print_recommendation_v2(rec, rec_num, width, box_line, box_empty)
                rec_num += 1

    box_divider()

    # Data freshness
    box_line(f"{Style.DIM}DATA FRESHNESS{Style.RESET_ALL}")
    freshness = result.get("data_freshness", {})
    sofi = freshness.get("sofi_snapshots", "N/A")
    holdings = freshness.get("holdings", "N/A")
    prices = freshness.get("crypto_prices", "N/A")
    box_line(f"{Style.DIM}└─ SoFi: {sofi}  │  Holdings: {holdings}  │  Prices: {prices}{Style.RESET_ALL}")
    box_bottom()
    print()


def _format_deadline(deadline: str) -> str:
    """Format YYYY-MM deadline to readable string."""
    try:
        from datetime import datetime
        date = datetime.strptime(deadline, "%Y-%m")
        return date.strftime("%B %Y")
    except ValueError:
        return deadline


def _print_recommendation_v2(rec: dict, num: int, width: int, box_line, box_empty):
    """Print a single recommendation using the new box format."""
    action = rec.get("action", "")
    rationale = rec.get("rationale", "")
    impact = rec.get("impact", "")
    rec_type = rec.get("type", "")

    max_line_width = width - 10  # Account for borders and padding

    # Type indicator
    type_indicator = {
        "rebalance": "[R]",
        "surplus": "[S]",
        "opportunity": "[O]",
        "warning": "[W]",
    }.get(rec_type, "[-]")

    # Action line
    action_display = action[:max_line_width] if len(action) > max_line_width else action
    box_line(f"{num}. {type_indicator} {action_display}")
    box_line(f"   {Style.DIM}{'-' * min(len(action_display) + 5, max_line_width)}{Style.RESET_ALL}")

    # Rationale (wrapped)
    if rationale:
        words = rationale.split()
        lines = []
        current_line = ""
        for word in words:
            if len(current_line) + len(word) + 1 <= max_line_width - 6:
                current_line += word + " "
            else:
                if current_line:
                    lines.append(current_line.rstrip())
                current_line = word + " "
        if current_line.strip():
            lines.append(current_line.rstrip())

        for line in lines[:3]:  # Max 3 lines
            box_line(f"   {Style.DIM}{line}{Style.RESET_ALL}")

    # Impact for high priority items
    if impact and rec.get("priority") == "high":
        impact_display = impact[:max_line_width - 6] if len(impact) > max_line_width - 6 else impact
        box_line(f"   {Fore.CYAN}-> {impact_display}{Style.RESET_ALL}")

    box_empty()


def cmd_db(args):
    """Handle database commands."""
    db_command = getattr(args, 'db_command', None)

    if db_command == 'status':
        return _cmd_db_status(args)
    elif db_command == 'migrate':
        return _cmd_db_migrate(args)
    elif db_command == 'export':
        return _cmd_db_export(args)
    elif db_command == 'reset':
        return _cmd_db_reset(args)
    else:
        # Show database status by default
        return _cmd_db_status(args)


def _cmd_db_status(args):
    """Check database connection status."""
    from config import DATABASE_PATH

    try:
        from database import check_db_connection, get_table_counts
    except ImportError as e:
        result = {"success": False, "error": f"Database module not available: {e}"}
        if args.json:
            print(json.dumps(result))
        else:
            print(format_error(result["error"]))
        return 1

    status = check_db_connection()
    status["database_path"] = str(DATABASE_PATH)

    if args.json:
        if status["connected"]:
            status["table_counts"] = get_table_counts()
        print(json.dumps(status, indent=2))
        return 0 if status["connected"] else 1

    print()
    print(format_header("Database Status"))
    print()

    if status["connected"]:
        print(f"  {Fore.GREEN}Connected{Style.RESET_ALL}")
        print(f"  {Style.DIM}Version: {status.get('version', 'Unknown')}{Style.RESET_ALL}")
        print(f"  {Style.DIM}Path: {DATABASE_PATH}{Style.RESET_ALL}")
        if DATABASE_PATH.exists():
            size_bytes = DATABASE_PATH.stat().st_size
            size_kb = size_bytes / 1024
            print(f"  {Style.DIM}Size: {size_kb:.1f} KB{Style.RESET_ALL}")
        print()

        tables = status.get("tables", [])
        if tables:
            print(format_header("Tables"))
            counts = get_table_counts()
            for table in sorted(tables):
                count = counts.get(table, "?")
                print(f"  {table}: {count} rows")
        print()

        print(f"{Style.DIM}Database mode: {'ENABLED' if USE_DATABASE else 'DISABLED'}{Style.RESET_ALL}")
        if not USE_DATABASE:
            print(f"{Style.DIM}Set FINANCE_USE_DATABASE=true to enable{Style.RESET_ALL}")
    else:
        print(f"  {Fore.YELLOW}Not initialized{Style.RESET_ALL}")
        print(f"  {Style.DIM}Path: {DATABASE_PATH}{Style.RESET_ALL}")
        print()
        print(f"{Style.DIM}Run 'finance db migrate' to initialize and import data{Style.RESET_ALL}")

    print()
    return 0 if status["connected"] else 1


def _cmd_db_migrate(args):
    """Migrate data from JSON files to SQLite database."""
    from config import DATABASE_PATH

    try:
        from database import migrate_from_json
    except ImportError as e:
        result = {"success": False, "error": f"Database module not available: {e}"}
        if args.json:
            print(json.dumps(result))
        else:
            print(format_error(result["error"]))
        return 1

    if not args.json:
        print(f"{Style.DIM}Migrating data from JSON files to SQLite...{Style.RESET_ALL}")

    try:
        results = migrate_from_json()
    except Exception as e:
        result = {"success": False, "error": f"Migration failed: {e}"}
        if args.json:
            print(json.dumps(result))
        else:
            print(format_error(result["error"]))
        return 1

    result = {
        "success": len(results.get("errors", [])) == 0,
        "migrated": results,
        "database_path": str(DATABASE_PATH),
    }

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print()
        print(format_header("Migration Complete"))
        print()
        print(f"  Snapshots: {results.get('snapshots', 0)}")
        print(f"  Holdings: {results.get('holdings', 0)}")
        print(f"  Profile keys: {results.get('profile_keys', 0)}")
        print(f"  Goals: {results.get('goals', 0)}")

        errors = results.get("errors", [])
        if errors:
            print()
            print(f"{Fore.YELLOW}Errors:{Style.RESET_ALL}")
            for err in errors:
                print(f"  - {err}")
        else:
            print()
            print(format_success("All data migrated successfully"))

        print()
        print(f"{Style.DIM}Database: {DATABASE_PATH}{Style.RESET_ALL}")

    return 0 if result["success"] else 1


def _cmd_db_export(args):
    """Export database to JSON files."""
    from config import DATABASE_PATH

    try:
        from database import export_to_json
    except ImportError as e:
        result = {"success": False, "error": f"Database module not available: {e}"}
        if args.json:
            print(json.dumps(result))
        else:
            print(format_error(result["error"]))
        return 1

    if not DATABASE_PATH.exists():
        result = {"success": False, "error": f"Database not found: {DATABASE_PATH}"}
        if args.json:
            print(json.dumps(result))
        else:
            print(format_error(result["error"]))
            print(f"{Style.DIM}Run 'finance db migrate' to create the database{Style.RESET_ALL}")
        return 1

    if not args.json:
        print(f"{Style.DIM}Exporting database to JSON...{Style.RESET_ALL}")

    try:
        data = export_to_json()
    except Exception as e:
        result = {"success": False, "error": f"Export failed: {e}"}
        if args.json:
            print(json.dumps(result))
        else:
            print(format_error(result["error"]))
        return 1

    # Save to export file
    export_path = REPO_ROOT / ".data" / "finance" / "db_export.json"
    export_path.parent.mkdir(parents=True, exist_ok=True)
    export_path.write_text(json.dumps(data, indent=2, default=str))

    result = {
        "success": True,
        "export_path": str(export_path),
        "counts": {
            "snapshots": len(data.get("snapshots", [])),
            "holdings_categories": len([k for k in data.get("holdings", {}) if k != "last_updated"]),
            "profile_keys": len([k for k in data.get("profile", {}) if k != "goals"]),
            "goals": len(data.get("profile", {}).get("goals", {})),
            "goal_progress": len(data.get("goal_progress", [])),
        }
    }

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print()
        print(format_success(f"Exported to: {export_path}"))
        print()
        counts = result["counts"]
        print(f"  Snapshots: {counts['snapshots']}")
        print(f"  Holdings categories: {counts['holdings_categories']}")
        print(f"  Profile keys: {counts['profile_keys']}")
        print(f"  Goals: {counts['goals']}")
        print(f"  Goal progress entries: {counts['goal_progress']}")

    return 0


def _cmd_db_reset(args):
    """Reset database (delete SQLite file)."""
    from config import DATABASE_PATH

    if not DATABASE_PATH.exists():
        result = {"success": True, "message": "Database file does not exist (nothing to reset)"}
        if args.json:
            print(json.dumps(result))
        else:
            print(format_success(result["message"]))
        return 0

    if not args.json:
        size_kb = DATABASE_PATH.stat().st_size / 1024
        print(f"{Fore.RED}WARNING: This will delete the database file!{Style.RESET_ALL}")
        print(f"{Style.DIM}Path: {DATABASE_PATH}{Style.RESET_ALL}")
        print(f"{Style.DIM}Size: {size_kb:.1f} KB{Style.RESET_ALL}")
        confirm = input("Type 'yes' to confirm: ").strip().lower()
        if confirm != 'yes':
            print("Aborted.")
            return 1

    try:
        DATABASE_PATH.unlink()
        result = {"success": True, "message": "Database reset complete"}
        if args.json:
            print(json.dumps(result))
        else:
            print(format_success(result["message"]))
            print(f"{Style.DIM}Run 'finance db migrate' to re-import data from JSON files{Style.RESET_ALL}")
        return 0
    except Exception as e:
        result = {"success": False, "error": f"Reset failed: {e}"}
        if args.json:
            print(json.dumps(result))
        else:
            print(format_error(result["error"]))
        return 1
