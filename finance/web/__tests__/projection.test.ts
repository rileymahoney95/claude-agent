/**
 * Unit tests for the projection calculation engine.
 *
 * Tests cover:
 * 1. Compounding math accuracy
 * 2. Blended return calculations
 * 3. Coast FIRE calculations
 * 4. Full projection calculations
 * 5. Edge cases (0% return, single asset, empty portfolio)
 * 6. Milestone detection
 * 7. Validation functions
 */

import { describe, it, expect } from 'vitest';
import {
  annualToMonthlyRate,
  calculateBlendedReturn,
  calculateCoastFire,
  calculateProjection,
  validateProjectionSettings,
  validateScenarioSettings,
  type ProjectionSettings,
  type ProjectionInput,
} from '@/lib/projection';
import { adjustAllocation } from '@/lib/hooks/use-projection';

// =============================================================================
// COMPOUNDING MATH TESTS
// =============================================================================

describe('annualToMonthlyRate', () => {
  it('converts 7% annual to correct monthly rate', () => {
    const monthly = annualToMonthlyRate(7.0);
    // (1 + 0.07)^(1/12) - 1 ≈ 0.005654
    expect(monthly).toBeCloseTo(0.005654, 4);
  });

  it('converts 0% annual to 0 monthly', () => {
    expect(annualToMonthlyRate(0)).toBe(0);
  });

  it('converts 12% annual correctly', () => {
    const monthly = annualToMonthlyRate(12.0);
    // (1 + 0.12)^(1/12) - 1 ≈ 0.009489
    expect(monthly).toBeCloseTo(0.009489, 4);
  });

  it('converts 4.5% annual correctly', () => {
    const monthly = annualToMonthlyRate(4.5);
    // (1 + 0.045)^(1/12) - 1 ≈ 0.003675
    expect(monthly).toBeCloseTo(0.003675, 4);
  });
});

describe('compound growth verification', () => {
  it('$10,000 at 7% for 10 years equals $19,671.51', () => {
    // Formula: P * (1 + r)^t
    // 10000 * (1.07)^10 = 19671.51
    const principal = 10000;
    const rate = 0.07;
    const years = 10;
    const expected = 19671.51;

    const result = principal * Math.pow(1 + rate, years);
    expect(result).toBeCloseTo(expected, 2);
  });

  it('monthly compounding matches annual compounding over 1 year', () => {
    const principal = 10000;
    const annualRate = 7.0;

    // Annual compounding
    const annualResult = principal * (1 + annualRate / 100);

    // Monthly compounding for 12 months
    const monthlyRate = annualToMonthlyRate(annualRate);
    let monthlyResult = principal;
    for (let i = 0; i < 12; i++) {
      monthlyResult *= 1 + monthlyRate;
    }

    // Should match within floating point precision
    expect(monthlyResult).toBeCloseTo(annualResult, 2);
  });

  it('monthly compounding for 10 years matches formula', () => {
    const principal = 10000;
    const annualRate = 7.0;
    const months = 120;

    const monthlyRate = annualToMonthlyRate(annualRate);
    let result = principal;
    for (let i = 0; i < months; i++) {
      result *= 1 + monthlyRate;
    }

    // Should match 10000 * (1.07)^10
    expect(result).toBeCloseTo(19671.51, 0);
  });
});

// =============================================================================
// BLENDED RETURN TESTS
// =============================================================================

