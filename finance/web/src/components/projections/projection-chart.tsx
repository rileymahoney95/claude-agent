'use client';

import { forwardRef } from 'react';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import type { ProjectionPoint, Milestone } from '@/lib/projection';
import type { Goals } from '@/lib/types';

interface ProjectionChartProps {
  dataPoints: ProjectionPoint[];
  milestones: Milestone[];
  showInflationAdjusted?: boolean;
  /** Optional goals for deadline milestones */
  goals?: Goals;
  /** Current age for calculating goal milestone ages */
  currentAge?: number;
  /** Optional comparison projection data */
  comparisonData?: ProjectionPoint[];
  /** Label for comparison line */
  comparisonLabel?: string;
  /** Optional slot for export buttons in header */
  exportSlot?: React.ReactNode;
}

// Asset class colors (CSS variables for theming)
const ASSET_COLORS: Record<string, string> = {
  equities: 'var(--chart-1)',
  bonds: 'var(--chart-2)',
  crypto: 'var(--chart-3)',
  cash: 'var(--chart-4)',
};

const ASSET_NAMES: Record<string, string> = {
  equities: 'Equities',
  bonds: 'Bonds',
  crypto: 'Crypto',
  cash: 'Cash',
};

// Sample data to show yearly points for readability
function sampleDataPoints(points: ProjectionPoint[]): ProjectionPoint[] {
  if (points.length <= 25) return points;

  // Show every 12th month (yearly), plus first and last
  const sampled: ProjectionPoint[] = [];
  for (let i = 0; i < points.length; i++) {
    if (i === 0 || i === points.length - 1 || i % 12 === 0) {
      sampled.push(points[i]);
    }
  }
  return sampled;
}

interface ChartDataPoint {
  age: number;
  date: string;
  totalValue: number;
  inflationAdjustedValue: number;
  isHistorical: boolean;
  equities: number;
  bonds: number;
  crypto: number;
  cash: number;
  comparisonTotal?: number;
}

function transformData(
  dataPoints: ProjectionPoint[],
  showInflationAdjusted: boolean
): ChartDataPoint[] {
  return dataPoints.map((point) => ({
    age: Math.round(point.age),
    date: point.date,
    totalValue: showInflationAdjusted
      ? point.inflationAdjustedValue
      : point.totalValue,
    inflationAdjustedValue: point.inflationAdjustedValue,
    isHistorical: point.isHistorical,
    equities: point.byAssetClass.equities ?? 0,
    bonds: point.byAssetClass.bonds ?? 0,
    crypto: point.byAssetClass.crypto ?? 0,
    cash: point.byAssetClass.cash ?? 0,
  }));
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
  label?: string | number;
  comparisonLabel?: string;
}

