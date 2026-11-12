import { useTranslation } from 'react-i18next';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Alert,
  Badge,
} from '../../components/ui/index.js';

/**
 * Resident Education Page explaining platform scope, adaptive learning cycles,
 * error metric interpretations, and approved radiological findings.
 */
export function EducationPage() {
  const { t } = useTranslation();

  const cycleSteps = [
    {
      num: '۱',
      title: t('education.cycleStep1Title'),
      desc: t('education.cycleStep1Desc'),
      badgeVariant: 'secondary',
    },
    {
      num: '۲',
      title: t('education.cycleStep2Title'),
      desc: t('education.cycleStep2Desc'),
      badgeVariant: 'secondary',
    },
    {
      num: '۳',
      title: t('education.cycleStep3Title'),
      desc: t('education.cycleStep3Desc'),
      badgeVariant: 'primary',
    },
    {
      num: '۴',
      title: t('education.cycleStep4Title'),
      desc: t('education.cycleStep4Desc'),
      badgeVariant: 'success',
    },
  ];

  const diseaseClasses = [
    {
      key: 'covid19',
      title: t('education.covid19Title'),
      desc: t('education.covid19Desc'),
      source: 'apps/api/src/modules/llm/kb/covid19.md',
      badgeVariant: 'warning',
    },
    {
      key: 'pneumonia',
      title: t('education.pneumoniaTitle'),
      desc: t('education.pneumoniaDesc'),
      source: 'apps/api/src/modules/llm/kb/pneumonia.md',
      badgeVariant: 'primary',
    },
    {
      key: 'normal',
      title: t('education.normalTitle'),
      desc: t('education.normalDesc'),
      source: 'apps/api/src/modules/llm/kb/normal.md',
      badgeVariant: 'secondary',
    },
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('education.title')}</h1>
        <p className="text-sm text-slate-600 mt-1">{t('education.subtitle')}</p>
      </div>

      {/* Section (a): Purpose & Educational Disclaimer */}
      <Alert variant="warning" title={t('education.disclaimerTitle')}>
        <p className="text-sm leading-relaxed mt-1">{t('education.disclaimerText')}</p>
      </Alert>

      {/* Section (b): Adaptive Learning Cycle */}
      <section className="space-y-4" aria-labelledby="adaptive-cycle-heading">
        <div>
          <h2 id="adaptive-cycle-heading" className="text-lg font-bold text-slate-900">
            {t('education.cycleTitle')}
          </h2>
          <p className="text-xs text-slate-600 font-medium mt-0.5">
            {t('education.cycleSubtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {cycleSteps.map((step, idx) => (
            <Card key={idx} className="flex flex-col justify-between border-slate-200">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="w-7 h-7 rounded-full bg-sky-100 text-sky-800 font-bold text-sm flex items-center justify-center">
                    {step.num}
                  </span>
                  <Badge variant={step.badgeVariant}>{`مرحله ${step.num}`}</Badge>
                </div>
                <CardTitle className="text-base">{step.title}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-slate-700 leading-7">{step.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Section (c): Report Confusion Metrics (FP & FN) */}
      <section className="space-y-4" aria-labelledby="metrics-guide-heading">
        <div>
          <h2 id="metrics-guide-heading" className="text-lg font-bold text-slate-900">
            {t('education.metricsTitle')}
          </h2>
          <p className="text-xs text-slate-600 font-medium mt-0.5">
            {t('education.metricsSubtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-amber-200 bg-amber-50/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-amber-900">{t('education.fpTitle')}</CardTitle>
                <Badge variant="warning">FP</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-700 leading-7">{t('education.fpDesc')}</p>
            </CardContent>
          </Card>

          <Card className="border-rose-200 bg-rose-50/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-rose-900">{t('education.fnTitle')}</CardTitle>
                <Badge variant="danger">FN</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-700 leading-7">{t('education.fnDesc')}</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Section (d): Grounded Radiological Signs */}
      <section className="space-y-4" aria-labelledby="radiological-classes-heading">
        <div>
          <h2 id="radiological-classes-heading" className="text-lg font-bold text-slate-900">
            {t('education.classesTitle')}
          </h2>
          <p className="text-xs text-slate-600 font-medium mt-0.5">
            {t('education.classesSubtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {diseaseClasses.map((item) => (
            <Card key={item.key} className="flex flex-col justify-between">
              <CardHeader>
                <div className="flex items-center justify-between mb-1">
                  <CardTitle className="text-base">{item.title}</CardTitle>
                  <Badge variant={item.badgeVariant}>{t(`classes.${item.key}`)}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-slate-700 leading-7 text-justify">{item.desc}</p>
                <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                  <span>{t('education.kbSourceLabel')}</span>
                  <code
                    dir="ltr"
                    className="font-mono text-xs text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded"
                  >
                    {item.source}
                  </code>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
