import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: string;
  rightIcon?: string;
  isLoading?: boolean;
  fullWidth?: boolean;
  children?: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  isLoading,
  fullWidth,
  className = '',
  children,
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center font-medium transition-all duration-200 rounded-[var(--btn-radius)] focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]';
  
  const variantStyles: Record<ButtonVariant, string> = {
    primary: 'bg-primary text-white hover:bg-primary-hover focus:ring-primary/40 shadow-sm',
    secondary: 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 focus:ring-slate-200 shadow-sm',
    ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 focus:ring-slate-200',
    danger: 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500/40 shadow-sm',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-600/40 shadow-sm',
  };

  const sizeStyles: Record<ButtonSize, string> = {
    sm: 'h-[var(--btn-h-sm)] px-[var(--btn-px-sm)] text-xs gap-[calc(var(--btn-icon-gap)*0.75)]',
    md: 'h-[var(--btn-h-md)] px-[var(--btn-px-md)] text-sm gap-[var(--btn-icon-gap)]',
    lg: 'h-[var(--btn-h-lg)] px-[var(--btn-px-lg)] text-base gap-[var(--btn-icon-gap)]',
  };

  const iconSizeStyles: Record<ButtonSize, string> = {
    sm: 'text-[var(--icon-size-sm)]',
    md: 'text-[var(--icon-size-md)]',
    lg: 'text-[var(--icon-size-lg)]',
  };

  const combinedClasses = `
    ${baseStyles}
    ${variantStyles[variant]}
    ${sizeStyles[size]}
    ${fullWidth ? 'w-full' : ''}
    ${className}
  `.trim();

  return (
    <button
      className={combinedClasses}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : leftIcon && (
        <span className={`material-symbols-outlined ${iconSizeStyles[size]} shrink-0`}>
          {leftIcon}
        </span>
      )}
      
      {children && <span className="whitespace-nowrap">{children}</span>}
      
      {!isLoading && rightIcon && (
        <span className={`material-symbols-outlined ${iconSizeStyles[size]} shrink-0`}>
          {rightIcon}
        </span>
      )}
    </button>
  );
}
