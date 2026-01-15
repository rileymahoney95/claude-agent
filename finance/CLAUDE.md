# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Finance CLI and MCP server for parsing brokerage statements, managing financial holdings, and generating financial planning prompts. Designed for personal financial tracking with SoFi/Apex Clearing statements.

## Commands

```bash
# Run CLI (requires venv activation or use wrapper)
./finance.sh <command>

# Or directly with Python
./venv/bin/python cli/finance.py <command>

# Install dependencies
./venv/bin/pip install -r requirements.txt

# Run MCP server
./venv/bin/python mcp/server.py

# Run API server
finance-api                  # Start on port 8000
finance-api --reload         # Start with auto-reload (dev)
finance-api --port 3001      # Custom port
```

### CLI Commands

```bash
finance pull                        # Pull ALL statements from Downloads (main workflow)
finance pull --latest               # Only most recent statement
finance parse <statement.pdf>       # Parse single statement
finance history                     # List snapshots
finance summary                     # Show latest portfolio
finance portfolio                   # Unified view across all accounts
finance portfolio --no-prices       # Skip live crypto price fetch
finance holdings                    # Display holdings with live crypto prices
finance holdings set crypto.BTC 0.5 # Set crypto quantity
finance holdings set bank.hysa 12000 # Set bank balance
finance profile                     # View profile
finance profile --edit              # Edit profile interactively
finance plan                        # Generate planning prompt (clipboard + file)
finance advise                      # Get prioritized financial recommendations
finance advise --focus goals        # Focus on goal-related recommendations
finance advise --focus rebalance    # Focus on allocation/rebalancing
finance advise --json               # Output as JSON

# Database management (SQLite)
finance db status                   # Check database status
finance db migrate                  # Migrate JSON data to SQLite
finance db export                   # Export database to JSON
finance db reset                    # Reset database (delete SQLite file)
```

## Architecture

```
finance/
├── cli/
│   ├── finance.py      # CLI entry point, argparse setup
│   ├── commands.py     # Command handlers (cmd_parse, cmd_pull, cmd_plan, etc.)
│   ├── config.py       # Paths, constants, allocation thresholds
│   ├── database.py     # SQLite connection management + queries
│   ├── aggregator.py   # Portfolio aggregation (unified view across accounts)
│   ├── analyzer.py     # Goal/allocation analysis + market context (Phase 3)
│   ├── advisor.py      # Recommendation engine with priority logic (Phase 4)
│   ├── projections.py  # Projection settings, history, asset class mapping (Phase 5)
│   ├── parsers/
│   │   └── sofi_apex.py  # PDF parsing for SoFi/Apex statements
│   ├── snapshots.py    # Save/load snapshots (JSON or database)
│   ├── holdings.py     # Manual holdings + CoinGecko price fetching
│   ├── profile.py      # User profile management + interactive prompts
│   ├── templates.py    # Template population with regex substitution
│   └── formatting.py   # Terminal output helpers
├── api/
│   ├── main.py         # FastAPI app with CORS middleware
│   └── routes/         # API route handlers
│       ├── portfolio.py    # GET /api/v1/portfolio
│       ├── holdings.py     # GET/PUT /api/v1/holdings
│       ├── profile.py      # GET/PUT/PATCH /api/v1/profile
│       ├── advice.py       # GET /api/v1/advice
│       ├── statements.py   # GET/POST /api/v1/statements
│       └── projections.py  # Projection history, settings, scenarios (Phase 5)
├── mcp/
│   └── server.py       # FastMCP server wrapping CLI via subprocess
├── templates/
│   ├── FINANCIAL_PLANNING_PROMPT.md  # Template (auto-updated)
│   └── PLANNING_SESSION.md           # Generated output
├── finance.sh          # CLI wrapper script
├── finance-api.sh      # API server wrapper script
├── schema_sqlite.sql   # SQLite database schema
└── requirements.txt    # All dependencies (CLI, MCP, API)
```

### Data Flow

1. **Statement Parsing**: PDF → `sofi_apex.py` extracts text with pdfplumber → structured dict
2. **Snapshots**: Parsed data saved to `.data/finance/snapshots/{date}_{account_type}.json`
3. **Template Updates**: Asset values injected into markdown table cells via regex
4. **Planning Prompts**: Template populated with latest snapshots + profile + holdings → clipboard

### Key Patterns

**Config paths** (`config.py`):

- `REPO_ROOT`: Three levels up from config.py
- `SNAPSHOTS_DIR`: `.data/finance/snapshots/`
- `DATABASE_PATH`: `.data/finance/finance.db`
- `PROFILE_PATH`: `.config/finance-profile.json`
- `HOLDINGS_PATH`: `.config/holdings.json`
- `STATEMENTS_DIR`: `personal/finance/statements/`

**MCP server bridges to CLI**: All MCP tools call the CLI with `--json` flag via subprocess, parsing JSON output.

**Account type mapping** (`ACCOUNT_ROW_NAMES`):

