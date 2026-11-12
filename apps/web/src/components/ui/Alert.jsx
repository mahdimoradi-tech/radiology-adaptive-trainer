/**
 * @typedef {'info' | 'success' | 'warning' | 'error' | 'danger'} AlertVariant
 */

const ALERT_STYLES = {
  info: 'bg-sky-50 border-sky-200 text-sky-800',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  error: 'bg-rose-50 border-rose-200 text-rose-800',
  danger: 'bg-rose-50 border-rose-200 text-rose-800',
};

/**
 * Accessible alert banner
 * @param {Object} props
 * @param {AlertVariant} [props.variant='info']
 * @param {string} [props.title]
 * @param {React.ReactNode} props.children
 * @param {string} [props.className='']
 */
export function Alert({ variant = 'info', title, children, className = '' }) {
  const style = ALERT_STYLES[variant] || ALERT_STYLES.info;

  return (
    <div
      role="alert"
      className={`border rounded-lg p-3 text-sm text-start flex flex-col gap-1 ${style} ${className}`}
    >
      {title && <span className="font-semibold">{title}</span>}
      <div>{children}</div>
    </div>
  );
}
