import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Check, Info } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import API from '../../services/api';

export { SECTIONS, API_URL } from './SettingsConstants';

/*
 * Settings UI kit. Same language as the marketing site: Geist, hairline
 * borders, mono eyebrows, ink for primary actions and amber only for the
 * live/selected state.
 */

const EASE = [0.22, 1, 0.36, 1];

export const SectionTitle = ({ children, style = {}, action }) => (
  <div className="mb-2 flex items-center justify-between gap-3 px-0.5" style={style}>
    <h3 className="text-[11.5px] font-medium text-[var(--text-tertiary)]">{children}</h3>
    {action}
  </div>
);

export const SettingsGroup = ({ children, className = '', style = {} }) => (
  <div
    className={`overflow-visible rounded-xl border border-[var(--st-line-strong)] bg-[var(--st-surface)] [&>*+*]:border-t [&>*+*]:border-[var(--st-line)] ${className}`}
    style={style}
  >
    {children}
  </div>
);

const TONES = {
  blue: 'bg-blue-500/12 border-blue-500/25 text-blue-500 dark:text-blue-400',
  purple: 'bg-sky-500/12 border-sky-500/25 text-sky-500 dark:text-sky-400',
  amber: 'bg-amber-500/12 border-amber-500/25 text-amber-500 dark:text-amber-400',
  emerald: 'bg-emerald-500/12 border-emerald-500/25 text-emerald-500 dark:text-emerald-400',
  rose: 'bg-rose-500/12 border-rose-500/25 text-rose-500 dark:text-rose-400',
  danger: 'bg-red-500/15 border-red-500/25 text-red-500',
  neutral: 'border-[var(--st-line)] bg-[var(--st-fill)] text-[var(--text-secondary)]',
};

