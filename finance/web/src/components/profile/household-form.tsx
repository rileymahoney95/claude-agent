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
import type { HouseholdContext } from "@/lib/types";

interface HouseholdFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  household: HouseholdContext | null;
  onSave: (data: HouseholdContext) => void;
  isLoading?: boolean;
}

export function HouseholdForm({
  open,
  onOpenChange,
  household,
  onSave,
  isLoading = false,
}: HouseholdFormProps) {
  const [wifeIncome, setWifeIncome] = useState("");
  const [wifeAssets, setWifeAssets] = useState("");
  const [mortgagePayment, setMortgagePayment] = useState("");
  const [mortgageRate, setMortgageRate] = useState("");
  const [mortgageBalance, setMortgageBalance] = useState("");
  const [homeValue, setHomeValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Reset form when household data changes
  useEffect(() => {
    if (household) {
      setWifeIncome(household.wife_income?.toString() || "");
      setWifeAssets(household.wife_assets?.toString() || "");
      setMortgagePayment(household.mortgage_payment?.toString() || "");
      setMortgageRate(household.mortgage_rate?.toString() || "");
      setMortgageBalance(household.mortgage_balance?.toString() || "");
      setHomeValue(household.home_value?.toString() || "");
      setError(null);
    }
  }, [household, open]);

  const parseValue = (value: string): number => {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate all monetary fields are non-negative
    const monetaryFields = [
      { name: "Wife's Income", value: wifeIncome },
      { name: "Wife's Assets", value: wifeAssets },
      { name: "Mortgage Payment", value: mortgagePayment },
      { name: "Mortgage Balance", value: mortgageBalance },
      { name: "Home Value", value: homeValue },
    ];

    for (const field of monetaryFields) {
      const num = parseFloat(field.value);
      if (isNaN(num) || num < 0) {
        setError(`Please enter a valid non-negative number for ${field.name}`);
        return;
      }
    }

    // Validate mortgage rate is a valid percentage
    const rateNum = parseFloat(mortgageRate);
    if (isNaN(rateNum) || rateNum < 0 || rateNum > 100) {
      setError("Please enter a valid mortgage rate percentage (0-100)");
      return;
    }

    onSave({
      wife_income: parseValue(wifeIncome),
      wife_assets: parseValue(wifeAssets),
      mortgage_payment: parseValue(mortgagePayment),
      mortgage_rate: rateNum,
      mortgage_balance: parseValue(mortgageBalance),
      home_value: parseValue(homeValue),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Household Context</DialogTitle>
            <DialogDescription>
              Update household income, assets, and mortgage details.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="wifeIncome">Wife&apos;s Income (annual)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="wifeIncome"
                  type="number"
                  step="any"
                  min="0"
                  value={wifeIncome}
                  onChange={(e) => setWifeIncome(e.target.value)}
                  className="pl-7"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wifeAssets">Wife&apos;s Assets</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="wifeAssets"
                  type="number"
                  step="any"
                  min="0"
                  value={wifeAssets}
                  onChange={(e) => setWifeAssets(e.target.value)}
                  className="pl-7"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mortgagePayment">Mortgage Payment (monthly)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="mortgagePayment"
                  type="number"
                  step="any"
                  min="0"
                  value={mortgagePayment}
                  onChange={(e) => setMortgagePayment(e.target.value)}
                  className="pl-7"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mortgageRate">Mortgage Rate (%)</Label>
              <div className="relative">
                <Input
                  id="mortgageRate"
                  type="number"
                  step="any"
                  min="0"
                  max="100"
                  value={mortgageRate}
                  onChange={(e) => setMortgageRate(e.target.value)}
                  className="pr-8"
                  placeholder="7.0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  %
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mortgageBalance">Mortgage Balance</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="mortgageBalance"
                  type="number"
                  step="any"
                  min="0"
                  value={mortgageBalance}
                  onChange={(e) => setMortgageBalance(e.target.value)}
                  className="pl-7"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="homeValue">Home Value</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="homeValue"
                  type="number"
                  step="any"
                  min="0"
                  value={homeValue}
                  onChange={(e) => setHomeValue(e.target.value)}
                  className="pl-7"
                  placeholder="0"
                />
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
