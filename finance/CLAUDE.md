# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Finance CLI and MCP server for parsing brokerage statements, managing financial holdings, generating financial planning prompts, and analyzing credit card expenses. Designed for personal financial tracking with SoFi/Apex Clearing and Chase credit card statements.

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
finance pull                        # Pull ALL statements from Downloads (brokerage + CC, auto-classified)
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
finance plan --advisor              # Generate advisor session with recommendations
finance advise                      # Get prioritized financial recommendations
finance advise --focus goals        # Focus on goal-related recommendations
finance advise --focus rebalance    # Focus on allocation/rebalancing
finance advise --focus spending     # Focus on spending-based recommendations
finance advise --json               # Output as JSON

# Credit card expense analysis
finance expenses                       # Show current month summary
finance expenses import <pdf> [<pdf2>...]  # Import Chase CC statement(s)
finance expenses import <pdf> --no-categorize  # Skip AI categorization
finance expenses summary               # Category breakdown (current month)
finance expenses summary --months 3    # Category breakdown (3 months)
finance expenses history               # List imported CC statements
finance expenses recurring             # Show recurring charges
finance expenses categories            # View merchant->category mappings
finance expenses set-category <merchant> <category>  # Override a category
finance expenses insights              # AI-powered spending insights (cached)
finance expenses insights --months 3   # Analyze last 3 months
finance expenses insights --refresh    # Regenerate (bypass cache)

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
│   ├── session.py      # Advisor session prompt generation (Phase 6)
│   ├── categorizer.py  # Claude API merchant categorization with DB caching
│   ├── insights.py     # AI-powered spending insights with caching
│   ├── recurring.py    # Recurring charge detection across months
│   ├── classifier.py  # Statement type detection (routes to correct parser)
│   ├── parsers/
│   │   ├── sofi_apex.py  # PDF parsing for SoFi/Apex statements
│   │   └── chase_cc.py   # PDF parsing for Chase credit card statements
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
│       ├── projections.py  # Projection history, settings, scenarios (Phase 5)
│       ├── session.py      # GET /api/v1/session (advisor session prompts)
│       └── expenses.py     # Credit card expense + insights endpoints
├── mcp/
│   └── server.py       # FastMCP server wrapping CLI via subprocess
├── templates/
│   ├── FINANCIAL_PLANNING_PROMPT.md  # Planning template (auto-updated)
│   ├── PLANNING_SESSION.md           # Generated planning output
│   ├── ADVISOR_SESSION_PROMPT.md     # Advisor session template reference
│   └── ADVISOR_SESSION.md            # Generated advisor session output
├── finance.sh          # CLI wrapper script
├── finance-api.sh      # API server wrapper script
├── schema_sqlite.sql   # SQLite database schema
└── requirements.txt    # All dependencies (CLI, MCP, API)
```

### Data Flow

1. **Statement Parsing**: PDF → `classifier.py` detects type → `sofi_apex.py` or `chase_cc.py` extracts text with pdfplumber → structured dict
2. **Snapshots**: Brokerage data saved to `.data/finance/snapshots/{date}_{account_type}.json`
3. **CC Transactions**: Credit card data saved to SQLite (`cc_statements`, `cc_transactions` tables)
4. **Template Updates**: Asset values injected into markdown table cells via regex
5. **Planning Prompts**: Template populated with latest snapshots + profile + holdings → clipboard

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

### Chase CC Parser Details

`chase_cc.py` extracts:

- Card type detection (Sapphire Preferred, Reserve, Freedom, etc.)
- Account last four digits from "Account Number" line
- Statement period from "Opening/Closing Date" pattern
- Account summary (previous balance, payments, purchases, fees, interest, new balance, credit limit)
- Individual transactions with date, description, amount, and type (purchase/payment/credit)
- Rewards points (earned this period + available balance)
- Merchant normalization: strips POS prefixes (TST\*, SQ\*, SP, UBER\*, PAYPAL\*, AMAZON.COM\*, etc.) and trailing location/phone data

**Supported card types**: `chase_sapphire_preferred`, `chase_sapphire_reserve`, `chase_freedom_unlimited`, `chase_freedom_flex`, `chase_freedom`, `chase_credit_card`

### Categorizer Module

`categorizer.py` provides AI-powered merchant categorization:

- Uses `anthropic` SDK with `ANTHROPIC_API_KEY` env var
- Model: `claude-haiku-4-5-20251001` (fast/cheap)
- Batch-categorizes uncached merchants in a single API call
- Caches results in `merchant_categories` DB table
- Manual overrides (`confidence='manual'`) take precedence over AI
- Graceful degradation: skips with warning if API key is not set

**Setup**: Set `ANTHROPIC_API_KEY` environment variable:
- Option 1: Create `.env` file in repo root (auto-loaded by `config.py` and `api/main.py`)
- Option 2: Export in shell: `export ANTHROPIC_API_KEY=your-key`
- Get API key from: https://console.anthropic.com/

**Categories**: Dining, Groceries, Transportation, Entertainment, Subscriptions, Shopping, Gas, Travel, Health & Fitness, Utilities, Home & Garden, Personal Care, Other

### Insights Module

`insights.py` provides AI-powered spending insights:

- Uses `anthropic` SDK with `ANTHROPIC_API_KEY` env var
- Model: `claude-haiku-4-5-20251001` (same as categorizer)
- Analyzes category breakdown, month-over-month trends, recurring charges, top merchants, and large transactions
- Returns typed insights: `trend`, `anomaly`, `saving_opportunity`, `pattern`, `warning`
- Each insight has severity: `info`, `moderate`, `important`
- Results cached in `spending_insights` DB table (keyed by `{YYYY-MM}_{N}m`)
- Cache invalidated automatically when new CC statements are imported
- Graceful degradation: returns error dict if API key not set or API call fails

**Entry Point** (`get_spending_insights`):

```python
from insights import get_spending_insights

