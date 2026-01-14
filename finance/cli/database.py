"""
Database connection management and utilities for the finance CLI.
Uses PostgreSQL with psycopg2.
"""

import os
import json
from contextlib import contextmanager
from datetime import date
from pathlib import Path

import psycopg2
from psycopg2.extras import RealDictCursor

from config import SNAPSHOTS_DIR, HOLDINGS_PATH, PROFILE_PATH

# Database connection URL
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://finance:finance@localhost:5432/finance"
)


@contextmanager
def get_connection():
    """Get database connection with dict cursor and automatic commit/rollback."""
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def check_db_connection() -> dict:
    """Check if database is reachable and return status."""
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT version()")
            version = cur.fetchone()["version"]
            cur.execute("""
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'public'
            """)
            tables = [row["table_name"] for row in cur.fetchall()]
        return {
            "connected": True,
            "version": version.split(",")[0],
            "tables": tables,
        }
    except Exception as e:
        return {
            "connected": False,
            "error": str(e),
        }


def get_table_counts() -> dict:
    """Get row counts for all tables."""
    with get_connection() as conn:
        cur = conn.cursor()
        counts = {}
        for table in ["snapshots", "holdings", "profile", "goals", "goal_progress", "market_cache"]:
            cur.execute(f"SELECT COUNT(*) as count FROM {table}")
            counts[table] = cur.fetchone()["count"]
        return counts


# =============================================================================
# MIGRATION FUNCTIONS
# =============================================================================

