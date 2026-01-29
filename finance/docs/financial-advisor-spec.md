# Financial Advisor Agent Specification

**Status:** Phase 6 Complete
**Created:** 2026-01-13
**Last Updated:** 2026-01-13
**Goal:** Build a personalized financial advisor that synthesizes multiple data sources and returns actionable recommendations.

---

## Overview

### Core Question the Advisor Answers

> "How should I rebalance and/or adjust my surplus allocations based on my goals and current market conditions?"

### Design Principles

1. **Synthesize, don't just report** - Combine data sources into recommendations
2. **Goal-driven** - Every recommendation ties back to stated goals
3. **Market-aware** - Factor in current conditions for timing
4. **Concise** - Essential information only, no bloat
5. **Opinionated** - Make specific suggestions, not vague options

### Interfaces

| Interface                | Use Case                                       |
| ------------------------ | ---------------------------------------------- |
| `finance advise`         | CLI command for quick terminal recommendations |
| `get_financial_advice()` | MCP tool for Claude conversations              |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        DATA SOURCES                             │
├──────────────┬──────────────┬──────────────┬───────────────────┤
│  SoFi        │  holdings    │  profile     │  markets          │
│  snapshots   │  .json       │  .json       │  (live prices)    │
│  (existing)  │  (NEW)       │  (existing)  │  (existing)       │
└──────┬───────┴──────┬───────┴──────┬───────┴─────────┬─────────┘
       │              │              │                 │
       └──────────────┴──────────────┴─────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   AGGREGATOR      │
                    │   Unified view    │
                    │   of all assets   │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │   ANALYZER        │
                    │   - Allocations   │
                    │   - Goal progress │
                    │   - Market context│
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │   ADVISOR         │
                    │   Recommendations │
                    └─────────┬─────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
      ┌───────▼───────┐               ┌───────▼───────┐
      │  CLI          │               │  MCP          │
      │  finance      │               │  get_advice() │
      │  advise       │               │               │
      └───────────────┘               └───────────────┘
```

---

## Phase 1: Data Consolidation

### New Data File: `.config/holdings.json`

Manually-maintained holdings not captured by SoFi statements:

```json
{
  "crypto": {
    "BTC": { "quantity": 0.5, "notes": "Cold storage" },
    "ETH": { "quantity": 2.0, "notes": "Coinbase" }
  },
  "bank_accounts": {
    "hysa": { "balance": 12000, "name": "SoFi HYSA" },
    "checking": { "balance": 3500, "name": "Primary checking" }
  },
  "other": {
    "hsa": { "balance": 2000, "name": "Fidelity HSA" }
  },
  "last_updated": "2026-01-13"
}
```

### New CLI Commands

```bash
# View holdings
finance holdings                    # Display all holdings with current values

# Update holdings
finance holdings set crypto.BTC 0.5      # Set crypto quantity
finance holdings set bank.hysa 15000     # Set bank balance
finance holdings set other.hsa 2500      # Set other account

# Maintenance
finance holdings check                   # Warn if last_updated > 7 days
```

### Implementation Notes

- Crypto prices fetched from CoinGecko (reuse `markets` tool logic)
- Bank/other values are static (user-entered)
- `last_updated` auto-updates on any `set` command
- `holdings check` can be called by advisor to prompt for refresh

---

## Phase 2: Unified Portfolio View

### Aggregator Function

```python
def get_unified_portfolio() -> dict:
    """
    Aggregates all data sources into single portfolio view.

    Sources:
    - SoFi snapshots (latest by account type)
    - holdings.json (crypto, bank, other)
    - Live crypto prices from CoinGecko

    Returns:
    {
        "as_of": "2026-01-13",
        "data_freshness": {
            "sofi_snapshots": "2025-12-31",
            "holdings": "2026-01-13",
            "crypto_prices": "live"
        },
        "total_value": 185120.96,

        "by_category": {
            "retirement": {
                "value": 68340.45,
                "pct": 36.9,
                "assets": ["Roth IRA"]
            },
            "taxable_equities": {
                "value": 16580.51,
                "pct": 9.0,
                "assets": ["Brokerage (VOO/VTI)"]
            },
            "crypto": {
                "value": 52000.00,
                "pct": 28.1,
                "assets": ["BTC", "ETH", "Crypto Index"]
            },
            "cash": {
                "value": 48200.00,
                "pct": 26.0,
                "assets": ["HYSA", "Checking", "FDIC Deposits"]
            }
        },

        "by_asset": [
            {"name": "Roth IRA", "category": "retirement", "value": 68340.45},
            {"name": "BTC", "category": "crypto", "value": 32000.00},
            ...
        ]
    }
    """
