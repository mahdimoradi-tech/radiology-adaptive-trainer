import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '../../components/ui/index.js';

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="text-6xl font-black text-slate-300 mb-2">404</div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">{t('common.notFound')}</h1>
      <p className="text-sm text-slate-600 max-w-md mb-6">{t('common.pageNotFoundDesc')}</p>
      <Link to="/app">
        <Button variant="primary">{t('nav.home')}</Button>
      </Link>
    </div>
  );
}