function CustomTooltip({ active, payload, comparisonLabel }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  const assetClasses = ['equities', 'bonds', 'crypto', 'cash'] as const;

  return (
    <div className="rounded-lg border bg-background p-3 shadow-sm min-w-[180px]">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium">Age {data.age}</span>
        <span className="text-xs text-muted-foreground">{data.date}</span>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between">
          <span className="text-sm font-semibold">Total</span>
          <span className="text-sm font-semibold">
            {formatCurrency(data.totalValue)}
          </span>
        </div>
        {data.comparisonTotal !== undefined && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {comparisonLabel || 'Comparison'}
            </span>
            <span className="font-medium">
              {formatCurrency(data.comparisonTotal)}
            </span>
          </div>
        )}
        <div className="border-t pt-1.5 space-y-1">
          {assetClasses.map((assetClass) => {
            const value = data[assetClass];
            if (value === 0) return null;
            return (
              <div key={assetClass} className="flex justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: ASSET_COLORS[assetClass] }}
                  />
                  <span className="text-muted-foreground">
                    {ASSET_NAMES[assetClass]}
                  </span>
                </div>
                <span>{formatCurrency(value)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Goal milestone colors (CSS classes for theming)
const GOAL_COLORS: Record<string, string> = {
  short_term: 'hsl(var(--chart-5))',    // amber/warning
  medium_term: 'hsl(var(--chart-2))',   // blue/info
  long_term: 'hsl(var(--chart-1))',     // green/success
};

const GOAL_LABELS: Record<string, string> = {
  short_term: 'Short-term',
  medium_term: 'Medium-term',
  long_term: 'Long-term',
};

/**
 * Calculate age at a goal deadline.
 */
function calculateAgeAtDeadline(
  deadline: string,
  currentAge: number
): number | null {
  const deadlineDate = new Date(deadline);
  const today = new Date();

  // If deadline is in the past, skip
  if (deadlineDate <= today) return null;

  const yearsUntil =
    (deadlineDate.getTime() - today.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  return currentAge + yearsUntil;
}

export const ProjectionChart = forwardRef<HTMLDivElement, ProjectionChartProps>(
  function ProjectionChart(
    {
      dataPoints,
      milestones,
      showInflationAdjusted = false,
      goals,
      currentAge,
      comparisonData,
      comparisonLabel,
      exportSlot,
    },
    ref
  ) {
    if (!dataPoints || dataPoints.length === 0) {
      return (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Portfolio Projection</CardTitle>
            {exportSlot}
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-center py-8">
              No projection data available
            </p>
          </CardContent>
        </Card>
      );
    }

  const sampledData = sampleDataPoints(dataPoints);
  const baseChartData = transformData(sampledData, showInflationAdjusted);

  // If we have comparison data, transform and merge it
  let chartData = baseChartData;
  if (comparisonData && comparisonData.length > 0) {
    const sampledComparison = sampleDataPoints(comparisonData);
    const comparisonChartData = transformData(sampledComparison, showInflationAdjusted);

    // Merge comparison total into main chart data
    chartData = baseChartData.map((point, i) => ({
      ...point,
      comparisonTotal: comparisonChartData[i]?.totalValue,
    }));
  }

  // Find Coast FIRE and retirement milestones for reference lines
  const coastFireMilestone = milestones.find((m) => m.type === 'coast_fire');
  const retirementMilestone = milestones.find((m) => m.type === 'retirement');

  // Get min/max ages for X-axis domain
  const ages = chartData.map((d) => d.age);
  const minAge = Math.min(...ages);
  const maxAge = Math.max(...ages);

  // Calculate goal milestone ages (only if within chart range)
  const goalMilestones: Array<{
    type: string;
    age: number;
    label: string;
    color: string;
  }> = [];

  if (goals && currentAge) {
    for (const [goalType, goal] of Object.entries(goals)) {
      if (goal.deadline) {
        const ageAtDeadline = calculateAgeAtDeadline(goal.deadline, currentAge);
        if (ageAtDeadline !== null && ageAtDeadline >= minAge && ageAtDeadline <= maxAge) {
          goalMilestones.push({
            type: goalType,
            age: Math.round(ageAtDeadline * 10) / 10,
            label: GOAL_LABELS[goalType] || goalType,
            color: GOAL_COLORS[goalType] || 'var(--muted-foreground)',
          });
        }
      }
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>
          Portfolio Projection
          {showInflationAdjusted && (
            <span className="text-sm font-normal text-muted-foreground ml-2">
              (Inflation Adjusted)
            </span>
          )}
        </CardTitle>
        {exportSlot}
      </CardHeader>
      <CardContent>
        <div ref={ref} className="h-[250px] sm:h-[300px] lg:h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 40, right: 10, left: 10, bottom: 0 }}
            >
              <defs>
                {/* Gradients for softer projection appearance */}
                {Object.entries(ASSET_COLORS).map(([key, color]) => (
                  <linearGradient
                    key={key}
                    id={`gradient-${key}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={color} stopOpacity={0.6} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.1} />
                  </linearGradient>
                ))}
              </defs>

              <XAxis
                dataKey="age"
                type="number"
                domain={[minAge, maxAge]}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `${value}`}
                label={{
                  value: 'Age',
                  position: 'insideBottom',
                  offset: -5,
                  fontSize: 12,
                }}
              />

              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12 }}
                tickFormatter={(value) =>
                  value >= 1000000
                    ? `$${(value / 1000000).toFixed(1)}M`
                    : value >= 1000
                    ? `$${(value / 1000).toFixed(0)}K`
                    : `$${value}`
                }
                width={60}
              />

              <Tooltip
                content={<CustomTooltip comparisonLabel={comparisonLabel} />}
              />

              {/* Reference line for Coast FIRE */}
              {coastFireMilestone && (
                <ReferenceLine
                  x={coastFireMilestone.age}
                  stroke="var(--chart-5)"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  label={{
                    value: 'Coast FIRE',
                    position: 'top',
                    offset: 5,
                    fontSize: 11,
                    fill: 'var(--muted-foreground)',
                  }}
                />
              )}

              {/* Reference line for retirement */}
              {retirementMilestone && (
                <ReferenceLine
                  x={retirementMilestone.age}
                  stroke="var(--foreground)"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                  label={{
                    value: 'Retirement',
                    position: 'top',
                    offset: 5,
                    fontSize: 11,
                    fill: 'var(--muted-foreground)',
                  }}
                />
              )}

              {/* Goal deadline milestones */}
              {goalMilestones.map((goal) => (
                <ReferenceLine
                  key={goal.type}
                  x={goal.age}
                  stroke={goal.color}
                  strokeDasharray="8 4"
                  strokeWidth={1}
                  label={{
                    value: goal.label,
                    position: 'insideTopRight',
                    fontSize: 10,
                    fill: goal.color,
                  }}
                />
              ))}

              {/* Stacked areas for asset classes */}
              <Area
                type="monotone"
                dataKey="cash"
                stackId="1"
                stroke={ASSET_COLORS.cash}
                fill={`url(#gradient-cash)`}
                strokeWidth={1}
              />
              <Area
                type="monotone"
                dataKey="bonds"
                stackId="1"
                stroke={ASSET_COLORS.bonds}
                fill={`url(#gradient-bonds)`}
                strokeWidth={1}
              />
              <Area
                type="monotone"
                dataKey="crypto"
                stackId="1"
                stroke={ASSET_COLORS.crypto}
                fill={`url(#gradient-crypto)`}
                strokeWidth={1}
              />
              <Area
                type="monotone"
                dataKey="equities"
                stackId="1"
                stroke={ASSET_COLORS.equities}
                fill={`url(#gradient-equities)`}
                strokeWidth={1}
              />

              {/* Comparison line overlay */}
              {comparisonData && comparisonData.length > 0 && (
                <Line
                  type="monotone"
                  dataKey="comparisonTotal"
                  stroke="var(--muted-foreground)"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  dot={false}
                  name={comparisonLabel || 'Comparison'}
                  legendType="line"
                />
              )}

              <Legend
                verticalAlign="bottom"
                height={36}
                formatter={(value: string) =>
                  ASSET_NAMES[value as keyof typeof ASSET_NAMES] || value
                }
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
});
