import { useTranslation } from 'react-i18next';
import { useSessionExplanations } from './hooks.js';
import { LlmPanel } from './LlmPanel.jsx';

/**
 * Diagnostic explanation panel for a specific wrong question in the review page.
 *
 * @param {Object} props
 * @param {string} props.sessionId
 * @param {number} props.questionNo
 */
export function QuestionExplanationPanel({ sessionId, questionNo }) {
  const { t } = useTranslation();
  const { data, isLoading, error } = useSessionExplanations(sessionId);

  if (error && !data) {
    return null;
  }

  const items = data?.items || [];
  const explanation = items.find((it) => it.no === questionNo);

  if (!isLoading && !explanation) {
    return null;
  }

  const source = data?.source || 'fallback';
  const reviewed = data?.reviewed || false;

  return (
    <LlmPanel
      title={t('llm.explanationTitle')}
      source={source}
      reviewed={reviewed}
      isLoading={isLoading}
      className="mt-4"
    >
      {explanation && (
        <div className="space-y-3 text-xs leading-relaxed">
          {/* Key findings to look for */}
          {explanation.whatToLookFor && explanation.whatToLookFor.length > 0 && (
            <div className="space-y-1">
              <span className="font-semibold text-slate-800 block">{t('llm.whatToLookFor')}</span>
              <ul className="list-disc list-inside space-y-0.5 text-slate-700">
                {explanation.whatToLookFor.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Why confused */}
          {explanation.whyConfused && (
            <div className="space-y-0.5 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              <span className="font-semibold text-slate-800 block">{t('llm.whyConfused')}</span>
              <p className="text-slate-600">{explanation.whyConfused}</p>
            </div>
          )}

          {/* Practical tip */}
          {explanation.tip && (
            <div className="space-y-0.5 bg-indigo-50/40 p-2.5 rounded-lg border border-indigo-100/60">
              <span className="font-semibold text-indigo-900 block">{t('llm.tip')}</span>
              <p className="text-indigo-950 font-normal">{explanation.tip}</p>
            </div>
          )}
        </div>
      )}
    </LlmPanel>
  );
}
