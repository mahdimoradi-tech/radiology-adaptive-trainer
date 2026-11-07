import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { practiceKeys } from './keys.js';
import {
  getPracticeSets,
  getPracticeSet,
  createPracticeSet,
  answerPracticeQuestion,
} from './api.js';

/**
 * Hook to fetch paginated practice sets
 *
 * @param {Object} [params]
 * @param {number} [params.page=1]
 * @param {number} [params.pageSize=20]
 */
export function usePracticeSets({ page = 1, pageSize = 20 } = {}) {
  return useQuery({
    queryKey: practiceKeys.list({ page, pageSize }),
    queryFn: () => getPracticeSets({ page, pageSize }),
  });
}

/**
 * Hook to fetch a single practice set by ID
 *
 * @param {string} setId
 */
export function usePracticeSet(setId) {
  return useQuery({
    queryKey: practiceKeys.detail(setId),
    queryFn: () => getPracticeSet(setId),
    enabled: Boolean(setId),
  });
}

/**
 * Hook to create a new targeted practice set
 */
export function useCreatePracticeSet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ size = 10 } = {}) => createPracticeSet({ size }),
    onSuccess: (newSet) => {
      queryClient.invalidateQueries({ queryKey: practiceKeys.lists() });
      if (newSet?.id) {
        queryClient.setQueryData(practiceKeys.detail(newSet.id), newSet);
      }
    },
  });
}

/**
 * Hook to record an answer for a question in a practice set
 *
 * @param {string} setId
 */
export function useAnswerPracticeQuestion(setId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ questionNo, selectedIndex, timeMs }) =>
      answerPracticeQuestion({ setId, questionNo, selectedIndex, timeMs }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: practiceKeys.detail(setId) });
      queryClient.invalidateQueries({ queryKey: practiceKeys.lists() });
    },
  });
}
