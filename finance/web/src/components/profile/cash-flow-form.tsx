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
import { formatCurrency } from "@/lib/utils";
import type { CashFlow } from "@/lib/types";

interface CashFlowFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cashFlow: CashFlow | null;
  onSave: (data: CashFlow) => void;
  isLoading?: boolean;
}

export function CashFlowForm({
  open,
  onOpenChange,
  cashFlow,
  onSave,
  isLoading = false,
}: CashFlowFormProps) {
  const [grossIncome, setGrossIncome] = useState("");
  const [sharedExpenses, setSharedExpenses] = useState("");
  const [cryptoContributions, setCryptoContributions] = useState("");
  const [rothContributions, setRothContributions] = useState("");
  const [hsaContributions, setHsaContributions] = useState("");
  const [discretionary, setDiscretionary] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Reset form when cash flow data changes
  useEffect(() => {
    if (cashFlow) {
      setGrossIncome(cashFlow.gross_income.toString());
      setSharedExpenses(cashFlow.shared_expenses.toString());
      setCryptoContributions(cashFlow.crypto_contributions.toString());
      setRothContributions(cashFlow.roth_contributions.toString());
      setHsaContributions(cashFlow.hsa_contributions.toString());
      setDiscretionary(cashFlow.discretionary.toString());
      setError(null);
    }
  }, [cashFlow, open]);

  const parseValue = (value: string): number => {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  };

  // Calculate surplus preview
  const surplus =
    parseValue(grossIncome) -
    parseValue(sharedExpenses) -
    parseValue(cryptoContributions) -
    parseValue(rothContributions) -
    parseValue(hsaContributions) -
    parseValue(discretionary);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const values = [
      grossIncome,
      sharedExpenses,
      cryptoContributions,
      rothContributions,
      hsaContributions,
      discretionary,
    ];

    // Validate all fields are valid numbers
    for (const value of values) {
      const num = parseFloat(value);
      if (isNaN(num) || num < 0) {
        setError("Please enter valid non-negative numbers for all fields");
        return;
      }
    }

    onSave({
      gross_income: parseValue(grossIncome),
      shared_expenses: parseValue(sharedExpenses),
      crypto_contributions: parseValue(cryptoContributions),
      roth_contributions: parseValue(rothContributions),
      hsa_contributions: parseValue(hsaContributions),
      discretionary: parseValue(discretionary),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Monthly Cash Flow</DialogTitle>
            <DialogDescription>
              Update your monthly income and expense allocations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="grossIncome">Gross Income</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="grossIncome"
                  type="number"
                  step="any"
                  min="0"
                  value={grossIncome}
                  onChange={(e) => setGrossIncome(e.target.value)}
                  className="pl-7"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sharedExpenses">Shared Expenses</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="sharedExpenses"
                  type="number"
                  step="any"
                  min="0"
                  value={sharedExpenses}
                  onChange={(e) => setSharedExpenses(e.target.value)}
                  className="pl-7"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cryptoContributions">Crypto DCA</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="cryptoContributions"
                  type="number"
                  step="any"
                  min="0"
                  value={cryptoContributions}
                  onChange={(e) => setCryptoContributions(e.target.value)}
                  className="pl-7"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rothContributions">Roth IRA</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="rothContributions"
                  type="number"
                  step="any"
                  min="0"
                  value={rothContributions}
                  onChange={(e) => setRothContributions(e.target.value)}
                  className="pl-7"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hsaContributions">HSA</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="hsaContributions"
                  type="number"
                  step="any"
                  min="0"
                  value={hsaContributions}
                  onChange={(e) => setHsaContributions(e.target.value)}
                  className="pl-7"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="discretionary">Discretionary</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="discretionary"
                  type="number"
                  step="any"
                  min="0"
                  value={discretionary}
                  onChange={(e) => setDiscretionary(e.target.value)}
                  className="pl-7"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Surplus Preview */}
            <div className="rounded-lg bg-muted p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Calculated Surplus:</span>
                <span
                  className={`font-medium ${
                    surplus >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {formatCurrency(surplus)}/mo
                </span>
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
