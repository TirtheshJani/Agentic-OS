import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/antigravity';

export const useAntigravitySessions = (params: Parameters<typeof api.fetchAntigravitySessions>[0]) => {
  return useQuery({
    queryKey: ['antigravity', 'sessions', params],
    queryFn: () => api.fetchAntigravitySessions(params),
    staleTime: 1000 * 60,
  });
};

export const useAntigravitySession = (sessionId: string) => {
  return useQuery({
    queryKey: ['antigravity', 'session', sessionId],
    queryFn: () => api.fetchAntigravitySession(sessionId),
    enabled: !!sessionId,
  });
};

export const useAntigravityMemory = () => {
  return useQuery({
    queryKey: ['antigravity', 'memory'],
    queryFn: () => api.fetchAntigravityMemory(),
  });
};

export const useAntigravitySkills = () => {
  return useQuery({
    queryKey: ['antigravity', 'skills'],
    queryFn: () => api.fetchAntigravitySkills(),
  });
};

export const useAntigravitySettings = () => {
  return useQuery({
    queryKey: ['antigravity', 'settings'],
    queryFn: () => api.fetchAntigravitySettings(),
  });
};

export const useUpdateAntigravitySettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: any) => api.updateAntigravitySettings(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['antigravity', 'settings'] });
    },
  });
};

export const useAddAntigravitySkill = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, content }: { name: string; content: string }) => api.addAntigravitySkill(name, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['antigravity', 'skills'] });
    },
  });
};

export const useDeleteAntigravitySkill = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.deleteAntigravitySkill(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['antigravity', 'skills'] });
    },
  });
};
