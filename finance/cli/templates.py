"""
Template management for the finance CLI.

Handles updating and populating the financial planning template.
"""

import re
from datetime import datetime

from colorama import Style

from config import TEMPLATE_PATH, ACCOUNT_ROW_NAMES
from formatting import format_header


def update_template(data: dict, all_snapshots: list = None) -> bool:
    """
    Update the financial planning template with values from account snapshots.

    Args:
        data: Single snapshot (for backward compat) or primary snapshot
        all_snapshots: Optional list of all snapshots to update multiple rows

    Returns:
        True if template was updated, False otherwise
    """
    if not TEMPLATE_PATH.exists():
        return False

    content = TEMPLATE_PATH.read_text()

    today = datetime.now().strftime("%Y-%m-%d")
    content = re.sub(
        r'\*\*Last Updated:\*\* (\[DATE\]|[\d-]+)',
        f'**Last Updated:** {today}',
        content
    )

    snapshots = all_snapshots if all_snapshots else [data]

    latest_by_type = {}
    for snap in sorted(snapshots, key=lambda x: x.get('statement_date') or ''):
        account_type = snap.get('account_type')
        if account_type:
            latest_by_type[account_type] = snap

    lines = content.split("\n")
    updated_lines = []
    in_assets_table = False

    for line in lines:
        if "| Asset " in line and "| Value |" in line:
            in_assets_table = True
        elif in_assets_table and (line.strip() == "" or line.startswith("###")):
            in_assets_table = False

        if in_assets_table and "|" in line:
            for account_type, row_name in ACCOUNT_ROW_NAMES.items():
                if row_name in line and account_type in latest_by_type:
                    parts = line.split("|")
                    if len(parts) >= 4:
                        value = latest_by_type[account_type]["portfolio"]["total_value"]
                        parts[2] = f" ${value:,.2f} "
                        line = "|".join(parts)
                    break

        updated_lines.append(line)

    new_content = "\n".join(updated_lines)

    temp_file = TEMPLATE_PATH.with_suffix(".md.tmp")
    temp_file.write_text(new_content)
    temp_file.rename(TEMPLATE_PATH)

    return True


def populate_template(template: str, latest_by_type: dict) -> str:
    """
    Fill the planning template with values from account snapshots.

    Args:
        template: The template content string
        latest_by_type: Dict of account_type -> snapshot data

    Returns:
        Populated template string
    """
    content = template

    today = datetime.now().strftime("%Y-%m-%d")
    content = re.sub(
        r'\*\*Last Updated:\*\* (\[DATE\]|[\d-]+)',
        f'**Last Updated:** {today}',
        content
    )

    lines = content.split("\n")
    updated_lines = []
    in_assets_table = False

    for line in lines:
        if "| Asset " in line and "| Value |" in line:
            in_assets_table = True
        elif in_assets_table and (line.strip() == "" or line.startswith("###")):
            in_assets_table = False

        if in_assets_table and "|" in line:
            for account_type, row_name in ACCOUNT_ROW_NAMES.items():
                if row_name in line and account_type in latest_by_type:
                    parts = line.split("|")
                    if len(parts) >= 4:
                        value = latest_by_type[account_type]["portfolio"]["total_value"]
                        parts[2] = f" ${value:,.2f} "
                        line = "|".join(parts)
                    break

        updated_lines.append(line)

    return "\n".join(updated_lines)


def populate_cash_flow(content: str, profile: dict) -> str:
    """Populate Monthly Cash Flow table from profile."""
    cf = profile.get("monthly_cash_flow", {})

    mappings = [
        ("gross_income", "Gross Income", "/month"),
        ("shared_expenses", "Shared Expenses Contribution", "/month"),
        ("crypto_contributions", "Crypto Contributions", "/month"),
        ("roth_contributions", "Roth IRA Contributions", "/month"),
        ("hsa_contributions", "HSA Contributions", "/month"),
        ("discretionary", "Personal Discretionary", "/month"),
    ]

    for key, row_pattern, suffix in mappings:
        val = cf.get(key)
        if val:
            pattern = rf'(\| {re.escape(row_pattern)}\s*\|)\s*\$/month\s*(\|)'
            replacement = rf'\1 ${val:,.0f}{suffix} \2'
            content = re.sub(pattern, replacement, content)

    gross = cf.get("gross_income", 0) or 0
    expenses = sum([
        cf.get("shared_expenses", 0) or 0,
        cf.get("crypto_contributions", 0) or 0,
        cf.get("roth_contributions", 0) or 0,
        cf.get("hsa_contributions", 0) or 0,
        cf.get("discretionary", 0) or 0,
    ])
    surplus = gross - expenses
    if surplus != 0:
        pattern = r'(\| \*\*Net Surplus to Allocate\*\*\s*\|)\s*\*\*\$/month\*\*\s*(\|)'
        replacement = rf'\1 **${surplus:,.0f}/month** \2'
        content = re.sub(pattern, replacement, content)

    return content


