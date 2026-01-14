"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Snapshot } from "@/lib/types";

// Map account type keys to friendly display names
const ACCOUNT_NAMES: Record<string, string> = {
  roth_ira: "Roth IRA",
  brokerage: "Brokerage",
  traditional_ira: "Traditional IRA",
};

// Map account types to badge colors
const ACCOUNT_COLORS: Record<string, string> = {
  roth_ira: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  brokerage: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  traditional_ira: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

interface HistoryTableProps {
  snapshots: Snapshot[];
  isLoading?: boolean;
}

function formatDelta(delta: number | null): { text: string; className: string } {
  if (delta === null) {
    return { text: "—", className: "text-muted-foreground" };
  }

  if (delta >= 0) {
    return {
      text: `+${formatCurrency(delta)}`,
      className: "text-green-600 dark:text-green-400",
    };
  } else {
    return {
      text: formatCurrency(delta), // Already includes minus sign
      className: "text-red-600 dark:text-red-400",
    };
  }
}

function getAccountName(accountType: string): string {
  return ACCOUNT_NAMES[accountType] || accountType;
}

function getAccountBadgeClass(accountType: string): string {
  return ACCOUNT_COLORS[accountType] || "bg-gray-100 text-gray-800";
}

function TableSkeleton() {
  return (
    <>
      {/* Desktop skeleton */}
      <div className="hidden md:block">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-4 gap-4 p-4 border-b last:border-b-0 items-center"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
      {/* Mobile skeleton */}
      <div className="md:hidden space-y-3 p-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-2">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </>
  );
}

export function HistoryTable({ snapshots, isLoading }: HistoryTableProps) {
  const emptyContent = (
    <div className="rounded-lg border p-8 text-center text-muted-foreground">
      <p className="mb-2">No statement snapshots yet</p>
      <p className="text-sm">
        Download your SoFi/Apex statements to ~/Downloads and click
        &quot;Pull from Downloads&quot; to import them.
      </p>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Snapshot History</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <TableSkeleton />
        ) : snapshots.length === 0 ? (
          emptyContent
        ) : (
          <>
            {/* Desktop table view */}
            <div className="hidden md:block border rounded-lg overflow-hidden">
              <div className="grid grid-cols-4 gap-4 p-4 border-b bg-muted/50 text-sm font-medium">
                <div>Date</div>
                <div>Account</div>
                <div>Total Value</div>
                <div>Change</div>
              </div>
              {snapshots.map((snapshot, index) => {
                const delta = formatDelta(snapshot.delta);
                return (
                  <div
                    key={`${snapshot.date}-${snapshot.account}-${index}`}
                    className="grid grid-cols-4 gap-4 p-4 border-b last:border-b-0 items-center"
                  >
                    <div className="text-sm">{formatDate(snapshot.date)}</div>
                    <div>
                      <Badge
                        variant="secondary"
                        className={getAccountBadgeClass(snapshot.account)}
                      >
                        {getAccountName(snapshot.account)}
                      </Badge>
                    </div>
                    <div className="font-medium">
                      {formatCurrency(snapshot.total_value)}
                    </div>
                    <div className={delta.className}>{delta.text}</div>
                  </div>
                );
              })}
            </div>

            {/* Mobile card view */}
            <div className="md:hidden space-y-3">
              {snapshots.map((snapshot, index) => {
                const delta = formatDelta(snapshot.delta);
                return (
                  <div
                    key={`${snapshot.date}-${snapshot.account}-${index}`}
                    className="rounded-lg border p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <Badge
                        variant="secondary"
                        className={getAccountBadgeClass(snapshot.account)}
                      >
                        {getAccountName(snapshot.account)}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(snapshot.date)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {formatCurrency(snapshot.total_value)}
                      </span>
                      <span className={delta.className}>{delta.text}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
