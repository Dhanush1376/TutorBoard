import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Volume2, Bell, BellOff, ShieldAlert, Sparkles, User, Mail, GraduationCap } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  SectionTitle, SettingsGroup, SettingsRow,
  AppleToggle, RightInlineInput, RightInlineSelect,
  TrialBadge
} from './SettingsShared';

const AVATAR_PALETTE = [
  ['#f97316', '#fff7ed'],
  ['#8b5cf6', '#f5f3ff'],
  ['#10b981', '#ecfdf5'],
  ['#3b82f6', '#eff6ff'],
  ['#f43f5e', '#fff1f2'],
  ['#06b6d4', '#ecfeff'],
];

function getAvatarColor(name = '') {
  const idx = name.charCodeAt(0) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[idx] || AVATAR_PALETTE[0];
}

function AvatarCircle({ name, size = 64 }) {
  const initials = name
    ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';
  const [bg, fg] = getAvatarColor(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: '18px',
      background: bg, color: fg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 600, letterSpacing: '-0.02em',
      flexShrink: 0, userSelect: 'none',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      border: `1.5px solid var(--border-color)`,
      position: 'relative',
    }}>
      {initials}
    </div>
  );
}

const MAX_PREFS = 300;

const ROLE_OPTIONS = [
  { value: '', label: 'Select role...' },
  { value: 'student-high-school', label: '🎒 High School Student' },
  { value: 'student-undergrad', label: '🎓 Undergraduate Student' },
  { value: 'student-grad', label: '📚 Graduate Student' },
  { value: 'teacher', label: '🏫 Teacher / Professor' },
  { value: 'professional', label: '💼 Professional' },
  { value: 'self-learner', label: '🔍 Self Learner' },
];

