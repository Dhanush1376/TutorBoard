/**
 * IconButton.jsx — TutorBoard Primitive Icon Button
 * 
 * Square icon-only button for toolbars and action bars.
 * Replaces the ad-hoc ActionBtn pattern in Message.jsx.
 */
import React from 'react';

const SIZES = {
  sm: 'w-7 h-7',
  md: 'w-9 h-9',
  lg: 'w-11 h-11',
};

const IconButton = React.forwardRef(({
  icon: Icon,
  size = 'md',
  label,
  active = false,
  variant = 'ghost',
  className = '',
  ...props
}, ref) => {
  const s = SIZES[size] || SIZES.md;
  const iconSize = size === 'sm' ? 14 : size === 'lg' ? 20 : 16;

  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={`
        ${s} inline-flex items-center justify-center rounded-xl
        transition-all duration-200 select-none
        ${active
          ? 'bg-[var(--text-primary)] text-[var(--bg-primary)]'
          : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
        }
        active:scale-90
        disabled:opacity-30 disabled:cursor-not-allowed
        ${className}
      `.trim()}
      {...props}
    >
      {Icon && <Icon size={iconSize} strokeWidth={2} />}
    </button>
  );
});

IconButton.displayName = 'IconButton';
export default IconButton;
