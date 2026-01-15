# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (port 3000)
npm run build        # Production build
npm run lint         # ESLint check
npm run test         # Vitest watch mode
npm run test:run     # Run tests once (CI)
```

**Run a single test file:**
```bash
npx vitest run __tests__/projection.test.ts
```

**Run tests matching a pattern:**
```bash
npx vitest run -t "annualToMonthlyRate"
```

## Architecture

Next.js 16 App Router with React 19, TypeScript, and Tailwind CSS 4. Connects to FastAPI backend at `http://localhost:8000/api/v1`.

### Key Layers

```
src/
├── app/                    # Next.js App Router pages
├── components/
│   ├── ui/                 # Shadcn/Radix primitives
│   └── [feature]/          # Feature-specific components
└── lib/
    ├── api.ts              # Typed fetch wrappers for FastAPI
    ├── types.ts            # API response interfaces (snake_case)
    ├── projection.ts       # Pure calculation engine (no React)
    ├── converters.ts       # snake_case ↔ camelCase conversion
    └── hooks/              # React Query + custom hooks
```

### Data Flow Pattern

1. **API Layer** (`lib/api.ts`): Typed fetch functions returning snake_case responses
2. **React Query Hooks** (`lib/hooks/`): Server state with 5-min stale time
3. **Converters** (`lib/converters.ts`): Transform API responses to camelCase for TypeScript
4. **Local State**: Interactive controls (sliders) update instantly without API calls
5. **Memoized Calculations**: Expensive projections computed via `useMemo`

### Projection Engine

Pure TypeScript in `lib/projection.ts` - decoupled from React for testability:

- **Returns stored as annual percent** (7.0 = 7%)
- **Monthly rate conversion**: `(1 + annual)^(1/12) - 1`
- **Coast FIRE**: `targetPortfolio = retirementTarget / (1 + blendedReturn)^years`

Key exports:
- `annualToMonthlyRate()` - Convert annual % to monthly
- `calculateBlendedReturn()` - Weighted average from allocation
- `calculateCoastFire()` - Coast FIRE target calculation
- `calculateProjection()` - Full projection with compound growth

### Unified Projection Hook

`useProjection()` in `lib/hooks/use-projection.ts` combines:
- 6 React Query hooks (portfolio, profile, settings, scenarios, history)
- Local state for interactive controls
- Memoized projection result
- Scenario save/load/compare functionality

Slider changes update local state → instant UI update (no API call).

### Case Conversion Pattern

API returns snake_case (Python), frontend uses camelCase (TypeScript):

```typescript
// lib/types.ts - API response types (snake_case)
interface ProjectionSettingsAPI {
  expected_returns: Record<string, number>;
  inflation_rate: number;
}

// lib/projection.ts - Frontend types (camelCase)
interface ProjectionSettings {
  expectedReturns: Record<string, number>;
  inflationRate: number;
}

// lib/converters.ts - Bidirectional conversion
toProjectionSettings(api)    // snake → camel
fromProjectionSettings(ts)   // camel → snake
```

### Component Organization

**Pages** (`app/*/page.tsx`):
- Dashboard, Holdings, Profile, Advisor, Projections, Statements

**Projection Components** (`components/projections/`):
- `ProjectionChart` - Recharts stacked area with comparison overlay
- `CoastFireCard` - Progress toward Coast FIRE target
- `TimeHorizonSlider`, `ReturnSliders`, `AllocationSliders` - Interactive controls
- `ScenarioSelector`, `SaveScenarioDialog` - Scenario management

**UI Primitives** (`components/ui/`):
- Shadcn components built on Radix UI
- Use `cn()` from `lib/utils` for conditional classes

### State Management

- **Server State**: React Query (portfolio, profile, settings, scenarios)
- **Local UI State**: React useState (slider values, dialogs)
- **Preferences**: localStorage via `lib/storage.ts`

### API Endpoints

Base URL configurable via `NEXT_PUBLIC_API_URL` env var.

| Domain | Endpoints |
|--------|-----------|
| Portfolio | GET `/portfolio` |
| Holdings | GET/PUT/DELETE `/holdings/{category}/{key}` |
| Profile | GET/PUT `/profile`, PATCH `/profile/{section}` |
| Advice | GET `/advice?focus=all\|goals\|rebalance\|surplus` |
| Statements | GET `/statements/history`, POST `/statements/pull` |
| Projections | GET/PATCH `/projection/settings`, CRUD `/projection/scenarios` |

### Testing

Vitest with 64+ tests covering projection math, Coast FIRE calculations, validation, and edge cases. Tests live in `__tests__/`.

Test pattern: pure functions in `lib/projection.ts`, not React components.

```typescript
import { describe, it, expect } from 'vitest';
import { annualToMonthlyRate } from '@/lib/projection';

it('converts 7% annual to monthly', () => {
  expect(annualToMonthlyRate(7.0)).toBeCloseTo(0.005654, 4);
});
```
