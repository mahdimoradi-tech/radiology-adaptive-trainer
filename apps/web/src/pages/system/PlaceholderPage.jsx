import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '../../components/ui/index.js';

/**
 * Reusable placeholder view for planned features
 * @param {Object} props
 * @param {string} props.titleKey
 * @param {string} props.task
 */
export function PlaceholderPage({ titleKey, task }) {
  const { t } = useTranslation();

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t(titleKey)}</CardTitle>
            <Badge variant="secondary">{task}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600 mb-4">
            {t('common.comingInTask', { task })}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
