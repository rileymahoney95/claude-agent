"""Projection API routes for historical data, settings, and scenarios."""

from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Query

from projections import (
    get_projection_settings,
    update_projection_settings,
    get_historical_portfolio,
    validate_scenario_settings,
)
from database import (
    get_projection_scenarios,
    get_projection_scenario,
    create_projection_scenario,
    update_projection_scenario,
    delete_projection_scenario,
)

router = APIRouter(prefix="/projection", tags=["projection"])


# =============================================================================
# HISTORICAL DATA
# =============================================================================

@router.get("/history")
def get_history(
    months: int = Query(12, ge=1, le=60, description="Months of history to return")
):
    """Get historical portfolio data mapped to asset classes.

    Returns monthly aggregated portfolio values with asset class breakdown
    for projection chart display.

    Note: File I/O and optional database queries are blocking.
    Using sync function so FastAPI runs it in a thread pool.
    """
    return get_historical_portfolio(months)


# =============================================================================
# PROJECTION SETTINGS
# =============================================================================

@router.get("/settings")
def get_settings():
    """Get projection settings from profile.

    Returns settings merged with defaults for any missing fields.

    Note: File I/O is blocking. Using sync function so FastAPI runs it in a thread pool.
    """
    settings = get_projection_settings()
    return {"success": True, "settings": settings}


@router.patch("/settings")
def patch_settings(updates: Dict[str, Any]):
    """Update projection settings in profile.

    Validates:
    - expected_returns: 0-50% per asset class
    - inflation_rate: 0-20%
    - withdrawal_rate: 1-10%
    - target_retirement_age: 40-100
    - current_age: 18-99

    Note: File I/O is blocking. Using sync function so FastAPI runs it in a thread pool.
    """
    result = update_projection_settings(updates)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


# =============================================================================
# SCENARIOS CRUD
# =============================================================================

@router.get("/scenarios")
def list_scenarios():
    """List all projection scenarios.

    Returns scenarios ordered by is_primary DESC, name ASC.
    Primary scenario (if any) appears first.

    Note: Database query is blocking. Using sync function so FastAPI runs it in a thread pool.
    """
    scenarios = get_projection_scenarios()
    return {"success": True, "scenarios": scenarios, "count": len(scenarios)}


@router.post("/scenarios")
def create_scenario(body: Dict[str, Any]):
    """Create a new projection scenario.

    Body:
        name: Unique scenario name (required)
        settings: Scenario settings object (optional, defaults to {})
        is_primary: Set as primary scenario (optional, defaults to False)

    If is_primary=True, other scenarios are atomically unset.

    Settings structure:
        allocation_overrides: {equities, bonds, crypto, cash} - must sum to 100
        return_overrides: {equities, bonds, crypto, cash} - each 0-50%
        monthly_contribution: non-negative number
        projection_months: 60-480

    Note: Database writes are blocking. Using sync function so FastAPI runs it in a thread pool.
    """
    name = body.get("name")
    settings = body.get("settings", {})
    is_primary = body.get("is_primary", False)

    if not name:
        raise HTTPException(status_code=400, detail="name is required")

    # Validate settings
    is_valid, error = validate_scenario_settings(settings)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error)

    try:
        scenario = create_projection_scenario(name, settings, is_primary)
        return {"success": True, "scenario": scenario}
    except Exception as e:
        if "unique constraint" in str(e).lower() or "duplicate key" in str(e).lower():
            raise HTTPException(status_code=409, detail=f"Scenario '{name}' already exists")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/scenarios/{scenario_id}")
def get_scenario(scenario_id: int):
    """Get a single scenario by ID.

    Note: Database query is blocking. Using sync function so FastAPI runs it in a thread pool.
    """
    scenario = get_projection_scenario(scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return {"success": True, "scenario": scenario}


@router.patch("/scenarios/{scenario_id}")
def update_scenario(scenario_id: int, updates: Dict[str, Any]):
    """Update a projection scenario.

    Body (all optional):
        name: New scenario name
        settings: New settings object (replaces existing)
        is_primary: Set/unset as primary

    Note: Database writes are blocking. Using sync function so FastAPI runs it in a thread pool.
    """
    name = updates.get("name")
    settings = updates.get("settings")
    is_primary = updates.get("is_primary")

    # Validate settings if provided
    if settings is not None:
        is_valid, error = validate_scenario_settings(settings)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error)

    try:
        scenario = update_projection_scenario(scenario_id, name, settings, is_primary)
        if not scenario:
            raise HTTPException(status_code=404, detail="Scenario not found")
        return {"success": True, "scenario": scenario}
    except Exception as e:
        if "unique constraint" in str(e).lower() or "duplicate key" in str(e).lower():
            raise HTTPException(status_code=409, detail=f"Scenario name '{name}' already exists")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/scenarios/{scenario_id}")
def remove_scenario(scenario_id: int):
    """Delete a projection scenario.

    Cannot delete a primary scenario - must set another as primary first.

    Note: Database writes are blocking. Using sync function so FastAPI runs it in a thread pool.
    """
    success, error = delete_projection_scenario(scenario_id)
    if not success:
        status = 404 if "not found" in error.lower() else 400
        raise HTTPException(status_code=status, detail=error)

    return {"success": True}
