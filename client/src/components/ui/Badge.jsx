/**
 * Badge.jsx — TutorBoard Primitive Badge
 * 
 * Status indicators, counts, and mode labels.
 * Replaces inline badge patterns across components.
 */
import React from 'react';

const VARIANTS = {
  default: 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-[var(--border-color)]',
  success: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  warning: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  danger:  'bg-red-500/10 text-red-500 border-red-500/20',
  info:    'bg-blue-500/10 text-blue-500 border-blue-500/20',
  brand:   'bg-[var(--text-primary)] text-[var(--bg-primary)] border-transparent',
};

const Badge = ({
  variant = 'default',
  size = 'sm',
  dot = false,
  icon: Icon,
  children,
  className = '',
  ...props
}) => {
  const v = VARIANTS[variant] || VARIANTS.default;
  const sizeClass = size === 'xs'
    ? 'text-[9px] px-1.5 py-0.5 gap-1'
    : size === 'sm'
      ? 'text-[10px] px-2 py-0.5 gap-1.5'
      : 'text-[11px] px-2.5 py-1 gap-1.5';

  return (
    <span
      className={`
        inline-flex items-center font-bold uppercase tracking-[0.05em]
        rounded-full border select-none leading-none
        ${v} ${sizeClass} ${className}
      `.trim()}
      {...props}
    >
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full bg-current flex-shrink-0"
          aria-hidden="true"
        />
      )}
      {Icon && <Icon size={size === 'xs' ? 10 : 12} strokeWidth={2.5} />}
      {children}
    </span>
  );
};

export default Badge;
