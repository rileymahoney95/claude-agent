'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/utils';

interface ContributionInputProps {
  /** Current value (null means use default) */
  value: number | null;
  /** Default calculated from profile */
  defaultValue: number;
  /** Callback when value changes */
  onChange: (value: number | null) => void;
}

export function ContributionInput({
  value,
  defaultValue,
  onChange,
}: ContributionInputProps) {
  const displayValue = value ?? defaultValue;
  const isModified = value !== null && Math.abs(value - defaultValue) > 0.01;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^0-9.]/g, '');
    if (rawValue === '') {
      onChange(null); // Reset to default
      return;
    }
    const parsed = parseFloat(rawValue);
    if (!isNaN(parsed)) {
      onChange(Math.max(0, parsed));
    }
  };

  const handleBlur = () => {
    // If the value is very close to default, reset to null
    if (value !== null && Math.abs(value - defaultValue) < 0.01) {
      onChange(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="contribution" className="text-sm font-medium">
          Monthly Contribution
        </Label>
        {isModified && (
          <button
            onClick={() => onChange(null)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Reset
          </button>
        )}
      </div>

      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          $
        </span>
        <Input
          id="contribution"
          type="text"
          inputMode="decimal"
          value={displayValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          onChange={handleChange}
          onBlur={handleBlur}
          className="pl-7"
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Surplus from profile: {formatCurrency(defaultValue)}/mo
        {isModified && (
          <span className="text-primary ml-1">
            ({value! > defaultValue ? '+' : ''}{formatCurrency(value! - defaultValue)})
          </span>
        )}
      </p>
    </div>
  );
}