result = get_spending_insights(months=3, refresh=False)
# Returns: {
#   success: True,
#   insights: [
#     {type: "trend", severity: "moderate", title: "...", description: "...", data: {...}},
#     ...
#   ],
#   generated_at: "2026-01-28T...",
#   months_analyzed: 3,
#   cached: True/False
# }
```

### Recurring Detection Module

`recurring.py` detects recurring charges:

- Groups transactions by `normalized_merchant` across months
- Requires merchant to appear in 2+ distinct months (`RECURRING_MIN_MONTHS`)
- Amount variance must be < 20% (`RECURRING_AMOUNT_VARIANCE`)
- Marks matching transactions with `is_recurring` flag in DB

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
- `spending` - Spending patterns impacting goals (from cached insights)

**Priority Logic**:

- **High**: Goal deadline < 12 months and off-track, allocation drift > 10%, spending threatens surplus or covers full goal shortfall
- **Medium**: Goal behind but deadline > 12 months, drift 5-10%, market opportunity, partial goal acceleration from spending reduction
- **Low**: Informational, no immediate action required, surplus absorbs spending

**Key Functions**:

- `generate_goal_recommendations()` - Creates surplus redirections for behind goals
- `generate_allocation_recommendations()` - Detects drift and suggests rebalancing
- `generate_opportunity_recommendations()` - Converts market dips to DCA suggestions
- `generate_surplus_recommendations()` - Prioritizes surplus: urgent goals → tax-advantaged → drift correction → default split
- `generate_spending_recommendations()` - Converts cached spending insights into goal-connected recommendations

**Entry Point** (`get_advice`):

```python
from advisor import get_advice

result = get_advice(focus="all")  # or "goals", "rebalance", "surplus", "spending"
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

### Session Module (Phase 6)

`session.py` generates comprehensive advisor session prompts combining portfolio data, goals, and recommendations:

**Key Function** (`generate_session_prompt`):

```python
from session import generate_session_prompt

result = generate_session_prompt()
# Returns: {
#   success: True,
#   prompt: "# Financial Advisor Session\n...",  # Full markdown prompt
#   data: {
#     portfolio_summary: {...},
#     goal_status: [...],
#     recommendations: { high: [...], medium: [...], low: [...] },
#     data_freshness: {...},
#     generated_at: "2026-01-19T..."
#   }
# }
```

