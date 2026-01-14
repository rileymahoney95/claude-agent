import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getHoldings,
  getHoldingsFreshness,
  updateHolding,
  deleteHolding,
} from "@/lib/api";
import type { HoldingsResponse, HoldingsFreshnessResponse } from "@/lib/types";

/**
 * Fetch all holdings with live crypto prices.
 */
export function useHoldings() {
  return useQuery<HoldingsResponse>({
    queryKey: ["holdings"],
    queryFn: getHoldings,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Check if holdings data is stale (> 7 days old).
 */
export function useHoldingsFreshness() {
  return useQuery<HoldingsFreshnessResponse>({
    queryKey: ["holdings", "freshness"],
    queryFn: getHoldingsFreshness,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Mutation for updating (or adding) a holding.
 */
export function useUpdateHolding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      category,
      key,
      value,
      notes,
    }: {
      category: string;
      key: string;
      value: number;
      notes?: string;
    }) => updateHolding(category, key, { value, notes }),
    onSuccess: (_data, variables) => {
      toast.success(`${variables.key} holding updated`);
      // Invalidate holdings and portfolio queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
    },
    onError: (error) => {
      toast.error(`Failed to update holding: ${error.message}`);
    },
  });
}

/**
 * Mutation for deleting a holding.
 */
export function useDeleteHolding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ category, key }: { category: string; key: string }) =>
      deleteHolding(category, key),
    onSuccess: (_data, variables) => {
      toast.success(`${variables.key} holding deleted`);
      // Invalidate holdings and portfolio queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
    },
    onError: (error) => {
      toast.error(`Failed to delete holding: ${error.message}`);
    },
  });
}
