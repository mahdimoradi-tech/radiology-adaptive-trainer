/**
 * Form field wrapper that renders an accessible label above and error/hint below
 * @param {Object} props
 * @param {string} props.id
 * @param {string} props.label
 * @param {string} [props.error]
 * @param {string} [props.hint]
 * @param {React.ReactNode} props.children
 * @param {string} [props.className='']
 */
export function Field({ id, label, error, hint, children, className = '' }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-semibold text-slate-800 text-start mb-1.5"
        >
          {label}
        </label>
      )}
      {children}
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-xs text-rose-700 font-medium text-start mt-1"
        >
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={`${id}-hint`} className="text-xs text-slate-600 text-start mt-1">
          {hint}
        </p>
      )}
    </div>
  );
}
