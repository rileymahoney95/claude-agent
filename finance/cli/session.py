"""
Advisor session generation for financial planning.

Combines portfolio snapshot, goals, and advisor recommendations
into a comprehensive prompt for Claude planning sessions.
"""

from datetime import datetime
from typing import Optional

from advisor import get_advice
from aggregator import get_unified_portfolio
from profile import load_profile
from holdings import check_holdings_freshness


def generate_session_prompt(
    portfolio: Optional[dict] = None,
    profile: Optional[dict] = None,
    advice: Optional[dict] = None,
) -> dict:
    """
    Generate a complete advisor session prompt.

    Args:
        portfolio: Optional pre-loaded portfolio from get_unified_portfolio()
        profile: Optional pre-loaded profile from load_profile()
        advice: Optional pre-loaded advice from get_advice()

    Returns:
        {
            "success": True,
            "prompt": str,  # The formatted markdown prompt
            "data": {       # Structured data for JSON output
                "portfolio_summary": {...},
                "goal_status": [...],
                "recommendations": {...},
                "data_freshness": {...}
            }
        }
    """
    try:
        # Load data if not provided
        if portfolio is None:
            portfolio = get_unified_portfolio()
            if not portfolio.get("success"):
                return {
                    "success": False,
                    "error": portfolio.get("error", "Failed to load portfolio")
                }

        if profile is None:
            profile = load_profile()

        if advice is None:
            advice = get_advice()
            if not advice.get("success"):
                return {
                    "success": False,
                    "error": advice.get("error", "Failed to generate advice")
                }

        # Build prompt sections
        today = datetime.now().strftime("%B %d, %Y")

        # Role instruction comes FIRST (before any headers)
        sections = [
            _format_advisor_context(profile),
            _format_header(today),
            _format_portfolio_snapshot(portfolio, advice),
            _format_goal_status(advice),
            _format_recommendations(advice),
            _format_action_checklist(advice),
            _format_questions_section(),
            _format_data_freshness(portfolio, advice),
        ]

        prompt = "\n\n".join(sections)

        return {
            "success": True,
            "prompt": prompt,
            "data": {
                "portfolio_summary": advice.get("portfolio_summary", {}),
                "goal_status": advice.get("goal_details", []),
                "recommendations": {
                    "high": [r for r in advice.get("recommendations", []) if r["priority"] == "high"],
                    "medium": [r for r in advice.get("recommendations", []) if r["priority"] == "medium"],
                    "low": [r for r in advice.get("recommendations", []) if r["priority"] == "low"],
                },
                "data_freshness": advice.get("data_freshness", {}),
                "generated_at": datetime.now().isoformat(),
            }
        }

    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to generate session: {str(e)}"
        }


def _format_header(date: str) -> str:
    """Format the session header (document title, not role instruction)."""
    return f"""---

# Financial Planning Session

**Generated:** {date}"""


def _format_advisor_context(profile: dict) -> str:
    """Format the advisor context - role instruction comes first, before any headers."""
    return """You are a fiduciary financial advisor specializing in goal-based asset allocation and risk management. Provide specific, actionable recommendations with numerical targets and show your math.

Review the financial data below and help me make informed decisions about my portfolio.

## My Financial Philosophy

- **Crypto conviction:** I believe in cryptocurrency as a legitimate asset class with asymmetric upside potential. Do not recommend eliminating crypto exposure or treat it as gambling.
- **Independence mindset:** I maintain financial independence from my spouse. Recommendations should not assume I would rely on her income as a backstop, even though our household income is combined.
- **Tax efficiency priority:** I prefer tax-advantaged accounts (Roth IRA, HSA) and tax-loss harvesting when available.
- **Simplicity bias:** I favor index funds (VOO/VTI) over stock picking. Consolidate positions when practical.
- **Risk tolerance:** High for long-term holdings. A 60% crypto drawdown would not cause family stress or force liquidation.

## Constraints

- Do not recommend reallocating my wife's individually managed assets
- Treat shared assets as 50/50 ownership
- My wife's financial decisions are hers; focus recommendations on my assets and our shared assets only
- I will not take unpaid parental leave
- I will not live off my wife's income for extended periods

## Communication Preferences

- Batch clarifying questions (2-3 at a time) before providing recommendations
- Show calculations and reasoning
- Provide specific dollar amounts, percentages, and timelines
- Use tables for comparisons
- End with a prioritized action checklist"""


