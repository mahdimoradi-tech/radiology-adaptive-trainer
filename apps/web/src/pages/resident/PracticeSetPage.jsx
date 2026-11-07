import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { usePracticeSet, useAnswerPracticeQuestion } from '../../features/practice/hooks.js';
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
  XrayImage,
} from '../../components/ui/index.js';
import { fmt } from '../../lib/format.js';

export function PracticeSetPage() {
  const { setId } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const { data: set, isLoading, error } = usePracticeSet(setId);
  const answerMutation = useAnswerPracticeQuestion(setId);

  const [currentNo, setCurrentNo] = useState(1);
  const [selectedOption, setSelectedOption] = useState(null);
  const [actionError, setActionError] = useState('');
  const [showSummaryScreen, setShowSummaryScreen] = useState(false);

  const startTimeRef = useRef(Date.now());

  // Determine initial question: first unanswered question or 1
  useEffect(() => {
    if (set?.questions) {
      const firstUnanswered = set.questions.find((q) => !q.answered);
      if (firstUnanswered) {
        setCurrentNo(firstUnanswered.no);
      } else if (set.status === 'completed') {
        // If all answered and set is completed, show summary screen by default
        setShowSummaryScreen(true);
      }
    }
  }, [set?.id, set?.status]);

  // Reset selected option and start timer on question change
  useEffect(() => {
    setSelectedOption(null);
    setActionError('');
    startTimeRef.current = Date.now();
  }, [currentNo]);

  if (isLoading) {
    return (
      <div className="py-24 flex justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !set) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Alert variant="danger">
          <p>{t('practice.notFoundOrForbidden')}</p>
        </Alert>
        <Link to="/app/practice">
          <Button variant="outline">{t('practice.backToPractice')}</Button>
        </Link>
      </div>
    );
  }

  const currentQuestion = set.questions.find((q) => q.no === currentNo) || set.questions[0];
  const isAnswered = Boolean(currentQuestion?.answered);
  const isLastQuestion = currentNo === set.size;
  const allAnswered = set.questions.every((q) => q.answered);

  const handleSubmitAnswer = async () => {
    if (selectedOption === null || isAnswered || answerMutation.isPending) return;

    setActionError('');
    const timeMs = Math.max(0, Date.now() - startTimeRef.current);

    try {
      await answerMutation.mutateAsync({
        questionNo: currentNo,
        selectedIndex: selectedOption,
        timeMs,
      });
    } catch {
      setActionError(t('practice.answerFailed'));
    }
  };

  const handleNext = () => {
    if (isLastQuestion) {
      setShowSummaryScreen(true);
    } else {
      setCurrentNo((prev) => Math.min(set.size, prev + 1));
    }
  };

  // Completion Summary View
  if (showSummaryScreen) {
    const accuracy = set.size > 0 ? set.correctCount / set.size : 0;
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card className="border-sky-200 bg-sky-50/20 text-center py-8 px-4">
          <CardHeader>
            <div className="mx-auto w-12 h-12 bg-sky-100 text-sky-700 rounded-full flex items-center justify-center mb-2 font-bold text-lg">
              ✓
            </div>
            <CardTitle className="text-xl">{t('practice.setCompletedTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-600 text-sm">{t('practice.setCompletedSubtitle')}</p>
            <div className="p-4 bg-white rounded-lg border border-slate-200 inline-block min-w-64">
              <span className="text-xs text-slate-500 block mb-1">{t('practice.finalScore')}</span>
              <span className="text-2xl font-bold text-sky-700">
                {fmt.number(set.correctCount, i18n.language)} /{' '}
                {fmt.number(set.size, i18n.language)}
              </span>
              <span className="text-xs text-slate-500 ms-2">
                ({fmt.percent(accuracy, i18n.language)})
              </span>
            </div>
          </CardContent>
          <CardFooter className="justify-center gap-3">
            <Button variant="outline" onClick={() => setShowSummaryScreen(false)}>
              {t('practice.reviewQuestions')}
            </Button>
            <Button variant="primary" onClick={() => navigate('/app/practice')}>
              {t('practice.backToPractice')}
            </Button>
            <Link to="/app/tests">
              <Button variant="secondary">{t('practice.takeAdaptiveTest')}</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header & Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <Link to="/app/practice">
            <Button variant="outline" size="sm">
              ← {t('common.back')}
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-900">
              {t('practice.questionTitle', {
                no: fmt.number(currentNo, i18n.language),
                total: fmt.number(set.size, i18n.language),
              })}
            </h1>
          </div>
          <Badge variant={set.status === 'completed' ? 'success' : 'primary'}>
            {t(`practice.status_${set.status}`)}
          </Badge>
        </div>

        {allAnswered && (
          <Button variant="outline" size="sm" onClick={() => setShowSummaryScreen(true)}>
            {t('practice.viewSummary')}
          </Button>
        )}
      </div>

      {actionError && (
        <Alert variant="danger">
          <p>{actionError}</p>
        </Alert>
      )}

      {/* Main Question Presentation Card */}
      <Card>
        <CardContent className="p-6 space-y-6">
          {/* Medical Image (strictly dir="ltr" and un-mirrored) */}
          <div className="max-w-md mx-auto">
            <XrayImage
              src={currentQuestion.imageUrl}
              alt={t('practice.imageAlt')}
              aspectRatio="aspect-square"
              className="max-h-80"
            />
          </div>

          {/* Question Stem */}
          <div className="space-y-1">
            <span className="text-xs text-sky-700 font-semibold uppercase tracking-wider">
              {t(`questionBank.types.${currentQuestion.type}`, {
                defaultValue: currentQuestion.type,
              })}
            </span>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              {currentQuestion.stem}
            </h2>
          </div>

          {/* Options Accessible Radio Group */}
          <div role="radiogroup" aria-label={currentQuestion.stem} className="space-y-2.5 pt-2">
            {currentQuestion.options.map((optionText, idx) => {
              const isChecked = isAnswered
                ? currentQuestion.answer?.selectedIndex === idx
                : selectedOption === idx;

              const isCorrectOption = isAnswered && currentQuestion.answer?.correctIndex === idx;
              const isWrongSelection =
                isAnswered &&
                currentQuestion.answer?.selectedIndex === idx &&
                !currentQuestion.answer?.correct;

              let optionStyle = 'border-slate-200 bg-white hover:bg-slate-50';
              if (isCorrectOption) {
                optionStyle =
                  'border-emerald-500 bg-emerald-50/70 text-emerald-950 font-medium ring-1 ring-emerald-500';
              } else if (isWrongSelection) {
                optionStyle = 'border-rose-400 bg-rose-50/70 text-rose-950 ring-1 ring-rose-400';
              } else if (isChecked) {
                optionStyle = 'border-sky-500 bg-sky-50/60 ring-1 ring-sky-500';
              }

              return (
                <label
                  key={idx}
                  className={`flex items-start gap-3 p-3.5 rounded-lg border cursor-pointer transition-all ${optionStyle} ${
                    isAnswered ? 'cursor-default' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name={`practice-question-${currentNo}`}
                    value={idx}
                    checked={isChecked}
                    disabled={isAnswered || answerMutation.isPending}
                    onChange={() => setSelectedOption(idx)}
                    className="mt-1 h-4 w-4 text-sky-600 focus:ring-sky-500"
                  />
                  <div className="flex-1 flex items-center justify-between gap-2">
                    <span className="text-sm leading-relaxed">{optionText}</span>
                    {/* Non-color indicators for accessibility */}
                    {isCorrectOption && (
                      <Badge variant="success" className="text-xs">
                        ✓ {t('practice.correctOptionLabel')}
                      </Badge>
                    )}
                    {isWrongSelection && (
                      <Badge variant="danger" className="text-xs">
                        ✕ {t('practice.yourWrongAnswerLabel')}
                      </Badge>
                    )}
                  </div>
                </label>
              );
            })}
          </div>

          {/* Educational Rationale Section (Appears ONLY after question is answered) */}
          {isAnswered && currentQuestion.answer && (
            <div
              className={`p-4 rounded-lg border space-y-1.5 transition-all ${
                currentQuestion.answer.correct
                  ? 'bg-emerald-50/80 border-emerald-200'
                  : 'bg-amber-50/80 border-amber-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">
                  {currentQuestion.answer.correct
                    ? `✓ ${t('practice.answerCorrect')}`
                    : `✕ ${t('practice.answerIncorrect')}`}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-700">
                {t('practice.rationaleTitle')}:
              </p>
              <p className="text-sm text-slate-800 leading-relaxed">
                {currentQuestion.answer.rationale}
              </p>
            </div>
          )}
        </CardContent>

        {/* Card Actions Footer */}
        <CardFooter className="flex items-center justify-between border-t border-slate-100 p-4">
          <div className="text-xs text-slate-500">
            {t('practice.questionProgress', {
              current: fmt.number(currentNo, i18n.language),
              total: fmt.number(set.size, i18n.language),
            })}
          </div>

          <div className="flex items-center gap-2">
            {!isAnswered ? (
              <Button
                variant="primary"
                disabled={selectedOption === null || answerMutation.isPending}
                isLoading={answerMutation.isPending}
                onClick={handleSubmitAnswer}
              >
                {t('practice.submitAnswer')}
              </Button>
            ) : (
              <Button variant="primary" onClick={handleNext}>
                {isLastQuestion ? t('practice.viewResults') : t('practice.nextQuestion')} →
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>

      {/* Question Selector Dots / Numbers */}
      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
        {set.questions.map((q) => {
          const isCurrent = q.no === currentNo;
          let dotStyle = 'bg-white border-slate-300 text-slate-700';

          if (q.answered) {
            if (q.answer?.correct) {
              dotStyle = 'bg-emerald-100 border-emerald-400 text-emerald-800 font-bold';
            } else {
              dotStyle = 'bg-rose-100 border-rose-400 text-rose-800 font-bold';
            }
          }

          if (isCurrent) {
            dotStyle += ' ring-2 ring-sky-500 ring-offset-1 font-bold';
          }

          return (
            <button
              key={q.no}
              type="button"
              onClick={() => setCurrentNo(q.no)}
              className={`w-9 h-9 rounded-lg border text-xs flex items-center justify-center transition-all ${dotStyle}`}
              aria-label={`سوال ${q.no}`}
            >
              {fmt.number(q.no, i18n.language)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
