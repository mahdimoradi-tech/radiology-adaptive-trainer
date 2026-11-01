/**
 * Card container component
 */
export function Card({ className = '', children, ...rest }) {
  return (
    <div
      className={`bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className = '', children, ...rest }) {
  return (
    <div className={`p-5 pb-3 ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({ className = '', children, ...rest }) {
  return (
    <h3
      className={`text-base font-semibold text-slate-900 leading-snug text-start ${className}`}
      {...rest}
    >
      {children}
    </h3>
  );
}

export function CardDescription({ className = '', children, ...rest }) {
  return (
    <p className={`text-xs text-slate-500 mt-1 text-start ${className}`} {...rest}>
      {children}
    </p>
  );
}

export function CardContent({ className = '', children, ...rest }) {
  return (
    <div className={`p-5 pt-0 ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({ className = '', children, ...rest }) {
  return (
    <div
      className={`p-5 pt-0 flex items-center justify-between border-t border-slate-100 mt-4 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
