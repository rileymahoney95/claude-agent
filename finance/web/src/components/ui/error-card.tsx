import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ErrorCardProps {
  message: string;
  error?: Error | null;
  onRetry?: () => void;
}

/**
 * Reusable error display card with optional retry button.
 * Used for data fetching errors on pages.
 */
export function ErrorCard({ message, error, onRetry }: ErrorCardProps) {
  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardContent className="flex flex-col items-center gap-4 py-8 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <p className="font-medium text-destructive">{message}</p>
            {error && (
              <p className="text-sm text-muted-foreground">{error.message}</p>
            )}
          </div>
        </div>
        {onRetry && (
          <Button onClick={onRetry} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
