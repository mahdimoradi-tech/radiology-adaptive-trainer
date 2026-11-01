import { useTranslation } from 'react-i18next';
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

export function InstructorHomePage() {
  const { t } = useTranslation();
  const { data: user } = useMe();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {t('instructor.title')} — {user?.displayName}
        </h1>
        <p className="text-sm text-slate-500 mt-1">{t('instructor.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Review AI Questions Card */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t('instructor.reviewTitle')}</CardTitle>
              <Badge variant="secondary">T08</Badge>
            </div>
            <CardDescription>{t('instructor.reviewDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">
              {t('common.comingInTask', { task: 'T08' })}
            </p>
          </CardContent>
          <CardFooter>
            <Button variant="outline" disabled className="w-full">
              {t('nav.review')}
            </Button>
          </CardFooter>
        </Card>

        {/* 2. Resident Progress Card */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t('instructor.residentsTitle')}</CardTitle>
              <Badge variant="secondary">T08</Badge>
            </div>
            <CardDescription>{t('instructor.residentsDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">
              {t('common.comingInTask', { task: 'T08' })}
            </p>
          </CardContent>
          <CardFooter>
            <Button variant="outline" disabled className="w-full">
              {t('nav.residents')}
            </Button>
          </CardFooter>
        </Card>

        {/* 3. Catalog Strata Card */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t('instructor.catalogTitle')}</CardTitle>
              <Badge variant="secondary">T08</Badge>
            </div>
            <CardDescription>{t('instructor.catalogDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">
              {t('common.comingInTask', { task: 'T08' })}
            </p>
          </CardContent>
          <CardFooter>
            <Button variant="outline" disabled className="w-full">
              {t('nav.catalog')}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
