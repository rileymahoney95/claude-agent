"""
Database connection management and utilities for the finance CLI.
Uses SQLite for local storage (no Docker required).
"""

import json
import sqlite3
from collections import defaultdict
from contextlib import contextmanager
from datetime import date, datetime
from pathlib import Path

from config import DATABASE_PATH, SNAPSHOTS_DIR, HOLDINGS_PATH, PROFILE_PATH


def dict_factory(cursor, row):
    """Convert sqlite3 rows to dicts."""
    return {col[0]: row[idx] for idx, col in enumerate(cursor.description)}


@contextmanager
def get_connection():
    """Get SQLite connection with dict cursor and automatic commit/rollback."""
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DATABASE_PATH))
    conn.row_factory = dict_factory
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_database():
    """Initialize database schema from schema_sqlite.sql."""
    schema_path = Path(__file__).parent.parent / "schema_sqlite.sql"
    if not schema_path.exists():
        raise FileNotFoundError(f"Schema file not found: {schema_path}")

    with get_connection() as conn:
        conn.executescript(schema_path.read_text())


def check_db_connection() -> dict:
    """Check if database is accessible and return status."""
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT sqlite_version()")
            version = cur.fetchone()["sqlite_version()"]
            cur.execute("""
                SELECT name FROM sqlite_master
                WHERE type='table' AND name NOT LIKE 'sqlite_%'
            """)
            tables = [row["name"] for row in cur.fetchall()]
        return {
            "connected": True,
            "version": f"SQLite {version}",
            "tables": tables,
        }
    except Exception as e:
        return {
            "connected": False,
            "error": str(e),
        }


def get_table_counts() -> dict:
    """Get row counts for all tables."""
    tables = ["snapshots", "holdings", "profile", "goals", "goal_progress", "market_cache", "projection_scenarios", "cc_statements", "cc_transactions", "merchant_categories", "spending_insights"]
    with get_connection() as conn:
        cur = conn.cursor()
        counts = {}
        for table in tables:
            try:
                cur.execute(f"SELECT COUNT(*) as count FROM {table}")
                counts[table] = cur.fetchone()["count"]
            except sqlite3.OperationalError:
                counts[table] = 0
        return counts


# =============================================================================
# MIGRATION FUNCTIONS
# =============================================================================

def migrate_from_json() -> dict:
    """
    One-time migration from existing JSON files to SQLite.
    Returns summary of migrated records.
    """
    init_database()

    results = {
        "snapshots": 0,
        "holdings": 0,
        "profile_keys": 0,
        "goals": 0,
        "errors": [],
    }

    with get_connection() as conn:
        cur = conn.cursor()

        # Migrate snapshots
        if SNAPSHOTS_DIR.exists():
            for json_file in SNAPSHOTS_DIR.glob("*.json"):
                try:
                    data = json.loads(json_file.read_text())
                    _insert_snapshot_from_json(cur, data, json_file.name)
                    results["snapshots"] += 1
                except Exception as e:
                    results["errors"].append(f"Snapshot {json_file.name}: {e}")

        # Migrate holdings
        if HOLDINGS_PATH.exists():
            try:
                holdings = json.loads(HOLDINGS_PATH.read_text())
                count = _migrate_holdings(cur, holdings)
                results["holdings"] = count
            except Exception as e:
                results["errors"].append(f"Holdings: {e}")

        # Migrate profile
        if PROFILE_PATH.exists():
            try:
                profile = json.loads(PROFILE_PATH.read_text())
                keys, goals = _migrate_profile(cur, profile)
                results["profile_keys"] = keys
                results["goals"] = goals
            except Exception as e:
                results["errors"].append(f"Profile: {e}")

    return results


