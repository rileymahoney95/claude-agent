"""
Shared configuration, paths, and constants for the finance CLI.
"""

import os
from pathlib import Path

# Paths relative to repository root
# finance/cli/config.py -> cli -> finance -> repo root
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DATA_DIR = REPO_ROOT / ".data" / "finance"
SNAPSHOTS_DIR = DATA_DIR / "snapshots"
TEMPLATE_PATH = REPO_ROOT / "finance" / "templates" / "FINANCIAL_PLANNING_PROMPT.md"
STATEMENTS_DIR = REPO_ROOT / "personal" / "finance" / "statements"
LOCK_FILE = DATA_DIR / ".lock"
PROFILE_PATH = REPO_ROOT / ".config" / "finance-profile.json"
HOLDINGS_PATH = REPO_ROOT / ".config" / "holdings.json"

# Database configuration
# SQLite database file (always available, no Docker needed)
DATABASE_PATH = DATA_DIR / "finance.db"

# Set USE_DATABASE=false to disable SQLite and use only JSON files
USE_DATABASE = os.environ.get("FINANCE_USE_DATABASE", "true").lower() not in ("false", "0", "no")

# CoinGecko API for crypto prices
COINGECKO_API_BASE = "https://api.coingecko.com/api/v3"

# Symbol to CoinGecko ID mapping
CRYPTO_ID_MAP = {
    "BTC": "bitcoin",
    "ETH": "ethereum",
    "SOL": "solana",
    "DOGE": "dogecoin",
    "ADA": "cardano",
    "XRP": "ripple",
    "AVAX": "avalanche-2",
    "DOT": "polkadot",
    "MATIC": "matic-network",
    "LINK": "chainlink",
}

# Mapping of account types to their row names in the template
ACCOUNT_ROW_NAMES = {
    'roth_ira': 'Roth IRA',
    'brokerage': 'Taxable Brokerage (Index)',
    'traditional_ira': 'Traditional IRA',
}

# Default profile structure
DEFAULT_PROFILE = {
    "monthly_cash_flow": {
        "gross_income": None,
        "shared_expenses": None,
        "crypto_contributions": None,
        "roth_contributions": None,
        "hsa_contributions": None,
        "discretionary": None,
    },
    "household_context": {
        "wife_income": None,
        "wife_assets": None,
        "mortgage_payment": None,
        "mortgage_rate": None,
        "mortgage_balance": None,
        "home_value": None,
    },
    "tax_situation": {
        "filing_status": None,
        "federal_bracket": None,
        "state_tax": None,
        "roth_maxed": None,
        "backdoor_required": None,
        "has_401k": None,
        "hsa_eligible": None,
    },
    "goals": {
        "short_term": {"description": None, "target": None, "deadline": None},
        "medium_term": {"description": None, "target": None, "deadline": None},
        "long_term": {"description": None, "target": None, "deadline": None},
    },
    "projection_settings": None,  # Will use DEFAULT_PROJECTION_SETTINGS when None
    "last_updated": None,
}

# Default holdings structure
DEFAULT_HOLDINGS = {
    "crypto": {},
    "bank_accounts": {},
    "other": {},
    "last_updated": None,
}

# Portfolio category configuration (Phase 2)
RETIREMENT_ACCOUNT_TYPES = {"roth_ira", "traditional_ira", "401k"}
CRYPTO_ETF_SYMBOLS = {"BITO", "GBTC", "ETHE", "IBIT", "FBTC"}
CATEGORY_ORDER = ["retirement", "taxable_equities", "crypto", "cash"]
CATEGORY_NAMES = {
    "retirement": "Retirement",
    "taxable_equities": "Taxable Equities",
    "crypto": "Crypto",
    "cash": "Cash & Equivalents",
}
SNAPSHOT_STALE_DAYS = 30
HOLDINGS_STALE_DAYS = 7

# ============================================================================
# PHASE 3: ANALYZER CONFIGURATION
# ============================================================================

# Baseline allocation percentages (high risk, no urgent goals)
BASELINE_ALLOCATION = {
    "retirement": 40.0,
    "taxable_equities": 20.0,
    "crypto": 25.0,
    "cash": 15.0,
}

# Adjustment values for allocation recommendations
ALLOCATION_ADJUSTMENTS = {
    "urgent_goal_boost_low": 10.0,   # < 12 months deadline
    "urgent_goal_boost_high": 20.0,  # < 6 months deadline
}

# Opportunity detection thresholds (negative values = drops)
OPPORTUNITY_THRESHOLDS = {
    "crypto_potential_dca": -10.0,   # 7d drop for "potential DCA"
    "crypto_strong_dca": -20.0,      # 7d drop for "strong DCA signal"
    "sp500_pullback": -5.0,          # 7d drop for "market pullback"
    "sp500_correction": -10.0,       # 30d drop for "correction territory"
}

# ============================================================================
# PHASE 4: ADVISOR CONFIGURATION
# ============================================================================

# Priority thresholds for recommendations
PRIORITY_THRESHOLDS = {
    "goal_deadline_urgent": 12,        # months - high priority if deadline < this
    "goal_deadline_critical": 6,       # months - critical priority
    "allocation_drift_high": 10.0,     # % drift for high priority rebalance
    "allocation_drift_medium": 5.0,    # % drift for medium priority
    "rebalance_trigger": 7.0,          # % drift to recommend rebalancing
}

# Recommendation types and priorities
RECOMMENDATION_TYPES = ["rebalance", "surplus", "opportunity", "warning"]
RECOMMENDATION_PRIORITIES = ["high", "medium", "low"]

# Tax-advantaged annual limits (2026)
TAX_ADVANTAGED_LIMITS = {
    "roth_ira": 7000,      # Standard limit
    "hsa_individual": 4300,
    "hsa_family": 8550,
}

# Surplus allocation priorities (in order of evaluation)
SURPLUS_PRIORITY_ORDER = [
    "urgent_goal",          # Off-track goal with near deadline
    "tax_advantaged",       # Max Roth/HSA if not maxed
    "allocation_drift",     # Redirect to under-allocated categories
    "default_split",        # Standard split per target allocation
]

# ============================================================================
# PHASE 5: PROJECTION CONFIGURATION
# ============================================================================

# Default expected returns by ASSET CLASS (annual %, nominal)
# Used for portfolio projection calculations
DEFAULT_EXPECTED_RETURNS = {
    "equities": 7.0,         # Broad equities assumption
    "bonds": 4.0,            # Conservative fixed income
    "crypto": 12.0,          # Higher risk/reward
    "cash": 4.5,             # Current HYSA rates
}

# Default projection settings for Coast FIRE and forecasting
DEFAULT_PROJECTION_SETTINGS = {
    "expected_returns": DEFAULT_EXPECTED_RETURNS,
    "inflation_rate": 3.0,        # Annual inflation %
    "withdrawal_rate": 4.0,       # Safe withdrawal rate for Coast FIRE
    "target_retirement_age": 65,  # Retirement target
    "current_age": 30,            # User sets once
}
