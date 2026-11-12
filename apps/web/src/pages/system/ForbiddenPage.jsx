import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '../../components/ui/index.js';
import { useMe } from '../../features/auth/hooks.js';

export function ForbiddenPage() {
  const { t } = useTranslation();
  const { data: user } = useMe();
  const homePath = user?.role === 'instructor' ? '/instructor' : user ? '/app' : '/auth/login';

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 mb-4 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-2xl font-bold">
        !
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">{t('common.forbidden')}</h1>
      <p className="text-sm text-slate-600 max-w-md mb-6">{t('common.forbiddenDesc')}</p>
      <Link to={homePath}>
        <Button variant="primary">{t('common.back')}</Button>
      </Link>
    </div>
  );
}
