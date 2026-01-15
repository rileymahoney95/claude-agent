/**
 * Unified projection hook for interactive projections page.
 *
 * Manages local state for interactive controls (sliders, inputs) that
 * don't require API calls on change. Combines fetched data with local
 * state to produce memoized projection results.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { usePortfolio } from './use-portfolio';
import { useProfile } from './use-profile';
import {
  useProjectionHistory,
  useProjectionSettings,
  useProjectionScenarios,
  useCreateScenario,
} from './use-projections';
import {
  calculateProjection,
  type ProjectionSettings,
  type ProjectionPoint,
  type ProjectionResult,
  type ProjectionScenario,
  type ScenarioSettings,
} from '@/lib/projection';
import { loadProjectionPrefs, saveProjectionPrefs } from '@/lib/storage';
import type { Portfolio, ProfileResponse, Goals } from '@/lib/types';

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_PROJECTION_MONTHS = 240; // 20 years
const DEFAULT_ASSET_CLASSES = ['equities', 'bonds', 'crypto', 'cash'] as const;

/**
 * Simple deep equality check for objects (used for detecting unsaved changes).
 */
function isEqual(
  a: Record<string, number> | null | undefined,
  b: Record<string, number> | null | undefined
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => Math.abs((a[key] ?? 0) - (b[key] ?? 0)) < 0.01);
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Map portfolio categories to asset classes for the projection engine.
 */
function mapPortfolioToAssetClasses(
  portfolio: Portfolio
): Record<string, number> {
  const byCategory = portfolio.by_category;
  return {
    equities:
      (byCategory?.retirement?.value ?? 0) +
      (byCategory?.taxable_equities?.value ?? 0),
    bonds: 0, // Not currently tracked
    crypto: byCategory?.crypto?.value ?? 0,
    cash: byCategory?.cash?.value ?? 0,
  };
}

/**
 * Calculate allocation percentages from asset values.
 */
function calculateAllocation(
  byAssetClass: Record<string, number>
): Record<string, number> {
  const total = Object.values(byAssetClass).reduce((sum, v) => sum + v, 0);
  if (total === 0) {
    return { equities: 25, bonds: 25, crypto: 25, cash: 25 };
  }

  const allocation: Record<string, number> = {};
  for (const assetClass of DEFAULT_ASSET_CLASSES) {
    const value = byAssetClass[assetClass] ?? 0;
    allocation[assetClass] = Math.round((value / total) * 1000) / 10;
  }
  return allocation;
}

/**
 * Derive retirement target from long-term goal (annual spending / SWR).
 */
function deriveRetirementTarget(
  profile: ProfileResponse | undefined,
  settings: ProjectionSettings | undefined
): number {
  if (!settings) return 1_500_000;
  const annualSpending = profile?.goals?.long_term?.target;
  if (!annualSpending) return 1_500_000; // Default fallback ($60K / 4%)
  return annualSpending / (settings.withdrawalRate / 100);
}

/**
 * Calculate monthly contribution from profile cash flow.
 */
function getMonthlyContribution(profile: ProfileResponse | undefined): number {
  if (!profile?.monthly_cash_flow) return 0;
  const cf = profile.monthly_cash_flow;
  return (
    (cf.crypto_contributions ?? 0) +
    (cf.roth_contributions ?? 0) +
    (cf.hsa_contributions ?? 0)
  );
}

/**
 * Adjust allocation when one slider changes to maintain sum of 100%.
 * Proportionally adjusts other asset classes.
 */
export function adjustAllocation(
  current: Record<string, number>,
  changed: string,
  newValue: number
): Record<string, number> {
  // Clamp to valid range
  newValue = Math.max(0, Math.min(100, newValue));

  const oldValue = current[changed] ?? 0;
  const delta = newValue - oldValue;

  if (Math.abs(delta) < 0.01) {
    return current;
  }

  const others = Object.keys(current).filter((k) => k !== changed);
  const othersSum = others.reduce((sum, k) => sum + (current[k] ?? 0), 0);

  // If all others are 0 and we're increasing, can't adjust
  if (othersSum === 0 && delta > 0) {
    return current;
  }

  const result: Record<string, number> = { ...current, [changed]: newValue };

  // Distribute delta proportionally among others
  for (const key of others) {
    const currentVal = current[key] ?? 0;
    if (othersSum > 0) {
      result[key] = Math.max(0, currentVal - (delta * currentVal) / othersSum);
    }
  }

  // Normalize to exactly 100%
  const total = Object.values(result).reduce((a, b) => a + b, 0);
  if (total > 0) {
    for (const key of Object.keys(result)) {
      result[key] = Math.round((result[key] / total) * 1000) / 10;
    }
  }

  return result;
}

// =============================================================================
// TYPES
// =============================================================================

