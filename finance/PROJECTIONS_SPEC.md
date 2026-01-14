# Portfolio Projections Feature Spec

> **Status**: Phase 1 Complete (Backend Foundation)
> **Target**: Coast FIRE calculation + interactive portfolio projections
> **Approach**: Client-side calculation engine for instant interactivity

---

## Overview

A projection feature that shows historical portfolio growth leading into forward projections, with:

- **Coast FIRE calculation**: When can you stop contributing and still hit retirement target?
- **Adjustable parameters**: Time horizon, expected returns, allocation tweaks
- **Comparison mode**: Overlay current allocation vs. scenario
- **Saved scenarios**: Primary plan + named alternates for what-if analysis

### Critical Modeling Conventions (Major correctness requirement)

To avoid projections that "look right" but are mathematically or semantically wrong, the feature must enforce a single set of conventions:

- **Return units**: expected returns are stored/edited as **annual percent values** (e.g., `7.0` means 7%).
- **Nominal vs real**: expected returns are treated as **nominal** returns. `inflation_rate` is used only for "inflation-adjusted" display (and later, contribution growth).
- **Compounding**: monthly return is computed via **compounded conversion**, not `annual/12`:
  - \( r\_{a} = \frac{\text{annualPercent}}{100} \)
  - \( r*{m} = (1 + r*{a})^{1/12} - 1 \)
- **Model basis**: allocation + returns apply to **asset classes**, not account wrappers.
  - Account categories like "retirement" vs "taxable" should not have different return assumptions by default.

### Key Design Decisions

| Decision             | Choice                             | Rationale                              |
| -------------------- | ---------------------------------- | -------------------------------------- |
| Calculation location | **Client-side**                    | Instant slider updates, no API latency |
| Coast FIRE target    | **Derived from long-term goal**    | Uses existing goal system + SWR        |
| Age configuration    | **Set once in config**             | Avoid repeated prompts                 |
| Chart X-axis         | **Age (primary)**, date in tooltip | More intuitive for FIRE planning       |
| Historical depth     | **12 months** or available data    | Reasonable context without clutter     |

---

## Phase 1: Backend Foundation

**Goal**: All backend infrastructure—config, database, and API endpoints—testable via curl/Swagger before any frontend work.

### 1.1 Config Changes

Add to `cli/config.py`:

```python
# Default expected returns by ASSET CLASS (annual %, nominal)
DEFAULT_EXPECTED_RETURNS = {
    "equities": 7.0,         # broad equities assumption
    "bonds": 4.0,            # conservative fixed income assumption
    "crypto": 12.0,          # Higher risk/reward
    "cash": 4.5,             # Current HYSA rates
}

# Default projection settings
DEFAULT_PROJECTION_SETTINGS = {
    "expected_returns": DEFAULT_EXPECTED_RETURNS,
    "inflation_rate": 3.0,
    "withdrawal_rate": 4.0,   # Safe withdrawal rate for Coast FIRE
    "target_retirement_age": 65,
    "current_age": 32,        # User sets once
}
```

Update `DEFAULT_PROFILE` to include:

```python
"projection_settings": DEFAULT_PROJECTION_SETTINGS,
```

### 1.2 Database Schema

Add to `schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS projection_scenarios (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    is_primary BOOLEAN DEFAULT FALSE,
    settings JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settings JSONB structure:
-- {
--   "allocation_overrides": { "equities": 60, "bonds": 20, "cash": 10, "crypto": 10 } | null,
--   "return_overrides": { "equities": 7.0, "bonds": 4.0, "cash": 4.5, "crypto": 12.0 } | null,
--   "monthly_contribution": 2000 | null,
--   "projection_months": 240
-- }
```

### 1.3 API: Historical Data Endpoint

**Endpoint**: `GET /api/v1/projection/history`

**Purpose**: Expose historical portfolio snapshots for chart

**Query params**:

- `months` (optional, default 12): How many months of history

**Response**:

```json
{
  "success": true,
  "data_points": [
    {
      "date": "2025-06-15",
      "total_value": 45000,
      "by_asset_class": {
        "equities": 26000,
        "bonds": 0,
        "crypto": 12000,
        "cash": 7000
      }
    }
  ],
  "range": {
    "start": "2025-01-15",
    "end": "2026-01-14"
  }
}
```

**Implementation notes**:

- Leverage existing `database.py:get_portfolio_history()` or build from snapshots
- Aggregate by month if multiple snapshots exist
- **Do not linear-interpolate portfolio value** (it fabricates performance).
  - Prefer **carry-forward** last-known value and include a `is_carried_forward`/`is_estimated` flag if you want to visually indicate missing months.
  - Alternatively, omit missing months entirely for v1.
