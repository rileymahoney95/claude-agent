'use client';

import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { adjustAllocation } from '@/lib/hooks/use-projection';

const ASSET_CLASS_LABELS: Record<string, string> = {
  equities: 'Equities',
  bonds: 'Bonds',
  crypto: 'Crypto',
  cash: 'Cash',
};

const ASSET_CLASS_ORDER = ['equities', 'bonds', 'crypto', 'cash'];

interface AllocationSlidersProps {
  /** Current allocation values (percentages, sum to 100) */
  values: Record<string, number>;
  /** Portfolio's actual current allocation */
  currentAllocation: Record<string, number>;
  /** Whether allocation is locked to current portfolio */
  locked: boolean;
  /** Callback when any value changes */
  onChange: (newAllocation: Record<string, number>) => void;
  /** Callback when lock state changes */
  onLockChange: (locked: boolean) => void;
}

export function AllocationSliders({
  values,
  currentAllocation,
  locked,
  onChange,
  onLockChange,
}: AllocationSlidersProps) {
  // Use current allocation when locked, otherwise use override values
  const displayValues = locked ? currentAllocation : values;

  const handleSliderChange = (assetClass: string, newValue: number) => {
    const adjusted = adjustAllocation(displayValues, assetClass, newValue);
    onChange(adjusted);
  };

  // Check if any value differs significantly from current
  const hasChanges = !locked && ASSET_CLASS_ORDER.some(
    (ac) => Math.abs((values[ac] ?? 0) - (currentAllocation[ac] ?? 0)) > 0.5
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Target Allocation</Label>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="lock-allocation"
            checked={locked}
            onCheckedChange={(checked) => onLockChange(checked === true)}
          />
          <Label
            htmlFor="lock-allocation"
            className="text-xs font-normal cursor-pointer"
          >
            Lock to current
          </Label>
        </div>
      </div>

      {hasChanges && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Allocation differs from current portfolio
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {ASSET_CLASS_ORDER.map((assetClass) => {
          const value = displayValues[assetClass] ?? 0;
          const currentValue = currentAllocation[assetClass] ?? 0;
          const isModified = !locked && Math.abs(value - currentValue) > 0.5;

          return (
            <div key={assetClass} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {ASSET_CLASS_LABELS[assetClass]}
                </span>
                <span className="text-xs">
                  <span className={isModified ? 'text-primary font-medium' : ''}>
                    {value.toFixed(1)}%
                  </span>
                  {isModified && (
                    <span className="text-muted-foreground ml-1">
                      (current: {currentValue.toFixed(1)}%)
                    </span>
                  )}
                </span>
              </div>
              <Slider
                value={[value]}
                onValueChange={([v]) => handleSliderChange(assetClass, v)}
                min={0}
                max={100}
                step={1}
                disabled={locked}
                className="w-full"
              />
            </div>
          );
        })}
      </div>

      {!locked && (
        <p className="text-xs text-muted-foreground">
          Total: {ASSET_CLASS_ORDER.reduce((sum, ac) => sum + (displayValues[ac] ?? 0), 0).toFixed(1)}%
        </p>
      )}
    </div>
  );
}
