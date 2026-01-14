'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorCard } from '@/components/ui/error-card';
import { usePortfolio } from '@/lib/hooks/use-portfolio';
import { useProfile } from '@/lib/hooks/use-profile';
import {
  useProjectionHistory,
  useProjectionSettings,
} from '@/lib/hooks/use-projections';
import { formatCurrency } from '@/lib/utils';
import { calculateProjection, type ProjectionSettings } from '@/lib/projection';
import { ProjectionChart, CoastFireCard } from '@/components/projections';
import type { Portfolio, ProfileResponse } from '@/lib/types';

// Default projection: 20 years (240 months)
const DEFAULT_PROJECTION_MONTHS = 240;

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
 * Derive retirement target from long-term goal (annual spending / SWR).
 */
function deriveRetirementTarget(
  profile: ProfileResponse | undefined,
  settings: ProjectionSettings
): number {
  const annualSpending = profile?.goals?.long_term?.target;
  if (!annualSpending) return 1_500_000; // Default fallback ($60K / 4%)
  return annualSpending / (settings.withdrawalRate / 100);
}

/**
 * Calculate monthly surplus from profile cash flow.
 */
function getMonthlyContribution(profile: ProfileResponse | undefined): number {
  if (!profile?.monthly_cash_flow) return 0;
  const cf = profile.monthly_cash_flow;
  // Surplus = income - expenses - contributions (already being invested)
  // But for projection, we want how much is being invested
  return (
    (cf.crypto_contributions ?? 0) +
    (cf.roth_contributions ?? 0) +
    (cf.hsa_contributions ?? 0)
  );
}

export default function ProjectionsPage() {
  // Fetch all required data
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

  // Combined loading and error states
  const isLoading =
    portfolioLoading || profileLoading || settingsLoading || historyLoading;
  const error = portfolioError || profileError || settingsError || historyError;

  // Calculate projection (memoized)
  const projection = useMemo(() => {
    if (!portfolio || !settings) return null;

    return calculateProjection({
      currentPortfolio: {
        totalValue: portfolio.total_value,
        byAssetClass: mapPortfolioToAssetClasses(portfolio),
      },
      settings,
      monthlyContribution: getMonthlyContribution(profile),
      projectionMonths: DEFAULT_PROJECTION_MONTHS,
      retirementTarget: deriveRetirementTarget(profile, settings),
    });
  }, [portfolio, settings, profile]);

  // Combine historical and projected data points
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
        monthIndex: -1, // Historical data doesn't have month index
        age: settings
          ? settings.currentAge -
            (new Date().getTime() - new Date(point.date).getTime()) /
              (365.25 * 24 * 60 * 60 * 1000)
          : 0,
        totalValue: point.totalValue,
        byAssetClass: point.byAssetClass,
        inflationAdjustedValue: point.totalValue, // No adjustment for historical
        isHistorical: true,
      }));

      // Merge historical with projection, avoiding duplicate for current month
      return [...historicalPoints, ...projectedPoints.slice(1)];
    }

    return projectedPoints;
  }, [history, projection, settings]);

  // Current date for header
  const currentDate = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Handle errors
  if (error) {
    return (
      <div className="p-6">
        <ErrorCard
          message="Failed to load projection data"
          error={error}
          onRetry={() => {
            refetchPortfolio();
            refetchProfile();
            refetchSettings();
            refetchHistory();
          }}
        />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">
            Portfolio Projections
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            20-year projection with Coast FIRE analysis
          </p>
        </div>
        <span className="text-xs sm:text-sm text-muted-foreground">
          {currentDate}
        </span>
      </div>

      {/* Chart - Full Width */}
      {isLoading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[350px] w-full" />
          </CardContent>
        </Card>
      ) : (
        <ProjectionChart
          dataPoints={chartData}
          milestones={projection?.milestones ?? []}
        />
      )}

      {/* Stats Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Coast FIRE Card */}
        {isLoading ? (
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3 w-full" />
              <div className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
              </div>
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        ) : projection ? (
          <CoastFireCard
            coastFire={projection.coastFire}
            currentValue={portfolio?.total_value ?? 0}
          />
        ) : null}

        {/* Summary Stats Card */}
        <Card>
          <CardHeader>
            <CardTitle>Projection Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <>
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Current Portfolio</span>
                  <span className="font-medium">
                    {formatCurrency(portfolio?.total_value ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Projected Value (20 years)
                  </span>
                  <span className="font-medium">
                    {formatCurrency(projection?.finalValue ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Inflation-Adjusted Value
                  </span>
                  <span className="font-medium">
                    {formatCurrency(projection?.finalInflationAdjusted ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Monthly Contribution
                  </span>
                  <span className="font-medium">
                    {formatCurrency(getMonthlyContribution(profile))}
                  </span>
                </div>
                {settings && (
                  <div className="flex justify-between text-sm pt-2 border-t">
                    <span className="text-muted-foreground">
                      Target Retirement Age
                    </span>
                    <span className="font-medium">
                      {settings.targetRetirementAge}
                    </span>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Settings Info */}
      {!isLoading && settings && (
        <Card>
          <CardHeader>
            <CardTitle>Assumptions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">
                  Equities Return
                </div>
                <div className="text-sm font-medium">
                  {settings.expectedReturns.equities}% / year
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Crypto Return</div>
                <div className="text-sm font-medium">
                  {settings.expectedReturns.crypto}% / year
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Cash Return</div>
                <div className="text-sm font-medium">
                  {settings.expectedReturns.cash}% / year
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Inflation Rate</div>
                <div className="text-sm font-medium">
                  {settings.inflationRate}% / year
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
