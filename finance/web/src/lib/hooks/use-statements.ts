import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getStatementsHistory, pullStatements, uploadStatement } from "@/lib/api";
import type { StatementsHistory } from "@/lib/types";

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
