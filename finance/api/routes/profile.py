"""Profile API routes."""

from datetime import date
from typing import Any, Dict

from fastapi import APIRouter, HTTPException

from profile import load_profile, save_profile

router = APIRouter(tags=["profile"])


@router.get("/profile")
def get_profile():
    """Get the full financial profile.

    Returns cash flow, household context, tax situation, and goals.

    Note: File I/O is blocking. Using sync function so FastAPI runs it in a thread pool.
    """
    profile = load_profile()
    return {"success": True, **profile}


@router.put("/profile")
def update_profile(profile_data: Dict[str, Any]):
    """Replace the entire profile.

    Args:
        profile_data: Complete profile object

    Note: File I/O is blocking. Using sync function so FastAPI runs it in a thread pool.
    """
    profile_data["last_updated"] = date.today().isoformat()
    save_profile(profile_data)
    return {"success": True, "profile": profile_data}


@router.patch("/profile/{section}")
def update_profile_section(section: str, updates: Dict[str, Any]):
    """Update a specific section of the profile.

    Args:
        section: One of 'monthly_cash_flow', 'household_context', 'tax_situation', 'goals'
        updates: Partial updates to merge into the section

    Note: File I/O is blocking. Using sync function so FastAPI runs it in a thread pool.
    """
    profile = load_profile()
    if section not in profile:
        raise HTTPException(status_code=404, detail=f"Section '{section}' not found")

    if isinstance(profile[section], dict):
        profile[section].update(updates)
    else:
        profile[section] = updates

    profile["last_updated"] = date.today().isoformat()
    save_profile(profile)
    return {"success": True, "section": section, "data": profile[section]}
