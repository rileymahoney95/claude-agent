# Portfolio Projections Feature Spec

> **Status**: Design Complete  
> **Target**: Coast FIRE calculation + interactive portfolio projections  
> **Approach**: Client-side calculation engine for instant interactivity

---

## Overview

A projection feature that shows historical portfolio growth leading into forward projections, with:
- **Coast FIRE calculation**: When can you stop contributing and still hit retirement target?
- **Adjustable parameters**: Time horizon, expected returns, allocation tweaks
- **Comparison mode**: Overlay current allocation vs. scenario
- **Saved scenarios**: Primary plan + named alternates for what-if analysis

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Calculation location | **Client-side** | Instant slider updates, no API latency |
| Coast FIRE target | **Derived from long-term goal** | Uses existing goal system |
| Age configuration | **Set once in config** | Avoid repeated prompts |
| Chart X-axis | **Age (primary)**, date in tooltip | More intuitive for FIRE planning |
| Historical depth | **12 months** or available data | Reasonable context without clutter |

---

## Phase 1: Foundation

**Goal**: Core projection engine + basic chart visualization

### 1.1 Config Changes

Add to `cli/config.py`:

```python
# Default expected returns (annual %)
DEFAULT_EXPECTED_RETURNS = {
    "retirement": 7.0,       # S&P 500 long-term real return
    "taxable_equities": 8.0, # Slightly aggressive tilt
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

### 1.2 API: Historical Data Endpoint

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
      "by_category": {
        "retirement": 18000,
        "crypto": 12000,
        "taxable_equities": 8000,
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
- Fill gaps with linear interpolation or carry-forward

### 1.3 API: Projection Settings Endpoints

**GET `/api/v1/projection/settings`**
- Returns current projection settings from profile
- Merges with defaults for any missing fields

**PATCH `/api/v1/projection/settings`**
- Updates projection settings in profile
- Validates return percentages (0-50% reasonable range)

### 1.4 Client: Projection Engine

Create `web/src/lib/projection.ts`:

**Core Types**:
```typescript
interface ProjectionSettings {
  expectedReturns: Record<string, number>;  // category → annual %
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
  byCategory: Record<string, number>;
  inflationAdjustedValue: number;
  isHistorical: boolean;
}

