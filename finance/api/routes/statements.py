"""Statements API routes."""

import argparse
import shutil
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Query, UploadFile, File, HTTPException

from snapshots import load_snapshots, save_snapshot
from commands import cmd_pull
from classifier import classify_statement, STATEMENT_TYPE_SOFI_APEX, STATEMENT_TYPE_CHASE_CC
from parsers.sofi_apex import parse_statement, is_sofi_apex_statement
from parsers.chase_cc import parse_chase_cc_statement
from config import STATEMENTS_DIR
from templates import update_template
from database import (
    init_database,
    save_cc_statement,
    save_cc_transactions,
    get_cached_merchant_category,
)

router = APIRouter(tags=["statements"])


def _transform_snapshots(raw_snapshots: list) -> list:
    """Transform raw snapshots into API response format with delta calculations.

    Args:
        raw_snapshots: List of raw snapshot dicts from load_snapshots()

    Returns:
        List of transformed snapshots sorted by date (newest first) with deltas
    """
    # Sort by date descending (newest first)
    # Use `or ""` to handle both missing keys and None values
    sorted_snapshots = sorted(
        raw_snapshots,
        key=lambda x: x.get("statement_date") or "",
        reverse=True
    )

    # Track the "next" (chronologically) value for each account type
    # Since we're iterating newest-first, we need to track what comes after
    next_value_by_account: dict[str, float] = {}

    # First pass: collect values in reverse order to calculate deltas
    # We need to iterate oldest-first to build up the previous values
    deltas: dict[tuple[str, str], Optional[float]] = {}

    for snap in reversed(sorted_snapshots):
        account_type = snap.get("account_type", "unknown")
        date = snap.get("statement_date", "")
        total_value = snap.get("portfolio", {}).get("total_value", 0)

        # Calculate delta from previous snapshot of same account type
        if account_type in next_value_by_account:
            prev_value = next_value_by_account[account_type]
            deltas[(date, account_type)] = total_value - prev_value
        else:
            deltas[(date, account_type)] = None

        # Update the previous value for next iteration
        next_value_by_account[account_type] = total_value

    # Transform to API response format
    result = []
    for snap in sorted_snapshots:
        account_type = snap.get("account_type", "unknown")
        date = snap.get("statement_date", "")
        total_value = snap.get("portfolio", {}).get("total_value", 0)

        result.append({
            "date": date,
            "account": account_type,
            "total_value": total_value,
            "delta": deltas.get((date, account_type)),
            "filename": snap.get("_filepath", "").split("/")[-1] if snap.get("_filepath") else "",
        })

    return result


@router.get("/statements/history")
def get_history(
    account: Optional[str] = Query(None, description="Filter by account type (roth_ira, brokerage, traditional_ira)")
):
    """Get snapshot history.

    Returns list of all parsed statement snapshots, optionally filtered by account type.
    Snapshots are sorted by date (newest first) with delta values calculated.

    Note: File I/O is blocking. Using sync function so FastAPI runs it in a thread pool.
    """
    raw_snapshots = load_snapshots(account_type=account)
    snapshots = _transform_snapshots(raw_snapshots)
    return {"success": True, "snapshots": snapshots, "count": len(snapshots)}


@router.post("/statements/pull")
def pull_statements(
    latest: bool = Query(False, description="Only pull the most recent statement")
):
    """Pull and process statements from Downloads folder.

    Scans ~/Downloads for SoFi/Apex statement PDFs, parses them,
    saves snapshots, and updates the planning template.

    Note: PDF parsing is CPU-bound blocking. Using sync function so FastAPI runs it in a thread pool.
    """
    args = argparse.Namespace(latest=latest, no_update=False, json=True)
    return cmd_pull(args)


@router.post("/statements/upload")
def upload_statement(
    file: UploadFile = File(..., description="PDF statement file to upload")
):
    """Upload and process a statement PDF.

    Accepts a PDF file upload, validates it's a SoFi/Apex statement,
    parses it, saves a snapshot, and updates the planning template.

    Note: File I/O and PDF parsing are blocking. Using sync function so FastAPI runs it in a thread pool.
    """
    # Validate file type
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    # Save to temp file for validation
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp_path = Path(tmp.name)
        try:
            # Write uploaded content to temp file
            content = file.file.read()
            tmp.write(content)
            tmp.flush()

            # Validate it's a SoFi/Apex statement
            if not is_sofi_apex_statement(str(tmp_path)):
                tmp_path.unlink()
                raise HTTPException(
                    status_code=400,
                    detail="File is not a valid SoFi/Apex statement"
                )

            # Move to statements directory
            STATEMENTS_DIR.mkdir(parents=True, exist_ok=True)
            dest_path = STATEMENTS_DIR / file.filename
            shutil.move(str(tmp_path), str(dest_path))

            # Parse the statement
            try:
                data = parse_statement(str(dest_path))
            except Exception as e:
                return {
                    "success": False,
                    "error": f"Failed to parse statement: {e}",
                    "filename": file.filename,
                }

            # Save snapshot
            snapshot_path = save_snapshot(data)

            # Update template
            template_updated = update_template(data, all_snapshots=[data])

            return {
                "success": True,
                "filename": file.filename,
                "account": data.get("account_type"),
                "date": data.get("statement_date"),
                "total_value": data.get("portfolio", {}).get("total_value", 0),
                "snapshot_path": str(snapshot_path),
                "template_updated": template_updated,
            }

        except HTTPException:
            raise
        except Exception as e:
            # Clean up temp file on error
            if tmp_path.exists():
                tmp_path.unlink()
            raise HTTPException(status_code=500, detail=f"Upload failed: {e}")


