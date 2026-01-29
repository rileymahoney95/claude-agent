"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import type { ExpenseCategoryBreakdown } from "@/lib/types";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff7300",
  "#d0ed57",
  "#a4de6c",
  "#8dd1e1",
  "#83a6ed",
];

interface CategoryPieChartProps {
  categories: ExpenseCategoryBreakdown[] | undefined;
  totalPurchases: number;
  isLoading: boolean;
}

export function CategoryPieChart({
  categories,
  totalPurchases,
  isLoading,
}: CategoryPieChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-6 w-40 mb-4" />
          <Skeleton className="h-64 w-full rounded-full mx-auto max-w-[256px]" />
        </CardContent>
      </Card>
    );
  }

  if (!categories || categories.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-4">Spending by Category</h3>
          <p className="text-sm text-muted-foreground">No expense data available.</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = categories
    .sort((a, b) => b.total - a.total)
    .map((cat) => ({
      name: cat.category,
      value: cat.total,
      pct: totalPurchases > 0 ? (cat.total / totalPurchases) * 100 : 0,
    }));

  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="text-lg font-semibold mb-4">Spending by Category</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
              label={false}
            >
              {chartData.map((_, index) => (
                <Cell
                  key={index}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => formatCurrency(value as number)}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