- If the underlying system only has account categories, map them into asset classes consistently (e.g., `retirement + taxable_equities -> equities`, `cash -> cash`, `crypto -> crypto`, bonds default to 0 until tracked).

### 1.4 API: Projection Settings Endpoints

**GET `/api/v1/projection/settings`**

- Returns current projection settings from profile
- Merges with defaults for any missing fields

**PATCH `/api/v1/projection/settings`**

- Updates projection settings in profile
- Validates return percentages (0-50% reasonable range)

### 1.5 API: Scenarios CRUD

**GET `/api/v1/projection/scenarios`**

- Returns list of saved scenarios
- Primary scenario marked with `is_primary: true`

**POST `/api/v1/projection/scenarios`**

- Body: `{ name, settings, is_primary? }`
- Creates new scenario
- If `is_primary: true`, unset other primaries

**PATCH `/api/v1/projection/scenarios/{id}`**

- Update scenario name or settings

**DELETE `/api/v1/projection/scenarios/{id}`**

- Cannot delete if `is_primary: true` (must reassign first)

### 1.6 CLI Helper Module

Create `cli/projections.py`:

- `get_projection_settings()` - load from profile with defaults
- `update_projection_settings(updates)` - validate and persist
- `map_portfolio_to_asset_classes(portfolio)` - account categories → asset classes

---

## Phase 2: Client Projection Engine

**Goal**: Pure TypeScript calculation logic, fully unit-testable before wiring to UI.

### 2.1 Core Types

Create `web/src/lib/projection.ts`:

```typescript
interface ProjectionSettings {
  expectedReturns: Record<string, number>; // asset_class → annual % (e.g., 7.0 means 7%)
  inflationRate: number;
  withdrawalRate: number;
  targetRetirementAge: number;
  currentAge: number;
}

interface ProjectionInput {
  currentPortfolio: Portfolio;
  settings: ProjectionSettings;
  monthlyContribution: number;
  allocationOverrides?: Record<string, number>;
  returnOverrides?: Record<string, number>;
  projectionMonths: number;
}

interface ProjectionPoint {
  date: string;
  monthIndex: number;
  age: number;
  totalValue: number;
  byAssetClass: Record<string, number>;
  inflationAdjustedValue: number;
  isHistorical: boolean;
}

interface CoastFireResult {
  targetPortfolio: number; // Portfolio needed today to coast
  retirementTarget: number; // What you need at retirement
  achievedDate: string | null;
  achievedAge: number | null;
  monthsUntil: number | null;
  alreadyCoasted: boolean;
}

interface Milestone {
  type: 'coast_fire' | 'goal_deadline' | 'retirement';
  date: string;
  age: number;
  label: string;
  value?: number;
}

interface ProjectionResult {
  dataPoints: ProjectionPoint[];
  coastFire: CoastFireResult;
  finalValue: number;
  finalInflationAdjusted: number;
  milestones: Milestone[];
}
```

### 2.2 Core Functions

```typescript
export function calculateProjection(input: ProjectionInput): ProjectionResult;
export function calculateCoastFire(
  settings: ProjectionSettings,
  currentValue: number,
  allocation: Record<string, number> // asset_class → % (must sum to 100)
): CoastFireResult;
export function calculateBlendedReturn(
  returns: Record<string, number>,
  allocation: Record<string, number>
): number;
```

### 2.3 Calculation Approach

1. Initialize asset-class values from current portfolio (or mapped categories)
2. For each month in projection:
   - Convert annual % to decimal: `rAnnual = annualPercent / 100`
   - Compute monthly compounded rate: `rMonthly = (1 + rAnnual) ** (1/12) - 1`
   - Apply monthly return per asset class: `value *= (1 + rMonthly)`
   - Add monthly contribution split by allocation
3. Calculate Coast FIRE target (see Phase 3)
4. Find crossing point where projection exceeds Coast FIRE target
5. Build milestones from Coast FIRE date + goal deadlines

### 2.4 Unit Tests

Create `web/src/lib/__tests__/projection.test.ts`:

- [ ] Compounding math: $10,000 at 7% for 10 years → $19,671.51
- [ ] Blended return: 60% equities (7%) + 40% bonds (4%) → 5.8%
- [ ] Coast FIRE: with $50k spending goal, 4% SWR, 7% return, 30 years → correct target
- [ ] Edge cases: 0% return, 100% single asset class, negative months

