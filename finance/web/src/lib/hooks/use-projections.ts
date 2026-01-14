/**
 * React Query hooks for projection data and settings.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getProjectionHistory,
  getProjectionSettings,
  updateProjectionSettings as apiUpdateSettings,
  getProjectionScenarios,
  createProjectionScenario,
  updateProjectionScenario,
  deleteProjectionScenario,
} from '@/lib/api';
import {
  toProjectionSettings,
  toHistoricalDataPoints,
  toProjectionScenarios,
  fromProjectionSettings,
  fromScenarioSettings,
} from '@/lib/converters';
import type { ProjectionSettings, ScenarioSettings } from '@/lib/projection';

/**
 * Fetch historical portfolio data.
 * Returns data converted to camelCase format.
 */
export function useProjectionHistory(months = 12) {
  return useQuery({
    queryKey: ['projection', 'history', months],
    queryFn: async () => {
      const response = await getProjectionHistory(months);
      return {
        success: response.success,
        dataPoints: toHistoricalDataPoints(response.data_points),
        range: response.range,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch projection settings (converted to camelCase).
 */
export function useProjectionSettings() {
  return useQuery({
    queryKey: ['projection', 'settings'],
    queryFn: async () => {
      const response = await getProjectionSettings();
      return toProjectionSettings(response.settings);
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Mutation to update projection settings.
 */
export function useUpdateProjectionSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: Partial<ProjectionSettings>) => {
      const apiSettings = fromProjectionSettings(settings);
      return apiUpdateSettings(apiSettings);
    },
    onSuccess: () => {
      toast.success('Projection settings updated');
      queryClient.invalidateQueries({ queryKey: ['projection', 'settings'] });
    },
    onError: (error) => {
      toast.error(`Failed to update settings: ${error.message}`);
    },
  });
}

/**
 * Fetch all projection scenarios (converted to camelCase).
 */
export function useProjectionScenarios() {
  return useQuery({
    queryKey: ['projection', 'scenarios'],
    queryFn: async () => {
      const response = await getProjectionScenarios();
      return toProjectionScenarios(response.scenarios);
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Mutation to create a new scenario.
 */
export function useCreateScenario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      name,
      settings,
      isPrimary,
    }: {
      name: string;
      settings?: ScenarioSettings;
      isPrimary?: boolean;
    }) => {
      // Convert to API format
      const apiSettings = settings ? fromScenarioSettings(settings) : undefined;
      return createProjectionScenario(name, apiSettings, isPrimary);
    },
    onSuccess: () => {
      toast.success('Scenario created');
      queryClient.invalidateQueries({ queryKey: ['projection', 'scenarios'] });
    },
    onError: (error) => {
      toast.error(`Failed to create scenario: ${error.message}`);
    },
  });
}

/**
 * Mutation to update a scenario.
 */
export function useUpdateScenario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      name,
      settings,
      isPrimary,
    }: {
      id: number;
      name?: string;
      settings?: ScenarioSettings;
      isPrimary?: boolean;
    }) => {
      const updates: {
        name?: string;
        settings?: ReturnType<typeof fromScenarioSettings>;
        is_primary?: boolean;
      } = {};
      if (name !== undefined) updates.name = name;
      if (isPrimary !== undefined) updates.is_primary = isPrimary;
      if (settings !== undefined) {
        updates.settings = fromScenarioSettings(settings);
      }
      return updateProjectionScenario(id, updates);
    },
    onSuccess: () => {
      toast.success('Scenario updated');
      queryClient.invalidateQueries({ queryKey: ['projection', 'scenarios'] });
    },
    onError: (error) => {
      toast.error(`Failed to update scenario: ${error.message}`);
    },
  });
}

/**
 * Mutation to delete a scenario.
 */
export function useDeleteScenario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteProjectionScenario,
    onSuccess: () => {
      toast.success('Scenario deleted');
      queryClient.invalidateQueries({ queryKey: ['projection', 'scenarios'] });
    },
    onError: (error) => {
      toast.error(`Failed to delete scenario: ${error.message}`);
    },
  });
}
