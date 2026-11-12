import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCatalogStats, useCatalogImages } from '../../features/catalog/hooks.js';
import { CatalogStatsGrid } from '../../features/catalog/CatalogStatsGrid.jsx';
import { CatalogFilterBar } from '../../features/catalog/CatalogFilterBar.jsx';
import { CatalogTable } from '../../features/catalog/CatalogTable.jsx';
import { Alert, Button, Spinner } from '../../components/ui/index.js';

/**
 * Instructor catalog and difficulty monitoring page
 */
export function InstructorCatalogPage() {
  const { t } = useTranslation();

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    trueClass: undefined,
    bucket: undefined,
    source: undefined,
  });

  const {
    data: stats,
    isLoading: isStatsLoading,
    isError: isStatsError,
    refetch: refetchStats,
  } = useCatalogStats();

  const {
    data: imagesResult,
    isLoading: isImagesLoading,
    isError: isImagesError,
    refetch: refetchImages,
  } = useCatalogImages({
    page,
    pageSize: 20,
    trueClass: filters.trueClass,
    bucket: filters.bucket,
    source: filters.source,
  });

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    setPage(1);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  const sourceOptions = stats?.bySource ? Object.keys(stats.bySource).sort() : [];

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('instructor.catalog.title')}</h1>
        <p className="text-sm text-slate-600 mt-1">{t('instructor.catalog.subtitle')}</p>
      </div>

      {/* ADR 0005 Technical Note on Source/Age Confounding */}
      <Alert variant="warning" title={t('instructor.catalog.biasAlertTitle')}>
        <p className="text-sm leading-relaxed mt-1">{t('instructor.catalog.biasAlertText')}</p>
      </Alert>

      {/* Catalog Distribution Statistics */}
      {isStatsLoading ? (
        <div className="py-12 flex justify-center items-center">
          <Spinner size="lg" />
        </div>
      ) : isStatsError ? (
        <Alert variant="danger" title={t('instructor.catalog.errorLoadingStats')}>
          <div className="mt-2">
            <Button size="sm" variant="outline" onClick={() => refetchStats()}>
              {t('common.retry')}
            </Button>
          </div>
        </Alert>
      ) : (
        stats && <CatalogStatsGrid stats={stats} />
      )}

      {/* Filters and Paginated Images Table */}
      <section className="space-y-4" aria-labelledby="catalog-images-heading">
        <h2 id="catalog-images-heading" className="text-lg font-bold text-slate-900">
          {t('instructor.catalog.imagesTitle')}
        </h2>

        <CatalogFilterBar
          trueClass={filters.trueClass || ''}
          bucket={filters.bucket || ''}
          source={filters.source || ''}
          sourceOptions={sourceOptions}
          onChange={handleFilterChange}
        />

        {isImagesError ? (
          <Alert variant="danger" title={t('instructor.catalog.errorLoadingImages')}>
            <div className="mt-2">
              <Button size="sm" variant="outline" onClick={() => refetchImages()}>
                {t('common.retry')}
              </Button>
            </div>
          </Alert>
        ) : (
          <CatalogTable
            items={imagesResult?.items}
            meta={imagesResult?.meta}
            isLoading={isImagesLoading}
            onPageChange={handlePageChange}
          />
        )}
      </section>
    </div>
  );
}
