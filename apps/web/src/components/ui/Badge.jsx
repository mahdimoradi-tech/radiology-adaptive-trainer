/**
 * @typedef {'default' | 'primary' | 'secondary' | 'neutral' | 'success' | 'warning' | 'danger' | 'outline'} BadgeVariant
 */

const BADGE_STYLES = {
  default: 'bg-sky-100 text-sky-800',
  primary: 'bg-sky-100 text-sky-800',
  secondary: 'bg-slate-100 text-slate-700',
  neutral: 'bg-slate-100 text-slate-700',
  success: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-rose-100 text-rose-800',
  outline: 'border border-slate-300 text-slate-700',
};

/**
 * Small badge/pill component
 * @param {Object} props
 * @param {BadgeVariant} [props.variant='default']
 * @param {string} [props.className='']
 * @param {React.ReactNode} props.children
 */
export function Badge({ variant = 'default', className = '', children, ...rest }) {
  const style = BADGE_STYLES[variant] || BADGE_STYLES.default;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${style} ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}
