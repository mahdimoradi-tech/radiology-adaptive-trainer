/**
 * Reusable text input field with accessible error state
 * @param {Object} props
 * @param {string} [props.id]
 * @param {string} [props.name]
 * @param {string} [props.type='text']
 * @param {boolean|string} [props.error]
 * @param {boolean} [props.disabled=false]
 * @param {string} [props.className='']
 * @param {React.InputHTMLAttributes<HTMLInputElement>} [props]
 */
export function Input({
  id,
  name,
  type = 'text',
  error,
  disabled = false,
  className = '',
  ...rest
}) {
  const borderState = error
    ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 text-rose-900 placeholder:text-rose-300'
    : 'border-slate-300 focus:border-sky-500 focus:ring-sky-500/20 text-slate-900 placeholder:text-slate-400';

  return (
    <input
      id={id}
      name={name}
      type={type}
      disabled={disabled}
      aria-invalid={Boolean(error)}
      aria-describedby={error && id ? `${id}-error` : undefined}
      className={`w-full px-3 py-2 text-sm bg-white border rounded-lg shadow-xs transition-colors focus:outline-none focus:ring-3 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed text-start ${borderState} ${className}`}
      {...rest}
    />
  );
}
