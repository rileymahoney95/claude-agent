'use client';

import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface TimeHorizonSliderProps {
  /** Current projection months (60-480) */
  value: number;
  /** Callback when value changes */
  onChange: (months: number) => void;
  /** User's current age for calculating end age */
  currentAge: number;
  /** Whether to show inflation-adjusted values */
  showInflationAdjusted: boolean;
  /** Callback when inflation toggle changes */
  onInflationToggle: (show: boolean) => void;
}

export function TimeHorizonSlider({
  value,
  onChange,
  currentAge,
  showInflationAdjusted,
  onInflationToggle,
}: TimeHorizonSliderProps) {
  const years = Math.round(value / 12);
  const endAge = currentAge + years;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Time Horizon</Label>
        <span className="text-sm text-muted-foreground">
          {years} years (age {Math.round(endAge)})
        </span>
      </div>

      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={60}
        max={480}
        step={12}
        className="w-full"
      />

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>5 years</span>
        <span>40 years</span>
      </div>

      <div className="flex items-center space-x-2 pt-2">
        <Checkbox
          id="inflation-adjusted"
          checked={showInflationAdjusted}
          onCheckedChange={(checked) => onInflationToggle(checked === true)}
        />
        <Label
          htmlFor="inflation-adjusted"
          className="text-sm font-normal cursor-pointer"
        >
          Show inflation-adjusted values
        </Label>
      </div>
    </div>
  );
}
