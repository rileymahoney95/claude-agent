"use client";

import { Card, CardContent } from "@/components/ui/card";
import { daysAgo, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { DataFreshness as DataFreshnessType } from "@/lib/types";

interface DataFreshnessProps {
  freshness: DataFreshnessType;
}

// Thresholds in days
const THRESHOLDS = {
  sofi: 30, // Monthly statements
  holdings: 7, // Weekly updates expected
};

type FreshnessStatus = "green" | "yellow" | "red";

function getFreshnessStatus(
  dateStr: string | null,
  threshold: number
): { status: FreshnessStatus; days: number | null } {
  if (!dateStr) {
    return { status: "red", days: null };
  }

  const days = daysAgo(dateStr);
  const ratio = days / threshold;

  if (ratio <= 0.5) {
    return { status: "green", days };
  } else if (ratio <= 1) {
    return { status: "yellow", days };
  } else {
    return { status: "red", days };
  }
}

function getCryptoPricesStatus(
  status: DataFreshnessType["crypto_prices"]
): FreshnessStatus {
  switch (status) {
    case "live":
      return "green";
    case "skipped":
      return "yellow";
    case "unavailable":
    default:
      return "red";
  }
}

const STATUS_COLORS: Record<FreshnessStatus, string> = {
  green: "bg-green-500",
  yellow: "bg-amber-500",
  red: "bg-red-500",
};

export function DataFreshness({ freshness }: DataFreshnessProps) {
  // Guard against undefined freshness
  if (!freshness) {
    return null;
  }
  
  const sofi = getFreshnessStatus(freshness.sofi_snapshots, THRESHOLDS.sofi);
  const holdings = getFreshnessStatus(freshness.holdings, THRESHOLDS.holdings);
  const cryptoStatus = getCryptoPricesStatus(freshness.crypto_prices);

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          Data Freshness
        </span>
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <FreshnessIndicator
            label="SoFi"
            status={sofi.status}
            detail={
              freshness.sofi_snapshots
                ? formatDate(freshness.sofi_snapshots)
                : "No data"
            }
          />
          <FreshnessIndicator
            label="Holdings"
            status={holdings.status}
            detail={
              holdings.days !== null
                ? holdings.days === 0
                  ? "Today"
                  : `${holdings.days}d ago`
                : "No data"
            }
          />
          <FreshnessIndicator
            label="Prices"
            status={cryptoStatus}
            detail={
              freshness.crypto_prices === "live"
                ? "Live"
                : freshness.crypto_prices === "skipped"
                ? "Skipped"
                : "Unavailable"
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}

function FreshnessIndicator({
  label,
  status,
  detail,
}: {
  label: string;
  status: FreshnessStatus;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className={cn("h-2 w-2 rounded-full", STATUS_COLORS[status])} />
      <div className="text-sm">
        <span className="font-medium">{label}:</span>{" "}
        <span className="text-muted-foreground">{detail}</span>
      </div>
    </div>
  );
}