- `roth_ira` → "Roth IRA"
- `brokerage` → "Taxable Brokerage (Index)"
- `traditional_ira` → "Traditional IRA"

**Crypto price fetching**: Uses CoinGecko free API with `CRYPTO_ID_MAP` for symbol → ID conversion (BTC → "bitcoin", etc.).

### Statement Parser Details

`sofi_apex.py` extracts:

- Account info from "ACCOUNT NUMBER" and "APEX C/F" patterns
- Portfolio totals from "TOTAL PRICED PORTFOLIO" line
- Holdings from regex matching `SYMBOL C/O QUANTITY PRICE VALUE` patterns
- Income (dividends/interest) from formatted rows
- Aggregates same symbol across C (Cash) and O (On-loan) account types

### Template Population

`templates.py` uses regex substitution to fill:

- Asset table values by matching row names
- Cash flow calculations (computes net surplus)
- Tax situation yes/no fields
- Goals from profile data
- Strips instruction sections for final output

### Analyzer Module (Phase 3)

`analyzer.py` provides analysis functions for the financial advisor:

**Goal Analysis** (`analyze_goals`):

- Calculates progress toward goals with target/deadline
- Computes monthly required vs current surplus
- Returns on_track status and months_at_current_pace
- Goals without targets get qualitative analysis only

**Allocation Analysis** (`analyze_allocation`):

- Compares current allocation to dynamic recommendations
- Baseline: 40% retirement, 20% equities, 25% crypto, 15% cash
- Adjusts for urgent goals (<12 months) and life stage (baby)
- Returns drift percentages and rebalance_needed flag

**Market Context** (`get_market_context`):

- Fetches BTC/ETH prices and 7d/30d changes from CoinGecko
- Fetches S&P 500 data via yfinance (VOO proxy)
- Detects opportunities based on thresholds (-10% crypto, -5% S&P)
- Returns market sentiment (fear/neutral/greed)

**Unified Entry Point** (`get_full_analysis`):

```python
from analyzer import get_full_analysis
from aggregator import get_unified_portfolio
from profile import load_profile

result = get_full_analysis(get_unified_portfolio(), load_profile())
# Returns: { goals, allocation, market, monthly_surplus, total_portfolio_value }
```

**Configuration** (`config.py`):

- `BASELINE_ALLOCATION` - Default allocation percentages
- `ALLOCATION_ADJUSTMENTS` - Boost values for urgent goals
- `OPPORTUNITY_THRESHOLDS` - Drop percentages that trigger signals

### Advisor Module (Phase 4)

`advisor.py` generates prioritized, actionable recommendations:

**Recommendation Types**:

- `surplus` - Where to direct monthly surplus
- `rebalance` - Allocation drift corrections
- `opportunity` - Market dips for DCA
- `warning` - Issues requiring attention

**Priority Logic**:

- **High**: Goal deadline < 12 months and off-track, allocation drift > 10%
- **Medium**: Goal behind but deadline > 12 months, drift 5-10%, market opportunity
- **Low**: Informational, no immediate action required

**Key Functions**:

- `generate_goal_recommendations()` - Creates surplus redirections for behind goals
- `generate_allocation_recommendations()` - Detects drift and suggests rebalancing
- `generate_opportunity_recommendations()` - Converts market dips to DCA suggestions
- `generate_surplus_recommendations()` - Prioritizes surplus: urgent goals → tax-advantaged → drift correction → default split

**Entry Point** (`get_advice`):

```python
from advisor import get_advice

result = get_advice(focus="all")  # or "goals", "rebalance", "surplus"
# Returns: { success, recommendations, summary, portfolio_summary, goal_status, data_freshness }
```

**Configuration** (`config.py`):

- `PRIORITY_THRESHOLDS` - Deadline and drift thresholds for priority levels
- `TAX_ADVANTAGED_LIMITS` - Annual Roth/HSA limits for maxing recommendations

### Projections Module (Phase 5)

`projections.py` provides projection settings management and historical data for Coast FIRE calculations:

**Settings Management**:

- `get_projection_settings()` - Load from profile with defaults merged
- `update_projection_settings(updates)` - Validate and persist settings changes

**Historical Data**:

- `get_historical_portfolio(months)` - Monthly aggregated portfolio data mapped to asset classes
- Supports both JSON files and SQLite database backends
- Returns `{success, data_points: [{date, total_value, by_asset_class}], range}`

**Asset Class Mapping**:

- `map_portfolio_to_asset_classes(portfolio)` - Converts account categories to asset classes
- Maps retirement + taxable_equities → equities, crypto → crypto, cash → cash

**Scenario Validation**:

- `validate_scenario_settings(settings)` - Validates scenario settings structure
- Checks allocation_overrides sum to 100%, return_overrides are 0-50%

**Configuration** (`config.py`):

