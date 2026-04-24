import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronRight, Check, Zap, Lock, 
  User, Shield, Palette, Key, Eye, Info 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

import { BASE_URL as API_URL_IMPORT } from '../../services/api';
export const API_URL = API_URL_IMPORT;

export const SECTIONS = [
  { id: 'general', label: 'General', icon: User },
  { id: 'account', label: 'Account', icon: Shield },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'ai', label: 'API Configuration', icon: Key },
  { id: 'about', label: 'About', icon: Info },
];

export const SectionTitle = ({ children, style = {} }) => (
  <h2 style={{
    fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em',
    color: 'var(--text-tertiary)', textTransform: 'uppercase',
    marginBottom: '8px', marginLeft: '16px',
    fontFamily: '"Geist", sans-serif',
    opacity: 0.8,
    ...style
  }}>{children}</h2>
);

export const SettingsGroup = ({ children }) => (
  <div className="settings-group" style={{
    background: 'var(--bg-secondary)',
    borderRadius: '14px',
    marginBottom: '20px',
    border: '1px solid var(--border-color)',
    boxShadow: '0 4px 16px rgba(0,0,0,0.02)',
    padding: '2px 0',
    overflow: 'hidden'
  }}>
    <style>{`
      .settings-group > *:first-child { border-top-left-radius: 20px; border-top-right-radius: 20px; }
      .settings-group > *:last-child { border-bottom-left-radius: 20px; border-bottom-right-radius: 20px; border-bottom: none !important; }
    `}</style>
    {children}
  </div>
);

export const SettingsRow = ({ icon: Icon, label, description, rightElement, borderBottom = true, danger, onClick }) => {
  const isClickable = !!onClick;
  return (
    <div
      onClick={onClick || undefined}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px',
        borderBottom: borderBottom ? '1px solid var(--border-color)' : 'none',
        background: 'transparent',
        cursor: isClickable ? 'pointer' : 'default',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      onMouseEnter={isClickable ? e => e.currentTarget.style.background = 'var(--bg-tertiary)' : undefined}
      onMouseLeave={isClickable ? e => e.currentTarget.style.background = 'transparent' : undefined}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flex: 1 }}>
        {Icon && (
          <div style={{
            width: '26px', height: '26px', borderRadius: '7px',
            background: danger ? 'rgba(239,68,68,0.1)' : 'var(--text-primary)',
            color: danger ? '#ef4444' : 'var(--bg-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            boxShadow: danger ? 'none' : '0 1px 4px rgba(0,0,0,0.06)',
          }}>
            <Icon size={14} strokeWidth={2.5} />
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: '13.5px', fontWeight: 600,
            color: danger ? '#ef4444' : 'var(--text-primary)',
            fontFamily: '"Geist", sans-serif',
            letterSpacing: '-0.01em',
          }}>{label}</div>
          {description && (
            <div style={{
              fontSize: '11.5px', color: 'var(--text-tertiary)',
              marginTop: '2px', lineHeight: 1.4,
              fontFamily: '"Geist", sans-serif',
              fontWeight: 500,
            }}>{description}</div>
          )}
        </div>
      </div>
      {(rightElement || (isClickable && !rightElement)) && (
        <div style={{ marginLeft: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {rightElement}
          {isClickable && !rightElement && <ChevronRight size={18} style={{ color: 'var(--text-tertiary)', opacity: 0.5 }} />}
        </div>
      )}
    </div>
  );
};

export const AppleToggle = ({ value, onChange }) => (
  <button
    onClick={() => onChange(!value)}
    style={{
      width: '36px', height: '20px', borderRadius: '10px',
      background: value ? '#10b981' : 'var(--bg-tertiary)',
      border: `none`,
      position: 'relative', cursor: 'pointer',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      padding: '0 2px',
      boxSizing: 'border-box',
      boxShadow: value ? '0 2px 6px rgba(16,185,129,0.2)' : 'inset 0 1px 2px rgba(0,0,0,0.05)',
    }}
  >
    <motion.div
      initial={false}
      animate={{ x: value ? 16 : 0 }}
      transition={{ type: 'spring', stiffness: 600, damping: 35 }}
      style={{
        width: '16px', height: '16px', borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1
      }}
    />
  </button>
);

export const RightInlineInput = ({ value, onChange, placeholder, type = 'text', width = '220px', disabled = false }) => (
  <input
    type={type} value={value} onChange={onChange}
    placeholder={placeholder} disabled={disabled}
    style={{
      width, padding: '6px 10px', background: 'var(--bg-tertiary)33', border: 'none',
      borderRadius: '6px',
      color: disabled ? 'var(--text-tertiary)' : 'var(--text-primary)',
      fontSize: '13px', fontWeight: 600, fontFamily: '"Geist", sans-serif',
      outline: 'none', textAlign: 'right', cursor: disabled ? 'not-allowed' : 'text',
      transition: 'all 0.2s',
    }}
    onFocus={e => (e.target.style.background = 'var(--bg-tertiary)66', e.target.style.color = 'var(--accent-primary)')}
    onBlur={e => (e.target.style.background = 'var(--bg-tertiary)33', e.target.style.color = disabled ? 'var(--text-tertiary)' : 'var(--text-primary)')}
  />
);

