'use client';

import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RotateCcw } from 'lucide-react';

const ASSET_CLASS_LABELS: Record<string, string> = {
  equities: 'Equities',
  bonds: 'Bonds',
  crypto: 'Crypto',
  cash: 'Cash',
};

const ASSET_CLASS_ORDER = ['equities', 'bonds', 'crypto', 'cash'];

interface ReturnSlidersProps {
  /** Current return values (percentages, e.g., 7.0 for 7%) */
  values: Record<string, number>;
  /** Default return values */
  defaults: Record<string, number>;
  /** Callback when any value changes */
  onChange: (assetClass: string, value: number) => void;
  /** Callback to reset all to defaults */
  onReset: () => void;
}

export function ReturnSliders({
  values,
  defaults,
  onChange,
  onReset,
}: ReturnSlidersProps) {
  const hasChanges = ASSET_CLASS_ORDER.some(
    (ac) => (values[ac] ?? defaults[ac]) !== defaults[ac]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Expected Returns</Label>
        {hasChanges && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-7 px-2 text-xs"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {ASSET_CLASS_ORDER.map((assetClass) => {
          const value = values[assetClass] ?? defaults[assetClass] ?? 0;
          const defaultValue = defaults[assetClass] ?? 0;
          const isModified = Math.abs(value - defaultValue) > 0.01;

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
                      (default: {defaultValue}%)
                    </span>
                  )}
                </span>
              </div>
              <Slider
                value={[value]}
                onValueChange={([v]) => onChange(assetClass, v)}
                min={0}
                max={25}
                step={0.5}
                className="w-full"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
