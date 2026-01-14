"""
Snapshot management for the finance CLI.

Handles saving, loading, and querying financial statement snapshots.
Supports both JSON file storage and PostgreSQL database.
"""

import fcntl
import json
from datetime import datetime
from pathlib import Path
from typing import Optional

from config import DATA_DIR, SNAPSHOTS_DIR, LOCK_FILE, USE_DATABASE


def ensure_dirs():
    """Ensure required directories exist."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    SNAPSHOTS_DIR.mkdir(parents=True, exist_ok=True)


def _save_snapshot_json(data: dict) -> Path:
    """Save snapshot to JSON file."""
    ensure_dirs()

    date_str = data.get("statement_date", datetime.now().strftime("%Y-%m-%d"))
    account_type = data.get("account_type", "unknown")
    filename = f"{date_str}_{account_type}.json"
    filepath = SNAPSHOTS_DIR / filename

    LOCK_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(LOCK_FILE, "w") as lock_file:
        fcntl.flock(lock_file, fcntl.LOCK_EX)
        try:
            temp_file = filepath.with_suffix(".json.tmp")
            temp_file.write_text(json.dumps(data, indent=2))
            temp_file.rename(filepath)
        finally:
            fcntl.flock(lock_file, fcntl.LOCK_UN)

    return filepath


def _load_snapshots_json(account_type: Optional[str] = None) -> list:
    """Load snapshots from JSON files."""
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


def save_snapshot(data: dict) -> Path:
    """
    Save parsed statement data as a snapshot.

    When USE_DATABASE is enabled, saves to both database and JSON (dual-write).
    """
    # Always save to JSON for backward compatibility
    filepath = _save_snapshot_json(data)

    # Also save to database if enabled
    if USE_DATABASE:
        try:
            from database import save_snapshot as db_save_snapshot
            db_save_snapshot(data, source_file=filepath.name)
        except Exception as e:
            # Log but don't fail - JSON is the primary store during migration
            print(f"Warning: Failed to save to database: {e}")

    return filepath


def load_snapshots(account_type: Optional[str] = None) -> list:
    """
    Load all snapshots, optionally filtered by account type.

    When USE_DATABASE is enabled, reads from database.
    """
    if USE_DATABASE:
        try:
            from database import get_snapshot_history
            snapshots = get_snapshot_history(account_type=account_type)
            # Convert database rows to match JSON format
            for snap in snapshots:
                # Convert JSONB fields back to dicts
                if isinstance(snap.get("holdings"), str):
                    snap["holdings"] = json.loads(snap["holdings"])
                if isinstance(snap.get("income"), str):
                    snap["income"] = json.loads(snap["income"])
                if isinstance(snap.get("retirement"), str):
                    snap["retirement"] = json.loads(snap["retirement"])
                # Reconstruct portfolio structure
                snap["portfolio"] = {
                    "total_value": float(snap.get("total_value", 0)),
                    "securities_value": float(snap["securities_value"]) if snap.get("securities_value") else None,
                    "fdic_deposits": float(snap["fdic_deposits"]) if snap.get("fdic_deposits") else None,
                    "holdings": snap.get("holdings", []),
                }
                # Reconstruct period
                if snap.get("period_start") or snap.get("period_end"):
                    snap["period"] = {
                        "start": str(snap.get("period_start")) if snap.get("period_start") else None,
                        "end": str(snap.get("period_end")) if snap.get("period_end") else None,
                    }
                # Convert date to string
                if snap.get("statement_date"):
                    snap["statement_date"] = str(snap["statement_date"])
            return snapshots
        except Exception as e:
            print(f"Warning: Failed to read from database, falling back to JSON: {e}")

    return _load_snapshots_json(account_type)


def get_latest_snapshot(account_type: Optional[str] = None) -> Optional[dict]:
    """Get the most recent snapshot."""
    if USE_DATABASE:
        try:
            from database import get_latest_snapshot as db_get_latest
            snap = db_get_latest(account_type)
            if snap:
                # Convert database format to JSON format
                if isinstance(snap.get("holdings"), str):
                    snap["holdings"] = json.loads(snap["holdings"])
                snap["portfolio"] = {
                    "total_value": float(snap.get("total_value", 0)),
                    "securities_value": float(snap["securities_value"]) if snap.get("securities_value") else None,
                    "fdic_deposits": float(snap["fdic_deposits"]) if snap.get("fdic_deposits") else None,
                    "holdings": snap.get("holdings", []),
                }
                if snap.get("statement_date"):
                    snap["statement_date"] = str(snap["statement_date"])
                return snap
        except Exception as e:
            print(f"Warning: Failed to read from database, falling back to JSON: {e}")

    snapshots = _load_snapshots_json(account_type)
    if not snapshots:
        return None
    snapshots.sort(key=lambda x: x.get("statement_date") or "", reverse=True)
    return snapshots[0]


def get_latest_by_account_type() -> dict:
    """
    Get the most recent snapshot for each account type.

    Returns:
        Dict mapping account_type -> snapshot data
    """
    if USE_DATABASE:
        try:
            from database import get_latest_by_account_type as db_get_latest
            result = db_get_latest()
            # Convert database format to JSON format for each snapshot
            for account_type, snap in result.items():
                if isinstance(snap.get("holdings"), str):
                    snap["holdings"] = json.loads(snap["holdings"])
                if isinstance(snap.get("income"), str):
                    snap["income"] = json.loads(snap["income"])
                if isinstance(snap.get("retirement"), str):
                    snap["retirement"] = json.loads(snap["retirement"])
                snap["portfolio"] = {
                    "total_value": float(snap.get("total_value", 0)),
                    "securities_value": float(snap["securities_value"]) if snap.get("securities_value") else None,
                    "fdic_deposits": float(snap["fdic_deposits"]) if snap.get("fdic_deposits") else None,
                    "holdings": snap.get("holdings", []),
                }
                if snap.get("period_start") or snap.get("period_end"):
                    snap["period"] = {
                        "start": str(snap.get("period_start")) if snap.get("period_start") else None,
                        "end": str(snap.get("period_end")) if snap.get("period_end") else None,
                    }
                if snap.get("statement_date"):
                    snap["statement_date"] = str(snap["statement_date"])
            return result
        except Exception as e:
            print(f"Warning: Failed to read from database, falling back to JSON: {e}")

    snapshots = _load_snapshots_json()
    latest = {}

    for snap in sorted(snapshots, key=lambda x: x.get('statement_date') or ''):
        account_type = snap.get('account_type')
        if account_type:
            latest[account_type] = snap

    return latest
