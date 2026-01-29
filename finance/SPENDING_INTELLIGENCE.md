# Spending Intelligence

AI-powered spending analysis + expense-aware financial recommendations. Combines spending insights (descriptive) with advisor integration (prescriptive) into a single feature.

Builds on: `SPENDING_INSIGHTS.md` (Phase 1), advisor module (Phase 2)

## Overview

Two outputs from one analysis pass:

1. **Spending Insights** — "Your dining spend is up 40% this month" (displayed on expenses page, CLI)
2. **Advisor Recommendations** — "Reverting to your dining average would free up $150/mo, closing your emergency fund gap 2 months sooner" (displayed in advisor output, planning sessions)

Phase 1 is the insights engine from `SPENDING_INSIGHTS.md`. Phase 2 wires it into the advisor. Both phases share the same data pipeline and `insights.py` module.

---

## Phase 1: Spending Insights (from SPENDING_INSIGHTS.md)

No changes to the existing plan. Summary of what it delivers:

- `cli/insights.py` with `generate_spending_insights(months=3)`
- Claude API call (Haiku) to analyze category trends, anomalies, recurring changes, merchant shifts
- `spending_insights` DB table for caching
- CLI: `finance expenses insights`
- API: `GET /expenses/insights`
- Web: insight cards on expenses page

See `SPENDING_INSIGHTS.md` for full spec.

---

## Phase 2: Advisor Integration

### What Changes

The advisor currently generates recommendations from three data sources:

| Source | Produces |
|--------|----------|
| Goal analysis | "You're behind on emergency fund, increase contributions" |
| Allocation analysis | "Crypto is 5% over target, rebalance" |
| Market context | "ETH is down 15% this week, DCA opportunity" |

Phase 2 adds a fourth:

| Source | Produces |
|--------|----------|
| **Spending analysis** | "Dining is up $150/mo — redirecting that closes your emergency fund gap 2 months sooner" |

### New Recommendation Type

Add `spending` to the existing recommendation types in `advisor.py`:

```python
# Existing types: surplus, rebalance, opportunity, warning
# New type:
"spending"  # Expense-driven optimization suggestions
```

### New Function: `generate_spending_recommendations()`

Added to `advisor.py`, called alongside the existing generators:

```python
def generate_spending_recommendations(
    insights: list[dict],
    profile: dict,
    analysis: dict
) -> list[Recommendation]:
    """Generate recommendations by connecting spending insights to financial goals."""
```

This function does NOT call Claude. It takes the already-generated insights from Phase 1 and maps them to goals/surplus using deterministic logic:

**Logic:**

1. Filter insights to `notable` or `important` severity
2. For each insight with a quantifiable delta (e.g., category up $X/mo):
   - Check if any goal is behind schedule
   - Calculate how the delta would affect goal timeline if redirected
   - Generate a recommendation connecting the two

**Example mappings:**

| Insight | Goal Context | Recommendation |
|---------|-------------|----------------|
| Dining up $150/mo vs average | Emergency fund behind schedule | "Reverting dining to your 3-month average frees $150/mo, putting emergency fund on track by August" |
| 3 new subscriptions ($45/mo) | Any active goal | "Review 3 new subscriptions totaling $45/mo — that's $540/yr toward [nearest goal]" |
| Grocery merchant shift +$80/mo | Surplus is positive | "Grocery spending increased $80/mo after shifting to Whole Foods — no action needed given current surplus, but worth monitoring" |
| Overall spending up 20% | Negative surplus | "Spending increased 20% this month, pushing cash flow negative. Largest increases: Dining (+$150), Shopping (+$90)" |

**Priority assignment:**

- `high` — Spending change pushes surplus negative or makes a goal miss its deadline
- `medium` — Quantifiable savings opportunity that would accelerate an existing goal
- `low` — Notable pattern worth monitoring but no immediate action needed

### Changes to Existing Advisor Flow

In `advisor.py` `generate_recommendations()`:

