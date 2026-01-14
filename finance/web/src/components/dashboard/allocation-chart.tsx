'use client';

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Label,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatPercent } from '@/lib/utils';
import type { CategoryData } from '@/lib/types';

interface AllocationChartProps {
  byCategory: Record<string, CategoryData>;
}

// Map categories to chart colors
const CATEGORY_COLORS: Record<string, string> = {
  retirement: 'var(--chart-3)', // Blue
  crypto: 'var(--chart-1)', // Orange/Red
  cash: 'var(--chart-2)', // Green
  taxable_equities: 'var(--chart-4)', // Purple
};

// Recommended target allocations for comparison
const TARGET_ALLOCATIONS: Record<string, number> = {
  retirement: 40,
  crypto: 20,
  cash: 25,
  taxable_equities: 15,
};

// Friendly display names
const CATEGORY_NAMES: Record<string, string> = {
  retirement: 'Retirement',
  crypto: 'Crypto',
  cash: 'Cash',
  taxable_equities: 'Equities',
};

interface ChartDataItem {
  name: string;
  key: string;
  value: number;
  pct: number;
  color: string;
  [key: string]: string | number;
}

export function AllocationChart({ byCategory }: AllocationChartProps) {
  // Guard against undefined/null byCategory
  if (!byCategory || Object.keys(byCategory).length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Allocation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-muted-foreground text-center py-8'>
            No allocation data available
          </p>
        </CardContent>
      </Card>
    );
  }

  // Transform data for Recharts
  const chartData: ChartDataItem[] = Object.entries(byCategory).map(
    ([key, data]) => ({
      name: CATEGORY_NAMES[key] || key,
      key,
      value: data.value,
      pct: data.pct,
      color: CATEGORY_COLORS[key] || 'var(--chart-5)',
    })
  );

  const totalValue = chartData.reduce((acc, curr) => acc + curr.value, 0);

  // Sort by value descending
  chartData.sort((a, b) => b.value - a.value);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Allocation</CardTitle>
      </CardHeader>
      <CardContent>
        <div className='flex flex-col items-center gap-6'>
          {/* Donut Chart */}
          <div className='h-56 w-56'>
            <ResponsiveContainer width='100%' height='100%'>
              <PieChart>
                <Pie
                  data={chartData}
                  cx='50%'
                  cy='50%'
                  innerRadius={65}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey='value'
                >
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.key}
                      fill={entry.color}
                      stroke='none'
                      className='hover:opacity-80 transition-opacity cursor-pointer'
                    />
                  ))}
                  <Label
                    content={({ viewBox }) => {
                      if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                        return (
                          <text
                            x={viewBox.cx}
                            y={viewBox.cy}
                            textAnchor='middle'
                            dominantBaseline='middle'
                          >
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy || 0) - 10}
                              className='fill-muted-foreground text-xs uppercase tracking-wider font-medium'
                            >
                              Total
                            </tspan>
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy || 0) + 15}
                              className='fill-foreground text-xl font-bold'
                            >
                              {formatCurrency(totalValue)}
                            </tspan>
                          </text>
                        );
                      }
                      return null;
                    }}
                  />
                </Pie>
                <Tooltip
                  cursor={false}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as ChartDataItem;
                      return (
                        <div className='rounded-lg border bg-background p-2 shadow-sm'>
                          <p className='font-medium'>{data.name}</p>
                          <p className='text-sm text-muted-foreground'>
                            {formatCurrency(data.value)} (
                            {formatPercent(data.pct)})
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend with drift indicators */}
          <div className='grid w-full grid-cols-2 gap-3'>
            {chartData.map((item) => {
              const target = TARGET_ALLOCATIONS[item.key];
              const drift = target ? item.pct - target : null;
              const driftDisplay =
                drift !== null
                  ? drift > 0
                    ? `+${drift.toFixed(1)}%`
                    : `${drift.toFixed(1)}%`
                  : null;

              return (
                <div key={item.key} className='flex items-center gap-2'>
                  <div
                    className='h-3 w-3 rounded-full'
                    style={{ backgroundColor: item.color }}
                  />
                  <div className='flex-1'>
                    <div className='flex items-center justify-between text-sm'>
                      <span className='font-medium'>{item.name}</span>
                      <span>{formatPercent(item.pct)}</span>
                    </div>
                    {driftDisplay && (
                      <p
                        className={`text-xs ${
                          drift! > 0
                            ? 'text-amber-600'
                            : drift! < 0
                            ? 'text-blue-600'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {driftDisplay} vs target
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