@router.post("/statements/import")
def import_statements(
    files: list[UploadFile] = File(..., description="One or more PDF statement files"),
    no_categorize: bool = Query(False, description="Skip AI categorization for credit card statements"),
):
    """Upload and process multiple statement PDFs with auto-classification.

    Accepts mixed statement types (SoFi/Apex brokerage, Chase credit card).
    Each file is classified and routed to the correct parser.

    Note: PDF parsing and optional AI categorization are blocking.
    Using sync function so FastAPI runs it in a thread pool.
    """
    results = []
    brokerage_data = []

    for upload_file in files:
        filename = upload_file.filename or "unknown.pdf"

        if not filename.lower().endswith(".pdf"):
            results.append({
                "filename": filename,
                "type": None,
                "success": False,
                "error": "File must be a PDF",
            })
            continue

        # Write to temp file for classification and parsing
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp_path = Path(tmp.name)
            try:
                content = upload_file.file.read()
                tmp.write(content)
                tmp.flush()

                statement_type = classify_statement(str(tmp_path))

                if statement_type == STATEMENT_TYPE_SOFI_APEX:
                    result = _process_sofi_apex(tmp_path, filename)
                    if result["success"]:
                        brokerage_data.append(result.get("_data"))
                    # Remove internal data from response
                    result.pop("_data", None)
                    results.append(result)

                elif statement_type == STATEMENT_TYPE_CHASE_CC:
                    result = _process_chase_cc(tmp_path, filename, no_categorize)
                    results.append(result)

                else:
                    tmp_path.unlink(missing_ok=True)
                    results.append({
                        "filename": filename,
                        "type": "unknown",
                        "success": False,
                        "error": "Unrecognized statement format",
                    })

            except Exception as e:
                tmp_path.unlink(missing_ok=True)
                results.append({
                    "filename": filename,
                    "type": None,
                    "success": False,
                    "error": str(e),
                })

    # Update template if any brokerage statements were processed
    template_updated = False
    if brokerage_data:
        template_updated = update_template(brokerage_data[0], all_snapshots=brokerage_data)

    success_count = sum(1 for r in results if r["success"])

    return {
        "success": success_count > 0,
        "total": len(results),
        "imported": success_count,
        "failed": len(results) - success_count,
        "template_updated": template_updated,
        "results": results,
    }


def _process_sofi_apex(tmp_path: Path, filename: str) -> dict:
    """Process a SoFi/Apex brokerage statement."""
    try:
        STATEMENTS_DIR.mkdir(parents=True, exist_ok=True)
        dest_path = STATEMENTS_DIR / filename
        shutil.move(str(tmp_path), str(dest_path))

        data = parse_statement(str(dest_path))
        snapshot_path = save_snapshot(data)

        return {
            "filename": filename,
            "type": "sofi_apex",
            "success": True,
            "account": data.get("account_type"),
            "date": data.get("statement_date"),
            "total_value": data.get("portfolio", {}).get("total_value", 0),
            "snapshot_path": str(snapshot_path),
            "_data": data,
        }
    except Exception as e:
        tmp_path.unlink(missing_ok=True)
        return {
            "filename": filename,
            "type": "sofi_apex",
            "success": False,
            "error": f"Parse failed: {e}",
        }


def _process_chase_cc(tmp_path: Path, filename: str, no_categorize: bool) -> dict:
    """Process a Chase credit card statement."""
    try:
        data = parse_chase_cc_statement(str(tmp_path))
        tmp_path.unlink(missing_ok=True)

        init_database()
        statement_id = save_cc_statement(data, source_file=filename)

        # Apply cached categories
        for txn in data["transactions"]:
            cached = get_cached_merchant_category(txn["normalized_merchant"])
            if cached:
                txn["category"] = cached["category"]

        # AI categorization
        if not no_categorize:
            try:
                from categorizer import categorize_transactions
                data["transactions"] = categorize_transactions(data["transactions"])
            except Exception:
                pass

        txn_count = save_cc_transactions(statement_id, data["transactions"])

        return {
            "filename": filename,
            "type": "chase_cc",
            "success": True,
            "card_type": data.get("card_type"),
            "statement_date": data.get("statement_date"),
            "transactions_imported": txn_count,
            "new_balance": data.get("summary", {}).get("new_balance"),
            "total_purchases": data.get("summary", {}).get("purchases"),
        }
    except Exception as e:
        tmp_path.unlink(missing_ok=True)
        return {
            "filename": filename,
            "type": "chase_cc",
            "success": False,
            "error": f"Parse failed: {e}",
        }