```

### Category Definitions

| Category           | Includes                                  |
| ------------------ | ----------------------------------------- |
| `retirement`       | Roth IRA, Traditional IRA, 401(k), HSA    |
| `taxable_equities` | Brokerage accounts (index funds, stocks)  |
| `crypto`           | All cryptocurrency (direct + index funds) |
| `cash`             | HYSA, checking, FDIC sweep accounts       |

---

## Phase 3: Analyzer

### Goal Progress Analysis

```python
def analyze_goals(portfolio: dict, profile: dict) -> dict:
    """
    Analyzes progress toward each goal.

    Returns:
    {
        "short_term": {
            "description": "Emergency fund",
            "target": 35000,
            "deadline": "2026-08",
            "current": 12000,
            "progress_pct": 34.3,
            "monthly_required": 3286,  # To hit goal on time
            "current_monthly": 681,    # Current surplus allocation
            "on_track": False,
            "months_remaining": 7,
            "months_at_current_pace": 34
        },
        ...
    }
    """
```

### Allocation Analysis

```python
def analyze_allocation(portfolio: dict, profile: dict) -> dict:
    """
    Compares current allocation to recommended targets.

    Target allocation is CALCULATED based on:
    - Goals and their timelines
    - Risk tolerance (high)
    - Current life stage (baby coming, need liquidity)

    Returns:
    {
        "current": {
            "retirement": 36.9,
            "taxable_equities": 9.0,
            "crypto": 28.1,
            "cash": 26.0
        },
        "recommended": {
            "retirement": 35.0,
            "taxable_equities": 10.0,
            "crypto": 20.0,
            "cash": 35.0
        },
        "reasoning": "Higher cash target due to emergency fund goal deadline in 7 months",
        "drift": {
            "crypto": +8.1,  # Over-allocated
            "cash": -9.0    # Under-allocated
        }
    }
    """
```

### Target Allocation Logic

The advisor calculates recommended allocation dynamically based on:

1. **Goal urgency** - Near-term goals increase cash/conservative allocation
2. **Goal type** - Emergency fund → cash, retirement → equities
3. **Risk tolerance** - "High" allows more crypto/equity exposure
4. **Life stage** - Baby coming → temporarily higher liquidity

**Baseline allocation (high risk, no urgent goals):**

- Retirement: 40%
- Taxable equities: 20%
- Crypto: 25%
- Cash: 15%

**Adjustments:**

- Urgent cash goal (< 12 months): +10-20% cash, reduce crypto/equities proportionally
- Maxing Roth: Prioritize retirement until maxed
- Market opportunity: Temporary flexibility for DCA

### Market Context

```python
def get_market_context() -> dict:
    """
    Fetches relevant market data for recommendations.

    Uses existing markets tool / CoinGecko + yfinance.

    Returns:
    {
        "crypto": {
            "btc_price": 42000,
            "btc_7d_change": -12.5,
            "eth_7d_change": -8.2,
            "market_sentiment": "fear"  # Based on magnitude of drops
        },
        "equities": {
            "sp500_7d_change": -2.1,
            "sp500_1yr_change": 18.5
        },
        "opportunities": [
            {
                "asset": "BTC",
                "signal": "7d_drop",
                "magnitude": -12.5,
                "suggestion": "DCA opportunity if aligned with strategy"
            }
        ]
    }
    """
```

### Opportunity Detection Thresholds

| Asset   | Trigger         | Interpretation                       |
| ------- | --------------- | ------------------------------------ |
| BTC/ETH | -10% in 7 days  | "Potential DCA opportunity"          |
| BTC/ETH | -20% in 7 days  | "Significant dip, strong DCA signal" |
| S&P 500 | -5% in 7 days   | "Market pullback, consider adding"   |
| S&P 500 | -10% in 30 days | "Correction territory"               |

---

## Phase 4: Recommendation Engine

### Recommendation Structure

```python
@dataclass
class Recommendation:
    type: str           # "rebalance" | "surplus" | "opportunity" | "warning"
    priority: str       # "high" | "medium" | "low"
    action: str         # Specific action: "Move $500/mo from crypto DCA to HYSA"
    rationale: str      # Why: "Emergency fund deadline in 7 months"
    impact: str         # Result: "Reaches 80% of goal by deadline"
    numbers: dict       # Supporting data for the recommendation