def _insert_snapshot_from_json(cur, data: dict, source_file: str):
    """Insert a single snapshot from parsed JSON data."""
    portfolio = data.get("portfolio", {})
    period = data.get("period", {})

    cur.execute("""
        INSERT OR REPLACE INTO snapshots (
            statement_date, account_type, account_id, account_holder,
            period_start, period_end, total_value, securities_value,
            fdic_deposits, holdings, income, retirement, source_file
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        data.get("statement_date"),
        data.get("account_type"),
        data.get("account_id"),
        data.get("account_holder"),
        period.get("start"),
        period.get("end"),
        portfolio.get("total_value"),
        portfolio.get("securities_value"),
        portfolio.get("fdic_deposits"),
        json.dumps(portfolio.get("holdings", [])),
        json.dumps(data.get("income")),
        json.dumps(data.get("retirement")),
        source_file,
    ))


def _migrate_holdings(cur, holdings: dict) -> int:
    """Migrate holdings from JSON structure to database."""
    count = 0
    last_updated = holdings.get("last_updated") or date.today().isoformat()

    # Crypto holdings
    for key, value in holdings.get("crypto", {}).items():
        cur.execute("""
            INSERT OR REPLACE INTO holdings (category, key, display_name, quantity, notes, last_updated)
            VALUES ('crypto', ?, ?, ?, ?, ?)
        """, (key, key.upper(), value.get("quantity"), value.get("notes"), last_updated))
        count += 1

    # Bank accounts
    for key, value in holdings.get("bank_accounts", {}).items():
        cur.execute("""
            INSERT OR REPLACE INTO holdings (category, key, display_name, balance, notes, last_updated)
            VALUES ('bank', ?, ?, ?, ?, ?)
        """, (key, value.get("name", key.upper()), value.get("balance"), value.get("notes"), last_updated))
        count += 1

    # Other accounts
    for key, value in holdings.get("other", {}).items():
        cur.execute("""
            INSERT OR REPLACE INTO holdings (category, key, display_name, balance, notes, last_updated)
            VALUES ('other', ?, ?, ?, ?, ?)
        """, (key, value.get("name", key.upper()), value.get("balance"), value.get("notes"), last_updated))
        count += 1

    return count


def _migrate_profile(cur, profile: dict) -> tuple[int, int]:
    """Migrate profile from JSON to database. Returns (profile_keys, goals) counts."""
    keys_count = 0
    goals_count = 0

    # Store profile sections as key-value pairs
    for key in ["monthly_cash_flow", "household_context", "tax_situation", "projection_settings"]:
        if key in profile and profile[key] is not None:
            cur.execute("""
                INSERT OR REPLACE INTO profile (key, value, updated_at)
                VALUES (?, ?, datetime('now'))
            """, (key, json.dumps(profile[key])))
            keys_count += 1

    # Migrate goals to separate table
    goals = profile.get("goals", {})
    for goal_type in ["short_term", "medium_term", "long_term"]:
        goal = goals.get(goal_type, {})
        if goal:
            cur.execute("""
                INSERT OR REPLACE INTO goals (goal_type, description, target, deadline, updated_at)
                VALUES (?, ?, ?, ?, datetime('now'))
            """, (goal_type, goal.get("description"), goal.get("target"), goal.get("deadline")))
            goals_count += 1

    return keys_count, goals_count


# =============================================================================
# SNAPSHOT QUERIES
# =============================================================================

def get_latest_by_account_type() -> dict:
    """Get most recent snapshot for each account type."""
    with get_connection() as conn:
        cur = conn.cursor()
        # SQLite equivalent of DISTINCT ON using subquery
        cur.execute("""
            SELECT s.* FROM snapshots s
            INNER JOIN (
                SELECT account_type, MAX(statement_date) as max_date
                FROM snapshots
                GROUP BY account_type
            ) latest ON s.account_type = latest.account_type
                    AND s.statement_date = latest.max_date
        """)
        return {row["account_type"]: dict(row) for row in cur.fetchall()}


def get_snapshot_history(
    account_type: str = None,
    start_date: str = None,
    end_date: str = None,
    limit: int = None
) -> list:
    """Query snapshots with optional filters."""
    query = "SELECT * FROM snapshots WHERE 1=1"
    params = []

    if account_type:
        query += " AND account_type = ?"
        params.append(account_type)
    if start_date:
        query += " AND statement_date >= ?"
        params.append(start_date)
    if end_date:
        query += " AND statement_date <= ?"
        params.append(end_date)

    query += " ORDER BY statement_date DESC"

    if limit:
        query += " LIMIT ?"
        params.append(limit)

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(query, params)
        return [dict(row) for row in cur.fetchall()]


def get_latest_snapshot(account_type: str = None) -> dict | None:
    """Get the most recent snapshot, optionally filtered by account type."""
    query = "SELECT * FROM snapshots"
    params = []

    if account_type:
        query += " WHERE account_type = ?"
        params.append(account_type)

    query += " ORDER BY statement_date DESC LIMIT 1"

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(query, params)
        row = cur.fetchone()
        return dict(row) if row else None


def save_snapshot(data: dict, source_file: str = None) -> int:
    """Save parsed statement to database. Returns snapshot ID."""
    portfolio = data.get("portfolio", {})
    period = data.get("period", {})

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT OR REPLACE INTO snapshots (
                statement_date, account_type, account_id, account_holder,
                period_start, period_end, total_value, securities_value,
                fdic_deposits, holdings, income, retirement, source_file
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data.get("statement_date"),
            data.get("account_type"),
            data.get("account_id"),
            data.get("account_holder"),
            period.get("start"),
            period.get("end"),
            portfolio.get("total_value"),
            portfolio.get("securities_value"),
            portfolio.get("fdic_deposits"),
            json.dumps(portfolio.get("holdings", [])),
            json.dumps(data.get("income")),
            json.dumps(data.get("retirement")),
            source_file,
        ))
        return cur.lastrowid


# =============================================================================
# HOLDINGS QUERIES
# =============================================================================

def get_all_holdings() -> dict:
    """Get all holdings organized by category."""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT category, key, display_name, quantity, balance, notes, last_updated
            FROM holdings
            ORDER BY category, key
        """)

        result = {"crypto": {}, "bank_accounts": {}, "other": {}, "last_updated": None}
        latest_date = None

        for row in cur.fetchall():
            cat = row["category"]
            key = row["key"]

            if cat == "crypto":
                result["crypto"][key] = {
                    "quantity": float(row["quantity"]) if row["quantity"] else None,
                    "notes": row["notes"],
                }
            elif cat == "bank":
                result["bank_accounts"][key] = {
                    "name": row["display_name"],
                    "balance": float(row["balance"]) if row["balance"] else None,
                    "notes": row["notes"],
                }
            elif cat == "other":
                result["other"][key] = {
                    "name": row["display_name"],
                    "balance": float(row["balance"]) if row["balance"] else None,
                    "notes": row["notes"],
                }

            # Track most recent update
            if row["last_updated"]:
                row_date = str(row["last_updated"])
                if not latest_date or row_date > latest_date:
                    latest_date = row_date

        result["last_updated"] = latest_date
        return result