export const RowIcon = ({ icon: Icon, danger, tone }) => {
  const chosenTone = danger ? 'danger' : tone || 'neutral';
  const toneClasses = TONES[chosenTone] || TONES.neutral;
  return (
    <span
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-[8px] border shadow-xs transition-colors ${toneClasses}`}
    >
      <Icon size={14} strokeWidth={2} />
    </span>
  );
};

/** Settings row: on mobile and desktop keeps a balanced single-line layout like iOS grouped settings */
export const SettingsRow = ({ icon, iconTone, label, description, rightElement, danger, onClick, children }) => {
  const clickable = !!onClick;
  const Tag = clickable ? 'button' : 'div';
  return (
    <Tag
      type={clickable ? 'button' : undefined}
      onClick={onClick || undefined}
      className={`flex w-full items-center justify-between gap-3 px-3.5 sm:px-4 py-2.5 sm:py-3 text-left first:rounded-t-xl last:rounded-b-xl transition-colors ${
        clickable ? 'cursor-pointer hover:bg-[var(--st-fill)]' : ''
      }`}
    >
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3 shrink-0 sm:shrink">
        {icon && <RowIcon icon={icon} danger={danger} tone={iconTone} />}
        <div className="min-w-0">
          <div className={`text-[13px] font-medium leading-snug tracking-[-0.01em] ${danger ? 'text-red-500' : 'text-[var(--text-primary)]'}`}>{label}</div>
          {description && <div className="mt-0.5 text-[11px] leading-[1.4] text-[var(--text-tertiary)]">{description}</div>}
          {children}
        </div>
      </div>
      {(rightElement || clickable) && (
        <div className="ml-auto flex min-w-0 items-center justify-end gap-2 shrink">
          {rightElement}
          {clickable && !rightElement && <ChevronRight size={15} className="text-[var(--text-tertiary)] shrink-0" />}
        </div>
      )}
    </Tag>
  );
};

export const AppleToggle = ({ value, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={!!value}
    aria-label={label}
    onClick={(e) => {
      e.stopPropagation();
      onChange(!value);
    }}
    className={`relative inline-flex h-[22px] w-[38px] shrink-0 cursor-pointer items-center rounded-full p-[2px] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
      value ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.35)]' : 'bg-[var(--st-fill-strong)] ring-1 ring-inset ring-[var(--st-line-strong)]'
    }`}
  >
    <motion.span
      initial={false}
      animate={{ x: value ? 16 : 0 }}
      transition={{ type: 'spring', stiffness: 700, damping: 40 }}
      className={`block h-[18px] w-[18px] rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.3)] ${value ? 'bg-white' : 'bg-zinc-200 dark:bg-zinc-300'}`}
    />
  </button>
);

export const fieldClass =
  'h-8 w-full rounded-xl sm:rounded-full border border-[var(--st-line-strong)] bg-[var(--st-fill)] hover:bg-[var(--st-fill-strong)] focus:bg-[var(--bg-primary)] px-2.5 sm:px-3 text-[12.5px] text-[var(--text-secondary)] focus:text-[var(--text-primary)] outline-none transition-[border-color,box-shadow,background-color,color] placeholder:text-[var(--text-tertiary)] focus:border-amber-500/60 focus:shadow-[0_0_0_3px_rgba(245,158,11,0.15)] disabled:cursor-not-allowed disabled:opacity-50';

export const RightInlineInput = ({ value, onChange, placeholder, type = 'text', width, disabled = false }) => (
  <input
    type={type}
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    disabled={disabled}
    onClick={(e) => e.stopPropagation()}
    className={`${fieldClass} max-w-[150px] sm:max-w-none sm:w-[220px] text-right sm:text-left`}
    style={width ? { maxWidth: width } : undefined}
  />
);

export const PremiumDropdown = ({ value, onChange, options, align = 'right', styleContext = 'inline' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const close = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setIsOpen(false);
    };
    const esc = (e) => e.key === 'Escape' && setIsOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, []);

  const selected = options.find((o) => o.value === value) || options[0];
  const form = styleContext === 'form';

  return (
    <div ref={wrapperRef} className={`relative ${form ? 'w-full' : 'inline-block'}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((o) => !o);
        }}
        className={`${fieldClass} flex cursor-pointer items-center justify-between gap-1.5 sm:gap-2 text-left ${
          form ? 'w-full' : 'w-full max-w-[150px] sm:max-w-none sm:min-w-[150px]'
        } ${
          isOpen ? 'border-[var(--text-tertiary)] shadow-[0_0_0_3px_var(--mk-accent-soft)]' : ''
        }`}
      >
        <span className={`truncate text-right sm:text-left flex-1 ${selected?.value === '' ? 'text-[var(--text-tertiary)]' : ''}`}>{selected?.label}</span>
        <ChevronDown size={13} className={`shrink-0 text-amber-500/80 dark:text-amber-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            role="listbox"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: EASE }}
            className={`absolute top-[calc(100%+6px)] z-[100] max-h-[280px] min-w-[190px] max-w-[calc(100vw-32px)] sm:max-w-none sm:min-w-full overflow-y-auto rounded-[14px] border border-[var(--st-line-strong)] bg-[var(--bg-primary)] p-1.5 shadow-[0_18px_44px_-12px_rgba(0,0,0,0.35)] ${
              align === 'left' ? 'left-0' : 'right-0'
            }`}
          >
            {options.map((opt, idx) => {
              const on = value === opt.value;
              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  key={`${opt.value}-${idx}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`flex w-full cursor-pointer items-center justify-between gap-4 whitespace-nowrap rounded-[9px] px-3 py-2 text-left text-[13px] transition-colors ${
                    on ? 'bg-[var(--st-fill-strong)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--st-fill)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {on && <Check size={14} strokeWidth={2.4} className="text-[var(--mk-accent)] shrink-0" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const RightInlineSelect = (props) => <PremiumDropdown {...props} align="right" styleContext="inline" />;

const pill = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium';

export const StatusBadge = ({ isValid, isActive }) => {
  if (!isActive) return <span className={`${pill} bg-[var(--st-fill-strong)] text-[var(--text-tertiary)]`}>Off</span>;
  if (!isValid)
    return (
      <span className={`${pill} bg-amber-500/10 text-amber-600 dark:text-amber-400`}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        Invalid
      </span>
    );
  return (
    <span className={`${pill} bg-emerald-500/10 text-emerald-600 dark:text-emerald-400`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      Active
    </span>
  );
};

export const ValidationError = ({ message }) => {
  if (!message) return null;
  const lines = message.split('\n');
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-red-500/15 bg-red-500/[0.05] px-4 py-3 text-[12.5px] leading-[1.6] text-red-500"
    >
      <div className={`flex items-center gap-2 font-medium ${lines.length > 1 ? 'mb-1.5' : ''}`}>
        <Info size={14} strokeWidth={2.2} /> {lines[0]}
      </div>
      {lines.slice(1).map((l, i) => (
        <div key={i} className="pl-[22px] opacity-80">
          {l}
        </div>
      ))}
    </motion.div>
  );
};

export const ContextButton = ({ children, onClick, danger, icon: Icon }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex w-full cursor-pointer items-center gap-2.5 sm:gap-3 px-3.5 sm:px-4 py-2.5 sm:py-3 text-left text-[13px] font-medium tracking-[-0.01em] transition-colors first:rounded-t-xl last:rounded-b-xl ${
      danger ? 'text-red-500 hover:bg-red-500/[0.05]' : 'text-[var(--text-primary)] hover:bg-[var(--st-fill)]'
    }`}
  >
    {Icon && <RowIcon icon={Icon} danger={danger} />}
    <span className="flex-1">{children}</span>
    <ChevronRight size={15} className={danger ? 'text-red-500/60' : 'text-[var(--text-tertiary)]'} />
  </button>
);