def populate_household_context(content: str, profile: dict) -> str:
    """Populate Household Context table from profile."""
    hc = profile.get("household_context", {})

    cf = profile.get("monthly_cash_flow", {})
    my_income = (cf.get("gross_income", 0) or 0) * 12
    wife_income = hc.get("wife_income", 0) or 0
    combined = my_income + wife_income

    mappings = [
        ("wife_income", "Wife's Annual Income", "${:,.0f}"),
        ("wife_assets", "Wife's Separate Assets", "~${:,.0f}"),
        ("mortgage_payment", "Mortgage Payment", "${:,.0f}/month"),
        ("mortgage_rate", "Mortgage Rate", "{:.1f}%"),
        ("mortgage_balance", "Mortgage Balance", "${:,.0f}"),
        ("home_value", "Home Value", "${:,.0f}"),
    ]

    for key, row_pattern, fmt in mappings:
        val = hc.get(key)
        if val:
            pattern = rf'(\| {re.escape(row_pattern)}[^|]*\|)\s*[\$~%\d,./]*\s*(\|)'
            replacement = rf'\1 {fmt.format(val)} \2'
            content = re.sub(pattern, replacement, content)

    if combined > 0:
        pattern = r'(\| Combined Household Income\s*\|)\s*\$\s*(\|)'
        replacement = rf'\1 ${combined:,.0f}/year \2'
        content = re.sub(pattern, replacement, content)

    return content


def populate_tax_situation(content: str, profile: dict) -> str:
    """Populate Tax Situation table from profile."""
    tax = profile.get("tax_situation", {})

    if tax.get("filing_status"):
        pattern = r'(\| Filing Status\s*\|)\s*Married Filing Jointly / Separately\s*(\|)'
        replacement = rf'\1 {tax["filing_status"]} \2'
        content = re.sub(pattern, replacement, content)

    if tax.get("federal_bracket"):
        pattern = r'(\| Marginal Federal Tax Bracket\s*\|)\s*%\s*(\|)'
        replacement = rf'\1 {tax["federal_bracket"]}% \2'
        content = re.sub(pattern, replacement, content)

    if tax.get("state_tax"):
        pattern = r'(\| State Income Tax\s*\|)\s*%\s*(\|)'
        replacement = rf'\1 {tax["state_tax"]}% \2'
        content = re.sub(pattern, replacement, content)

    yesno_fields = [
        ("roth_maxed", "Roth IRA maxed this year?"),
        ("backdoor_required", "Backdoor Roth required?"),
        ("has_401k", "401\\(k\\) available?"),
        ("hsa_eligible", "HSA eligible?"),
    ]

    for key, row_pattern in yesno_fields:
        val = tax.get(key)
        if val is not None:
            pattern = rf'(\| {row_pattern}\s*\|)\s*Yes / No\s*(\|)'
            replacement = rf'\1 {"Yes" if val else "No"} \2'
            content = re.sub(pattern, replacement, content)

    return content


def populate_goals(content: str, profile: dict) -> str:
    """Populate Goals section from profile."""
    goals = profile.get("goals", {})

    goal_sections = [
        ("short_term", "### Goal 1: [SHORT-TERM \u2014 6-12 months]"),
        ("medium_term", "### Goal 2: [MEDIUM-TERM \u2014 1-5 years]"),
        ("long_term", "### Goal 3: [LONG-TERM \u2014 5-10+ years]"),
    ]

    for key, header in goal_sections:
        g = goals.get(key, {})
        desc = g.get("description")
        target = g.get("target")
        deadline = g.get("deadline")

        if desc:
            new_section = f"{header}\n\n"
            new_section += f"**Goal:** {desc}\n"
            if target:
                new_section += f"**Target Amount:** ${target:,.0f}\n"
            else:
                new_section += "**Target Amount:** $\n"
            if deadline:
                new_section += f"**Deadline:** {deadline}\n"
            else:
                new_section += "**Deadline:**\n"
            new_section += "**Context/Notes:**"

            pattern = re.escape(header) + r'\n\n\*\*Goal:\*\*\n\*\*Target Amount:\*\* \$\n\*\*Deadline:\*\*\n\*\*Context/Notes:\*\*'
            content = re.sub(pattern, new_section, content)

    return content


