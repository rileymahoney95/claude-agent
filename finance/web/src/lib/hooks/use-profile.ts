import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getProfile, updateProfileSection } from "@/lib/api";
import type {
  ProfileResponse,
  ProfileSection,
  CashFlow,
  TaxSituation,
  HouseholdContext,
  Goal,
} from "@/lib/types";

/**
 * Fetch the full financial profile.
 */
export function useProfile() {
  return useQuery<ProfileResponse>({
    queryKey: ["profile"],
    queryFn: getProfile,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Type for profile section updates
type ProfileSectionUpdates =
  | CashFlow
  | TaxSituation
  | HouseholdContext
  | { short_term?: Goal; medium_term?: Goal; long_term?: Goal };

// Section display names for toast messages
const SECTION_NAMES: Record<ProfileSection, string> = {
  monthly_cash_flow: "Cash flow",
  household_context: "Household",
  tax_situation: "Tax situation",
  goals: "Goals",
};

/**
 * Mutation for updating a specific profile section.
 * Invalidates profile, portfolio, and advice queries on success.
 */
export function useUpdateProfileSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      section,
      updates,
    }: {
      section: ProfileSection;
      updates: ProfileSectionUpdates;
    }) => updateProfileSection(section, updates as Record<string, unknown>),
    onSuccess: (_data, variables) => {
      toast.success(`${SECTION_NAMES[variables.section]} updated`);
      // Invalidate related queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["advice"] });
    },
    onError: (error) => {
      toast.error(`Failed to update profile: ${error.message}`);
    },
  });
}
