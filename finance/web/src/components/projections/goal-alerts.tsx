'use client';

import Link from 'next/link';
import { AlertTriangle, Info, ExternalLink } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import type { Goals } from '@/lib/types';
import type { CoastFireResult, ProjectionSettings } from '@/lib/projection';

interface GoalAlertsProps {
  goals: Goals | undefined;
  coastFire: CoastFireResult;
  settings: ProjectionSettings | undefined;
}

/**
 * Displays contextual alerts about goal configuration and projection alignment.
 *
 * Alerts shown:
 * 1. Long-term goal not configured - suggest setting a retirement target
 * 2. Goal/projection mismatch - when derived targets differ by >20%
 * 3. Early retirement goal - when goal deadline is before retirement age
 */
export function GoalAlerts({ goals, coastFire, settings }: GoalAlertsProps) {
  const alerts: React.ReactNode[] = [];

  const longTermGoal = goals?.long_term;
  const hasLongTermTarget = longTermGoal?.target && longTermGoal.target > 0;

  // Alert 1: Long-term goal not configured
  if (!hasLongTermTarget) {
    alerts.push(
      <Alert key="no-target" variant="default">
        <Info className="h-4 w-4" />
        <AlertTitle>Long-term goal not configured</AlertTitle>
        <AlertDescription>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Set a retirement spending target to calculate accurate Coast FIRE
              projections.
            </span>
            <Button
              variant="link"
              size="sm"
              asChild
              className="p-0 h-auto justify-start sm:justify-end"
            >
              <Link href="/profile">
                Edit Goals <ExternalLink className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  } else if (settings) {
    // Alert 2: Goal and projection mismatch
    // The goal target is annual spending; derive retirement portfolio from SWR
    const goalRetirementTarget =
      longTermGoal.target! / (settings.withdrawalRate / 100);
    const coastRetirementTarget = coastFire.retirementTarget;
    const percentDiff =
      Math.abs(goalRetirementTarget - coastRetirementTarget) /
      coastRetirementTarget;

    if (percentDiff > 0.2) {
      alerts.push(
        <Alert key="mismatch" variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Goal and projection mismatch</AlertTitle>
          <AlertDescription>
            <p>
              Your long-term goal ({formatCurrency(longTermGoal.target!)}/year)
              implies a retirement portfolio of{' '}
              {formatCurrency(goalRetirementTarget)}, but projections use{' '}
              {formatCurrency(coastRetirementTarget)}.
            </p>
            <Button
              variant="link"
              size="sm"
              asChild
              className="p-0 h-auto mt-1"
            >
              <Link href="/profile">
                Update Goals <ExternalLink className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      );
    }

    // Alert 3: Goal deadline before retirement age
    if (longTermGoal.deadline) {
      const deadlineDate = new Date(longTermGoal.deadline);
      const today = new Date();
      const yearsToDeadline =
        (deadlineDate.getTime() - today.getTime()) /
        (365.25 * 24 * 60 * 60 * 1000);
      const ageAtDeadline = settings.currentAge + yearsToDeadline;

      // Show alert if deadline is >5 years before retirement age
      if (ageAtDeadline < settings.targetRetirementAge - 5) {
        alerts.push(
          <Alert key="early-deadline" variant="default">
            <Info className="h-4 w-4" />
            <AlertTitle>Early retirement goal detected</AlertTitle>
            <AlertDescription>
              Your long-term goal deadline (age {Math.round(ageAtDeadline)}) is
              before your target retirement age ({settings.targetRetirementAge}
              ). Coast FIRE projections use retirement age for calculations.
            </AlertDescription>
          </Alert>
        );
      }
    }
  }

  if (alerts.length === 0) return null;

  return <div className="space-y-3">{alerts}</div>;
}
