"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import type { MonthOverMonth } from "@/lib/types";

interface MonthComparisonChartProps {
  months: MonthOverMonth[] | undefined;
  isLoading: boolean;
}

export function MonthComparisonChart({
  months,
  isLoading,
}: MonthComparisonChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-6 w-48 mb-4" />
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!months || months.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-4">Monthly Spending</h3>
          <p className="text-sm text-muted-foreground">
            No monthly data available. Import more statements to see trends.
          </p>
        </CardContent>
      </Card>
    );
  }

  const chartData = months.map((m) => ({
    month: formatMonthLabel(m.month),
    spending: m.purchases,
    transactions: m.transaction_count,
  }));

  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="text-lg font-semibold mb-4">Monthly Spending</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis
              tick={{ fontSize: 12 }}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              formatter={(value) => formatCurrency(value as number)}
              labelStyle={{ fontWeight: 600 }}
            />
            <Bar
              dataKey="spending"
              fill="var(--chart-1)"
              radius={[4, 4, 0, 0]}
              name="Spending"
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function formatMonthLabel(month: string): string {
  try {
    const [year, m] = month.split("-");
    const date = new Date(parseInt(year), parseInt(m) - 1);
    return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  } catch {
    return month;
  }
}
