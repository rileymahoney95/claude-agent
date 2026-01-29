import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getStatementsHistory,
  pullStatements,
  uploadStatement,
  importStatements,
} from "@/lib/api";
import type { StatementsHistory, ImportStatementsResponse } from "@/lib/types";

/**
 * Fetch snapshot history with optional account filter.
 * @param account - Optional filter by account type (roth_ira, brokerage, traditional_ira)
 */
export function useStatementsHistory(account?: string) {
  return useQuery<StatementsHistory>({
    queryKey: ["statements", "history", account],
    queryFn: () => getStatementsHistory(account),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Mutation to pull and process statements from Downloads folder.
 */
export function usePullStatements() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (latest?: boolean) => pullStatements(latest),
    onSuccess: (data) => {
      if (data.success) {
        const count = data.count || 0;
        toast.success(
          count > 0
            ? `Imported ${count} statement${count > 1 ? "s" : ""}`
            : "No new statements found"
        );
      } else {
        toast.error(data.error || "Failed to pull statements");
      }
      // Invalidate statements history to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ["statements"] });
      // Also invalidate portfolio since new statements affect it
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
    },
    onError: (error) => {
      toast.error(`Failed to pull statements: ${error.message}`);
    },
  });
}

/**
 * Mutation to upload and process a statement PDF file.
 */
export function useUploadStatement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => uploadStatement(file),
    onSuccess: (data) => {
      if (data.success) {
        const account = data.account?.replace("_", " ") || "statement";
        toast.success(`Imported ${account} from ${data.date || "unknown date"}`);
      } else {
        toast.error(data.error || "Failed to upload statement");
      }
      // Invalidate statements history to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ["statements"] });
      // Also invalidate portfolio since new statements affect it
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
    },
    onError: (error) => {
      toast.error(`Failed to upload statement: ${error.message}`);
    },
  });
}

/**
 * Mutation to upload multiple statement PDFs with auto-classification.
 */
export function useImportStatements() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (files: File[]) => importStatements(files),
    onSuccess: (data: ImportStatementsResponse) => {
      if (data.success) {
        toast.success(
          `Imported ${data.imported} statement${data.imported !== 1 ? "s" : ""}${
            data.failed > 0 ? ` (${data.failed} failed)` : ""
          }`
        );
      } else {
        toast.error("All imports failed");
      }
      queryClient.invalidateQueries({ queryKey: ["statements"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (error) => {
      toast.error(`Import failed: ${error.message}`);
    },
  });
}
