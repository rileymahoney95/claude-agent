'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorCard } from '@/components/ui/error-card';
import { useProfile, useUpdateProfileSection } from '@/lib/hooks/use-profile';
import {
  CashFlowForm,
  GoalEditDialog,
  TaxForm,
  HouseholdForm,
} from '@/components/profile';
import { formatCurrency, formatDate } from '@/lib/utils';
import type {
  CashFlow,
  Goal,
  TaxSituation,
  HouseholdContext,
} from '@/lib/types';

type GoalType = 'short_term' | 'medium_term' | 'long_term';

const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  short_term: 'Short-term',
  medium_term: 'Medium-term',
  long_term: 'Long-term',
};

const FILING_STATUS_LABELS: Record<string, string> = {
  single: 'Single',
  married_joint: 'Married Filing Jointly',
  married_separate: 'Married Filing Separately',
  separate: 'Married Filing Separately',
  head_of_household: 'Head of Household',
};

export default function ProfilePage() {
  const { data: profile, isLoading, error, refetch } = useProfile();
  const updateSection = useUpdateProfileSection();

  // Dialog states
  const [cashFlowOpen, setCashFlowOpen] = useState(false);
  const [taxOpen, setTaxOpen] = useState(false);
  const [householdOpen, setHouseholdOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [editingGoalType, setEditingGoalType] =
    useState<GoalType>('short_term');

  // Calculate surplus
  const calculateSurplus = (cashFlow: CashFlow) => {
    return (
      cashFlow.gross_income -
      cashFlow.shared_expenses -
      cashFlow.crypto_contributions -
      cashFlow.roth_contributions -
      cashFlow.hsa_contributions -
      cashFlow.discretionary
    );
  };

  // Handlers for saving
  const handleCashFlowSave = (data: CashFlow) => {
    updateSection.mutate(
      { section: 'monthly_cash_flow', updates: data },
      {
        onSuccess: () => setCashFlowOpen(false),
      }
    );
  };

  const handleGoalSave = (data: Goal) => {
    updateSection.mutate(
      {
        section: 'goals',
        updates: { [editingGoalType]: data },
      },
      {
        onSuccess: () => setGoalOpen(false),
      }
    );
  };

  const handleTaxSave = (data: TaxSituation) => {
    updateSection.mutate(
      { section: 'tax_situation', updates: data },
      {
        onSuccess: () => setTaxOpen(false),
      }
    );
  };

  const handleHouseholdSave = (data: HouseholdContext) => {
    updateSection.mutate(
      { section: 'household_context', updates: data },
      {
        onSuccess: () => setHouseholdOpen(false),
      }
    );
  };

  const openGoalDialog = (type: GoalType) => {
    setEditingGoalType(type);
    setGoalOpen(true);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className='p-4 sm:p-6 space-y-6'>
        <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <Skeleton className='h-8 w-40' />
            <Skeleton className='h-5 w-56 mt-2' />
          </div>
        </div>
        <div className='grid gap-6 md:grid-cols-2'>
          <Skeleton className='h-64' />
          <Skeleton className='h-64' />
        </div>
        <Skeleton className='h-80' />
        <Skeleton className='h-40' />
        <Skeleton className='h-40' />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className='p-6'>
        <ErrorCard
          message='Failed to load profile'
          error={error}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  const cashFlow = profile.monthly_cash_flow;
  const goals = profile.goals;
  const tax = profile.tax_situation;
  const household = profile.household_context;
  const surplus = calculateSurplus(cashFlow);

  return (
    <div className='p-4 sm:p-6 space-y-6'>
      {/* Header */}
      <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h1 className='text-2xl sm:text-3xl font-bold'>Financial Profile</h1>
          <p className='text-sm sm:text-base text-muted-foreground mt-1'>
            Edit cash flow, goals, and tax situation
          </p>
        </div>
        {profile.last_updated && (
          <p className='text-xs sm:text-sm text-muted-foreground'>
            Last updated: {formatDate(profile.last_updated)}
          </p>
        )}
      </div>

      <div className='grid gap-6 md:grid-cols-2'>
        {/* Cash Flow Card */}
        <Card>
          <CardHeader className='flex flex-row items-center justify-between'>
            <CardTitle>Monthly Cash Flow</CardTitle>
            <Button
              variant='outline'
              size='sm'
              onClick={() => setCashFlowOpen(true)}
            >
              Edit
            </Button>
          </CardHeader>
          <CardContent className='space-y-3'>
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>Gross Income</span>
              <span className='font-medium'>
                {formatCurrency(cashFlow.gross_income)}
              </span>
            </div>
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>Shared Expenses</span>
              <span className='font-medium'>
                -{formatCurrency(cashFlow.shared_expenses)}
              </span>
            </div>
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>Crypto DCA</span>
              <span className='font-medium'>
                -{formatCurrency(cashFlow.crypto_contributions)}
              </span>
            </div>
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>Roth IRA</span>
              <span className='font-medium'>
                -{formatCurrency(cashFlow.roth_contributions)}
              </span>
            </div>
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>HSA</span>
              <span className='font-medium'>
                -{formatCurrency(cashFlow.hsa_contributions)}
              </span>
            </div>
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>Discretionary</span>
              <span className='font-medium'>
                -{formatCurrency(cashFlow.discretionary)}
              </span>
            </div>
            <div className='border-t pt-3 flex justify-between'>
              <span className='font-medium'>Surplus</span>
              <span
                className={`font-bold ${
                  surplus >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {formatCurrency(surplus)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Calculated Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Calculated</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-center py-8'>
              <p
                className={`text-2xl font-bold ${
                  surplus >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {formatCurrency(surplus)}/mo
              </p>
              <p className='text-sm text-muted-foreground mt-2'>
                Net surplus available after all allocations
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Goals Section */}
      <Card>
        <CardHeader>
          <CardTitle>Goals</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          {(['short_term', 'medium_term', 'long_term'] as GoalType[]).map(
            (type) => {
              const goal = goals[type];
              return (
                <div key={type} className='border rounded-lg p-4 space-y-2'>
                  <div className='flex items-center justify-between'>
                    <h3 className='font-medium'>{GOAL_TYPE_LABELS[type]}</h3>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => openGoalDialog(type)}
                    >
                      Edit
                    </Button>
                  </div>
                  <p className='text-muted-foreground text-sm'>
                    {goal.description || 'No description set'}
                  </p>
                  <div className='flex gap-4 text-sm'>
                    <span>
                      <span className='text-muted-foreground'>Target: </span>
                      {goal.target ? formatCurrency(goal.target) : 'Not set'}
                    </span>
                    <span>
                      <span className='text-muted-foreground'>Deadline: </span>
                      {goal.deadline || 'Not set'}
                    </span>
                  </div>
                </div>
              );
            }
          )}
        </CardContent>
      </Card>

      {/* Tax Situation */}
      <Card>
        <CardHeader className='flex flex-row items-center justify-between'>
          <CardTitle>Tax Situation</CardTitle>
          <Button variant='outline' size='sm' onClick={() => setTaxOpen(true)}>
            Edit
          </Button>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-2 md:grid-cols-3 gap-4 text-sm'>
            <div>
              <span className='text-muted-foreground'>Filing Status</span>
              <p className='font-medium'>
                {FILING_STATUS_LABELS[tax.filing_status] || tax.filing_status}
              </p>
            </div>
            <div>
              <span className='text-muted-foreground'>Federal Bracket</span>
              <p className='font-medium'>{tax.federal_bracket}%</p>
            </div>
            <div>
              <span className='text-muted-foreground'>State Tax</span>
              <p className='font-medium'>{tax.state_tax}%</p>
            </div>
            <div>
              <span className='text-muted-foreground'>Roth Maxed</span>
              <p className='font-medium'>{tax.roth_maxed ? 'Yes' : 'No'}</p>
            </div>
            <div>
              <span className='text-muted-foreground'>401(k)</span>
              <p className='font-medium'>{tax.has_401k ? 'Yes' : 'No'}</p>
            </div>
            <div>
              <span className='text-muted-foreground'>HSA Eligible</span>
              <p className='font-medium'>{tax.hsa_eligible ? 'Yes' : 'No'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Household Context */}
      <Card>
        <CardHeader className='flex flex-row items-center justify-between'>
          <CardTitle>Household Context</CardTitle>
          <Button
            variant='outline'
            size='sm'
            onClick={() => setHouseholdOpen(true)}
          >
            Edit
          </Button>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-2 md:grid-cols-3 gap-4 text-sm'>
            <div>
              <span className='text-muted-foreground'>Wife&apos;s Income</span>
              <p className='font-medium'>
                {formatCurrency(household.wife_income)}/yr
              </p>
            </div>
            <div>
              <span className='text-muted-foreground'>Wife&apos;s Assets</span>
              <p className='font-medium'>
                ~{formatCurrency(household.wife_assets)}
              </p>
            </div>
            <div>
              <span className='text-muted-foreground'>Mortgage</span>
              <p className='font-medium'>
                {formatCurrency(household.mortgage_payment)}/mo
              </p>
            </div>
            <div>
              <span className='text-muted-foreground'>Mortgage Rate</span>
              <p className='font-medium'>{household.mortgage_rate}%</p>
            </div>
            <div>
              <span className='text-muted-foreground'>Mortgage Balance</span>
              <p className='font-medium'>
                {formatCurrency(household.mortgage_balance)}
              </p>
            </div>
            <div>
              <span className='text-muted-foreground'>Home Value</span>
              <p className='font-medium'>
                {formatCurrency(household.home_value)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CashFlowForm
        open={cashFlowOpen}
        onOpenChange={setCashFlowOpen}
        cashFlow={cashFlow}
        onSave={handleCashFlowSave}
        isLoading={updateSection.isPending}
      />

      <GoalEditDialog
        open={goalOpen}
        onOpenChange={setGoalOpen}
        goal={goals[editingGoalType]}
        goalType={editingGoalType}
        onSave={handleGoalSave}
        isLoading={updateSection.isPending}
      />

      <TaxForm
        open={taxOpen}
        onOpenChange={setTaxOpen}
        taxSituation={tax}
        onSave={handleTaxSave}
        isLoading={updateSection.isPending}
      />

      <HouseholdForm
        open={householdOpen}
        onOpenChange={setHouseholdOpen}
        household={household}
        onSave={handleHouseholdSave}
        isLoading={updateSection.isPending}
      />
    </div>
  );
}
