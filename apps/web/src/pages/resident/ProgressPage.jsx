import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useProgress } from '../../features/progress/hooks.js';
import { ProgressView } from '../../features/progress/ProgressView.jsx';
import { Spinner, Alert, Button } from '../../components/ui/index.js';

export function ProgressPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading, isError, error, refetch } = useProgress();

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center" data-testid="progress-loading">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 py-8" data-testid="progress-error">
        <Alert variant="error">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-sm">
                {t('errors.INTERNAL_ERROR', 'خطایی در دریافت اطلاعات پیشرفت رخ داد.')}
              </p>
              {error?.message && <p className="text-xs opacity-80 mt-1">{error.message}</p>}
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              {t('common.retry', 'تلاش دوباره')}
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="resident-progress-page">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {t('progress.title', 'روند رشد و تحلیل مهارت')}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          {t('progress.subtitle', 'نمودار دقت در طول زمان، تحلیل الگوهای خطا و وضعیت تسلط تشخیصی')}
        </p>
      </div>

      {/* Main Trajectory & Analytics View */}
      <ProgressView data={data} onStartTest={() => navigate('/app/tests')} isInstructor={false} />
    </div>
  );
}