export default function GeneralSection({ user, syncSettings, showToast }) {
  const { updateUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.name || '');
  const [nickname, setNickname] = useState(
    localStorage.getItem('tb-nickname') || user?.name?.split(' ')[0] || ''
  );
  const [role, setRole] = useState(localStorage.getItem('tb-role') || '');
  const [preferences, setPreferences] = useState(localStorage.getItem('tb-ai-preferences') || '');
  const [notifCompletion, setNotifCompletion] = useState(
    localStorage.getItem('tb-notif-completion') !== 'false'
  );
  const [notifSound, setNotifSound] = useState(
    localStorage.getItem('tb-notif-sound') !== 'false'
  );
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'saved'
  const lastSavedName = useRef(user?.name);
  const isGuest = user?.isGuest;

  useEffect(() => {
    const timeout = setTimeout(() => {
      localStorage.setItem('tb-nickname', nickname);
      localStorage.setItem('tb-role', role);
      localStorage.setItem('tb-ai-preferences', preferences);
      localStorage.setItem('tb-notif-completion', String(notifCompletion));
      localStorage.setItem('tb-notif-sound', String(notifSound));

      setSaveStatus('saving');
      if (displayName && displayName !== lastSavedName.current) {
        updateUser({ name: displayName });
        lastSavedName.current = displayName;
      }
      syncSettings('general', { nickname, role, preferences, name: displayName, notifCompletion, notifSound });
      setTimeout(() => setSaveStatus('saved'), 400);
      setTimeout(() => setSaveStatus(null), 2200);
    }, 600);
    return () => clearTimeout(timeout);
  }, [nickname, role, preferences, displayName, notifCompletion, notifSound]);

  const handleNotifToggle = async (val) => {
    if (val) {
      if (!('Notification' in window)) {
        showToast('Notifications not supported in this browser.', 'error');
        return;
      }
      if (Notification.permission !== 'granted') {
        const result = await Notification.requestPermission();
        if (result !== 'granted') {
          showToast('Permission denied — enable notifications in browser settings.', 'error');
          return;
        }
      }
    }
    setNotifCompletion(val);
  };

  const prefsLeft = MAX_PREFS - preferences.length;
  const prefsOverLimit = prefsLeft < 0;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 20 } }
  };

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      style={{ maxWidth: '640px', margin: '0 auto', paddingBottom: '100px' }}
    >
      {/* Guest Banner */}
      {isGuest && (
        <motion.div
          variants={itemVariants}
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid rgba(59,130,246,0.3)',
            borderRadius: '20px', padding: '18px 22px', marginBottom: '32px',
            display: 'flex', alignItems: 'center', gap: '18px',
            boxShadow: '0 4px 20px rgba(59,130,246,0.06)',
          }}
        >
          <div style={{
            width: '44px', height: '44px', borderRadius: '14px',
            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', flexShrink: 0,
            boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
          }}>
            <ShieldAlert size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 2px', letterSpacing: '-0.01em' }}>
              Guest Mode Active
            </p>
            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: 0, lineHeight: 1.5 }}>
              Some personalization features are limited. 
              Sign in to unlock persistent AI preferences and cloud sync.
            </p>
          </div>
        </motion.div>
      )}

      {/* Profile Header Card — Premium Glassmorphism */}
      <motion.div 
        variants={itemVariants}
        style={{
          display: 'flex', alignItems: 'center', gap: '28px',
          marginBottom: '40px', padding: '32px',
          background: 'var(--bg-secondary)', borderRadius: '28px',
          border: '1px solid var(--border-color)',
          position: 'relative', overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ position: 'absolute', top: -100, right: -100, width: '300px', height: '300px', background: 'radial-gradient(circle, var(--accent-primary)08, transparent 70%)', pointerEvents: 'none' }} />
        
        <div style={{ position: 'relative' }}>
          <AvatarCircle name={displayName} size={84} />
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5, type: 'spring' }}
            style={{ position: 'absolute', bottom: -2, right: -2, width: '24px', height: '24px', borderRadius: '50%', background: 'var(--bg-primary)', border: '1.5px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
          >
            <Check size={14} strokeWidth={3} />
          </motion.div>
        </div>

        <div style={{ flex: 1, minWidth: 0, zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.03em' }}>
              {displayName || 'Your Name'}
            </h2>
            {isGuest && <TrialBadge />}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px', opacity: 0.8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Mail size={13} style={{ color: 'var(--text-tertiary)' }} />
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                {user?.email || 'guest@tutorboard.ai'}
              </span>
            </div>
            <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'var(--text-tertiary)', opacity: 0.4 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <GraduationCap size={13} style={{ color: 'var(--text-tertiary)' }} />
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                {ROLE_OPTIONS.find(o => o.value === role)?.label.split(' ').pop() || 'Learner'}
              </span>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {saveStatus && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              style={{
                position: 'absolute', top: '24px', right: '24px',
                display: 'flex', alignItems: 'center', gap: '8px',
                fontSize: '11px', fontWeight: 700,
                color: saveStatus === 'saved' ? '#10b981' : '#007AFF',
                padding: '6px 14px', borderRadius: '12px',
                background: saveStatus === 'saved' ? 'rgba(16,185,129,0.08)' : 'rgba(0,122,255,0.08)',
                border: '1px solid',
                borderColor: saveStatus === 'saved' ? 'rgba(16,185,129,0.2)' : 'rgba(0,122,255,0.2)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                letterSpacing: '0.02em', textTransform: 'uppercase'
              }}
            >
              {saveStatus === 'saved' ? <Check size={12} strokeWidth={3.5} /> : <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} style={{ width: 10, height: 10, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%' }} />}
              {saveStatus === 'saving' ? 'Syncing' : 'Synced'}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Profile Details */}
      <motion.div variants={itemVariants}>
        <SectionTitle>Profile Details</SectionTitle>
        <SettingsGroup>
          <SettingsRow
            label="Full Name"
            icon={User}
            rightElement={
              <RightInlineInput
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your full name"
                disabled={isGuest}
              />
            }
          />
          <SettingsRow
            label="Preferred Name"
            description="How the AI assistant addresses you"
            rightElement={
              <RightInlineInput
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                placeholder="e.g. Alex"
                disabled={isGuest}
              />
            }
          />
          <SettingsRow
            label="Current Role"
            borderBottom={false}
            rightElement={
              <RightInlineSelect
                value={role}
                onChange={setRole}
                disabled={isGuest}
                options={ROLE_OPTIONS}
              />
            }
          />
        </SettingsGroup>
      </motion.div>

      {/* AI Instructions */}
      <motion.div variants={itemVariants}>
        <SectionTitle>AI Configuration</SectionTitle>
        <SettingsGroup>
          <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 32, height: 32, borderRadius: '10px', background: 'linear-gradient(135deg, #FF9500, #FFB033)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(255,149,0,0.2)' }}>
                  <Sparkles size={18} strokeWidth={2} />
                </div>
                <div>
                  <label style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', display: 'block', letterSpacing: '-0.01em' }}>
                    Custom Behavior
                  </label>
                  <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 500 }}>Shape how the AI responds globally</span>
                </div>
              </div>
              <span style={{
                fontSize: '11px', fontWeight: 700,
                color: prefsOverLimit ? '#ef4444' : 'var(--text-tertiary)',
                background: 'var(--bg-tertiary)',
                padding: '5px 10px',
                borderRadius: '10px',
                fontFamily: '"Geist Mono", monospace'
              }}>
                {prefsLeft}
              </span>
            </div>
            <div style={{ position: 'relative' }}>
              <textarea
                value={preferences}
                onChange={e => setPreferences(e.target.value.slice(0, MAX_PREFS + 20))}
                disabled={isGuest}
                placeholder={
                  isGuest
                    ? 'Sign in to add custom instructions...'
                    : 'e.g. Always explain with real-world analogies. I prefer concise answers with code examples...'
                }
                style={{
                  width: '100%', padding: '18px',
                  resize: 'vertical', minHeight: '140px', maxHeight: '400px',
                  background: 'var(--bg-primary)',
                  border: `1.5px solid ${prefsOverLimit ? '#ef444466' : 'var(--border-color)'}`,
                  borderRadius: '20px',
                  color: 'var(--text-primary)', fontSize: '14px',
                  fontFamily: '"Geist", sans-serif',
                  lineHeight: 1.7, outline: 'none',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxSizing: 'border-box',
                  opacity: isGuest ? 0.6 : 1,
                  boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.02)'
                }}
                onFocus={e => {
                  if (!prefsOverLimit) {
                    e.target.style.borderColor = 'var(--accent-primary)';
                    e.target.style.boxShadow = '0 0 0 4px var(--accent-primary)15';
                  }
                }}
                onBlur={e => {
                  e.target.style.borderColor = prefsOverLimit ? '#ef444466' : 'var(--border-color)';
                  e.target.style.boxShadow = 'none';
                }}
              />
              <div style={{ position: 'absolute', bottom: '16px', right: '16px', pointerEvents: 'none', opacity: 0.2 }}>
                <Sparkles size={20} style={{ color: 'var(--text-tertiary)' }} />
              </div>
            </div>
          </div>
        </SettingsGroup>
      </motion.div>

      {/* Notifications */}
      <motion.div variants={itemVariants}>
        <SectionTitle>Experience</SectionTitle>
        <SettingsGroup>
          <SettingsRow
            icon={notifCompletion ? Bell : BellOff}
            label="Push Notifications"
            description="Get real-time updates when an agent finishes a task"
            rightElement={<AppleToggle value={notifCompletion} onChange={handleNotifToggle} />}
          />
          <SettingsRow
            icon={Volume2}
            label="Audio Feedback"
            description="Enable subtle sound effects for pedagogical transitions"
            borderBottom={false}
            rightElement={<AppleToggle value={notifSound} onChange={setNotifSound} />}
          />
        </SettingsGroup>
      </motion.div>
    </motion.div>
  );
}