def migrate_from_json() -> dict:
    """
    One-time migration from existing JSON files to PostgreSQL.
    Returns summary of migrated records.
    """
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
        INSERT INTO snapshots (
            statement_date, account_type, account_id, account_holder,
            period_start, period_end, total_value, securities_value,
            fdic_deposits, holdings, income, retirement, source_file
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (statement_date, account_type) DO UPDATE SET
            total_value = EXCLUDED.total_value,
            holdings = EXCLUDED.holdings,
            income = EXCLUDED.income,
            retirement = EXCLUDED.retirement
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
            INSERT INTO holdings (category, key, display_name, quantity, notes, last_updated)
            VALUES ('crypto', %s, %s, %s, %s, %s)
            ON CONFLICT (category, key) DO UPDATE SET
                quantity = EXCLUDED.quantity,
                notes = EXCLUDED.notes,
                last_updated = EXCLUDED.last_updated
        """, (key, key.upper(), value.get("quantity"), value.get("notes"), last_updated))
        count += 1

    # Bank accounts
    for key, value in holdings.get("bank_accounts", {}).items():
        cur.execute("""
            INSERT INTO holdings (category, key, display_name, balance, notes, last_updated)
            VALUES ('bank', %s, %s, %s, %s, %s)
            ON CONFLICT (category, key) DO UPDATE SET
                display_name = EXCLUDED.display_name,
                balance = EXCLUDED.balance,
                notes = EXCLUDED.notes,
                last_updated = EXCLUDED.last_updated
        """, (key, value.get("name", key.upper()), value.get("balance"), value.get("notes"), last_updated))
        count += 1

    # Other accounts
    for key, value in holdings.get("other", {}).items():
        cur.execute("""
            INSERT INTO holdings (category, key, display_name, balance, notes, last_updated)
            VALUES ('other', %s, %s, %s, %s, %s)
            ON CONFLICT (category, key) DO UPDATE SET
                display_name = EXCLUDED.display_name,
                balance = EXCLUDED.balance,
                notes = EXCLUDED.notes,
                last_updated = EXCLUDED.last_updated
        """, (key, value.get("name", key.upper()), value.get("balance"), value.get("notes"), last_updated))
        count += 1

    return count


def _migrate_profile(cur, profile: dict) -> tuple[int, int]:
    """Migrate profile from JSON to database. Returns (profile_keys, goals) counts."""
    keys_count = 0
    goals_count = 0

    # Store profile sections as key-value pairs
    for key in ["monthly_cash_flow", "household_context", "tax_situation"]:
        if key in profile:
            cur.execute("""
                INSERT INTO profile (key, value)
                VALUES (%s, %s)
                ON CONFLICT (key) DO UPDATE SET
                    value = EXCLUDED.value,
                    updated_at = NOW()
            """, (key, json.dumps(profile[key])))
            keys_count += 1

    # Migrate goals to separate table
    goals = profile.get("goals", {})
    for goal_type in ["short_term", "medium_term", "long_term"]:
        goal = goals.get(goal_type, {})
        if goal:
            cur.execute("""
                INSERT INTO goals (goal_type, description, target, deadline)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (goal_type) DO UPDATE SET
                    description = EXCLUDED.description,
                    target = EXCLUDED.target,
                    deadline = EXCLUDED.deadline,
                    updated_at = NOW()
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
        cur.execute("""
            SELECT DISTINCT ON (account_type) *
            FROM snapshots
            ORDER BY account_type, statement_date DESC
        """)
        return {row["account_type"]: dict(row) for row in cur.fetchall()}


def get_snapshot_history(
    account_type: str = None,
    start_date: str = None,
    end_date: str = None,
    limit: int = None
) -> list:
    """Query snapshots with optional filters."""
    query = "SELECT * FROM snapshots WHERE TRUE"
    params = []

    if account_type:
        query += " AND account_type = %s"
        params.append(account_type)
    if start_date:
        query += " AND statement_date >= %s"
        params.append(start_date)
    if end_date:
        query += " AND statement_date <= %s"
        params.append(end_date)

    query += " ORDER BY statement_date DESC"

    if limit:
        query += " LIMIT %s"
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
        query += " WHERE account_type = %s"
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
            INSERT INTO snapshots (
                statement_date, account_type, account_id, account_holder,
                period_start, period_end, total_value, securities_value,
                fdic_deposits, holdings, income, retirement, source_file
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (statement_date, account_type) DO UPDATE SET
                total_value = EXCLUDED.total_value,
                holdings = EXCLUDED.holdings,
                income = EXCLUDED.income,
                retirement = EXCLUDED.retirement
            RETURNING id
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
        return cur.fetchone()["id"]


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
                VALUES ('crypto', %s, %s, %s, %s, %s)
                ON CONFLICT (category, key) DO UPDATE SET
                    quantity = EXCLUDED.quantity,
                    notes = COALESCE(EXCLUDED.notes, holdings.notes),
                    last_updated = EXCLUDED.last_updated
            """, (key, key.upper(), value, notes, today))
        else:
            # bank or other
            db_category = "bank" if category == "bank_accounts" else category
            cur.execute("""
                INSERT INTO holdings (category, key, display_name, balance, notes, last_updated)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (category, key) DO UPDATE SET
                    balance = EXCLUDED.balance,
                    notes = COALESCE(EXCLUDED.notes, holdings.notes),
                    last_updated = EXCLUDED.last_updated
            """, (db_category, key, key.upper(), value, notes, today))


def delete_holding(category: str, key: str) -> bool:
    """Delete a holding. Returns True if deleted, False if not found."""
    with get_connection() as conn:
        cur = conn.cursor()
        db_category = "bank" if category == "bank_accounts" else category
        cur.execute("""
            DELETE FROM holdings WHERE category = %s AND key = %s
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
            result[row["key"]] = row["value"]

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
        for key in ["monthly_cash_flow", "household_context", "tax_situation"]:
            if key in profile:
                cur.execute("""
                    INSERT INTO profile (key, value)
                    VALUES (%s, %s)
                    ON CONFLICT (key) DO UPDATE SET
                        value = EXCLUDED.value,
                        updated_at = NOW()
                """, (key, json.dumps(profile[key])))

        # Save goals
        goals = profile.get("goals", {})
        for goal_type in ["short_term", "medium_term", "long_term"]:
            goal = goals.get(goal_type, {})
            cur.execute("""
                INSERT INTO goals (goal_type, description, target, deadline)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (goal_type) DO UPDATE SET
                    description = EXCLUDED.description,
                    target = EXCLUDED.target,
                    deadline = EXCLUDED.deadline,
                    updated_at = NOW()
            """, (goal_type, goal.get("description"), goal.get("target"), goal.get("deadline")))


def update_profile_section(section: str, data: dict) -> None:
    """Update a single profile section."""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO profile (key, value)
            VALUES (%s, %s)
            ON CONFLICT (key) DO UPDATE SET
                value = EXCLUDED.value,
                updated_at = NOW()
        """, (section, json.dumps(data)))


# =============================================================================
# GOAL PROGRESS TRACKING
# =============================================================================

def record_goal_progress(goal_analysis: dict) -> None:
    """Record goal progress snapshot (called when statements are pulled)."""
    with get_connection() as conn:
        cur = conn.cursor()
        today = date.today().replace(day=1)  # First of month

        for goal_type in ["short_term", "medium_term", "long_term"]:
            goal = goal_analysis.get(goal_type, {})
            if goal.get("status") not in ["not_set", None]:
                cur.execute("""
                    INSERT INTO goal_progress (
                        goal_type, recorded_at, current_value,
                        progress_pct, monthly_required, on_track
                    ) VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (goal_type, recorded_at) DO UPDATE SET
                        current_value = EXCLUDED.current_value,
                        progress_pct = EXCLUDED.progress_pct,
                        monthly_required = EXCLUDED.monthly_required,
                        on_track = EXCLUDED.on_track
                """, (
                    goal_type,
                    today,
                    goal.get("current"),
                    goal.get("progress_pct"),
                    goal.get("monthly_required"),
                    goal.get("on_track"),
                ))


def get_goal_history(goal_type: str = None, months: int = 12) -> list:
    """Get goal progress history."""
    with get_connection() as conn:
        cur = conn.cursor()
        if goal_type:
            cur.execute("""
                SELECT * FROM goal_progress
                WHERE goal_type = %s
                  AND recorded_at >= CURRENT_DATE - INTERVAL '%s months'
                ORDER BY recorded_at
            """, (goal_type, months))
        else:
            cur.execute("""
                SELECT * FROM goal_progress
                WHERE recorded_at >= CURRENT_DATE - INTERVAL '%s months'
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
            WHERE cache_key = %s AND expires_at > NOW()
        """, (cache_key,))
        row = cur.fetchone()
        return row["data"] if row else None


def cache_market_data(cache_key: str, data: dict, ttl_minutes: int = 15) -> None:
    """Cache market data with TTL."""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO market_cache (cache_key, data, fetched_at, expires_at)
            VALUES (%s, %s, NOW(), NOW() + INTERVAL '%s minutes')
            ON CONFLICT (cache_key) DO UPDATE SET
                data = EXCLUDED.data,
                fetched_at = EXCLUDED.fetched_at,
                expires_at = EXCLUDED.expires_at
        """, (cache_key, json.dumps(data), ttl_minutes))


def clear_market_cache() -> int:
    """Clear all cached market data. Returns count of deleted rows."""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM market_cache")
        return cur.rowcount


# =============================================================================
# PORTFOLIO HISTORY (NEW CAPABILITY)
# =============================================================================

def get_portfolio_history(months: int = 12) -> list:
    """Get total portfolio value over time for charts."""
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT
                statement_date,
                SUM(total_value) as total_value,
                jsonb_object_agg(account_type, total_value) as by_account
            FROM snapshots
            WHERE statement_date >= CURRENT_DATE - INTERVAL '%s months'
            GROUP BY statement_date
            ORDER BY statement_date
        """, (months,))
        return [dict(row) for row in cur.fetchall()]


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
