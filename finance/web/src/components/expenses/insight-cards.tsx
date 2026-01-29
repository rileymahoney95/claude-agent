"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  RefreshCw,
  Repeat,
  AlertCircle,
} from "lucide-react";
import type { SpendingInsight } from "@/lib/types";

interface InsightCardsProps {
  insights: SpendingInsight[] | undefined;
  isLoading: boolean;
  cached?: boolean;
  generatedAt?: string;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

const typeIcons: Record<SpendingInsight["type"], React.ReactNode> = {
  trend: <TrendingUp className="h-4 w-4 text-blue-500" />,
  anomaly: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  saving_opportunity: <Lightbulb className="h-4 w-4 text-green-500" />,
  pattern: <Repeat className="h-4 w-4 text-violet-500" />,
  warning: <AlertCircle className="h-4 w-4 text-red-500" />,
};

const severityVariant: Record<
  SpendingInsight["severity"],
  "secondary" | "default" | "destructive"
> = {
  info: "secondary",
  moderate: "default",
  important: "destructive",
};

export function InsightCards({
  insights,
  isLoading,
  cached,
  generatedAt,
  onRefresh,
  isRefreshing,
}: InsightCardsProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-3">
          <Skeleton className="h-6 w-48" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!insights || insights.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Spending Insights</h3>
            <Badge variant="secondary" className="text-xs">
              AI-generated
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {cached && generatedAt && (
              <span className="text-xs text-muted-foreground">
                Cached{" "}
                {new Date(generatedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={`h-4 w-4 mr-1 ${isRefreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {insights.map((insight, i) => (
            <div
              key={i}
              className="flex gap-3 py-2 border-b last:border-b-0"
            >
              <div className="mt-0.5 shrink-0">
                {typeIcons[insight.type]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium">{insight.title}</span>
                  <Badge
                    variant={severityVariant[insight.severity]}
                    className="text-xs"
                  >
                    {insight.severity}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {insight.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
