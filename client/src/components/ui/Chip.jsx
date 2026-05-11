/**
 * Chip.jsx — TutorBoard Primitive Chip
 * 
 * Removable tag for modes, files, contexts.
 * Replaces the inline activeMode and attachedFile chip patterns.
 */
import React from 'react';
import { X } from 'lucide-react';

const Chip = ({
  icon: Icon,
  label,
  active = false,
  onRemove,
  onClick,
  className = '',
  ...props
}) => {
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      onClick={onClick}
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl
        text-[10px] font-medium tracking-tight select-none
        transition-all duration-200
        ${active
          ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] shadow-md ring-1 ring-white/10'
          : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-color)]'
        }
        ${onClick ? 'cursor-pointer hover:opacity-80 active:scale-95' : ''}
        ${className}
      `.trim()}
      {...props}
    >
      {Icon && <Icon size={12} strokeWidth={2} className="opacity-90" />}
      {label && <span>{label}</span>}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="ml-0.5 p-0.5 hover:bg-white/20 rounded-full transition-colors"
          aria-label={`Remove ${label || 'chip'}`}
        >
          <X size={10} strokeWidth={3} />
        </button>
      )}
    </Component>
  );
};

export default Chip;