def set_holding(category: str, key: str, value: float, notes: str = None) -> None:
    """Set a single holding value."""
    today = date.today().isoformat()

    with get_connection() as conn:
        cur = conn.cursor()

        if category == "crypto":
            cur.execute("""
                INSERT INTO holdings (category, key, display_name, quantity, notes, last_updated)
                VALUES ('crypto', ?, ?, ?, ?, ?)
                ON CONFLICT(category, key) DO UPDATE SET
                    quantity = excluded.quantity,
                    notes = COALESCE(excluded.notes, holdings.notes),
                    last_updated = excluded.last_updated
            """, (key, key.upper(), value, notes, today))
        else:
            # bank or other
            db_category = "bank" if category == "bank_accounts" else category
            cur.execute("""
                INSERT INTO holdings (category, key, display_name, balance, notes, last_updated)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(category, key) DO UPDATE SET
                    balance = excluded.balance,
                    notes = COALESCE(excluded.notes, holdings.notes),
                    last_updated = excluded.last_updated
            """, (db_category, key, key.upper(), value, notes, today))


def delete_holding(category: str, key: str) -> bool:
    """Delete a holding. Returns True if deleted, False if not found."""
    with get_connection() as conn:
        cur = conn.cursor()
        db_category = "bank" if category == "bank_accounts" else category
        cur.execute("""
            DELETE FROM holdings WHERE category = ? AND key = ?
        """, (db_category, key))
        return cur.rowcount > 0


