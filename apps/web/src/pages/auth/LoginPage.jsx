import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/index.js';

export function LoginPage() {
  const { t } = useTranslation();

  return (
    <div className="w-full max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>{t('auth.login')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600 mb-4">{t('auth.submitLogin')}</p>
          <Link to="/register" className="text-sm text-sky-600 hover:underline">
            {t('auth.noAccount')}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
