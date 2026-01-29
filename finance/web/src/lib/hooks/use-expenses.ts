import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getExpenseSummary,
  getExpenses,
  getRecurringExpenses,
  getMonthOverMonth,
  getExpenseStatements,
  importExpenseStatement,
  getSpendingInsights,
  refreshSpendingInsights,
} from "@/lib/api";
import type {
  ExpenseSummary,
  ExpenseTransactionsResponse,
  ExpenseRecurringResponse,
  ExpenseMonthOverMonthResponse,
  ExpenseStatementsResponse,
  SpendingInsightsResponse,
} from "@/lib/types";

export function useExpenseSummary(months = 1) {
  return useQuery<ExpenseSummary>({
    queryKey: ["expense-summary", months],
    queryFn: () => getExpenseSummary(months),
    staleTime: 5 * 60 * 1000,
  });
}

export function useExpenses(options?: {
  startDate?: string;
  endDate?: string;
  category?: string;
  merchant?: string;
  limit?: number;
}) {
  return useQuery<ExpenseTransactionsResponse>({
    queryKey: ["expenses", options],
    queryFn: () => getExpenses(options),
    staleTime: 5 * 60 * 1000,
  });
}

export function useRecurringExpenses() {
  return useQuery<ExpenseRecurringResponse>({
    queryKey: ["expenses-recurring"],
    queryFn: () => getRecurringExpenses(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useMonthOverMonth(months = 6) {
  return useQuery<ExpenseMonthOverMonthResponse>({
    queryKey: ["expenses-month-over-month", months],
    queryFn: () => getMonthOverMonth(months),
    staleTime: 5 * 60 * 1000,
  });
}

export function useExpenseStatements() {
  return useQuery<ExpenseStatementsResponse>({
    queryKey: ["expense-statements"],
    queryFn: () => getExpenseStatements(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSpendingInsights(months = 3) {
  return useQuery<SpendingInsightsResponse>({
    queryKey: ["spending-insights", months],
    queryFn: () => getSpendingInsights(months),
    staleTime: 5 * 60 * 1000,
  });
}

export function useRefreshInsights() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (months: number) => refreshSpendingInsights(months),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spending-insights"] });
    },
  });
}

export function useImportStatement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => importExpenseStatement(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expense-summary"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expenses-recurring"] });
      queryClient.invalidateQueries({ queryKey: ["expenses-month-over-month"] });
      queryClient.invalidateQueries({ queryKey: ["expense-statements"] });
      queryClient.invalidateQueries({ queryKey: ["spending-insights"] });
    },
  });
}