def get_holdings_last_updated() -> str | None:
    """Get the most recent holdings update date."""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT MAX(last_updated) as last_updated FROM holdings")
        row = cur.fetchone()
        return str(row["last_updated"]) if row and row["last_updated"] else None


# =============================================================================
# PROFILE QUERIES
# =============================================================================

def get_profile() -> dict:
    """Get full profile with goals."""
    with get_connection() as conn:
        cur = conn.cursor()

        # Get profile key-value pairs
        cur.execute("SELECT key, value FROM profile")
        result = {}
        for row in cur.fetchall():
            value = row["value"]
            if isinstance(value, str):
                try:
                    value = json.loads(value)
                except json.JSONDecodeError:
                    pass
            result[row["key"]] = value

        # Get goals
        cur.execute("""
            SELECT goal_type, description, target, deadline, updated_at
            FROM goals
            ORDER BY goal_type
        """)
        goals = {}
        for row in cur.fetchall():
            goals[row["goal_type"]] = {
                "description": row["description"],
                "target": float(row["target"]) if row["target"] else None,
                "deadline": row["deadline"],
            }
        result["goals"] = goals

        return result


def save_profile(profile: dict) -> None:
    """Save full profile to database."""
    with get_connection() as conn:
        cur = conn.cursor()

        # Save profile sections
        for key in ["monthly_cash_flow", "household_context", "tax_situation", "projection_settings"]:
            if key in profile and profile[key] is not None:
                cur.execute("""
                    INSERT INTO profile (key, value, updated_at)
                    VALUES (?, ?, datetime('now'))
                    ON CONFLICT(key) DO UPDATE SET
                        value = excluded.value,
                        updated_at = datetime('now')
                """, (key, json.dumps(profile[key])))

        # Save goals
        goals = profile.get("goals", {})
        for goal_type in ["short_term", "medium_term", "long_term"]:
            goal = goals.get(goal_type, {})
            cur.execute("""
                INSERT INTO goals (goal_type, description, target, deadline, updated_at)
                VALUES (?, ?, ?, ?, datetime('now'))
                ON CONFLICT(goal_type) DO UPDATE SET
                    description = excluded.description,
                    target = excluded.target,
                    deadline = excluded.deadline,
                    updated_at = datetime('now')
            """, (goal_type, goal.get("description"), goal.get("target"), goal.get("deadline")))


def update_profile_section(section: str, data: dict) -> None:
    """Update a single profile section."""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO profile (key, value, updated_at)
            VALUES (?, ?, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = datetime('now')
        """, (section, json.dumps(data)))


# =============================================================================
# GOAL PROGRESS TRACKING
# =============================================================================

def record_goal_progress(goal_analysis: dict) -> None:
    """Record goal progress snapshot (called when statements are pulled)."""
    with get_connection() as conn:
        cur = conn.cursor()
        today = date.today().replace(day=1).isoformat()  # First of month

        for goal_type in ["short_term", "medium_term", "long_term"]:
            goal = goal_analysis.get(goal_type, {})
            if goal.get("status") not in ["not_set", None]:
                cur.execute("""
                    INSERT INTO goal_progress (
                        goal_type, recorded_at, current_value,
                        progress_pct, monthly_required, on_track
                    ) VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(goal_type, recorded_at) DO UPDATE SET
                        current_value = excluded.current_value,
                        progress_pct = excluded.progress_pct,
                        monthly_required = excluded.monthly_required,
                        on_track = excluded.on_track
                """, (
                    goal_type,
                    today,
                    goal.get("current"),
                    goal.get("progress_pct"),
                    goal.get("monthly_required"),
                    1 if goal.get("on_track") else 0,
                ))


def get_goal_history(goal_type: str = None, months: int = 12) -> list:
    """Get goal progress history."""
    with get_connection() as conn:
        cur = conn.cursor()
        if goal_type:
            cur.execute("""
                SELECT * FROM goal_progress
                WHERE goal_type = ?
                  AND recorded_at >= DATE('now', '-' || ? || ' months')
                ORDER BY recorded_at
            """, (goal_type, months))
        else:
            cur.execute("""
                SELECT * FROM goal_progress
                WHERE recorded_at >= DATE('now', '-' || ? || ' months')
                ORDER BY goal_type, recorded_at
            """, (months,))
        return [dict(row) for row in cur.fetchall()]


# =============================================================================
# MARKET DATA CACHE
# =============================================================================

def get_cached_market_data(cache_key: str) -> dict | None:
    """Get cached market data if not expired."""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT data FROM market_cache
            WHERE cache_key = ? AND expires_at > datetime('now')
        """, (cache_key,))
        row = cur.fetchone()
        if row:
            data = row["data"]
            if isinstance(data, str):
                return json.loads(data)
            return data
        return None


