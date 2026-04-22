import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronRight, Check, Zap, Lock, 
  User, Shield, Palette, Key, Eye, Info 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const SECTIONS = [
  { id: 'general', label: 'General', icon: User },
  { id: 'account', label: 'Account', icon: Shield },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'ai', label: 'API Configuration', icon: Key },
  { id: 'privacy', label: 'Storage', icon: Eye },
  { id: 'about', label: 'About', icon: Info },
];

export const PROVIDER_INFO = {
  openai: { name: 'OpenAI', color: '#10a37f', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o3-mini'] },
  deepseek: { name: 'DeepSeek', color: '#4d6cfa', models: ['deepseek-chat', 'deepseek-reasoner'] },
  google: { name: 'Google Gemini', color: '#4285f4', models: ['gemini-1.5-pro', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'] },
  anthropic: { name: 'Anthropic', color: '#d97757', models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022', 'claude-3-haiku-20240307'] },
  custom: { name: 'Custom API', color: '#8b5cf6', models: [] },
};

export const MODEL_LABELS = {
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o Mini',
  'gpt-4-turbo': 'GPT-4 Turbo',
  'o3-mini': 'o3-mini (Reasoning)',
  'deepseek-chat': 'DeepSeek V3',
  'deepseek-reasoner': 'DeepSeek R1 (Reasoning)',
  'gemini-1.5-pro': 'Gemini 1.5 Pro',
  'gemini-2.0-flash': 'Gemini 2.0 Flash',
  'gemini-2.0-flash-lite': 'Gemini 2.0 Flash Lite',
  'claude-sonnet-4-20250514': 'Claude Sonnet 4',
  'claude-3-5-haiku-20241022': 'Claude 3.5 Haiku',
  'claude-3-haiku-20240307': 'Claude 3 Haiku',
};

export const SectionTitle = ({ children }) => (
  <h2 style={{
    fontSize: '13px', fontWeight: 600, letterSpacing: '0.04em',
    color: 'var(--text-tertiary)', textTransform: 'uppercase',
    marginBottom: '8px', marginLeft: '16px',
    fontFamily: '"Geist", sans-serif',
  }}>{children}</h2>
);

export const SettingsGroup = ({ children }) => (
  <div className="settings-group" style={{
    background: 'var(--bg-secondary)',
    borderRadius: '16px',
    marginBottom: '24px',
    border: '1px solid var(--border-color)',
    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
  }}>
    <style>{`
      .settings-group > *:first-child { border-top-left-radius: 15px; border-top-right-radius: 15px; }
      .settings-group > *:last-child { border-bottom-left-radius: 15px; border-bottom-right-radius: 15px; }
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
        padding: '12px 16px',
        borderBottom: borderBottom ? '1px solid var(--border-color)' : 'none',
        background: 'transparent',
        cursor: isClickable ? 'pointer' : 'default',
        transition: 'background 0.2s',
      }}
      onMouseEnter={isClickable ? e => e.currentTarget.style.background = 'var(--bg-tertiary)' : undefined}
      onMouseLeave={isClickable ? e => e.currentTarget.style.background = 'transparent' : undefined}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
        {Icon && (
          <div style={{
            width: '28px', height: '28px', borderRadius: '7px',
            background: danger ? '#fee2e2' : 'var(--text-primary)',
            color: danger ? '#ef4444' : 'var(--bg-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Icon style={{ width: '16px', height: '16px' }} />
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: '15px', fontWeight: 500,
            color: danger ? '#ef4444' : 'var(--text-primary)',
            fontFamily: '"Geist", sans-serif',
          }}>{label}</div>
          {description && (
            <div style={{
              fontSize: '13px', color: 'var(--text-tertiary)',
              marginTop: '2px', lineHeight: 1.4,
              fontFamily: '"Geist", sans-serif',
            }}>{description}</div>
          )}
        </div>
      </div>
      {(rightElement || (isClickable && !rightElement)) && (
        <div style={{ marginLeft: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {rightElement}
          {isClickable && !rightElement && <ChevronRight style={{ width: '16px', height: '16px', color: 'var(--text-tertiary)' }} />}
        </div>
      )}
    </div>
  );
};

export const AppleToggle = ({ value, onChange }) => (
  <button
    onClick={() => onChange(!value)}
    style={{
      width: '50px', height: '28px', borderRadius: '14px',
      background: value ? '#34C759' : 'var(--bg-tertiary)',
      border: `1.5px solid ${value ? '#34C759' : 'var(--border-color)'}`,
      position: 'relative', cursor: 'pointer',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      flexShrink: 0,
    }}
  >
    <motion.div
      initial={false}
      animate={{ x: value ? 22 : 0.5 }}
      transition={{ type: 'spring', stiffness: 500, damping: 32 }}
      style={{
        width: '24px', height: '24px', borderRadius: '50%',
        background: '#fff', position: 'absolute', top: '0.5px',
        boxShadow: '0 2px 5px rgba(0,0,0,0.15)',
      }}
    />
  </button>
);

export const RightInlineInput = ({ value, onChange, placeholder, type = 'text', width = '200px', disabled = false }) => (
  <input
    type={type} value={value} onChange={onChange}
    placeholder={placeholder} disabled={disabled}
    style={{
      width, padding: '6px 12px', background: 'transparent', border: 'none',
      color: disabled ? 'var(--text-tertiary)' : 'var(--text-secondary)',
      fontSize: '15px', fontWeight: 500, fontFamily: '"Geist", sans-serif',
      outline: 'none', textAlign: 'right', cursor: disabled ? 'not-allowed' : 'text',
    }}
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
  const basePadding = styleContext === 'form' ? '12px 14px' : '6px 12px';
  const baseBg = styleContext === 'form' ? 'var(--bg-secondary)' : 'transparent';
  const hoverBg = styleContext === 'form' ? 'var(--bg-tertiary)' : 'var(--bg-secondary)';
  const borderCol = styleContext === 'form' ? 'var(--border-color)' : 'transparent';

  return (
    <div ref={wrapperRef} style={{ position: 'relative', display: 'inline-block', width: styleContext === 'form' ? '100%' : 'auto' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
          padding: basePadding, backgroundColor: isOpen ? hoverBg : baseBg,
          border: `1px solid ${isOpen ? 'var(--text-tertiary)' : borderCol}`,
          borderRadius: styleContext === 'form' ? '12px' : '8px',
          color: styleContext === 'form' ? 'var(--text-primary)' : 'var(--text-secondary)',
          fontSize: styleContext === 'form' ? '13px' : '14px', fontWeight: 500, cursor: 'pointer', outline: 'none',
          transition: 'all 0.2s', minWidth: '130px',
        }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = hoverBg}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = isOpen ? hoverBg : baseBg}
      >
        <span>{selectedOption?.label}</span>
        <ChevronRight style={{ width: '16px', height: '16px', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }} animate={{ opacity: 1, y: 4, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.98 }}
            style={{
              position: 'absolute', top: '100%', left: align === 'left' ? 0 : 'auto', right: align === 'right' ? 0 : 'auto',
              zIndex: 50, minWidth: '100%', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
              borderRadius: '8px', padding: '6px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
              display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '260px', overflowY: 'auto'
            }}
          >
            {options.map((opt, idx) => {
              const isSelected = value === opt.value;
              return (
                <button
                  key={`${opt.value}-${idx}`}
                  onClick={() => { onChange(opt.value); setIsOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px',
                    backgroundColor: isSelected ? 'var(--bg-tertiary)' : 'transparent',
                    border: 'none', borderRadius: '10px', color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontSize: '13px', fontWeight: isSelected ? 600 : 500, cursor: 'pointer', textAlign: 'left', width: '100%'
                  }}
                >
                  <span>{opt.label}</span>
                  {isSelected && <Check size={14} style={{ color: '#10b981' }} />}
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

export const ContextButton = ({ children, onClick, danger, icon: Icon }) => (
  <button
    onClick={onClick}
    style={{
      padding: '12px 16px', width: '100%', background: 'transparent',
      border: 'none', borderBottom: '1px solid var(--border-color)',
      color: danger ? '#ef4444' : '#007AFF', fontSize: '15px', fontWeight: 500,
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
      transition: 'background 0.2s',
    }}
    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
  >
    {Icon && <Icon style={{ width: '16px', height: '16px' }} />}
    {children}
  </button>
);

export const TrialSectionOverlay = ({ onUnlock }) => (
  <div style={{
    position: 'absolute', inset: 0, zIndex: 100, backdropFilter: 'blur(12px)',
    background: 'var(--bg-primary)', opacity: 0.8,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    borderRadius: '16px', padding: '24px', textAlign: 'center'
  }}>
    <div style={{
      width: '48px', height: '48px', borderRadius: '16px',
      background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px',
      color: 'var(--text-secondary)'
    }}>
      <Lock style={{ width: '20px', height: '20px' }} />
    </div>
    <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Trial Mode Feature</h3>
    <button
      onClick={onUnlock}
      style={{
        padding: '10px 20px', borderRadius: '10px',
        background: 'var(--text-primary)', color: 'var(--bg-primary)',
        fontSize: '14px', fontWeight: 600, border: 'none', cursor: 'pointer',
      }}
    >Login to Unlock</button>
  </div>
);

export const TrialBadge = () => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '4px 10px', borderRadius: '20px',
    background: 'linear-gradient(135deg, #FFD60A, #FF9500)',
    color: '#000', fontSize: '11px', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.05em',
  }}>
    <Zap size={10} fill="#000" />
    Trial Mode
  </div>
);

export const DialogModal = ({ title, description, children, primaryAction, primaryLabel, primaryDanger, loading, onClose }) => (
  <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)' }} onClick={!loading ? onClose : undefined} />
    <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
      style={{
        background: 'var(--bg-primary)', borderRadius: '32px', width: '100%', maxWidth: '400px',
        position: 'relative', zIndex: 1001, boxShadow: '0 32px 80px -16px rgba(0,0,0,0.3)',
        border: '1px solid var(--border-color)', overflow: 'hidden'
      }}
    >
      <div style={{ padding: '32px' }}>
        <h3 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 12px 0', textAlign: 'center' }}>{title}</h3>
        {description && <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 24px 0', lineHeight: 1.6, textAlign: 'center' }}>{description}</p>}
        {children && <div style={{ marginBottom: '24px' }}>{children}</div>}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onClose} disabled={loading} style={{ flex: 1, padding: '14px', borderRadius: '16px', background: 'var(--bg-tertiary)', border: 'none', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>Cancel</button>
          <button onClick={primaryAction} disabled={loading} style={{ flex: 1, padding: '14px', borderRadius: '16px', background: primaryDanger ? '#ef4444' : 'var(--text-primary)', color: primaryDanger ? '#fff' : 'var(--bg-primary)', fontSize: '12px', fontWeight: 900, border: 'none', cursor: loading ? 'not-allowed' : 'pointer' }}>{loading ? 'Processing...' : primaryLabel}</button>
        </div>
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
    }, 1000);
  };

  return syncSettings;
};

export const SectionWrapper = ({ children, isGuest, isRestricted, onUnlock }) => {
  if (isGuest && isRestricted) {
    return (
      <div style={{ position: 'relative', height: '100%' }}>
        <TrialSectionOverlay onUnlock={onUnlock} />
        <div style={{ opacity: 0.3, pointerEvents: 'none' }}>{children}</div>
      </div>
    );
  }
  return <>{children}</>;
};
