/**
 * Accessible Empty State component for displaying friendly zero-data states (rule A8)
 *
 * @param {Object} props
 * @param {string} props.title
 * @param {string} [props.description]
 * @param {React.ReactNode} [props.icon]
 * @param {React.ReactNode} [props.action]
 * @param {string} [props.className='']
 */
export function EmptyState({ title, description, icon, action, className = '' }) {
  return (
    <div
      className={`text-center py-12 px-4 space-y-3 flex flex-col items-center justify-center ${className}`}
    >
      {icon && <div className="text-slate-500 mb-1">{icon}</div>}
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      {description && <p className="text-sm text-slate-600 max-w-md">{description}</p>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