def cache_market_data(cache_key: str, data: dict, ttl_minutes: int = 15) -> None:
    """Cache market data with TTL."""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO market_cache (cache_key, data, fetched_at, expires_at)
            VALUES (?, ?, datetime('now'), datetime('now', '+' || ? || ' minutes'))
            ON CONFLICT(cache_key) DO UPDATE SET
                data = excluded.data,
                fetched_at = excluded.fetched_at,
                expires_at = excluded.expires_at
        """, (cache_key, json.dumps(data), ttl_minutes))


def clear_market_cache() -> int:
    """Clear all cached market data. Returns count of deleted rows."""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM market_cache")
        return cur.rowcount


# =============================================================================
# PORTFOLIO HISTORY
# =============================================================================

def get_portfolio_history(months: int = 12) -> list:
    """Get total portfolio value over time for charts."""
    with get_connection() as conn:
        cur = conn.cursor()
        # Fetch raw data and aggregate in Python (SQLite doesn't have jsonb_object_agg)
        cur.execute("""
            SELECT statement_date, account_type, total_value
            FROM snapshots
            WHERE statement_date >= DATE('now', '-' || ? || ' months')
            ORDER BY statement_date
        """, (months,))
        rows = cur.fetchall()

    # Group by date in Python
    by_date = defaultdict(dict)
    for row in rows:
        by_date[row["statement_date"]][row["account_type"]] = float(row["total_value"])

    return [
        {
            "statement_date": date_str,
            "total_value": sum(accounts.values()),
            "by_account": accounts
        }
        for date_str, accounts in sorted(by_date.items())
    ]


# =============================================================================
# EXPORT FUNCTIONS
# =============================================================================

def export_to_json() -> dict:
    """Export all database data to JSON format (for backup)."""
    return {
        "snapshots": get_snapshot_history(),
        "holdings": get_all_holdings(),
        "profile": get_profile(),
        "goal_progress": get_goal_history(months=120),  # All history
    }


# =============================================================================
# PROJECTION SCENARIOS
# =============================================================================

def create_projection_scenario(name: str, settings: dict, is_primary: bool = False) -> dict:
    """
    Create a new projection scenario.

    If is_primary=True, atomically unsets other primaries.

    Returns:
        The created scenario dict
    """
    with get_connection() as conn:
        cur = conn.cursor()

        if is_primary:
            # Unset any existing primary scenarios first
            cur.execute("""
                UPDATE projection_scenarios
                SET is_primary = 0, updated_at = datetime('now')
                WHERE is_primary = 1
            """)

        cur.execute("""
            INSERT INTO projection_scenarios (name, settings, is_primary)
            VALUES (?, ?, ?)
        """, (name, json.dumps(settings), 1 if is_primary else 0))

        scenario_id = cur.lastrowid

        # Fetch the created row
        cur.execute("""
            SELECT id, name, is_primary, settings, created_at, updated_at
            FROM projection_scenarios WHERE id = ?
        """, (scenario_id,))
        row = cur.fetchone()
        return _format_scenario(row)


def get_projection_scenarios() -> list:
    """Get all projection scenarios."""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, name, is_primary, settings, created_at, updated_at
            FROM projection_scenarios
            ORDER BY is_primary DESC, name ASC
        """)
        return [_format_scenario(row) for row in cur.fetchall()]


