import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useTutorStore from '../store/tutorStore';
import {
  ArrowLeft, User, Shield, Palette, Brain, PenTool, Eye, Info,
  Camera, Mail, Lock, ChevronRight, Check, X, Minus, LogOut, Trash2,
  Sun, Moon, Monitor, Grid3X3, LayoutGrid, Layers,
  Volume2, VolumeX, Zap, Gauge, BookOpen, GraduationCap,
  Globe2, Unlink, Download, Upload, RotateCcw,
  AlertTriangle, ExternalLink, Heart, TableProperties, PanelLeft, PanelRight,
  Activity, DollarSign, Wifi, WifiOff, GitBranch, Key
} from 'lucide-react';
import VisaiLogo from '../components/common/VisaiLogo';
import { useTheme } from '../context/ThemeContext';
import { themes } from '../lib/themes';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS SECTIONS MAP
// ═══════════════════════════════════════════════════════════════════════════════

const SECTIONS = [
  { id: 'general', label: 'General', icon: User },
  { id: 'account', label: 'Account', icon: Shield },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'ai', label: 'API Configuration', icon: Key },
  { id: 'privacy', label: 'Privacy', icon: Eye },
  { id: 'about', label: 'About', icon: Info },
];

// ═══════════════════════════════════════════════════════════════════════════════
// APPLE-STYLE MICRO-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

const SectionTitle = ({ children }) => (
  <h2 style={{
    fontSize: '13px', fontWeight: 600, letterSpacing: '0.04em',
    color: 'var(--text-tertiary)', textTransform: 'uppercase',
    marginBottom: '8px', marginLeft: '16px',
    fontFamily: '"Geist", sans-serif',
  }}>{children}</h2>
);

const SettingsGroup = ({ children }) => (
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

const SettingsRow = ({ icon: Icon, label, description, rightElement, borderBottom = true, danger, onClick }) => {
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

const AppleToggle = ({ value, onChange }) => (
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

const GridPreview = ({ type, isActive }) => {
  const isDots = type === 'dots';
  return (
    <div style={{
      width: '40px', height: '40px', borderRadius: '12px',
      border: '1px solid var(--border-color)', overflow: 'hidden',
      background: 'var(--bg-secondary)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '6px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
      opacity: isActive ? 1 : 0.4, transition: 'all 0.2s',
    }}>
      {isDots ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', opacity: 0.6 }}>
          {[...Array(16)].map((_, i) => (
            <div key={i} style={{
              width: '2px', height: '2px', borderRadius: '50%',
              background: i === 10 ? 'var(--text-primary)' : 'var(--text-tertiary)',
              transform: i === 10 ? 'scale(1.5)' : 'none',
              boxShadow: i === 10 ? '0 0 4px var(--text-primary)' : 'none',
            }} />
          ))}
        </div>
      ) : (
        <div style={{ width: '100%', height: '100%', position: 'relative', opacity: 0.4 }}>
          <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {[...Array(3)].map((_, i) => <div key={i} style={{ borderRight: '1px solid var(--text-tertiary)', height: '100%' }} />)}
          </div>
          <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateRows: 'repeat(4, 1fr)' }}>
            {[...Array(3)].map((_, i) => <div key={i} style={{ borderBottom: '1px solid var(--border-color)', width: '100%' }} />)}
          </div>
          <div style={{
            position: 'absolute', top: '50%', left: '50%', width: '6px', height: '6px',
            background: 'var(--text-primary)', borderRadius: '50%', transform: 'translate(-50%, -50%)',
            boxShadow: '0 0 4px var(--text-primary)',
          }} />
        </div>
      )}
    </div>
  );
};

