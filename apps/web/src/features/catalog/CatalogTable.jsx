import { useTranslation } from 'react-i18next';
import { Badge, Button, XrayImage } from '../../components/ui/index.js';
import { fmt } from '../../lib/format.js';

/**
 * Paginated table of images for instructors
 *
 * @param {Object} props
 * @param {import('@radiology/contracts').CatalogImageAdmin[]} props.items
 * @param {{ total: number, page: number, pageSize: number, totalPages: number }} props.meta
 * @param {boolean} [props.isLoading=false]
 * @param {(page: number) => void} props.onPageChange
 */
export function CatalogTable({ items = [], meta, isLoading = false, onPageChange }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const bucketBadgeVariant = (bucket) => {
    switch (bucket) {
      case 'easy':
        return 'success';
      case 'medium':
        return 'warning';
      case 'hard':
        return 'danger';
      default:
        return 'secondary';
    }
  };

  const classBadgeVariant = (cls) => {
    switch (cls) {
      case 'covid19':
        return 'warning';
      case 'pneumonia':
        return 'primary';
      case 'normal':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  if (isLoading) {
    return (
      <div className="py-12 text-center text-sm text-slate-500">
        {t('instructor.catalog.loadingImages')}
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg">
        {t('instructor.catalog.emptyImages')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white shadow-2xs">
        <table className="w-full text-sm text-start">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
              <th className="py-2.5 px-3 text-center font-medium w-16">
                {t('instructor.catalog.colPreview')}
              </th>
              <th className="py-2.5 px-3 text-start font-medium">
                {t('instructor.catalog.colFilename')}
              </th>
              <th className="py-2.5 px-3 text-center font-medium">
                {t('instructor.catalog.colClass')}
              </th>
              <th className="py-2.5 px-3 text-center font-medium">
                {t('instructor.catalog.colBucket')}
              </th>
              <th className="py-2.5 px-3 text-center font-medium">
                {t('instructor.catalog.colDifficulty')}
              </th>
              <th className="py-2.5 px-3 text-center font-medium">
                {t('instructor.catalog.colConfusedWith')}
              </th>
              <th className="py-2.5 px-3 text-start font-medium">
                {t('instructor.catalog.colSource')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                {/* Thumbnail */}
                <td className="py-2 px-3 text-center">
                  <div className="w-12 h-12 mx-auto">
                    <XrayImage
                      src={item.url}
                      alt={item.filename}
                      aspectRatio="aspect-square"
                      className="rounded border border-slate-200"
                    />
                  </div>
                </td>

                {/* Filename & ID */}
                <td className="py-2 px-3">
                  <div className="font-mono text-xs text-slate-800 break-all">
                    <bdi>{item.filename}</bdi>
                  </div>
                  <div className="text-[11px] text-slate-600 font-mono mt-0.5">
                    <bdi>{item.id}</bdi>
                  </div>
                </td>

                {/* True class */}
                <td className="py-2 px-3 text-center">
                  <Badge variant={classBadgeVariant(item.trueClass)}>
                    {t(`classes.${item.trueClass}`)}
                  </Badge>
                </td>

                {/* Bucket */}
                <td className="py-2 px-3 text-center">
                  <Badge variant={bucketBadgeVariant(item.bucket)}>
                    {t(`buckets.${item.bucket}`)}
                  </Badge>
                </td>

                {/* Difficulty */}
                <td className="py-2 px-3 text-center font-mono text-xs text-slate-700">
                  {Number(item.difficulty).toFixed(3)}
                </td>

                {/* Confused with */}
                <td className="py-2 px-3 text-center">
                  <Badge variant="outline">{t(`classes.${item.confusedWith}`)}</Badge>
                </td>

                {/* Source */}
                <td className="py-2 px-3 font-mono text-xs text-slate-600">
                  <bdi>{item.source}</bdi>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-slate-500">
            {t('instructor.catalog.pagination', {
              current: meta.page,
              total: meta.totalPages,
              count: fmt.number(meta.total, lang),
            })}
          </span>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page <= 1}
              onClick={() => onPageChange(meta.page - 1)}
            >
              {t('instructor.catalog.prevPage')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={meta.page >= meta.totalPages}
              onClick={() => onPageChange(meta.page + 1)}
            >
              {t('instructor.catalog.nextPage')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
