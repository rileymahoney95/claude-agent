"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { AlertTriangle, CheckCircle, ArrowRight } from "lucide-react";
import type { PortfolioSummary, GoalDetail, CategoryData } from "@/lib/types";

interface WhatIfCalculatorProps {
  portfolioSummary: PortfolioSummary;
  goalDetails: GoalDetail[];
}

// Category options for the dropdown
const CATEGORY_OPTIONS = [
  { value: "cash", label: "Cash / Emergency Fund" },
  { value: "retirement", label: "Retirement" },
  { value: "crypto", label: "Crypto" },
  { value: "taxable_equities", label: "Taxable Equities" },
];

// Category display names
const CATEGORY_NAMES: Record<string, string> = {
  retirement: "Retirement",
  taxable_equities: "Taxable Equities",
  crypto: "Crypto",
  cash: "Cash",
};

export function WhatIfCalculator({
  portfolioSummary,
  goalDetails,
}: WhatIfCalculatorProps) {
  const [amount, setAmount] = useState<string>("");
  const [category, setCategory] = useState<string>("cash");

  const amountNum = parseFloat(amount) || 0;

  // Find the short-term goal (emergency fund) for goal impact calculation
  const emergencyFundGoal = goalDetails.find(
    (g) => g.type === "short_term" && g.target !== null
  );

  // Calculate impacts
  const impacts = useMemo(() => {
    if (amountNum <= 0) return null;

    const totalValue = portfolioSummary.total_value;
    const byCategory = portfolioSummary.by_category || {};

    // Goal impact (for cash contributions toward emergency fund)
    let goalImpact = null;
    if (category === "cash" && emergencyFundGoal) {
      const currentMonthly = emergencyFundGoal.current_monthly || 0;
      const monthsRemaining = emergencyFundGoal.months_remaining;
      const target = emergencyFundGoal.target || 0;
      const current = emergencyFundGoal.current || 0;
      const remaining = target - current;

      const newMonthly = currentMonthly + amountNum;
      const newMonthsToGoal =
        newMonthly > 0 ? Math.ceil(remaining / newMonthly) : null;
      const currentMonthsToGoal =
        currentMonthly > 0 ? Math.ceil(remaining / currentMonthly) : null;

      // Determine if this puts the goal on track
      const wasOnTrack = emergencyFundGoal.on_track === true;
      const monthlyRequired = emergencyFundGoal.monthly_required || 0;
      const isNowOnTrack = newMonthly >= monthlyRequired;

      goalImpact = {
        currentMonthly,
        newMonthly,
        currentMonthsToGoal,
        newMonthsToGoal,
        wasOnTrack,
        isNowOnTrack,
        monthsRemaining,
        goalDescription: emergencyFundGoal.description,
      };
    }

    // Allocation impact - simulate adding amount to category for 1 month
    const currentCategoryData = byCategory[category] as CategoryData | undefined;
    const currentPct = currentCategoryData?.pct || 0;
    const currentValue = currentCategoryData?.value || 0;

    // New value after adding contribution
    const newCategoryValue = currentValue + amountNum;
    const newTotalValue = totalValue + amountNum;
    const newPct = (newCategoryValue / newTotalValue) * 100;
    const pctChange = newPct - currentPct;

    const allocationImpact = {
      category,
      categoryName: CATEGORY_NAMES[category] || category,
      currentPct,
      newPct,
      pctChange,
    };

    return { goalImpact, allocationImpact };
  }, [amountNum, category, portfolioSummary, emergencyFundGoal]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>What-If Calculator</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Input row */}
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-2">
            <Label htmlFor="amount">If I add $</Label>
            <Input
              id="amount"
              type="number"
              placeholder="500"
              className="w-28"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <span className="text-sm text-muted-foreground pb-2">/mo to</span>
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category" className="w-48">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Impact results */}
        {impacts ? (
          <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
            {/* Goal impact (only shown for cash contributions with emergency fund goal) */}
            {impacts.goalImpact && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">
                  Emergency Fund Goal Impact
                </h4>
                <div className="grid gap-2 text-sm">
                  {/* Monthly rate change */}
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Monthly rate:</span>
                    <span>
                      {formatCurrency(impacts.goalImpact.currentMonthly)}/mo
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">
                      {formatCurrency(impacts.goalImpact.newMonthly)}/mo
                    </span>
                  </div>

                  {/* Status change */}
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Status:</span>
                    <StatusBadge isOnTrack={impacts.goalImpact.wasOnTrack} />
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <StatusBadge isOnTrack={impacts.goalImpact.isNowOnTrack} />
                  </div>

                  {/* Timeline change */}
                  {impacts.goalImpact.currentMonthsToGoal !== null && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Timeline:</span>
                      <span>
                        {impacts.goalImpact.currentMonthsToGoal} months
                      </span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">
                        {impacts.goalImpact.newMonthsToGoal} months
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Allocation impact */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Allocation Impact</h4>
              <div className="text-sm">
                <span className="text-muted-foreground">
                  {impacts.allocationImpact.categoryName}:
                </span>{" "}
                <span>{impacts.allocationImpact.currentPct.toFixed(1)}%</span>
                <ArrowRight className="h-3 w-3 inline mx-2 text-muted-foreground" />
                <span className="font-medium">
                  {impacts.allocationImpact.newPct.toFixed(1)}%
                </span>
                <span
                  className={
                    impacts.allocationImpact.pctChange >= 0
                      ? "text-green-600 ml-2"
                      : "text-red-600 ml-2"
                  }
                >
                  ({impacts.allocationImpact.pctChange >= 0 ? "+" : ""}
                  {impacts.allocationImpact.pctChange.toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="border rounded-lg p-4 bg-muted/50">
            <p className="text-center text-muted-foreground text-sm">
              Enter an amount to see the impact analysis
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ isOnTrack }: { isOnTrack: boolean }) {
  if (isOnTrack) {
    return (
      <Badge variant="secondary" className="gap-1 bg-green-100 text-green-700">
        <CheckCircle className="h-3 w-3" />
        On Track
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-700">
      <AlertTriangle className="h-3 w-3" />
      Off Track
    </Badge>
  );
}
