import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/index.js';
import { fmt } from '../../lib/format.js';

/**
 * Accessible confirmation dialog for session submission
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {number} props.unansweredCount
 * @param {boolean} props.isLoading
 * @param {() => void} props.onConfirm
 * @param {() => void} props.onCancel
 */
export function FinishDialog({
  isOpen,
  unansweredCount = 0,
  isLoading = false,
  onConfirm,
  onCancel,
}) {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isLoading) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="finish-dialog-title"
    >
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
        <h3 id="finish-dialog-title" className="text-lg font-bold text-slate-900">
          {t('finishDialog.title')}
        </h3>

        <div className="text-sm text-slate-600 space-y-2">
          {unansweredCount > 0 ? (
            <p className="text-amber-800 bg-amber-50 p-3 rounded-lg border border-amber-200">
              {t('finishDialog.warning', {
                count: fmt.number(unansweredCount, i18n.language),
              })}
            </p>
          ) : (
            <p>{t('finishDialog.allAnswered')}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="outline" disabled={isLoading} onClick={onCancel}>
            {t('finishDialog.cancel')}
          </Button>
          <Button variant="primary" isLoading={isLoading} onClick={onConfirm}>
            {isLoading ? t('finishDialog.finishing') : t('finishDialog.confirm')}
          </Button>
        </div>
      </div>
    </div>
  );
}
