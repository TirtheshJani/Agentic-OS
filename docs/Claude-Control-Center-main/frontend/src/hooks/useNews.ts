import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import {
  fetchNewsFeed,
  fetchNewsIdeas,
  fetchNewsSources,
  generateNewsIdeas,
  refreshNews,
  exportNewsIdea,
  type VideoIdea,
  type LearningIdea,
} from '../api/news';

export const useNewsFeed = () =>
  useQuery({ queryKey: queryKeys.newsFeed(), queryFn: fetchNewsFeed });

export const useNewsIdeas = () =>
  useQuery({ queryKey: queryKeys.newsIdeas(), queryFn: fetchNewsIdeas });

export const useNewsSources = () =>
  useQuery({ queryKey: queryKeys.newsSources(), queryFn: fetchNewsSources, staleTime: 60_000 });

export const useRefreshNews = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: refreshNews,
    onSuccess: (feed) => qc.setQueryData(queryKeys.newsFeed(), feed),
  });
};

export const useGenerateIdeas = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (kinds: Array<'video' | 'learning'>) => generateNewsIdeas(kinds),
    onSuccess: (ideas) => qc.setQueryData(queryKeys.newsIdeas(), ideas),
  });
};

export const useExportIdea = () =>
  useMutation({
    mutationFn: ({ vaultId, idea }: { vaultId: string; idea: VideoIdea | LearningIdea }) =>
      exportNewsIdea(vaultId, idea),
  });
