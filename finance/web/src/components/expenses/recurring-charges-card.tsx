"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import type { RecurringCharge } from "@/lib/types";

interface RecurringChargesCardProps {
  recurring: RecurringCharge[] | undefined;
  isLoading: boolean;
}

export function RecurringChargesCard({
  recurring,
  isLoading,
}: RecurringChargesCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-3">
          <Skeleton className="h-6 w-48" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const total = recurring?.reduce((sum, r) => sum + r.avg_amount, 0) ?? 0;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Recurring Charges</h3>
          {recurring && recurring.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {formatCurrency(total)}/mo
            </span>
          )}
        </div>

        {!recurring || recurring.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No recurring charges detected. Need 2+ months of data.
          </p>
        ) : (
          <div className="space-y-3">
            {recurring.map((item) => (
              <div
                key={item.merchant}
                className="flex items-center justify-between py-2 border-b last:border-b-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate capitalize">
                    {item.merchant}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {item.category && (
                      <Badge variant="secondary" className="text-xs">
                        {item.category}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {item.months_seen} months
                    </span>
                  </div>
                </div>
                <span className="text-sm font-medium ml-4">
                  {formatCurrency(item.avg_amount)}/mo
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