export const PremiumDropdown = ({ value, onChange, options, align = 'right', styleContext = 'inline' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value) || options[0];
  const basePadding = styleContext === 'form' ? '14px 18px' : '8px 14px';
  const baseBg = styleContext === 'form' ? 'var(--bg-secondary)' : 'var(--bg-tertiary)33';
  const hoverBg = styleContext === 'form' ? 'var(--bg-tertiary)' : 'var(--bg-tertiary)66';
  const borderCol = styleContext === 'form' ? 'var(--border-color)' : 'transparent';

  return (
    <div ref={wrapperRef} style={{ position: 'relative', display: 'inline-block', width: styleContext === 'form' ? '100%' : 'auto' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
          padding: basePadding, backgroundColor: isOpen ? hoverBg : baseBg,
          border: `1.2px solid ${isOpen ? 'var(--accent-primary)' : borderCol}`,
          borderRadius: styleContext === 'form' ? '12px' : '8px',
          color: styleContext === 'form' ? 'var(--text-primary)' : 'var(--text-primary)',
          fontSize: '13px', fontWeight: 600, cursor: 'pointer', outline: 'none',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)', minWidth: '130px',
        }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = hoverBg}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = isOpen ? hoverBg : baseBg}
      >
        <span style={{ opacity: 0.9 }}>{selectedOption?.label}</span>
        <ChevronRight size={14} strokeWidth={2.5} style={{ opacity: 0.5, transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)' }} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }} 
            animate={{ opacity: 1, y: 6, scale: 1 }} 
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            style={{
              position: 'absolute', top: '100%', left: align === 'left' ? 0 : 'auto', right: align === 'right' ? 0 : 'auto',
              zIndex: 100, minWidth: '100%', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
              borderRadius: '16px', padding: '8px', boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
              display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '280px', overflowY: 'auto'
            }}
          >
            {options.map((opt, idx) => {
              const isSelected = value === opt.value;
              return (
                <button
                  key={`${opt.value}-${idx}`}
                  onClick={() => { onChange(opt.value); setIsOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px',
                    backgroundColor: isSelected ? 'var(--bg-tertiary)' : 'transparent',
                    border: 'none', borderRadius: '12px', color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    fontSize: '14px', fontWeight: isSelected ? 700 : 500, cursor: 'pointer', textAlign: 'left', width: '100%',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => !isSelected && (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)33')}
                  onMouseLeave={e => !isSelected && (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <span>{opt.label}</span>
                  {isSelected && <Check size={16} strokeWidth={3} />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const RightInlineSelect = (props) => (
  <PremiumDropdown {...props} align="right" styleContext="inline" />
);

export const StatusBadge = ({ isValid, isActive }) => {
  if (!isActive) return <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-tertiary)', padding: '4px 10px', background: 'var(--bg-tertiary)', borderRadius: '20px', letterSpacing: '0.04em' }}>INACTIVE</span>;
  if (!isValid)  return <span style={{ fontSize: '10px', fontWeight: 800, color: '#f59e0b', padding: '4px 10px', background: 'rgba(245,158,11,0.1)', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '5px', letterSpacing: '0.04em' }}><Info size={11} strokeWidth={3} /> INVALID</span>;
  return <span style={{ fontSize: '10px', fontWeight: 800, color: '#10b981', padding: '4px 10px', background: 'rgba(16,185,129,0.1)', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '5px', letterSpacing: '0.04em' }}><Check size={11} strokeWidth={3} /> ACTIVE</span>;
};

export const ValidationError = ({ message }) => {
  if (!message) return null;
  const lines = message.split('\n');
  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      style={{ padding: '16px 20px', borderRadius: '18px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444', fontSize: '13px', lineHeight: '1.6' }}
    >
      <div style={{ fontWeight: 800, marginBottom: lines.length > 1 ? '10px' : 0, display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        <Info size={14} strokeWidth={3} /> Validation Failure
      </div>
      {lines.map((l, i) => <div key={i} style={{ paddingLeft: '22px', opacity: i === 0 ? 1 : 0.8, fontWeight: 500 }}>{l}</div>)}
    </motion.div>
  );
};

export const ContextButton = ({ children, onClick, danger, icon: Icon, borderBottom = true }) => (
  <button
    onClick={onClick}
    style={{
      padding: '14px 20px', width: '100%', background: 'transparent',
      border: 'none', borderBottom: borderBottom ? '1px solid var(--border-color)' : 'none',
      color: danger ? '#ef4444' : 'var(--accent-primary)', fontSize: '13.5px', fontWeight: 600,
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      letterSpacing: '-0.01em',
    }}
    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
  >
    {Icon && <Icon size={16} strokeWidth={2.5} />}
    {children}
  </button>
);

export const TrialSectionOverlay = ({ onUnlock }) => (
  <div style={{
    position: 'absolute', inset: 0, zIndex: 100, backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    background: 'rgba(var(--bg-primary-rgb), 0.7)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    borderRadius: '24px', padding: '40px', textAlign: 'center'
  }}>
      <div style={{
        width: '64px', height: '64px', borderRadius: '20px',
        background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px',
        color: 'var(--text-secondary)', boxShadow: '0 12px 24px rgba(0,0,0,0.1)'
      }}>
        <Lock size={28} strokeWidth={1.5} />
      </div>
      <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px', letterSpacing: '-0.02em' }}>Premium Access Required</h3>
      <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', marginBottom: '28px', maxWidth: '240px', lineHeight: 1.5 }}>Unlock cloud persistence and custom AI personality by signing in.</p>
      <button
        onClick={onUnlock}
        style={{
          padding: '14px 32px', borderRadius: '16px',
          background: 'var(--text-primary)', color: 'var(--bg-primary)',
          fontSize: '14px', fontWeight: 700, border: 'none', cursor: 'pointer',
          boxShadow: '0 10px 20px rgba(0,0,0,0.2)',
          transition: 'all 0.2s'
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >Sign In to Unlock</button>
  </div>
);

export const TrialBadge = () => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '6px 14px', borderRadius: '24px',
    background: 'linear-gradient(135deg, #FFD60A, #FF9500)',
    color: '#000', fontSize: '11px', fontWeight: 800,
    textTransform: 'uppercase', letterSpacing: '0.08em',
    boxShadow: '0 4px 12px rgba(255,149,0,0.3)',
    border: '1.5px solid rgba(255,255,255,0.2)'
  }}>
    <Zap size={11} fill="#000" />
    Trial Mode
  </div>
);

export const DialogModal = ({ title, description, children, primaryAction, primaryLabel, primaryDanger, loading, onClose }) => (
  <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', isolation: 'isolate' }}>
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
      style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }} 
      onClick={!loading ? onClose : undefined} 
    />
    <motion.div 
      initial={{ opacity: 0, scale: 0.95, y: 20 }} 
      animate={{ opacity: 1, scale: 1, y: 0 }} 
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      style={{
        background: 'var(--bg-primary)', 
        borderRadius: '32px', 
        width: '100%', 
        maxWidth: '440px', 
        padding: '40px', 
        boxShadow: '0 30px 100px rgba(0,0,0,0.5)', 
        border: '1px solid var(--border-color)',
        position: 'relative',
        zIndex: 1,
        transform: 'translateZ(0)',
      }}
    >
      <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '10px', letterSpacing: '-0.03em' }}>{title}</h2>
      {description && <p style={{ fontSize: '15px', color: 'var(--text-tertiary)', marginBottom: '32px', lineHeight: 1.6, fontWeight: 500 }}>{description}</p>}
      {children && <div style={{ marginBottom: '32px' }}>{children}</div>}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button onClick={onClose} disabled={loading} style={{ flex: 1, padding: '16px', borderRadius: '18px', background: 'var(--bg-tertiary)', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}>Cancel</button>
        <button onClick={primaryAction} disabled={loading} style={{ flex: 1, padding: '16px', borderRadius: '18px', background: primaryDanger ? '#ef4444' : 'var(--text-primary)', color: primaryDanger ? '#fff' : 'var(--bg-primary)', fontSize: '13px', fontWeight: 700, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s', boxShadow: primaryDanger ? '0 8px 24px rgba(239,68,68,0.25)' : '0 8px 24px rgba(0,0,0,0.15)' }}>{loading ? 'Processing...' : primaryLabel}</button>
      </div>
    </motion.div>
  </div>
);

export const useSettingsSync = () => {
  const { token, user } = useAuth();
  const timeoutRef = useRef(null);

  const syncSettings = (category, newValues, topLevel = {}) => {
    if (!user || user.isGuest) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      try {
        await fetch(`${API_URL}/api/user/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ settings: { [category]: newValues }, ...topLevel })
        });
      } catch (err) { console.error('Settings sync failed:', err); }
    }, 400);
  };

  return syncSettings;
};

export const SectionWrapper = ({ children, isGuest, isRestricted, onUnlock }) => {
  if (isGuest && isRestricted) {
    return (
      <div style={{ position: 'relative', height: '100%' }}>
        <TrialSectionOverlay onUnlock={onUnlock} />
        <div style={{ opacity: 0.25, pointerEvents: 'none', filter: 'blur(4px)' }}>{children}</div>
      </div>
    );
  }
  return <>{children}</>;
};