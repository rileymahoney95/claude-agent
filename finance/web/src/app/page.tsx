'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorCard } from '@/components/ui/error-card';
import { ArrowRight } from 'lucide-react';

import { usePortfolio } from '@/lib/hooks/use-portfolio';
import { useAdvice } from '@/lib/hooks/use-advice';

import { PortfolioSummary } from '@/components/dashboard/portfolio-summary';
import { AllocationChart } from '@/components/dashboard/allocation-chart';
import { GoalCard } from '@/components/dashboard/goal-card';
import { RecommendationCard } from '@/components/dashboard/recommendation-card';
import { DataFreshness } from '@/components/dashboard/data-freshness';
import { NetWorthChart } from '@/components/dashboard/net-worth-chart';

export default function DashboardPage() {
  const {
    data: portfolio,
    isLoading: portfolioLoading,
    error: portfolioError,
    refetch: refetchPortfolio,
  } = usePortfolio();
  const {
    data: advice,
    isLoading: adviceLoading,
    error: adviceError,
    refetch: refetchAdvice,
  } = useAdvice();

  // Don't block everything - let each section render independently
  const error = portfolioError || adviceError;

  const handleRetry = () => {
    refetchPortfolio();
    refetchAdvice();
  };

  if (error) {
    return (
      <div className='p-6'>
        <ErrorCard
          message='Failed to load dashboard data'
          error={error}
          onRetry={handleRetry}
        />
      </div>
    );
  }

  // Handle API-level errors (success: false)
  if (portfolio && !portfolio.success) {
    return (
      <div className='p-6'>
        <ErrorCard
          message='No portfolio data available'
          error={
            new Error(
              (portfolio as unknown as { error?: string }).error ||
                'Run "finance pull" to import statements or "finance holdings set" to add holdings.'
            )
          }
          onRetry={handleRetry}
        />
      </div>
    );
  }

  return (
    <div className='p-4 sm:p-6 space-y-6'>
      {/* Portfolio Summary Header */}
      <Card>
        <CardContent className='pt-6'>
          {portfolioLoading || !portfolio ? (
            <div className='flex items-center justify-between'>
              <div className='space-y-2'>
                <Skeleton className='h-4 w-24' />
                <Skeleton className='h-10 w-40' />
              </div>
              <Skeleton className='h-4 w-32' />
            </div>
          ) : (
            <PortfolioSummary
              totalValue={portfolio.total_value}
              asOf={portfolio.as_of}
            />
          )}
        </CardContent>
      </Card>

      {/* Net Worth Over Time */}
      <NetWorthChart />

      {/* Main Grid: Chart + Goals */}
      <div className='grid gap-6 lg:grid-cols-2'>
        {/* Allocation Chart */}
        {portfolioLoading || !portfolio ? (
          <Card>
            <CardHeader>
              <Skeleton className='h-5 w-24' />
            </CardHeader>
            <CardContent>
              <div className='flex flex-col items-center gap-4'>
                <Skeleton className='h-48 w-48 rounded-full' />
                <div className='grid w-full grid-cols-2 gap-3'>
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className='h-12 w-full' />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <AllocationChart byCategory={portfolio.by_category} />
        )}

        {/* Goal Cards */}
        <div className='space-y-4'>
          <h2 className='text-lg font-semibold'>Goals</h2>
          {adviceLoading || !advice ? (
            <div className='space-y-4'>
              {[1, 2].map((i) => (
                <Card key={i}>
                  <CardHeader className='pb-2'>
                    <Skeleton className='h-5 w-32' />
                  </CardHeader>
                  <CardContent className='space-y-3'>
                    <Skeleton className='h-4 w-full' />
                    <Skeleton className='h-2 w-full' />
                    <Skeleton className='h-3 w-24' />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className='space-y-4'>
              {(advice.goal_details ?? []).map((goal) => (
                <GoalCard key={goal.type} goal={goal} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Recommendations */}
      <Card>
        <CardHeader className='flex flex-row items-center justify-between'>
          <CardTitle>Top Recommendations</CardTitle>
          <Button variant='ghost' size='sm' asChild>
            <Link href='/advisor' className='gap-1'>
              View All
              <ArrowRight className='h-4 w-4' />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className='space-y-3'>
          {adviceLoading || !advice ? (
            <div className='space-y-3'>
              {[1, 2].map((i) => (
                <Card key={i}>
                  <CardContent className='p-4'>
                    <Skeleton className='h-5 w-full' />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <>
              {(advice.recommendations ?? [])
                .filter((r) => r.priority === 'high' || r.priority === 'medium')
                .slice(0, 3)
                .map((recommendation, index) => (
                  <RecommendationCard
                    key={`${recommendation.type}-${index}`}
                    recommendation={recommendation}
                    defaultExpanded={recommendation.priority === 'high'}
                  />
                ))}
            </>
          )}
        </CardContent>
      </Card>

      {/* Data Freshness */}
      {portfolioLoading || !portfolio ? (
        <Card>
          <CardContent className='flex items-center justify-between py-3'>
            <Skeleton className='h-4 w-24' />
            <div className='flex items-center gap-6'>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className='h-4 w-20' />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : portfolio.data_freshness ? (
        <DataFreshness freshness={portfolio.data_freshness} />
      ) : null}
    </div>
  );
}
