import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link, Navigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useSessionReport } from '../../features/sessions/hooks.js';
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
import { QuestionExplanationPanel } from '../../features/llm/QuestionExplanationPanel.jsx';

/**
 * Filter options for review items
 * @typedef {'all' | 'incorrect' | 'unanswered'} ReviewFilter
 */

/**
 * Review page for inspecting completed session questions
 *
 * @param {Object} props
 * @param {React.ReactNode} [props.extra] - Optional slot for AI/LLM feedback (reserved for T07)
 */
export function ReviewPage({ extra = null }) {
  const { sessionId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, i18n } = useTranslation();

  const { data: report, isLoading, error } = useSessionReport(sessionId);
  const [activeFilter, setActiveFilter] = useState(/** @type {ReviewFilter} */ ('all'));

  const reviewItems = report?.review ?? [];

  // Filter items based on active selection
  const filteredItems = reviewItems.filter((item) => {
    if (activeFilter === 'incorrect') {
      return item.correct === false;
    }
    if (activeFilter === 'unanswered') {
      return item.correct === null || item.answer === null;
    }
    return true;
  });

  // Current question number from URL (?q=)
  const qParam = searchParams.get('q');
  const currentNoFromUrl = qParam ? Number.parseInt(qParam, 10) : null;

  let currentItem = filteredItems.find((item) => item.no === currentNoFromUrl);
  if (!currentItem && filteredItems.length > 0) {
    currentItem = filteredItems[0];
  }

  const currentNo = currentItem?.no ?? 1;

  // Sync URL search params
  useEffect(() => {
    if (currentItem && (!qParam || Number(qParam) !== currentItem.no)) {
      setSearchParams({ q: String(currentItem.no) }, { replace: true });
    }
  }, [currentItem, qParam, setSearchParams]);

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  // Redirect to quiz if session is not finished
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

  const handleSelectQuestion = (no) => {
    setSearchParams({ q: String(no) });
  };

  const getItemStatus = (item) => {
    if (item.correct === true) return 'correct';
    if (item.correct === false) return 'incorrect';
    return 'unanswered';
  };

  const status = currentItem ? getItemStatus(currentItem) : 'unanswered';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">
              {t('review.title', { index: fmt.number(report.index, i18n.language) })}
            </h1>
            <Badge variant="secondary">
              {t('sessions.colAnswered')}: {fmt.number(report.answeredCount, i18n.language)} /{' '}
              {fmt.number(report.size, i18n.language)}
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">{t('report.subtitle')}</p>
        </div>

        <Link to={`/app/reports/${sessionId}`}>
          <Button variant="outline">{t('review.backToReport')}</Button>
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
            activeFilter === 'all' ? 'bg-sky-100 text-sky-800' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {t('review.filterAll')} ({fmt.number(reviewItems.length, i18n.language)})
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('incorrect')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
            activeFilter === 'incorrect'
              ? 'bg-rose-100 text-rose-800'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {t('review.filterIncorrect')} (
          {fmt.number(reviewItems.filter((i) => i.correct === false).length, i18n.language)})
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter('unanswered')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
            activeFilter === 'unanswered'
              ? 'bg-amber-100 text-amber-800'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {t('review.filterUnanswered')} (
          {fmt.number(reviewItems.filter((i) => i.correct === null).length, i18n.language)})
        </button>
      </div>

      {/* Main Review Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Navigator Column (first in DOM for RTL placement on the right) */}
        <div className="lg:col-span-1">
          <nav
            aria-label={t('quiz.navigatorTitle')}
            className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col"
          >
            <div className="border-b border-slate-100 pb-3 mb-3">
              <h2 className="font-semibold text-slate-800 text-sm">{t('quiz.navigatorTitle')}</h2>
              <span className="text-xs text-slate-500">
                {t('quiz.totalCount', { count: fmt.number(filteredItems.length, i18n.language) })}
              </span>
            </div>

            {filteredItems.length === 0 ? (
              <p className="text-xs text-slate-600 font-medium py-4 text-center">
                {t('review.emptyFilter')}
              </p>
            ) : (
              <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-5 gap-1.5 max-h-[60vh] overflow-y-auto p-1">
                {filteredItems.map((item) => {
                  const isCurrent = item.no === currentNo;
                  const itemStatus = getItemStatus(item);

                  const statusText =
                    itemStatus === 'correct'
                      ? t('review.statusCorrect')
                      : itemStatus === 'incorrect'
                        ? t('review.statusIncorrect')
                        : t('review.statusUnanswered');

                  return (
                    <button
                      key={item.no}
                      type="button"
                      onClick={() => handleSelectQuestion(item.no)}
                      aria-label={t('quiz.navAriaLabel', {
                        no: fmt.number(item.no, i18n.language),
                        status: statusText,
                      })}
                      aria-current={isCurrent ? 'step' : undefined}
                      className={`relative flex items-center justify-center rounded-lg text-xs font-medium h-9 w-full border transition-all cursor-pointer ${
                        isCurrent
                          ? 'ring-2 ring-sky-600 border-sky-600 font-bold z-1'
                          : 'border-slate-200 hover:border-slate-300'
                      } ${
                        itemStatus === 'correct'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : itemStatus === 'incorrect'
                            ? 'bg-rose-50 text-rose-800 border-rose-300'
                            : 'bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>{fmt.number(item.no, i18n.language)}</span>
                      {itemStatus === 'correct' && (
                        <span
                          className="absolute bottom-0.5 end-0.5 text-emerald-600"
                          aria-hidden="true"
                        >
                          <svg className="w-2.5 h-2.5" viewBox="0 0 20 20" fill="currentColor">
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </span>
                      )}
                      {itemStatus === 'incorrect' && (
                        <span
                          className="absolute bottom-0.5 end-0.5 text-rose-600"
                          aria-hidden="true"
                        >
                          <svg className="w-2.5 h-2.5" viewBox="0 0 20 20" fill="currentColor">
                            <path
                              fillRule="evenodd"
                              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </nav>
        </div>

        {/* Card Column */}
        <div className="lg:col-span-3 space-y-4">
          {!currentItem ? (
            <Card>
              <CardContent className="py-12 text-center text-slate-500 text-sm">
                <p>{t('review.emptyFilter')}</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-slate-200 overflow-hidden">
              <CardHeader className="border-b border-slate-100 bg-slate-50/60 pb-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base text-slate-900">
                      {t('review.questionHeading', {
                        no: fmt.number(currentItem.no, i18n.language),
                        status:
                          status === 'correct'
                            ? t('review.statusCorrect')
                            : status === 'incorrect'
                              ? t('review.statusIncorrect')
                              : t('review.statusUnanswered'),
                      })}
                    </CardTitle>
                    <Badge
                      variant={
                        status === 'correct'
                          ? 'success'
                          : status === 'incorrect'
                            ? 'danger'
                            : 'secondary'
                      }
                    >
                      {status === 'correct'
                        ? t('review.statusCorrect')
                        : status === 'incorrect'
                          ? t('review.statusIncorrect')
                          : t('review.statusUnanswered')}
                    </Badge>
                  </div>

                  <Badge variant="secondary">{t('buckets.' + currentItem.bucket)}</Badge>
                </div>
              </CardHeader>

              <CardContent className="p-4 sm:p-6 space-y-6">
                {/* Image Container */}
                <div
                  dir="ltr"
                  data-testid="review-image-container"
                  className="relative bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center min-h-[300px] max-h-[70vh] border border-slate-800"
                >
                  <img
                    src={currentItem.imageUrl}
                    alt={t('quiz.xrayAlt')}
                    draggable={false}
                    className="max-h-[65vh] w-auto max-w-full object-contain pointer-events-none select-none"
                  />
                </div>

                {/* Answers Comparison Box */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Your Answer */}
                  <div
                    className={`p-4 rounded-xl border ${
                      status === 'correct'
                        ? 'bg-emerald-50/60 border-emerald-200'
                        : status === 'incorrect'
                          ? 'bg-rose-50/60 border-rose-200'
                          : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <span className="text-xs text-slate-500 block mb-1">
                      {t('review.yourAnswer')}
                    </span>
                    <span
                      className={`text-base font-semibold ${
                        status === 'correct'
                          ? 'text-emerald-800'
                          : status === 'incorrect'
                            ? 'text-rose-800'
                            : 'text-slate-500'
                      }`}
                    >
                      {currentItem.answer
                        ? t('classes.' + currentItem.answer)
                        : t('review.noSelection')}
                    </span>
                  </div>

                  {/* Correct Answer */}
                  <div className="p-4 rounded-xl border bg-emerald-50/60 border-emerald-200">
                    <span className="text-xs text-slate-500 block mb-1">
                      {t('review.correctAnswer')}
                    </span>
                    <span className="text-base font-semibold text-emerald-800">
                      {t('classes.' + currentItem.trueClass)}
                    </span>
                  </div>
                </div>

                {/* Extra slot or default AI/LLM diagnostic explanation for wrong answers */}
                {extra ? (
                  <div className="mt-4">{extra}</div>
                ) : status === 'incorrect' ? (
                  <QuestionExplanationPanel sessionId={sessionId} questionNo={currentItem.no} />
                ) : null}
              </CardContent>

              {/* Prev / Next Footer */}
              <CardFooter className="flex items-center justify-between border-t border-slate-100 bg-slate-50/40 p-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={filteredItems.findIndex((i) => i.no === currentNo) <= 0}
                  onClick={() => {
                    const idx = filteredItems.findIndex((i) => i.no === currentNo);
                    if (idx > 0) handleSelectQuestion(filteredItems[idx - 1].no);
                  }}
                >
                  {t('quiz.prevQuestion')}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={
                    filteredItems.findIndex((i) => i.no === currentNo) >= filteredItems.length - 1
                  }
                  onClick={() => {
                    const idx = filteredItems.findIndex((i) => i.no === currentNo);
                    if (idx < filteredItems.length - 1) {
                      handleSelectQuestion(filteredItems[idx + 1].no);
                    }
                  }}
                >
                  {t('quiz.nextQuestion')}
                </Button>
              </CardFooter>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