def populate_questions(content: str, questions: list) -> str:
    """Populate Questions section with session questions."""
    if not questions:
        return content

    question_text = "\n".join(f"{i+1}. {q}" for i, q in enumerate(questions))
    for i in range(len(questions), 5):
        question_text += f"\n{i+1}."

    pattern = r'> \*\*Add or modify based on what\'s top of mind\*\*\n\n1\.\n2\.\n3\.\n4\.\n5\.'
    replacement = f"> **Add or modify based on what's top of mind**\n\n{question_text}"
    content = re.sub(pattern, replacement, content)

    return content


def strip_template_meta(content: str) -> str:
    """Remove template instructions and example sections from output."""
    content = re.sub(
        r'---\n\n## Instructions for Use\n\n.*?(?=---\n\n## Section 1:)',
        '---\n\n',
        content,
        flags=re.DOTALL
    )

    content = re.sub(
        r'---\n\n## Quick-Start: Copy/Paste Prompt\n\n.*?(?=---\n\n## Example:|---\n\n_Template)',
        '---\n\n',
        content,
        flags=re.DOTALL
    )

    content = re.sub(
        r'---\n\n## Example: Filled Out Snapshot.*?(?=---\n\n_Template|$)',
        '',
        content,
        flags=re.DOTALL
    )

    content = re.sub(r'\n_Template Version.*$', '', content)
    content = re.sub(r'(---\n\n){2,}', '---\n\n', content)

    return content.strip()


def prompt_for_missing_assets(content: str) -> str:
    """
    Scan template for empty asset values and prompt user to fill them in.

    Args:
        content: The template content with some values already filled

    Returns:
        Updated template with user-provided values
    """
    lines = content.split("\n")
    updated_lines = []

    in_individual_assets = False
    in_shared_assets = False
    in_example_section = False
    prompted_any = False

    individual_total = 0.0
    shared_total = 0.0

    for i, line in enumerate(lines):
        if "## Example:" in line or "Example: Filled Out" in line:
            in_example_section = True
            in_individual_assets = False
            in_shared_assets = False

        if not in_example_section:
            if "### My Individual Assets" in line:
                in_individual_assets = True
                in_shared_assets = False
            elif "### Shared Assets" in line:
                in_individual_assets = False
                in_shared_assets = True
            elif line.startswith("###"):
                in_individual_assets = False
                in_shared_assets = False

        if (in_individual_assets or in_shared_assets) and "|" in line:
            parts = line.split("|")

            if len(parts) >= 4 and "---" not in line and "Asset" not in parts[1]:
                asset_name = parts[1].strip()
                value_cell = parts[2].strip()

                if "**TOTAL**" in asset_name:
                    updated_lines.append(line)
                    continue

                is_empty = value_cell == "$" or re.match(r'^\$\s*$', value_cell)

                if is_empty:
                    if not prompted_any:
                        print()
                        print(format_header("Fill in missing asset values"))
                        print(f"{Style.DIM}Press Enter to skip, or enter a number (e.g., 5000 or 5,000){Style.RESET_ALL}")
                        print()
                        prompted_any = True

                    try:
                        if in_shared_assets:
                            user_input = input(f"  {asset_name} (total value): $").strip()
                        else:
                            user_input = input(f"  {asset_name}: $").strip()
                    except (EOFError, KeyboardInterrupt):
                        print()
                        updated_lines.append(line)
                        continue

                    if user_input:
                        try:
                            value = float(user_input.replace(",", "").replace("$", ""))
                            parts[2] = f" ${value:,.2f} "

                            if in_shared_assets and len(parts) >= 5:
                                half_value = value / 2
                                parts[3] = f" ${half_value:,.2f} "
                                shared_total += half_value
                            elif in_individual_assets:
                                individual_total += value

                            line = "|".join(parts)
                        except ValueError:
                            pass
                else:
                    match = re.search(r'\$[\d,]+\.?\d*', value_cell)
                    if match:
                        try:
                            value = float(match.group().replace(",", "").replace("$", ""))
                            if in_individual_assets:
                                individual_total += value
                            elif in_shared_assets and len(parts) >= 5:
                                share_cell = parts[3].strip()
                                share_match = re.search(r'\$[\d,]+\.?\d*', share_cell)
                                if share_match:
                                    shared_total += float(share_match.group().replace(",", "").replace("$", ""))
                                else:
                                    shared_total += value / 2
                        except (ValueError, IndexError):
                            pass

        updated_lines.append(line)

    if prompted_any:
        print()

    result = "\n".join(updated_lines)
    if individual_total > 0:
        result = re.sub(
            r'(\| \*\*TOTAL\*\*\s*\|)\s*\*\*\$[^|]*\*\*\s*(\|)',
            rf'\1 **${individual_total:,.2f}** \2',
            result
        )
        result = re.sub(
            r'(\| \*\*TOTAL\*\*\s*\|)\s*\*\*\$\*\*\s*(\|)',
            rf'\1 **${individual_total:,.2f}** \2',
            result
        )

    return result
