"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Recommendation } from "@/lib/types";

interface RecommendationCardProps {
  recommendation: Recommendation;
  defaultExpanded?: boolean;
}

// Type icons and colors
const TYPE_STYLES: Record<
  Recommendation["type"],
  { icon: React.ReactNode; bg: string }
> = {
  surplus: {
    icon: <ArrowUpRight className="h-3.5 w-3.5" />,
    bg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  },
  rebalance: {
    icon: <RefreshCw className="h-3.5 w-3.5" />,
    bg: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  },
  opportunity: {
    icon: <TrendingUp className="h-3.5 w-3.5" />,
    bg: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400",
  },
  warning: {
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    bg: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  },
  spending: {
    icon: <Wallet className="h-3.5 w-3.5" />,
    bg: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  },
};

// Priority colors
const PRIORITY_STYLES: Record<
  Recommendation["priority"],
  { dot: string; bg: string }
> = {
  high: {
    dot: "bg-red-500",
    bg: "border-l-4 border-l-red-500",
  },
  medium: {
    dot: "bg-amber-500",
    bg: "border-l-4 border-l-amber-500",
  },
  low: {
    dot: "bg-green-500",
    bg: "border-l-4 border-l-green-500",
  },
};

export function RecommendationCard({
  recommendation,
  defaultExpanded = false,
}: RecommendationCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const styles = PRIORITY_STYLES[recommendation.priority];

  return (
    <Card className={cn("overflow-hidden", styles.bg)}>
      <CardContent className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            {/* Type icon */}
            <div
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
                TYPE_STYLES[recommendation.type].bg
              )}
            >
              {TYPE_STYLES[recommendation.type].icon}
            </div>

            {/* Action text */}
            <div className="flex-1">
              <p className="font-medium leading-tight">{recommendation.action}</p>
            </div>
          </div>

          {/* Expand toggle */}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 shrink-0"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Expanded content */}
        {expanded && (
          <div className="mt-3 space-y-2 pl-9">
            <p className="text-sm text-muted-foreground">
              {recommendation.rationale}
            </p>
            {recommendation.impact && (
              <p className="text-sm">
                <span className="text-muted-foreground">→ </span>
                {recommendation.impact}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
