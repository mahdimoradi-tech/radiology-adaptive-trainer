import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { usePracticeSets, useCreatePracticeSet } from '../../features/practice/hooks.js';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
  Alert,
  Spinner,
} from '../../components/ui/index.js';
import { fmt } from '../../lib/format.js';
import { ApiError } from '../../lib/api.js';

export function PracticeHomePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data, isLoading, error, refetch } = usePracticeSets({ page, pageSize });
  const createMutation = useCreatePracticeSet();
  const [actionError, setActionError] = useState(null);

  const handleStartPractice = async () => {
    setActionError(null);
    try {
      const set = await createMutation.mutateAsync({ size: 10 });
      navigate(`/app/practice/${set.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(err);
      } else {
        setActionError(new ApiError({ code: 'INTERNAL_ERROR', status: 500 }));
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('practice.homeTitle')}</h1>
          <p className="text-sm text-slate-500 mt-1">{t('practice.homeSubtitle')}</p>
        </div>
        <Button
          variant="primary"
          onClick={handleStartPractice}
          isLoading={createMutation.isPending}
        >
          {t('practice.startNewSet')}
        </Button>
      </div>

      {/* Special State Alerts */}
      {actionError?.code === 'NO_HISTORY' && (
        <Alert variant="warning" className="space-y-2">
          <p className="font-semibold">{t('practice.noHistoryTitle')}</p>
          <p className="text-sm">{t('practice.noHistoryDesc')}</p>
          <div className="pt-2">
            <Link to="/app/tests">
              <Button size="sm" variant="outline">
                {t('practice.goToTests')}
              </Button>
            </Link>
          </div>
        </Alert>
      )}

      {actionError?.code === 'PRACTICE_POOL_EXHAUSTED' && (
        <Alert variant="info" className="space-y-1">
          <p className="font-semibold">{t('practice.poolExhaustedTitle')}</p>
          <p className="text-sm">{t('practice.poolExhaustedDesc')}</p>
        </Alert>
      )}

      {actionError &&
        actionError.code !== 'NO_HISTORY' &&
        actionError.code !== 'PRACTICE_POOL_EXHAUSTED' && (
          <Alert variant="danger">
            {t(`errors.${actionError.code}`, { defaultValue: t('errors.INTERNAL_ERROR') })}
          </Alert>
        )}

      {/* Practice Sets List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('practice.historyTitle')}</CardTitle>
          <CardDescription>{t('practice.historyDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 flex justify-center">
              <Spinner size="lg" />
            </div>
          ) : error ? (
            <Alert variant="danger" className="space-y-2">
              <p>{t('common.errorLoading')}</p>
              <Button size="sm" variant="outline" onClick={() => refetch()}>
                {t('common.retry')}
              </Button>
            </Alert>
          ) : data?.items?.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <p className="text-slate-500 text-sm">{t('practice.emptyHistory')}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleStartPractice}
                isLoading={createMutation.isPending}
              >
                {t('practice.startFirstSet')}
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600 text-xs font-semibold bg-slate-50">
                    <th className="p-3 text-start">{t('practice.colDate')}</th>
                    <th className="p-3 text-center">{t('practice.colStatus')}</th>
                    <th className="p-3 text-center">{t('practice.colProgress')}</th>
                    <th className="p-3 text-center">{t('practice.colScore')}</th>
                    <th className="p-3 text-end">{t('practice.colAction')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data?.items?.map((set) => (
                    <tr key={set.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="p-3 text-slate-800 font-medium">
                        {fmt.date(set.createdAt, i18n.language)}
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant={set.status === 'completed' ? 'success' : 'primary'}>
                          {t(`practice.status_${set.status}`)}
                        </Badge>
                      </td>
                      <td className="p-3 text-center text-slate-600">
                        {fmt.number(set.answeredCount, i18n.language)} /{' '}
                        {fmt.number(set.size, i18n.language)}
                      </td>
                      <td className="p-3 text-center text-slate-600 font-medium">
                        {set.answeredCount > 0
                          ? `${fmt.number(set.correctCount, i18n.language)} / ${fmt.number(set.answeredCount, i18n.language)}`
                          : '—'}
                      </td>
                      <td className="p-3 text-end">
                        <Link to={`/app/practice/${set.id}`}>
                          <Button size="sm" variant="outline">
                            {set.status === 'completed'
                              ? t('practice.viewSet')
                              : t('practice.continueSet')}
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination controls */}
              {data?.meta && data.meta.totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-slate-200 text-sm text-slate-600">
                  <span>
                    {t('common.pageIndicator', {
                      current: fmt.number(page, i18n.language),
                      total: fmt.number(data.meta.totalPages, i18n.language),
                    })}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      {t('common.prev')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page >= data.meta.totalPages}
                      onClick={() => setPage((p) => Math.min(data.meta.totalPages, p + 1))}
                    >
                      {t('common.next')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
