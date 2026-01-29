#!/usr/bin/env python3
"""
Finance CLI tool for parsing brokerage statements and managing financial planning.

Usage:
    finance parse <statement.pdf> [--no-update] [--json]
    finance pull [--latest] [--no-update] [--json]
    finance history [--account <type>] [--json]
    finance summary [--json]
    finance plan [--no-save] [--no-copy] [--json]
    finance profile [--edit] [--reset] [--json]
    finance holdings [--json]
    finance holdings set <path> <value> [--notes] [--json]
    finance holdings check [--json]
    finance portfolio [--no-prices] [--json]
    finance advise [--focus <area>] [--json]
    finance db [status|migrate|export|reset] [--json]

Database: Uses SQLite at .data/finance/finance.db (no Docker required)
"""

import argparse
import sys
from pathlib import Path

# Add cli directory to path for imports when running as script
sys.path.insert(0, str(Path(__file__).parent))

from commands import (
    cmd_parse,
    cmd_pull,
    cmd_history,
    cmd_summary,
    cmd_plan,
    cmd_plan_advisor,
    cmd_profile,
    cmd_holdings,
    cmd_portfolio,
    cmd_advise,
    cmd_db,
    cmd_expenses,
)


def main():
    parser = argparse.ArgumentParser(
        description="Finance CLI for parsing statements and managing financial planning"
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

    # pull command
    pull_parser = subparsers.add_parser("pull", help="Pull statements from Downloads")
    pull_parser.add_argument("--latest", action="store_true",
                             help="Only process the most recent statement (default: all)")
    pull_parser.add_argument("--no-update", action="store_true",
                             help="Don't update the planning template")
    pull_parser.add_argument("--json", action="store_true", help="Output as JSON")

    # plan command
    plan_parser = subparsers.add_parser("plan", help="Generate populated planning prompt")
    plan_parser.add_argument("--advisor", action="store_true",
                             help="Generate advisor session with recommendations (default: planning template)")
    plan_parser.add_argument("--no-save", action="store_true",
                             help="Don't save to file (default: save)")
    plan_parser.add_argument("--no-copy", action="store_true",
                             help="Don't copy to clipboard (default: copy)")
    plan_parser.add_argument("--json", action="store_true", help="Output as JSON only")

    # profile command
    profile_parser = subparsers.add_parser("profile", help="View or edit financial profile")
    profile_parser.add_argument("--edit", action="store_true",
                                help="Interactively edit profile")
    profile_parser.add_argument("--reset", action="store_true",
                                help="Clear profile and re-enter all values")
    profile_parser.add_argument("--json", action="store_true", help="Output as JSON")

    # holdings command
    holdings_parser = subparsers.add_parser("holdings", help="View and manage manual holdings")
    holdings_parser.add_argument("--json", action="store_true", help="Output as JSON")

    holdings_subparsers = holdings_parser.add_subparsers(dest="holdings_command")

    # holdings set subcommand
    holdings_set_parser = holdings_subparsers.add_parser("set", help="Set a holding value")
    holdings_set_parser.add_argument("path", help="Path: crypto.BTC, bank.hysa, other.hsa")
    holdings_set_parser.add_argument("value", type=float, help="Value (quantity for crypto, balance for others)")
    holdings_set_parser.add_argument("--notes", "-n", help="Optional notes (crypto only)")
    holdings_set_parser.add_argument("--json", action="store_true", help="Output as JSON")

    # holdings check subcommand
    holdings_check_parser = holdings_subparsers.add_parser("check", help="Check if holdings data is stale")
    holdings_check_parser.add_argument("--json", action="store_true", help="Output as JSON")

    # portfolio command
    portfolio_parser = subparsers.add_parser("portfolio", help="Unified portfolio view across all accounts")
    portfolio_parser.add_argument("--json", action="store_true", help="Output as JSON")
    portfolio_parser.add_argument("--no-prices", action="store_true",
                                  help="Skip fetching live crypto prices")

    # advise command
    advise_parser = subparsers.add_parser("advise", help="Get financial recommendations")
    advise_parser.add_argument("--focus", choices=["all", "goals", "rebalance", "surplus", "opportunities", "spending"],
                               default="all", help="Focus area for recommendations")
    advise_parser.add_argument("--json", action="store_true", help="Output as JSON")

    # expenses command
    expenses_parser = subparsers.add_parser("expenses", help="Credit card expense analysis")
    expenses_parser.add_argument("--json", action="store_true", help="Output as JSON")

    expenses_subparsers = expenses_parser.add_subparsers(dest="expenses_command")

    # expenses import
    exp_import_parser = expenses_subparsers.add_parser("import", help="Import credit card statement(s)")
    exp_import_parser.add_argument("statements", nargs="+", help="Path(s) to CC statement PDF(s)")
    exp_import_parser.add_argument("--no-categorize", action="store_true",
                                   help="Skip AI categorization")
    exp_import_parser.add_argument("--json", action="store_true", help="Output as JSON")

    # expenses summary
    exp_summary_parser = expenses_subparsers.add_parser("summary", help="Category breakdown")
    exp_summary_parser.add_argument("--months", type=int, default=1,
                                    help="Number of months to include (default: 1)")
    exp_summary_parser.add_argument("--json", action="store_true", help="Output as JSON")

    # expenses history
    exp_history_parser = expenses_subparsers.add_parser("history", help="List imported CC statements")
    exp_history_parser.add_argument("--json", action="store_true", help="Output as JSON")

    # expenses recurring
    exp_recurring_parser = expenses_subparsers.add_parser("recurring", help="Show recurring charges")
    exp_recurring_parser.add_argument("--json", action="store_true", help="Output as JSON")

    # expenses categories
    exp_categories_parser = expenses_subparsers.add_parser("categories", help="View merchant category mappings")
    exp_categories_parser.add_argument("--json", action="store_true", help="Output as JSON")

    # expenses set-category
    exp_setcat_parser = expenses_subparsers.add_parser("set-category", help="Override a merchant category")
    exp_setcat_parser.add_argument("merchant", help="Normalized merchant name")
    exp_setcat_parser.add_argument("category", help="Category to assign")
    exp_setcat_parser.add_argument("--json", action="store_true", help="Output as JSON")

    # expenses insights
    exp_insights_parser = expenses_subparsers.add_parser("insights", help="AI-powered spending insights")
    exp_insights_parser.add_argument("--months", type=int, default=3,
                                     help="Number of months to analyze (default: 3)")
    exp_insights_parser.add_argument("--refresh", action="store_true",
                                     help="Regenerate insights (bypass cache)")
    exp_insights_parser.add_argument("--json", action="store_true", help="Output as JSON")

    # db command
    db_parser = subparsers.add_parser("db", help="Database management (SQLite)")
    db_parser.add_argument("--json", action="store_true", help="Output as JSON")

    db_subparsers = db_parser.add_subparsers(dest="db_command")

    # db status
    db_status_parser = db_subparsers.add_parser("status", help="Check database status")
    db_status_parser.add_argument("--json", action="store_true", help="Output as JSON")

    # db migrate
    db_migrate_parser = db_subparsers.add_parser("migrate", help="Migrate JSON data to SQLite")
    db_migrate_parser.add_argument("--json", action="store_true", help="Output as JSON")

    # db export
    db_export_parser = db_subparsers.add_parser("export", help="Export database to JSON")
    db_export_parser.add_argument("--json", action="store_true", help="Output as JSON")

    # db reset
    db_reset_parser = db_subparsers.add_parser("reset", help="Reset database (delete SQLite file)")
    db_reset_parser.add_argument("--json", action="store_true", help="Output as JSON")

    args = parser.parse_args()

    if args.command == "parse":
        return cmd_parse(args)
    elif args.command == "history":
        return cmd_history(args)
    elif args.command == "summary":
        return cmd_summary(args)
    elif args.command == "pull":
        return cmd_pull(args)
    elif args.command == "plan":
        if getattr(args, 'advisor', False):
            return cmd_plan_advisor(args)
        return cmd_plan(args)
    elif args.command == "profile":
        return cmd_profile(args)
    elif args.command == "holdings":
        return cmd_holdings(args)
    elif args.command == "portfolio":
        return cmd_portfolio(args)
    elif args.command == "advise":
        return cmd_advise(args)
    elif args.command == "expenses":
        return cmd_expenses(args)
    elif args.command == "db":
        return cmd_db(args)
    else:
        parser.print_help()
        return 0


if __name__ == "__main__":
    sys.exit(main())
