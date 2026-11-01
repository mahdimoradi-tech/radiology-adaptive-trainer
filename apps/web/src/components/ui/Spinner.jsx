/**
 * @typedef {'sm' | 'md' | 'lg'} SpinnerSize
 */

const SPINNER_SIZES = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-3',
};

/**
 * Accessible SVG spinner component
 * @param {Object} props
 * @param {SpinnerSize} [props.size='md']
 * @param {string} [props.className='']
 * @param {string} [props.label='در حال بارگذاری…']
 */
export function Spinner({ size = 'md', className = '', label = 'در حال بارگذاری…' }) {
  const sizeClass = SPINNER_SIZES[size] || SPINNER_SIZES.md;

  return (
    <div role="status" className="inline-flex items-center justify-center">
      <span
        className={`inline-block border-sky-600 border-t-transparent rounded-full animate-spin ${sizeClass} ${className}`}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