def _format_portfolio_snapshot(portfolio: dict, advice: dict) -> str:
    """Format the current portfolio snapshot as a table."""
    summary = advice.get("portfolio_summary", {})
    total = summary.get("total_value", portfolio.get("total_value", 0))
    surplus = summary.get("monthly_surplus", 0)
    by_category = summary.get("by_category", portfolio.get("by_category", {}))

    lines = [
        "---",
        "",
        "## Current Financial Snapshot",
        "",
        "### Portfolio Overview",
        "",
        f"**Total Portfolio Value:** ${total:,.0f}",
        f"**Monthly Surplus:** ${surplus:,.0f}",
        "",
        "### Allocation by Category",
        "",
        "| Category | Value | % of Portfolio |",
        "|----------|------:|---------------:|",
    ]

    # Order: retirement, taxable_equities, crypto, cash
    category_order = ["retirement", "taxable_equities", "crypto", "cash"]
    category_names = {
        "retirement": "Retirement (Tax-Advantaged)",
        "taxable_equities": "Taxable Equities",
        "crypto": "Crypto",
        "cash": "Cash",
    }

    for cat in category_order:
        if cat in by_category:
            data = by_category[cat]
            value = data.get("value", 0)
            pct = data.get("pct", 0)
            name = category_names.get(cat, cat.replace("_", " ").title())
            lines.append(f"| {name} | ${value:,.0f} | {pct:.1f}% |")

    lines.append(f"| **Total** | **${total:,.0f}** | **100%** |")

    return "\n".join(lines)


def _format_goal_status(advice: dict) -> str:
    """Format the goal status section with progress analysis."""
    goal_details = advice.get("goal_details", [])

    if not goal_details:
        return """---

## Goal Status

*No goals configured. Run `finance profile --edit` to set goals.*"""

    lines = [
        "---",
        "",
        "## Goal Status",
        "",
    ]

    for goal in goal_details:
        desc = goal.get("description", "Goal")
        target = goal.get("target")
        current = goal.get("current", 0)
        progress = goal.get("progress_pct")
        deadline = goal.get("deadline")
        months = goal.get("months_remaining")
        monthly_req = goal.get("monthly_required")
        monthly_curr = goal.get("current_monthly")
        status = goal.get("status")

        # Goal header
        goal_type = goal.get("type", "").replace("_", " ").title()
        lines.append(f"### {goal_type}: {desc}")
        lines.append("")

        # Progress info
        if target:
            lines.append(f"- **Target:** ${target:,.0f}")
            lines.append(f"- **Current:** ${current:,.0f}")
            if progress is not None:
                lines.append(f"- **Progress:** {progress:.0f}%")

        # Deadline and pace
        if deadline:
            deadline_formatted = _format_deadline(deadline)
            if months is not None and months > 0:
                lines.append(f"- **Deadline:** {deadline_formatted} ({months} months remaining)")
            elif months is not None:
                lines.append(f"- **Deadline:** {deadline_formatted} (PAST DUE)")
            else:
                lines.append(f"- **Deadline:** {deadline_formatted}")

        # Monthly analysis
        if monthly_req is not None and monthly_curr is not None:
            lines.append(f"- **Required pace:** ${monthly_req:,.0f}/month")
            lines.append(f"- **Current pace:** ${monthly_curr:,.0f}/month")

        # Status indicator
        if status == "behind" or status == "past_deadline":
            lines.append(f"- **Status:** :warning: OFF TRACK")
        elif status == "on_track" or status == "complete":
            lines.append(f"- **Status:** :white_check_mark: ON TRACK")
        elif status == "qualitative":
            lines.append(f"- **Status:** Tracking qualitatively (no numeric target)")

        lines.append("")

    return "\n".join(lines)