export interface ProjectionControls {
  projectionMonths: number;
  setProjectionMonths: (months: number) => void;
  returnOverrides: Record<string, number> | null;
  setReturnOverrides: (overrides: Record<string, number> | null) => void;
  allocationOverrides: Record<string, number> | null;
  setAllocationOverrides: (overrides: Record<string, number> | null) => void;
  monthlyContribution: number | null;
  setMonthlyContribution: (amount: number | null) => void;
  showInflationAdjusted: boolean;
  setShowInflationAdjusted: (show: boolean) => void;
  lockToCurrentAllocation: boolean;
  setLockToCurrentAllocation: (locked: boolean) => void;
}

export interface UseProjectionResult {
  // Data
  projection: ProjectionResult | null;
  chartData: ProjectionPoint[];
  goals: Goals | undefined;

  // Loading/error
  isLoading: boolean;
  error: Error | null;

  // Settings
  settings: ProjectionSettings | undefined;
  currentAllocation: Record<string, number>;
  currentAssetValues: Record<string, number>;
  defaultReturns: Record<string, number> | undefined;
  defaultContribution: number;

  // Effective values (resolved from overrides or defaults)
  effectiveReturns: Record<string, number>;
  effectiveAllocation: Record<string, number>;
  effectiveContribution: number;

  // Controls
  controls: ProjectionControls;

  // Scenarios
  scenarios: ProjectionScenario[] | undefined;
  activeScenarioId: number | null;
  activeScenario: ProjectionScenario | null;
  hasUnsavedChanges: boolean;
  compareEnabled: boolean;
  compareScenarioId: number | null;
  comparisonProjection: ProjectionResult | null;

  // Scenario actions
  setActiveScenarioId: (id: number | null) => void;
  setCompareEnabled: (enabled: boolean) => void;
  setCompareScenarioId: (id: number | null) => void;
  loadScenario: (scenario: ProjectionScenario) => void;
  saveCurrentAsScenario: (name: string, isPrimary: boolean) => Promise<void>;

  // Actions
  reset: () => void;
  refetch: () => void;
}

// =============================================================================
// HOOK
// =============================================================================

