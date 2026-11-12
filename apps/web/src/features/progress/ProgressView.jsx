import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { MASTERY_THRESHOLD } from '@radiology/contracts';
import { LineChart } from '../../components/charts/LineChart.jsx';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Button,
  Alert,
} from '../../components/ui/index.js';
import { fmt } from '../../lib/format.js';

const CLASS_IDS = /** @type {const} */ (['covid19', 'pneumonia', 'normal']);

/**
 * Reusable presentational component for resident learning progress
 *
 * @param {Object} props
 * @param {import('@radiology/contracts').Progress} props.data
 * @param {() => void} [props.onStartTest]
 * @param {boolean} [props.isInstructor=false]
 */
export function ProgressView({ data, onStartTest, isInstructor = false }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language || 'fa';

  const sessions = data?.sessions || [];
  const topConfusions = data?.topConfusions || [];
  const totals = data?.totals || { sessionsFinished: 0, answered: 0 };

  // Empty state
  if (sessions.length === 0) {
    return (
      <Card className="text-center py-12 px-6">
        <CardContent className="space-y-4 max-w-md mx-auto">
          <div className="w-16 h-16 mx-auto rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {t('progress.emptyTitle', 'هنوز آزمونی تکمیل نشده است')}
          </h2>
          <p className="text-sm text-slate-700 dark:text-slate-200">
            {isInstructor
              ? t('progress.instructorEmptyDesc', 'این دستیار هنوز هیچ آزمونی را تکمیل نکرده است.')
              : t(
                  'progress.emptyDesc',
                  'برای مشاهده روند رشد و تحلیل الگوهای خطا، نخستین آزمون تطبیقی خود را آغاز کنید.',
                )}
          </p>
          {!isInstructor && onStartTest && (
            <div className="pt-2">
              <Button onClick={onStartTest}>{t('progress.startTest', 'شروع آزمون تشخیصی')}</Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Latest session for mastery badges
  const latestSession = sessions[sessions.length - 1];
  const allMastered = CLASS_IDS.every(
    (c) => (latestSession?.perClass?.[c]?.accuracy ?? 0) >= MASTERY_THRESHOLD,
  );

  // Chart series (3 disease classes)
  const chartSeries = CLASS_IDS.map((c) => ({
    id: c,
    label: t(`classes.${c}`),
    points: sessions.map((s) => ({
      x: s.index,
      y: s.perClass?.[c]?.accuracy ?? 0,
    })),
  }));

  return (
    <div className="space-y-8" data-testid="progress-view">
      {/* Goal Reached Celebration Banner */}
      {allMastered && (
        <div data-testid="mastery-goal-alert">
          <Alert variant="success">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="font-semibold text-emerald-900 dark:text-emerald-100">
                {t(
                  'progress.allMasteredNotice',
                  'تبریک! به آستانه تسلط (۸۰٪) در تمام کلاس‌های تشخیصی دست یافتید.',
                )}
              </span>
            </div>
          </Alert>
        </div>
      )}

      {/* Class Mastery Status (Latest Session) & Summary Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {CLASS_IDS.map((c) => {
          const acc = latestSession?.perClass?.[c]?.accuracy ?? 0;
          const isClassMastered = acc >= MASTERY_THRESHOLD;
          return (
            <Card key={c} data-testid={`mastery-card-${c}`}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {t(`classes.${c}`)}
                  </div>
                  <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
                    {fmt.percent(acc, lang)}
                  </div>
                </div>
                <Badge
                  variant={isClassMastered ? 'success' : 'default'}
                  data-testid={`mastery-badge-${c}`}
                >
                  {isClassMastered
                    ? t('progress.mastered', 'تسلط حاصل شد')
                    : t('progress.learning', 'در حال یادگیری')}
                </Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Accuracy Trajectory Line Chart */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>{t('progress.chartTitle', 'روند دقت تشخیصی به تفکیک بیماری')}</CardTitle>
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              {t('progress.totalSessions', 'جلسات تکمیل‌شده')}:{' '}
              <span className="font-mono font-bold">
                {fmt.number(totals.sessionsFinished || sessions.length, lang)}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <LineChart
            series={chartSeries}
            yDomain={[0, 1]}
            threshold={MASTERY_THRESHOLD}
            ariaLabel={t('progress.chartAriaLabel', 'نمودار دقت تشخیصی سه کلاس بیماری')}
            xLabel={t('progress.sessionCol', 'آزمون')}
          />
        </CardContent>
      </Card>

      {/* Confusion Error Analysis & Sessions History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Most Frequent Confusions */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">
              {t('progress.confusionsTitle', 'شایع‌ترین خطاهای تشخیصی')}
            </CardTitle>
            <p className="text-xs text-slate-700 dark:text-slate-200">
              {t(
                'progress.confusionsDesc',
                'جفت کلاس‌هایی که بیشترین میزان اشتباه بین آن‌ها ثبت شده است',
              )}
            </p>
          </CardHeader>
          <CardContent>
            {topConfusions.length === 0 ? (
              <p className="text-xs text-slate-600 dark:text-slate-200 py-4 text-center font-medium">
                {t('progress.noConfusions', 'هیچ خطای تشخیصی مکرری ثبت نشده است.')}
              </p>
            ) : (
              <ul
                className="divide-y divide-slate-100 dark:divide-slate-800"
                data-testid="top-confusions-list"
              >
                {topConfusions.map((item, idx) => (
                  <li
                    key={`${item.trueClass}-${item.predicted}-${idx}`}
                    className="py-3 flex items-center justify-between text-xs"
                    data-testid="confusion-item"
                  >
                    <div className="space-y-0.5">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {t(`classes.${item.trueClass}`)}
                        <span className="text-slate-600 dark:text-slate-200 mx-1.5 font-bold font-sans">
                          ←
                        </span>
                        <span className="text-rose-700 dark:text-rose-300 font-bold">
                          {t(`classes.${item.predicted}`)}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-200 font-medium">
                        {t('report.matrixHeader', 'کلاس واقعی / پاسخ')}
                      </div>
                    </div>
                    <Badge variant="warning" className="font-mono">
                      {t('progress.confusionCount', '{{count}} بار', {
                        count: fmt.number(item.count, lang),
                      })}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Sessions History Table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              {t('progress.historyTitle', 'تاریخچه آزمون‌های تکمیل‌شده')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table
                className="w-full text-xs text-start border-collapse"
                data-testid="history-table"
              >
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100">
                  <tr>
                    <th
                      scope="col"
                      className="px-3 py-2 text-start font-semibold border-b border-slate-200 dark:border-slate-800"
                    >
                      {t('progress.sessionCol', 'آزمون')}
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-start font-semibold border-b border-slate-200 dark:border-slate-800"
                    >
                      {t('progress.dateCol', 'تاریخ')}
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-start font-semibold border-b border-slate-200 dark:border-slate-800"
                    >
                      {t('progress.accuracyCol', 'دقت کل')}
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-start font-semibold border-b border-slate-200 dark:border-slate-800"
                    >
                      {t('progress.statusCol', 'وضعیت')}
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-end font-semibold border-b border-slate-200 dark:border-slate-800"
                    >
                      <span className="sr-only">{t('progress.viewReport', 'مشاهده کارنامه')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sessions.map((s) => {
                    const reportLink = isInstructor ? null : `/app/reports/${s.id}`;
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                          {t('progress.sessionNo', 'جلسه {{index}}', {
                            index: fmt.number(s.index, lang),
                          })}
                        </td>
                        <td className="px-3 py-2.5 text-slate-700 dark:text-slate-200 font-medium">
                          {fmt.date(s.finishedAt, lang)}
                        </td>
                        <td className="px-3 py-2.5 font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {fmt.percent(s.overallAccuracy, lang)}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge variant={s.mastered ? 'success' : 'default'}>
                            {s.mastered
                              ? t('progress.mastered', 'تسلط')
                              : t('progress.learning', 'در حال یادگیری')}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-end">
                          {reportLink && (
                            <Link
                              to={reportLink}
                              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                            >
                              {t('progress.viewReport', 'کارنامه')}
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Educational Disclaimer Banner */}
      <div className="pt-2">
        <p className="text-xs text-center text-slate-600 dark:text-slate-200 font-medium">
          {t(
            'disclaimer.educational',
            'این سامانه صرفاً یک ابزار کمک‌آموزشی است و خروجی‌های آن تحت هیچ شرایطی نباید به عنوان تشخیص بالینی یا توصیه پزشکی استفاده شوند.',
          )}
        </p>
      </div>
    </div>
  );
}
