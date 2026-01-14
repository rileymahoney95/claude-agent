"use client";

import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface StalenessWarningProps {
  daysOld: number | null;
  threshold?: number;
}

export function StalenessWarning({
  daysOld,
  threshold = 7,
}: StalenessWarningProps) {
  // Don't show if data is fresh or we don't know the age
  if (daysOld === null || daysOld <= threshold) {
    return null;
  }

  return (
    <Alert className="border-yellow-500/50 bg-yellow-500/10">
      <AlertTriangle className="h-4 w-4 text-yellow-600" />
      <AlertTitle className="text-yellow-600">Holdings data is stale</AlertTitle>
      <AlertDescription className="text-yellow-600/80">
        Holdings data is {daysOld} days old. Consider updating your balances to
        ensure accurate portfolio calculations.
      </AlertDescription>
    </Alert>
  );
}
