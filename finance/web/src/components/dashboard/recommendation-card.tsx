"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Recommendation } from "@/lib/types";

interface RecommendationCardProps {
  recommendation: Recommendation;
  defaultExpanded?: boolean;
}

// Type badge labels
const TYPE_BADGES: Record<Recommendation["type"], string> = {
  surplus: "S",
  rebalance: "R",
  opportunity: "O",
  warning: "W",
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
            {/* Type badge */}
            <Badge
              variant="outline"
              className="h-6 w-6 shrink-0 items-center justify-center p-0 font-mono text-xs"
            >
              {TYPE_BADGES[recommendation.type]}
            </Badge>

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