```python
def generate_recommendations(portfolio, profile, analysis=None, include_market=True):
    recommendations = []

    # Existing generators
    recommendations.extend(generate_goal_recommendations(...))
    recommendations.extend(generate_allocation_recommendations(...))
    if include_market:
        recommendations.extend(generate_opportunity_recommendations(...))
    recommendations.extend(generate_surplus_recommendations(...))

    # NEW: spending-aware recommendations
    insights = get_cached_insights()  # from spending_insights table
    if insights:
        recommendations.extend(generate_spending_recommendations(
            insights, profile, analysis
        ))

    recommendations.sort(key=lambda r: PRIORITY_ORDER[r.priority])
    return recommendations
```

The spending recommendations are **additive** — they don't change existing recommendation logic, they add a new source. If no insights are cached (no expense data imported), this is a no-op.

### Changes to Session Prompt

In `session.py`, add a new section to the advisor session output:

```markdown
## Spending Patterns

[Only included if spending insights exist]

**Notable this month:**
- Dining spending up 40% vs 3-month average ($380 → $530)
- 2 new recurring charges added (CURSOR $20/mo, CLAUDE PRO $20/mo)

**Impact on goals:**
- Reverting dining to average would free $150/mo → emergency fund on track 2 months sooner
```

This gives the Claude planning session context about spending patterns alongside portfolio data.

### API Changes

No new endpoints needed. The existing endpoints already return recommendations:

- `GET /api/v1/advice` — will include `spending` type recommendations automatically
- `GET /api/v1/expenses/insights` — already added in Phase 1
- `GET /api/v1/session` — will include spending section in prompt automatically

### Web UI Changes

No new pages. The advisor/dashboard already renders recommendations by type — `spending` type recs will appear with their own icon/color alongside existing `surplus`, `rebalance`, `opportunity`, and `warning` types.

### CLI Changes

No new commands. `finance advise` will include spending recommendations automatically. Add a focus filter:

```bash
finance advise --focus spending    # Show only expense-driven recommendations
```

---

## Data Flow

```
                    Phase 1                              Phase 2
                    ───────                              ───────

cc_transactions ──→ insights.py ──→ Claude API ──→ Typed Insights
                        │                              │
                        │                              ├──→ spending_insights table
                        │                              ├──→ CLI: finance expenses insights
                        │                              ├──→ API: GET /expenses/insights
                        │                              ├──→ Web: insight cards
                        │                              │
                        │                              └──→ advisor.py
                        │                                      │
                        │                              goals + surplus context
                        │                                      │
                        │                              generate_spending_recommendations()
                        │                                      │
                        │                              ├──→ CLI: finance advise
                        │                              ├──→ API: GET /advice
                        │                              └──→ Session prompt
```

---

## Build Order

### Phase 1 (Spending Insights)
1. `spending_insights` table in schema
2. `cli/insights.py` — data assembly, prompt, Claude API call, caching
3. CLI: `finance expenses insights` command
4. API: `GET /expenses/insights` endpoint
5. Web: insight cards on expenses page

### Phase 2 (Advisor Integration)
6. `generate_spending_recommendations()` in `advisor.py`
7. Wire into `generate_recommendations()` flow
8. Add spending section to `session.py` prompt output
9. Add `--focus spending` filter to CLI
10. Test end-to-end: import statement → insights generated → advisor picks them up

Phase 2 depends on Phase 1 being complete. Each phase is independently shippable — Phase 1 has standalone value without the advisor integration.

---

## What Claude Does vs What Code Does

Important boundary: Claude is used for **pattern recognition and narrative**, not for math or financial logic.

| Task | Owner | Why |
|------|-------|-----|
| Calculate category averages, deltas, trends | Python | Deterministic, must be accurate |
| Detect anomalous transactions (>3x avg) | Python | Simple threshold check |
| Identify new/lost recurring charges | Python | Diff between months |
| Synthesize patterns into natural-language insights | Claude API | Good at narrative from structured data |
| Map insights to goals/recommendations | Python | Deterministic, uses profile data |
| Priority assignment | Python | Rule-based, must be consistent |

