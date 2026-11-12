import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '../../components/ui/index.js';

/**
 * Shared container for LLM-powered feedback with source provenance,
 * draft warnings, loading skeleton, and educational disclaimers.
 *
 * @param {Object} props
 * @param {string} [props.title]
 * @param {'llm'|'cache'|'fallback'} [props.source='fallback']
 * @param {boolean} [props.reviewed=false]
 * @param {boolean} [props.isLoading=false]
 * @param {React.ReactNode} props.children
 * @param {string} [props.className]
 */
export function LlmPanel({
  title,
  source = 'fallback',
  reviewed = false,
  isLoading = false,
  children,
  className = '',
}) {
  const { t } = useTranslation();

  const getSourceBadge = () => {
    switch (source) {
      case 'llm':
        return (
          <Badge
            variant="primary"
            className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200"
          >
            ✦ {t('llm.sourceLlm')}
          </Badge>
        );
      case 'cache':
        return (
          <Badge variant="secondary" className="text-xs">
            {t('llm.sourceCache')}
          </Badge>
        );
      case 'fallback':
      default:
        return (
          <Badge variant="outline" className="text-xs text-slate-600">
            {t('llm.sourceFallback')}
          </Badge>
        );
    }
  };

  return (
    <Card
      className={`border-indigo-100/80 bg-gradient-to-b from-indigo-50/20 to-white overflow-hidden ${className}`}
    >
      <CardHeader className="border-b border-indigo-50/60 pb-3 bg-white/50">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-indigo-600 text-sm font-semibold select-none" aria-hidden="true">
              AI
            </span>
            <CardTitle className="text-sm font-semibold text-slate-900">
              {title || t('llm.narrativeTitle')}
            </CardTitle>
          </div>

          <div className="flex items-center gap-2">
            {!reviewed && (
              <Badge variant="warning" className="text-xs">
                {t('llm.draft')}
              </Badge>
            )}
            {getSourceBadge()}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 text-sm text-slate-700 space-y-3">
        {isLoading ? (
          <div className="animate-pulse space-y-3 py-2">
            <div className="h-4 bg-slate-200 rounded w-3/4" />
            <div className="h-4 bg-slate-200 rounded w-5/6" />
            <div className="h-4 bg-slate-200 rounded w-1/2" />
          </div>
        ) : (
          children
        )}

        <div className="text-xs text-slate-600 pt-3 border-t border-slate-200 flex items-center gap-1.5 select-none">
          <svg
            className="w-3.5 h-3.5 text-slate-600 shrink-0"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <span>{t('disclaimer.educational')}</span>
        </div>
      </CardContent>
    </Card>
  );
}
