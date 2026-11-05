import { useTranslation } from 'react-i18next';
import { useSessionNarrative } from './hooks.js';
import { LlmPanel } from './LlmPanel.jsx';

/**
 * Pedagogical report narrative panel integrated into the report page.
 *
 * @param {Object} props
 * @param {string} props.sessionId
 */
export function NarrativePanel({ sessionId }) {
  const { t } = useTranslation();
  const { data, isLoading, error } = useSessionNarrative(sessionId);

  if (error && !data) {
    return null;
  }

  const narrative = data?.narrative;
  const source = data?.source || 'fallback';
  const reviewed = data?.reviewed || false;

  return (
    <LlmPanel
      title={t('llm.narrativeTitle')}
      source={source}
      reviewed={reviewed}
      isLoading={isLoading}
      className="mb-6 shadow-sm"
    >
      {narrative && (
        <div className="space-y-4">
          <p className="text-slate-800 leading-relaxed font-medium">{narrative.overview}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {/* Strengths */}
            {narrative.strengths && narrative.strengths.length > 0 && (
              <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-lg text-xs space-y-1.5">
                <span className="font-semibold text-emerald-800 block mb-1">
                  ✓ {t('llm.strengths')}
                </span>
                <ul className="space-y-1 list-disc list-inside text-emerald-950">
                  {narrative.strengths.map((str, idx) => (
                    <li key={idx} className="leading-snug">
                      {str}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Weaknesses */}
            {narrative.weaknesses && narrative.weaknesses.length > 0 && (
              <div className="p-3 bg-amber-50/60 border border-amber-100 rounded-lg text-xs space-y-1.5">
                <span className="font-semibold text-amber-800 block mb-1">
                  ! {t('llm.weaknesses')}
                </span>
                <ul className="space-y-1 list-disc list-inside text-amber-950">
                  {narrative.weaknesses.map((w, idx) => (
                    <li key={idx} className="leading-snug">
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Diagnostic Patterns */}
          {narrative.patterns && narrative.patterns.length > 0 && (
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs space-y-1.5">
              <span className="font-semibold text-slate-800 block mb-1">
                🔍 {t('llm.patterns')}
              </span>
              <ul className="space-y-1 list-disc list-inside text-slate-700">
                {narrative.patterns.map((p, idx) => (
                  <li key={idx} className="leading-snug">
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          {narrative.recommendations && narrative.recommendations.length > 0 && (
            <div className="p-3 bg-indigo-50/50 border border-indigo-100/70 rounded-lg text-xs space-y-1.5">
              <span className="font-semibold text-indigo-900 block mb-1">
                💡 {t('llm.recommendations')}
              </span>
              <ol className="space-y-1.5 list-decimal list-inside text-indigo-950 font-normal">
                {narrative.recommendations.map((rec, idx) => (
                  <li key={idx} className="leading-snug">
                    {rec}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </LlmPanel>
  );
}
