import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useMe } from '../../features/auth/hooks.js';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
} from '../../components/ui/index.js';

export function ResidentHomePage() {
  const { t } = useTranslation();
  const { data: user } = useMe();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {t('home.welcome', { name: user?.displayName || '' })}
        </h1>
        <p className="text-sm text-slate-600 mt-1">{t('app.tagline')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Start Test Card */}
        <Card className="flex flex-col justify-between border-sky-200 bg-sky-50/30">
          <CardHeader>
            <CardTitle>{t('home.startTest')}</CardTitle>
            <CardDescription>{t('home.startTestDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-600">{t('sessions.subtitle')}</p>
          </CardContent>
          <CardFooter>
            <Link to="/app/tests" className="w-full">
              <Button variant="primary" className="w-full">
                {t('home.startTest')}
              </Button>
            </Link>
          </CardFooter>
        </Card>

        {/* 2. Review Tests Card */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle>{t('home.reviewTests')}</CardTitle>
            <CardDescription>{t('home.reviewTestsDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-600">{t('sessions.historyTitle')}</p>
          </CardContent>
          <CardFooter>
            <Link to="/app/tests" className="w-full">
              <Button variant="outline" className="w-full">
                {t('home.reviewTests')}
              </Button>
            </Link>
          </CardFooter>
        </Card>

        {/* 3. Education Card */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle>{t('home.education')}</CardTitle>
            <CardDescription>{t('home.educationDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-600">{t('education.subtitle')}</p>
          </CardContent>
          <CardFooter>
            <Link to="/app/education" className="w-full">
              <Button variant="outline" className="w-full">
                {t('home.education')}
              </Button>
            </Link>
          </CardFooter>
        </Card>

        {/* 4. Profile / Progress Card */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle>{t('home.profile')}</CardTitle>
            <CardDescription>{t('home.profileDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-600">{t('progress.subtitle')}</p>
          </CardContent>
          <CardFooter>
            <Link to="/app/progress" className="w-full">
              <Button variant="outline" className="w-full">
                {t('home.profile')}
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