def _format_recommendations(advice: dict) -> str:
    """Format recommendations grouped by priority."""
    recommendations = advice.get("recommendations", [])

    if not recommendations:
        return """---

## Pre-Analyzed Recommendations

*No recommendations at this time.*"""

    high = [r for r in recommendations if r["priority"] == "high"]
    medium = [r for r in recommendations if r["priority"] == "medium"]
    low = [r for r in recommendations if r["priority"] == "low"]

    lines = [
        "---",
        "",
        "## Pre-Analyzed Recommendations",
        "",
        "*These recommendations have been generated based on current portfolio analysis, goal progress, and market conditions. Review and validate before acting.*",
        "",
    ]

    if high:
        lines.append("### :rotating_light: High Priority Actions")
        lines.append("")
        for i, rec in enumerate(high, 1):
            lines.extend(_format_single_recommendation(rec, i))
        lines.append("")

    if medium:
        lines.append("### :thinking: Consider")
        lines.append("")
        for i, rec in enumerate(medium, 1):
            lines.extend(_format_single_recommendation(rec, i))
        lines.append("")

    if low:
        lines.append("### :information_source: Informational")
        lines.append("")
        for i, rec in enumerate(low, 1):
            lines.extend(_format_single_recommendation(rec, i))
        lines.append("")

    return "\n".join(lines)


def _format_single_recommendation(rec: dict, num: int) -> list:
    """Format a single recommendation as bullet points."""
    lines = []
    rec_type = rec.get("type", "")
    action = rec.get("action", "")
    rationale = rec.get("rationale", "")
    impact = rec.get("impact", "")

    type_label = {
        "rebalance": "[Rebalance]",
        "surplus": "[Surplus]",
        "opportunity": "[Opportunity]",
        "warning": "[Warning]",
    }.get(rec_type, "[-]")

    lines.append(f"{num}. **{type_label}** {action}")
    if rationale:
        lines.append(f"   - *Why:* {rationale}")
    if impact:
        lines.append(f"   - *Impact:* {impact}")
    lines.append("")

    return lines


def _format_action_checklist(advice: dict) -> str:
    """Generate an action checklist from high-priority recommendations."""
    recommendations = advice.get("recommendations", [])
    high_priority = [r for r in recommendations if r["priority"] == "high"]

    lines = [
        "---",
        "",
        "## Action Checklist",
        "",
    ]

    if not high_priority:
        lines.append("*No immediate actions required. Portfolio is well-positioned.*")
    else:
        lines.append("*Derived from high-priority recommendations above:*")
        lines.append("")
        for i, rec in enumerate(high_priority, 1):
            action = rec.get("action", "")
            lines.append(f"- [ ] {action}")

    return "\n".join(lines)


def _format_questions_section() -> str:
    """Format the questions section for user input."""
    return """---

## Questions for This Session

> *Add specific questions or topics you want to discuss:*

1.
2.
3. """


def _format_data_freshness(portfolio: dict, advice: dict) -> str:
    """Format the data freshness section."""
    freshness = advice.get("data_freshness", portfolio.get("data_freshness", {}))

    sofi = freshness.get("sofi_snapshots", "N/A")
    holdings = freshness.get("holdings", "N/A")
    prices = freshness.get("crypto_prices", "N/A")

    # Check staleness
    holdings_check = check_holdings_freshness()
    stale_warning = ""
    if holdings_check.get("is_stale"):
        stale_warning = f"\n\n:warning: **Warning:** {holdings_check.get('message')}"

    return f"""---

## Data Freshness

| Source | Last Updated |
|--------|--------------|
| SoFi Snapshots | {sofi or 'N/A'} |
| Manual Holdings | {holdings or 'N/A'} |
| Crypto Prices | {prices.title() if isinstance(prices, str) else 'N/A'} |
{stale_warning}

---

*Generated by `finance plan --advisor`. Run `finance pull` to update SoFi data, `finance holdings set` to update manual holdings.*"""


def _format_deadline(deadline: str) -> str:
    """Format YYYY-MM deadline to readable string."""
    try:
        date = datetime.strptime(deadline, "%Y-%m")
        return date.strftime("%B %Y")
    except ValueError:
        return deadline