describe('calculateBlendedReturn', () => {
  it('60% equities (7%) + 40% bonds (4%) = 5.8%', () => {
    const returns = { equities: 7.0, bonds: 4.0, crypto: 0, cash: 0 };
    const allocation = { equities: 60, bonds: 40, crypto: 0, cash: 0 };

    const blended = calculateBlendedReturn(returns, allocation);
    expect(blended).toBeCloseTo(5.8, 2);
  });

  it('100% single asset returns that asset rate', () => {
    const returns = { equities: 7.0, bonds: 4.0, crypto: 12.0, cash: 4.5 };
    const allocation = { equities: 100, bonds: 0, crypto: 0, cash: 0 };

    expect(calculateBlendedReturn(returns, allocation)).toBe(7.0);
  });

  it('equal split across 4 assets averages correctly', () => {
    const returns = { equities: 8.0, bonds: 4.0, crypto: 12.0, cash: 4.0 };
    const allocation = { equities: 25, bonds: 25, crypto: 25, cash: 25 };

    // (8 + 4 + 12 + 4) / 4 = 7.0
    expect(calculateBlendedReturn(returns, allocation)).toBe(7.0);
  });

  it('handles zero allocation for missing asset classes', () => {
    const returns = { equities: 7.0, bonds: 4.0, crypto: 12.0, cash: 4.5 };
    const allocation = { equities: 50, bonds: 50 }; // missing crypto, cash

    // 50% * 7 + 50% * 4 = 5.5
    expect(calculateBlendedReturn(returns, allocation)).toBe(5.5);
  });

  it('handles real-world allocation', () => {
    const returns = { equities: 7.0, bonds: 4.0, crypto: 12.0, cash: 4.5 };
    const allocation = { equities: 60, bonds: 10, crypto: 20, cash: 10 };

    // 60%*7 + 10%*4 + 20%*12 + 10%*4.5 = 4.2 + 0.4 + 2.4 + 0.45 = 7.45
    expect(calculateBlendedReturn(returns, allocation)).toBeCloseTo(7.45, 2);
  });
});

// =============================================================================
// COAST FIRE TESTS
// =============================================================================

describe('calculateCoastFire', () => {
  const baseSettings: ProjectionSettings = {
    expectedReturns: { equities: 7.0, bonds: 4.0, crypto: 12.0, cash: 4.5 },
    inflationRate: 3.0,
    withdrawalRate: 4.0,
    targetRetirementAge: 65,
    currentAge: 32,
  };

  it('calculates correct coast target for 33 years to retirement at 7%', () => {
    const allocation = { equities: 100, bonds: 0, crypto: 0, cash: 0 };
    const result = calculateCoastFire(baseSettings, 100000, allocation);

    // Target = 1,500,000 / (1.07)^33 ≈ 161,513
    const expected = 1500000 / Math.pow(1.07, 33);
    expect(result.targetPortfolio).toBeCloseTo(expected, -2); // Within $100
    expect(result.retirementTarget).toBe(1500000);
  });

  it('correctly identifies already coasted status', () => {
    const allocation = { equities: 100, bonds: 0, crypto: 0, cash: 0 };
    const coastTarget = 1500000 / Math.pow(1.07, 33);

    // Current value exceeds coast target
    const result = calculateCoastFire(baseSettings, coastTarget + 50000, allocation);
    expect(result.alreadyCoasted).toBe(true);
    expect(result.monthsUntil).toBe(0);
  });

  it('correctly identifies not yet coasted', () => {
    const allocation = { equities: 100, bonds: 0, crypto: 0, cash: 0 };
    const result = calculateCoastFire(baseSettings, 50000, allocation);
    expect(result.alreadyCoasted).toBe(false);
    expect(result.monthsUntil).toBeNull();
  });

  it('uses blended return for mixed portfolio', () => {
    // 50% equities (7%), 50% bonds (4%) = 5.5% blended
    const allocation = { equities: 50, bonds: 50, crypto: 0, cash: 0 };
    const result = calculateCoastFire(baseSettings, 100000, allocation);

    const expected = 1500000 / Math.pow(1.055, 33);
    expect(result.targetPortfolio).toBeCloseTo(expected, -2);
  });

  it('respects custom retirement target', () => {
    const allocation = { equities: 100, bonds: 0, crypto: 0, cash: 0 };
    const result = calculateCoastFire(baseSettings, 100000, allocation, 2000000);

    expect(result.retirementTarget).toBe(2000000);
    const expected = 2000000 / Math.pow(1.07, 33);
    expect(result.targetPortfolio).toBeCloseTo(expected, -2);
  });
});

// =============================================================================
// FULL PROJECTION TESTS
// =============================================================================

