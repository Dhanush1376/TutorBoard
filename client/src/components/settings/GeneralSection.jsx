import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Bell, BellOff, Sparkles, User, Mail, GraduationCap } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  SectionTitle, SettingsGroup, SettingsRow,
  AppleToggle, RightInlineInput, RightInlineSelect
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

function AvatarCircle({ user, size = 48 }) {
  const [imgError, setImgError] = useState(false);
  const name = user?.name || '';
  const initials = name
    ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';
  const [bg, fg] = getAvatarColor(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: '14px',
      background: bg, color: fg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 500, letterSpacing: '-0.02em',
      flexShrink: 0, userSelect: 'none',
      transition: 'all 0.2s ease',
      overflow: 'hidden',
    }}>
      {user?.avatar && !user.isGuest && !imgError ? (
        <img 
          src={user.avatar} 
          alt="" 
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
          onError={() => setImgError(true)}
        />
      ) : (
        initials
      )}
    </div>
  );
}

const MAX_PREFS = 300;

const ROLE_OPTIONS = [
  { value: '', label: 'Select role...' },
  { value: 'student-high-school', label: 'High School Student' },
  { value: 'student-undergrad', label: 'Undergraduate Student' },
  { value: 'student-grad', label: 'Graduate Student' },
  { value: 'teacher', label: 'Teacher / Professor' },
  { value: 'professional', label: 'Professional' },
  { value: 'self-learner', label: 'Self Learner' },
];

