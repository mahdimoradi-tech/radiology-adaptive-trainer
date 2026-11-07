import { useTranslation } from 'react-i18next';

/**
 * Filter bar for catalog image table
 *
 * @param {Object} props
 * @param {string} props.trueClass
 * @param {string} props.bucket
 * @param {string} props.source
 * @param {string[]} [props.sourceOptions=[]]
 * @param {(filters: { trueClass?: string, bucket?: string, source?: string }) => void} props.onChange
 */
export function CatalogFilterBar({
  trueClass = '',
  bucket = '',
  source = '',
  sourceOptions = [],
  onChange,
}) {
  const { t } = useTranslation();

  const handleClassChange = (e) => {
    onChange({
      trueClass: e.target.value || undefined,
      bucket: bucket || undefined,
      source: source || undefined,
    });
  };

  const handleBucketChange = (e) => {
    onChange({
      trueClass: trueClass || undefined,
      bucket: e.target.value || undefined,
      source: source || undefined,
    });
  };

  const handleSourceChange = (e) => {
    onChange({
      trueClass: trueClass || undefined,
      bucket: bucket || undefined,
      source: e.target.value || undefined,
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
      <span className="text-xs font-bold text-slate-700">
        {t('instructor.catalog.filtersTitle')}:
      </span>

      {/* Class filter */}
      <div className="flex items-center gap-2">
        <label htmlFor="filter-class" className="text-xs text-slate-600 font-medium">
          {t('instructor.catalog.filterClass')}:
        </label>
        <select
          id="filter-class"
          value={trueClass}
          onChange={handleClassChange}
          className="text-xs bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
        >
          <option value="">{t('instructor.catalog.filterAll')}</option>
          <option value="covid19">{t('classes.covid19')}</option>
          <option value="pneumonia">{t('classes.pneumonia')}</option>
          <option value="normal">{t('classes.normal')}</option>
        </select>
      </div>

      {/* Bucket filter */}
      <div className="flex items-center gap-2">
        <label htmlFor="filter-bucket" className="text-xs text-slate-600 font-medium">
          {t('instructor.catalog.filterBucket')}:
        </label>
        <select
          id="filter-bucket"
          value={bucket}
          onChange={handleBucketChange}
          className="text-xs bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
        >
          <option value="">{t('instructor.catalog.filterAll')}</option>
          <option value="easy">{t('buckets.easy')}</option>
          <option value="medium">{t('buckets.medium')}</option>
          <option value="hard">{t('buckets.hard')}</option>
        </select>
      </div>

      {/* Source filter */}
      <div className="flex items-center gap-2">
        <label htmlFor="filter-source" className="text-xs text-slate-600 font-medium">
          {t('instructor.catalog.filterSource')}:
        </label>
        <select
          id="filter-source"
          value={source}
          onChange={handleSourceChange}
          className="text-xs bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
        >
          <option value="">{t('instructor.catalog.filterAll')}</option>
          {sourceOptions.map((src) => (
            <option key={src} value={src}>
              {src}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
