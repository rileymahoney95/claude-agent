import { useQuery } from "@tanstack/react-query";
import { getAdvice } from "@/lib/api";
import type { Advice, AdviceFocus } from "@/lib/types";

export function useAdvice(focus?: Exclude<AdviceFocus, "all">) {
  return useQuery<Advice>({
    queryKey: ["advice", focus],
    queryFn: () => getAdvice(focus),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