describe('calculateProjection', () => {
  const baseSettings: ProjectionSettings = {
    expectedReturns: { equities: 7.0, bonds: 4.0, crypto: 12.0, cash: 4.5 },
    inflationRate: 3.0,
    withdrawalRate: 4.0,
    targetRetirementAge: 65,
    currentAge: 32,
  };

  const baseInput: ProjectionInput = {
    currentPortfolio: {
      totalValue: 100000,
      byAssetClass: { equities: 70000, bonds: 10000, crypto: 15000, cash: 5000 },
    },
    settings: baseSettings,
    monthlyContribution: 2000,
    projectionMonths: 120, // 10 years
  };

  it('generates correct number of data points', () => {
    const result = calculateProjection(baseInput);
    // 0 to 120 inclusive = 121 points
    expect(result.dataPoints.length).toBe(121);
  });

  it('starts with correct initial values', () => {
    const result = calculateProjection(baseInput);
    const first = result.dataPoints[0];

    expect(first.monthIndex).toBe(0);
    expect(first.totalValue).toBeCloseTo(100000, 0);
    expect(first.isHistorical).toBe(false);
  });

  it('age increments correctly over time', () => {
    const result = calculateProjection(baseInput);

    expect(result.dataPoints[0].age).toBeCloseTo(32, 1);
    expect(result.dataPoints[12].age).toBeCloseTo(33, 1); // 1 year later
    expect(result.dataPoints[120].age).toBeCloseTo(42, 1); // 10 years later
  });

  it('final value exceeds initial due to growth and contributions', () => {
    const result = calculateProjection(baseInput);
    expect(result.finalValue).toBeGreaterThan(baseInput.currentPortfolio.totalValue);
  });

  it('inflation-adjusted value is less than nominal', () => {
    const result = calculateProjection(baseInput);
    const final = result.dataPoints[result.dataPoints.length - 1];
    expect(final.inflationAdjustedValue).toBeLessThan(final.totalValue);
  });

  it('respects allocation overrides', () => {
    const input: ProjectionInput = {
      ...baseInput,
      allocationOverrides: { equities: 100, bonds: 0, crypto: 0, cash: 0 },
    };
    const result = calculateProjection(input);

    // With 100% equities at 7%, growth should be significant
    expect(result.finalValue).toBeGreaterThan(200000);
  });

  it('respects return overrides', () => {
    const input: ProjectionInput = {
      ...baseInput,
      returnOverrides: { equities: 0, bonds: 0, crypto: 0, cash: 0 },
    };
    const result = calculateProjection(input);

    // With 0% returns, final = initial + (contributions * months)
    // 100000 + (2000 * 120) = 340000
    expect(result.finalValue).toBeCloseTo(340000, -2);
  });

  it('tracks asset class values correctly', () => {
    const result = calculateProjection(baseInput);
    const final = result.dataPoints[result.dataPoints.length - 1];

    // All asset classes should have grown
    expect(final.byAssetClass.equities).toBeGreaterThan(70000);
    expect(final.byAssetClass.crypto).toBeGreaterThan(15000);
    expect(final.byAssetClass.cash).toBeGreaterThan(5000);
  });

  it('finds coast fire crossing point', () => {
    // Start with small portfolio, large contributions - should reach coast fire
    const input: ProjectionInput = {
      currentPortfolio: {
        totalValue: 50000,
        byAssetClass: { equities: 50000, bonds: 0, crypto: 0, cash: 0 },
      },
      settings: baseSettings,
      monthlyContribution: 3000,
      projectionMonths: 240, // 20 years
    };

    const result = calculateProjection(input);

    // Should find coast fire at some point
    if (!result.coastFire.alreadyCoasted) {
      expect(result.coastFire.achievedDate).not.toBeNull();
      expect(result.coastFire.monthsUntil).toBeGreaterThan(0);
    }
  });
});

// =============================================================================
// EDGE CASES
// =============================================================================