---

## Phase 3: Basic UI

**Goal**: Minimal working page with chart and Coast FIRE display.

### 3.1 Projections Page

Create `web/src/app/projections/page.tsx`:

- Fetch portfolio, profile, and history on load
- Initialize projection state with defaults
- Render chart with combined historical + projected data
- Basic stats card: final value, Coast FIRE status

### 3.2 Projection Chart

Create `web/src/components/projections/projection-chart.tsx`:

- Use Recharts `ComposedChart` with `Area` (stacked) + `ReferenceLine`
- Historical data points marked with `isHistorical: true`
- Visual distinction: solid fill for history, gradient/lighter for projection
- X-axis: Age (derived from `currentAge + monthIndex/12`)
- Y-axis: Currency formatted
- Tooltip: Date, age, total value, asset-class breakdown

### 3.3 Coast FIRE Card

Create `web/src/components/projections/coast-fire-card.tsx`:

Display:

- **Target Portfolio**: Amount needed today to coast (derived from long-term goal)
- **Retirement Target**: Portfolio target at retirement (derived via SWR if goal is annual spending)
- **Status**: "Achieved" / "X years away" / "On track by age Y"
- **Visual**: Progress bar or similar

Coast FIRE derivation:

```typescript
// IMPORTANT: Define what the long-term goal represents.
// Recommended: long_term.target is ANNUAL RETIREMENT SPENDING (in today's dollars).
// Then retirement portfolio target is spending / withdrawalRate (SWR).
const annualSpendingGoal = profile.goals.long_term.target;
const withdrawalRate = settings.withdrawalRate / 100;
const retirementTarget = annualSpendingGoal / withdrawalRate;

// Blended annual return based on current/target allocation
const blendedReturn = calculateBlendedReturn(
  settings.expectedReturns,
  allocation
);

// Years until retirement
const yearsToRetirement = settings.targetRetirementAge - settings.currentAge;

// Coast FIRE target = what you need TODAY to hit retirement target with $0 contributions
const coastFireTarget =
  retirementTarget / Math.pow(1 + blendedReturn, yearsToRetirement);
```

**Note**: if the existing goals system cannot represent "annual spending", add a `goal_kind` for long-term:

- `goal_kind: "portfolio_target" | "annual_spend"`

This is a major correctness improvement because it makes SWR meaningful and prevents incorrect Coast FIRE math.

### 3.4 Navigation

Add "Projections" link to sidebar (`components/layout/sidebar.tsx`)

---

## Phase 4: Interactivity

**Goal**: Sliders for real-time projection tweaking.

### 4.1 Time Horizon Control

Create `web/src/components/projections/time-horizon-slider.tsx`:

- Range: 5-40 years (60-480 months)
- Default: 20 years
- Shows projected end age in label
- Checkbox toggle: "Show inflation-adjusted values"

### 4.2 Expected Return Sliders

Create `web/src/components/projections/return-sliders.tsx`:

- One slider per asset class (equities, bonds, crypto, cash)
- Range: 0-25% (reasonable bounds)
- Shows current value and default in parentheses
- "Reset to defaults" button
- Immediate chart update on drag

### 4.3 Allocation Sliders

Create `web/src/components/projections/allocation-sliders.tsx`:

- One slider per asset class
- Constrained to sum to 100% (adjust others proportionally)
- "Lock to current allocation" checkbox (disables sliders, uses portfolio allocation)
- Visual indicator when allocation differs from current

### 4.4 Monthly Contribution Input

- Number input for monthly contribution override
- Default: calculated monthly surplus from profile
- Affects projection but not Coast FIRE target calculation

**Future improvement**: design for contribution policies, not just a single number

Even a simple "stop contributing after Coast FIRE" toggle meaningfully changes the plan. The scenario/settings schema should be shaped so a v2 can add:

- contribute until date/age
- contributions grow with inflation or wage growth
- retirement-first then taxable routing

### 4.5 Milestone Markers

Add to chart:

- **Coast FIRE line**: Vertical dashed line at achievement date
- **Goal deadlines**: From profile goals (short/medium/long-term)
- **Retirement age**: Vertical line at target retirement

Use Recharts `ReferenceLine` with custom label components.

### 4.6 Projection Hook

Create `web/src/lib/hooks/use-projection.ts`:

