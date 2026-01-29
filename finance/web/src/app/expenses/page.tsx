"use client";

import { ErrorCard } from "@/components/ui/error-card";
import {
  useExpenseSummary,
  useExpenses,
  useRecurringExpenses,
  useMonthOverMonth,
  useSpendingInsights,
  useRefreshInsights,
} from "@/lib/hooks/use-expenses";
import {
  ExpenseSummaryCards,
  CategoryPieChart,
  MonthComparisonChart,
  RecurringChargesCard,
  TransactionTable,
  ImportStatementDialog,
  InsightCards,
} from "@/components/expenses";

export default function ExpensesPage() {
  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useExpenseSummary(1);

  const {
    data: expenses,
    isLoading: expensesLoading,
  } = useExpenses({ limit: 200 });

  const {
    data: recurring,
    isLoading: recurringLoading,
  } = useRecurringExpenses();

  const {
    data: monthOverMonth,
    isLoading: momLoading,
  } = useMonthOverMonth(6);

  const {
    data: insightsData,
    isLoading: insightsLoading,
  } = useSpendingInsights(3);

  const refreshInsights = useRefreshInsights();

  const recurringTotal = recurring?.recurring?.reduce(
    (sum, r) => sum + r.avg_amount,
    0
  );

  if (summaryError) {
    return (
      <div className="p-6">
        <ErrorCard
          message="Failed to load expense data"
          error={summaryError}
          onRetry={() => refetchSummary()}
        />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Expenses</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Credit card spending analysis and trends
          </p>
        </div>
        <ImportStatementDialog />
      </div>

      {/* Summary Cards */}
      <ExpenseSummaryCards
        summary={summary}
        isLoading={summaryLoading}
        recurringTotal={recurringTotal}
      />

      {/* Spending Insights */}
      <InsightCards
        insights={insightsData?.insights}
        isLoading={insightsLoading}
        cached={insightsData?.cached}
        generatedAt={insightsData?.generated_at}
        onRefresh={() => refreshInsights.mutate(3)}
        isRefreshing={refreshInsights.isPending}
      />

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <CategoryPieChart
          categories={summary?.by_category}
          totalPurchases={summary?.total_purchases ?? 0}
          isLoading={summaryLoading}
        />
        <MonthComparisonChart
          months={monthOverMonth?.months}
          isLoading={momLoading}
        />
      </div>

      {/* Recurring Charges */}
      <RecurringChargesCard
        recurring={recurring?.recurring}
        isLoading={recurringLoading}
      />

      {/* Transaction Table */}
      <TransactionTable
        transactions={expenses?.transactions}
        isLoading={expensesLoading}
      />
    </div>
  );
}
