"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import type { ExpenseSummary } from "@/lib/types";

interface ExpenseSummaryCardsProps {
  summary: ExpenseSummary | undefined;
  isLoading: boolean;
  recurringTotal?: number;
}

export function ExpenseSummaryCards({
  summary,
  isLoading,
  recurringTotal,
}: ExpenseSummaryCardsProps) {
  const total = summary?.total_purchases ?? 0;
  const count = summary?.transaction_count ?? 0;

  // Calculate average per day
  let avgPerDay = 0;
  if (summary?.date_range?.start && summary?.date_range?.end) {
    const start = new Date(summary.date_range.start);
    const end = new Date(summary.date_range.end);
    const days = Math.max(
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
      1
    );
    avgPerDay = total / days;
  }

  const cards = [
    { label: "Total Spending", value: formatCurrency(total) },
    { label: "Transactions", value: count.toString() },
    { label: "Avg / Day", value: formatCurrency(avgPerDay) },
    {
      label: "Recurring Total",
      value: recurringTotal !== undefined ? `${formatCurrency(recurringTotal)}/mo` : "N/A",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">{card.label}</div>
            {isLoading ? (
              <Skeleton className="h-8 w-24 mt-1" />
            ) : (
              <div className="text-2xl font-bold">{card.value}</div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
