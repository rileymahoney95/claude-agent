"""
Financial advisor recommendation engine (Phase 4).

Synthesizes analysis from Phase 3 into specific, prioritized,
actionable recommendations.
"""

from dataclasses import dataclass, field
from typing import Optional

from config import (
    PRIORITY_THRESHOLDS,
    TAX_ADVANTAGED_LIMITS,
    CATEGORY_ORDER,
    CATEGORY_NAMES,
)


# ============================================================================
# DATA STRUCTURES
# ============================================================================

@dataclass
class Recommendation:
    """A single financial recommendation."""
    type: str           # "rebalance" | "surplus" | "opportunity" | "warning"
    priority: str       # "high" | "medium" | "low"
    action: str         # Specific action text
    rationale: str      # Why this recommendation
    impact: str         # Expected result
    numbers: dict = field(default_factory=dict)  # Supporting data

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "type": self.type,
            "priority": self.priority,
            "action": self.action,
            "rationale": self.rationale,
            "impact": self.impact,
            "numbers": self.numbers,
        }


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def _category_name(cat: str) -> str:
    """Convert category key to display name."""
    return CATEGORY_NAMES.get(cat, cat.replace("_", " ").title())


# ============================================================================
# GOAL-BASED RECOMMENDATIONS
# ============================================================================

def generate_goal_recommendations(
    goal_analysis: dict,
    profile: dict
) -> list:
    """
    Generate recommendations based on goal progress.

    Evaluates each goal and creates recommendations for:
    - Goals behind schedule with near deadlines (high priority)
    - Goals behind schedule with distant deadlines (medium priority)
    - Goals that are on track (informational)

    Args:
        goal_analysis: Dict from analyzer.analyze_goals()
        profile: Dict from profile.load_profile()

    Returns:
        List of Recommendation objects
    """
    recommendations = []

    for goal_type in ["short_term", "medium_term", "long_term"]:
        goal = goal_analysis.get(goal_type, {})
        status = goal.get("status")

        if status == "behind":
            rec = _create_goal_behind_recommendation(goal_type, goal, goal_analysis)
            if rec:
                recommendations.append(rec)
        elif status == "past_deadline":
            rec = _create_past_deadline_recommendation(goal_type, goal)
            if rec:
                recommendations.append(rec)

    return recommendations


def _create_goal_behind_recommendation(
    goal_type: str,
    goal: dict,
    full_analysis: dict
) -> Optional[Recommendation]:
    """Create recommendation for a goal that's behind schedule."""
    months_remaining = goal.get("months_remaining")
    monthly_required = goal.get("monthly_required")
    current_monthly = goal.get("current_monthly")
    description = goal.get("description", "Goal")

    if months_remaining is None or monthly_required is None:
        return None

    shortfall = monthly_required - (current_monthly or 0)

    # Determine priority based on deadline urgency
    if months_remaining <= PRIORITY_THRESHOLDS["goal_deadline_critical"]:
        priority = "high"
    elif months_remaining <= PRIORITY_THRESHOLDS["goal_deadline_urgent"]:
        priority = "high"
    else:
        priority = "medium"

    # Build action text based on goal type
    if goal_type == "short_term":
        action = f"Redirect ${shortfall:,.0f}/mo additional to emergency fund"
    else:
        action = f"Increase monthly allocation toward {description.lower()}"

    return Recommendation(
        type="surplus",
        priority=priority,
        action=action,
        rationale=f"{description} deadline in {months_remaining} months. "
                  f"Current pace: ${current_monthly or 0:,.0f}/mo. "
                  f"Required: ${monthly_required:,.0f}/mo.",
        impact=f"Closing the ${shortfall:,.0f}/mo gap would put goal back on track.",
        numbers={
            "goal_type": goal_type,
            "months_remaining": months_remaining,
            "monthly_required": round(monthly_required, 2),
            "current_monthly": round(current_monthly or 0, 2),
            "shortfall": round(shortfall, 2),
            "progress_pct": goal.get("progress_pct", 0),
        }
    )


