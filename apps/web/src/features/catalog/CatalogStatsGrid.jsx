import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/index.js';
import { fmt } from '../../lib/format.js';

/**
 * Display aggregated catalog statistics: totals, class-bucket matrix, and source distribution
 *
 * @param {Object} props
 * @param {import('@radiology/contracts').CatalogStats} props.stats
 */
export function CatalogStatsGrid({ stats }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const classes = ['covid19', 'pneumonia', 'normal'];
  const buckets = ['easy', 'medium', 'hard'];

  const sourceEntries = Object.entries(stats?.bySource || {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      {/* Top summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-slate-200">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-slate-600 font-medium">
              {t('instructor.catalog.totalImages')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {fmt.number(stats?.total || 0, lang)}
            </div>
          </CardContent>
        </Card>

        {classes.map((cls) => (
          <Card key={cls} className="border-slate-200">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs text-slate-600 font-medium">
                {t(`classes.${cls}`)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">
                {fmt.number(stats?.byClass?.[cls] || 0, lang)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table 1: Class x Bucket Matrix (2 cols on lg) */}
        <Card className="lg:col-span-2 border-slate-200">
          <CardHeader>
            <CardTitle className="text-base text-slate-900">
              {t('instructor.catalog.classBucketTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-start">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-600">
                    <th className="py-2.5 px-3 text-start font-semibold">
                      {t('instructor.catalog.classCol')}
                    </th>
                    {buckets.map((b) => (
                      <th key={b} className="py-2.5 px-3 text-center font-semibold">
                        {t(`buckets.${b}`)}
                      </th>
                    ))}
                    <th className="py-2.5 px-3 text-center font-semibold">
                      {t('instructor.catalog.countCol')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {classes.map((cls) => {
                    const rowTotal = stats?.byClass?.[cls] || 0;
                    return (
                      <tr key={cls} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 font-medium text-slate-800">
                          {t(`classes.${cls}`)}
                        </td>
                        {buckets.map((b) => {
                          const count = stats?.byClassBucket?.[cls]?.[b] || 0;
                          return (
                            <td key={b} className="py-2.5 px-3 text-center text-slate-600">
                              {fmt.number(count, lang)}
                            </td>
                          );
                        })}
                        <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                          {fmt.number(rowTotal, lang)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 font-bold bg-slate-50/50">
                    <td className="py-2.5 px-3 text-start text-slate-900">
                      {t('instructor.review.statsTotal')}
                    </td>
                    {buckets.map((b) => (
                      <td key={b} className="py-2.5 px-3 text-center text-slate-900">
                        {fmt.number(stats?.byBucket?.[b] || 0, lang)}
                      </td>
                    ))}
                    <td className="py-2.5 px-3 text-center text-sky-700">
                      {fmt.number(stats?.total || 0, lang)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Table 2: Source Distribution */}
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-base text-slate-900">
              {t('instructor.catalog.sourceDistributionTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-start">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-600">
                    <th className="py-2.5 px-3 text-start font-semibold">
                      {t('instructor.catalog.sourceCol')}
                    </th>
                    <th className="py-2.5 px-3 text-center font-semibold">
                      {t('instructor.catalog.countCol')}
                    </th>
                    <th className="py-2.5 px-3 text-center font-semibold">
                      {t('instructor.catalog.percentageCol')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sourceEntries.map(([sourceName, count]) => {
                    const pct = stats?.total ? count / stats.total : 0;
                    return (
                      <tr key={sourceName} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 font-mono text-xs text-slate-800">
                          <bdi>{sourceName}</bdi>
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-700 font-medium">
                          {fmt.number(count, lang)}
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-600 text-xs font-medium">
                          {fmt.percent(pct, lang)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
