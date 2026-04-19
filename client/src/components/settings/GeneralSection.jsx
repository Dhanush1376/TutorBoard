import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Check, Volume2, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  SectionTitle, SettingsGroup, SettingsRow,
  AppleToggle, RightInlineInput, RightInlineSelect,
  TrialBadge
} from './SettingsLayout';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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
  const [saveStatus, setSaveStatus] = useState(null);

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

  const lastSavedName = useRef(user?.name);

  useEffect(() => {
    const timeout = setTimeout(() => {
      localStorage.setItem('tb-nickname', nickname);
      localStorage.setItem('tb-role', role);
      localStorage.setItem('tb-ai-preferences', preferences);
      localStorage.setItem('tb-notif-completion', String(notifCompletion));
      localStorage.setItem('tb-notif-sound', String(notifSound));

      if (displayName && displayName !== lastSavedName.current) {
        setSaveStatus('saving');
        updateUser({ name: displayName });
        lastSavedName.current = displayName;
        syncSettings('general', { nickname, role, preferences, name: displayName, notifCompletion, notifSound });
        setTimeout(() => setSaveStatus('saved'), 300);
        setTimeout(() => setSaveStatus(null), 2000);
      } else {
        setSaveStatus('saving');
        syncSettings('general', { nickname, role, preferences, name: displayName, notifCompletion, notifSound });
        setTimeout(() => setSaveStatus('saved'), 300);
        setTimeout(() => setSaveStatus(null), 2000);
      }
    }, 1000);
    return () => clearTimeout(timeout);
  }, [nickname, role, preferences, displayName, notifCompletion, notifSound]);

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px' }}>
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

export default GeneralSection;
