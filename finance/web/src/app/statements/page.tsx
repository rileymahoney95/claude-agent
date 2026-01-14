"use client";

import { ErrorCard } from "@/components/ui/error-card";
import { ImportPanel, HistoryTable } from "@/components/statements";
import { useStatementsHistory } from "@/lib/hooks/use-statements";

export default function StatementsPage() {
  const { data, isLoading, error, refetch } = useStatementsHistory();

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Statements</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          View history and import new statements
        </p>
      </div>

      {/* Import Section */}
      <ImportPanel />

      {/* Error State */}
      {error && (
        <ErrorCard
          message="Failed to load statement history"
          error={error instanceof Error ? error : null}
          onRetry={() => refetch()}
        />
      )}

      {/* Snapshot History */}
      <HistoryTable snapshots={data?.snapshots ?? []} isLoading={isLoading} />
    </div>
  );
}
