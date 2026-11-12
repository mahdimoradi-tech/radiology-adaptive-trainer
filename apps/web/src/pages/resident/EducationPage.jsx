import { useTranslation } from 'react-i18next';
import { Badge } from '../../components/ui/index.js';

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
      tag: 'سنجش نخست',
      accentColor: 'border-t-sky-500',
      badgeBg: 'bg-sky-50 text-sky-800 border border-sky-200/80',
    },
    {
      num: '۲',
      title: t('education.cycleStep2Title'),
      desc: t('education.cycleStep2Desc'),
      badgeVariant: 'secondary',
      tag: 'موتور تحلیلی',
      accentColor: 'border-t-indigo-500',
      badgeBg: 'bg-indigo-50 text-indigo-800 border border-indigo-200/80',
    },
    {
      num: '۳',
      title: t('education.cycleStep3Title'),
      desc: t('education.cycleStep3Desc'),
      badgeVariant: 'primary',
      tag: 'شخصی‌سازی',
      accentColor: 'border-t-amber-500',
      badgeBg: 'bg-amber-50 text-amber-800 border border-amber-200/80',
    },
    {
      num: '۴',
      title: t('education.cycleStep4Title'),
      desc: t('education.cycleStep4Desc'),
      badgeVariant: 'success',
      tag: 'تثبیت تسلط',
      accentColor: 'border-t-emerald-500',
      badgeBg: 'bg-emerald-50 text-emerald-800 border border-emerald-200/80',
    },
  ];

  const diseaseClasses = [
    {
      key: 'covid19',
      title: t('education.covid19Title'),
      desc: t('education.covid19Desc'),
      topBorder: 'border-t-4 border-t-blue-600',
      headerBg: 'bg-linear-to-b from-blue-50/70 to-blue-50/20',
      badgeClass: 'bg-blue-100 text-blue-900 border border-blue-200/70',
      dotClass: 'bg-blue-600',
    },
    {
      key: 'pneumonia',
      title: t('education.pneumoniaTitle'),
      desc: t('education.pneumoniaDesc'),
      topBorder: 'border-t-4 border-t-amber-500',
      headerBg: 'bg-linear-to-b from-amber-50/70 to-amber-50/20',
      badgeClass: 'bg-amber-100 text-amber-900 border border-amber-200/70',
      dotClass: 'bg-amber-600',
    },
    {
      key: 'normal',
      title: t('education.normalTitle'),
      desc: t('education.normalDesc'),
      topBorder: 'border-t-4 border-t-emerald-600',
      headerBg: 'bg-linear-to-b from-emerald-50/70 to-emerald-50/20',
      badgeClass: 'bg-emerald-100 text-emerald-900 border border-emerald-200/70',
      dotClass: 'bg-emerald-600',
    },
  ];

  return (
    <div className="space-y-10 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="space-y-2 text-start">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          {t('education.title')}
        </h1>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-3xl">
          {t('education.subtitle')}
        </p>
      </div>

      {/* Section (a): Purpose & Educational Disclaimer Callout */}
      <div
        role="alert"
        className="relative overflow-hidden rounded-2xl border border-amber-200/90 bg-linear-to-l from-amber-50/70 via-orange-50/30 to-amber-50/50 p-5 sm:p-6 shadow-2xs text-start"
      >
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 shadow-2xs">
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div className="space-y-1.5 flex-1">
            <h2 className="text-base font-bold text-amber-950">{t('education.disclaimerTitle')}</h2>
            <p className="text-sm text-amber-900/90 leading-relaxed font-normal">
              {t('education.disclaimerText')}
            </p>
          </div>
        </div>
      </div>

      {/* Section (b): Adaptive Learning Cycle */}
      <section className="space-y-4" aria-labelledby="adaptive-cycle-heading">
        <div className="space-y-1 text-start">
          <h2 id="adaptive-cycle-heading" className="text-xl font-bold text-slate-900">
            {t('education.cycleTitle')}
          </h2>
          <p className="text-sm text-slate-600">{t('education.cycleSubtitle')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6">
          {cycleSteps.map((step, idx) => (
            <div
              key={idx}
              className={`rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between text-start border-t-4 ${step.accentColor}`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold shadow-2xs ${step.badgeBg}`}
                  >
                    {step.tag}
                  </span>
                  <Badge variant={step.badgeVariant}>{`مرحله ${step.num}`}</Badge>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-2">{step.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed font-normal">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section (c): Report Confusion Metrics (FP & FN) */}
      <section className="space-y-4" aria-labelledby="metrics-guide-heading">
        <div className="space-y-1 text-start">
          <h2 id="metrics-guide-heading" className="text-xl font-bold text-slate-900">
            {t('education.metricsTitle')}
          </h2>
          <p className="text-sm text-slate-600">{t('education.metricsSubtitle')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6">
          <div className="rounded-2xl border border-amber-200/80 bg-linear-to-b from-amber-50/40 via-white to-white p-6 shadow-2xs text-start flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-sm shadow-2xs">
                  FP
                </div>
                <Badge variant="warning">مثبت کاذب</Badge>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-amber-950 mb-3">
                {t('education.fpTitle')}
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed font-normal">
                {t('education.fpDesc')}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-rose-200/80 bg-linear-to-b from-rose-50/40 via-white to-white p-6 shadow-2xs text-start flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center font-bold text-sm shadow-2xs">
                  FN
                </div>
                <Badge variant="danger">منفی کاذب</Badge>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-rose-950 mb-3">
                {t('education.fnTitle')}
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed font-normal">
                {t('education.fnDesc')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section (d): Grounded Radiological Signs */}
      <section className="space-y-4" aria-labelledby="radiological-classes-heading">
        <div className="space-y-1 text-start">
          <h2 id="radiological-classes-heading" className="text-xl font-bold text-slate-900">
            {t('education.classesTitle')}
          </h2>
          <p className="text-sm text-slate-600">{t('education.classesSubtitle')}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6">
          {diseaseClasses.map((item) => (
            <div
              key={item.key}
              className={`rounded-2xl border border-slate-200/90 bg-white shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between overflow-hidden text-start ${item.topBorder}`}
            >
              <div>
                <div className={`p-5 pb-3 border-b border-slate-100 ${item.headerBg}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold ${item.badgeClass}`}
                    >
                      <span className={`w-2 h-2 rounded-full ${item.dotClass}`} />
                      {t(`classes.${item.key}`)}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      {item.key}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">{item.title}</h3>
                </div>

                <div className="p-5 sm:p-6 pt-4">
                  <p className="text-sm text-slate-700 leading-relaxed font-normal text-start">
                    {item.desc}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
