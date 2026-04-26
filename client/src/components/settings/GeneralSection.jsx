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

function AvatarCircle({ user, size = 64 }) {
  const name = user?.name || '';
  const initials = name
    ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';
  const [bg, fg] = getAvatarColor(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: '18px',
      background: bg, color: fg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 500, letterSpacing: '-0.02em',
      flexShrink: 0, userSelect: 'none',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      border: `1.5px solid var(--border-color)`,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {user?.avatar && !user.isGuest ? (
        <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', objectCover: 'cover' }} />
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
  const isFirstRender = useRef(true);
  const initialState = useRef({ nickname, role, preferences, notifCompletion, notifSound, displayName });
  const isGuest = user?.isGuest;

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
      style={{ maxWidth: '640px', margin: '0 auto', paddingBottom: '20px' }}
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
            <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px', letterSpacing: '-0.01em' }}>
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
          display: 'flex', alignItems: 'center', gap: '20px',
          marginBottom: '24px', padding: '20px',
          background: 'var(--bg-secondary)', borderRadius: '24px',
          border: '1px solid var(--border-color)',
          position: 'relative', overflow: 'hidden',
          boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ position: 'absolute', top: -100, right: -100, width: '300px', height: '300px', background: 'radial-gradient(circle, var(--accent-primary)08, transparent 70%)', pointerEvents: 'none' }} />
        
        <div style={{ position: 'relative' }}>
          <AvatarCircle user={user} size={64} />
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.03em' }}>
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
                fontSize: '11px', fontWeight: 600,
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
        <SettingsGroup className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[24px]">
            <div className="p-5">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 text-white flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                    <Sparkles size={20} strokeWidth={2.5} />
                  </div>
                  <div>
                    <label className="text-[14px] font-semibold text-[var(--text-primary)] block tracking-tight leading-tight mb-0.5">
                      Custom Personal & Behaviour
                    </label>
                    <span className="text-[11px] text-[var(--text-tertiary)] font-medium opacity-80">
                      Define your AI's global identity and response style
                    </span>
                  </div>
                </div>
                
                <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase transition-all duration-300 ${prefsOverLimit ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] border border-[var(--border-color)]'}`}>
                  {prefsLeft} <span className="opacity-40 font-normal">chars left</span>
                </div>
              </div>

              <div className="relative">
                <textarea
                  value={preferences}
                  onChange={e => setPreferences(e.target.value.slice(0, MAX_PREFS + 20))}
                  disabled={isGuest}
                  placeholder={
                    isGuest
                      ? 'Sign in to customize your AI assistant...'
                      : 'e.g. "You are a senior software engineer who explains complex concepts using LEGO analogies. Keep responses extremely concise but include code snippets where relevant."'
                  }
                  className={`w-full p-4.5 min-h-[140px] max-h-[300px] bg-[var(--bg-primary)]/50 border-1.5 rounded-2xl text-[13px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)]/50 leading-relaxed outline-none transition-all duration-300 resize-none ${
                    isGuest 
                      ? 'opacity-40 cursor-not-allowed border-[var(--border-color)]' 
                      : prefsOverLimit 
                        ? 'border-red-500/40 focus:border-red-500' 
                        : 'border-[var(--border-color)] focus:border-amber-500/50 focus:bg-[var(--bg-primary)]'
                  }`}
                />
                
                {/* Floating Decoration */}
                <div className="absolute bottom-4 right-4 pointer-events-none transition-opacity duration-500 opacity-10 group-focus-within:opacity-30">
                  <Sparkles size={24} className="text-amber-500" />
                </div>
                
                {/* Visual Guidelines */}
                {!isGuest && !preferences && (
                  <div className="absolute top-16 left-5 right-5 pointer-events-none space-y-2 opacity-30 select-none">
                    <div className="h-2 w-3/4 bg-[var(--text-tertiary)]/20 rounded-full" />
                    <div className="h-2 w-1/2 bg-[var(--text-tertiary)]/20 rounded-full" />
                  </div>
                )}
              </div>

              {/* Professional Prompt Suggestions */}
              {!isGuest && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {[
                    { label: 'Conceptual Focus', text: 'Prioritize conceptual understanding over direct answers.' },
                    { label: 'Technical Depth', text: 'Provide detailed technical explanations with code.' },
                    { label: 'Iterative Learning', text: 'Ask follow-up questions to verify my understanding.' }
                  ].map((chip) => (
                    <button
                      key={chip.label}
                      onClick={() => {
                        const newPrefs = preferences ? `${preferences} ${chip.text}` : chip.text;
                        if (newPrefs.length <= MAX_PREFS) setPreferences(newPrefs);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)] hover:bg-[var(--text-primary)]/5 border border-[var(--border-color)] text-[10px] font-semibold text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all uppercase tracking-wider"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              )}
              
              {isGuest && (
                <div className="mt-4 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 flex items-center gap-3">
                  <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-500">
                    <Sparkles size={14} />
                  </div>
                  <p className="text-[11px] text-amber-500/80 font-medium leading-tight">
                    Custom instructions are a pro feature. Create an account to save your AI persona.
                  </p>
                </div>
              )}
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