def _create_past_deadline_recommendation(
    goal_type: str,
    goal: dict
) -> Optional[Recommendation]:
    """Create recommendation for a goal past its deadline."""
    description = goal.get("description", "Goal")
    target = goal.get("target")
    current = goal.get("current")

    if target is None:
        return None

    remaining = target - (current or 0)

    return Recommendation(
        type="warning",
        priority="high",
        action=f"Reassess {description.lower()} goal",
        rationale=f"Deadline has passed. ${remaining:,.0f} remaining to reach ${target:,.0f} target.",
        impact="Set a new realistic deadline or adjust the target.",
        numbers={
            "goal_type": goal_type,
            "target": target,
            "current": current or 0,
            "remaining": remaining,
        }
    )


# ============================================================================
# ALLOCATION-BASED RECOMMENDATIONS
# ============================================================================

def generate_allocation_recommendations(
    allocation_analysis: dict,
    profile: dict
) -> list:
    """
    Generate recommendations based on allocation drift.

    Evaluates current vs recommended allocation and creates recommendations
    for rebalancing when drift exceeds thresholds.

    Args:
        allocation_analysis: Dict from analyzer.analyze_allocation()
        profile: Dict from profile.load_profile()

    Returns:
        List of Recommendation objects
    """
    recommendations = []

    drift = allocation_analysis.get("drift", {})
    rebalance_needed = allocation_analysis.get("rebalance_needed", False)
    recommended = allocation_analysis.get("recommended", {})
    current = allocation_analysis.get("current", {})

    if not rebalance_needed:
        # Allocation is within tolerance - informational only
        max_drift = max(abs(d) for d in drift.values()) if drift else 0
        recommendations.append(Recommendation(
            type="rebalance",
            priority="low",
            action="Allocation within tolerance",
            rationale=f"Maximum drift is {max_drift:.1f}%, below the {PRIORITY_THRESHOLDS['rebalance_trigger']:.0f}% threshold.",
            impact="Continue current contribution strategy.",
            numbers={"max_drift": round(max_drift, 1)}
        ))
        return recommendations

    # Find over and under allocated categories
    over_allocated = []
    under_allocated = []

    for cat in CATEGORY_ORDER:
        cat_drift = drift.get(cat, 0)
        if cat_drift >= PRIORITY_THRESHOLDS["allocation_drift_medium"]:
            over_allocated.append((cat, cat_drift, current.get(cat, 0), recommended.get(cat, 0)))
        elif cat_drift <= -PRIORITY_THRESHOLDS["allocation_drift_medium"]:
            under_allocated.append((cat, cat_drift, current.get(cat, 0), recommended.get(cat, 0)))

    # Sort by magnitude
    over_allocated.sort(key=lambda x: x[1], reverse=True)
    under_allocated.sort(key=lambda x: x[1])

    # Create rebalancing recommendation
    if over_allocated and under_allocated:
        over_cat, over_drift, over_curr, over_reco = over_allocated[0]
        under_cat, under_drift, under_curr, under_reco = under_allocated[0]

        priority = "high" if abs(over_drift) >= PRIORITY_THRESHOLDS["allocation_drift_high"] else "medium"

        recommendations.append(Recommendation(
            type="rebalance",
            priority=priority,
            action=f"Redirect new contributions from {_category_name(over_cat)} to {_category_name(under_cat)}",
            rationale=f"{_category_name(over_cat)} is {over_drift:+.1f}% above target ({over_curr:.1f}% vs {over_reco:.1f}%). "
                      f"{_category_name(under_cat)} is {abs(under_drift):.1f}% below target ({under_curr:.1f}% vs {under_reco:.1f}%).",
            impact=f"Move toward balanced allocation: {_category_name(over_cat)} {over_reco:.0f}%, "
                   f"{_category_name(under_cat)} {under_reco:.0f}%.",
            numbers={
                "over_allocated": {
                    "category": over_cat,
                    "drift": round(over_drift, 1),
                    "current": round(over_curr, 1),
                    "target": round(over_reco, 1)
                },
                "under_allocated": {
                    "category": under_cat,
                    "drift": round(under_drift, 1),
                    "current": round(under_curr, 1),
                    "target": round(under_reco, 1)
                },
            }
        ))
    elif over_allocated:
        # Only over-allocated categories found
        over_cat, over_drift, over_curr, over_reco = over_allocated[0]
        recommendations.append(Recommendation(
            type="rebalance",
            priority="medium",
            action=f"Reduce new contributions to {_category_name(over_cat)}",
            rationale=f"{_category_name(over_cat)} is {over_drift:+.1f}% above target.",
            impact="Pause contributions until allocation normalizes.",
            numbers={
                "over_allocated": {
                    "category": over_cat,
                    "drift": round(over_drift, 1),
                    "current": round(over_curr, 1),
                    "target": round(over_reco, 1)
                }
            }
        ))

    return recommendations


