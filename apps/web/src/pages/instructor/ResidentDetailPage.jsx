import { useParams, Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAdminUserProgress } from '../../features/progress/hooks.js';
import { ProgressView } from '../../features/progress/ProgressView.jsx';
import { Spinner, Alert, Button } from '../../components/ui/index.js';

export function ResidentDetailPage() {
  const { userId } = useParams();
  const { t } = useTranslation();

  const { data, isLoading, isError, error, refetch } = useAdminUserProgress(userId);

  if (isLoading) {
    return (
      <div
        className="min-h-[50vh] flex items-center justify-center"
        data-testid="resident-detail-loading"
      >
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 py-8" data-testid="resident-detail-error">
        <Alert variant="error">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-sm">
                {t('instructor.residents.notFound', 'دستیار مورد نظر یافت نشد.')}
              </p>
              {error?.message && <p className="text-xs opacity-80 mt-1">{error.message}</p>}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                {t('common.retry', 'تلاش دوباره')}
              </Button>
              <Link to="/instructor/residents">
                <Button variant="secondary" size="sm">
                  {t('instructor.residents.backToList', 'بازگشت به فهرست دستیاران')}
                </Button>
              </Link>
            </div>
          </div>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="resident-detail-page">
      {/* Header and Back Link */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-1">
            <Link to="/instructor/residents" className="hover:text-blue-600 transition-colors">
              {t('instructor.residents.title', 'فهرست دستیاران')}
            </Link>
            <span>/</span>
            <span className="font-mono text-slate-900">{userId}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            {t('instructor.residents.detailTitle', 'کارنامه تفصیلی دستیار', {
              name: userId,
            })}
          </h1>
        </div>

        <Link to="/instructor/residents">
          <Button variant="outline" size="sm">
            {t('instructor.residents.backToList', 'بازگشت به فهرست دستیاران')}
          </Button>
        </Link>
      </div>

      {/* Main Progress View Reused */}
      <ProgressView data={data} isInstructor={true} />
    </div>
  );
}