def get_projection_scenario(scenario_id: int) -> dict | None:
    """Get a single scenario by ID."""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, name, is_primary, settings, created_at, updated_at
            FROM projection_scenarios
            WHERE id = ?
        """, (scenario_id,))
        row = cur.fetchone()
        return _format_scenario(row) if row else None


def update_projection_scenario(
    scenario_id: int,
    name: str = None,
    settings: dict = None,
    is_primary: bool = None
) -> dict | None:
    """
    Update a projection scenario.

    Returns:
        Updated scenario dict, or None if not found
    """
    with get_connection() as conn:
        cur = conn.cursor()

        # Check if exists
        cur.execute("SELECT id FROM projection_scenarios WHERE id = ?", (scenario_id,))
        if not cur.fetchone():
            return None

        # Build dynamic update
        updates = []
        params = []

        if name is not None:
            updates.append("name = ?")
            params.append(name)

        if settings is not None:
            updates.append("settings = ?")
            params.append(json.dumps(settings))

        if is_primary is not None:
            if is_primary:
                # Unset other primaries first
                cur.execute("""
                    UPDATE projection_scenarios
                    SET is_primary = 0, updated_at = datetime('now')
                    WHERE is_primary = 1 AND id != ?
                """, (scenario_id,))
            updates.append("is_primary = ?")
            params.append(1 if is_primary else 0)

        if not updates:
            # Nothing to update, just return current
            cur.execute("SELECT * FROM projection_scenarios WHERE id = ?", (scenario_id,))
            row = cur.fetchone()
            return _format_scenario(row) if row else None

        updates.append("updated_at = datetime('now')")
        params.append(scenario_id)

        query = f"""
            UPDATE projection_scenarios
            SET {", ".join(updates)}
            WHERE id = ?
        """
        cur.execute(query, params)

        # Fetch updated row
        cur.execute("""
            SELECT id, name, is_primary, settings, created_at, updated_at
            FROM projection_scenarios WHERE id = ?
        """, (scenario_id,))
        row = cur.fetchone()
        return _format_scenario(row) if row else None


def delete_projection_scenario(scenario_id: int) -> tuple[bool, str | None]:
    """
    Delete a projection scenario.

    Cannot delete a primary scenario - must reassign first.

    Returns:
        (success, error_message)
    """
    with get_connection() as conn:
        cur = conn.cursor()

        # Check if primary
        cur.execute("""
            SELECT is_primary FROM projection_scenarios WHERE id = ?
        """, (scenario_id,))

        row = cur.fetchone()
        if not row:
            return False, "Scenario not found"

        if row["is_primary"]:
            return False, "Cannot delete primary scenario. Set another scenario as primary first."

        cur.execute("DELETE FROM projection_scenarios WHERE id = ?", (scenario_id,))
        return True, None


# =============================================================================
# CREDIT CARD STATEMENT & TRANSACTION QUERIES
# =============================================================================

def save_cc_statement(data: dict, source_file: str = None) -> int:
    """Save a credit card statement to database. Returns statement ID.

    Uses INSERT OR REPLACE on (statement_date, card_type) unique constraint.
    CASCADE delete on cc_transactions ensures old transactions are removed on re-import.
    """
    summary = data.get("summary", {})
    period = data.get("period", {})
    rewards = data.get("rewards", {})

    with get_connection() as conn:
        cur = conn.cursor()
        # Enable foreign keys for cascade delete
        cur.execute("PRAGMA foreign_keys = ON")

        cur.execute("""
            INSERT OR REPLACE INTO cc_statements (
                statement_date, card_type, account_last_four,
                period_start, period_end,
                previous_balance, payments_credits, purchases, fees, interest,
                new_balance, credit_limit,
                rewards_points_earned, rewards_points_balance,
                source_file
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data.get("statement_date"),
            data.get("card_type"),
            data.get("account_last_four"),
            period.get("start"),
            period.get("end"),
            summary.get("previous_balance"),
            summary.get("payments_credits"),
            summary.get("purchases"),
            summary.get("fees"),
            summary.get("interest"),
            summary.get("new_balance"),
            summary.get("credit_limit"),
            rewards.get("points_earned"),
            rewards.get("points_balance"),
            source_file,
        ))
        return cur.lastrowid