# ============================================================================
# OPPORTUNITY-BASED RECOMMENDATIONS
# ============================================================================

def generate_opportunity_recommendations(
    market_context: dict,
    goal_analysis: dict
) -> list:
    """
    Generate recommendations based on market opportunities.

    Converts detected market opportunities into recommendations,
    contextualized against current goal priorities.

    Args:
        market_context: Dict from analyzer.get_market_context()
        goal_analysis: Dict from analyzer.analyze_goals()

    Returns:
        List of Recommendation objects
    """
    recommendations = []

    if not market_context:
        return recommendations

    opportunities = market_context.get("opportunities", [])
    most_urgent_goal = goal_analysis.get("summary", {}).get("most_urgent")
    goals_behind = goal_analysis.get("summary", {}).get("goals_behind", 0)

    for opp in opportunities:
        asset = opp.get("asset", "")
        magnitude = opp.get("magnitude", 0)
        suggestion = opp.get("suggestion", "")
        opp_priority = opp.get("priority", "low")

        # Context note if there's an urgent goal
        context_note = ""
        if most_urgent_goal and goals_behind > 0:
            goal_name = most_urgent_goal.replace("_", " ")
            context_note = f" Note: {goal_name} goal takes priority over new investments."
            # Downgrade priority if urgent goal exists
            if opp_priority == "high":
                opp_priority = "medium"
            elif opp_priority == "medium":
                opp_priority = "low"

        recommendations.append(Recommendation(
            type="opportunity",
            priority=opp_priority,
            action=f"{asset} down {abs(magnitude):.1f}% this week",
            rationale=suggestion + context_note,
            impact="Potential DCA entry point if aligned with strategy and cash available.",
            numbers={
                "asset": asset,
                "change_7d": round(magnitude, 1),
            }
        ))

    return recommendations


# ============================================================================
# SURPLUS ALLOCATION RECOMMENDATIONS
# ============================================================================

