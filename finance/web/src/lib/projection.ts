/**
 * Portfolio Projection Engine
 *
 * Pure calculation functions for projecting portfolio growth with compound interest,
 * Coast FIRE target calculations, and milestone detection.
 *
 * All functions are pure (no side effects) for easy testing.
 *
 * Key conventions (from spec):
 * - Returns are stored/edited as annual percent values (e.g., 7.0 means 7%)
 * - Returns are nominal (inflation_rate used only for display)
 * - Monthly rate uses compound conversion: (1 + r_annual)^(1/12) - 1
 */

// =============================================================================
// TYPES (camelCase - TypeScript convention)
// =============================================================================

export interface ProjectionSettings {
  expectedReturns: Record<string, number>; // asset_class -> annual % (e.g., 7.0)
  inflationRate: number;
  withdrawalRate: number;
  targetRetirementAge: number;
  currentAge: number;
}

export interface HistoricalDataPoint {
  date: string;
  totalValue: number;
  byAssetClass: Record<string, number>;
}

export interface ScenarioSettings {
  allocationOverrides?: Record<string, number>;
  returnOverrides?: Record<string, number>;
  monthlyContribution?: number;
  projectionMonths?: number;
}

export interface ProjectionScenario {
  id: number;
  name: string;
  settings: ScenarioSettings;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectionInput {
  currentPortfolio: {
    totalValue: number;
    byAssetClass: Record<string, number>;
  };
  settings: ProjectionSettings;
  monthlyContribution: number;
  allocationOverrides?: Record<string, number>;
  returnOverrides?: Record<string, number>;
  projectionMonths: number;
  retirementTarget?: number; // Override default $1.5M
}

export interface ProjectionPoint {
  date: string;
  monthIndex: number;
  age: number;
  totalValue: number;
  byAssetClass: Record<string, number>;
  inflationAdjustedValue: number;
  isHistorical: boolean;
}

export interface CoastFireResult {
  targetPortfolio: number; // Amount needed now to "coast" to retirement
  retirementTarget: number; // Total needed at retirement (for SWR)
  achievedDate: string | null; // When target is reached
  achievedAge: number | null; // Age when target is reached
  monthsUntil: number | null; // Months until target reached
  alreadyCoasted: boolean; // True if current value >= target
}

export interface Milestone {
  type: 'coast_fire' | 'goal_deadline' | 'retirement';
  date: string;
  age: number;
  label: string;
  value?: number;
}

export interface ProjectionResult {
  dataPoints: ProjectionPoint[];
  coastFire: CoastFireResult;
  finalValue: number;
  finalInflationAdjusted: number;
  milestones: Milestone[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_ASSET_CLASSES = ['equities', 'bonds', 'crypto', 'cash'] as const;
const MONTHS_PER_YEAR = 12;
const DEFAULT_RETIREMENT_TARGET = 1_500_000; // $1.5M default

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Convert annual percentage return to monthly compounded rate.
 * Formula: (1 + r_annual)^(1/12) - 1
 *
 * @param annualPercent - Annual return as percentage (e.g., 7.0 for 7%)
 * @returns Monthly rate as decimal (e.g., 0.005654 for ~0.565%)
 */
export function annualToMonthlyRate(annualPercent: number): number {
  if (annualPercent === 0) return 0;
  const annualDecimal = annualPercent / 100;
  return Math.pow(1 + annualDecimal, 1 / MONTHS_PER_YEAR) - 1;
}

/**
 * Calculate blended return rate from allocation and per-asset returns.
 *
 * @param returns - Asset class returns (annual %)
 * @param allocation - Asset class allocation (must sum to 100)
 * @returns Blended annual return percentage
 */
export function calculateBlendedReturn(
  returns: Record<string, number>,
  allocation: Record<string, number>
): number {
  let blended = 0;
  for (const assetClass of DEFAULT_ASSET_CLASSES) {
    const weight = (allocation[assetClass] ?? 0) / 100;
    const returnRate = returns[assetClass] ?? 0;
    blended += weight * returnRate;
  }
  return blended;
}

/**
 * Get allocation from portfolio values or use overrides.
 */
function getAllocation(
  byAssetClass: Record<string, number>,
  overrides?: Record<string, number>
): Record<string, number> {
  if (overrides) {
    return overrides;
  }

  const total = Object.values(byAssetClass).reduce((sum, v) => sum + v, 0);
  if (total === 0) {
    // Equal split if no assets
    return { equities: 25, bonds: 25, crypto: 25, cash: 25 };
  }

  const allocation: Record<string, number> = {};
  for (const assetClass of DEFAULT_ASSET_CLASSES) {
    allocation[assetClass] = ((byAssetClass[assetClass] ?? 0) / total) * 100;
  }
  return allocation;
}

/**
 * Format date as YYYY-MM-DD string.
 */
function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Add months to a date.
 */
function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

// =============================================================================
// COAST FIRE CALCULATION
// =============================================================================

/**
 * Calculate Coast FIRE target and status.
 *
 * Coast FIRE = the portfolio value that will grow to retirement target
 * with no additional contributions, assuming given return rate.
 *
 * Formula:
 * coastFireTarget = retirementTarget / (1 + blendedReturn)^yearsToRetirement
 *
 * @param settings - Projection settings with expected returns and age info
 * @param currentValue - Current portfolio value
 * @param allocation - Current or target allocation (must sum to 100)
 * @param retirementTargetOverride - Optional override for retirement target
 * @returns Coast FIRE calculation result
 */
export function calculateCoastFire(
  settings: ProjectionSettings,
  currentValue: number,
  allocation: Record<string, number>,
  retirementTargetOverride?: number
): CoastFireResult {
  const yearsToRetirement = settings.targetRetirementAge - settings.currentAge;

  // Use override or default retirement target
  const retirementTarget = retirementTargetOverride ?? DEFAULT_RETIREMENT_TARGET;

  // Get blended return
  const blendedAnnual = calculateBlendedReturn(settings.expectedReturns, allocation);
  const blendedDecimal = blendedAnnual / 100;

  // Coast target = retirementTarget / (1 + r)^years
  // This is how much you need NOW to coast to retirement
  const growthFactor = Math.pow(1 + blendedDecimal, yearsToRetirement);
  const targetPortfolio = retirementTarget / growthFactor;

  // Check if already coasted
  const alreadyCoasted = currentValue >= targetPortfolio;

  return {
    targetPortfolio: Math.round(targetPortfolio),
    retirementTarget,
    achievedDate: alreadyCoasted ? formatDateISO(new Date()) : null,
    achievedAge: alreadyCoasted ? settings.currentAge : null,
    monthsUntil: alreadyCoasted ? 0 : null,
    alreadyCoasted,
  };
}

// =============================================================================
// MAIN PROJECTION FUNCTION
// =============================================================================

/**
 * Calculate portfolio projection over time.
 *
 * Algorithm:
 * 1. Initialize asset-class values from current portfolio
 * 2. For each month:
 *    - Apply monthly compound return per asset class
 *    - Add monthly contribution split by allocation
 *    - Track inflation-adjusted value
 * 3. Find Coast FIRE crossing point
 * 4. Build milestones
 *
 * @param input - Projection parameters
 * @returns Projection result with data points, Coast FIRE, and milestones
 */
export function calculateProjection(input: ProjectionInput): ProjectionResult {
  const {
    currentPortfolio,
    settings,
    monthlyContribution,
    allocationOverrides,
    returnOverrides,
    projectionMonths,
    retirementTarget,
  } = input;

  // Determine allocation (from portfolio or overrides)
  const allocation = getAllocation(
    currentPortfolio.byAssetClass,
    allocationOverrides
  );

  // Determine returns (from settings or overrides)
  const returns = returnOverrides
    ? { ...settings.expectedReturns, ...returnOverrides }
    : settings.expectedReturns;

  // Pre-calculate monthly rates per asset class
  const monthlyRates: Record<string, number> = {};
  for (const assetClass of DEFAULT_ASSET_CLASSES) {
    monthlyRates[assetClass] = annualToMonthlyRate(returns[assetClass] ?? 0);
  }

  // Monthly inflation rate for inflation-adjusted calculations
  const monthlyInflation = annualToMonthlyRate(settings.inflationRate);

  // Initialize asset values
  const assetValues: Record<string, number> = {};
  for (const assetClass of DEFAULT_ASSET_CLASSES) {
    assetValues[assetClass] = currentPortfolio.byAssetClass[assetClass] ?? 0;
  }

  // Calculate contribution split per asset class
  const contributionSplit: Record<string, number> = {};
  for (const assetClass of DEFAULT_ASSET_CLASSES) {
    contributionSplit[assetClass] =
      ((allocation[assetClass] ?? 0) / 100) * monthlyContribution;
  }

  // Calculate Coast FIRE target
  const coastFire = calculateCoastFire(
    settings,
    currentPortfolio.totalValue,
    allocation,
    retirementTarget
  );

  // Build projection data points
  const dataPoints: ProjectionPoint[] = [];
  const startDate = new Date();
  let inflationFactor = 1; // Cumulative inflation
  let coastFireAchieved = coastFire.alreadyCoasted;

  for (let month = 0; month <= projectionMonths; month++) {
    const date = addMonths(startDate, month);
    const age = settings.currentAge + month / MONTHS_PER_YEAR;

    // Calculate current total
    const totalValue = Object.values(assetValues).reduce((sum, v) => sum + v, 0);

    // Check Coast FIRE crossing
    if (!coastFireAchieved && totalValue >= coastFire.targetPortfolio) {
      coastFireAchieved = true;
      coastFire.achievedDate = formatDateISO(date);
      coastFire.achievedAge = Math.round(age * 10) / 10;
      coastFire.monthsUntil = month;
    }

    // Record data point
    dataPoints.push({
      date: formatDateISO(date),
      monthIndex: month,
      age: Math.round(age * 100) / 100,
      totalValue: Math.round(totalValue * 100) / 100,
      byAssetClass: { ...assetValues },
      inflationAdjustedValue: Math.round((totalValue / inflationFactor) * 100) / 100,
      isHistorical: false,
    });

    // Apply monthly growth and contributions (for next month)
    if (month < projectionMonths) {
      for (const assetClass of DEFAULT_ASSET_CLASSES) {
        // Apply compound growth
        assetValues[assetClass] *= 1 + monthlyRates[assetClass];
        // Add contribution
        assetValues[assetClass] += contributionSplit[assetClass];
      }
      // Update inflation factor
      inflationFactor *= 1 + monthlyInflation;
    }
  }

  // Build milestones
  const milestones: Milestone[] = [];

  // Coast FIRE milestone
  if (coastFire.achievedDate) {
    milestones.push({
      type: 'coast_fire',
      date: coastFire.achievedDate,
      age: coastFire.achievedAge!,
      label: 'Coast FIRE Achieved',
      value: coastFire.targetPortfolio,
    });
  }

  // Retirement milestone
  const retirementMonths =
    (settings.targetRetirementAge - settings.currentAge) * MONTHS_PER_YEAR;
  if (retirementMonths > 0 && retirementMonths <= projectionMonths) {
    const retirementDate = addMonths(startDate, retirementMonths);
    milestones.push({
      type: 'retirement',
      date: formatDateISO(retirementDate),
      age: settings.targetRetirementAge,
      label: 'Target Retirement',
    });
  }

  // Get final values
  const finalPoint = dataPoints[dataPoints.length - 1];

  return {
    dataPoints,
    coastFire,
    finalValue: finalPoint.totalValue,
    finalInflationAdjusted: finalPoint.inflationAdjustedValue,
    milestones,
  };
}

// =============================================================================
// VALIDATION UTILITIES
// =============================================================================

/**
 * Validate projection settings.
 * @returns Error message or null if valid
 */
export function validateProjectionSettings(
  settings: Partial<ProjectionSettings>
): string | null {
  if (settings.expectedReturns) {
    for (const [key, value] of Object.entries(settings.expectedReturns)) {
      if (typeof value !== 'number' || value < 0 || value > 50) {
        return `Expected return for ${key} must be 0-50%`;
      }
    }
  }

  if (settings.inflationRate !== undefined) {
    if (settings.inflationRate < 0 || settings.inflationRate > 20) {
      return 'Inflation rate must be 0-20%';
    }
  }

  if (settings.withdrawalRate !== undefined) {
    if (settings.withdrawalRate < 1 || settings.withdrawalRate > 10) {
      return 'Withdrawal rate must be 1-10%';
    }
  }

  if (settings.targetRetirementAge !== undefined) {
    if (settings.targetRetirementAge < 40 || settings.targetRetirementAge > 100) {
      return 'Target retirement age must be 40-100';
    }
  }

  if (settings.currentAge !== undefined) {
    if (settings.currentAge < 18 || settings.currentAge > 99) {
      return 'Current age must be 18-99';
    }
  }

  return null;
}

/**
 * Validate scenario settings.
 * @returns Error message or null if valid
 */
export function validateScenarioSettings(settings: ScenarioSettings): string | null {
  if (settings.allocationOverrides) {
    const total = Object.values(settings.allocationOverrides).reduce(
      (sum, v) => sum + v,
      0
    );
    if (Math.abs(total - 100) > 0.1) {
      return `Allocation must sum to 100%, got ${total.toFixed(1)}%`;
    }
    for (const [key, value] of Object.entries(settings.allocationOverrides)) {
      if (value < 0 || value > 100) {
        return `Allocation for ${key} must be 0-100%`;
      }
    }
  }

  if (settings.returnOverrides) {
    for (const [key, value] of Object.entries(settings.returnOverrides)) {
      if (value < 0 || value > 50) {
        return `Return override for ${key} must be 0-50%`;
      }
    }
  }

  if (
    settings.monthlyContribution !== undefined &&
    settings.monthlyContribution < 0
  ) {
    return 'Monthly contribution must be non-negative';
  }

  if (settings.projectionMonths !== undefined) {
    if (settings.projectionMonths < 60 || settings.projectionMonths > 480) {
      return 'Projection months must be 60-480';
    }
  }

  return null;
}
