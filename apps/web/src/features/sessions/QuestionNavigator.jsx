import { useTranslation } from 'react-i18next';
import { fmt } from '../../lib/format.js';

/**
 * Question navigator component displaying all session questions with status indicators
 *
 * @param {Object} props
 * @param {Array<{ no: number, answered: boolean, answer: string | null }>} props.questions
 * @param {number} props.currentNo
 * @param {(no: number) => void} props.onSelect
 * @param {string} [props.className='']
 */
export function QuestionNavigator({ questions = [], currentNo = 1, onSelect, className = '' }) {
  const { t, i18n } = useTranslation();

  const total = questions.length;
  const answeredCount = questions.filter((q) => q.answered).length;

  return (
    <nav
      aria-label={t('quiz.navigatorTitle')}
      className={`bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col ${className}`}
    >
      <div className="border-b border-slate-200 pb-3 mb-3">
        <h2 className="font-semibold text-slate-900 text-sm">{t('quiz.navigatorTitle')}</h2>
        <div className="flex items-center justify-between text-xs text-slate-600 font-medium mt-1">
          <span>{t('quiz.totalCount', { count: fmt.number(total, i18n.language) })}</span>
          <span className="font-medium text-emerald-700">
            {t('quiz.answeredCount', { count: fmt.number(answeredCount, i18n.language) })}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-5 gap-1.5 max-h-[60vh] overflow-y-auto p-1">
        {questions.map((q) => {
          const isCurrent = q.no === currentNo;
          const isAnswered = q.answered;

          const statusText = isAnswered ? t('quiz.statusAnswered') : t('quiz.statusUnanswered');

          return (
            <button
              key={q.no}
              type="button"
              onClick={() => onSelect(q.no)}
              aria-label={t('quiz.navAriaLabel', {
                no: fmt.number(q.no, i18n.language),
                status: statusText,
              })}
              aria-current={isCurrent ? 'step' : undefined}
              className={`relative flex items-center justify-center rounded-lg text-xs font-medium h-9 w-full border transition-all cursor-pointer ${
                isCurrent
                  ? 'ring-2 ring-sky-600 border-sky-600 font-bold z-1'
                  : 'border-slate-200 hover:border-slate-300'
              } ${
                isAnswered
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>{fmt.number(q.no, i18n.language)}</span>
              {isAnswered && (
                <span className="absolute bottom-0.5 end-0.5 text-emerald-600" aria-hidden="true">
                  <svg className="w-2.5 h-2.5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