describe('edge cases', () => {
  const baseSettings: ProjectionSettings = {
    expectedReturns: { equities: 7.0, bonds: 4.0, crypto: 12.0, cash: 4.5 },
    inflationRate: 3.0,
    withdrawalRate: 4.0,
    targetRetirementAge: 65,
    currentAge: 32,
  };

  it('handles 0% return rate', () => {
    const input: ProjectionInput = {
      currentPortfolio: {
        totalValue: 10000,
        byAssetClass: { equities: 10000, bonds: 0, crypto: 0, cash: 0 },
      },
      settings: {
        ...baseSettings,
        expectedReturns: { equities: 0, bonds: 0, crypto: 0, cash: 0 },
      },
      monthlyContribution: 1000,
      projectionMonths: 12,
    };

    const result = calculateProjection(input);
    // 10000 + (1000 * 12) = 22000
    expect(result.finalValue).toBeCloseTo(22000, 0);
  });

  it('handles 0 monthly contribution', () => {
    const input: ProjectionInput = {
      currentPortfolio: {
        totalValue: 10000,
        byAssetClass: { equities: 10000, bonds: 0, crypto: 0, cash: 0 },
      },
      settings: baseSettings,
      monthlyContribution: 0,
      projectionMonths: 12,
    };

    const result = calculateProjection(input);
    // Growth only from returns
    const expectedGrowth = 10000 * Math.pow(1 + annualToMonthlyRate(7.0), 12);
    expect(result.finalValue).toBeCloseTo(expectedGrowth, 0);
  });

  it('handles empty portfolio', () => {
    const input: ProjectionInput = {
      currentPortfolio: { totalValue: 0, byAssetClass: {} },
      settings: baseSettings,
      monthlyContribution: 1000,
      projectionMonths: 12,
    };

    const result = calculateProjection(input);
    expect(result.finalValue).toBeGreaterThan(11000); // At least contributions + some growth
  });

  it('handles 0 projection months', () => {
    const input: ProjectionInput = {
      currentPortfolio: {
        totalValue: 10000,
        byAssetClass: { equities: 10000, bonds: 0, crypto: 0, cash: 0 },
      },
      settings: baseSettings,
      monthlyContribution: 1000,
      projectionMonths: 0,
    };

    const result = calculateProjection(input);
    expect(result.dataPoints.length).toBe(1); // Just initial point
    expect(result.finalValue).toBeCloseTo(10000, 0);
  });

  it('handles very short projection (1 month)', () => {
    const input: ProjectionInput = {
      currentPortfolio: {
        totalValue: 10000,
        byAssetClass: { equities: 10000, bonds: 0, crypto: 0, cash: 0 },
      },
      settings: baseSettings,
      monthlyContribution: 1000,
      projectionMonths: 1,
    };

    const result = calculateProjection(input);
    expect(result.dataPoints.length).toBe(2);
    // After 1 month: 10000 * (1 + monthlyRate) + 1000
    const monthlyRate = annualToMonthlyRate(7.0);
    const expected = 10000 * (1 + monthlyRate) + 1000;
    expect(result.finalValue).toBeCloseTo(expected, 0);
  });
});

// =============================================================================
// MILESTONE TESTS
// =============================================================================

describe('milestones', () => {
  it('includes retirement milestone when within projection range', () => {
    const settings: ProjectionSettings = {
      expectedReturns: { equities: 7.0, bonds: 4.0, crypto: 12.0, cash: 4.5 },
      inflationRate: 3.0,
      withdrawalRate: 4.0,
      targetRetirementAge: 42, // 10 years from 32
      currentAge: 32,
    };

    const input: ProjectionInput = {
      currentPortfolio: {
        totalValue: 100000,
        byAssetClass: { equities: 100000, bonds: 0, crypto: 0, cash: 0 },
      },
      settings,
      monthlyContribution: 0,
      projectionMonths: 120, // 10 years
    };

    const result = calculateProjection(input);
    const retirementMilestone = result.milestones.find((m) => m.type === 'retirement');

    expect(retirementMilestone).toBeDefined();
    expect(retirementMilestone?.age).toBe(42);
  });

  it('excludes retirement milestone when beyond projection range', () => {
    const settings: ProjectionSettings = {
      expectedReturns: { equities: 7.0, bonds: 4.0, crypto: 12.0, cash: 4.5 },
      inflationRate: 3.0,
      withdrawalRate: 4.0,
      targetRetirementAge: 65,
      currentAge: 32,
    };

    const input: ProjectionInput = {
      currentPortfolio: {
        totalValue: 100000,
        byAssetClass: { equities: 100000, bonds: 0, crypto: 0, cash: 0 },
      },
      settings,
      monthlyContribution: 0,
      projectionMonths: 60, // Only 5 years
    };

    const result = calculateProjection(input);
    const retirementMilestone = result.milestones.find((m) => m.type === 'retirement');

    expect(retirementMilestone).toBeUndefined();
  });

  it('includes coast fire milestone when achieved', () => {
    const settings: ProjectionSettings = {
      expectedReturns: { equities: 7.0, bonds: 4.0, crypto: 12.0, cash: 4.5 },
      inflationRate: 3.0,
      withdrawalRate: 4.0,
      targetRetirementAge: 65,
      currentAge: 32,
    };

    const input: ProjectionInput = {
      currentPortfolio: {
        totalValue: 100000,
        byAssetClass: { equities: 100000, bonds: 0, crypto: 0, cash: 0 },
      },
      settings,
      monthlyContribution: 3000,
      projectionMonths: 240,
    };

    const result = calculateProjection(input);
    const coastMilestone = result.milestones.find((m) => m.type === 'coast_fire');

    // With $100k start and $3k/month contributions at 7%, should hit coast fire
    expect(coastMilestone).toBeDefined();
    expect(coastMilestone?.value).toBeDefined();
  });
});

