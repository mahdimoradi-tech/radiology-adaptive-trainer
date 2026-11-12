import { useState, useId } from 'react';
import { useNavigate, Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useSessions, useCreateSession } from '../../features/sessions/hooks.js';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Select,
  Badge,
  Alert,
  Spinner,
} from '../../components/ui/index.js';
import { fmt } from '../../lib/format.js';
import { ApiError, getErrorI18nKey } from '../../lib/api.js';

const SIZES = [45, 60, 90, 120];

export function TestsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const selectId = useId();

  const [page, setPage] = useState(1);
  const [selectedSize, setSelectedSize] = useState(60);
  const [errorMessage, setErrorMessage] = useState('');

  const { data, isLoading, error, refetch } = useSessions({ page, pageSize: 10 });
  const createMutation = useCreateSession();

  const items = data?.items ?? [];
  const meta = data?.meta ?? { total: 0, page: 1, pageSize: 10, totalPages: 1 };

  // Find active in-progress session if any
  const activeSession = items.find((s) => s.status === 'in_progress');
  const finishedSessions = items.filter((s) => s.status === 'finished');

  const handleStartSession = async () => {
    setErrorMessage('');
    try {
      const newSession = await createMutation.mutateAsync({ size: Number(selectedSize) });
      navigate(`/app/tests/${newSession.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'SESSION_IN_PROGRESS') {
          const activeId = err.details?.sessionId || activeSession?.id;
          if (activeId) {
            navigate(`/app/tests/${activeId}`);
            return;
          }
          setErrorMessage(t('sessions.activeNotice'));
          return;
        }
        if (err.code === 'POOL_EXHAUSTED') {
          setErrorMessage(t('sessions.poolExhausted'));
          return;
        }
        setErrorMessage(t(getErrorI18nKey(err.code)));
      } else {
        setErrorMessage(t('errors.INTERNAL_ERROR'));
      }
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('sessions.title')}</h1>
        <p className="text-sm text-slate-500 mt-1">{t('sessions.subtitle')}</p>
      </div>

      {errorMessage && (
        <Alert variant="danger" className="text-sm">
          {errorMessage}
        </Alert>
      )}

      {/* Start / Resume Card */}
      <Card className="border-sky-200 bg-sky-50/40">
        <CardHeader>
          <CardTitle className="text-lg">
            {activeSession ? t('sessions.continueActive') : t('sessions.startNew')}
          </CardTitle>
          <CardDescription>
            {activeSession ? t('sessions.activeNotice') : t('home.startTestDesc')}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {activeSession ? (
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-white border border-sky-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800 text-sm">
                    {t('sessions.colIndex')}: #{fmt.number(activeSession.index, i18n.language)}
                  </span>
                  <Badge variant="warning">
                    {t(
                      'sessions.kind' +
                        (activeSession.kind === 'adaptive' ? 'Adaptive' : 'Baseline'),
                    )}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500">
                  {t('sessions.colAnswered')}:{' '}
                  <span className="font-medium text-slate-700">
                    {fmt.number(activeSession.answeredCount, i18n.language)} /{' '}
                    {fmt.number(activeSession.size, i18n.language)}
                  </span>
                </p>
              </div>

              <Button variant="primary" onClick={() => navigate(`/app/tests/${activeSession.id}`)}>
                {t('sessions.continueActive')}
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label htmlFor={selectId} className="text-sm font-medium text-slate-700">
                  {t('sessions.sizeLabel')}:
                </label>
                <Select
                  id={selectId}
                  value={selectedSize}
                  onChange={(e) => setSelectedSize(Number(e.target.value))}
                  disabled={createMutation.isPending}
                  className="w-32"
                >
                  {SIZES.map((size) => (
                    <option key={size} value={size}>
                      {t('sessions.sizeOption', { count: fmt.number(size, i18n.language) })}
                    </option>
                  ))}
                </Select>
              </div>

              <Button
                variant="primary"
                isLoading={createMutation.isPending}
                onClick={handleStartSession}
              >
                {createMutation.isPending ? t('sessions.starting') : t('sessions.startNew')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('sessions.historyTitle')}</CardTitle>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Spinner size="lg" />
            </div>
          ) : error ? (
            <div className="text-center py-8 space-y-3">
              <Alert variant="danger">{t('errors.NETWORK')}</Alert>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                {t('common.retry')}
              </Button>
            </div>
          ) : finishedSessions.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-sm">
              <p>{t('sessions.emptyHistory')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-medium text-xs">
                    <th className="py-3 px-3 text-start">{t('sessions.colIndex')}</th>
                    <th className="py-3 px-3 text-start">{t('sessions.colKind')}</th>
                    <th className="py-3 px-3 text-start">{t('sessions.colDate')}</th>
                    <th className="py-3 px-3 text-start">{t('sessions.colAnswered')}</th>
                    <th className="py-3 px-3 text-start">{t('sessions.colAccuracy')}</th>
                    <th className="py-3 px-3 text-end">{t('sessions.colActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {finishedSessions.map((session) => (
                    <tr key={session.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 font-semibold text-slate-800">
                        #{fmt.number(session.index, i18n.language)}
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant={session.kind === 'adaptive' ? 'primary' : 'secondary'}>
                          {t(
                            'sessions.kind' +
                              (session.kind === 'adaptive' ? 'Adaptive' : 'Baseline'),
                          )}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {fmt.date(session.startedAt, i18n.language)}
                      </td>
                      <td className="py-3 px-3 text-slate-700">
                        {fmt.number(session.answeredCount, i18n.language)} /{' '}
                        {fmt.number(session.size, i18n.language)}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-800">
                        {session.overallAccuracy !== null
                          ? fmt.percent(session.overallAccuracy, i18n.language)
                          : '—'}
                      </td>
                      <td className="py-3 px-3 text-end">
                        <Link to={`/app/reports/${session.id}`}>
                          <Button variant="outline" size="sm">
                            {t('sessions.viewReport')}
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>

        {meta.totalPages > 1 && (
          <CardFooter className="flex items-center justify-between border-t border-slate-100 pt-4">
            <span className="text-xs text-slate-500">
              {t('sessions.pageInfo', {
                current: fmt.number(meta.page, i18n.language),
                total: fmt.number(meta.totalPages, i18n.language),
              })}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t('sessions.prevPage')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('sessions.nextPage')}
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