Claude sees numbers and produces narrative. Python does all the financial logic.

---

## Implementation Plan

Two sessions, each independently shippable.

### Session 1: Spending Insights Engine

**Scope:** Build the complete insights pipeline from expense data to user-facing output.

**Deliverables:**

1. **Schema** — Add `spending_insights` table to `schema_sqlite.sql`
   - Columns: `id`, `month`, `insights_json`, `generated_at`, `input_hash`
   - Index on `month` for fast lookup

2. **Core Module** — `cli/insights.py`
   - `generate_spending_insights(months=3)` — main entry point
   - Aggregates category spending, calculates averages/deltas
   - Builds prompt with structured spending data
   - Calls Claude API (Haiku) for narrative insights
   - Parses response into typed insight objects
   - Caches results to DB with input hash for invalidation

3. **CLI** — `finance expenses insights`
   - `--months N` — analysis window (default 3)
   - `--refresh` — bypass cache, regenerate
   - `--json` — machine-readable output
   - Pretty-prints insights with severity indicators

4. **API** — `GET /api/v1/expenses/insights`
   - Query params: `months`, `refresh`
   - Returns cached insights or generates fresh
   - 200 with insights array, 404 if no expense data

5. **Web** — Insight cards on expenses page
   - Fetch from `/expenses/insights` on page load
   - Render as cards with severity-based styling (info/warning/important)
   - Loading state, empty state, error handling

**Acceptance Criteria:**
- [ ] `finance expenses insights` returns AI-generated insights from expense data
- [ ] Insights are cached and reused on subsequent calls
- [ ] `--refresh` forces regeneration
- [ ] API endpoint returns same data as CLI
- [ ] Web UI displays insight cards with appropriate styling

---

### Session 2: Advisor Integration

**Scope:** Wire spending insights into the advisor recommendation engine.

**Deliverables:**

1. **Recommendation Generator** — `generate_spending_recommendations()` in `advisor.py`
   - Takes insights from Phase 1 + profile + goal analysis
   - Filters to `notable`/`important` severity
   - Maps quantifiable deltas to goal impact (deterministic logic, no API call)
   - Returns `Recommendation` objects with type `"spending"`

2. **Advisor Wiring** — Update `generate_recommendations()` in `advisor.py`
   - Call `get_cached_insights()` from insights module
   - If insights exist, call `generate_spending_recommendations()`
   - Merge into recommendation list, sort by priority
   - No-op if no expense data imported

3. **Session Prompt** — Add spending section to `session.py`
   - New "Spending Patterns" section in advisor session output
   - Include notable patterns and goal impact
   - Only included if insights exist

4. **CLI Filter** — Add `--focus spending` to `finance advise`
   - Filters to show only expense-driven recommendations
   - Works alongside existing `--focus goals|rebalance|surplus`

5. **End-to-End Test**
   - Import CC statement → insights auto-generated or cached
   - Run `finance advise` → spending recommendations appear
   - Run `finance plan --advisor` → spending section in prompt

**Acceptance Criteria:**
- [ ] `finance advise` includes spending-type recommendations when insights exist
- [ ] `finance advise --focus spending` shows only expense-driven recs
- [ ] `finance plan --advisor` includes "Spending Patterns" section
- [ ] Recommendations correctly map spending changes to goal timelines
- [ ] No spending recommendations appear when no expense data exists

---

### Dependencies

```
Session 1 ────────────────────→ Session 2
(Insights Engine)              (Advisor Integration)
                                    │
                               Requires insights
                               from Session 1
```

Session 2 cannot start until Session 1 is complete. Each session is independently shippable — Session 1 provides standalone value without advisor integration.

---

## Cost

Same as Phase 1 estimate — ~$0.004 per analysis, cached per month. Phase 2 adds zero API cost (deterministic logic only).
