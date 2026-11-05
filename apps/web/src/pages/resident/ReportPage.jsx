import { useState } from 'react';
import { useParams, useNavigate, Link, Navigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useSessionReport, useCreateSession } from '../../features/sessions/hooks.js';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Button,
  Badge,
  Alert,
  Spinner,
} from '../../components/ui/index.js';
import { fmt } from '../../lib/format.js';
import { ApiError } from '../../lib/api.js';

const CLASS_IDS = /** @type {const} */ (['covid19', 'pneumonia', 'normal']);
const BUCKETS = /** @type {const} */ (['easy', 'medium', 'hard']);

export function ReportPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const { data: report, isLoading, error } = useSessionReport(sessionId);
  const createMutation = useCreateSession();
  const [actionError, setActionError] = useState('');

  const handleStartNextSession = async () => {
    setActionError('');
    try {
      const nextSession = await createMutation.mutateAsync({ size: report?.size || 60 });
      navigate(`/app/tests/${nextSession.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'SESSION_IN_PROGRESS') {
          const activeId = err.details?.sessionId;
          if (activeId) {
            navigate(`/app/tests/${activeId}`);
            return;
          }
          setActionError(t('errors.SESSION_IN_PROGRESS'));
          return;
        }
        if (err.code === 'POOL_EXHAUSTED') {
          setActionError(t('sessions.poolExhausted'));
          return;
        }
      }
      setActionError(t('errors.INTERNAL_ERROR'));
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  // If session is still in progress, backend returns 409 SESSION_NOT_FINISHED
  if (error instanceof ApiError && error.code === 'SESSION_NOT_FINISHED') {
    return <Navigate to={`/app/tests/${sessionId}`} replace />;
  }

  if (error || !report) {
    return (
      <div className="py-12 max-w-lg mx-auto text-center space-y-4">
        <Alert variant="danger">{t('errors.NOT_FOUND')}</Alert>
        <Link to="/app/tests">
          <Button variant="outline">{t('common.back')}</Button>
        </Link>
      </div>
    );
  }

  const {
    index,
    kind,
    size,
    answeredCount,
    unansweredCount,
    overall,
    confusion,
    perClass,
    byClassBucket,
    mastered,
    perClassMastered,
    plan,
  } = report;

  const isZeroAnswered = answeredCount === 0;

  return (
    <div className="space-y-8">
      {/* Header and Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">
              {t('report.title', { index: fmt.number(index, i18n.language) })}
            </h1>
            <Badge variant={kind === 'adaptive' ? 'primary' : 'secondary'}>
              {t('sessions.kind' + (kind === 'adaptive' ? 'Adaptive' : 'Baseline'))}
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">{t('report.subtitle')}</p>
        </div>

        <div className="flex items-center gap-3">
          <Link to={`/app/reports/${sessionId}/review`}>
            <Button variant="outline">{t('report.actionReview')}</Button>
          </Link>
          <Button
            variant="primary"
            isLoading={createMutation.isPending}
            onClick={handleStartNextSession}
          >
            {t('report.actionNextTest')}
          </Button>
        </div>
      </div>

      {actionError && (
        <Alert variant="danger" className="text-sm">
          {actionError}
        </Alert>
      )}

      {/* 1. Summary Card */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-base">{t('report.summaryTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-xs text-slate-500 block mb-1">
                {t('report.overallAccuracy')}
              </span>
              <span className="text-2xl font-bold text-sky-700">
                {isZeroAnswered ? '—' : fmt.percent(overall.accuracy, i18n.language)}
              </span>
              <span className="text-xs text-slate-400 block mt-1">
                {t('report.correctVsTotal', {
                  correct: fmt.number(overall.correct, i18n.language),
                  total: fmt.number(overall.total, i18n.language),
                })}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-xs text-slate-500 block mb-1">{t('sessions.colAnswered')}</span>
              <span className="text-2xl font-bold text-slate-800">
                {fmt.number(answeredCount, i18n.language)}{' '}
                <span className="text-sm text-slate-400 font-normal">
                  / {fmt.number(size, i18n.language)}
                </span>
              </span>
              {unansweredCount > 0 && (
                <span className="text-xs text-amber-700 font-medium block mt-1">
                  {t('report.unansweredNotice', {
                    count: fmt.number(unansweredCount, i18n.language),
                  })}
                </span>
              )}
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-between">
              <span className="text-xs text-slate-500 block mb-1">{t('report.masteryBanner')}</span>
              <div>
                <Badge variant={mastered ? 'success' : 'secondary'} className="text-xs px-2.5 py-1">
                  {mastered ? t('report.masteryBand') : t('report.mediumBand')}
                </Badge>
              </div>
            </div>
          </div>

          {mastered && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm font-medium">
              ✓ {t('report.masteryBanner')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Zero answered fallback message */}
      {isZeroAnswered ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-500 text-sm">
            <p>{t('report.zeroAnswered')}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 2. Per-Class Narrative Sentences Block (as in the paper) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('report.metricsTableTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {CLASS_IDS.map((classId) => {
                const metrics = perClass[classId];
                const isClassMastered = perClassMastered?.[classId];
                const bandLabel = isClassMastered
                  ? t('report.masteryBand')
                  : metrics.accuracy >= 0.5
                    ? t('report.mediumBand')
                    : t('report.weakBand');

                const bucketParts = BUCKETS.map((b) => {
                  const bData = byClassBucket?.[classId]?.[b];
                  const bTotal = (bData?.correct ?? 0) + (bData?.incorrect ?? 0);
                  if (!bTotal) return null;
                  return t('report.bucketBreakdownItem', {
                    bucket: t('buckets.' + b),
                    correct: fmt.number(bData.correct, i18n.language),
                    total: fmt.number(bTotal, i18n.language),
                  });
                }).filter(Boolean);

                return (
                  <div
                    key={classId}
                    className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-sm text-slate-700"
                  >
                    <span className="font-semibold text-slate-900 me-2">
                      {t('classes.' + classId)}:
                    </span>
                    <span>
                      {t('report.classBucketSummary', {
                        className: t('classes.' + classId),
                        acc: fmt.percent(metrics.accuracy, i18n.language),
                        band: bandLabel,
                        breakdown: bucketParts.join('؛ '),
                      })}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* 3. Confusion Matrix (3x3) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('report.confusionTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-center text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="p-3 bg-slate-100 text-slate-700 text-xs font-semibold text-start">
                        {t('report.matrixHeader')}
                      </th>
                      {CLASS_IDS.map((predId) => (
                        <th
                          key={predId}
                          className="p-3 bg-slate-50 text-slate-600 text-xs font-semibold"
                        >
                          {t('classes.' + predId)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {CLASS_IDS.map((trueId) => (
                      <tr key={trueId}>
                        <th className="p-3 text-start bg-slate-50 text-slate-700 font-semibold text-xs">
                          {t('classes.' + trueId)}
                        </th>
                        {CLASS_IDS.map((predId) => {
                          const count = confusion?.[trueId]?.[predId] ?? 0;
                          const isDiagonal = trueId === predId;
                          return (
                            <td
                              key={predId}
                              className={`p-3 text-sm transition-colors ${
                                isDiagonal
                                  ? 'bg-emerald-50 text-emerald-800 font-bold border-2 border-emerald-200'
                                  : count > 0
                                    ? 'bg-rose-50/50 text-rose-700 font-medium'
                                    : 'text-slate-400'
                              }`}
                            >
                              {fmt.number(count, i18n.language)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* 4. Per-Class One-vs-Rest Metrics Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('report.metricsTableTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-start text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-medium text-xs">
                      <th className="py-2.5 px-3 text-start">{t('report.colClass')}</th>
                      <th className="py-2.5 px-3 text-center">{t('report.colTP')}</th>
                      <th className="py-2.5 px-3 text-center">{t('report.colFP')}</th>
                      <th className="py-2.5 px-3 text-center">{t('report.colFN')}</th>
                      <th className="py-2.5 px-3 text-center">{t('report.colTN')}</th>
                      <th className="py-2.5 px-3 text-center">{t('report.colRecall')}</th>
                      <th className="py-2.5 px-3 text-center">{t('report.colPrecision')}</th>
                      <th className="py-2.5 px-3 text-center">{t('report.colF1')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {CLASS_IDS.map((c) => {
                      const m = perClass[c];
                      return (
                        <tr key={c} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            {t('classes.' + c)}
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-700">
                            {fmt.number(m.tp, i18n.language)}
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-700">
                            {fmt.number(m.fp, i18n.language)}
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-700">
                            {fmt.number(m.fn, i18n.language)}
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-700">
                            {fmt.number(m.tn, i18n.language)}
                          </td>
                          <td className="py-2.5 px-3 text-center font-medium text-sky-700">
                            {fmt.percent(m.recall, i18n.language)}
                          </td>
                          <td className="py-2.5 px-3 text-center font-medium text-sky-700">
                            {fmt.percent(m.precision, i18n.language)}
                          </td>
                          <td className="py-2.5 px-3 text-center font-medium text-slate-800">
                            {fmt.percent(m.f1, i18n.language)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
            <CardFooter className="text-xs text-slate-400 border-t border-slate-100 pt-3">
              <p>{t('report.metricsFootnote')}</p>
            </CardFooter>
          </Card>

          {/* 5. Two Breakdown Tables: Correct and Incorrect by Difficulty */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Correct Answers by Difficulty */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-emerald-800">
                  {t('report.correctBreakdownTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-center text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 px-2 text-start">{t('report.colClass')}</th>
                      {BUCKETS.map((b) => (
                        <th key={b} className="py-2 px-2">
                          {t('buckets.' + b)}
                        </th>
                      ))}
                      <th className="py-2 px-2 font-bold">مجموع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {CLASS_IDS.map((c) => {
                      const easyC = byClassBucket?.[c]?.easy?.correct ?? 0;
                      const medC = byClassBucket?.[c]?.medium?.correct ?? 0;
                      const hardC = byClassBucket?.[c]?.hard?.correct ?? 0;
                      const totalC = easyC + medC + hardC;
                      return (
                        <tr key={c}>
                          <td className="py-2 px-2 text-start font-medium text-slate-800">
                            {t('classes.' + c)}
                          </td>
                          <td className="py-2 px-2 text-emerald-700">
                            {fmt.number(easyC, i18n.language)}
                          </td>
                          <td className="py-2 px-2 text-emerald-700">
                            {fmt.number(medC, i18n.language)}
                          </td>
                          <td className="py-2 px-2 text-emerald-700">
                            {fmt.number(hardC, i18n.language)}
                          </td>
                          <td className="py-2 px-2 font-bold text-slate-900">
                            {fmt.number(totalC, i18n.language)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Incorrect Answers by Difficulty */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold text-rose-800">
                  {t('report.incorrectBreakdownTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-center text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 px-2 text-start">{t('report.colClass')}</th>
                      {BUCKETS.map((b) => (
                        <th key={b} className="py-2 px-2">
                          {t('buckets.' + b)}
                        </th>
                      ))}
                      <th className="py-2 px-2 font-bold">مجموع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {CLASS_IDS.map((c) => {
                      const easyI = byClassBucket?.[c]?.easy?.incorrect ?? 0;
                      const medI = byClassBucket?.[c]?.medium?.incorrect ?? 0;
                      const hardI = byClassBucket?.[c]?.hard?.incorrect ?? 0;
                      const totalI = easyI + medI + hardI;
                      return (
                        <tr key={c}>
                          <td className="py-2 px-2 text-start font-medium text-slate-800">
                            {t('classes.' + c)}
                          </td>
                          <td className="py-2 px-2 text-rose-700">
                            {fmt.number(easyI, i18n.language)}
                          </td>
                          <td className="py-2 px-2 text-rose-700">
                            {fmt.number(medI, i18n.language)}
                          </td>
                          <td className="py-2 px-2 text-rose-700">
                            {fmt.number(hardI, i18n.language)}
                          </td>
                          <td className="py-2 px-2 font-bold text-slate-900">
                            {fmt.number(totalI, i18n.language)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* 6. «چرا این آزمون؟» Card (Plan Card - never show shortfalls) */}
      <Card className="border-sky-100 bg-sky-50/20">
        <CardHeader>
          <CardTitle className="text-base">{t('report.whyThisTestTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {kind === 'baseline' ? (
            <p className="text-sm text-slate-600">{t('report.whyBaseline')}</p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">{t('report.whyAdaptive')}</p>
              {plan?.classCounts && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  {CLASS_IDS.map((c) => (
                    <div
                      key={c}
                      className="p-3 bg-white rounded-lg border border-sky-100 text-xs space-y-1"
                    >
                      <span className="font-semibold text-slate-800 block">
                        {t('classes.' + c)}
                      </span>
                      <div className="flex items-center justify-between text-slate-500">
                        <span>{t('sessions.colAnswered')}:</span>
                        <span className="font-medium text-slate-800">
                          {fmt.number(plan.classCounts[c] ?? 0, i18n.language)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-500">
                        <span>وزن خطا:</span>
                        <span className="font-medium text-sky-700">
                          {plan.weights?.[c] !== undefined
                            ? fmt.percent(plan.weights[c], i18n.language)
                            : '—'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
