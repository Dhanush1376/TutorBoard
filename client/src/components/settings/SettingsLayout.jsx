import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Check, Zap, Lock } from 'lucide-react';

export const TrialBadge = () => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '4px 10px', borderRadius: '20px',
    background: 'linear-gradient(135deg, #FFD60A, #FF9500)',
    color: '#000', fontSize: '11px', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.05em',
    boxShadow: '0 2px 8px rgba(255, 149, 0, 0.3)'
  }}>
    <Zap size={10} fill="#000" />
    Trial Mode
  </div>
);

export const TrialSectionOverlay = ({ onUnlock }) => (
  <div style={{
    position: 'absolute', inset: 0, zIndex: 100,
    backdropFilter: 'blur(12px)',
    background: 'var(--bg-primary)',
    opacity: 0.8,
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
    <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
      Trial Mode Feature
    </h3>
    <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', marginBottom: '24px', maxWidth: '240px' }}>
      Sign in to unlock personalized settings and save your learning configuration.
    </p>
    <button
      onClick={onUnlock}
      style={{
        padding: '10px 20px', borderRadius: '10px',
        background: 'var(--text-primary)', color: 'var(--bg-primary)',
        fontSize: '14px', fontWeight: 600, border: 'none', cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)', transition: 'transform 0.2s'
      }}
      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
    >
      Login to Unlock
    </button>
  </div>
);

export const SectionWrapper = ({ children, isGuest, onUnlock, isRestricted }) => (
  <div style={{ position: 'relative', width: '100%', height: '100%' }}>
    {children}
    {isGuest && isRestricted && <TrialSectionOverlay onUnlock={onUnlock} />}
  </div>
);


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
    overflow: 'hidden'
  }}>
    {children}
  </div>
);

export const SettingsRow = ({ icon: Icon, label, description, rightElement, borderBottom = true, danger, onClick }) => {
  const isClickable = !!onClick;

  return (
    <div
      onClick={onClick || undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
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
          }}>
            {label}
          </div>
          {description && (
            <div style={{
              fontSize: '13px', color: 'var(--text-tertiary)',
              marginTop: '2px', lineHeight: 1.4,
              fontFamily: '"Geist", sans-serif',
            }}>
              {description}
            </div>
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
      width: '51px', height: '31px', borderRadius: '16px',
      background: value ? '#34C759' : 'var(--bg-tertiary)',
      border: `1.5px solid ${value ? '#34C759' : 'var(--border-color)'}`,
      position: 'relative', cursor: 'pointer',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      flexShrink: 0,
      boxShadow: value ? '0 0 0 0 transparent' : 'inset 0 1px 2px rgba(0,0,0,0.05)',
    }}
  >
    <motion.div
      animate={{ x: value ? 20 : 2 }}
      transition={{ type: 'spring', stiffness: 500, damping: 32 }}
      style={{
        width: '24px', height: '24px', borderRadius: '50%',
        background: '#fff', position: 'absolute', top: '2px',
        boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
      }}
    />
  </button>
);

export const RightInlineInput = ({ value, onChange, placeholder, type = 'text', width = '200px' }) => (
  <input
    type={type}
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    style={{
      width, padding: '6px 12px',
      background: 'transparent',
      border: 'none',
      color: 'var(--text-secondary)',
      fontSize: '15px', fontWeight: 500, fontFamily: '"Geist", sans-serif',
      outline: 'none', textAlign: 'right',
    }}
  />
);

export const PremiumDropdown = ({ value, onChange, options, align = 'right', styleContext = 'inline' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
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
          width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
          padding: basePadding,
          backgroundColor: isOpen ? hoverBg : baseBg,
          border: `1px solid ${isOpen ? 'var(--text-tertiary)' : borderCol}`,
          borderRadius: styleContext === 'form' ? '12px' : '8px',
          color: styleContext === 'form' ? 'var(--text-primary)' : 'var(--text-secondary)',
          fontSize: styleContext === 'form' ? '13px' : '14px',
          fontWeight: 500, fontFamily: '"Geist", sans-serif',
          cursor: 'pointer', outline: 'none',
          transition: 'all 0.2s',
          minWidth: '130px',
        }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = hoverBg}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = isOpen ? hoverBg : baseBg}
      >
        <span>{selectedOption?.label}</span>
        <ChevronRight style={{ 
          width: '16px', height: '16px', color: 'var(--text-tertiary)',
          transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s',
          flexShrink: 0
        }} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 4, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              top: '100%',
              left: align === 'left' ? 0 : 'auto',
              right: align === 'right' ? 0 : 'auto',
              zIndex: 50,
              minWidth: '100%',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '6px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)',
              display: 'flex', flexDirection: 'column', gap: '2px',
              maxHeight: '260px', overflowY: 'auto'
            }}
          >
            {options.map(opt => (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                  padding: '8px 12px',
                  backgroundColor: value === opt.value ? 'var(--text-primary)' : 'transparent',
                  border: 'none', borderRadius: '6px',
                  color: value === opt.value ? 'var(--bg-primary)' : 'var(--text-secondary)',
                  fontSize: '13px', fontWeight: value === opt.value ? 600 : 500,
                  fontFamily: '"Geist", sans-serif',
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'all 0.1s',
                  width: '100%',
                  minWidth: 'max-content'
                }}
                onMouseEnter={e => {
                  if (value !== opt.value) {
                    e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }
                }}
                onMouseLeave={e => {
                  if (value !== opt.value) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
              >
                <span>{opt.label}</span>
                {value === opt.value && <Check strokeWidth={2.5} size={14} style={{ color: 'var(--bg-primary)' }} />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const DialogModal = ({ title, description, children, primaryAction, primaryLabel, primaryDanger, loading, onClose }) => (
  <div style={{
    position: 'fixed', inset: 0, zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '20px'
  }}>
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} 
      onClick={!loading ? onClose : undefined} 
    />
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      transition={{ duration: 0.2 }}
      style={{
        background: 'var(--bg-primary)',
        borderRadius: '24px',
        width: '100%', maxWidth: '400px',
        position: 'relative', zIndex: 1001,
        boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
        border: '1px solid var(--border-color)'
      }}
    >
      <div style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>{title}</h3>
        {description && <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '0 0 20px 0', lineHeight: 1.5 }}>{description}</p>}
        {children && <div style={{ marginBottom: '24px' }}>{children}</div>}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: children ? 0 : '24px' }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '10px 16px', borderRadius: '10px',
              background: 'var(--bg-secondary)', color: 'var(--text-primary)',
              border: 'none', fontSize: '14px', fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={primaryAction}
            disabled={loading}
            style={{
              padding: '10px 16px', borderRadius: '10px',
              background: primaryDanger ? '#ef4444' : 'var(--text-primary)', 
              color: primaryDanger ? '#fff' : 'var(--bg-primary)',
              border: 'none', fontSize: '14px', fontWeight: 500, 
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            {loading ? 'Processing...' : primaryLabel}
          </button>
        </div>
      </div>
    </motion.div>
  </div>
);
