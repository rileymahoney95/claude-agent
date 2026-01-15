'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/utils';
import type { ScenarioSettings } from '@/lib/projection';

interface SaveScenarioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSettings: ScenarioSettings;
  existingNames: string[];
  onSave: (name: string, isPrimary: boolean) => Promise<void>;
  isLoading?: boolean;
}

export function SaveScenarioDialog({
  open,
  onOpenChange,
  currentSettings,
  existingNames,
  onSave,
  isLoading,
}: SaveScenarioDialogProps) {
  const [name, setName] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setName('');
      setIsPrimary(false);
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate name
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Scenario name is required');
      return;
    }

    // Check for duplicate name
    if (existingNames.some((n) => n.toLowerCase() === trimmedName.toLowerCase())) {
      setError('A scenario with this name already exists');
      return;
    }

    try {
      await onSave(trimmedName, isPrimary);
      onOpenChange(false);
    } catch {
      setError('Failed to save scenario');
    }
  };

  // Format projection months as years
  const projectionYears = currentSettings.projectionMonths
    ? Math.round(currentSettings.projectionMonths / 12)
    : 20;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Save Scenario</DialogTitle>
            <DialogDescription>
              Save your current projection settings as a named scenario for
              future reference.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Scenario name input */}
            <div className="space-y-2">
              <Label htmlFor="scenario-name">Scenario Name</Label>
              <Input
                id="scenario-name"
                placeholder="e.g., Conservative, Aggressive, Base Case"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
                autoFocus
              />
            </div>

            {/* Primary checkbox */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="set-primary"
                checked={isPrimary}
                onCheckedChange={(checked) => setIsPrimary(checked === true)}
                disabled={isLoading}
              />
              <Label
                htmlFor="set-primary"
                className="text-sm cursor-pointer"
              >
                Set as primary plan
              </Label>
            </div>

            {/* Settings summary */}
            <div className="rounded-md border p-3 space-y-2 text-sm">
              <div className="font-medium text-muted-foreground">
                Settings to save:
              </div>
              <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                <div>Time Horizon</div>
                <div className="text-foreground">{projectionYears} years</div>

                {currentSettings.monthlyContribution !== undefined && (
                  <>
                    <div>Monthly Contribution</div>
                    <div className="text-foreground">
                      {formatCurrency(currentSettings.monthlyContribution)}
                    </div>
                  </>
                )}

                {currentSettings.returnOverrides && (
                  <>
                    <div>Expected Returns</div>
                    <div className="text-foreground">Custom</div>
                  </>
                )}

                {currentSettings.allocationOverrides && (
                  <>
                    <div>Allocation</div>
                    <div className="text-foreground">Custom</div>
                  </>
                )}
              </div>
            </div>

            {/* Error message */}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Scenario'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
