'use client';

import { CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { formatCurrency } from '@/lib/utils';
import type { CoastFireResult } from '@/lib/projection';

interface CoastFireCardProps {
  coastFire: CoastFireResult;
  currentValue: number;
}

export function CoastFireCard({ coastFire, currentValue }: CoastFireCardProps) {
  const { targetPortfolio, retirementTarget, alreadyCoasted, achievedAge } =
    coastFire;

  // Calculate progress percentage (capped at 100%)
  const progressPct = Math.min((currentValue / targetPortfolio) * 100, 100);

  // Format years/months until Coast FIRE
  const getTimeUntilText = () => {
    if (alreadyCoasted) return null;
    if (!achievedAge) return null;

    // We can estimate time from achievedAge - currentAge
    // But we don't have currentAge here directly, so we'll use the milestone date
    if (coastFire.monthsUntil !== null) {
      const years = Math.floor(coastFire.monthsUntil / 12);
      const months = coastFire.monthsUntil % 12;
      if (years > 0 && months > 0) {
        return `${years}y ${months}m`;
      }
      if (years > 0) {
        return `${years} year${years > 1 ? 's' : ''}`;
      }
      return `${months} month${months > 1 ? 's' : ''}`;
    }
    return null;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Coast FIRE
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status badge */}
        <div className="flex items-center gap-2">
          {alreadyCoasted ? (
            <>
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="font-medium text-green-600">Achieved!</span>
            </>
          ) : achievedAge ? (
            <>
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-sm">
                On track for age{' '}
                <span className="font-semibold">{achievedAge.toFixed(1)}</span>
              </span>
              {getTimeUntilText() && (
                <span className="text-xs text-muted-foreground">
                  ({getTimeUntilText()})
                </span>
              )}
            </>
          ) : (
            <>
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Keep contributing
              </span>
            </>
          )}
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Current</span>
            <span className="text-muted-foreground">Target</span>
          </div>
          <Progress
            value={progressPct}
            className="h-3"
            indicatorClassName={
              alreadyCoasted
                ? 'bg-green-500'
                : progressPct >= 75
                ? 'bg-amber-500'
                : 'bg-primary'
            }
          />
          <div className="flex justify-between text-sm">
            <span className="font-medium">{formatCurrency(currentValue)}</span>
            <span className="font-medium">{formatCurrency(targetPortfolio)}</span>
          </div>
        </div>

        {/* Additional info */}
        <div className="pt-2 border-t space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{progressPct.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Retirement Target</span>
            <span className="font-medium">{formatCurrency(retirementTarget)}</span>
          </div>
        </div>

        {/* Explanation */}
        <p className="text-xs text-muted-foreground pt-1">
          Coast FIRE: the amount you need today to reach your retirement target
          with no additional contributions.
        </p>
      </CardContent>
    </Card>
  );
}
