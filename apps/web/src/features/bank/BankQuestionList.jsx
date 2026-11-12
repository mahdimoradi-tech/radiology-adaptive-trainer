import { useTranslation } from 'react-i18next';
import { Badge, Spinner, Button } from '../../components/ui/index.js';

export function BankQuestionList({
  questions = [],
  page = 1,
  totalPages = 1,
  selectedId,
  onSelect,
  onPageChange,
  isLoading,
}) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center text-slate-600 text-xs">
        {t('instructor.review.noQuestions')}
      </div>
    );
  }

  const getTypeBadgeVariant = (type) => {
    switch (type) {
      case 'finding':
        return 'primary';
      case 'distribution':
        return 'warning';
      case 'differential':
        return 'neutral';
      default:
        return 'neutral';
    }
  };

  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case 'approved':
        return 'success';
      case 'rejected':
        return 'danger';
      case 'pending_review':
      default:
        return 'warning';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto space-y-2 pe-1">
        {questions.map((q) => {
          const isSelected = q.id === selectedId;

          return (
            <div
              key={q.id}
              onClick={() => onSelect(q.id)}
              className={`p-3 rounded-xl border text-start cursor-pointer transition-all ${
                isSelected
                  ? 'border-amber-500 bg-amber-50/40 shadow-xs ring-1 ring-amber-500/30'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant={getTypeBadgeVariant(q.type)} size="sm">
                    {t(`instructor.review.${q.type}`)}
                  </Badge>
                  <span className="text-[10px] font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                    {q.pair?.trueClass}
                  </span>
                  <span className="text-[10px] text-slate-600 font-medium">{q.bucket}</span>
                  {q.edited && (
                    <Badge variant="neutral" size="sm">
                      {t('instructor.review.edited')}
                    </Badge>
                  )}
                </div>

                <Badge variant={getStatusBadgeVariant(q.status)} size="sm">
                  {t(`instructor.review.${q.status === 'pending_review' ? 'pending' : q.status}`)}
                </Badge>
              </div>

              <p className="text-xs font-medium text-slate-800 line-clamp-2 leading-relaxed">
                {q.stem}
              </p>
            </div>
          );
        })}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="pt-4 mt-4 border-t border-slate-200 flex items-center justify-between gap-2 text-xs">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            {t('instructor.review.prevPage')}
          </Button>

          <span className="text-slate-700 font-medium">
            {t('instructor.review.pageOf', { page, total: totalPages })}
          </span>

          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            {t('instructor.review.nextPage')}
          </Button>
        </div>
      )}
    </div>
  );
}
