'use client';

import { Star, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ProjectionScenario } from '@/lib/projection';

interface ScenarioSelectorProps {
  scenarios: ProjectionScenario[];
  activeScenarioId: number | null;
  compareScenarioId: number | null;
  compareEnabled: boolean;
  hasUnsavedChanges: boolean;
  onSelect: (id: number | null) => void;
  onCompareSelect: (id: number | null) => void;
  onCompareToggle: (enabled: boolean) => void;
  onSaveClick: () => void;
  isLoading?: boolean;
}

export function ScenarioSelector({
  scenarios,
  activeScenarioId,
  compareScenarioId,
  compareEnabled,
  hasUnsavedChanges,
  onSelect,
  onCompareSelect,
  onCompareToggle,
  onSaveClick,
  isLoading,
}: ScenarioSelectorProps) {
  // Get the active scenario for display
  const activeScenario = scenarios.find((s) => s.id === activeScenarioId);

  // Scenarios available for comparison (exclude active)
  const comparisonScenarios = scenarios.filter(
    (s) => s.id !== activeScenarioId
  );

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
      {/* Scenario selector */}
      <div className="flex items-center gap-2">
        <Select
          value={activeScenarioId?.toString() ?? 'current'}
          onValueChange={(value) => {
            if (value === 'current') {
              onSelect(null);
            } else {
              onSelect(parseInt(value, 10));
            }
          }}
          disabled={isLoading}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select scenario">
              {activeScenarioId === null ? (
                <span className="flex items-center gap-1.5">
                  Current
                  {hasUnsavedChanges && (
                    <span className="text-xs text-muted-foreground">
                      (unsaved)
                    </span>
                  )}
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  {activeScenario?.isPrimary && (
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  )}
                  {activeScenario?.name}
                  {hasUnsavedChanges && (
                    <span className="text-xs text-muted-foreground">*</span>
                  )}
                </span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">
              <span className="flex items-center gap-1.5">Current</span>
            </SelectItem>
            {scenarios.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  Saved Scenarios
                </div>
                {scenarios.map((scenario) => (
                  <SelectItem
                    key={scenario.id}
                    value={scenario.id.toString()}
                  >
                    <span className="flex items-center gap-1.5">
                      {scenario.isPrimary && (
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      )}
                      {scenario.name}
                    </span>
                  </SelectItem>
                ))}
              </>
            )}
          </SelectContent>
        </Select>

        {/* Save button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onSaveClick}
          disabled={isLoading}
          className="gap-1.5"
        >
          <Save className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Save</span>
        </Button>
      </div>

      {/* Compare toggle and selector */}
      {comparisonScenarios.length > 0 && (
        <div className="flex items-center gap-2">
          <Checkbox
            id="compare-toggle"
            checked={compareEnabled}
            onCheckedChange={(checked) => onCompareToggle(checked === true)}
            disabled={isLoading}
          />
          <Label
            htmlFor="compare-toggle"
            className="text-sm text-muted-foreground cursor-pointer"
          >
            Compare
          </Label>

          {compareEnabled && (
            <Select
              value={compareScenarioId?.toString() ?? ''}
              onValueChange={(value) => {
                onCompareSelect(value ? parseInt(value, 10) : null);
              }}
              disabled={isLoading}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {comparisonScenarios.map((scenario) => (
                  <SelectItem
                    key={scenario.id}
                    value={scenario.id.toString()}
                  >
                    <span className="flex items-center gap-1.5">
                      {scenario.isPrimary && (
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      )}
                      {scenario.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}
    </div>
  );
}
