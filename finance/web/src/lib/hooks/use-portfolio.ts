import { useQuery } from "@tanstack/react-query";
import { getPortfolio } from "@/lib/api";
import type { Portfolio } from "@/lib/types";

interface UsePortfolioOptions {
  noPrices?: boolean;
}

export function usePortfolio(options?: UsePortfolioOptions) {
  return useQuery<Portfolio>({
    queryKey: ["portfolio", options],
    queryFn: () => getPortfolio(options),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
