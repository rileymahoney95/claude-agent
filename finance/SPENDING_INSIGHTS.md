# Spending Insights & Anomaly Detection

AI-powered analysis of credit card spending patterns using the Claude API.

## Concept

After importing a credit card statement, Claude analyzes multi-month transaction data and generates a natural-language spending report. This surfaces patterns that aren't obvious from category totals and pie charts alone — trend changes, anomalies, subscription creep, and merchant shifts.

## What It Produces

A set of typed insights, each with a category, description, and severity:

- **Trend Changes** — "Dining spending increased 40% this month vs your 3-month average ($380 → $530)"
- **Anomalies** — "Unusual $450 charge at BEST BUY — your typical Shopping transaction is under $60"
- **Subscription Creep** — "You added 2 new recurring charges this month (CURSOR, CLAUDE PRO), bringing monthly subscriptions to $85"
- **Merchant Shifts** — "Grocery spending shifted from TRADER JOES (avg $180/mo) to WHOLE FOODS (avg $260/mo) over the last 3 months"
- **Category Milestones** — "Transportation spending hit a 6-month high this month ($320)"

## Data Available for Analysis

All of this is already queryable from the database:

| Data | Source | Endpoint |
|------|--------|----------|
| Individual transactions | `cc_transactions` table | `GET /expenses` |
| Category breakdown (N months) | `get_expense_summary(months)` | `GET /expenses/summary` |
| Monthly totals | `get_month_over_month(months)` | `GET /expenses/month-over-month` |
| Recurring charges | `detect_recurring()` | `GET /expenses/recurring` |
| Merchant→category mappings | `merchant_categories` table | `GET /expenses/categories` |

No new data collection needed — this is purely analysis of what's already stored.

## Implementation

### Files to Create
- `finance/cli/insights.py` — Core insight generation module

### Files to Modify
- `finance/schema_sqlite.sql` — Add `spending_insights` cache table
- `finance/cli/database.py` — Add cache functions (get/save/invalidate)
- `finance/cli/commands.py` — Add `_cmd_expenses_insights` handler
- `finance/cli/finance.py` — Add `insights` subparser (line ~159, before `db` parser)
- `finance/api/routes/expenses.py` — Add GET/POST insight endpoints
- `finance/web/src/lib/types.ts` — Add `SpendingInsight`, `SpendingInsightsResponse`
- `finance/web/src/lib/api.ts` — Add `getSpendingInsights`, `refreshSpendingInsights`
- `finance/web/src/lib/hooks/use-expenses.ts` — Add `useSpendingInsights`, `useRefreshInsights` hooks
- `finance/web/src/components/expenses/insight-cards.tsx` — New component (create)
- `finance/web/src/components/expenses/index.ts` — Add barrel export
- `finance/web/src/app/expenses/page.tsx` — Wire InsightCards between summary cards and charts

---

### Step 1: Schema — `spending_insights` table

Add to `schema_sqlite.sql`:

```sql
CREATE TABLE IF NOT EXISTS spending_insights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    month_key TEXT NOT NULL UNIQUE,
    months_analyzed INTEGER NOT NULL,
    insights_json TEXT NOT NULL,
    generated_at TEXT NOT NULL DEFAULT (datetime('now')),
    model TEXT NOT NULL
);
```

### Step 2: Database functions in `database.py`

Add three functions:
- `get_cached_insights(month_key: str) -> dict | None` — Query by month_key, return parsed JSON or None
- `save_insights(month_key: str, months: int, insights: list, model: str)` — INSERT OR REPLACE
- `invalidate_insights_cache() -> int` — DELETE all rows, return count

Add `"spending_insights"` to `get_table_counts()`.

### Step 3: Core module — `finance/cli/insights.py`

Main function: `get_spending_insights(months=3, refresh=False) -> dict`

Flow:
1. Compute `month_key` = `f"{current_YYYY_MM}_{months}m"`
2. Check cache via `get_cached_insights()` unless `refresh=True`
3. Gather data from existing DB functions:
   - `get_expense_summary(months)` — category totals
   - `get_month_over_month(months)` — monthly trend
   - `detect_recurring()` — subscription data
   - `get_cc_transactions(txn_type="purchase")` — for outlier detection
4. Build structured prompt with spending data
5. Call Claude API (`claude-haiku-4-5-20251001`, same as categorizer)
6. Parse JSON response, validate each insight has: type, severity, title, description, data
7. Cache result via `save_insights()`
8. Return `{"success": True, "insights": [...], "generated_at": "...", "months_analyzed": N, "cached": False}`