export default function GeneralSection({ user, syncSettings, showToast }) {
  const { updateUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.name || '');
  
  // Fix S-05: Initialize from user settings (server-side) or sessionStorage (ephemeral fallback)
  const [nickname, setNickname] = useState(() => {
    return user?.settings?.general?.nickname || 
           sessionStorage.getItem('tb-nickname') || 
           user?.name?.split(' ')[0] || '';
  });
  
  const [role, setRole] = useState(() => {
    return user?.settings?.general?.role || 
           sessionStorage.getItem('tb-role') || '';
  });
  
  const [preferences, setPreferences] = useState(() => {
    return user?.settings?.general?.preferences || 
           sessionStorage.getItem('tb-ai-preferences') || '';
  });
  
  const [notifCompletion, setNotifCompletion] = useState(() => {
    const serverVal = user?.settings?.general?.notifCompletion;
    if (serverVal !== undefined) return serverVal;
    return sessionStorage.getItem('tb-notif-completion') !== 'false';
  });
  
  const [notifSound, setNotifSound] = useState(() => {
    const serverVal = user?.settings?.general?.notifSound;
    if (serverVal !== undefined) return serverVal;
    return sessionStorage.getItem('tb-notif-sound') !== 'false';
  });
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'saved'
  const lastSavedName = useRef(user?.name);
  const isFirstRender = useRef(true);
  const initialState = useRef({ nickname, role, preferences, notifCompletion, notifSound, displayName });

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const hasChanged = 
      nickname !== initialState.current.nickname ||
      role !== initialState.current.role ||
      preferences !== initialState.current.preferences ||
      notifCompletion !== initialState.current.notifCompletion ||
      notifSound !== initialState.current.notifSound ||
      displayName !== initialState.current.displayName;

    if (!hasChanged) return;

    const timeout = setTimeout(() => {
      // Fix S-05: Migrate from localStorage to sessionStorage for guests
      sessionStorage.setItem('tb-nickname', nickname);
      sessionStorage.setItem('tb-role', role);
      sessionStorage.setItem('tb-ai-preferences', preferences);
      sessionStorage.setItem('tb-notif-completion', String(notifCompletion));
      sessionStorage.setItem('tb-notif-sound', String(notifSound));
      
      // Cleanup insecure localStorage if present
      localStorage.removeItem('tb-nickname');
      localStorage.removeItem('tb-role');
      localStorage.removeItem('tb-ai-preferences');
      localStorage.removeItem('tb-notif-completion');
      localStorage.removeItem('tb-notif-sound');

      setSaveStatus('saving');
      if (displayName && displayName !== lastSavedName.current) {
        updateUser({ name: displayName });
        lastSavedName.current = displayName;
      }
      syncSettings('general', { nickname, role, preferences, name: displayName, notifCompletion, notifSound });
      initialState.current = { nickname, role, preferences, notifCompletion, notifSound, displayName };
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Profile Header */}
      <div 
        style={{
          display: 'flex', alignItems: 'center', gap: '14px',
          padding: '16px',
          background: 'var(--bg-secondary)', borderRadius: '14px',
          border: '1px solid var(--border-color)',
          position: 'relative',
        }}
      >
        <AvatarCircle user={user} size={48} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
            {displayName || 'Your Name'}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Mail size={11} style={{ color: 'var(--text-tertiary)', opacity: 0.6 }} />
              <span style={{ fontSize: '11.5px', color: 'var(--text-tertiary)', fontWeight: 400 }}>
                {user?.email || 'guest@tutorboard.ai'}
              </span>
            </div>
            <span style={{ width: '2px', height: '2px', borderRadius: '50%', background: 'var(--text-tertiary)', opacity: 0.3 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <GraduationCap size={11} style={{ color: 'var(--text-tertiary)', opacity: 0.6 }} />
              <span style={{ fontSize: '11.5px', color: 'var(--text-tertiary)', fontWeight: 400 }}>
                {ROLE_OPTIONS.find(o => o.value === role)?.label.split(' ').pop() || 'Learner'}
              </span>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {saveStatus && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                fontSize: '10px', fontWeight: 500,
                color: saveStatus === 'saved' ? '#10b981' : 'var(--text-tertiary)',
                padding: '4px 10px', borderRadius: '8px',
                background: saveStatus === 'saved' ? 'rgba(16,185,129,0.08)' : 'var(--bg-tertiary)',
              }}
            >
              {saveStatus === 'saved' ? <Check size={10} strokeWidth={3} /> : null}
              {saveStatus === 'saving' ? 'Saving...' : 'Saved'}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Profile Details */}
      <div>
        <SectionTitle>Profile</SectionTitle>
        <SettingsGroup>
          <SettingsRow
            label="Full Name"
            icon={User}
            rightElement={
              <RightInlineInput
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your full name"
              />
            }
          />
          <SettingsRow
            label="Preferred Name"
            description="How the AI addresses you"
            rightElement={
              <RightInlineInput
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                placeholder="e.g. Alex"
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
                options={ROLE_OPTIONS}
              />
            }
          />
        </SettingsGroup>
      </div>

      {/* AI Preferences */}
      <div>
        <SectionTitle>Custom Instructions</SectionTitle>
        <div style={{
          background: 'var(--bg-secondary)',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          padding: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={14} strokeWidth={2} style={{ color: 'var(--text-tertiary)', opacity: 0.6 }} />
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                Behavior & Personality
              </span>
            </div>
            <span style={{
              fontSize: '10px', fontWeight: 500,
              color: prefsOverLimit ? '#ef4444' : 'var(--text-tertiary)',
              opacity: 0.6,
            }}>
              {prefsLeft} left
            </span>
          </div>

          <textarea
            value={preferences}
            onChange={e => setPreferences(e.target.value.slice(0, MAX_PREFS + 20))}
            placeholder='e.g. "Explain concepts using analogies. Keep responses concise but include code snippets."'
            style={{
              width: '100%',
              padding: '12px',
              minHeight: '100px',
              maxHeight: '240px',
              background: 'var(--bg-primary)',
              border: `1px solid ${prefsOverLimit ? 'rgba(239,68,68,0.3)' : 'var(--border-color)'}`,
              borderRadius: '10px',
              color: 'var(--text-primary)',
              fontSize: '12.5px',
              lineHeight: '1.6',
              outline: 'none',
              resize: 'vertical',
              fontFamily: 'inherit',
              transition: 'border-color 0.15s',
              boxSizing: 'border-box',
            }}
          />

          {/* Quick chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
            {[
              { label: 'Conceptual', text: 'Prioritize conceptual understanding over direct answers.' },
              { label: 'Technical', text: 'Provide detailed technical explanations with code.' },
              { label: 'Iterative', text: 'Ask follow-up questions to verify my understanding.' }
            ].map((chip) => (
              <button
                key={chip.label}
                onClick={() => {
                  const newPrefs = preferences ? `${preferences} ${chip.text}` : chip.text;
                  if (newPrefs.length <= MAX_PREFS) setPreferences(newPrefs);
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-tertiary)',
                  fontSize: '10px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.12s',
                  letterSpacing: '0.02em',
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div>
        <SectionTitle>Notifications</SectionTitle>
        <SettingsGroup>
          <SettingsRow
            icon={notifCompletion ? Bell : BellOff}
            label="Push Notifications"
            description="Updates when an agent finishes a task"
            borderBottom={false}
            rightElement={<AppleToggle value={notifCompletion} onChange={handleNotifToggle} />}
          />
        </SettingsGroup>
      </div>
    </div>
  );
}