interface CoastFireResult {
  targetPortfolio: number;      // Portfolio needed today to coast
  retirementTarget: number;     // What you need at retirement
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

**Core Functions**:
```typescript
export function calculateProjection(input: ProjectionInput): ProjectionResult
export function calculateCoastFire(settings: ProjectionSettings, currentValue: number, allocation: Record<string, number>): CoastFireResult
export function calculateBlendedReturn(returns: Record<string, number>, allocation: Record<string, number>): number
```

**Calculation approach**:
1. Initialize category values from current portfolio
2. For each month in projection:
   - Apply monthly return per category: `value *= (1 + annualReturn/12)`
   - Add monthly contribution split by allocation
3. Calculate Coast FIRE target: `retirementTarget / (1 + blendedReturn)^yearsToRetirement`
4. Find crossing point where projection exceeds Coast FIRE target
5. Build milestones from Coast FIRE date + goal deadlines

### 1.5 Client: Basic Chart

Create `web/src/components/projections/projection-chart.tsx`:

- Use Recharts `ComposedChart` with `Area` (stacked) + `ReferenceLine`
- Historical data points marked with `isHistorical: true`
- Visual distinction: solid fill for history, gradient/lighter for projection
- X-axis: Age (derived from `currentAge + monthIndex/12`)
- Y-axis: Currency formatted
- Tooltip: Date, age, total value, category breakdown

### 1.6 Client: Projections Page

Create `web/src/app/projections/page.tsx`:

- Fetch portfolio, profile, and history on load
- Initialize projection state with defaults
- Render chart with combined historical + projected data
- Basic stats card: final value, Coast FIRE status

### 1.7 Navigation

Add "Projections" link to sidebar (`components/layout/sidebar.tsx`)

---

## Phase 2: Interactivity

**Goal**: Sliders for real-time projection tweaking + Coast FIRE display

### 2.1 Time Horizon Control

Create `web/src/components/projections/time-horizon-slider.tsx`:

- Range: 5-40 years (60-480 months)
- Default: 20 years
- Shows projected end age in label
- Checkbox toggle: "Show inflation-adjusted values"

### 2.2 Expected Return Sliders

Create `web/src/components/projections/return-sliders.tsx`:

- One slider per category (retirement, equities, crypto, cash)
- Range: 0-25% (reasonable bounds)
- Shows current value and default in parentheses
- "Reset to defaults" button
- Immediate chart update on drag

### 2.3 Allocation Sliders

Create `web/src/components/projections/allocation-sliders.tsx`:

- One slider per category
- Constrained to sum to 100% (adjust others proportionally)
- "Lock to current allocation" checkbox (disables sliders, uses portfolio allocation)
- Visual indicator when allocation differs from current

### 2.4 Monthly Contribution Input

- Number input for monthly contribution override
- Default: calculated monthly surplus from profile
- Affects projection but not Coast FIRE target calculation

### 2.5 Coast FIRE Card

Create `web/src/components/projections/coast-fire-card.tsx`:

Display:
- **Target Portfolio**: Amount needed today to coast (derived from long-term goal)
- **Retirement Target**: Long-term goal target value
- **Status**: "Achieved" / "X years away" / "On track by age Y"
- **Visual**: Progress bar or similar

Coast FIRE derivation:
```typescript
// Retirement target from long-term goal
const retirementTarget = profile.goals.long_term.target;

// Blended annual return based on current/target allocation
const blendedReturn = calculateBlendedReturn(settings.expectedReturns, allocation);

// Years until retirement
const yearsToRetirement = settings.targetRetirementAge - settings.currentAge;

// Coast FIRE target = what you need TODAY to hit retirement target with $0 contributions
const coastFireTarget = retirementTarget / Math.pow(1 + blendedReturn, yearsToRetirement);
```

### 2.6 Milestone Markers

Add to chart:
- **Coast FIRE line**: Vertical dashed line at achievement date
- **Goal deadlines**: From profile goals (short/medium/long-term)
- **Retirement age**: Vertical line at target retirement

Use Recharts `ReferenceLine` with custom label components.

### 2.7 Projection Hook

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

## Phase 3: Scenarios

**Goal**: Save and compare projection scenarios

### 3.1 Database Schema

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
--   "allocation_overrides": { "retirement": 50, ... } | null,
--   "return_overrides": { "retirement": 8.0, ... } | null,
--   "monthly_contribution": 2000 | null,
--   "projection_months": 240
-- }
```

### 3.2 Scenarios API

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

### 3.3 Scenario Selector

Create `web/src/components/projections/scenario-selector.tsx`:

- Dropdown/tabs showing saved scenarios
- "Current" always available (unsaved state)
- Primary scenario indicated with star/badge
- "Compare" toggle to overlay scenario on chart

### 3.4 Save Scenario Dialog

Create `web/src/components/projections/save-scenario-dialog.tsx`:

- Modal triggered by "Save Scenario" button
- Input: scenario name
- Checkbox: "Set as primary plan"
- Saves current slider state as scenario

### 3.5 Comparison Mode

When comparison enabled:
- Run projection twice: current settings + selected scenario
- Chart shows:
  - Stacked area for current projection (solid)
  - Dashed line for scenario total (overlay)
- Legend indicates which is which
- Tooltip shows both values

### 3.6 Primary Plan Auto-Update

The "Primary" scenario represents the user's intended plan:
- Updates portfolio value automatically (from latest data)
- Retains allocation/return overrides from saved settings
- Shown as default when page loads

---

## Phase 4: Polish

**Goal**: UX refinements and additional features

### 4.1 Responsive Design

- Tablet: Stack controls below chart
- Mobile: Consider simpler view or defer

### 4.2 Keyboard Shortcuts

- Arrow keys for focused slider adjustment
- Number input for precise values
- Escape to reset

### 4.3 Export Options

- "Export as PNG" button for chart
- "Export data as CSV" for projection points

### 4.4 Goal Integration

- Link from Coast FIRE card to profile goals editor
- Show goal progress within projection context
- Alert if Coast FIRE target exceeds stated long-term goal

### 4.5 Settings Persistence

- Save last-used time horizon in localStorage
- Remember inflation-adjusted toggle preference

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
│  │ Retirement        [========●====]  7.0%   (default: 7%)  │  │
│  │ Equities          [=========●===]  8.0%   (default: 8%)  │  │
│  │ Crypto            [============●] 12.0%   (default: 12%) │  │
│  │ Cash              [====●========]  4.5%   (default: 4.5%)│  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ALLOCATION                           ☐ Lock to current   │  │
│  │                                                          │  │
│  │ Retirement        [==========●==]  40%   (current: 38%)  │  │
│  │ Equities          [=====●=======]  20%   (current: 22%)  │  │
│  │ Crypto            [======●======]  25%   (current: 26%)  │  │
│  │ Cash              [===●=========]  15%   (current: 14%)  │  │
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
│       └── projections.py      # History + scenarios endpoints (Phase 1, 3)
├── web/
│   └── src/
│       ├── app/
│       │   └── projections/
│       │       └── page.tsx    # Main projections page (Phase 1)
│       ├── components/
│       │   └── projections/
│       │       ├── projection-chart.tsx      # Phase 1
│       │       ├── coast-fire-card.tsx       # Phase 2
│       │       ├── time-horizon-slider.tsx   # Phase 2
│       │       ├── return-sliders.tsx        # Phase 2
│       │       ├── allocation-sliders.tsx    # Phase 2
│       │       ├── scenario-selector.tsx     # Phase 3
│       │       ├── save-scenario-dialog.tsx  # Phase 3
│       │       └── index.ts                  # Barrel export
│       └── lib/
│           ├── projection.ts                 # Core engine (Phase 1)
│           └── hooks/
│               └── use-projection.ts         # State management (Phase 2)
└── PROJECTIONS_SPEC.md         # This file
```

