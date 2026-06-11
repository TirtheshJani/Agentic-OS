import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchSettings,
  updateSettings,
  fetchPlugins,
  togglePlugin,
  fetchCommands,
  fetchSkills,
  fetchActiveSessions,
  fetchTasks,
} from '../api/settings';
import { queryKeys } from '../lib/queryKeys';

export function useSettings() {
  return useQuery({ queryKey: queryKeys.settings(), queryFn: fetchSettings, staleTime: 60_000 });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateSettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.settings() }),
  });
}

export function usePlugins() {
  return useQuery({ queryKey: queryKeys.plugins(), queryFn: fetchPlugins, staleTime: 60_000 });
}

export function useTogglePlugin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pluginId, enabled }: { pluginId: string; enabled: boolean }) =>
      togglePlugin(pluginId, enabled),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.plugins() });
      qc.invalidateQueries({ queryKey: queryKeys.settings() });
    },
  });
}

export function useCommands() {
  return useQuery({ queryKey: queryKeys.commands(), queryFn: fetchCommands, staleTime: 300_000 });
}

export function useSkills() {
  return useQuery({ queryKey: queryKeys.skills(), queryFn: fetchSkills, staleTime: 300_000 });
}

export function useActiveSessions() {
  return useQuery({ queryKey: queryKeys.activeSessions(), queryFn: fetchActiveSessions, staleTime: 10_000 });
}

export function useTasks() {
  return useQuery({ queryKey: queryKeys.tasks(), queryFn: fetchTasks, staleTime: 30_000 });
}
