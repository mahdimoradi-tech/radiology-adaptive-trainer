import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate, Navigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useSession, useAnswerQuestion, useFinishSession } from '../../features/sessions/hooks.js';
import { QuestionNavigator } from '../../features/sessions/QuestionNavigator.jsx';
import { FinishDialog } from '../../features/sessions/FinishDialog.jsx';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Button,
  Alert,
  Spinner,
} from '../../components/ui/index.js';
import { fmt } from '../../lib/format.js';
import { ApiError, getErrorI18nKey } from '../../lib/api.js';

const OPTIONS = /** @type {const} */ ([
  { id: 'covid19', labelKey: 'quiz.optionCovid19' },
  { id: 'pneumonia', labelKey: 'quiz.optionPneumonia' },
  { id: 'normal', labelKey: 'quiz.optionNormal' },
]);

export function QuizPage() {
  const { sessionId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const { data: session, isLoading, error } = useSession(sessionId);
  const answerMutation = useAnswerQuestion(sessionId);
  const finishMutation = useFinishSession();

  const [isFinishDialogOpen, setIsFinishDialogOpen] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [imageError, setImageError] = useState(false);
  const [imageRetryCount, setImageRetryCount] = useState(0);
  const [isNavOpenMobile, setIsNavOpenMobile] = useState(false);

  // Time tracking for response time measurement
  const questionStartTimeRef = useRef(Date.now());

  // Determination of questions and current question
  const questions = session?.questions ?? [];
  const totalQuestions = questions.length;

  // Determine current question number (1-based)
  const qParam = searchParams.get('q');
  const currentNoFromUrl = qParam ? Number.parseInt(qParam, 10) : null;

  let currentNo = 1;
  if (currentNoFromUrl && currentNoFromUrl >= 1 && currentNoFromUrl <= totalQuestions) {
    currentNo = currentNoFromUrl;
  } else if (questions.length > 0) {
    // Resume to the first unanswered question, or question 1
    const firstUnanswered = questions.find((q) => !q.answered);
    currentNo = firstUnanswered ? firstUnanswered.no : 1;
  }

  // Set URL parameter if missing or invalid
  useEffect(() => {
    if (
      session?.status === 'in_progress' &&
      questions.length > 0 &&
      (!qParam || Number(qParam) !== currentNo)
    ) {
      setSearchParams({ q: String(currentNo) }, { replace: true });
    }
  }, [session?.status, questions.length, qParam, currentNo, setSearchParams]);

  // Reset timer and errors on question change
  useEffect(() => {
    questionStartTimeRef.current = Date.now();
    setSaveError('');
    setImageError(false);
  }, [currentNo]);

  const currentQuestion = questions.find((q) => q.no === currentNo);

  const handleSelectQuestion = (no) => {
    setSearchParams({ q: String(no) });
    setIsNavOpenMobile(false);
  };

  const handleOptionSelect = useCallback(
    async (answerId) => {
      setSaveError('');
      const elapsed = Date.now() - questionStartTimeRef.current;
      const timeMs = Math.min(600000, Math.max(0, elapsed));

      try {
        await answerMutation.mutateAsync({
          questionNo: currentNo,
          answer: answerId,
          timeMs,
        });
      } catch (err) {
        if (err instanceof ApiError && err.code === 'SESSION_NOT_IN_PROGRESS') {
          navigate(`/app/reports/${sessionId}`, { replace: true });
          return;
        }
        setSaveError(t('quiz.saveError'));
      }
    },
    [answerMutation, currentNo, navigate, sessionId, t],
  );

  // Keyboard navigation 1/2/3 for option selection
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === '1') {
        handleOptionSelect('covid19');
      } else if (e.key === '2') {
        handleOptionSelect('pneumonia');
      } else if (e.key === '3') {
        handleOptionSelect('normal');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleOptionSelect]);

  // Image load handler: prefetch next image
  const handleImageLoad = () => {
    setImageError(false);
    if (currentNo < totalQuestions) {
      const nextQuestion = questions.find((q) => q.no === currentNo + 1);
      if (nextQuestion?.imageUrl) {
        const preloader = new Image();
        preloader.src = nextQuestion.imageUrl;
      }
    }
  };

  const handleFinishSubmit = async () => {
    try {
      await finishMutation.mutateAsync(sessionId);
      navigate(`/app/reports/${sessionId}`);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'SESSION_ALREADY_FINISHED') {
        navigate(`/app/reports/${sessionId}`);
        return;
      }
      const errorKey =
        err instanceof ApiError ? getErrorI18nKey(err.code) : 'errors.INTERNAL_ERROR';
      setSaveError(t(errorKey));
      setIsFinishDialogOpen(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="py-12 max-w-lg mx-auto text-center space-y-4">
        <Alert variant="danger">{t('errors.NOT_FOUND')}</Alert>
        <Button variant="outline" onClick={() => navigate('/app/tests')}>
          {t('common.back')}
        </Button>
      </div>
    );
  }

  if (session?.status === 'finished') {
    return <Navigate to={`/app/reports/${sessionId}`} replace />;
  }

  const unansweredCount = questions.filter((q) => !q.answered).length;

  return (
    <div className="space-y-4">
      {/* Mobile Navigator Toggle */}
      <div className="lg:hidden flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200">
        <span className="text-sm font-semibold text-slate-800">
          {t('quiz.title', {
            no: fmt.number(currentNo, i18n.language),
            total: fmt.number(totalQuestions, i18n.language),
          })}
        </span>
        <Button variant="outline" size="sm" onClick={() => setIsNavOpenMobile((open) => !open)}>
          {t('quiz.toggleNav')}
        </Button>
      </div>

      {isNavOpenMobile && (
        <div className="lg:hidden mb-4">
          <QuestionNavigator
            questions={questions}
            currentNo={currentNo}
            onSelect={handleSelectQuestion}
          />
        </div>
      )}

      {/* Main Grid: Navigator on right (first in DOM in RTL), Question on left */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Navigator Column: first in DOM for RTL placement on the right */}
        <div className="hidden lg:block lg:col-span-1">
          <QuestionNavigator
            questions={questions}
            currentNo={currentNo}
            onSelect={handleSelectQuestion}
          />
        </div>

        {/* Question Card Column */}
        <div className="lg:col-span-3 space-y-4">
          {saveError && (
            <Alert variant="danger" className="text-sm">
              {saveError}
            </Alert>
          )}

          <Card className="shadow-xs border-slate-200 overflow-hidden">
            <CardHeader className="border-b border-slate-100 bg-slate-50/60 pb-3">
              <div className="flex items-center justify-between gap-4">
                <CardTitle className="text-base text-slate-900">
                  {t('quiz.questionPrompt', {
                    no: fmt.number(currentNo, i18n.language),
                  })}
                </CardTitle>
                <span className="text-xs text-slate-500 font-medium shrink-0">
                  {fmt.number(currentNo, i18n.language)} /{' '}
                  {fmt.number(totalQuestions, i18n.language)}
                </span>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-6 space-y-6">
              {/* Image Container with RTL protection */}
              <div
                dir="ltr"
                data-testid="quiz-image-container"
                className="relative bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center min-h-[300px] max-h-[70vh] border border-slate-800"
              >
                {imageError ? (
                  <div className="p-8 text-center space-y-3">
                    <p className="text-slate-200 text-sm">{t('quiz.imageError')}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setImageError(false);
                        setImageRetryCount((c) => c + 1);
                      }}
                    >
                      {t('quiz.imageRetry')}
                    </Button>
                  </div>
                ) : (
                  <img
                    key={`${currentQuestion?.imageUrl}-${imageRetryCount}`}
                    src={currentQuestion?.imageUrl}
                    alt={t('quiz.xrayAlt')}
                    draggable={false}
                    onLoad={handleImageLoad}
                    onError={() => setImageError(true)}
                    className="max-h-[65vh] w-auto max-w-full object-contain pointer-events-none select-none"
                  />
                )}
              </div>

              {/* Radio Options Group */}
              <div className="space-y-3">
                <div
                  role="radiogroup"
                  aria-label={t('quiz.questionPrompt', {
                    no: fmt.number(currentNo, i18n.language),
                  })}
                  className="grid grid-cols-1 sm:grid-cols-3 gap-3"
                >
                  {OPTIONS.map((opt, index) => {
                    const isSelected = currentQuestion?.answer === opt.id;
                    return (
                      <label
                        key={opt.id}
                        className={`relative flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-sky-600 bg-sky-50/70 ring-2 ring-sky-500/30'
                            : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`question-${currentNo}`}
                          value={opt.id}
                          checked={isSelected}
                          onChange={() => handleOptionSelect(opt.id)}
                          className="h-4 w-4 text-sky-600 border-slate-300 focus:ring-sky-500"
                        />
                        <div className="flex items-center justify-between w-full">
                          <span className="font-medium text-sm text-slate-800">
                            {t(opt.labelKey)}
                          </span>
                          <span className="text-xs text-slate-600 font-mono">[{index + 1}]</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-600 text-start">{t('quiz.keyboardTip')}</p>
              </div>
            </CardContent>

            {/* Navigation & Action Footer */}
            <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/40 p-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentNo <= 1}
                  onClick={() => handleSelectQuestion(currentNo - 1)}
                >
                  {t('quiz.prevQuestion')}
                </Button>
                {currentNo < totalQuestions && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSelectQuestion(currentNo + 1)}
                  >
                    {t('quiz.nextQuestion')}
                  </Button>
                )}
              </div>

              <Button variant="primary" size="sm" onClick={() => setIsFinishDialogOpen(true)}>
                {t('quiz.finishTest')}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      <FinishDialog
        isOpen={isFinishDialogOpen}
        unansweredCount={unansweredCount}
        isLoading={finishMutation.isPending}
        onConfirm={handleFinishSubmit}
        onCancel={() => setIsFinishDialogOpen(false)}
      />
    </div>
  );
}
