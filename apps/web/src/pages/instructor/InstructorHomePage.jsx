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

export function InstructorHomePage() {
  const { t } = useTranslation();
  const { data: user } = useMe();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {t('instructor.title')} — {user?.displayName}
        </h1>
        <p className="text-sm text-slate-600 mt-1">{t('instructor.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 1. Review AI Questions Card */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle>{t('instructor.reviewTitle')}</CardTitle>
            <CardDescription>{t('instructor.reviewDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-600 font-medium">{t('instructor.review.title')}</p>
          </CardContent>
          <CardFooter>
            <Link to="/instructor/review" className="w-full">
              <Button variant="outline" className="w-full">
                {t('nav.review')}
              </Button>
            </Link>
          </CardFooter>
        </Card>

        {/* 2. Resident Progress Card */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle>{t('instructor.residentsTitle')}</CardTitle>
            <CardDescription>{t('instructor.residentsDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-600 font-medium">
              {t('instructor.residents.subtitle')}
            </p>
          </CardContent>
          <CardFooter>
            <Link to="/instructor/residents" className="w-full">
              <Button variant="outline" className="w-full">
                {t('nav.residents')}
              </Button>
            </Link>
          </CardFooter>
        </Card>

        {/* 3. Catalog Strata Card */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle>{t('instructor.catalogTitle')}</CardTitle>
            <CardDescription>{t('instructor.catalogDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-600 font-medium">{t('instructor.catalog.subtitle')}</p>
          </CardContent>
          <CardFooter>
            <Link to="/instructor/catalog" className="w-full">
              <Button variant="outline" className="w-full">
                {t('nav.catalog')}
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
