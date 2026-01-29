"use client";

import { useState } from "react";
import { Download, FileText, Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePullStatements } from "@/lib/hooks/use-statements";
import { FileDropZone } from "./file-drop-zone";

type PullMode = "all" | "latest" | null;

export function ImportPanel() {
  const [pullingMode, setPullingMode] = useState<PullMode>(null);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const pullMutation = usePullStatements();

  const handlePull = async (latest: boolean) => {
    const mode: PullMode = latest ? "latest" : "all";
    setPullingMode(mode);
    setResult(null);

    try {
      const response = await pullMutation.mutateAsync(latest);

      if (response.success) {
        const count = response.count || 0;
        setResult({
          success: true,
          message:
            count > 0
              ? `Successfully processed ${count} statement${count > 1 ? "s" : ""}`
              : "No new statements found in Downloads",
        });
      } else {
        setResult({
          success: false,
          message: response.error || "Failed to pull statements",
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "An error occurred",
      });
    } finally {
      setPullingMode(null);
    }
  };

  const isPulling = pullingMode !== null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import Statements</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Drag and Drop Upload */}
        <FileDropZone />

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              or scan Downloads folder
            </span>
          </div>
        </div>

        {/* Pull from Downloads */}
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <Button
            onClick={() => handlePull(false)}
            disabled={isPulling}
            variant="outline"
            className="w-full sm:w-auto"
          >
            {pullingMode === "all" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Pull from Downloads
          </Button>
          <Button
            variant="outline"
            onClick={() => handlePull(true)}
            disabled={isPulling}
            className="w-full sm:w-auto"
          >
            {pullingMode === "latest" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileText className="h-4 w-4 mr-2" />
            )}
            Pull Latest Only
          </Button>
        </div>

        {result && (
          <Alert variant={result.success ? "default" : "destructive"}>
            {result.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <AlertDescription>{result.message}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
