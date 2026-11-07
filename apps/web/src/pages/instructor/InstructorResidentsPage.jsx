import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAdminResidents } from '../../features/residents/hooks.js';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Spinner,
  Alert,
  Button,
} from '../../components/ui/index.js';
import { fmt } from '../../lib/format.js';

export function InstructorResidentsPage() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language || 'fa';
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data, isLoading, isError, error, refetch } = useAdminResidents({
    page,
    pageSize,
  });

  const items = data?.items || [];
  const meta = data?.meta || { total: 0, page: 1, pageSize: 10, totalPages: 1 };

  if (isLoading) {
    return (
      <div
        className="min-h-[50vh] flex items-center justify-center"
        data-testid="residents-loading"
      >
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 py-8" data-testid="residents-error">
        <Alert variant="error">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-sm">
                {t('errors.INTERNAL_ERROR', 'خطایی در دریافت فهرست دستیاران رخ داد.')}
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
    <div className="space-y-6" data-testid="instructor-residents-page">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {t('instructor.residents.title', 'فهرست دستیاران')}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          {t(
            'instructor.residents.subtitle',
            'مشاهده پیشرفت، پایش عملکرد و ارزیابی تشخیصی کارآموزان',
          )}
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {t('instructor.residentsTitle', 'کارنامه رزیدنت‌ها')}
            </CardTitle>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {t('progress.totalSessions', 'مجموع')}:{' '}
              <span className="font-mono font-semibold">{fmt.number(meta.total, lang)}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500" data-testid="residents-empty">
              <p>{t('instructor.residents.empty', 'هیچ دستیاری یافت نشد.')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table
                className="w-full text-xs text-start border-collapse"
                data-testid="residents-table"
              >
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300">
                  <tr>
                    <th
                      scope="col"
                      className="px-4 py-3 text-start font-semibold border-b border-slate-200 dark:border-slate-800"
                    >
                      {t('instructor.residents.colName', 'نام دستیار')}
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-start font-semibold border-b border-slate-200 dark:border-slate-800"
                    >
                      {t('instructor.residents.colEmail', 'ایمیل')}
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-start font-semibold border-b border-slate-200 dark:border-slate-800"
                    >
                      {t('instructor.residents.colSessions', 'آزمون‌های تمام‌شده')}
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-start font-semibold border-b border-slate-200 dark:border-slate-800"
                    >
                      {t('instructor.residents.colLastAccuracy', 'آخرین دقت')}
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-start font-semibold border-b border-slate-200 dark:border-slate-800"
                    >
                      {t('instructor.residents.colLastActive', 'آخرین فعالیت')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.map((resident) => (
                    <tr
                      key={resident.id}
                      tabIndex={0}
                      role="link"
                      onClick={() => navigate(`/instructor/residents/${resident.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigate(`/instructor/residents/${resident.id}`);
                        }
                      }}
                      className="cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/40 focus:outline-hidden focus:bg-slate-100 dark:focus:bg-slate-800 transition-colors"
                      data-testid={`resident-row-${resident.id}`}
                    >
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                        {resident.displayName}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono">
                        {resident.email}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {fmt.number(resident.sessionsFinished, lang)}
                      </td>
                      <td className="px-4 py-3 font-mono font-medium text-slate-900 dark:text-slate-100">
                        {typeof resident.lastAccuracy === 'number'
                          ? fmt.percent(resident.lastAccuracy, lang)
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {resident.lastActiveAt ? fmt.date(resident.lastActiveAt, lang) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {meta.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
              <span className="text-slate-500 dark:text-slate-400">
                {t('instructor.residents.pageOf', 'صفحه {{current}} از {{total}}', {
                  current: fmt.number(page, lang),
                  total: fmt.number(meta.totalPages, lang),
                })}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  data-testid="pagination-prev"
                >
                  {t('instructor.residents.prevPage', 'صفحه قبل')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= meta.totalPages}
                  onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                  data-testid="pagination-next"
                >
                  {t('instructor.residents.nextPage', 'صفحه بعد')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
