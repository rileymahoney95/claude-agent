"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, formatDate } from "@/lib/utils";
import { AlertTriangle, CheckCircle, Circle } from "lucide-react";
import type { GoalDetail } from "@/lib/types";

interface GoalCardProps {
  goal: GoalDetail;
}

// Friendly names for goal types
const GOAL_TYPE_NAMES: Record<string, string> = {
  short_term: "Short-term Goal",
  medium_term: "Medium-term Goal",
  long_term: "Long-term Goal",
};

export function GoalCard({ goal }: GoalCardProps) {
  const hasTarget = goal.status !== "no_target" && goal.status !== "not_set" && goal.target !== null;
  const isOnTrack = goal.status === "on_track" || goal.on_track === true;
  const isOffTrack = goal.status === "off_track" || goal.status === "behind";
  // Handle both 'current' and 'current_value' field names for API compatibility
  const currentValue = goal.current ?? goal.current_value ?? 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">
            {GOAL_TYPE_NAMES[goal.type] || goal.type}
          </CardTitle>
          <StatusBadge status={goal.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Description */}
        <p className="text-sm text-muted-foreground line-clamp-2">
          {goal.description}
        </p>

        {hasTarget ? (
          <>
            {/* Progress bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>{formatCurrency(currentValue)}</span>
                <span className="text-muted-foreground">
                  {formatCurrency(goal.target!)}
                </span>
              </div>
              <Progress
                value={goal.progress_pct || 0}
                className="h-2"
                indicatorClassName={
                  isOffTrack
                    ? "bg-destructive"
                    : isOnTrack
                    ? "bg-green-500"
                    : undefined
                }
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{goal.progress_pct}% complete</span>
                {goal.deadline && <span>Due: {formatDate(goal.deadline)}</span>}
              </div>
            </div>

            {/* Monthly requirement for off-track goals */}
            {isOffTrack && goal.monthly_required && (
              <p className="text-sm text-amber-600">
                Need: {formatCurrency(goal.monthly_required)}/mo
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Tracking qualitatively
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: GoalDetail["status"] }) {
  switch (status) {
    case "on_track":
      return (
        <Badge variant="secondary" className="gap-1 bg-green-100 text-green-700">
          <CheckCircle className="h-3 w-3" />
          On Track
        </Badge>
      );
    case "off_track":
    case "behind":
      return (
        <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-700">
          <AlertTriangle className="h-3 w-3" />
          Off Track
        </Badge>
      );
    case "past_deadline":
      return (
        <Badge variant="secondary" className="gap-1 bg-red-100 text-red-700">
          <AlertTriangle className="h-3 w-3" />
          Past Deadline
        </Badge>
      );
    case "no_target":
    case "not_set":
    default:
      return (
        <Badge variant="secondary" className="gap-1">
          <Circle className="h-3 w-3" />
          No Target
        </Badge>
      );
  }
}