```typescript
export function useProjection() {
  // Fetched data
  const { data: portfolio } = usePortfolio();
  const { data: profile } = useProfile();
  const { data: history } = useProjectionHistory();

  // Local state (no API calls on change)
  const [projectionMonths, setProjectionMonths] = useState(240);
  const [returnOverrides, setReturnOverrides] = useState<Record<string, number> | null>(null);
  const [allocationOverrides, setAllocationOverrides] = useState<Record<string, number> | null>(null);
  const [monthlyContribution, setMonthlyContribution] = useState<number | null>(null);
  const [showInflationAdjusted, setShowInflationAdjusted] = useState(false);

  // Memoized calculation
  const projection = useMemo(() => { ... }, [dependencies]);

  // Combined chart data
  const chartData = useMemo(() => { ... }, [history, projection]);

  return {
    projection,
    chartData,
    controls: { ... },
    reset: () => { ... },
    isLoading,
    error,
  };
}
```

---

## Phase 5: Scenarios UI

**Goal**: Save and compare projection scenarios.

### 5.1 Scenario Selector

Create `web/src/components/projections/scenario-selector.tsx`:

- Dropdown/tabs showing saved scenarios
- "Current" always available (unsaved state)
- Primary scenario indicated with star/badge
- "Compare" toggle to overlay scenario on chart

### 5.2 Save Scenario Dialog

Create `web/src/components/projections/save-scenario-dialog.tsx`:

- Modal triggered by "Save Scenario" button
- Input: scenario name
- Checkbox: "Set as primary plan"
- Saves current slider state as scenario

### 5.3 Comparison Mode

When comparison enabled:

- Run projection twice: current settings + selected scenario
- Chart shows:
  - Stacked area for current projection (solid)
  - Dashed line for scenario total (overlay)
- Legend indicates which is which
- Tooltip shows both values

### 5.4 Primary Plan Auto-Update

The "Primary" scenario represents the user's intended plan:

- Updates portfolio value automatically (from latest data)
- Retains allocation/return overrides from saved settings
- Shown as default when page loads

---

## Phase 6: Polish

**Goal**: UX refinements and additional features.

### 6.1 Responsive Design

- Tablet: Stack controls below chart
- Mobile: Consider simpler view or defer

### 6.2 Keyboard Shortcuts

- Arrow keys for focused slider adjustment
- Number input for precise values
- Escape to reset

### 6.3 Export Options

- "Export as PNG" button for chart
- "Export data as CSV" for projection points

### 6.4 Goal Integration

- Link from Coast FIRE card to profile goals editor
- Show goal progress within projection context
- Alert if Coast FIRE target exceeds stated long-term goal

### 6.5 Settings Persistence

- Save last-used time horizon in localStorage
- Remember inflation-adjusted toggle preference

### 6.6 Uncertainty Bands (Major Improvement)

Deterministic projections create false precision. Add an uncertainty model that returns bands:

- Monte Carlo simulation over monthly steps (asset-class returns with volatility).
- Render P10/P50/P90 bands and expose:
  - probability of Coast FIRE by age X
  - probability of retirement target by age Y

---

## UI Wireframe