def save_cc_transactions(statement_id: int, transactions: list) -> int:
    """Save transactions for a credit card statement. Returns count saved."""
    with get_connection() as conn:
        cur = conn.cursor()
        count = 0
        for txn in transactions:
            cur.execute("""
                INSERT INTO cc_transactions (
                    statement_id, transaction_date, description,
                    normalized_merchant, amount, type, category, is_recurring
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                statement_id,
                txn.get("date"),
                txn.get("description"),
                txn.get("normalized_merchant"),
                txn.get("amount"),
                txn.get("type"),
                txn.get("category"),
                1 if txn.get("is_recurring") else 0,
            ))
            count += 1
        return count


def get_cc_statements(limit: int = None) -> list:
    """Get all imported CC statements, newest first."""
    query = "SELECT * FROM cc_statements ORDER BY statement_date DESC"
    params = []
    if limit:
        query += " LIMIT ?"
        params.append(limit)
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(query, params)
        return [dict(row) for row in cur.fetchall()]


def get_cc_statement_by_id(statement_id: int) -> dict | None:
    """Get a single CC statement by ID."""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT * FROM cc_statements WHERE id = ?", (statement_id,))
        row = cur.fetchone()
        return dict(row) if row else None


def get_cc_transactions(
    start_date: str = None,
    end_date: str = None,
    category: str = None,
    merchant: str = None,
    txn_type: str = None,
    limit: int = None,
) -> list:
    """Query CC transactions with optional filters."""
    query = "SELECT t.*, s.card_type FROM cc_transactions t JOIN cc_statements s ON t.statement_id = s.id WHERE 1=1"
    params = []

    if start_date:
        query += " AND t.transaction_date >= ?"
        params.append(start_date)
    if end_date:
        query += " AND t.transaction_date <= ?"
        params.append(end_date)
    if category:
        query += " AND t.category = ?"
        params.append(category)
    if merchant:
        query += " AND t.normalized_merchant LIKE ?"
        params.append(f"%{merchant}%")
    if txn_type:
        query += " AND t.type = ?"
        params.append(txn_type)

    query += " ORDER BY t.transaction_date DESC"

    if limit:
        query += " LIMIT ?"
        params.append(limit)

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(query, params)
        return [dict(row) for row in cur.fetchall()]


def get_expense_summary(months: int = 1) -> dict:
    """Get expense summary with category breakdown for the last N months."""
    with get_connection() as conn:
        cur = conn.cursor()

        # Total spending by category for purchases only
        cur.execute("""
            SELECT
                COALESCE(category, 'Uncategorized') as category,
                SUM(amount) as total,
                COUNT(*) as count
            FROM cc_transactions
            WHERE type = 'purchase'
              AND transaction_date >= DATE('now', '-' || ? || ' months')
            GROUP BY COALESCE(category, 'Uncategorized')
            ORDER BY total DESC
        """, (months,))
        categories = [dict(row) for row in cur.fetchall()]

        # Overall totals
        cur.execute("""
            SELECT
                SUM(CASE WHEN type = 'purchase' THEN amount ELSE 0 END) as total_purchases,
                SUM(CASE WHEN type = 'payment' THEN amount ELSE 0 END) as total_payments,
                COUNT(CASE WHEN type = 'purchase' THEN 1 END) as transaction_count,
                MIN(transaction_date) as earliest_date,
                MAX(transaction_date) as latest_date
            FROM cc_transactions
            WHERE transaction_date >= DATE('now', '-' || ? || ' months')
        """, (months,))
        totals = dict(cur.fetchone())

        return {
            "months": months,
            "total_purchases": totals.get("total_purchases") or 0,
            "total_payments": totals.get("total_payments") or 0,
            "transaction_count": totals.get("transaction_count") or 0,
            "date_range": {
                "start": totals.get("earliest_date"),
                "end": totals.get("latest_date"),
            },
            "by_category": categories,
        }


def get_month_over_month(months: int = 6) -> list:
    """Get monthly spending totals for comparison."""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT
                STRFTIME('%Y-%m', transaction_date) as month,
                SUM(CASE WHEN type = 'purchase' THEN amount ELSE 0 END) as purchases,
                SUM(CASE WHEN type = 'payment' THEN amount ELSE 0 END) as payments,
                COUNT(CASE WHEN type = 'purchase' THEN 1 END) as transaction_count
            FROM cc_transactions
            WHERE transaction_date >= DATE('now', '-' || ? || ' months')
            GROUP BY STRFTIME('%Y-%m', transaction_date)
            ORDER BY month
        """, (months,))
        return [dict(row) for row in cur.fetchall()]


