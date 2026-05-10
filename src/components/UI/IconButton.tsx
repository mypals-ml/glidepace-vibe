import React from 'react';

type IconButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type IconButtonSize = 'xs' | 'sm' | 'md' | 'lg';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  isLoading?: boolean;
  iconClassName?: string;
  'aria-label': string; // Enforce aria-label for accessibility
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({
  icon,
  variant = 'secondary',
  size = 'md',
  isLoading,
  iconClassName = '',
  className = '',
  disabled,
  ...props
}, ref) {
  const baseStyles = 'inline-flex items-center justify-center transition-all duration-200 rounded-[var(--btn-radius)] focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]';
  
  const variantStyles: Record<IconButtonVariant, string> = {
    primary: 'bg-primary text-white hover:bg-primary-hover focus:ring-primary/40 shadow-sm',
    secondary: 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 focus:ring-slate-200 shadow-sm',
    ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 focus:ring-slate-200 border-none',
    danger: 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500/40 shadow-sm',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-600/40 shadow-sm',
  };

  const sizeStyles: Record<IconButtonSize, string> = {
    xs: 'h-6 w-6',
    sm: 'h-[var(--btn-h-sm)] w-[var(--btn-h-sm)]',
    md: 'h-[var(--btn-h-md)] w-[var(--btn-h-md)]',
    lg: 'h-[var(--btn-h-lg)] w-[var(--btn-h-lg)]',
  };

  const iconSizeStyles: Record<IconButtonSize, string> = {
    xs: 'text-[14px]',
    sm: 'text-[var(--icon-size-sm)]',
    md: 'text-[var(--icon-size-md)]',
    lg: 'text-[var(--icon-size-lg)]',
  };

  const combinedClasses = `
    ${baseStyles}
    ${variantStyles[variant]}
    ${sizeStyles[size]}
    ${className}
  `.trim();

  return (
    <button
      ref={ref}
      className={combinedClasses}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : (
        <span className={`material-symbols-outlined ${iconSizeStyles[size]} ${iconClassName} shrink-0`}>
          {icon}
        </span>
      )}
    </button>
  );
});