// =============================================================================
// VALIDATION TESTS
// =============================================================================

describe('validateProjectionSettings', () => {
  it('accepts valid settings', () => {
    const settings = {
      expectedReturns: { equities: 7.0, bonds: 4.0 },
      inflationRate: 3.0,
      withdrawalRate: 4.0,
      targetRetirementAge: 65,
      currentAge: 32,
    };
    expect(validateProjectionSettings(settings)).toBeNull();
  });

  it('rejects return rate over 50%', () => {
    const settings = { expectedReturns: { equities: 51 } };
    expect(validateProjectionSettings(settings)).toContain('50%');
  });

  it('rejects negative return rate', () => {
    const settings = { expectedReturns: { equities: -5 } };
    expect(validateProjectionSettings(settings)).toContain('0-50%');
  });

  it('rejects inflation over 20%', () => {
    const settings = { inflationRate: 21 };
    expect(validateProjectionSettings(settings)).toContain('20%');
  });

  it('rejects negative inflation', () => {
    const settings = { inflationRate: -1 };
    expect(validateProjectionSettings(settings)).toContain('0-20%');
  });

  it('rejects withdrawal rate under 1%', () => {
    const settings = { withdrawalRate: 0.5 };
    expect(validateProjectionSettings(settings)).toContain('1-10%');
  });

  it('rejects withdrawal rate over 10%', () => {
    const settings = { withdrawalRate: 11 };
    expect(validateProjectionSettings(settings)).toContain('1-10%');
  });

  it('rejects retirement age under 40', () => {
    const settings = { targetRetirementAge: 35 };
    expect(validateProjectionSettings(settings)).toContain('40-100');
  });

  it('rejects retirement age over 100', () => {
    const settings = { targetRetirementAge: 101 };
    expect(validateProjectionSettings(settings)).toContain('40-100');
  });

  it('rejects current age under 18', () => {
    const settings = { currentAge: 17 };
    expect(validateProjectionSettings(settings)).toContain('18-99');
  });

  it('rejects current age over 99', () => {
    const settings = { currentAge: 100 };
    expect(validateProjectionSettings(settings)).toContain('18-99');
  });
});