```

### Recommendation Priority Logic

**HIGH priority:**

- Goal will be missed at current pace AND deadline < 12 months
- Allocation drift > 10% from target
- Action required this month

**MEDIUM priority:**

- Goal progress slower than ideal but deadline > 12 months
- Allocation drift 5-10%
- Market opportunity with > 15% drop

**LOW priority:**

- Informational / no action needed
- Small optimizations
- Market opportunities with 10-15% drop

### Surplus Allocation Logic

When determining where to direct monthly surplus:

1. **Check goal urgency** - If any goal is off-track with near deadline, prioritize it
2. **Check tax-advantaged space** - If Roth/HSA not maxed, prioritize those
3. **Check allocation drift** - Direct to under-allocated categories
4. **Default** - Split between retirement and taxable per target allocation

### Rebalancing Logic

- **Threshold:** Recommend rebalancing when any category drifts ±7% from target
- **Method:** Suggest redirecting new contributions (not selling) when possible
- **Tax-awareness:** Prefer rebalancing in tax-advantaged accounts

---

## Phase 5: CLI Output

### Command: `finance advise`

```bash
finance advise              # Full recommendations
finance advise --focus goals      # Goal progress only
finance advise --focus rebalance  # Allocation only
finance advise --json             # JSON output for MCP
```

### Example Output

```
┌─────────────────────────────────────────────────────────────────┐
│  FINANCIAL ADVISOR                            January 13, 2026  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PORTFOLIO: $185,121                                            │
│  ├─ Retirement     $68,340  (36.9%)                             │
│  ├─ Equities       $16,581  ( 9.0%)                             │
│  ├─ Crypto         $52,000  (28.1%)                             │
│  └─ Cash           $48,200  (26.0%)                             │
│                                                                 │
│  MONTHLY SURPLUS: $681                                          │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  GOAL PROGRESS                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🎯 Emergency Fund: $12,000 / $35,000 (34%)                     │
│     Deadline: August 2026 (7 months)                            │
│     Status: ⚠️  OFF TRACK                                       │
│     └─ Need: $3,286/mo  │  Current: $681/mo                     │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  RECOMMENDATIONS                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ⚡ HIGH PRIORITY                                               │
│                                                                 │
│  1. Redirect crypto DCA to emergency fund                       │
│     ─────────────────────────────────────────                   │
│     Action: Reduce crypto from $2,166/mo → $500/mo              │
│             Add $1,666/mo to HYSA                               │
│                                                                 │
│     Why: Emergency fund deadline Aug 2026 cannot be met         │
│          at current $681/mo surplus rate.                       │
│                                                                 │
│     After change: $2,347/mo to emergency fund                   │
│     New timeline: ~10 months (close to deadline)                │
│                                                                 │
│     Note: Maintains $500/mo crypto DCA for continued            │
│           exposure aligned with long-term conviction.           │
│                                                                 │
│  💡 OPPORTUNITY                                                 │
│                                                                 │
│  2. BTC down 12% this week                                      │
│     ─────────────────────────────────────────                   │
│     If you have unallocated cash, this is a reasonable          │
│     DCA entry point. However, emergency fund takes priority.    │
│                                                                 │
│  ✓ NO ACTION NEEDED                                             │
│                                                                 │
│  3. Allocation within tolerance                                 │
│     Crypto 28% vs target ~25% (acceptable during accumulation)  │
│     No rebalancing required.                                    │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  DATA FRESHNESS                                                 │
│  └─ SoFi: 2025-12-31  │  Holdings: 2026-01-13  │  Prices: Live  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 6: MCP Integration

### Tool: `get_financial_advice`

```python
@mcp.tool()
async def get_financial_advice(
    focus: str = "all"  # "all" | "goals" | "rebalance" | "surplus"
) -> dict:
    """
    Analyzes portfolio and returns actionable financial recommendations.

    Synthesizes:
    - Current portfolio (SoFi statements + manual holdings)
    - Financial profile (goals, cash flow, constraints)
    - Market conditions (crypto, equities)

    Args:
        focus: What to focus on
            - "all": Complete analysis with all recommendations
            - "goals": Goal progress and goal-related actions
            - "rebalance": Allocation analysis and rebalancing
            - "surplus": Where to direct monthly surplus

    Returns:
        Dictionary with:
        - portfolio_summary: Current values and allocation percentages
        - goal_progress: Status of each financial goal
        - recommendations: Prioritized list of actions
        - market_context: Relevant market conditions
        - data_freshness: When each data source was last updated
    """
```

### Example Response

