import { useTranslation } from 'react-i18next';

export function BankFilterBar({ filters, onFilterChange }) {
  const { t } = useTranslation();

  const handleStatusChange = (status) => {
    onFilterChange({
      ...filters,
      status: status === 'all' ? undefined : status,
      page: 1,
    });
  };

  const handleTypeChange = (e) => {
    const val = e.target.value;
    onFilterChange({
      ...filters,
      type: val === 'all' ? undefined : val,
      page: 1,
    });
  };

  const handleClassChange = (e) => {
    const val = e.target.value;
    onFilterChange({
      ...filters,
      trueClass: val === 'all' ? undefined : val,
      page: 1,
    });
  };

  const currentStatus = filters.status || 'pending_review';

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 mb-6 shadow-2xs flex flex-wrap items-center justify-between gap-4">
      {/* Status tabs */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
        <button
          type="button"
          onClick={() => handleStatusChange('pending_review')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            currentStatus === 'pending_review'
              ? 'bg-white text-amber-900 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {t('instructor.review.pending')}
        </button>

        <button
          type="button"
          onClick={() => handleStatusChange('approved')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            currentStatus === 'approved'
              ? 'bg-white text-emerald-900 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {t('instructor.review.approved')}
        </button>

        <button
          type="button"
          onClick={() => handleStatusChange('rejected')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            currentStatus === 'rejected'
              ? 'bg-white text-rose-900 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {t('instructor.review.rejected')}
        </button>

        <button
          type="button"
          onClick={() => handleStatusChange('all')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            !filters.status
              ? 'bg-white text-slate-900 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {t('instructor.review.all')}
        </button>
      </div>

      {/* Dropdowns */}
      <div className="flex items-center gap-3">
        {/* Type Filter */}
        <div className="flex items-center gap-1.5">
          <label htmlFor="filter-type" className="text-xs font-medium text-slate-600">
            {t('instructor.review.filterType')}:
          </label>
          <select
            id="filter-type"
            value={filters.type || 'all'}
            onChange={handleTypeChange}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          >
            <option value="all">{t('instructor.review.all')}</option>
            <option value="finding">{t('instructor.review.finding')}</option>
            <option value="distribution">{t('instructor.review.distribution')}</option>
            <option value="differential">{t('instructor.review.differential')}</option>
          </select>
        </div>

        {/* Class Filter */}
        <div className="flex items-center gap-1.5">
          <label htmlFor="filter-class" className="text-xs font-medium text-slate-600">
            {t('instructor.review.trueClass')}:
          </label>
          <select
            id="filter-class"
            value={filters.trueClass || 'all'}
            onChange={handleClassChange}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          >
            <option value="all">{t('instructor.review.all')}</option>
            <option value="covid19">COVID-19</option>
            <option value="pneumonia">Pneumonia</option>
            <option value="normal">Normal</option>
          </select>
        </div>
      </div>
    </div>
  );
}
