import { useTranslation } from 'react-i18next';
import { Card, Badge, Spinner } from '../../components/ui/index.js';
import { useBankStats } from './hooks.js';

export function BankStatsStrip() {
  const { t } = useTranslation();
  const { data, isLoading } = useBankStats();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Spinner size="sm" />
      </div>
    );
  }

  const counts = data?.countsByStatus || {
    pending_review: 0,
    approved: 0,
    rejected: 0,
    total: 0,
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <Card className="p-4 bg-amber-50/50 border-amber-200">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-amber-800">
            {t('instructor.review.statsPending')}
          </span>
          <Badge variant="warning">{counts.pending_review}</Badge>
        </div>
      </Card>

      <Card className="p-4 bg-emerald-50/50 border-emerald-200">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-emerald-800">
            {t('instructor.review.statsApproved')}
          </span>
          <Badge variant="success">{counts.approved}</Badge>
        </div>
      </Card>

      <Card className="p-4 bg-rose-50/50 border-rose-200">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-rose-800">
            {t('instructor.review.statsRejected')}
          </span>
          <Badge variant="danger">{counts.rejected}</Badge>
        </div>
      </Card>

      <Card className="p-4 bg-slate-50 border-slate-200">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-700">
            {t('instructor.review.statsTotal')}
          </span>
          <Badge variant="neutral">{counts.total}</Badge>
        </div>
      </Card>
    </div>
  );
}