**Prompt structure:**

Give Claude the numbers and ask for specific insight types. The prompt includes:
- Current month category breakdown vs prior month(s) averages
- Top merchants per category with month-over-month changes
- New and lost recurring charges
- Any single transaction that's >3x the category average
- Monthly totals trend

Claude returns structured JSON (not free-form text) so insights can be displayed as typed cards in the UI.

System prompt: "You are a personal finance analyst." Ask for 3-7 typed insights as a JSON array.

**Caching:** Store generated insights in a `spending_insights` table keyed by month_key. Regenerate when new transactions are imported for that month, otherwise serve cached results.

### Step 4: CLI command

In `finance.py` (line ~159, before db parser): Add `insights` subparser with `--months`, `--refresh`, `--json` args.

```bash
finance expenses insights              # Show AI insights for current month
finance expenses insights --months 3   # Analyze across 3 months
finance expenses insights --refresh    # Force regeneration
```

In `commands.py` (line ~1149): Add `elif subcmd == 'insights': return _cmd_expenses_insights(args)`.

Handler `_cmd_expenses_insights`: Calls `get_spending_insights()`, prints colored output with severity icons (`[!]` red, `[*]` yellow, `[i]` cyan) or JSON.

Cache invalidation: Add `invalidate_insights_cache()` call at end of `_cmd_expenses_import` after successful import.

### Step 5: API endpoints in `routes/expenses.py`

```
GET  /api/v1/expenses/insights?months=3      # Get insights (cached or generate)
POST /api/v1/expenses/insights/refresh?months=3  # Force regeneration
```

Both call `get_spending_insights()` with appropriate `refresh` flag. No new router file needed.

### Step 6: Web UI

**Types** (`types.ts`):

```typescript
interface SpendingInsight {
  type: 'trend_change' | 'anomaly' | 'subscription_creep' | 'merchant_shift' | 'milestone';
  severity: 'info' | 'notable' | 'important';
  title: string;
  description: string;
  data: Record<string, unknown>;
}

interface SpendingInsightsResponse {
  success: boolean;
  insights: SpendingInsight[];
  generated_at: string;
  months_analyzed: number;
  cached: boolean;
}
```

**API functions** (`api.ts`): `getSpendingInsights(months)` and `refreshSpendingInsights(months)`.

**Hooks** (`use-expenses.ts`): `useSpendingInsights(months)` query hook + `useRefreshInsights()` mutation. Add `spending-insights` invalidation to `useImportStatement`.

**Component** (`insight-cards.tsx`): Card with list of insight rows. Each row shows:
- Icon based on type (trend, anomaly, subscription, etc.)
- Title text (bold)
- Severity badge (info/notable/important)
- Description text

Header includes a "Refresh" button. Component returns `null` when no insights available.

**Page** (`page.tsx`): Add InsightCards between `ExpenseSummaryCards` (line 77) and Charts Row (line 80). No new page needed — fits naturally into the existing layout.

## Insight Object Shape

```json
{
  "type": "trend_change | anomaly | subscription_creep | merchant_shift | milestone",
  "severity": "info | notable | important",
  "title": "Dining Up 40%",
  "description": "Dining spending increased from $380/mo average to $530 this month.",
  "data": {
    "category": "Dining",
    "current": 530,
    "average": 380,
    "change_pct": 39.5
  }
}
```

## Cost Estimate

- Haiku is ~$0.80/M input tokens, ~$4/M output tokens
- A typical month's data (50-100 transactions + summaries) is ~2K input tokens
- Structured output is ~500 tokens
- **Cost per analysis: ~$0.004** (less than half a cent)
- Cached per month, so re-viewing is free

## Verification

1. **CLI**: `finance expenses insights --months 3` — should generate and display insights
2. **CLI cache**: Run again — should serve cached result (check "Cached from..." message)
3. **CLI refresh**: `finance expenses insights --refresh` — should regenerate
4. **CLI JSON**: `finance expenses insights --json` — should output valid JSON
5. **API**: `curl localhost:8000/api/v1/expenses/insights?months=3` — should return JSON response
6. **API refresh**: `curl -X POST localhost:8000/api/v1/expenses/insights/refresh?months=3`
7. **Web**: Open expenses page — InsightCards should appear between summary and charts
8. **Web refresh**: Click "Refresh" button — should regenerate insights
9. **Cache invalidation**: Import a new statement, then check insights are regenerated