describe('validateScenarioSettings', () => {
  it('accepts valid scenario settings', () => {
    const settings = {
      allocationOverrides: { equities: 60, bonds: 20, crypto: 10, cash: 10 },
      returnOverrides: { equities: 8.0 },
      monthlyContribution: 2000,
      projectionMonths: 240,
    };
    expect(validateScenarioSettings(settings)).toBeNull();
  });

  it('accepts empty scenario settings', () => {
    expect(validateScenarioSettings({})).toBeNull();
  });

  it('rejects allocation not summing to 100', () => {
    const settings = {
      allocationOverrides: { equities: 50, bonds: 20, crypto: 10, cash: 10 }, // = 90
    };
    expect(validateScenarioSettings(settings)).toContain('sum to 100');
  });

  it('rejects negative allocation', () => {
    const settings = {
      allocationOverrides: { equities: 110, bonds: -10, crypto: 0, cash: 0 },
    };
    expect(validateScenarioSettings(settings)).toContain('0-100%');
  });

  it('rejects allocation over 100%', () => {
    const settings = {
      allocationOverrides: { equities: 101, bonds: 0, crypto: 0, cash: -1 },
    };
    expect(validateScenarioSettings(settings)).toContain('0-100%');
  });

  it('rejects return override over 50%', () => {
    const settings = { returnOverrides: { equities: 51 } };
    expect(validateScenarioSettings(settings)).toContain('0-50%');
  });

  it('rejects negative return override', () => {
    const settings = { returnOverrides: { equities: -1 } };
    expect(validateScenarioSettings(settings)).toContain('0-50%');
  });

  it('rejects projection months under 60', () => {
    const settings = { projectionMonths: 30 };
    expect(validateScenarioSettings(settings)).toContain('60-480');
  });

  it('rejects projection months over 480', () => {
    const settings = { projectionMonths: 500 };
    expect(validateScenarioSettings(settings)).toContain('60-480');
  });

  it('rejects negative monthly contribution', () => {
    const settings = { monthlyContribution: -100 };
    expect(validateScenarioSettings(settings)).toContain('non-negative');
  });

  it('accepts zero monthly contribution', () => {
    const settings = { monthlyContribution: 0 };
    expect(validateScenarioSettings(settings)).toBeNull();
  });
});

// =============================================================================
// ALLOCATION ADJUSTMENT TESTS
// =============================================================================

describe('adjustAllocation', () => {
  it('maintains sum of 100% after adjustment', () => {
    const current = { equities: 50, bonds: 20, crypto: 20, cash: 10 };
    const result = adjustAllocation(current, 'equities', 60);

    const total = Object.values(result).reduce((sum, v) => sum + v, 0);
    expect(total).toBeCloseTo(100, 1);
  });

  it('proportionally reduces other allocations', () => {
    const current = { equities: 50, bonds: 25, crypto: 25, cash: 0 };
    const result = adjustAllocation(current, 'equities', 70);

    // equities increased by 20, others should decrease proportionally
    // bonds and crypto were equal, so they should decrease equally
    expect(result.equities).toBe(70);
    expect(result.bonds).toBeCloseTo(result.crypto, 1);
    expect(result.bonds).toBeLessThan(25);
  });

  it('handles increasing to 100%', () => {
    const current = { equities: 50, bonds: 25, crypto: 25, cash: 0 };
    const result = adjustAllocation(current, 'equities', 100);

    expect(result.equities).toBe(100);
    expect(result.bonds).toBeCloseTo(0, 1);
    expect(result.crypto).toBeCloseTo(0, 1);
  });

  it('handles decreasing from 100%', () => {
    const current = { equities: 100, bonds: 0, crypto: 0, cash: 0 };
    // Can't decrease equities if others are all 0 - they can't increase
    const result = adjustAllocation(current, 'equities', 80);

    // Should not change since others are 0
    expect(result.equities).toBe(100);
  });

  it('handles no change', () => {
    const current = { equities: 50, bonds: 20, crypto: 20, cash: 10 };
    const result = adjustAllocation(current, 'equities', 50);

    expect(result).toEqual(current);
  });

  it('clamps value to valid range', () => {
    const current = { equities: 50, bonds: 20, crypto: 20, cash: 10 };

    // Try to set negative
    const result1 = adjustAllocation(current, 'equities', -10);
    expect(result1.equities).toBeGreaterThanOrEqual(0);

    // Try to set over 100
    const result2 = adjustAllocation(current, 'equities', 110);
    expect(result2.equities).toBeLessThanOrEqual(100);
  });

  it('handles small adjustments precisely', () => {
    const current = { equities: 50, bonds: 20, crypto: 20, cash: 10 };
    const result = adjustAllocation(current, 'equities', 51);

    const total = Object.values(result).reduce((sum, v) => sum + v, 0);
    expect(total).toBeCloseTo(100, 1);
    expect(result.equities).toBe(51);
  });

  it('preserves zero allocations', () => {
    const current = { equities: 60, bonds: 0, crypto: 30, cash: 10 };
    const result = adjustAllocation(current, 'equities', 70);

    // Bonds was 0, should stay 0
    expect(result.bonds).toBe(0);
    // Total should still be 100
    const total = Object.values(result).reduce((sum, v) => sum + v, 0);
    expect(total).toBeCloseTo(100, 1);
  });
});
