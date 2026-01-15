'use client';

import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorCard } from '@/components/ui/error-card';
import { formatCurrency } from '@/lib/utils';
import { useProjection } from '@/lib/hooks/use-projection';
import { useKeyboardShortcuts } from '@/lib/hooks/use-keyboard-shortcuts';
import {
  ProjectionChart,
  CoastFireCard,
  TimeHorizonSlider,
  ReturnSliders,
  AllocationSliders,
  ContributionInput,
  ScenarioSelector,
  SaveScenarioDialog,
  GoalAlerts,
  ExportButtons,
} from '@/components/projections';

export default function ProjectionsPage() {
  const {
    projection,
    chartData,
    goals,
    isLoading,
    error,
    settings,
    currentAllocation,
    defaultReturns,
    defaultContribution,
    effectiveReturns,
    effectiveAllocation,
    effectiveContribution,
    controls,
    reset,
    refetch,
    // Scenarios
    scenarios,
    activeScenarioId,
    hasUnsavedChanges,
    compareEnabled,
    compareScenarioId,
    comparisonProjection,
    setCompareEnabled,
    setCompareScenarioId,
    loadScenario,
    saveCurrentAsScenario,
  } = useProjection();

  // Save dialog state
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  // Chart ref for export
  const chartRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onReset: () => {
      reset();
      toast.success('Controls reset to defaults');
    },
    onShowHelp: () => {
      toast.info('Keyboard Shortcuts', {
        description: 'Press Escape to reset all controls',
        duration: 3000,
      });
    },
  });

  // Current date for header
  const currentDate = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Calculate projection years for display
  const projectionYears = Math.round(controls.projectionMonths / 12);

  // Handle return slider changes
  const handleReturnChange = (assetClass: string, value: number) => {
    const newOverrides = {
      ...(controls.returnOverrides ?? effectiveReturns),
      [assetClass]: value,
    };
    controls.setReturnOverrides(newOverrides);
  };

  const handleReturnReset = () => {
    controls.setReturnOverrides(null);
  };

  // Handle allocation slider changes
  const handleAllocationChange = (newAllocation: Record<string, number>) => {
    controls.setAllocationOverrides(newAllocation);
  };

  // Handle lock toggle
  const handleLockChange = (locked: boolean) => {
    controls.setLockToCurrentAllocation(locked);
    if (!locked && !controls.allocationOverrides) {
      // Initialize overrides with current allocation when unlocking
      controls.setAllocationOverrides({ ...currentAllocation });
    }
  };

  // Handle errors
  if (error) {
    return (
      <div className="p-6">
        <ErrorCard
          message="Failed to load projection data"
          error={error}
          onRetry={refetch}
        />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">
              Portfolio Projections
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              {projectionYears}-year projection with Coast FIRE analysis
            </p>
          </div>
          <span className="text-xs sm:text-sm text-muted-foreground">
            {currentDate}
          </span>
        </div>

        {/* Scenario controls */}
        {!isLoading && (
          <ScenarioSelector
            scenarios={scenarios ?? []}
            activeScenarioId={activeScenarioId}
            compareScenarioId={compareScenarioId}
            compareEnabled={compareEnabled}
            hasUnsavedChanges={hasUnsavedChanges}
            onSelect={(id) => {
              if (id === null) {
                reset();
              } else {
                const scenario = scenarios?.find((s) => s.id === id);
                if (scenario) {
                  loadScenario(scenario);
                }
              }
            }}
            onCompareSelect={setCompareScenarioId}
            onCompareToggle={setCompareEnabled}
            onSaveClick={() => setSaveDialogOpen(true)}
            isLoading={isLoading}
          />
        )}
      </div>

      {/* Goal Alerts */}
      {!isLoading && projection && (
        <GoalAlerts
          goals={goals}
          coastFire={projection.coastFire}
          settings={settings}
        />
      )}

      {/* Save Scenario Dialog */}
      <SaveScenarioDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        currentSettings={{
          projectionMonths: controls.projectionMonths,
          returnOverrides: controls.returnOverrides ?? undefined,
          allocationOverrides: controls.allocationOverrides ?? undefined,
          monthlyContribution: controls.monthlyContribution ?? undefined,
        }}
        existingNames={scenarios?.map((s) => s.name) ?? []}
        onSave={saveCurrentAsScenario}
      />

      {/* Chart - Full Width */}
      {isLoading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[250px] sm:h-[300px] lg:h-[350px] w-full" />
          </CardContent>
        </Card>
      ) : (
        <ProjectionChart
          ref={chartRef}
          dataPoints={chartData}
          milestones={projection?.milestones ?? []}
          showInflationAdjusted={controls.showInflationAdjusted}
          goals={goals}
          currentAge={settings?.currentAge}
          comparisonData={compareEnabled ? comparisonProjection?.dataPoints : undefined}
          comparisonLabel={scenarios?.find((s) => s.id === compareScenarioId)?.name}
          exportSlot={
            <ExportButtons
              chartRef={chartRef}
              dataPoints={projection?.dataPoints ?? []}
            />
          }
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
            currentValue={projection.dataPoints[0]?.totalValue ?? 0}
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
                    {formatCurrency(projection?.dataPoints[0]?.totalValue ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Projected Value ({projectionYears} years)
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
                    {formatCurrency(effectiveContribution)}
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

      {/* Projection Controls */}
      {!isLoading && settings && defaultReturns && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle>Projection Controls</CardTitle>
            <button
              onClick={reset}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Reset all
            </button>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Time Horizon and Contribution - Side by side on larger screens */}
            <div className="grid gap-6 sm:grid-cols-2">
              <TimeHorizonSlider
                value={controls.projectionMonths}
                onChange={controls.setProjectionMonths}
                currentAge={settings.currentAge}
                showInflationAdjusted={controls.showInflationAdjusted}
                onInflationToggle={controls.setShowInflationAdjusted}
              />
              <ContributionInput
                value={controls.monthlyContribution}
                defaultValue={defaultContribution}
                onChange={controls.setMonthlyContribution}
              />
            </div>

            {/* Expected Returns */}
            <ReturnSliders
              values={controls.returnOverrides ?? effectiveReturns}
              defaults={defaultReturns}
              onChange={handleReturnChange}
              onReset={handleReturnReset}
            />

            {/* Allocation */}
            <AllocationSliders
              values={controls.allocationOverrides ?? effectiveAllocation}
              currentAllocation={currentAllocation}
              locked={controls.lockToCurrentAllocation}
              onChange={handleAllocationChange}
              onLockChange={handleLockChange}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