export function useProjection(): UseProjectionResult {
  // ===========================================================================
  // Fetched data
  // ===========================================================================

  const {
    data: portfolio,
    isLoading: portfolioLoading,
    error: portfolioError,
    refetch: refetchPortfolio,
  } = usePortfolio();

  const {
    data: profile,
    isLoading: profileLoading,
    error: profileError,
    refetch: refetchProfile,
  } = useProfile();

  const {
    data: settings,
    isLoading: settingsLoading,
    error: settingsError,
    refetch: refetchSettings,
  } = useProjectionSettings();

  const {
    data: history,
    isLoading: historyLoading,
    error: historyError,
    refetch: refetchHistory,
  } = useProjectionHistory(12);

  const {
    data: scenarios,
    isLoading: scenariosLoading,
    refetch: refetchScenarios,
  } = useProjectionScenarios();

  const createScenarioMutation = useCreateScenario();

  // ===========================================================================
  // Scenario state
  // ===========================================================================

  const [activeScenarioId, setActiveScenarioId] = useState<number | null>(null);
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [compareScenarioId, setCompareScenarioId] = useState<number | null>(null);
  const initialLoadDone = useRef(false);
  const prefsLoadedRef = useRef(false);

  // ===========================================================================
  // Local interactive state
  // ===========================================================================

  const [projectionMonths, setProjectionMonths] = useState(DEFAULT_PROJECTION_MONTHS);
  const [returnOverrides, setReturnOverrides] = useState<Record<string, number> | null>(null);
  const [allocationOverrides, setAllocationOverrides] = useState<Record<string, number> | null>(null);
  const [monthlyContribution, setMonthlyContribution] = useState<number | null>(null);
  const [showInflationAdjusted, setShowInflationAdjusted] = useState(false);
  const [lockToCurrentAllocation, setLockToCurrentAllocation] = useState(true);

  // ===========================================================================
  // localStorage persistence
  // ===========================================================================

  // Load preferences from localStorage on mount
  useEffect(() => {
    if (prefsLoadedRef.current) return;
    prefsLoadedRef.current = true;

    const prefs = loadProjectionPrefs();
    setProjectionMonths(prefs.projectionMonths);
    setShowInflationAdjusted(prefs.showInflationAdjusted);
    setLockToCurrentAllocation(prefs.lockToCurrentAllocation);
  }, []);

  // Save preferences to localStorage on change (debounced)
  useEffect(() => {
    // Skip the initial render before prefs are loaded
    if (!prefsLoadedRef.current) return;

    const timeout = setTimeout(() => {
      saveProjectionPrefs({
        projectionMonths,
        showInflationAdjusted,
        lockToCurrentAllocation,
      });
    }, 500);

    return () => clearTimeout(timeout);
  }, [projectionMonths, showInflationAdjusted, lockToCurrentAllocation]);

  // ===========================================================================
  // Derived values
  // ===========================================================================

  const currentAssetValues = useMemo(() => {
    if (!portfolio) return { equities: 0, bonds: 0, crypto: 0, cash: 0 };
    return mapPortfolioToAssetClasses(portfolio);
  }, [portfolio]);

  const currentAllocation = useMemo(() => {
    return calculateAllocation(currentAssetValues);
  }, [currentAssetValues]);

  const defaultContribution = useMemo(() => {
    return getMonthlyContribution(profile);
  }, [profile]);

  // Effective values (resolved from overrides or defaults)
  const effectiveReturns = useMemo(() => {
    if (returnOverrides) {
      return { ...settings?.expectedReturns, ...returnOverrides };
    }
    return settings?.expectedReturns ?? { equities: 7, bonds: 4, crypto: 12, cash: 4.5 };
  }, [returnOverrides, settings?.expectedReturns]);

  const effectiveAllocation = useMemo(() => {
    if (lockToCurrentAllocation || !allocationOverrides) {
      return currentAllocation;
    }
    return allocationOverrides;
  }, [lockToCurrentAllocation, allocationOverrides, currentAllocation]);

  const effectiveContribution = monthlyContribution ?? defaultContribution;

  // ===========================================================================
  // Memoized projection calculation
  // ===========================================================================

  const projection = useMemo(() => {
    if (!portfolio || !settings) return null;

    return calculateProjection({
      currentPortfolio: {
        totalValue: portfolio.total_value,
        byAssetClass: currentAssetValues,
      },
      settings: {
        ...settings,
        expectedReturns: effectiveReturns,
      },
      monthlyContribution: effectiveContribution,
      allocationOverrides: lockToCurrentAllocation ? undefined : allocationOverrides ?? undefined,
      projectionMonths,
      retirementTarget: deriveRetirementTarget(profile, settings),
    });
  }, [
    portfolio,
    settings,
    profile,
    currentAssetValues,
    effectiveReturns,
    effectiveContribution,
    allocationOverrides,
    lockToCurrentAllocation,
    projectionMonths,
  ]);

  // ===========================================================================
  // Combined chart data (history + projection)
  // ===========================================================================

  const chartData = useMemo(() => {
    if (!projection) return [];

    // Mark projected data points
    const projectedPoints = projection.dataPoints.map((point) => ({
      ...point,
      isHistorical: false,
    }));

    // If we have historical data, prepend it
    if (history?.dataPoints && history.dataPoints.length > 0) {
      const historicalPoints = history.dataPoints.map((point) => ({
        date: point.date,
        monthIndex: -1,
        age: settings
          ? settings.currentAge -
            (new Date().getTime() - new Date(point.date).getTime()) /
              (365.25 * 24 * 60 * 60 * 1000)
          : 0,
        totalValue: point.totalValue,
        byAssetClass: point.byAssetClass,
        inflationAdjustedValue: point.totalValue,
        isHistorical: true,
      }));

      // Merge historical with projection, avoiding duplicate for current month
      return [...historicalPoints, ...projectedPoints.slice(1)];
    }

    return projectedPoints;
  }, [history, projection, settings]);

  // ===========================================================================
  // Scenario-derived values
  // ===========================================================================

  const activeScenario = useMemo(() => {
    if (activeScenarioId === null || !scenarios) return null;
    return scenarios.find((s) => s.id === activeScenarioId) ?? null;
  }, [activeScenarioId, scenarios]);

  const hasUnsavedChanges = useMemo(() => {
    // "Current" mode is always considered unsaved
    if (!activeScenario) return true;

    const { settings: scenarioSettings } = activeScenario;
    return (
      projectionMonths !== (scenarioSettings.projectionMonths ?? DEFAULT_PROJECTION_MONTHS) ||
      !isEqual(returnOverrides, scenarioSettings.returnOverrides ?? null) ||
      !isEqual(allocationOverrides, scenarioSettings.allocationOverrides ?? null) ||
      monthlyContribution !== (scenarioSettings.monthlyContribution ?? null)
    );
  }, [activeScenario, projectionMonths, returnOverrides, allocationOverrides, monthlyContribution]);

  // Comparison projection (runs calculateProjection with compare scenario settings)
  const comparisonProjection = useMemo(() => {
    if (!compareEnabled || !compareScenarioId || !portfolio || !settings) return null;

    const scenario = scenarios?.find((s) => s.id === compareScenarioId);
    if (!scenario) return null;

    const scenarioSettings = scenario.settings;

    return calculateProjection({
      currentPortfolio: {
        totalValue: portfolio.total_value,
        byAssetClass: currentAssetValues,
      },
      settings: {
        ...settings,
        expectedReturns: scenarioSettings.returnOverrides ?? settings.expectedReturns,
      },
      monthlyContribution: scenarioSettings.monthlyContribution ?? defaultContribution,
      allocationOverrides: scenarioSettings.allocationOverrides,
      projectionMonths: scenarioSettings.projectionMonths ?? DEFAULT_PROJECTION_MONTHS,
      retirementTarget: deriveRetirementTarget(profile, settings),
    });
  }, [
    compareEnabled,
    compareScenarioId,
    scenarios,
    portfolio,
    settings,
    profile,
    currentAssetValues,
    defaultContribution,
  ]);

  // ===========================================================================
  // Combined loading and error states
  // ===========================================================================

  const isLoading = portfolioLoading || profileLoading || settingsLoading || historyLoading || scenariosLoading;
  const error = portfolioError || profileError || settingsError || historyError || null;

  // ===========================================================================
  // Scenario actions
  // ===========================================================================

  const loadScenario = useCallback((scenario: ProjectionScenario) => {
    const { settings: scenarioSettings } = scenario;
    setProjectionMonths(scenarioSettings.projectionMonths ?? DEFAULT_PROJECTION_MONTHS);
    setReturnOverrides(scenarioSettings.returnOverrides ?? null);
    setAllocationOverrides(scenarioSettings.allocationOverrides ?? null);
    setMonthlyContribution(scenarioSettings.monthlyContribution ?? null);
    setActiveScenarioId(scenario.id);
    // When loading a saved scenario with allocation, unlock
    if (scenarioSettings.allocationOverrides) {
      setLockToCurrentAllocation(false);
    }
  }, []);

  const saveCurrentAsScenario = useCallback(
    async (name: string, isPrimary: boolean) => {
      const scenarioSettings: ScenarioSettings = {
        projectionMonths,
        returnOverrides: returnOverrides ?? undefined,
        allocationOverrides: allocationOverrides ?? undefined,
        monthlyContribution: monthlyContribution ?? undefined,
      };

      const result = await createScenarioMutation.mutateAsync({
        name,
        settings: scenarioSettings,
        isPrimary,
      });

      // Set the newly created scenario as active
      if (result?.scenario?.id) {
        setActiveScenarioId(result.scenario.id);
      }
    },
    [projectionMonths, returnOverrides, allocationOverrides, monthlyContribution, createScenarioMutation]
  );

  // ===========================================================================
  // Auto-load primary scenario on initial load
  // ===========================================================================

  useEffect(() => {
    if (scenarios && !initialLoadDone.current) {
      initialLoadDone.current = true;
      const primary = scenarios.find((s) => s.isPrimary);
      if (primary) {
        loadScenario(primary);
      }
    }
  }, [scenarios, loadScenario]);

  // ===========================================================================
  // Actions
  // ===========================================================================

  const reset = useCallback(() => {
    setProjectionMonths(DEFAULT_PROJECTION_MONTHS);
    setReturnOverrides(null);
    setAllocationOverrides(null);
    setMonthlyContribution(null);
    setShowInflationAdjusted(false);
    setLockToCurrentAllocation(true);
    setActiveScenarioId(null);
  }, []);

  const refetch = useCallback(() => {
    refetchPortfolio();
    refetchProfile();
    refetchSettings();
    refetchHistory();
    refetchScenarios();
  }, [refetchPortfolio, refetchProfile, refetchSettings, refetchHistory, refetchScenarios]);

  // ===========================================================================
  // Return
  // ===========================================================================

  return {
    // Data
    projection,
    chartData,
    goals: profile?.goals,

    // Loading/error
    isLoading,
    error,

    // Settings
    settings,
    currentAllocation,
    currentAssetValues,
    defaultReturns: settings?.expectedReturns,
    defaultContribution,

    // Effective values
    effectiveReturns,
    effectiveAllocation,
    effectiveContribution,

    // Controls
    controls: {
      projectionMonths,
      setProjectionMonths,
      returnOverrides,
      setReturnOverrides,
      allocationOverrides,
      setAllocationOverrides,
      monthlyContribution,
      setMonthlyContribution,
      showInflationAdjusted,
      setShowInflationAdjusted,
      lockToCurrentAllocation,
      setLockToCurrentAllocation,
    },

    // Scenarios
    scenarios,
    activeScenarioId,
    activeScenario,
    hasUnsavedChanges,
    compareEnabled,
    compareScenarioId,
    comparisonProjection,

    // Scenario actions
    setActiveScenarioId,
    setCompareEnabled,
    setCompareScenarioId,
    loadScenario,
    saveCurrentAsScenario,

    // Actions
    reset,
    refetch,
  };
}