**Prompt Sections**:

1. **Header** - Generated date
2. **Advisor Context** - Role, philosophy, constraints, communication preferences
3. **Portfolio Snapshot** - Total value, monthly surplus, allocation table
4. **Goal Status** - Each goal with progress, deadline, required pace, status
5. **Recommendations** - Grouped by priority (high/medium/low) with rationale
6. **Spending Patterns** - Notable spending insights and goal impact (omitted if no expense data)
7. **Action Checklist** - Derived from high-priority recommendations
8. **Questions Section** - Placeholder for user input
9. **Data Freshness** - Source dates and staleness warnings

**CLI Usage**:

```bash
finance plan --advisor              # Save to ADVISOR_SESSION.md + copy to clipboard
finance plan --advisor --no-copy    # Only save file
finance plan --advisor --json       # Output structured JSON
```

**Web UI**: Export Session button on advisor page copies markdown to clipboard.

## API Server

FastAPI REST server wrapping CLI modules for the web UI. All endpoints return JSON.

**Start server:** `finance-api` or `finance-api --reload` for development

**Base URL:** `http://localhost:8000/api/v1`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/portfolio` | Unified portfolio view (`?no_prices=true` to skip crypto) |
| GET | `/portfolio/history` | Portfolio value over time by account (`?months=12`) |
| GET | `/holdings` | All holdings with live crypto prices |
| PUT | `/holdings/{category}/{key}` | Update single holding (body: `{value, notes}`) |
| GET | `/holdings/freshness` | Check if holdings data is stale |
| GET | `/profile` | Full financial profile |
| PUT | `/profile` | Replace entire profile |
| PATCH | `/profile/{section}` | Update profile section |
| GET | `/advice` | Financial recommendations (`?focus=goals\|rebalance\|surplus\|spending`) |
| GET | `/statements/history` | Snapshot history (`?account=roth_ira`) |
| POST | `/statements/pull` | Pull statements from Downloads (`?latest=true`) |
| POST | `/statements/import` | Upload multiple PDFs with auto-classification (`?no_categorize=true`) |
| GET | `/projection/history` | Historical portfolio by asset class (`?months=12`) |
| GET | `/projection/settings` | Get projection settings (merged with defaults) |
| PATCH | `/projection/settings` | Update projection settings |
| GET | `/projection/scenarios` | List saved projection scenarios |
| POST | `/projection/scenarios` | Create scenario (`{name, settings, is_primary}`) |
| PATCH | `/projection/scenarios/{id}` | Update scenario |
| DELETE | `/projection/scenarios/{id}` | Delete scenario (cannot delete primary) |
| GET | `/session` | Generate advisor session prompt (`?format=json\|markdown`) |
| GET | `/expenses` | List CC transactions (`?start_date&end_date&category&merchant`) |
| GET | `/expenses/summary` | Category breakdown (`?months=1`) |
| GET | `/expenses/recurring` | Detected recurring charges |
| GET | `/expenses/month-over-month` | Monthly spending comparison (`?months=6`) |
| GET | `/expenses/statements` | List imported CC statements |
| POST | `/expenses/import` | Upload + process CC statement PDF |
| GET | `/expenses/categories` | Merchant→category mappings |
| GET | `/expenses/insights` | AI spending insights (`?months=3`) |
| POST | `/expenses/insights/refresh` | Regenerate insights (`?months=3`) |
| PUT | `/expenses/categories/{merchant}` | Override merchant category |

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
- `cc_statements` - Imported credit card statements (unique on `statement_date, card_type`)
- `cc_transactions` - Individual CC transactions (cascades on statement delete)
- `merchant_categories` - Cached merchant→category mappings (AI or manual)
- `spending_insights` - Cached AI spending insights (keyed by month + analysis window)

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

Key features: Dashboard with net worth history chart, holdings management, profile editor, financial advisor with session export, portfolio projections with interactive controls and scenario management, credit card expense analysis with category charts, recurring charge detection, and statement import.