def generate_surplus_recommendations(
    analysis: dict,
    profile: dict
) -> list:
    """
    Generate recommendations for where to direct monthly surplus.

    Follows priority order:
    1. Urgent goals (off-track with near deadline)
    2. Tax-advantaged space (Roth/HSA not maxed)
    3. Allocation drift (redirect to under-allocated)
    4. Default split per target allocation

    Args:
        analysis: Full analysis dict from get_full_analysis()
        profile: Dict from profile.load_profile()

    Returns:
        List of Recommendation objects
    """
    recommendations = []

    surplus = analysis.get("monthly_surplus", 0)
    if surplus <= 0:
        recommendations.append(Recommendation(
            type="warning",
            priority="high",
            action="Review monthly cash flow",
            rationale="Monthly surplus is zero or negative. Cannot optimize investment allocation.",
            impact="Address expenses or increase income before investment planning.",
            numbers={"surplus": round(surplus, 2)}
        ))
        return recommendations

    goals = analysis.get("goals", {})
    allocation = analysis.get("allocation", {})
    tax = profile.get("tax_situation", {})
    cf = profile.get("monthly_cash_flow", {})

    remaining_surplus = surplus
    allocations = []

    # 1. Check for urgent goals
    most_urgent = goals.get("summary", {}).get("most_urgent")
    if most_urgent:
        goal_data = goals.get(most_urgent, {})
        if goal_data.get("status") == "behind":
            shortfall = (goal_data.get("monthly_required", 0) -
                        goal_data.get("current_monthly", 0))
            allocation_amount = min(max(0, shortfall), remaining_surplus)
            if allocation_amount > 0:
                goal_desc = goal_data.get("description", most_urgent.replace("_", " ").title())
                allocations.append({
                    "destination": goal_desc,
                    "amount": allocation_amount,
                    "reason": "urgent_goal",
                    "priority": 1,
                })
                remaining_surplus -= allocation_amount

    # 2. Check tax-advantaged space
    if not tax.get("roth_maxed") and remaining_surplus > 0:
        roth_monthly = cf.get("roth_contributions", 0) or 0
        roth_monthly_max = TAX_ADVANTAGED_LIMITS["roth_ira"] / 12  # ~583/mo
        if roth_monthly < roth_monthly_max:
            additional = min(roth_monthly_max - roth_monthly, remaining_surplus)
            if additional >= 50:  # Only recommend if meaningful
                allocations.append({
                    "destination": "Roth IRA",
                    "amount": round(additional, 0),
                    "reason": "tax_advantaged",
                    "priority": 2,
                })
                remaining_surplus -= additional

    # 3. Check allocation drift
    if remaining_surplus > 0:
        under_allocated = []
        for cat, drift_val in allocation.get("drift", {}).items():
            if drift_val < -PRIORITY_THRESHOLDS["allocation_drift_medium"]:
                under_allocated.append((cat, abs(drift_val)))

        if under_allocated:
            under_allocated.sort(key=lambda x: x[1], reverse=True)
            primary_under = under_allocated[0][0]
            allocations.append({
                "destination": _category_name(primary_under),
                "amount": round(remaining_surplus, 0),
                "reason": "allocation_drift",
                "priority": 3,
            })
            remaining_surplus = 0

    # 4. Default split if surplus remains
    if remaining_surplus > 0:
        recommended = allocation.get("recommended", {})
        retirement_pct = recommended.get("retirement", 40)
        equities_pct = recommended.get("taxable_equities", 20)
        total_pct = retirement_pct + equities_pct

        if total_pct > 0:
            retirement_share = retirement_pct / total_pct
            retirement_amount = remaining_surplus * retirement_share
            equities_amount = remaining_surplus * (1 - retirement_share)

            allocations.append({
                "destination": "Retirement",
                "amount": round(retirement_amount, 0),
                "reason": "default_split",
                "priority": 4,
            })
            allocations.append({
                "destination": "Taxable Equities",
                "amount": round(equities_amount, 0),
                "reason": "default_split",
                "priority": 4,
            })

    # Build recommendation from allocations
    if allocations:
        # Create action text
        action_parts = []
        for a in sorted(allocations, key=lambda x: x["priority"]):
            action_parts.append(f"${a['amount']:,.0f}/mo to {a['destination']}")

        action_text = "Allocate surplus: " + ", ".join(action_parts)

        # Determine priority based on reasons
        has_urgent = any(a["reason"] == "urgent_goal" for a in allocations)
        priority = "high" if has_urgent else "medium"

        # Build rationale
        reasons = []
        if any(a["reason"] == "urgent_goal" for a in allocations):
            reasons.append("prioritizing off-track goal")
        if any(a["reason"] == "tax_advantaged" for a in allocations):
            reasons.append("maximizing tax-advantaged space")
        if any(a["reason"] == "allocation_drift" for a in allocations):
            reasons.append("correcting allocation drift")
        if any(a["reason"] == "default_split" for a in allocations):
            reasons.append("following target allocation")

        rationale = "Based on: " + ", ".join(reasons) + "."

        recommendations.append(Recommendation(
            type="surplus",
            priority=priority,
            action=action_text,
            rationale=rationale,
            impact=f"Optimizes ${surplus:,.0f}/mo surplus toward highest-priority uses.",
            numbers={
                "total_surplus": round(surplus, 2),
                "allocations": allocations,
            }
        ))

    return recommendations


# ============================================================================
# HELPER FUNCTIONS FOR OUTPUT
# ============================================================================

def _extract_goal_details(goals_analysis: dict) -> list:
    """
    Extract detailed goal information for CLI display.

    Args:
        goals_analysis: Dict from analyzer.analyze_goals()

    Returns:
        List of goal detail dicts with display-friendly fields
    """
    details = []

    for goal_type in ["short_term", "medium_term", "long_term"]:
        goal = goals_analysis.get(goal_type, {})
        status = goal.get("status")

        if status == "not_set":
            continue

        description = goal.get("description", "")
        target = goal.get("target")
        current = goal.get("current", 0)
        deadline = goal.get("deadline")
        months_remaining = goal.get("months_remaining")
        monthly_required = goal.get("monthly_required")
        current_monthly = goal.get("current_monthly")
        progress_pct = goal.get("progress_pct")
        on_track = goal.get("on_track")

        detail = {
            "type": goal_type,
            "description": description,
            "target": target,
            "current": current,
            "progress_pct": progress_pct,
            "deadline": deadline,
            "months_remaining": months_remaining,
            "monthly_required": monthly_required,
            "current_monthly": current_monthly,
            "on_track": on_track,
            "status": status,
        }
        details.append(detail)

    return details


