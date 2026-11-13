/**
 * @typedef {'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'} ButtonVariant
 * @typedef {'sm' | 'md' | 'lg'} ButtonSize
 */

const VARIANT_CLASSES = {
  primary: 'bg-sky-600 text-white hover:bg-sky-700 focus-visible:ring-sky-500 shadow-sm',
  secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200 focus-visible:ring-slate-400',
  outline: 'border border-slate-300 text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-400',
  ghost: 'text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-400',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500 shadow-sm',
};

const SIZE_CLASSES = {
  sm: 'px-3 py-1.5 text-xs min-h-[32px]',
  md: 'px-4 py-2 text-sm min-h-[40px] h-10',
  lg: 'px-6 py-3 text-base min-h-[48px]',
};

/**
 * Reusable Button component supporting variants, sizes, and loading state
 * @param {Object} props
 * @param {ButtonVariant} [props.variant='primary']
 * @param {ButtonSize} [props.size='md']
 * @param {boolean} [props.isLoading=false]
 * @param {boolean} [props.disabled=false]
 * @param {string} [props.className='']
 * @param {React.ReactNode} props.children
 * @param {React.ButtonHTMLAttributes<HTMLButtonElement>} [props]
 */
export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  className = '',
  children,
  type = 'button',
  ...rest
}) {
  const base =
    'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none cursor-pointer';

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      className={`${base} ${VARIANT_CLASSES[variant] || VARIANT_CLASSES.primary} ${SIZE_CLASSES[size] || SIZE_CLASSES.md} ${className}`}
      {...rest}
    >
      {isLoading && (
        <span
          className="inline-block w-4 h-4 me-2 border-2 border-current border-t-transparent rounded-full animate-spin"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}
