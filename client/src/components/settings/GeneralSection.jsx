import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Bell, BellOff, Plus, User, AtSign, GraduationCap } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  SectionTitle, SettingsGroup, SettingsRow,
  AppleToggle, RightInlineInput, RightInlineSelect
} from './SettingsShared';

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
    <div className="flex flex-col gap-5 sm:gap-8 pt-1 sm:pt-6">

      {/* Profile details; a small tick confirms each save */}
      <section className="relative">
        <AnimatePresence>
          {saveStatus && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`absolute -top-6 sm:-top-7 right-1 inline-flex items-center gap-1.5 text-[11.5px] sm:text-[12px] font-medium ${
                saveStatus === 'saved' ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--text-tertiary)]'
              }`}
            >
              {saveStatus === 'saved' ? <Check size={12} strokeWidth={2.6} /> : <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--mk-accent)]" />}
              {saveStatus === 'saving' ? 'Saving' : 'Saved'}
            </motion.div>
          )}
        </AnimatePresence>
        <SettingsGroup>
          <SettingsRow
            icon={User}
            iconTone="blue"
            label="Name"
            rightElement={<RightInlineInput value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your full name" />}
          />
          <SettingsRow
            icon={AtSign}
            iconTone="purple"
            label="Call me"
            rightElement={<RightInlineInput value={nickname} onChange={e => setNickname(e.target.value)} placeholder="e.g. Alex" />}
          />
          <SettingsRow
            icon={GraduationCap}
            iconTone="amber"
            label="I am a"
            rightElement={<RightInlineSelect value={role} onChange={setRole} options={ROLE_OPTIONS} />}
          />
        </SettingsGroup>
      </section>

      {/* Custom instructions */}
      <section>
        <SectionTitle
          action={
            <span className={`font-mono text-[10.5px] tabular-nums ${prefsOverLimit ? 'text-red-500' : 'text-[var(--text-tertiary)]'}`}>
              {preferences.length}/{MAX_PREFS}
            </span>
          }
        >
          Custom instructions
        </SectionTitle>
        <div className="rounded-xl border border-[var(--st-line-strong)] bg-[var(--st-surface)] p-3.5 sm:p-4">
          <label htmlFor="tb-prefs" className="text-[13.5px] font-medium tracking-[-0.01em] text-[var(--text-primary)]">
            How should the tutor teach you?
          </label>
          <textarea
            id="tb-prefs"
            value={preferences}
            onChange={e => setPreferences(e.target.value.slice(0, MAX_PREFS + 20))}
            placeholder='e.g. "Explain with analogies first. Keep answers short, then go deeper if I ask."'
            className={`mt-2.5 block min-h-[88px] sm:min-h-[110px] w-full resize-y rounded-xl border bg-black/20 dark:bg-black/35 px-3.5 py-2.5 text-[13px] sm:text-[13.5px] leading-[1.6] text-[var(--text-primary)] outline-none transition-[border-color,box-shadow,background-color] placeholder:text-[var(--text-tertiary)]/70 focus:bg-[var(--bg-primary)] focus:border-amber-500/60 focus:shadow-[0_0_0_3px_rgba(245,158,11,0.15)] ${
              prefsOverLimit ? 'border-red-500/50' : 'border-[var(--st-line-strong)]'
            }`}
            style={{ maxHeight: 220 }}
          />
          <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar sm:flex-wrap pb-0.5">
            {[
              { label: 'Concepts first', text: 'Prioritize conceptual understanding over direct answers.' },
              { label: 'Show the working', text: 'Show each step and the reasoning behind it.' },
              { label: 'Check my understanding', text: 'Ask follow-up questions to verify my understanding.' },
            ].map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => {
                  const next = preferences ? `${preferences} ${chip.text}` : chip.text;
                  if (next.length <= MAX_PREFS) setPreferences(next);
                }}
                className="inline-flex h-7 sm:h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-[var(--st-line-strong)] bg-[var(--st-fill)]/70 hover:bg-[var(--st-fill-strong)] px-3 text-[11.5px] sm:text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all active:scale-95 whitespace-nowrap shadow-xs"
              >
                <Plus size={11} strokeWidth={2.4} className="text-amber-500/90 dark:text-amber-400 shrink-0" />
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Notifications */}
      <section>
        <SectionTitle>Notifications</SectionTitle>
        <SettingsGroup>
          <SettingsRow
            icon={notifCompletion ? Bell : BellOff}
            iconTone="emerald"
            label="Tell me when a lesson is ready"
            rightElement={<AppleToggle label="Lesson ready alerts" value={notifCompletion} onChange={handleNotifToggle} />}
          />
        </SettingsGroup>
      </section>
    </div>
  );
}
