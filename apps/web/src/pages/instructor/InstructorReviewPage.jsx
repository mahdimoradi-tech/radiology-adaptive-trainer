import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button } from '../../components/ui/index.js';
import { BankStatsStrip } from '../../features/bank/BankStatsStrip.jsx';
import { BankFilterBar } from '../../features/bank/BankFilterBar.jsx';
import { BankQuestionList } from '../../features/bank/BankQuestionList.jsx';
import { BankQuestionDetail } from '../../features/bank/BankQuestionDetail.jsx';
import {
  useBankQuestions,
  useApproveQuestion,
  useRejectQuestion,
  useEditQuestion,
} from '../../features/bank/hooks.js';

export function InstructorReviewPage() {
  const { t } = useTranslation();

  const [filters, setFilters] = useState({
    status: 'pending_review',
    type: undefined,
    trueClass: undefined,
    page: 1,
    pageSize: 20,
  });

  const { data, isLoading, isError, error, refetch } = useBankQuestions(filters);

  const questions = useMemo(() => data?.items || [], [data?.items]);
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  const [selectedId, setSelectedId] = useState(null);

  // Sync selectedId when questions change
  useEffect(() => {
    if (questions.length > 0) {
      if (!selectedId || !questions.some((q) => q.id === selectedId)) {
        setSelectedId(questions[0].id);
      }
    } else {
      setSelectedId(null);
    }
  }, [questions, selectedId]);

  const selectedQuestion = useMemo(
    () => questions.find((q) => q.id === selectedId) || null,
    [questions, selectedId],
  );

  const approveMutation = useApproveQuestion();
  const rejectMutation = useRejectQuestion();
  const editMutation = useEditQuestion();

  // Helper to advance to next question in list
  const advanceToNext = useCallback(() => {
    setSelectedId((current) => {
      if (!questions.length) return null;
      if (!current) return questions[0].id;
      const currentIndex = questions.findIndex((q) => q.id === current);
      if (currentIndex !== -1 && currentIndex + 1 < questions.length) {
        return questions[currentIndex + 1].id;
      }
      return current;
    });
  }, [questions]);

  const retreatToPrev = useCallback(() => {
    setSelectedId((current) => {
      if (!questions.length) return null;
      if (!current) return questions[0].id;
      const currentIndex = questions.findIndex((q) => q.id === current);
      if (currentIndex > 0) {
        return questions[currentIndex - 1].id;
      }
      return current;
    });
  }, [questions]);

  const handleApprove = useCallback(
    async ({ note } = {}) => {
      if (!selectedId) return;
      await approveMutation.mutateAsync({ id: selectedId, note });
      advanceToNext();
    },
    [selectedId, approveMutation, advanceToNext],
  );

  const handleReject = useCallback(
    async ({ note } = {}) => {
      if (!selectedId) return;
      await rejectMutation.mutateAsync({ id: selectedId, note });
      advanceToNext();
    },
    [selectedId, rejectMutation, advanceToNext],
  );

  const handleEdit = useCallback(
    async (data) => {
      if (!selectedId) return;
      await editMutation.mutateAsync({ id: selectedId, data });
    },
    [selectedId, editMutation],
  );

  // Keyboard shortcuts (A = approve, R = reject, J/ArrowDown = next, K/ArrowUp = prev)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if focus is inside an input, textarea, or select
      const tag = e.target.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'a') {
        e.preventDefault();
        handleApprove({});
      } else if (key === 'r') {
        e.preventDefault();
        handleReject({});
      } else if (key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        advanceToNext();
      } else if (key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        retreatToPrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, handleApprove, handleReject, advanceToNext, retreatToPrev]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t('instructor.review.title')}</h1>
          <p className="text-xs text-slate-600 mt-1">{t('instructor.reviewDesc')}</p>
        </div>

        {/* Shortcuts Pill */}
        <div className="text-[11px] font-medium bg-amber-50 text-amber-900 border border-amber-200/80 px-3 py-1.5 rounded-lg shadow-2xs">
          {t('instructor.review.shortcutsHint')}
        </div>
      </div>

      {isError && (
        <Alert
          variant="danger"
          action={
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              {t('common.retry', 'تلاش مجدد')}
            </Button>
          }
        >
          {error?.message ||
            t('instructor.review.errorLoading', 'خطا در بارگذاری سؤالات بانک سوال.')}
        </Alert>
      )}

      {/* Stats Summary Strip */}
      <BankStatsStrip />

      {/* Filters Bar */}
      <BankFilterBar filters={filters} onFilterChange={setFilters} />

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px]">
        {/* Left: Question List (5 cols on large screens) */}
        <div className="lg:col-span-5 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs h-[650px] flex flex-col">
          <BankQuestionList
            questions={questions}
            total={total}
            page={filters.page || 1}
            pageSize={filters.pageSize || 20}
            totalPages={totalPages}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
            isLoading={isLoading}
          />
        </div>

        {/* Right: Question Detail & Actions (7 cols on large screens) */}
        <div className="lg:col-span-7 h-[650px]">
          <BankQuestionDetail
            question={selectedQuestion}
            onApprove={handleApprove}
            onReject={handleReject}
            onEdit={handleEdit}
            isActionLoading={
              approveMutation.isPending || rejectMutation.isPending || editMutation.isPending
            }
          />
        </div>
      </div>
    </div>
  );
}
