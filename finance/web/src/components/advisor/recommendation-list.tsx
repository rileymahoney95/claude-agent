"use client";

import { Card, CardContent } from "@/components/ui/card";
import { RecommendationCard } from "@/components/dashboard/recommendation-card";
import type { Recommendation } from "@/lib/types";

interface RecommendationListProps {
  recommendations: Recommendation[];
}

// Group labels and styling
const PRIORITY_GROUPS: {
  priority: Recommendation["priority"];
  label: string;
  dotColor: string;
}[] = [
  { priority: "high", label: "High Priority", dotColor: "bg-red-500" },
  { priority: "medium", label: "Consider", dotColor: "bg-amber-500" },
  { priority: "low", label: "Info", dotColor: "bg-green-500" },
];

export function RecommendationList({ recommendations }: RecommendationListProps) {
  // Group recommendations by priority
  const grouped = PRIORITY_GROUPS.map((group) => ({
    ...group,
    items: recommendations.filter((r) => r.priority === group.priority),
  }));

  return (
    <div className="space-y-6">
      {grouped.map((group) => (
        <div key={group.priority} className="space-y-4">
          {/* Group header */}
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${group.dotColor}`} />
            {group.label} ({group.items.length})
          </h2>

          {/* Recommendations or empty state */}
          {group.items.length > 0 ? (
            <div className="space-y-3">
              {group.items.map((rec, index) => (
                <RecommendationCard
                  key={`${rec.type}-${index}`}
                  recommendation={rec}
                  defaultExpanded={true}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No {group.label.toLowerCase()} recommendations
              </CardContent>
            </Card>
          )}
        </div>
      ))}
    </div>
  );
}
