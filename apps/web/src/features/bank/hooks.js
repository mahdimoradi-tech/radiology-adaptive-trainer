import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bankKeys } from './keys.js';
import {
  getBankQuestions,
  getBankStats,
  getBankQuestion,
  approveQuestion,
  rejectQuestion,
  editQuestion,
} from './api.js';

export function useBankQuestions(filters = {}) {
  return useQuery({
    queryKey: bankKeys.list(filters),
    queryFn: () => getBankQuestions(filters),
  });
}

export function useBankStats() {
  return useQuery({
    queryKey: bankKeys.stats(),
    queryFn: () => getBankStats(),
  });
}

export function useBankQuestion(id) {
  return useQuery({
    queryKey: bankKeys.detail(id),
    queryFn: () => getBankQuestion(id),
    enabled: Boolean(id),
  });
}

export function useApproveQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }) => approveQuestion(id, { note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bankKeys.all });
    },
  });
}

export function useRejectQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }) => rejectQuestion(id, { note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bankKeys.all });
    },
  });
}

export function useEditQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => editQuestion(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bankKeys.all });
    },
  });
}