---

## Type Additions

Add to `web/src/lib/types.ts`:

```typescript
// Projection settings (from profile)
export interface ProjectionSettings {
  expected_returns: Record<string, number>;
  inflation_rate: number;
  withdrawal_rate: number;
  target_retirement_age: number;
  current_age: number;
}

// Historical data point
export interface HistoricalDataPoint {
  date: string;
  total_value: number;
  by_category: Record<string, number>;
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
    allocation_overrides: Record<string, number> | null;
    return_overrides: Record<string, number> | null;
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
- [ ] History endpoint returns correct date range
- [ ] Projection calculation matches manual calculation for simple case
- [ ] Chart renders with combined historical + projected data
- [ ] Navigation link appears in sidebar

### Phase 2
- [ ] Sliders update chart immediately (no loading state)
- [ ] Coast FIRE calculates correctly from long-term goal
- [ ] Allocation sliders sum to 100%
- [ ] Reset button restores defaults
- [ ] Milestone markers appear at correct positions

### Phase 3
- [ ] Scenarios save and load correctly
- [ ] Primary scenario loads on page open
- [ ] Comparison mode shows both projections
- [ ] Cannot delete primary scenario

### Phase 4
- [ ] Responsive layout works on tablet
- [ ] Export produces valid PNG/CSV
- [ ] Settings persist across sessions

---

## Open Questions (Resolved)

| Question | Resolution |
|----------|------------|
| Coast FIRE target source | Derived from long-term goal target |
| Age configuration | Set once in `projection_settings.current_age` |
| Historical data depth | 12 months or available, whichever is less |
| Calculation location | Client-side for instant interactivity |
| Scenario storage | Database (optional localStorage fallback) |