# ============================================================================
# MAIN ENTRY POINTS
# ============================================================================

def generate_recommendations(
    portfolio: dict,
    profile: dict,
    analysis: dict = None,
    include_market: bool = True
) -> dict:
    """
    Main entry point for generating financial recommendations.

    Synthesizes all analysis into a prioritized list of recommendations.

    Args:
        portfolio: Dict from aggregator.get_unified_portfolio()
        profile: Dict from profile.load_profile()
        analysis: Optional pre-computed analysis from get_full_analysis()
        include_market: Whether to include market-based opportunities

    Returns:
        {
            "success": True,
            "recommendations": [...],
            "summary": {...},
            "portfolio_summary": {...},
            "goal_status": {...},
            "data_freshness": {...}
        }
    """
    from analyzer import get_full_analysis

    try:
        # Get or compute analysis
        if analysis is None:
            analysis = get_full_analysis(portfolio, profile, include_market)

        all_recommendations = []

        # Generate recommendations from each source
        goal_recs = generate_goal_recommendations(
            analysis.get("goals", {}),
            profile
        )
        all_recommendations.extend(goal_recs)

        allocation_recs = generate_allocation_recommendations(
            analysis.get("allocation", {}),
            profile
        )
        all_recommendations.extend(allocation_recs)

        if include_market and analysis.get("market"):
            opportunity_recs = generate_opportunity_recommendations(
                analysis.get("market", {}),
                analysis.get("goals", {})
            )
            all_recommendations.extend(opportunity_recs)

        surplus_recs = generate_surplus_recommendations(analysis, profile)
        all_recommendations.extend(surplus_recs)

        # Sort by priority
        priority_order = {"high": 0, "medium": 1, "low": 2}
        all_recommendations.sort(key=lambda r: priority_order.get(r.priority, 99))

        # Build summary
        high_count = sum(1 for r in all_recommendations if r.priority == "high")
        action_required = high_count > 0

        return {
            "success": True,
            "recommendations": [r.to_dict() for r in all_recommendations],
            "summary": {
                "high_priority_count": high_count,
                "total_count": len(all_recommendations),
                "action_required": action_required,
            },
            "portfolio_summary": {
                "total_value": portfolio.get("total_value", 0),
                "by_category": portfolio.get("by_category", {}),
                "monthly_surplus": analysis.get("monthly_surplus", 0),
            },
            "goal_status": {
                "on_track": analysis.get("goals", {}).get("summary", {}).get("goals_on_track", 0),
                "behind": analysis.get("goals", {}).get("summary", {}).get("goals_behind", 0),
                "most_urgent": analysis.get("goals", {}).get("summary", {}).get("most_urgent"),
            },
            "goal_details": _extract_goal_details(analysis.get("goals", {})),
            "data_freshness": portfolio.get("data_freshness", {}),
        }

    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to generate recommendations: {str(e)}"
        }


def get_advice(focus: str = "all") -> dict:
    """
    Convenience function that loads data and generates recommendations.

    Args:
        focus: "all" | "goals" | "rebalance" | "surplus"

    Returns:
        Recommendations dict
    """
    from aggregator import get_unified_portfolio
    from profile import load_profile

    portfolio = get_unified_portfolio()
    if not portfolio.get("success"):
        return {"success": False, "error": portfolio.get("error", "Failed to load portfolio")}

    profile = load_profile()

    result = generate_recommendations(portfolio, profile)

    # Filter by focus if specified
    if focus != "all" and result.get("success"):
        type_map = {
            "goals": ["surplus", "warning"],
            "rebalance": ["rebalance"],
            "surplus": ["surplus"],
            "opportunities": ["opportunity"],
        }
        if focus in type_map:
            result["recommendations"] = [
                r for r in result["recommendations"]
                if r["type"] in type_map[focus]
            ]
            # Recalculate summary
            result["summary"]["total_count"] = len(result["recommendations"])
            result["summary"]["high_priority_count"] = sum(
                1 for r in result["recommendations"] if r["priority"] == "high"
            )

    return result
