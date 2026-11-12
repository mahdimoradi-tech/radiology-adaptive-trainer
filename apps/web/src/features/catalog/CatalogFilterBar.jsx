import { useTranslation } from 'react-i18next';
import { Select } from '../../components/ui/index.js';

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
        <label htmlFor="filter-class" className="text-xs text-slate-700 font-semibold">
          {t('instructor.catalog.filterClass')}:
        </label>
        <Select
          id="filter-class"
          size="sm"
          value={trueClass}
          onChange={handleClassChange}
          className="w-32"
        >
          <option value="">{t('instructor.catalog.filterAll')}</option>
          <option value="covid19">{t('classes.covid19')}</option>
          <option value="pneumonia">{t('classes.pneumonia')}</option>
          <option value="normal">{t('classes.normal')}</option>
        </Select>
      </div>

      {/* Bucket filter */}
      <div className="flex items-center gap-2">
        <label htmlFor="filter-bucket" className="text-xs text-slate-700 font-semibold">
          {t('instructor.catalog.filterBucket')}:
        </label>
        <Select
          id="filter-bucket"
          size="sm"
          value={bucket}
          onChange={handleBucketChange}
          className="w-32"
        >
          <option value="">{t('instructor.catalog.filterAll')}</option>
          <option value="easy">{t('buckets.easy')}</option>
          <option value="medium">{t('buckets.medium')}</option>
          <option value="hard">{t('buckets.hard')}</option>
        </Select>
      </div>

      {/* Source filter */}
      <div className="flex items-center gap-2">
        <label htmlFor="filter-source" className="text-xs text-slate-700 font-semibold">
          {t('instructor.catalog.filterSource')}:
        </label>
        <Select
          id="filter-source"
          size="sm"
          value={source}
          onChange={handleSourceChange}
          className="w-36"
        >
          <option value="">{t('instructor.catalog.filterAll')}</option>
          {sourceOptions.map((src) => (
            <option key={src} value={src}>
              {src}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