```
┌─────────────────────────────────────────────────────────────────┐
│  Portfolio Projections                      [Scenario: Primary ▼]
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │    $$$                                            ╱╱╱     │  │
│  │     │                                         ╱╱╱╱        │  │
│  │     │                                     ╱╱╱╱            │  │
│  │     │                Coast            ╱╱╱╱               │  │
│  │     │                FIRE ┊       ╱╱╱╱                   │  │
│  │     │                     ┊   ╱╱╱╱                       │  │
│  │     │   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓┊╱╱╱                           │  │
│  │     │   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓╱╱╱┊                              │  │
│  │     └───────────────────────────────────────────── Age   │  │
│  │        32              38              52         65     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────┐  ┌────────────────────────────────┐  │
│  │ TIME HORIZON         │  │ COAST FIRE                     │  │
│  │                      │  │                                │  │
│  │ [========●====] 20yr │  │ Target Portfolio: $412,000     │  │
│  │ End age: 52          │  │ ━━━━━━━━━━━━━━━━●━━ 78%        │  │
│  │                      │  │                                │  │
│  │ ☑ Inflation adjusted │  │ ✓ On track for age 35.2       │  │
│  └──────────────────────┘  │   (June 2029)                  │  │
│                            └────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ EXPECTED RETURNS                     [Reset to defaults] │  │
│  │                                                          │  │
│  │ Equities          [========●====]  7.0%   (default: 7%)  │  │
│  │ Bonds             [=====●=======]  4.0%   (default: 4%)  │  │
│  │ Crypto            [============●] 12.0%   (default: 12%) │  │
│  │ Cash              [====●========]  4.5%   (default: 4.5%)│  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ALLOCATION                           ☐ Lock to current   │  │
│  │                                                          │  │
│  │ Equities          [==========●==]  60%   (current: 60%)  │  │
│  │ Bonds             [=====●=======]  20%   (current: 20%)  │  │
│  │ Crypto            [======●======]  10%   (current: 10%)  │  │
│  │ Cash              [===●=========]  10%   (current: 10%)  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Monthly contribution: $[  1,847  ]           [Save As…]  │  │
│  │                       (surplus: $1,847/mo)               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Structure

After implementation, new files:

```
finance/
├── cli/
│   └── projections.py          # Projection settings helpers (Phase 1)
├── api/
│   └── routes/
│       └── projections.py      # History + scenarios endpoints (Phase 1)
├── web/
│   └── src/
│       ├── app/
│       │   └── projections/
│       │       └── page.tsx    # Main projections page (Phase 3)
│       ├── components/
│       │   └── projections/
│       │       ├── projection-chart.tsx      # Phase 3
│       │       ├── coast-fire-card.tsx       # Phase 3
│       │       ├── time-horizon-slider.tsx   # Phase 4
│       │       ├── return-sliders.tsx        # Phase 4
│       │       ├── allocation-sliders.tsx    # Phase 4
│       │       ├── scenario-selector.tsx     # Phase 5
│       │       ├── save-scenario-dialog.tsx  # Phase 5
│       │       └── index.ts                  # Barrel export
│       └── lib/
│           ├── projection.ts                 # Core engine (Phase 2)
│           ├── __tests__/
│           │   └── projection.test.ts        # Unit tests (Phase 2)
│           └── hooks/
│               └── use-projection.ts         # State management (Phase 4)
└── PROJECTIONS_SPEC.md         # This file
```

---

## Type Additions

Add to `web/src/lib/types.ts`:

```typescript
// Projection settings (from profile)
export interface ProjectionSettings {
  expected_returns: Record<string, number>; // asset_class -> annual % (e.g., 7.0)
  inflation_rate: number;
  withdrawal_rate: number;
  target_retirement_age: number;
  current_age: number;
}

// Historical data point
export interface HistoricalDataPoint {
  date: string;
  total_value: number;
  by_asset_class: Record<string, number>;
}

// History API response
export interface ProjectionHistoryResponse {
  success: boolean;
  data_points: HistoricalDataPoint[];
  range: {
    start: string;
    end: string;
  };
}

// Scenario
export interface ProjectionScenario {
  id: number;
  name: string;
  is_primary: boolean;
  settings: {
    allocation_overrides: Record<string, number> | null; // asset_class -> % (sum to 100)
    return_overrides: Record<string, number> | null; // asset_class -> annual %
    monthly_contribution: number | null;
    projection_months: number;
  };
  created_at: string;
  updated_at: string;
}

// Scenarios API response
export interface ProjectionScenariosResponse {
  success: boolean;
  scenarios: ProjectionScenario[];
}
```

---

## Testing Checklist

### Phase 1

- [x] Config defaults load correctly
- [x] Database migration runs without error
- [x] History endpoint returns correct date range
- [x] Settings GET/PATCH work correctly
- [x] Scenarios CRUD all work via curl/Swagger

### Phase 2

- [ ] Compounding math matches manual calculation
- [ ] Blended return calculation is correct
- [ ] Coast FIRE target derived correctly from SWR
- [ ] All unit tests pass

### Phase 3

- [ ] Chart renders with combined historical + projected data
- [ ] Coast FIRE card displays correct values
- [ ] Navigation link appears in sidebar

### Phase 4

- [ ] Sliders update chart immediately (no loading state)
- [ ] Allocation sliders sum to 100%
- [ ] Reset button restores defaults
- [ ] Milestone markers appear at correct positions

### Phase 5

- [ ] Scenarios save and load correctly
- [ ] Primary scenario loads on page open
- [ ] Comparison mode shows both projections
- [ ] Cannot delete primary scenario

### Phase 6

- [ ] Responsive layout works on tablet
- [ ] Export produces valid PNG/CSV
- [ ] Settings persist across sessions

---

## Open Questions (Resolved)

| Question                 | Resolution                                    |
| ------------------------ | --------------------------------------------- |
| Coast FIRE target source | Derived from long-term goal target + SWR      |
| Age configuration        | Set once in `projection_settings.current_age` |
| Historical data depth    | 12 months or available, whichever is less     |
| Calculation location     | Client-side for instant interactivity         |
| Scenario storage         | Database (optional localStorage fallback)     |
