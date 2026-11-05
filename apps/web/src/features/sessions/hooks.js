import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sessionKeys } from './keys.js';
import {
  getSessions,
  getSession,
  createSession,
  answerQuestion,
  finishSession,
  getSessionReport,
} from './api.js';

/**
 * Hook to fetch paginated list of sessions
 * @param {Object} [params]
 * @param {number} [params.page=1]
 * @param {number} [params.pageSize=20]
 */
export function useSessions({ page = 1, pageSize = 20 } = {}) {
  return useQuery({
    queryKey: sessionKeys.list({ page, pageSize }),
    queryFn: () => getSessions({ page, pageSize }),
  });
}

/**
 * Hook to fetch a single session by its ID
 * @param {string} sessionId
 */
export function useSession(sessionId) {
  return useQuery({
    queryKey: sessionKeys.detail(sessionId),
    queryFn: () => getSession(sessionId),
    enabled: Boolean(sessionId),
  });
}

/**
 * Hook to fetch evaluation report for a completed session
 * @param {string} sessionId
 */
export function useSessionReport(sessionId) {
  return useQuery({
    queryKey: sessionKeys.report(sessionId),
    queryFn: () => getSessionReport(sessionId),
    enabled: Boolean(sessionId),
  });
}

/**
 * Hook to create a new session
 */
export function useCreateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ size = 60 } = {}) => createSession({ size }),
    onSuccess: (newSession) => {
      queryClient.invalidateQueries({ queryKey: sessionKeys.lists() });
      if (newSession?.id) {
        queryClient.setQueryData(sessionKeys.detail(newSession.id), newSession);
      }
    },
  });
}

/**
 * Hook to record an answer with optimistic cache updates
 * @param {string} sessionId
 */
export function useAnswerQuestion(sessionId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ questionNo, answer, timeMs }) =>
      answerQuestion(sessionId, questionNo, { answer, timeMs }),
    onMutate: async ({ questionNo, answer }) => {
      const queryKey = sessionKeys.detail(sessionId);
      await queryClient.cancelQueries({ queryKey });

      const previousSession = queryClient.getQueryData(queryKey);

      if (previousSession && Array.isArray(previousSession.questions)) {
        let addedAnswer = false;
        const updatedQuestions = previousSession.questions.map((q) => {
          if (q.no === questionNo) {
            if (!q.answered) addedAnswer = true;
            return { ...q, answered: true, answer };
          }
          return q;
        });

        queryClient.setQueryData(queryKey, {
          ...previousSession,
          answeredCount: previousSession.answeredCount + (addedAnswer ? 1 : 0),
          questions: updatedQuestions,
        });
      }

      return { previousSession };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousSession) {
        queryClient.setQueryData(sessionKeys.detail(sessionId), context.previousSession);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: sessionKeys.detail(sessionId) });
    },
  });
}

/**
 * Hook to finish a session and compute its report
 */
export function useFinishSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId) => finishSession(sessionId),
    onSuccess: (report, sessionId) => {
      if (report && sessionId) {
        queryClient.setQueryData(sessionKeys.report(sessionId), report);
      }
      queryClient.invalidateQueries({ queryKey: sessionKeys.detail(sessionId) });
      queryClient.invalidateQueries({ queryKey: sessionKeys.lists() });
    },
  });
}