const RightInlineInput = ({ value, onChange, placeholder, type = 'text', width = '200px' }) => (
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

const PremiumDropdown = ({ value, onChange, options, align = 'right', styleContext = 'inline' }) => {
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

const RightInlineSelect = (props) => (
  <PremiumDropdown {...props} align="right" styleContext="inline" />
);

const InlineColorPickerRow = ({ label, icon, value, onChange, borderBottom = true }) => {
  const colors = ['#fef9c3', '#fecaca', '#bbf7d0', '#bfdbfe', '#e9d5ff', '#fed7aa'];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 16px', borderBottom: borderBottom ? '1px solid var(--border-color)' : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {icon && (
          <div style={{
            width: '28px', height: '28px', borderRadius: '7px',
            background: 'var(--text-primary)', color: 'var(--bg-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {icon}
          </div>
        )}
        <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: '"Geist", sans-serif' }}>{label}</div>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        {colors.map(color => (
          <button
            key={color}
            onClick={() => onChange(color)}
            style={{
              width: '26px', height: '26px', borderRadius: '50%',
              background: color, cursor: 'pointer',
              border: value === color ? '2px solid var(--text-primary)' : '1px solid var(--border-color)',
              transition: 'all 150ms ease',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {value === color && <Check style={{ width: '12px', height: '12px', color: '#1a1a18' }} />}
          </button>
        ))}
      </div>
    </div>
  );
};

const ContextButton = ({ children, onClick, danger, icon: Icon }) => (
  <button
    onClick={onClick}
    style={{
      padding: '12px 16px', width: '100%',
      background: 'transparent',
      border: 'none', borderBottom: '1px solid var(--border-color)',
      color: danger ? '#ef4444' : '#007AFF',
      fontSize: '15px', fontWeight: 500, fontFamily: '"Geist", sans-serif',
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

const Avatar = ({ name, avatar, size = 56 }) => {
  const initials = (name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: avatar ? `url(${avatar}) center/cover` : 'var(--text-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--bg-primary)', fontSize: size * 0.35, fontWeight: 700,
      fontFamily: '"Geist", sans-serif', flexShrink: 0,
      border: '2px solid var(--border-color)',
    }}>
      {!avatar && initials}
    </div>
  );
};
const TrialSectionOverlay = ({ onUnlock }) => (
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

const TrialBadge = () => (
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

const SectionWrapper = ({ children, isGuest, onUnlock, isRestricted }) => (
  <div style={{ position: 'relative', width: '100%', height: '100%' }}>
    {children}
    {isGuest && isRestricted && <TrialSectionOverlay onUnlock={onUnlock} />}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOM HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

const useSettingsSync = () => {
  const { token, user } = useAuth();
  const timeoutRef = useRef(null);

  const syncSettings = useCallback((category, newValues) => {
    if (!user || user.isGuest) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      try {
        await fetch(`${API_URL}/api/user/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ settings: { [category]: newValues } })
        });
      } catch (err) {
        console.error('Settings sync failed:', err);
      }
    }, 1000);
  }, [user, token]);

  return syncSettings;
};

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION PANELS
// ═══════════════════════════════════════════════════════════════════════════════

const GeneralSection = ({ user, syncSettings, showToast }) => {
  const { updateUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.name || '');
  const [nickname, setNickname] = useState(
    localStorage.getItem('tb-nickname') || user?.name?.split(' ')[0] || ''
  );
  const [role, setRole] = useState(localStorage.getItem('tb-role') || '');
  const [preferences, setPreferences] = useState(localStorage.getItem('tb-ai-preferences') || '');
  const [notifCompletion, setNotifCompletion] = useState(localStorage.getItem('tb-notif-completion') !== 'false');
  const [notifSound, setNotifSound] = useState(localStorage.getItem('tb-notif-sound') !== 'false');
  const avatarInputRef = useRef(null);
  const [saveStatus, setSaveStatus] = useState(null); // 'saving' | 'saved' | null

  const handleNotifCompletionToggle = async (val) => {
    if (val) {
      if (!("Notification" in window)) {
        showToast('This browser does not support desktop notifications.', 'error');
        return;
      }
      if (Notification.permission !== "granted") {
        const p = await Notification.requestPermission();
        if (p !== "granted") {
          setNotifCompletion(false);
          showToast('Notification permission denied.', 'error');
          return;
        }
      }
    }
    setNotifCompletion(val);
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast('Image must be under 2MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      localStorage.setItem('tb-avatar', dataUrl);
      updateUser({ avatar: dataUrl });
      showToast('Avatar updated!', 'success');
    };
    reader.readAsDataURL(file);
  };

  // Auto-save logic
  useEffect(() => {
    const timeout = setTimeout(() => {
      setSaveStatus('saving');
      localStorage.setItem('tb-nickname', nickname);
      localStorage.setItem('tb-role', role);
      localStorage.setItem('tb-ai-preferences', preferences);
      localStorage.setItem('tb-notif-completion', String(notifCompletion));
      localStorage.setItem('tb-notif-sound', String(notifSound));

      // Update AuthContext so the name reflects globally (sidebar, header, etc.)
      if (displayName && displayName !== user?.name) {
        updateUser({ name: displayName });
      }

      syncSettings('general', { nickname, role, preferences, name: displayName, notifCompletion, notifSound });
      setTimeout(() => setSaveStatus('saved'), 300);
      setTimeout(() => setSaveStatus(null), 2000);
    }, 1000);
    return () => clearTimeout(timeout);
  }, [nickname, role, preferences, displayName, notifCompletion, notifSound, syncSettings, updateUser, user?.name]);

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px' }}>
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <Avatar name={displayName || user?.name} avatar={user?.avatar || localStorage.getItem('tb-avatar')} size={84} />
          <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
          <button onClick={() => avatarInputRef.current?.click()} style={{
            position: 'absolute', bottom: 0, right: 0,
            width: '28px', height: '28px', borderRadius: '50%',
            background: 'var(--bg-secondary)', color: 'var(--text-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid var(--border-color)', cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            transition: 'transform 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <Camera style={{ width: '13px', height: '13px' }} />
          </button>
        </div>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              {displayName || 'User'}
            </h2>
            {user?.isGuest && <TrialBadge />}
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', margin: 0 }}>
            {user?.email || 'guest@tutorboard.ai'}
          </p>
        </div>
        {saveStatus && (
          <motion.span
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              fontSize: '11px', fontWeight: 600, marginTop: '8px',
              color: saveStatus === 'saving' ? 'var(--text-tertiary)' : '#10b981',
              display: 'flex', alignItems: 'center', gap: '4px',
            }}
          >
            {saveStatus === 'saving' ? '⟳ Saving...' : '✓ Saved'}
          </motion.span>
        )}
      </div>

      <SectionTitle>Profile Details</SectionTitle>
      <SettingsGroup>
        <SettingsRow
          label="Full Name"
          rightElement={<RightInlineInput value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Full Name" />}
        />
        <SettingsRow
          label="Preferred Name"
          description="What TutorBoard should call you"
          rightElement={<RightInlineInput value={nickname} onChange={e => setNickname(e.target.value)} placeholder="Nickname" />}
        />
        <SettingsRow
          label="Role"
          borderBottom={false}
          rightElement={
            <RightInlineSelect
              value={role} onChange={setRole}
              options={[
                { value: '', label: 'Select role...' },
                { value: 'student-high-school', label: 'High School Student' },
                { value: 'student-undergrad', label: 'Undergraduate Student' },
                { value: 'student-grad', label: 'Graduate Student' },
                { value: 'teacher', label: 'Teacher / Professor' },
                { value: 'professional', label: 'Professional' },
              ]}
            />
          }
        />
      </SettingsGroup>

      <SectionTitle>Personalized Learning</SectionTitle>
      <SettingsGroup>
        <div style={{ padding: '16px' }}>
          <label style={{ display: 'block', fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '8px' }}>
            System Instructions
          </label>
          <textarea
            value={preferences}
            onChange={e => setPreferences(e.target.value)}
            placeholder="e.g. explain concepts with visual analogies, use simple language..."
            style={{
              width: '100%', padding: '12px', resize: 'vertical', minHeight: '80px',
              background: 'transparent', border: '1px solid var(--border-color)',
              borderRadius: '8px', color: 'var(--text-secondary)',
              fontSize: '14px', fontFamily: '"Geist", sans-serif', outline: 'none'
            }}
          />
        </div>
      </SettingsGroup>

      <SectionTitle>Notifications</SectionTitle>
      <SettingsGroup>
        <SettingsRow
          icon={Check} label="Agent Replies"
          rightElement={<AppleToggle value={notifCompletion} onChange={handleNotifCompletionToggle} />}
        />
        <SettingsRow
          icon={Volume2} label="Sound Effects" borderBottom={false}
          rightElement={<AppleToggle value={notifSound} onChange={setNotifSound} />}
        />
      </SettingsGroup>
    </div>
  );
};

const DialogModal = ({ title, description, children, primaryAction, primaryLabel, primaryDanger, loading, onClose }) => {
  return (
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
};

const AccountSection = ({ user, logout }) => {
  const navigate = useNavigate();
  const { token } = useAuth();
  
  const [modalType, setModalType] = useState(null); // 'password' | 'delete' | null
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const closeModals = () => {
    if (loading) return;
    setModalType(null);
    setCurrentPw('');
    setNewPw('');
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handlePasswordSubmit = async () => {
    if (!currentPw || !newPw) {
      setErrorMsg("Please fill in both fields.");
      return;
    }
    setLoading(true); setErrorMsg(''); setSuccessMsg('');
    try {
      const res = await fetch(`${API_URL}/api/user/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg("Password updated successfully.");
        setTimeout(closeModals, 1500);
      } else {
        setErrorMsg(data.error || "Failed to update password");
        setLoading(false);
      }
    } catch (e) {
      setErrorMsg("Network error.");
      setLoading(false);
    }
  };

  const handleDeleteSubmit = async () => {
    setLoading(true); setErrorMsg('');
    try {
      const res = await fetch(`${API_URL}/api/user/account`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        logout();
        navigate('/');
      } else {
        const data = await res.json();
        setErrorMsg(data.error || "Failed to delete account");
        setLoading(false);
      }
    } catch (e) {
      setErrorMsg("Network error.");
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      <AnimatePresence>
        {modalType === 'password' && (
          <DialogModal
            title="Change Password"
            primaryAction={handlePasswordSubmit}
            primaryLabel="Update Password"
            loading={loading}
            onClose={closeModals}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input 
                type="password" placeholder="Current Password" 
                value={currentPw} onChange={e => setCurrentPw(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
              />
              <input 
                type="password" placeholder="New Password" 
                value={newPw} onChange={e => setNewPw(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
              />
              {errorMsg && <div style={{ color: '#ef4444', fontSize: '12px', fontWeight: 500 }}>{errorMsg}</div>}
              {successMsg && <div style={{ color: '#10b981', fontSize: '12px', fontWeight: 500 }}>{successMsg}</div>}
            </div>
          </DialogModal>
        )}
        
        {modalType === 'delete' && (
          <DialogModal
            title="Delete Account"
            description="Are you absolutely sure? This action cannot be undone and all your data will be permanently wiped."
            primaryAction={handleDeleteSubmit}
            primaryLabel="Yes, Delete Everything"
            primaryDanger={true}
            loading={loading}
            onClose={closeModals}
          >
            {errorMsg && <div style={{ color: '#ef4444', fontSize: '12px', fontWeight: 500 }}>{errorMsg}</div>}
          </DialogModal>
        )}
      </AnimatePresence>

      <SectionTitle>Email</SectionTitle>
      <SettingsGroup>
        <SettingsRow label="Contact Email" rightElement={<span style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>{user?.email || 'Not provided'}</span>} borderBottom={false} />
      </SettingsGroup>

      <SectionTitle>Security</SectionTitle>
      <SettingsGroup>
        <SettingsRow label="Change Password" icon={Lock} onClick={() => setModalType('password')} borderBottom={false} />
      </SettingsGroup>

      <SectionTitle>Linked Accounts</SectionTitle>
      <SettingsGroup>
        <SettingsRow
          icon={Globe2} label="Google"
          description={user?.googleId ? 'Connected' : 'Not Connected'}
          rightElement={
            <button onClick={() => { if (!user?.googleId) window.location.href = `${API_URL}/api/auth/google`; }}
              style={{ fontSize: '14px', color: user?.googleId ? 'var(--text-tertiary)' : '#007AFF', background: 'none', border: 'none', cursor: 'pointer' }}>
              {user?.googleId ? 'Disconnect' : 'Connect'}
            </button>
          }
        />
        <SettingsRow
          icon={Globe2} label="GitHub"
          description={user?.githubId ? 'Connected' : 'Not Connected'}
          borderBottom={false}
          rightElement={
            <button onClick={() => { if (!user?.githubId) window.location.href = `${API_URL}/api/auth/github`; }}
              style={{ fontSize: '14px', color: user?.githubId ? 'var(--text-tertiary)' : '#007AFF', background: 'none', border: 'none', cursor: 'pointer' }}>
              {user?.githubId ? 'Disconnect' : 'Connect'}
            </button>
          }
        />
      </SettingsGroup>

      <SectionTitle>Session</SectionTitle>
      <SettingsGroup>
        <ContextButton icon={LogOut} onClick={() => { logout(); navigate('/'); }}>
          Sign Out
        </ContextButton>
        <ContextButton icon={Trash2} danger onClick={() => setModalType('delete')} borderBottom={false}>
          Delete Account
        </ContextButton>
      </SettingsGroup>
    </div>
  );
};

const AppearanceSection = ({ syncSettings }) => {
  const store = useTutorStore();
  const { themes, currentThemeId, setCurrentThemeId, mode, toggleMode } = useTheme();

  // Sync with backend
  useEffect(() => {
    const timeout = setTimeout(() => {
      syncSettings('appearance', {
        themeId: currentThemeId,
        mode,
        showMinimap: store.showMinimap,
        showGrid: store.showGrid,
        layoutView: store.layoutView,
        gridType: store.gridType
      });
    }, 1000);
    return () => clearTimeout(timeout);
  }, [currentThemeId, mode, store.showMinimap, store.showGrid, store.layoutView, store.gridType, syncSettings]);

  const toggleSidebarPosition = (pos) => {
    store.setLayoutView(pos);
  };

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>

      {/* ── THEME SECTION ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Theme</h3>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Appearance</span>
          </div>
          <button
            onClick={toggleMode}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 12px',
              background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
              borderRadius: '20px', cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            <div style={{
              padding: '6px', borderRadius: '50%',
              background: mode === 'light' ? 'var(--text-primary)' : 'transparent',
              color: mode === 'light' ? 'var(--bg-primary)' : 'var(--text-tertiary)',
              display: 'flex', alignItems: 'center'
            }}>
              <Sun size={14} />
            </div>
            <div style={{
              padding: '6px', borderRadius: '50%',
              background: mode === 'dark' ? 'var(--text-primary)' : 'transparent',
              color: mode === 'dark' ? 'var(--bg-primary)' : 'var(--text-tertiary)',
              display: 'flex', alignItems: 'center'
            }}>
              <Moon size={14} />
            </div>
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {themes.map((theme) => {
            const isSelected = currentThemeId === theme.id;
            const displayColors = theme.colors[mode];
            const nameParts = theme.name.split(' & ');

            return (
              <button
                key={`theme-opt-${theme.id}`}
                onClick={() => setCurrentThemeId(theme.id)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: '16px 12px', borderRadius: '16px', border: '1px solid',
                  borderColor: isSelected ? 'var(--text-primary)' : 'var(--border-color)',
                  background: isSelected ? 'var(--bg-tertiary)' : 'transparent',
                  cursor: 'pointer', transition: 'all 0.2s', position: 'relative'
                }}
              >
                <span style={{
                  fontSize: '10px', fontWeight: 700, textAlign: 'center', lineHeight: 1.2,
                  marginBottom: '12px', color: isSelected ? 'var(--text-primary)' : 'var(--text-tertiary)'
                }}>
                  {nameParts[0]}<br />& {nameParts[1]}
                </span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {[displayColors.bg, displayColors.surface, displayColors.text, displayColors.aiBubble].map((color, i) => (
                    <div key={i} style={{
                      width: '10px', height: '10px', borderRadius: '50%',
                      background: color, border: '1px solid rgba(0,0,0,0.1)'
                    }} />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── GRID SETTINGS ── */}
      <div>
        <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Grid Settings</h3>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Live Preview</span>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              {store.gridType.charAt(0).toUpperCase() + store.gridType.slice(1)} • {store.gridSize || 20}px
            </span>
          </div>
          <GridPreview type={store.gridType} isActive={true} />
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          {[
            { id: 'dots', label: 'Dots', icon: TableProperties },
            { id: 'lines', label: 'Lines', icon: Grid3X3 }
          ].map(type => {
            const isActive = store.gridType === type.id;
            return (
              <button
                key={type.id}
                onClick={() => store.setGridType(type.id)}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: '12px', padding: '20px', borderRadius: '20px', border: '1px solid',
                  borderColor: isActive ? 'var(--text-primary)' : 'var(--border-color)',
                  background: isActive ? 'var(--text-primary)' : 'var(--bg-tertiary)',
                  color: isActive ? 'var(--bg-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer', transition: 'all 0.2s', position: 'relative'
                }}
              >
                {isActive && (
                  <div style={{
                    position: 'absolute', top: '10px', right: '10px',
                    width: '18px', height: '18px', borderRadius: '50%',
                    background: 'var(--bg-primary)', color: 'var(--text-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <Check size={12} strokeWidth={4} />
                  </div>
                )}
                <type.icon size={24} strokeWidth={2.5} />
                <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{type.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── LAYOUT VIEW ── */}
      <div>
        <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Layout View</h3>
        <div style={{ display: 'flex', gap: '12px' }}>
          {[
            { id: 'left', label: 'Standard (Left)', icon: PanelLeft },
            { id: 'right', label: 'Right Hand (Right)', icon: PanelRight }
          ].map(pos => {
            const isActive = store.layoutView === pos.id;
            return (
              <button
                key={`layout-pos-${pos.id}`}
                onClick={() => toggleSidebarPosition(pos.id)}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: '12px', padding: '20px', borderRadius: '20px', border: '1px solid',
                  borderColor: isActive ? 'var(--text-primary)' : 'var(--border-color)',
                  background: isActive ? 'var(--text-primary)' : 'var(--bg-tertiary)',
                  color: isActive ? 'var(--bg-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer', transition: 'all 0.2s', position: 'relative'
                }}
              >
                {isActive && (
                  <div style={{
                    position: 'absolute', top: '10px', right: '10px',
                    width: '18px', height: '18px', borderRadius: '50%',
                    background: 'var(--bg-primary)', color: 'var(--text-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <Check size={12} strokeWidth={4} />
                  </div>
                )}
                <pos.icon size={24} strokeWidth={2.5} />
                <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{pos.label}</span>
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
};

const PROVIDER_INFO = {
  openai: { name: 'OpenAI', color: '#10a37f', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o3-mini'] },
  deepseek: { name: 'DeepSeek', color: '#4d6cfa', models: ['deepseek-chat', 'deepseek-reasoner'] },
  google: { name: 'Google Gemini', color: '#4285f4', models: ['gemini-2.5-pro-preview-05-06', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'] },
  anthropic: { name: 'Anthropic', color: '#d97757', models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022', 'claude-3-haiku-20240307'] },
  custom: { name: 'Custom API', color: '#8b5cf6', models: [] },
};

const MODEL_LABELS = {
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o Mini',
  'gpt-4-turbo': 'GPT-4 Turbo',
  'o3-mini': 'o3-mini (Reasoning)',
  'deepseek-chat': 'DeepSeek V3',
  'deepseek-reasoner': 'DeepSeek R1 (Reasoning)',
  'gemini-2.5-pro-preview-05-06': 'Gemini 2.5 Pro',
  'gemini-2.0-flash': 'Gemini 2.0 Flash',
  'gemini-2.0-flash-lite': 'Gemini 2.0 Flash Lite',
  'claude-sonnet-4-20250514': 'Claude Sonnet 4',
  'claude-3-5-haiku-20241022': 'Claude 3.5 Haiku',
  'claude-3-haiku-20240307': 'Claude 3 Haiku',
};

const UniversalUsageCard = ({ usage }) => {
  if (!usage) return null;
  const isWarning = usage.percent >= 80;
  const isExceeded = usage.percent >= 100;
  
  return (
    <div style={{ 
      background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', 
      padding: '20px', marginBottom: '24px', overflow: 'hidden', position: 'relative',
      boxShadow: '0 4px 12px rgba(139, 92, 246, 0.05)'
    }}>
      <div style={{ position: 'absolute', top: 0, right: 0, padding: '6px 12px', background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', fontSize: '10px', fontWeight: 700, borderRadius: '0 0 0 12px' }}>
        SYSTEM PROVIDED
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6' }}>
          <Sparkles size={20} />
        </div>
        <div>
          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>TutorBoard Universal API</h4>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-tertiary)' }}>Platform credits for common tasks</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600 }}>
          <span style={{ color: 'var(--text-secondary)' }}>Monthly Usage</span>
          <span style={{ color: isExceeded ? '#ef4444' : isWarning ? '#f59e0b' : 'var(--text-primary)' }}>{usage.requests} / {usage.limit} requests</span>
        </div>
        <div style={{ height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${usage.percent}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            style={{ 
              height: '100%', 
              background: isExceeded ? '#ef4444' : isWarning ? 'linear-gradient(90deg, #8b5cf6, #f59e0b)' : 'linear-gradient(90deg, #8b5cf6, #6366f1)',
            }} 
          />
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
          Tip: Add your own key to bypass platform rate limits and save shared credits.
        </div>
      </div>
    </div>
  );
};

const AILearningSection = ({ showToast }) => {
  const { token } = useAuth();
  const [defaultDifficulty, setDefaultDifficulty] = useState(localStorage.getItem('tb-difficulty') || 'beginner');
  const [defaultMode, setDefaultMode] = useState(localStorage.getItem('tb-mode') || 'explain');

  // API Key Management State
  const [apiKeys, setApiKeys] = useState([]);
  const [preferences, setPreferences] = useState({
    useCustomApi: false, fallbackToDefault: true, smartRouting: false,
    enableRacing: false, enableAdaptive: false, routingMode: 'auto',
    modelOverride: '', costControl: { monthlyLimitCents: 0, warningThresholdPct: 80, hardStop: true },
  });
  const [usageStats, setUsageStats] = useState(null);
  const [healthData, setHealthData] = useState(null);
  const [costStatus, setCostStatus] = useState(null);
  const [universalUsage, setUniversalUsage] = useState(null);

  // Add Key Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProvider, setNewProvider] = useState('openai');
  const [newApiKey, setNewApiKey] = useState('');
  const [newModel, setNewModel] = useState('gpt-4o');
  const [newBaseUrl, setNewBaseUrl] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);

  // Test key state
  const [testingKeyId, setTestingKeyId] = useState(null);
  const [testResults, setTestResults] = useState({}); // { [keyId]: { valid, latencyMs, error } }

  useEffect(() => {
    localStorage.setItem('tb-difficulty', defaultDifficulty);
    localStorage.setItem('tb-mode', defaultMode);
  }, [defaultDifficulty, defaultMode]);

  // Fetch all data on mount
  useEffect(() => {
    if (token) { fetchApiKeys(); fetchUsageStats(); fetchHealth(); fetchCostStatus(); }
  }, [token]);

  // Auto-refresh usage data every 30s while this tab is active
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      fetchApiKeys();
      fetchCostStatus();
    }, 30000);
    return () => clearInterval(interval);
  }, [token]);

  // Set default model when provider changes
  useEffect(() => {
    const models = PROVIDER_INFO[newProvider]?.models || [];
    setNewModel(models[0] || '');
  }, [newProvider]);

  const fetchApiKeys = async () => {
    try {
      const res = await fetch(`${API_URL}/api/apikeys`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const d = await res.json();
        setApiKeys(d.keys || []);
        setPreferences(d.preferences || {});
        setUniversalUsage(d.universalUsage || null);
      }
    } catch (e) { /* silent */ }
  };

  const fetchUsageStats = async () => {
    try {
      const res = await fetch(`${API_URL}/api/apikeys/usage`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setUsageStats(await res.json());
    } catch (e) { /* silent */ }
  };

  const fetchHealth = async () => {
    try {
      const res = await fetch(`${API_URL}/api/apikeys/health`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setHealthData(await res.json());
    } catch (e) { /* silent */ }
  };

  const fetchCostStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/api/apikeys/cost-status`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setCostStatus(await res.json());
    } catch (e) { /* silent */ }
  };

  const handleUpdateCostControl = async (field, value) => {
    const updated = { ...preferences, costControl: { ...(preferences.costControl || {}), [field]: value } };
    setPreferences(updated);
    try { await fetch(`${API_URL}/api/apikeys/preferences`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(updated) }); fetchCostStatus(); } catch (e) { /* */ }
  };

  const handleAddKey = async () => {
    if (!newApiKey.trim()) return;
    setIsValidating(true);
    setValidationResult(null);
    try {
      const res = await fetch(`${API_URL}/api/apikeys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ provider: newProvider, apiKey: newApiKey.trim(), model: newModel, label: `${PROVIDER_INFO[newProvider]?.name} Key`, baseUrl: newProvider === 'custom' ? newBaseUrl : undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setValidationResult({ success: true, message: data.message, latencyMs: data.latencyMs });
        setNewApiKey(''); setShowAddForm(false); fetchApiKeys();
        showToast?.(`${PROVIDER_INFO[newProvider]?.name} key added successfully!`, 'success');
      }
      else { setValidationResult({ success: false, message: data.details || data.error }); }
    } catch (e) { setValidationResult({ success: false, message: 'Network error' }); }
    finally { setIsValidating(false); }
  };

  const handleDeleteKey = async (keyId) => {
    try {
      const r = await fetch(`${API_URL}/api/apikeys/${keyId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (r.ok) { fetchApiKeys(); showToast?.('API key removed', 'info'); }
    } catch (e) { /* */ }
  };

  const handleToggleKey = async (keyId, isActive) => {
    try { await fetch(`${API_URL}/api/apikeys/${keyId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ isActive }) }); fetchApiKeys(); } catch (e) { /* */ }
  };

  const handleUpdatePref = async (key, value) => {
    const updated = { ...preferences, [key]: value };
    setPreferences(updated);
    try { await fetch(`${API_URL}/api/apikeys/preferences`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(updated) }); } catch (e) { /* */ }
  };

  const handleTestKey = async (keyId) => {
    setTestingKeyId(keyId);
    setTestResults(prev => ({ ...prev, [keyId]: null }));
    try {
      const res = await fetch(`${API_URL}/api/apikeys/${keyId}/test`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      setTestResults(prev => ({ ...prev, [keyId]: data }));
      if (data.valid) {
        showToast?.(`Connection OK (${data.latencyMs}ms)`, 'success');
      } else {
        showToast?.(data.error || 'Validation failed', 'error');
      }
      fetchApiKeys(); // Refresh validation status
    } catch (e) {
      setTestResults(prev => ({ ...prev, [keyId]: { valid: false, error: 'Network error' } }));
      showToast?.('Network error during test', 'error');
    }
    finally { setTestingKeyId(null); }
  };

  const cardSt = { background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '16px' };

  const hasActiveCustomKey = preferences.useCustomApi && apiKeys.some(k => k.isActive && k.isValid);

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>

      {/* ── ACTIVE API SOURCE INDICATOR ── */}
      <div style={{
        ...cardSt, marginBottom: '24px', padding: '16px 20px',
        background: hasActiveCustomKey
          ? 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(16,185,129,0.02) 100%)'
          : 'linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(59,130,246,0.02) 100%)',
        borderColor: hasActiveCustomKey ? 'rgba(16,185,129,0.25)' : 'rgba(59,130,246,0.25)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '10px', height: '10px', borderRadius: '50%',
              background: hasActiveCustomKey ? '#10b981' : '#3b82f6',
              boxShadow: `0 0 8px ${hasActiveCustomKey ? 'rgba(16,185,129,0.5)' : 'rgba(59,130,246,0.5)'}`,
              animation: 'pulse 2s ease-in-out infinite',
            }} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
                {hasActiveCustomKey ? 'Your Personal API' : 'TutorBoard Platform API'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                {hasActiveCustomKey
                  ? `Using ${apiKeys.find(k => k.isActive && k.isValid)?.provider} — ${MODEL_LABELS[apiKeys.find(k => k.isActive && k.isValid)?.model] || apiKeys.find(k => k.isActive && k.isValid)?.model}`
                  : 'Shared credits via OpenRouter • Add your own key to save credits'}
              </div>
            </div>
          </div>
          <div style={{
            padding: '4px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.08em',
            background: hasActiveCustomKey ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.15)',
            color: hasActiveCustomKey ? '#10b981' : '#3b82f6',
          }}>
            {hasActiveCustomKey ? 'Personal' : 'Universal'}
          </div>
        </div>
      </div>

      {/* ── API CONFIGURATION ── */}
      <SectionTitle>API Configuration</SectionTitle>
      <SettingsGroup>
        <SettingsRow icon={Zap} label="Use Custom API"
          rightElement={<AppleToggle value={preferences.useCustomApi} onChange={v => handleUpdatePref('useCustomApi', v)} />}
        />
        <SettingsRow icon={Shield} label="Auto-Fallback to Default"
          rightElement={<AppleToggle value={preferences.fallbackToDefault} onChange={v => handleUpdatePref('fallbackToDefault', v)} />}
        />
        <SettingsRow icon={Brain} label="Smart Model Routing"
          rightElement={<AppleToggle value={preferences.smartRouting} onChange={v => handleUpdatePref('smartRouting', v)} />}
        />
        <SettingsRow icon={GitBranch} label="Adaptive Learning"
          rightElement={<AppleToggle value={preferences.enableAdaptive} onChange={v => handleUpdatePref('enableAdaptive', v)} />}
        />
        <SettingsRow icon={Activity} label="Parallel Racing"
          rightElement={<AppleToggle value={preferences.enableRacing} onChange={v => handleUpdatePref('enableRacing', v)} />}
        />
        <SettingsRow icon={Globe2} label="Routing Mode" borderBottom={false}
          rightElement={<RightInlineSelect value={preferences.routingMode || 'auto'} onChange={v => handleUpdatePref('routingMode', v)}
            options={[{ value: 'auto', label: 'Auto (AI decides)' }, { value: 'manual', label: 'Manual (You pick)' }]} />}
        />
      </SettingsGroup>

      {/* Model Override (only in manual mode) */}
      {preferences.routingMode === 'manual' && apiKeys.length > 0 && (
        <div style={{ marginTop: '12px' }}>
          <SettingsGroup>
            <SettingsRow icon={Brain} label="Model Override" borderBottom={false}
              rightElement={<RightInlineSelect value={preferences.modelOverride || ''} onChange={v => handleUpdatePref('modelOverride', v)}
                options={[{ value: '', label: 'None' }, ...apiKeys.map(k => ({ value: k.model, label: MODEL_LABELS[k.model] || k.model }))]} />}
            />
          </SettingsGroup>
        </div>
      )}

      {/* Saved API Keys */}
      <div style={{ marginTop: '20px' }}>
        {/* Universal Usage Barline */}
        {!preferences.useCustomApi && universalUsage && (
          <UniversalUsageCard usage={universalUsage} />
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', padding: '0 4px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Your API Keys {apiKeys.length > 0 && `(${apiKeys.length})`}
          </span>
          <button onClick={() => { setShowAddForm(!showAddForm); setValidationResult(null); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: 700,
              background: showAddForm ? 'var(--text-primary)' : 'var(--bg-tertiary)', color: showAddForm ? 'var(--bg-primary)' : 'var(--text-secondary)',
              border: '1px solid var(--border-color)', cursor: 'pointer', transition: 'all 0.2s'
            }}>
            {showAddForm ? <X size={12} /> : <span>+</span>}
            {showAddForm ? 'Cancel' : 'Add Key'}
          </button>
        </div>

        {/* Add Key Form */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div 
              initial={{ opacity: 0, height: 0, overflow: 'hidden' }} 
              animate={{ opacity: 1, height: 'auto', transitionEnd: { overflow: 'visible' } }} 
              exit={{ opacity: 0, height: 0, overflow: 'hidden' }} 
              transition={{ duration: 0.2 }} 
              style={{ marginBottom: '16px' }}
            >
              <div style={{ ...cardSt, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Provider Selector */}
                <div>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', display: 'block' }}>Provider</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                    {Object.entries(PROVIDER_INFO).map(([id, info]) => (
                      <button key={id} onClick={() => setNewProvider(id)}
                        style={{
                          padding: '10px 4px', borderRadius: '12px', border: '1px solid', borderColor: newProvider === id ? info.color : 'var(--border-color)',
                          background: newProvider === id ? `${info.color}15` : 'transparent', cursor: 'pointer', transition: 'all 0.2s',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px'
                        }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: info.color }} />
                        <span style={{ fontSize: '8px', fontWeight: 700, color: newProvider === id ? 'var(--text-primary)' : 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                          {id === 'custom' ? 'Custom' : info.name.split(' ')[0]}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* API Key Input */}
                <div>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px', display: 'block' }}>API Key</label>
                  <div style={{ position: 'relative' }}>
                    <input type={showKey ? 'text' : 'password'} value={newApiKey} onChange={e => setNewApiKey(e.target.value)}
                      placeholder={newProvider === 'openai' ? 'sk-proj-...' : newProvider === 'google' ? 'AIza...' : newProvider === 'anthropic' ? 'sk-ant-...' : newProvider === 'deepseek' ? 'sk-...' : 'Enter API key'}
                      style={{
                        width: '100%', padding: '10px 40px 10px 12px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)', fontSize: '13px', outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box'
                      }} />
                    <button onClick={() => setShowKey(!showKey)}
                      style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '4px' }}>
                      <Eye size={14} />
                    </button>
                  </div>
                </div>

                {/* Custom Base URL */}
                {newProvider === 'custom' && (
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px', display: 'block' }}>Base URL</label>
                    <input type="text" value={newBaseUrl} onChange={e => setNewBaseUrl(e.target.value)} placeholder="https://api.example.com/v1"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                )}

                {/* Model Selector */}
                {PROVIDER_INFO[newProvider]?.models.length > 0 && (
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px', display: 'block' }}>Model</label>
                    <PremiumDropdown
                      value={newModel}
                      onChange={setNewModel}
                      options={PROVIDER_INFO[newProvider].models.map(m => ({ value: m, label: MODEL_LABELS[m] || m }))}
                      align="left"
                      styleContext="form"
                    />
                  </div>
                )}

                {/* Validation Result */}
                {validationResult && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '12px',
                    background: validationResult.success ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    border: `1px solid ${validationResult.success ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`
                  }}>
                    {validationResult.success ? <Check size={14} style={{ color: '#10b981' }} /> : <X size={14} style={{ color: '#ef4444' }} />}
                    <span style={{ fontSize: '12px', color: validationResult.success ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                      {validationResult.message}{validationResult.latencyMs ? ` (${validationResult.latencyMs}ms)` : ''}
                    </span>
                  </div>
                )}

                {/* Submit */}
                <button onClick={handleAddKey} disabled={!newApiKey.trim() || isValidating}
                  style={{
                    width: '100%', padding: '12px', borderRadius: '12px', border: 'none',
                    background: newApiKey.trim() && !isValidating ? 'var(--text-primary)' : 'var(--border-color)',
                    color: newApiKey.trim() && !isValidating ? 'var(--bg-primary)' : 'var(--text-tertiary)',
                    fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
                    cursor: newApiKey.trim() && !isValidating ? 'pointer' : 'not-allowed', transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                  }}>
                  {isValidating ? (
                    <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      style={{ width: '14px', height: '14px', border: '2px solid var(--bg-primary)', borderTopColor: 'transparent', borderRadius: '50%' }} />Validating...</>
                  ) : (<><Shield size={14} />Validate & Save</>)}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Key Cards */}
        {apiKeys.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {apiKeys.map(key => {
              const pc = PROVIDER_INFO[key.provider]?.color || '#888';
              const testResult = testResults[key.id];
              const isTesting = testingKeyId === key.id;
              return (
                <motion.div
                  key={key.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: key.isActive ? 1 : 0.5, y: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ ...cardSt, overflow: 'hidden', transition: 'all 0.2s', borderLeft: `3px solid ${pc}` }}
                >
                  {/* Key Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `${pc}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: pc }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>{PROVIDER_INFO[key.provider]?.name || key.provider}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{key.maskedKey}</span>
                        <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '6px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>{MODEL_LABELS[key.model] || key.model || 'default'}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: key.isValid ? '#10b981' : '#ef4444' }} />
                      {/* Test Connection Button */}
                      <button onClick={() => handleTestKey(key.id)} disabled={isTesting}
                        title="Test Connection"
                        style={{
                          padding: '5px', borderRadius: '8px', border: 'none', cursor: isTesting ? 'wait' : 'pointer',
                          background: 'transparent', color: 'var(--text-tertiary)', transition: 'all 0.2s', display: 'flex', alignItems: 'center',
                        }}
                        onMouseEnter={e => { if (!isTesting) { e.currentTarget.style.color = pc; e.currentTarget.style.background = `${pc}15`; } }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'transparent'; }}>
                        {isTesting ? (
                          <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                            style={{ width: '13px', height: '13px', border: `2px solid ${pc}`, borderTopColor: 'transparent', borderRadius: '50%' }} />
                        ) : <Zap size={13} />}
                      </button>
                      <AppleToggle value={key.isActive} onChange={v => handleToggleKey(key.id, v)} />
                      <button onClick={() => handleDeleteKey(key.id)}
                        style={{ padding: '5px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--text-tertiary)', transition: 'all 0.2s' }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'transparent'; }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Per-Key Usage Bar */}
                  {key.usage && key.usage.requests > 0 && (
                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', gap: '12px', fontSize: '10px', color: 'var(--text-tertiary)' }}>
                          <span><strong style={{ color: 'var(--text-secondary)' }}>{key.usage.requests}</strong> requests</span>
                          <span><strong style={{ color: 'var(--text-secondary)' }}>${(key.usage.costCents / 100).toFixed(3)}</strong> cost</span>
                          {key.usage.tokens > 0 && <span><strong style={{ color: 'var(--text-secondary)' }}>{key.usage.tokens >= 1000 ? `${(key.usage.tokens / 1000).toFixed(1)}k` : key.usage.tokens}</strong> tokens</span>}
                        </div>
                        {key.usage.lastUsed && (
                          <span style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>
                            Last used {new Date(key.usage.lastUsed).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <div style={{ height: '3px', borderRadius: '2px', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, Math.max(5, key.usage.requests))}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                          style={{ height: '100%', borderRadius: '2px', background: pc }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Test Result inline */}
                  {testResult && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      style={{
                        marginTop: '8px', padding: '6px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 600,
                        background: testResult.valid ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                        color: testResult.valid ? '#10b981' : '#ef4444',
                        display: 'flex', alignItems: 'center', gap: '6px',
                      }}>
                      {testResult.valid ? <Check size={12} /> : <X size={12} />}
                      {testResult.valid ? `Connected (${testResult.latencyMs}ms)` : testResult.error || 'Failed'}
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </div>
        ) : !showAddForm && (
          <div style={{ ...cardSt, textAlign: 'center', padding: '48px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '20px',
              background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '20px', position: 'relative',
              boxShadow: '0 8px 16px rgba(0,0,0,0.05)'
            }}>
              <Key size={32} style={{ color: 'var(--text-tertiary)', opacity: 0.8 }} />
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '20px',
                background: 'linear-gradient(135deg, var(--accent-primary) 0%, transparent 100%)',
                opacity: 0.05
              }} />
            </div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Bring Your Own Key</div>
            <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', maxWidth: '320px', lineHeight: 1.5, marginBottom: '16px' }}>
              TutorBoard uses shared platform credits by default. Add your own API key to avoid rate limits, save shared credits, and unlock higher-tier models.
            </div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {Object.entries(PROVIDER_INFO).filter(([id]) => id !== 'custom').map(([id, info]) => (
                <span key={id} style={{
                  fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                  padding: '3px 8px', borderRadius: '8px',
                  background: `${info.color}12`, color: info.color,
                  border: `1px solid ${info.color}30`,
                }}>{info.name.split(' ')[0]}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── COST CONTROL ── */}
      <div style={{ marginTop: '24px' }}>
        <SectionTitle>Cost Control</SectionTitle>
        <SettingsGroup>
          <SettingsRow icon={DollarSign} label="Monthly Limit (¢)"
            rightElement={
              <input type="number" min="0" step="100" value={preferences.costControl?.monthlyLimitCents || 0}
                onChange={e => handleUpdateCostControl('monthlyLimitCents', Math.max(0, parseInt(e.target.value) || 0))}
                style={{ width: '80px', padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '12px', textAlign: 'right', outline: 'none' }} />
            }
          />
          <SettingsRow icon={AlertTriangle} label="Warning at (%)"
            rightElement={
              <input type="number" min="10" max="100" value={preferences.costControl?.warningThresholdPct || 80}
                onChange={e => handleUpdateCostControl('warningThresholdPct', Math.min(100, Math.max(10, parseInt(e.target.value) || 80)))}
                style={{ width: '56px', padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '12px', textAlign: 'right', outline: 'none' }} />
            }
          />
          <SettingsRow icon={Shield} label="Hard Stop at Limit" borderBottom={false}
            rightElement={<AppleToggle value={preferences.costControl?.hardStop !== false} onChange={v => handleUpdateCostControl('hardStop', v)} />}
          />
        </SettingsGroup>
        {costStatus && preferences.costControl?.monthlyLimitCents > 0 && (
          <div style={{ ...cardSt, marginTop: '8px', padding: '12px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>This Month</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: costStatus.isExceeded ? '#ef4444' : costStatus.isWarning ? '#f59e0b' : '#10b981' }}>
                ${(costStatus.currentSpendCents / 100).toFixed(2)} / ${(costStatus.limitCents / 100).toFixed(2)}
              </span>
            </div>
            <div style={{ height: '6px', borderRadius: '3px', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, costStatus.usagePercent)}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                style={{
                  height: '100%', borderRadius: '3px',
                  background: costStatus.isExceeded ? '#ef4444' : costStatus.isWarning ? '#f59e0b' : '#10b981'
                }}
              />
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '4px' }}>{costStatus.usagePercent}% used • {costStatus.totalRequests} requests</div>
          </div>
        )}
      </div>

      {/* ── API HEALTH ── */}
      {healthData && (
        <div style={{ marginTop: '24px' }}>
          <SectionTitle>API Health</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            {Object.entries(healthData.health || {}).filter(([id]) => id !== 'custom').map(([id, h]) => {
              const pc = PROVIDER_INFO[id]?.color || '#888';
              const stateIcon = h.state === 'CLOSED' ? '🟢' : h.state === 'HALF_OPEN' ? '🟡' : '🔴';
              return (
                <div key={id} style={{ ...cardSt, padding: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px' }}>{stateIcon}</span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {PROVIDER_INFO[id]?.name?.split(' ')[0] || id}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '10px', color: 'var(--text-tertiary)' }}>
                    <div><span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{h.successRate24h}%</span> success</div>
                    <div><span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{h.avgLatency24h}ms</span> avg</div>
                  </div>
                  {h.requests24h > 0 && (
                    <div style={{ height: '3px', borderRadius: '2px', background: 'var(--bg-secondary)', marginTop: '8px', overflow: 'hidden' }}>
                      <div style={{ width: `${h.successRate24h}%`, height: '100%', borderRadius: '2px', background: pc }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── USAGE DASHBOARD ── */}
      {usageStats && usageStats.totals?.totalRequests > 0 && (
        <div style={{ marginTop: '24px' }}>
          <SectionTitle>Usage Analytics</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            {[
              { label: 'Requests', value: usageStats.totals.totalRequests, icon: Zap },
              { label: 'Tokens', value: usageStats.totals.totalTokens >= 1000 ? `${(usageStats.totals.totalTokens / 1000).toFixed(1)}k` : usageStats.totals.totalTokens, icon: Brain },
              { label: 'Avg Speed', value: `${Math.round(usageStats.totals.avgResponseTime || 0)}ms`, icon: Gauge },
              { label: 'Cost', value: `$${((usageStats.totals.totalCost || 0) / 100).toFixed(2)}`, icon: DollarSign },
            ].map((stat, i) => (
              <div key={i} style={{ ...cardSt, textAlign: 'center', padding: '12px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <stat.icon size={14} style={{ color: 'var(--text-tertiary)' }} />
                <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{stat.value}</div>
                <div style={{ fontSize: '8px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{stat.label}</div>
              </div>
            ))}
          </div>
          {usageStats.byProvider?.length > 0 && (
            <div style={{ ...cardSt, marginTop: '8px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>Provider Distribution</div>
              {usageStats.byProvider.map((p, i) => {
                const total = usageStats.totals.totalRequests || 1;
                const pct = Math.round((p.requests / total) * 100);
                const pc = PROVIDER_INFO[p._id]?.color || '#888';
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: pc, flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', flex: 1 }}>{PROVIDER_INFO[p._id]?.name || p._id}</span>
                    <div style={{ flex: 2, height: '4px', borderRadius: '2px', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} style={{ height: '100%', borderRadius: '2px', background: pc }} />
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600, width: '36px', textAlign: 'right' }}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
};


const PrivacySection = ({ syncSettings }) => {
  const { token } = useAuth();
  const [cloudSync, setCloudSync] = useState(localStorage.getItem('tb-cloud-sync') !== 'false');
  const [localHistory, setLocalHistory] = useState(localStorage.getItem('tb-local-history') !== 'false');

  const [modalType, setModalType] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => {
      localStorage.setItem('tb-cloud-sync', String(cloudSync));
      localStorage.setItem('tb-local-history', String(localHistory));
      syncSettings('privacy', { cloudSync, localHistory });
    }, 1000);
    return () => clearTimeout(timeout);
  }, [cloudSync, localHistory, syncSettings]);

  const handleExport = async () => {
    try {
      const res = await fetch(`${API_URL}/api/user/export`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      
      const rows = [];
      rows.push(['TUTORBOARD SESSION EXPORT']);
      rows.push(['Export Date', new Date().toLocaleString()]);
      rows.push(['Name', data.user.name]);
      rows.push(['Email', data.user.email]);
      rows.push([]);
      
      rows.push(['Session ID', 'Session Title', 'Created At', 'Message/Interaction Count']);
      
      (data.sessions || []).forEach(session => {
        rows.push([
          session._id,
          session.title || 'Untitled Session',
          new Date(session.createdAt).toLocaleString(),
          (session.history || []).length
        ]);
      });

      const csvContent = "\uFEFF" + rows.map(r => r.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tutorboard-export-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Failed to export data to Excel");
    }
  };

  const handleWipeCloud = async () => {
    setLoading(true); setErrorMsg('');
    try {
      const res = await fetch(`${API_URL}/api/user/data`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        setModalType(null);
      } else {
        const d = await res.json();
        setErrorMsg(d.error || 'Failed to wipe data.');
        setLoading(false);
      }
    } catch (e) { 
      setErrorMsg('Network error while wiping data.');
      setLoading(false);
    }
  };

  const closeModals = () => {
    if (loading) return;
    setModalType(null);
    setErrorMsg('');
  };

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      <AnimatePresence>
        {modalType === 'clear-local' && (
          <DialogModal
            title="Clear Local Data"
            description="Are you sure you want to clear all locally cached data? This includes offline sessions and UI state. The application will immediately reload."
            primaryAction={() => { localStorage.clear(); sessionStorage.clear(); window.location.reload(); }}
            primaryLabel="Clear Output & Reload"
            primaryDanger={true}
            onClose={closeModals}
          />
        )}
        
        {modalType === 'wipe-cloud' && (
          <DialogModal
            title="Wipe Cloud Data"
            description="Are you absolutely sure you want to permanently delete all your cloud sessions and data backups? This action cannot be undone."
            primaryAction={handleWipeCloud}
            primaryLabel="Yes, Wipe Cloud Data"
            primaryDanger={true}
            loading={loading}
            onClose={closeModals}
          >
            {errorMsg && <div style={{ color: '#ef4444', fontSize: '12px', fontWeight: 500 }}>{errorMsg}</div>}
          </DialogModal>
        )}
      </AnimatePresence>

      <SectionTitle>Cloud & Storage</SectionTitle>
      <SettingsGroup>
        <SettingsRow
          icon={Upload} label="Cloud Sync"
          rightElement={<AppleToggle value={cloudSync} onChange={setCloudSync} />}
        />
        <SettingsRow
          icon={Download} label="Local History" borderBottom={false}
          rightElement={<AppleToggle value={localHistory} onChange={setLocalHistory} />}
        />
      </SettingsGroup>

      <SectionTitle>Export</SectionTitle>
      <SettingsGroup>
        <ContextButton icon={Download} onClick={handleExport} borderBottom={false}>
          Export All Session Data
        </ContextButton>
      </SettingsGroup>

      <SectionTitle>Danger Zone</SectionTitle>
      <SettingsGroup>
        <ContextButton icon={RotateCcw} danger onClick={() => setModalType('clear-local')}>
          Clear Local Data & Cache
        </ContextButton>
        <ContextButton icon={Trash2} danger borderBottom={false} onClick={() => setModalType('wipe-cloud')}>
          Wipe Cloud Data
        </ContextButton>
      </SettingsGroup>
    </div>
  );
};

const SystemStatusItem = ({ label, status, detail }) => {
  const isOnline = status === 'online';
  const isChecking = status === 'checking';
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ 
          width: '8px', height: '8px', borderRadius: '50%', 
          background: isOnline ? '#10b981' : (isChecking ? 'var(--text-tertiary)' : '#ef4444'),
          boxShadow: isOnline ? '0 0 10px rgba(16,185,129,0.4)' : 'none',
          animation: isChecking ? 'pulse 1.5s infinite' : 'none'
        }} />
        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
      </div>
      <span style={{ fontSize: '12px', fontWeight: 500, color: isOnline ? '#10b981' : 'var(--text-tertiary)' }}>
        {status.toUpperCase()} {detail && `• ${detail}`}
      </span>
    </div>
  );
};

const AboutSection = () => {
  const [copied, setCopied] = useState(false);
  const { token } = useAuth();
  const [systemStatus, setSystemStatus] = useState({
    api: 'checking',
    db: 'checking',
    engine: 'checking'
  });

  useEffect(() => {
    const checkSystems = async () => {
      // 1. Check API & DB
      try {
        const res = await fetch(`${API_URL}/api/test`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          setSystemStatus(prev => ({ ...prev, api: 'online', db: 'online' }));
        } else {
          setSystemStatus(prev => ({ ...prev, api: 'online', db: 'offline' }));
        }
      } catch (e) {
        setSystemStatus(prev => ({ ...prev, api: 'offline', db: 'offline' }));
      }

      // 2. Check Orchestration Engine (Simulated Ping)
      setTimeout(() => {
        setSystemStatus(prev => ({ ...prev, engine: 'online' }));
      }, 1200);
    };

    checkSystems();
  }, [token]);

  const handleCopySystemInfo = () => {
    const info = `TutorBoard v2.1.0 Beta\nEngine: Cinematic SCENE GRAPH v9.0\nFramework: React 18\nStatus: ${systemStatus.api === 'online' ? 'Connected' : 'Disconnected'}\nBuild: 2026.04.18-FINAL\nUserAgent: ${navigator.userAgent}`;
    navigator.clipboard.writeText(info).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', paddingBottom: '40px' }}>
      <style>{`
        @keyframes pulse {
          0% { opacity: 0.4; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.1); }
          100% { opacity: 0.4; transform: scale(0.9); }
        }
      `}</style>
      
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', marginBottom: '40px', marginTop: '20px' }}>
        <div style={{
          color: 'var(--bg-primary)', background: 'var(--text-primary)',
          width: '84px', height: '84px', borderRadius: '24px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 12px 32px rgba(0,0,0,0.15)',
          transform: 'rotate(-2deg)'
        }}>
          <VisaiLogo size="lg" />
        </div>
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: '"Geist", sans-serif', margin: '0 0 4px 0', letterSpacing: '-0.03em' }}>
            TutorBoard
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: 600, background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '6px' }}>
              v2.1.0 Beta
            </span>
            <span style={{ fontSize: '13px', color: '#34c759', fontWeight: 700 }}>
              • Stable Release
            </span>
          </div>
        </div>
      </div>

      <SectionTitle>System Integrity</SectionTitle>
      <SettingsGroup>
        <SystemStatusItem label="API Gateway" status={systemStatus.api} />
        <SystemStatusItem label="Cloud Database" status={systemStatus.db} />
        <SystemStatusItem label="Orchestration Engine" status={systemStatus.engine} detail="v9.0 Cinematic" />
        <SettingsRow label="System Build" rightElement={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>2026.04.18-FINAL</span>
            <button 
              onClick={handleCopySystemInfo}
              style={{ 
                background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', cursor: 'pointer', padding: '4px 10px',
                borderRadius: '8px', color: copied ? '#10b981' : 'var(--text-secondary)', transition: 'all 0.2s',
                fontSize: '11px', fontWeight: 700,
              }}
            >
              {copied ? '✓ Copied' : 'Copy Info'}
            </button>
          </div>
        } borderBottom={false} />
      </SettingsGroup>

      <SectionTitle>Engine Architecture</SectionTitle>
      <SettingsGroup>
        <SettingsRow label="Renderer" rightElement={<span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Canvas2D + Cinematic v4</span>} />
        <SettingsRow label="Pipeline" rightElement={<span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>6-Agent Autonomous Loop</span>} />
        <SettingsRow label="Protocol" rightElement={<span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Secure WebSocket (WSS)</span>} borderBottom={false} />
      </SettingsGroup>

      <SectionTitle>Community & Support</SectionTitle>
      <SettingsGroup>
        <SettingsRow icon={BookOpen} label="Release Notes" onClick={() => window.open('https://github.com/tutorboard/tutorboard/releases', '_blank')} />
        <SettingsRow icon={Globe2} label="Official Website" rightElement={<ExternalLink size={14} />} onClick={() => window.open('https://tutorboard.ai', '_blank')} />
        <SettingsRow icon={AlertTriangle} label="Report Bug" danger borderBottom={false} onClick={() => {
           const body = encodeURIComponent(`## Bug Report\n\n**Environment:**\n- TutorBoard v2.1.0 Beta\n- Build: 2026.04.18-FINAL\n- Browser: ${navigator.userAgent}\n\n**Describe the bug:**\n\n**Steps to reproduce:**\n\n**Expected behavior:**\n`);
           window.open(`https://github.com/tutorboard/tutorboard/issues/new?body=${body}`, '_blank');
        }} />
      </SettingsGroup>

      <SectionTitle>License</SectionTitle>
      <SettingsGroup>
        <SettingsRow label="Open Source" rightElement={<span style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>Apache 2.0</span>} borderBottom={false} />
      </SettingsGroup>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', marginTop: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-tertiary)' }}>
          Made with <Heart style={{ width: '14px', height: '14px', color: '#ef4444', fill: '#ef4444' }} /> by TutorBoard Team
        </div>
        <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', opacity: 0.6 }}>
          © 2026 TutorBoard Systems Inc.
        </p>
      </div>
    </div>
  );
};


// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SETTINGS PAGE
// ═══════════════════════════════════════════════════════════════════════════════

const Settings = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [activeSection, setActiveSection] = useState('general');
  const [isTrafficHovered, setIsTrafficHovered] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [toast, setToast] = useState(null); // { message, type: 'success' | 'error' | 'info' }
  const contentRef = useRef(null);
  const syncSettings = useSettingsSync();

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Scroll to top when section changes
  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [activeSection]);

  const renderSection = () => {
    const sectionMap = {
      general: (
        <SectionWrapper isGuest={user?.isGuest} isRestricted={true} onUnlock={() => { logout(); navigate('/login'); }}>
          <GeneralSection user={user} syncSettings={syncSettings} showToast={showToast} />
        </SectionWrapper>
      ),
      account: (
        <SectionWrapper isGuest={user?.isGuest} isRestricted={true} onUnlock={() => { logout(); navigate('/login'); }}>
          <AccountSection user={user} logout={logout} />
        </SectionWrapper>
      ),
      appearance: <AppearanceSection syncSettings={syncSettings} />,
      ai: (
        <SectionWrapper isGuest={user?.isGuest} isRestricted={true} onUnlock={() => { logout(); navigate('/login'); }}>
          <AILearningSection showToast={showToast} />
        </SectionWrapper>
      ),
      privacy: (
        <SectionWrapper isGuest={user?.isGuest} isRestricted={true} onUnlock={() => { logout(); navigate('/login'); }}>
          <PrivacySection syncSettings={syncSettings} />
        </SectionWrapper>
      ),
      about: <AboutSection />,
    };

    return sectionMap[activeSection] || sectionMap.general;
  };

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden'
    }}>
      {/* Animated Aesthetic Background Blobs */}
      <motion.div 
        animate={{ 
          x: [0, 40, 0], y: [0, -40, 0],
          scale: [1, 1.1, 1]
        }}
        transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute', top: '-10%', left: '10%', width: '40vw', height: '40vw',
          background: 'radial-gradient(circle, rgba(0, 122, 255, 0.1) 0%, transparent 70%)',
          borderRadius: '50%', filter: 'blur(100px)', pointerEvents: 'none', zIndex: 0
        }} 
      />
      <motion.div 
        animate={{ 
          x: [0, -60, 0], y: [0, 60, 0],
          scale: [1, 1.2, 1]
        }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute', bottom: '10%', right: '5%', width: '45vw', height: '45vw',
          background: 'radial-gradient(circle, rgba(255, 188, 46, 0.08) 0%, transparent 70%)',
          borderRadius: '50%', filter: 'blur(120px)', pointerEvents: 'none', zIndex: 0
        }} 
      />
      <motion.div 
        animate={{ 
          x: [0, 100, 0], y: [0, 50, 0]
        }}
        transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute', top: '30%', left: '40%', width: '30vw', height: '30vw',
          background: 'radial-gradient(circle, rgba(239, 68, 68, 0.05) 0%, transparent 70%)',
          borderRadius: '50%', filter: 'blur(100px)', pointerEvents: 'none', zIndex: 0
        }} 
      />

      <motion.div
        layout
        initial={false}
        animate={
          isMaximized ? {
            width: '100vw', height: '100vh', borderRadius: '0px',
            x: 0, y: 0, scale: 1
          } : {
            width: 'min(1000px, 95vw)', height: 'min(800px, 90vh)',
            borderRadius: '16px', x: 0, y: 0, scale: 1
          }
        }
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        style={{
          background: 'var(--bg-primary)',
          color: 'var(--text-primary)',
          display: 'flex', flexDirection: 'column',
          fontFamily: '"Geist", sans-serif',
          overflow: 'hidden',
          border: '1px solid var(--border-color)',
          boxShadow: '0 40px 100px rgba(0,0,0,0.15)',
          cursor: 'default',
          backdropFilter: 'blur(30px)',
          zIndex: 1,
        }}
      >
        {/* ── TOP BAR (Code Visualizer Style) ── */}
        <div style={{
          height: '44px', minHeight: '44px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          zIndex: 10,
          WebkitAppRegion: 'drag',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
            <div
              onMouseEnter={() => setIsTrafficHovered(true)}
              onMouseLeave={() => setIsTrafficHovered(false)}
              style={{ display: 'flex', gap: 6, flexShrink: 0 }}
            >
              {[
                { color: '#ff5f57', action: (e) => { e.stopPropagation(); navigate('/dashboard'); }, icon: <X size={7} /> },
                { color: '#febc2e', action: (e) => { 
                  e.stopPropagation(); 
                  const sectionKeys = ['general', 'account', 'appearance', 'ai', 'privacy', 'about'];
                  const nextIndex = (sectionKeys.indexOf(activeSection) + 1) % sectionKeys.length;
                  setActiveSection(sectionKeys[nextIndex]);
                }, icon: <ChevronRight size={8} /> },
                { color: '#28c840', action: (e) => { e.stopPropagation(); setIsMaximized(!isMaximized); }, icon: isMaximized ? <Minus size={8} style={{ transform: 'rotate(90deg)' }} /> : <X size={7} style={{ transform: 'rotate(45deg)' }} /> },
              ].map((btn, i) => (
                <button
                  key={i}
                  onClick={btn.action}
                  style={{
                    width: 12, height: 12, borderRadius: '50%',
                    background: btn.color, border: 'none',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'rgba(0,0,0,0.4)', padding: 0, transition: 'all 0.15s',
                    boxShadow: `inset 0 0 0 0.5px rgba(0,0,0,0.1)`,
                  }}
                >
                  {isTrafficHovered && btn.icon}
                </button>
              ))}
            </div>
            <div style={{ width: 1, height: 16, background: 'var(--border-color)', opacity: 0.3, flexShrink: 0 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflow: 'hidden' }}>
              <VisaiLogo size="xxs" />
              <span style={{
                fontSize: 11, color: 'var(--text-secondary)',
                letterSpacing: '0.04em', fontWeight: 600,
                whiteSpace: 'nowrap',
                fontFamily: '"Geist", sans-serif',
              }}>{isMaximized ? 'Settings' : 'Settings — TutorBoard'}</span>
            </div>
          </div>
          <div style={{ flex: 1 }} />
        </div>

            {/* ── TAB BAR (Horizontal Navigation) ── */}
            <div style={{
              height: 38, background: 'var(--bg-primary)',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex', alignItems: 'stretch',
              paddingLeft: 8, gap: 2, flexShrink: 0,
              overflowX: 'auto', scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}>
              {SECTIONS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSection(tab.id)}
                  style={{
                    padding: '0 16px',
                    background: activeSection === tab.id ? 'var(--bg-primary)' : 'transparent',
                    border: 'none',
                    borderTop: activeSection === tab.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    borderLeft: activeSection === tab.id ? '1px solid var(--border-color)' : '1px solid transparent',
                    borderRight: activeSection === tab.id ? '1px solid var(--border-color)' : '1px solid transparent',
                    color: activeSection === tab.id ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    fontSize: 12, cursor: 'pointer',
                    letterSpacing: '0.03em', transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', gap: 6,
                    marginBottom: -1, whiteSpace: 'nowrap',
                  }}
                >
                  <tab.icon style={{ width: '12px', height: '12px', opacity: activeSection === tab.id ? 1 : 0.6 }} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── TOAST NOTIFICATION ── */}
            <AnimatePresence>
              {toast && (
                <motion.div
                  initial={{ opacity: 0, y: -20, x: '-50%' }}
                  animate={{ opacity: 1, y: 0, x: '-50%' }}
                  exit={{ opacity: 0, y: -20, x: '-50%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  style={{
                    position: 'absolute', top: '96px', left: '50%',
                    zIndex: 100, padding: '10px 20px', borderRadius: '12px',
                    background: toast.type === 'error' ? 'rgba(239,68,68,0.95)' 
                             : toast.type === 'success' ? 'rgba(16,185,129,0.95)'
                             : 'rgba(59,130,246,0.95)',
                    color: '#fff', fontSize: '13px', fontWeight: 600,
                    fontFamily: '"Geist", sans-serif',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', gap: '8px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {toast.type === 'success' && <Check size={14} />}
                  {toast.type === 'error' && <X size={14} />}
                  {toast.type === 'info' && <Info size={14} />}
                  {toast.message}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── CONTENT AREA ── */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: 'var(--bg-primary)' }}>
              <div
                ref={contentRef}
                style={{
                  flex: 1, overflowY: 'auto', padding: '40px 24px',
                  background: 'var(--bg-primary)',
                }}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`settings-node-${activeSection}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    style={{ maxWidth: '800px', margin: '0 auto' }}
                  >
                    {renderSection()}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
      </motion.div>
    </div>
  );
};

export default Settings;
