"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorCard } from "@/components/ui/error-card";
import { useAdvice } from "@/lib/hooks/use-advice";
import { formatCurrency } from "@/lib/utils";
import {
  PriorityFilter,
  RecommendationList,
  WhatIfCalculator,
  ExportSessionButton,
  type FilterOption,
} from "@/components/advisor";

export default function AdvisorPage() {
  const [filter, setFilter] = useState<FilterOption>("all");

  // Map filter option to API focus parameter
  const focusParam = filter === "all" ? undefined : filter;
  const { data: advice, isLoading, error, refetch } = useAdvice(
    focusParam as Exclude<FilterOption, "all"> | undefined
  );

  // Current date for header
  const currentDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  if (error) {
    return (
      <div className="p-6">
        <ErrorCard
          message="Failed to load financial advice"
          error={error}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Financial Advisor</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Prioritized recommendations and what-if calculator
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ExportSessionButton />
          <span className="text-xs sm:text-sm text-muted-foreground">{currentDate}</span>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Portfolio Value</div>
            {isLoading ? (
              <Skeleton className="h-8 w-32 mt-1" />
            ) : (
              <div className="text-2xl font-bold">
                {formatCurrency(advice?.portfolio_summary?.total_value || 0)}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Monthly Surplus</div>
            {isLoading ? (
              <Skeleton className="h-8 w-24 mt-1" />
            ) : (
              <div className="text-2xl font-bold">
                {formatCurrency(advice?.portfolio_summary?.monthly_surplus || 0)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <Card>
        <CardContent className="pt-6">
          <PriorityFilter
            selected={filter}
            onChange={setFilter}
            disabled={isLoading}
          />
        </CardContent>
      </Card>

      {/* Recommendations List */}
      {isLoading ? (
        <LoadingState />
      ) : advice?.recommendations ? (
        <RecommendationList recommendations={advice.recommendations} />
      ) : null}

      {/* What-If Calculator */}
      {isLoading ? (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <Skeleton className="h-6 w-40" />
            <div className="flex gap-4">
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-48" />
            </div>
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      ) : advice?.portfolio_summary && advice?.goal_details ? (
        <WhatIfCalculator
          portfolioSummary={advice.portfolio_summary}
          goalDetails={advice.goal_details}
        />
      ) : null}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6">
      {/* High Priority skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <Card>
          <CardContent className="py-6">
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
      </div>

      {/* Medium Priority skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <Card>
          <CardContent className="py-6">
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
      </div>

      {/* Low Priority skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-24" />
        <Card>
          <CardContent className="py-6">
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
