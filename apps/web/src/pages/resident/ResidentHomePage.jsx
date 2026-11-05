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
  Badge,
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
        <p className="text-sm text-slate-500 mt-1">{t('app.tagline')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Start Test Card */}
        <Card className="flex flex-col justify-between border-sky-200 bg-sky-50/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t('home.startTest')}</CardTitle>
              <Badge variant="primary">T06</Badge>
            </div>
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
            <div className="flex items-center justify-between">
              <CardTitle>{t('home.reviewTests')}</CardTitle>
              <Badge variant="secondary">T06</Badge>
            </div>
            <CardDescription>{t('home.reviewTestsDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">{t('sessions.historyTitle')}</p>
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
            <div className="flex items-center justify-between">
              <CardTitle>{t('home.education')}</CardTitle>
              <Badge variant="secondary">T09</Badge>
            </div>
            <CardDescription>{t('home.educationDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">{t('common.comingInTask', { task: 'T09' })}</p>
          </CardContent>
          <CardFooter>
            <Button variant="outline" disabled className="w-full">
              {t('home.education')}
            </Button>
          </CardFooter>
        </Card>

        {/* 4. Profile / Progress Card */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t('home.profile')}</CardTitle>
              <Badge variant="secondary">T09</Badge>
            </div>
            <CardDescription>{t('home.profileDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">{t('common.comingInTask', { task: 'T09' })}</p>
          </CardContent>
          <CardFooter>
            <Button variant="outline" disabled className="w-full">
              {t('home.profile')}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