```json
{
  "portfolio_summary": {
    "total_value": 185121,
    "by_category": {
      "retirement": { "value": 68340, "pct": 36.9 },
      "crypto": { "value": 52000, "pct": 28.1 },
      "cash": { "value": 48200, "pct": 26.0 },
      "taxable_equities": { "value": 16581, "pct": 9.0 }
    },
    "monthly_surplus": 681
  },
  "goal_progress": {
    "emergency_fund": {
      "target": 35000,
      "current": 12000,
      "progress_pct": 34.3,
      "deadline": "2026-08",
      "on_track": false,
      "monthly_needed": 3286
    }
  },
  "recommendations": [
    {
      "type": "surplus",
      "priority": "high",
      "action": "Redirect $1,666/mo from crypto DCA to HYSA",
      "rationale": "Emergency fund deadline in 7 months, current pace insufficient",
      "impact": "New savings rate $2,347/mo, timeline ~10 months"
    },
    {
      "type": "opportunity",
      "priority": "low",
      "action": "BTC down 12% this week - potential DCA opportunity",
      "rationale": "Significant weekly drop, aligns with crypto conviction",
      "impact": "Lower priority than emergency fund goal"
    }
  ],
  "market_context": {
    "btc_7d_change": -12.5,
    "sp500_7d_change": -2.1
  },
  "data_freshness": {
    "sofi_snapshots": "2025-12-31",
    "holdings": "2026-01-13",
    "crypto_prices": "live"
  }
}
```

---

## Implementation Phases

| Phase | Scope              | Status       | Deliverables                                       |
| ----- | ------------------ | ------------ | -------------------------------------------------- |
| 1     | Data consolidation | **Complete** | `holdings.json`, `finance holdings` commands       |
| 2     | Aggregator         | **Complete** | `get_unified_portfolio()` function, `finance portfolio` |
| 3     | Analyzer           | **Complete** | Goal analysis, allocation analysis, market context |
| 4     | Advisor            | **Complete** | Recommendation engine, priority logic              |
| 5     | CLI                | **Complete** | `finance advise` with formatted output             |
| 6     | MCP                | **Complete** | `get_financial_advice()` tool                      |

---

## File Changes Summary

### Phase 1 Files (Complete)

| File                       | Purpose                                    |
| -------------------------- | ------------------------------------------ |
| `.config/holdings.json`    | Manual holdings (crypto, bank, other)      |
| `finance/cli/config.py`    | Shared configuration and constants         |
| `finance/cli/formatting.py`| Terminal formatting helpers                |
| `finance/cli/profile.py`   | Financial profile management               |
| `finance/cli/holdings.py`  | Holdings management + CoinGecko API        |
| `finance/cli/snapshots.py` | Snapshot data management                   |
| `finance/cli/templates.py` | Template population functions              |
| `finance/cli/commands.py`  | CLI command handlers                       |
| `finance/cli/finance.py`   | Main CLI entry point (refactored)          |
| `finance/mcp/server.py`    | MCP tools for holdings                     |

### Phase 2 Files (Complete)

| File                       | Purpose                                    |
| -------------------------- | ------------------------------------------ |
| `finance/cli/aggregator.py`| Portfolio aggregation + unified view       |
| `finance/cli/config.py`    | Added category constants                   |
| `finance/cli/commands.py`  | Added `cmd_portfolio()` handler            |
| `finance/cli/finance.py`   | Added `portfolio` subparser                |
| `finance/mcp/server.py`    | Added `get_portfolio()` tool               |

### Phase 3 Files (Complete)

| File                       | Purpose                                    |
| -------------------------- | ------------------------------------------ |
| `finance/cli/analyzer.py`  | Goal/allocation analysis + market context  |
| `finance/cli/config.py`    | Added allocation constants + thresholds    |
| `finance/requirements.txt` | Added yfinance dependency                  |

### Phase 4 & 5 Files (Complete)

| File                       | Purpose                                    |
| -------------------------- | ------------------------------------------ |
| `finance/cli/advisor.py`   | Recommendation engine + priority logic     |
| `finance/cli/config.py`    | Added PRIORITY_THRESHOLDS, TAX_ADVANTAGED_LIMITS |
| `finance/cli/commands.py`  | Added `cmd_advise()` + display helpers     |
| `finance/cli/finance.py`   | Added `advise` subparser                   |

### Phase 6 Files (Complete)

| File                       | Purpose                               |
| -------------------------- | ------------------------------------- |
| `finance/mcp/server.py`    | Added `get_financial_advice()` tool   |

---

## Guardrails (From Planning Template)

These constraints are maintained in the planning template prompt and apply to all recommendations:

- Do not recommend touching wife's individually managed assets
- Treat shared assets as 50/50 ownership
- Do not assume relying on wife's income as backstop
- Risk tolerance: High for long-term holdings
- Crypto conviction: Treat as legitimate asset class, never recommend eliminating

---

## Future Enhancements (Out of Scope)

- API integrations (Coinbase, Plaid)
- Transaction tracking / spending analysis
- Tax lot optimization
- Automated rebalancing execution
- Historical performance charting
- Alert/notification system