def get_cached_merchant_category(normalized_merchant: str) -> dict | None:
    """Look up a cached merchant->category mapping."""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT normalized_merchant, category, confidence
            FROM merchant_categories
            WHERE normalized_merchant = ?
        """, (normalized_merchant,))
        row = cur.fetchone()
        return dict(row) if row else None


def cache_merchant_category(
    normalized_merchant: str, category: str, confidence: str = "ai"
) -> None:
    """Cache a merchant->category mapping."""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO merchant_categories (normalized_merchant, category, confidence, updated_at)
            VALUES (?, ?, ?, datetime('now'))
            ON CONFLICT(normalized_merchant) DO UPDATE SET
                category = CASE
                    WHEN merchant_categories.confidence = 'manual' AND excluded.confidence = 'ai'
                    THEN merchant_categories.category
                    ELSE excluded.category
                END,
                confidence = CASE
                    WHEN merchant_categories.confidence = 'manual' AND excluded.confidence = 'ai'
                    THEN 'manual'
                    ELSE excluded.confidence
                END,
                updated_at = datetime('now')
        """, (normalized_merchant, category, confidence))


def get_all_merchant_categories() -> list:
    """Get all merchant->category mappings."""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT normalized_merchant, category, confidence, updated_at
            FROM merchant_categories
            ORDER BY normalized_merchant
        """)
        return [dict(row) for row in cur.fetchall()]


def update_transaction_categories(merchant: str, category: str) -> int:
    """Update category for all transactions matching a normalized merchant.
    Returns count of updated rows."""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            UPDATE cc_transactions SET category = ?
            WHERE normalized_merchant = ?
        """, (category, merchant))
        return cur.rowcount


# =============================================================================
# SPENDING INSIGHTS CACHE
# =============================================================================

def get_cached_insights(month_key: str) -> dict | None:
    """Get cached spending insights by month_key."""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT month_key, months_analyzed, insights_json, generated_at, model
            FROM spending_insights
            WHERE month_key = ?
        """, (month_key,))
        row = cur.fetchone()
        if row:
            insights = row["insights_json"]
            if isinstance(insights, str):
                insights = json.loads(insights)
            return {
                "month_key": row["month_key"],
                "months_analyzed": row["months_analyzed"],
                "insights": insights,
                "generated_at": row["generated_at"],
                "model": row["model"],
            }
        return None


def save_insights(month_key: str, months: int, insights: list, model: str) -> None:
    """Save spending insights to cache."""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT OR REPLACE INTO spending_insights
                (month_key, months_analyzed, insights_json, generated_at, model)
            VALUES (?, ?, ?, datetime('now'), ?)
        """, (month_key, months, json.dumps(insights), model))


def invalidate_insights_cache() -> int:
    """Delete all cached spending insights. Returns count of deleted rows."""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM spending_insights")
        return cur.rowcount


def _format_scenario(row: dict) -> dict:
    """Format a scenario row for API response."""
    if not row:
        return None

    settings = row.get("settings")
    if isinstance(settings, str):
        settings = json.loads(settings)

    return {
        "id": row["id"],
        "name": row["name"],
        "is_primary": bool(row["is_primary"]),
        "settings": settings,
        "created_at": str(row["created_at"]) if row.get("created_at") else None,
        "updated_at": str(row["updated_at"]) if row.get("updated_at") else None,
    }