export const Button = ({ children, variant = 'primary', className = '', ...rest }) => {
  const styles = {
    primary: 'bg-[var(--text-primary)] text-[var(--bg-primary)] hover:opacity-90',
    secondary: 'border border-[var(--st-line-strong)] text-[var(--text-primary)] hover:bg-[var(--st-fill)]',
    danger: 'bg-red-500 text-white hover:bg-red-600',
    ghost: 'text-[var(--text-secondary)] hover:bg-[var(--st-fill)] hover:text-[var(--text-primary)]',
  };
  return (
    <button
      type="button"
      className={`inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 text-[13px] font-medium transition-[opacity,background-color,color] disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
};

export const DialogModal = ({ title, description, children, primaryAction, primaryLabel, primaryDanger, loading, onClose }) => (
  <div className="fixed inset-0 z-[100010] flex items-center justify-center p-5 font-sans" style={{ isolation: 'isolate' }}>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-black/50 backdrop-blur-md"
      onClick={!loading ? onClose : undefined}
    />
    <motion.div
      role="dialog"
      aria-modal="true"
      initial={{ opacity: 0, scale: 0.97, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, y: 12 }}
      transition={{ duration: 0.25, ease: EASE }}
      className="relative w-full max-w-[420px] rounded-[22px] border border-[var(--st-line-strong)] bg-[var(--bg-primary)] p-7 text-[var(--text-primary)] shadow-[0_40px_100px_-30px_rgba(0,0,0,0.6)]"
    >
      <h2 className="text-[20px] font-medium tracking-[-0.03em]">{title}</h2>
      {description && <p className="mt-2 text-[13.5px] leading-[1.6] text-[var(--text-secondary)]">{description}</p>}
      {children && <div className="mt-5">{children}</div>}
      <div className="mt-6 flex gap-2">
        <Button variant="secondary" onClick={onClose} disabled={loading} className="flex-1">
          Cancel
        </Button>
        <Button variant={primaryDanger ? 'danger' : 'primary'} onClick={primaryAction} disabled={loading} className="flex-1">
          {loading ? 'Working…' : primaryLabel}
        </Button>
      </div>
    </motion.div>
  </div>
);

export const useSettingsSync = () => {
  const { user } = useAuth();
  const timeoutRef = useRef(null);

  const syncSettings = (categoryOrObject, newValues, topLevel = {}) => {
    if (!user) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(async () => {
      try {
        const payload = { ...topLevel };
        if (typeof categoryOrObject === 'string') payload.settings = { [categoryOrObject]: newValues };
        else payload.settings = categoryOrObject;
        await API.put('/api/user/settings', payload);
      } catch (err) {
        console.error('Settings sync failed:', err);
      }
    }, 400);
  };

  return syncSettings;
};

export function Avatar({ user, size = 40, className = '' }) {
  const [imgError, setImgError] = useState(false);
  const name = user?.name || '';
  const initials = name ? name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() : '?';
  return (
    <span
      className={`grid shrink-0 select-none place-items-center overflow-hidden bg-[var(--text-primary)] font-medium tracking-[-0.02em] text-[var(--bg-primary)] ${className}`}
      style={{ width: size, height: size, borderRadius: size * 0.32, fontSize: size * 0.38 }}
    >
      {user?.avatar && !user.isGuest && !imgError ? (
        <img src={user.avatar} alt="" className="h-full w-full object-cover" onError={() => setImgError(true)} />
      ) : (
        initials
      )}
    </span>
  );
}
