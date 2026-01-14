/**
 * Case conversion utilities for API response transformation.
 *
 * Pattern:
 * - API returns snake_case (Python convention)
 * - Frontend uses camelCase (TypeScript convention)
 * - converters.ts provides bidirectional conversion
 */

import type {
  ProjectionSettingsAPI,
  ProjectionHistoryDataPoint,
  ScenarioSettingsAPI,
  ProjectionScenarioAPI,
} from './types';

import type {
  ProjectionSettings,
  HistoricalDataPoint,
  ScenarioSettings,
  ProjectionScenario,
} from './projection';

// =============================================================================
// PROJECTION SETTINGS
// =============================================================================

export function toProjectionSettings(
  api: ProjectionSettingsAPI
): ProjectionSettings {
  return {
    expectedReturns: api.expected_returns,
    inflationRate: api.inflation_rate,
    withdrawalRate: api.withdrawal_rate,
    targetRetirementAge: api.target_retirement_age,
    currentAge: api.current_age,
  };
}

export function fromProjectionSettings(
  settings: Partial<ProjectionSettings>
): Partial<ProjectionSettingsAPI> {
  const result: Partial<ProjectionSettingsAPI> = {};

  if (settings.expectedReturns !== undefined) {
    result.expected_returns = settings.expectedReturns;
  }
  if (settings.inflationRate !== undefined) {
    result.inflation_rate = settings.inflationRate;
  }
  if (settings.withdrawalRate !== undefined) {
    result.withdrawal_rate = settings.withdrawalRate;
  }
  if (settings.targetRetirementAge !== undefined) {
    result.target_retirement_age = settings.targetRetirementAge;
  }
  if (settings.currentAge !== undefined) {
    result.current_age = settings.currentAge;
  }

  return result;
}

// =============================================================================
// HISTORICAL DATA
// =============================================================================

export function toHistoricalDataPoint(
  api: ProjectionHistoryDataPoint
): HistoricalDataPoint {
  return {
    date: api.date,
    totalValue: api.total_value,
    byAssetClass: api.by_asset_class,
  };
}

export function toHistoricalDataPoints(
  api: ProjectionHistoryDataPoint[]
): HistoricalDataPoint[] {
  return api.map(toHistoricalDataPoint);
}

// =============================================================================
// SCENARIO SETTINGS
// =============================================================================

export function toScenarioSettings(api: ScenarioSettingsAPI): ScenarioSettings {
  return {
    allocationOverrides: api.allocation_overrides ?? undefined,
    returnOverrides: api.return_overrides ?? undefined,
    monthlyContribution: api.monthly_contribution ?? undefined,
    projectionMonths: api.projection_months ?? undefined,
  };
}

export function fromScenarioSettings(
  settings: ScenarioSettings
): ScenarioSettingsAPI {
  return {
    allocation_overrides: settings.allocationOverrides,
    return_overrides: settings.returnOverrides,
    monthly_contribution: settings.monthlyContribution,
    projection_months: settings.projectionMonths,
  };
}

// =============================================================================
// SCENARIOS
// =============================================================================

export function toProjectionScenario(
  api: ProjectionScenarioAPI
): ProjectionScenario {
  return {
    id: api.id,
    name: api.name,
    settings: toScenarioSettings(api.settings),
    isPrimary: api.is_primary,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
  };
}

export function toProjectionScenarios(
  api: ProjectionScenarioAPI[]
): ProjectionScenario[] {
  return api.map(toProjectionScenario);
}
