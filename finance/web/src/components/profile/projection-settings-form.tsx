"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProjectionSettings } from "@/lib/projection";

const ASSET_CLASS_LABELS: Record<string, string> = {
  equities: "Equities",
  bonds: "Bonds",
  crypto: "Crypto",
  cash: "Cash",
};

interface ProjectionSettingsFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: ProjectionSettings | null;
  onSave: (data: Partial<ProjectionSettings>) => void;
  isLoading?: boolean;
}

export function ProjectionSettingsForm({
  open,
  onOpenChange,
  settings,
  onSave,
  isLoading = false,
}: ProjectionSettingsFormProps) {
  const [currentAge, setCurrentAge] = useState("");
  const [targetRetirementAge, setTargetRetirementAge] = useState("");
  const [inflationRate, setInflationRate] = useState("");
  const [withdrawalRate, setWithdrawalRate] = useState("");
  const [expectedReturns, setExpectedReturns] = useState<Record<string, string>>({
    equities: "",
    bonds: "",
    crypto: "",
    cash: "",
  });
  const [error, setError] = useState<string | null>(null);

  // Reset form when settings change
  useEffect(() => {
    if (settings) {
      setCurrentAge(settings.currentAge?.toString() || "");
      setTargetRetirementAge(settings.targetRetirementAge?.toString() || "");
      setInflationRate(settings.inflationRate?.toString() || "");
      setWithdrawalRate(settings.withdrawalRate?.toString() || "");
      setExpectedReturns({
        equities: settings.expectedReturns?.equities?.toString() || "",
        bonds: settings.expectedReturns?.bonds?.toString() || "",
        crypto: settings.expectedReturns?.crypto?.toString() || "",
        cash: settings.expectedReturns?.cash?.toString() || "",
      });
      setError(null);
    }
  }, [settings, open]);

  const handleExpectedReturnChange = (assetClass: string, value: string) => {
    setExpectedReturns((prev) => ({ ...prev, [assetClass]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate current age
    const currentAgeNum = parseInt(currentAge, 10);
    if (isNaN(currentAgeNum) || currentAgeNum < 18 || currentAgeNum > 99) {
      setError("Current age must be between 18 and 99");
      return;
    }

    // Validate target retirement age
    const retirementAgeNum = parseInt(targetRetirementAge, 10);
    if (isNaN(retirementAgeNum) || retirementAgeNum < 40 || retirementAgeNum > 100) {
      setError("Target retirement age must be between 40 and 100");
      return;
    }

    if (retirementAgeNum <= currentAgeNum) {
      setError("Target retirement age must be greater than current age");
      return;
    }

    // Validate inflation rate
    const inflationNum = parseFloat(inflationRate);
    if (isNaN(inflationNum) || inflationNum < 0 || inflationNum > 20) {
      setError("Inflation rate must be between 0% and 20%");
      return;
    }

    // Validate withdrawal rate
    const withdrawalNum = parseFloat(withdrawalRate);
    if (isNaN(withdrawalNum) || withdrawalNum < 1 || withdrawalNum > 10) {
      setError("Withdrawal rate must be between 1% and 10%");
      return;
    }

    // Validate expected returns
    const parsedReturns: Record<string, number> = {};
    for (const [assetClass, value] of Object.entries(expectedReturns)) {
      const num = parseFloat(value);
      if (isNaN(num) || num < 0 || num > 50) {
        setError(`Expected return for ${ASSET_CLASS_LABELS[assetClass]} must be between 0% and 50%`);
        return;
      }
      parsedReturns[assetClass] = num;
    }

    onSave({
      currentAge: currentAgeNum,
      targetRetirementAge: retirementAgeNum,
      inflationRate: inflationNum,
      withdrawalRate: withdrawalNum,
      expectedReturns: parsedReturns,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Projection Settings</DialogTitle>
            <DialogDescription>
              Configure age, retirement target, and return assumptions for projections.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Age Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="currentAge">Current Age</Label>
                <Input
                  id="currentAge"
                  type="number"
                  min="18"
                  max="99"
                  value={currentAge}
                  onChange={(e) => setCurrentAge(e.target.value)}
                  placeholder="32"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetRetirementAge">Retirement Age</Label>
                <Input
                  id="targetRetirementAge"
                  type="number"
                  min="40"
                  max="100"
                  value={targetRetirementAge}
                  onChange={(e) => setTargetRetirementAge(e.target.value)}
                  placeholder="65"
                />
              </div>
            </div>

            {/* Rate Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="inflationRate">Inflation Rate</Label>
                <div className="relative">
                  <Input
                    id="inflationRate"
                    type="number"
                    step="0.1"
                    min="0"
                    max="20"
                    value={inflationRate}
                    onChange={(e) => setInflationRate(e.target.value)}
                    className="pr-8"
                    placeholder="3.0"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    %
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="withdrawalRate">Withdrawal Rate (SWR)</Label>
                <div className="relative">
                  <Input
                    id="withdrawalRate"
                    type="number"
                    step="0.1"
                    min="1"
                    max="10"
                    value={withdrawalRate}
                    onChange={(e) => setWithdrawalRate(e.target.value)}
                    className="pr-8"
                    placeholder="4.0"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    %
                  </span>
                </div>
              </div>
            </div>

            {/* Expected Returns */}
            <div className="space-y-2">
              <Label>Expected Annual Returns</Label>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(ASSET_CLASS_LABELS).map(([key, label]) => (
                  <div key={key} className="space-y-1">
                    <Label htmlFor={`return-${key}`} className="text-xs text-muted-foreground">
                      {label}
                    </Label>
                    <div className="relative">
                      <Input
                        id={`return-${key}`}
                        type="number"
                        step="0.1"
                        min="0"
                        max="50"
                        value={expectedReturns[key]}
                        onChange={(e) => handleExpectedReturnChange(key, e.target.value)}
                        className="pr-8"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        %
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

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
              {isLoading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
