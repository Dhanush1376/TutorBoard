/**
 * Button.jsx — TutorBoard Primitive Button
 * 
 * Shared button component consuming design tokens.
 * Variants: primary, secondary, ghost, danger
 * Sizes: sm, md, lg
 */
import React from 'react';

const VARIANTS = {
  primary: {
    base: 'bg-[var(--text-primary)] text-[var(--bg-primary)] shadow-premium',
    hover: 'hover:opacity-90',
    active: 'active:scale-[0.97]',
  },
  secondary: {
    base: 'bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-color)]',
    hover: 'hover:bg-[var(--bg-tertiary)] hover:border-[var(--border-strong)]',
    active: 'active:scale-[0.97]',
  },
  ghost: {
    base: 'bg-transparent text-[var(--text-secondary)]',
    hover: 'hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]',
    active: 'active:scale-[0.97]',
  },
  danger: {
    base: 'bg-red-500/10 text-red-500 border border-red-500/20',
    hover: 'hover:bg-red-500/20',
    active: 'active:scale-[0.97]',
  },
};

const SIZES = {
  sm: 'px-3 py-1.5 text-[12px] rounded-lg gap-1.5',
  md: 'px-4 py-2.5 text-[13px] rounded-xl gap-2',
  lg: 'px-6 py-3 text-[14px] rounded-2xl gap-2.5',
};

const Button = React.forwardRef(({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon: Icon,
  iconRight: IconRight,
  children,
  className = '',
  ...props
}, ref) => {
  const v = VARIANTS[variant] || VARIANTS.primary;
  const s = SIZES[size] || SIZES.md;

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center font-medium
        transition-all duration-200 select-none
        disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none
        ${v.base} ${v.hover} ${v.active} ${s} ${className}
      `.trim()}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-25" />
          <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      ) : Icon ? (
        <Icon size={size === 'sm' ? 14 : 16} strokeWidth={2} />
      ) : null}
      {children && <span>{children}</span>}
      {IconRight && !loading && <IconRight size={size === 'sm' ? 14 : 16} strokeWidth={2} />}
    </button>
  );
});

Button.displayName = 'Button';
export default Button;
