"use client";

import { formatCurrency, daysAgo } from "@/lib/utils";
import { Clock } from "lucide-react";

interface PortfolioSummaryProps {
  totalValue: number;
  asOf: string;
}

export function PortfolioSummary({ totalValue, asOf }: PortfolioSummaryProps) {
  const days = daysAgo(asOf);
  const timeAgo = days === 0 ? "today" : days === 1 ? "1 day ago" : `${days} days ago`;

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-muted-foreground">
          Portfolio Value
        </p>
        <p className="text-4xl font-bold tracking-tight">
          {formatCurrency(totalValue)}
        </p>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>Updated {timeAgo}</span>
      </div>
    </div>
  );
}
