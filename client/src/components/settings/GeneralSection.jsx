import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Check, Volume2, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  SectionTitle, SettingsGroup, SettingsRow, 
  AppleToggle, RightInlineInput, RightInlineSelect, 
  TrialBadge 
} from './SettingsShared';

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
        }} />
        <span style={{ fontSize: '14px', fontWeight: 600 }}>{label}</span>
      </div>
      <span style={{ fontSize: '12px', fontWeight: 500 }}>{status.toUpperCase()} {detail && `── ${detail}`}</span>
    </div>
  );
};

const AboutSection = ({ user }) => {
  const { token } = useAuth();
  const [systemStatus, setSystemStatus] = useState({ api: 'checking', db: 'checking', engine: 'online' });

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${API_URL}/api/test`, { headers: { 'Authorization': `Bearer ${token}` } });
        setSystemStatus(prev => ({ ...prev, api: 'online', db: res.ok ? 'online' : 'offline' }));
      } catch (e) { setSystemStatus(prev => ({ ...prev, api: 'offline', db: 'offline' })); }
    };
    if (token) check();
  }, [token]);

  return (
    <div style={{ marginTop: '40px', paddingBottom: '40px' }}>
      <SectionTitle>System Status</SectionTitle>
      <SettingsGroup>
        <SystemStatusItem label="API Gateway" status={systemStatus.api} />
        <SystemStatusItem label="Cloud Database" status={systemStatus.db} />
        <SystemStatusItem label="Orchestration Engine" status={systemStatus.engine} detail="v9.0 Cinematic" />
      </SettingsGroup>
      <div style={{ textAlign: 'center', marginTop: '32px', color: 'var(--text-tertiary)', fontSize: '12px' }}>
        TutorBoard v2.1.0 Beta ── Made with ❤️ by the Team
      </div>
    </div>
  );
};

export default function GeneralSection({ user, syncSettings, showToast }) {
  const { updateUser } = useAuth();
  // ... existing states ...
  const [displayName, setDisplayName] = useState(user?.name || '');
  const [nickname, setNickname] = useState(localStorage.getItem('tb-nickname') || user?.name?.split(' ')[0] || '');
  const [role, setRole] = useState(localStorage.getItem('tb-role') || '');
  const [preferences, setPreferences] = useState(localStorage.getItem('tb-ai-preferences') || '');
  const [notifCompletion, setNotifCompletion] = useState(localStorage.getItem('tb-notif-completion') !== 'false');
  const [notifSound, setNotifSound] = useState(localStorage.getItem('tb-notif-sound') !== 'false');
  const [saveStatus, setSaveStatus] = useState(null);

  // ... rest of the component ...
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

      setSaveStatus('saving');
      if (displayName && displayName !== lastSavedName.current) {
        updateUser({ name: displayName });
        lastSavedName.current = displayName;
      }
      
      syncSettings('general', { nickname, role, preferences, name: displayName, notifCompletion, notifSound });
      setTimeout(() => setSaveStatus('saved'), 300);
      setTimeout(() => setSaveStatus(null), 2000);
    }, 1000);
    return () => clearTimeout(timeout);
  }, [nickname, role, preferences, displayName, notifCompletion, notifSound, syncSettings, updateUser]);

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      {/* ... previous content ... */}
      {user?.isGuest && (
        <div style={{ 
          background: 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(59,130,246,0.05) 100%)',
          border: '1px solid rgba(59,130,246,0.2)', borderRadius: '16px', padding: '16px', marginBottom: '24px',
          display: 'flex', alignItems: 'center', gap: '16px'
        }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <ShieldAlert size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px 0' }}>Guest Mode Active</h4>
            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: 0 }}>You're using a temporary account. Profile changes are locked.</p>
          </div>
        </div>
      )}
      
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px' }}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{displayName || 'User'}</h2>
            {user?.isGuest && <TrialBadge />}
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', margin: 0 }}>{user?.email || 'guest@tutorboard.ai'}</p>
        </div>
        {saveStatus && (
          <motion.span initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ fontSize: '11px', fontWeight: 600, marginTop: '8px', color: saveStatus === 'saving' ? 'var(--text-tertiary)' : '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {saveStatus === 'saving' ? '⟳ Saving...' : '✓ Saved'}
          </motion.span>
        )}
      </div>

      <SectionTitle>Profile Details</SectionTitle>
      <SettingsGroup>
        <SettingsRow label="Full Name" rightElement={<RightInlineInput value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Full Name" disabled={user?.isGuest} />} />
        <SettingsRow label="Preferred Name" description="What TutorBoard should call you" rightElement={<RightInlineInput value={nickname} onChange={e => setNickname(e.target.value)} placeholder="Nickname" disabled={user?.isGuest} />} />
        <SettingsRow label="Role" borderBottom={false} rightElement={
          <RightInlineSelect value={role} onChange={setRole} disabled={user?.isGuest}
            options={[
              { value: '', label: 'Select role...' },
              { value: 'student-high-school', label: 'High School Student' },
              { value: 'student-undergrad', label: 'Undergraduate Student' },
              { value: 'student-grad', label: 'Graduate Student' },
              { value: 'teacher', label: 'Teacher / Professor' },
              { value: 'professional', label: 'Professional' },
            ]}
          />
        } />
      </SettingsGroup>

      <SectionTitle>Personalized Learning</SectionTitle>
      <SettingsGroup>
        <div style={{ padding: '16px' }}>
          <label style={{ display: 'block', fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '8px' }}>System Instructions</label>
          <textarea value={preferences} onChange={e => setPreferences(e.target.value)} disabled={user?.isGuest}
            placeholder={user?.isGuest ? "Sign in to add custom instructions..." : "e.g. explain concepts with visual analogies..."}
            style={{ width: '100%', padding: '12px', resize: 'vertical', minHeight: '80px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '14px', fontFamily: '"Geist", sans-serif', outline: 'none' }}
          />
        </div>
      </SettingsGroup>

      <SectionTitle>Notifications</SectionTitle>
      <SettingsGroup>
        <SettingsRow icon={Check} label="Agent Replies" rightElement={<AppleToggle value={notifCompletion} onChange={handleNotifCompletionToggle} />} />
        <SettingsRow icon={Volume2} label="Sound Effects" borderBottom={false} rightElement={<AppleToggle value={notifSound} onChange={setNotifSound} />} />
      </SettingsGroup>

      <AboutSection user={user} />
    </div>
  );
}