```python
DEFAULT_EXPECTED_RETURNS = {
    "equities": 7.0,   # Annual % (nominal)
    "bonds": 4.0,
    "crypto": 12.0,
    "cash": 4.5,
}

DEFAULT_PROJECTION_SETTINGS = {
    "expected_returns": DEFAULT_EXPECTED_RETURNS,
    "inflation_rate": 3.0,
    "withdrawal_rate": 4.0,   # SWR for Coast FIRE
    "target_retirement_age": 65,
    "current_age": 32,
}
```

**Scenario Settings Structure**:

```json
{
  "allocation_overrides": {"equities": 60, "bonds": 20, "crypto": 10, "cash": 10},
  "return_overrides": {"equities": 7.0, "bonds": 4.0, "crypto": 12.0, "cash": 4.5},
  "monthly_contribution": 2000,
  "projection_months": 240
}
```

## API Server

FastAPI REST server wrapping CLI modules for the web UI. All endpoints return JSON.

**Start server:** `finance-api` or `finance-api --reload` for development

**Base URL:** `http://localhost:8000/api/v1`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/portfolio` | Unified portfolio view (`?no_prices=true` to skip crypto) |
| GET | `/holdings` | All holdings with live crypto prices |
| PUT | `/holdings/{category}/{key}` | Update single holding (body: `{value, notes}`) |
| GET | `/holdings/freshness` | Check if holdings data is stale |
| GET | `/profile` | Full financial profile |
| PUT | `/profile` | Replace entire profile |
| PATCH | `/profile/{section}` | Update profile section |
| GET | `/advice` | Financial recommendations (`?focus=goals\|rebalance\|surplus`) |
| GET | `/statements/history` | Snapshot history (`?account=roth_ira`) |
| POST | `/statements/pull` | Pull statements from Downloads (`?latest=true`) |
| GET | `/projection/history` | Historical portfolio by asset class (`?months=12`) |
| GET | `/projection/settings` | Get projection settings (merged with defaults) |
| PATCH | `/projection/settings` | Update projection settings |
| GET | `/projection/scenarios` | List saved projection scenarios |
| POST | `/projection/scenarios` | Create scenario (`{name, settings, is_primary}`) |
| PATCH | `/projection/scenarios/{id}` | Update scenario |
| DELETE | `/projection/scenarios/{id}` | Delete scenario (cannot delete primary) |

**OpenAPI docs:** `http://localhost:8000/docs`

**Smoke test:** `./api/test_smoke.sh` (requires server running)

## Database (SQLite)

SQLite database for persistence - no Docker required. Database file is created automatically on first use.

**Database Path:** `.data/finance/finance.db`

### Setup

```bash
finance db migrate            # Initialize database and import existing JSON data
finance db status             # Check database status and table counts
```

### Database Schema

**Tables:**
- `snapshots` - Parsed statement data with JSON holdings
- `holdings` - Manual holdings (crypto, bank, other)
- `profile` - User financial profile (key-value)
- `goals` - Financial goals with targets/deadlines
- `goal_progress` - Monthly goal progress snapshots
- `market_cache` - Cached CoinGecko/yfinance data (15-min TTL)
- `audit_log` - Change tracking for data integrity
- `projection_scenarios` - Saved projection scenarios for what-if analysis

### Key Queries

```sql
-- Latest snapshot per account type (using subquery for SQLite)
SELECT s.* FROM snapshots s
INNER JOIN (
    SELECT account_type, MAX(statement_date) as max_date
    FROM snapshots
    GROUP BY account_type
) latest ON s.account_type = latest.account_type
        AND s.statement_date = latest.max_date;

-- Portfolio value history
SELECT statement_date, SUM(total_value) as total
FROM snapshots GROUP BY statement_date ORDER BY statement_date;

-- Goal progress over time
SELECT * FROM goal_progress WHERE goal_type = 'short_term'
ORDER BY recorded_at;
```

### Dual-Storage Mode

When `USE_DATABASE=true` (default):
- Data is **read from database** when available
- Data is **written to both database AND JSON** (JSON files serve as backup)
- If database read fails, falls back to JSON files

Set `FINANCE_USE_DATABASE=false` to disable SQLite and use only JSON files.

## MCP Server Tools

The MCP server exposes these tools (all call CLI internally):

- `pull_statement` - Batch process from Downloads
- `parse_statement` - Parse single PDF
- `get_finance_history` - List snapshots
- `get_finance_summary` - Latest portfolio
- `get_portfolio` - Unified view across all accounts (Phase 2)
- `generate_planning_prompt` - Create populated prompt
- `get_holdings` / `set_holding` - Manual holdings management
- `check_holdings_freshness` - Stale data warning (>7 days)
- `get_financial_advice` - Prioritized recommendations with focus options (Phase 6)

## Web Client

Next.js 16 + React 19 web application in `web/`. See `web/CLAUDE.md` for detailed architecture and patterns.

```bash
cd web
npm run dev        # Start dev server on port 3000
npm run build      # Production build
npm run test:run   # Run vitest once
```

Key features: Dashboard, holdings management, profile editor, financial advisor, portfolio projections with interactive controls and scenario management.
