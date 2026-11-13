/**
 * Accessible Select component with custom chevron icon, appearance-none,
 * and logical RTL-safe padding (rule A4).
 *
 * @param {Object} props
 * @param {string} [props.id]
 * @param {string|number} [props.value]
 * @param {(e: React.ChangeEvent<HTMLSelectElement>) => void} [props.onChange]
 * @param {boolean} [props.disabled=false]
 * @param {'sm'|'md'} [props.size='md']
 * @param {boolean|string} [props.error]
 * @param {string} [props.className='']
 * @param {React.ReactNode} props.children
 * @param {React.SelectHTMLAttributes<HTMLSelectElement>} [props]
 */
export function Select({
  id,
  value,
  onChange,
  disabled = false,
  size = 'md',
  error,
  className = '',
  children,
  ...rest
}) {
  const sizeClasses =
    size === 'sm'
      ? 'py-1.5 ps-3 pe-8 text-xs min-h-[32px]'
      : 'py-2 ps-3 pe-10 text-sm h-10 min-h-[40px]';

  const borderClasses = error
    ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 text-rose-900'
    : 'border-slate-300 focus:border-sky-500 focus:ring-sky-500/20 text-slate-800';

  return (
    <div className="relative inline-block w-full">
      <select
        id={id}
        value={value}
        onChange={onChange}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error && id ? `${id}-error` : undefined}
        className={`w-full appearance-none rounded-lg border bg-white shadow-2xs transition-colors focus:outline-none focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed cursor-pointer ${sizeClasses} ${borderClasses} ${className}`}
        {...rest}
      >
        {children}
      </select>
      <div className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-slate-500">
        <svg
          className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}
