'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import { usePortfolioHistory } from '@/lib/hooks/use-portfolio';

const ACCOUNT_COLORS: Record<string, string> = {
  roth_ira: 'var(--chart-1)',
  brokerage: 'var(--chart-2)',
  traditional_ira: 'var(--chart-3)',
};

const ACCOUNT_NAMES: Record<string, string> = {
  roth_ira: 'Roth IRA',
  brokerage: 'Brokerage',
  traditional_ira: 'Traditional IRA',
};

interface ChartDataPoint {
  date: string;
  total: number;
  [key: string]: string | number;
}

interface TooltipPayload {
  value: number;
  name: string;
  color: string;
  payload: ChartDataPoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;

  return (
    <div className="rounded-lg border bg-background p-3 shadow-sm min-w-[160px]">
      <div className="mb-2">
        <span className="text-sm font-medium">{data.date}</span>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <span className="text-sm font-semibold">Total</span>
          <span className="text-sm font-semibold">
            {formatCurrency(data.total)}
          </span>
        </div>
        <div className="border-t pt-1.5 space-y-1">
          {Object.keys(ACCOUNT_NAMES).map((key) => {
            const value = data[key];
            if (!value || value === 0) return null;
            return (
              <div key={key} className="flex justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: ACCOUNT_COLORS[key] }}
                  />
                  <span className="text-muted-foreground">
                    {ACCOUNT_NAMES[key]}
                  </span>
                </div>
                <span>{formatCurrency(value as number)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

export function NetWorthChart() {
  const { data, isLoading } = usePortfolioHistory(12);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const dataPoints = data?.data_points ?? [];

  if (dataPoints.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Net Worth</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No historical data yet. Import statements to track net worth over time.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Collect all account keys present in data
  const accountKeys = new Set<string>();
  for (const point of dataPoints) {
    for (const key of Object.keys(point.by_account)) {
      accountKeys.add(key);
    }
  }

  const chartData: ChartDataPoint[] = dataPoints.map((point) => ({
    date: formatDateLabel(point.statement_date),
    total: point.total_value,
    ...point.by_account,
  }));

  // Order: bottom to top (smallest to largest typically)
  const orderedKeys = ['traditional_ira', 'brokerage', 'roth_ira'].filter(
    (k) => accountKeys.has(k)
  );
  // Add any unexpected account types
  for (const key of accountKeys) {
    if (!orderedKeys.includes(key)) {
      orderedKeys.push(key);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Net Worth</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px] sm:h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
            >
              <defs>
                {orderedKeys.map((key) => (
                  <linearGradient
                    key={key}
                    id={`nw-gradient-${key}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor={ACCOUNT_COLORS[key] ?? 'var(--chart-5)'}
                      stopOpacity={0.6}
                    />
                    <stop
                      offset="100%"
                      stopColor={ACCOUNT_COLORS[key] ?? 'var(--chart-5)'}
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                ))}
              </defs>

              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12 }}
              />

              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12 }}
                tickFormatter={(value) =>
                  value >= 1000000
                    ? `$${(value / 1000000).toFixed(1)}M`
                    : value >= 1000
                    ? `$${(value / 1000).toFixed(0)}k`
                    : `$${value}`
                }
                width={55}
              />

              <Tooltip content={<CustomTooltip />} />

              {orderedKeys.map((key) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stackId="1"
                  stroke={ACCOUNT_COLORS[key] ?? 'var(--chart-5)'}
                  fill={`url(#nw-gradient-${key})`}
                  strokeWidth={1}
                />
              ))}

              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value: string) =>
                  ACCOUNT_NAMES[value] || value
                }
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
