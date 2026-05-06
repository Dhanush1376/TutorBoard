import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Lock, LogOut, Trash2,
  Download, AlertTriangle,
  Eye, EyeOff, Check, X, Shield,
  Cloud, RefreshCcw
} from 'lucide-react';
import useTutorStore from '../../store/tutorStore';
import { useAuth } from '../../context/AuthContext';
import API from '../../services/api';
import {
  SectionTitle, SettingsGroup, SettingsRow,
  ContextButton, DialogModal, API_URL, AppleToggle
} from './SettingsShared';

// ─── SVG Logos ─────────────────────────────────────────────────────────────

const GoogleLogo = ({ size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size}>
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const GitHubLogo = ({ size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
  </svg>
);

// ─── Social Connect Button ───────────────────────────────────────────────────

const SocialButton = ({ icon: Icon, label, isConnected, onClick, color }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      width: '100%', padding: '12px 14px', borderRadius: '12px',
      background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
      cursor: isConnected ? 'default' : 'pointer',
      transition: 'all 0.12s ease', textAlign: 'left',
    }}
  >
    <div style={{
      width: '28px', height: '28px', borderRadius: '8px',
      background: isConnected ? `${color}10` : 'var(--bg-tertiary)',
      color: isConnected ? color : 'var(--text-tertiary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon size={16} />
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{label}</div>
    </div>
    {isConnected ? (
      <span style={{ fontSize: '10px', fontWeight: 500, color: '#10b981' }}>Connected</span>
    ) : (
      <span style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-tertiary)' }}>Connect</span>
    )}
  </button>
);

// ─── Privacy / Data Section ──────────────────────────────────────────────────

export const PrivacySection = ({ syncSettings, showToast }) => {
  const { showAlert } = useTutorStore();
  const [cloudSync, setCloudSync] = useState(localStorage.getItem('tb-cloud-sync') !== 'false');
  const [isSyncing, setIsSyncing] = useState(false);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const t = setTimeout(() => {
      localStorage.setItem('tb-cloud-sync', String(cloudSync));
      syncSettings('privacy', { cloudSync });
      setIsSyncing(true);
      setTimeout(() => setIsSyncing(false), 1200);
    }, 400);
    return () => clearTimeout(t);
  }, [cloudSync]);

  const handleExport = async () => {
    try {
      const res = await API.get('/api/user/export');
      const data = res.data;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tutorboard-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast?.('Export complete.', 'success');
    } catch {
      showToast?.('Export failed. Check connection.', 'error');
    }
  };

  const handleWipeData = async () => {
    try {
      const res = await API.delete('/api/user/data');
      if (res.status === 200) showToast?.('Cloud cache purged.', 'info');
      else showToast?.('Purge failed.', 'error');
    } catch {
      showToast?.('Network error.', 'error');
    }
  };

  return (
    <div style={{ marginTop: '24px' }}>
      <SectionTitle>Cloud Sync</SectionTitle>
      <SettingsGroup>
        <SettingsRow
          icon={Cloud}
          label="Cloud Sync"
          description="Keep sessions in sync across devices"
          rightElement={<AppleToggle value={cloudSync} onChange={setCloudSync} />}
        />
        <SettingsRow
          icon={Download}
          label="Export Data"
          description="Download JSON backup"
          onClick={handleExport}
          borderBottom={false}
        />
      </SettingsGroup>

      <div style={{ marginTop: '16px' }}>
        <SectionTitle style={{ color: '#ef4444', opacity: 0.8 }}>Data</SectionTitle>
        <div style={{ 
          padding: '14px', borderRadius: '12px', 
          background: 'rgba(239,68,68,0.04)', 
          border: '1px solid rgba(239,68,68,0.1)' 
        }}>
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '12px', lineHeight: 1.5, fontWeight: 400 }}>
            Purging cloud data is irreversible. All session history and canvas artifacts will be removed.
          </p>
          <button 
            onClick={() => showAlert({
              title: 'Confirm Data Purge',
              message: 'This will permanently delete all cloud-synced sessions.',
              confirmLabel: 'Purge Data',
              type: 'warning',
              onConfirm: handleWipeData,
            })}
            style={{ 
              width: '100%', padding: '10px', background: '#ef4444', color: '#fff', 
              border: 'none', borderRadius: '10px', fontSize: '12px', fontWeight: 500, 
              cursor: 'pointer', transition: 'opacity 0.12s',
            }}
          >
            Purge Cloud Data
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Password Strength ───────────────────────────────────────────────────────

function getStrength(pw) {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s += 25;
  if (/[A-Z]/.test(pw)) s += 25;
  if (/[0-9]/.test(pw)) s += 25;
  if (/[^A-Za-z0-9]/.test(pw)) s += 25;
  return s;
}

const STRENGTH_LABELS = { 0: 'Too Short', 25: 'Weak', 50: 'Fair', 75: 'Good', 100: 'Strong' };
const STRENGTH_COLORS = { 0: '#ef4444', 25: '#ef4444', 50: '#f59e0b', 75: '#3b82f6', 100: '#10b981' };

function PasswordStrengthBar({ password }) {
  const strength = getStrength(password);
  if (!password) return null;
  const color = STRENGTH_COLORS[strength] || '#ef4444';
  const label = STRENGTH_LABELS[strength] || 'Weak';

  return (
    <div style={{ padding: '2px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <span style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-tertiary)' }}>Strength</span>
        <span style={{ fontSize: '10px', fontWeight: 500, color }}>{label}</span>
      </div>
      <div style={{ height: '3px', background: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${strength}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          style={{ height: '100%', background: color, borderRadius: '2px' }}
        />
      </div>
    </div>
  );
}

// ─── Password Input ─────────────────────────────────────────────────────

function PasswordInput({ value, onChange, placeholder, showToggle, onToggle, suffix }) {
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={showToggle ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        style={{
          width: '100%', padding: '12px 40px 12px 14px',
          borderRadius: '10px', border: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)', color: 'var(--text-primary)',
          fontSize: '13px', outline: 'none', boxSizing: 'border-box',
          fontFamily: 'inherit', transition: 'border-color 0.12s',
        }}
        onFocus={e => e.target.style.borderColor = 'var(--text-tertiary)'}
        onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
      />
      <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 6 }}>
        {suffix}
        <button
          type="button"
          onClick={onToggle}
          style={{ 
            background: 'none', border: 'none', 
            color: 'var(--text-tertiary)', cursor: 'pointer', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '2px', opacity: 0.6,
          }}
        >
          {showToggle ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  );
}

// ─── Main AccountSection ─────────────────────────────────────────────────────

export default function AccountSection({ user: userProp, logout, syncSettings, showToast }) {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const user = userProp || authUser;

  const [modalType, setModalType] = useState(null);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const closeModals = () => {
    if (loading) return;
    setModalType(null);
    setCurrentPw(''); setNewPw(''); setConfirmPw('');
    setShowCurrent(false); setShowNew(false);
    setErrorMsg(''); setSuccessMsg('');
  };

  const handlePasswordSubmit = async () => {
    if (!currentPw || !newPw || !confirmPw) return setErrorMsg('Please fill in all fields.');
    if (newPw !== confirmPw) return setErrorMsg('Passwords do not match.');
    if (newPw.length < 8) return setErrorMsg('Minimum 8 characters.');
    if (getStrength(newPw) < 50) return setErrorMsg('Choose a stronger password.');

    setLoading(true); setErrorMsg(''); setSuccessMsg('');
    try {
      const res = await API.put('/api/user/password', { currentPassword: currentPw, newPassword: newPw });
      if (res.status === 200) {
        setSuccessMsg('Password updated.');
        setTimeout(closeModals, 1500);
      } else {
        setErrorMsg(res.data?.error || 'Failed to update.');
        setLoading(false);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Network error.');
      setLoading(false);
    }
  };

  const handleDeleteSubmit = async () => {
    setLoading(true); setErrorMsg('');
    try {
      const res = await API.delete('/api/user/account');
      if (res.status === 200) { logout(); navigate('/'); }
      else {
        const data = res.data;
        setErrorMsg(data?.error || 'Could not delete account.');
        setLoading(false);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Network error.');
      setLoading(false);
    }
  };

  const matchIcon = confirmPw ? (
    newPw === confirmPw ? <Check size={12} strokeWidth={3} style={{ color: '#10b981' }} /> : <X size={12} strokeWidth={3} style={{ color: '#ef4444' }} />
  ) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Modals */}
      <AnimatePresence>
        {modalType === 'password' && (
          <DialogModal
            title="Change Password"
            primaryAction={handlePasswordSubmit}
            primaryLabel="Update"
            loading={loading}
            onClose={closeModals}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '4px 0' }}>
              <PasswordInput
                value={currentPw}
                onChange={e => setCurrentPw(e.target.value)}
                placeholder="Current password"
                showToggle={showCurrent}
                onToggle={() => setShowCurrent(v => !v)}
              />
              <div style={{ height: '1px', background: 'var(--border-color)', opacity: 0.5 }} />
              <PasswordInput
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="New password"
                showToggle={showNew}
                onToggle={() => setShowNew(v => !v)}
              />
              <PasswordInput
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                placeholder="Confirm new password"
                showToggle={showNew}
                onToggle={() => setShowNew(v => !v)}
                suffix={matchIcon}
              />

              <AnimatePresence>
                {newPw && <PasswordStrengthBar password={newPw} />}
              </AnimatePresence>

              {errorMsg && (
                <div style={{
                  color: '#ef4444', fontSize: '12px', fontWeight: 400, background: 'rgba(239,68,68,0.06)',
                  padding: '10px', borderRadius: '8px', display: 'flex', gap: '8px', alignItems: 'center',
                }}>
                  <AlertTriangle size={13} strokeWidth={2} /> {errorMsg}
                </div>
              )}
              {successMsg && (
                <div style={{
                  color: '#10b981', fontSize: '12px', fontWeight: 400, background: 'rgba(16,185,129,0.06)',
                  padding: '10px', borderRadius: '8px', display: 'flex', gap: '8px', alignItems: 'center',
                }}>
                  <Check size={13} strokeWidth={3} /> {successMsg}
                </div>
              )}
            </div>
          </DialogModal>
        )}

        {modalType === 'delete' && (
          <DialogModal
            title="Delete Account"
            description="This will permanently erase your workspace, sessions, and all data. This cannot be undone."
            primaryAction={handleDeleteSubmit}
            primaryLabel="Delete Account"
            primaryDanger
            loading={loading}
            onClose={closeModals}
          >
            {errorMsg && (
              <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '8px', fontWeight: 400 }}>{errorMsg}</div>
            )}
          </DialogModal>
        )}
      </AnimatePresence>

      {/* Identity */}
      <div>
        <SectionTitle>Email</SectionTitle>
        <SettingsGroup>
          <SettingsRow
            icon={Shield}
            label={user?.email || 'Not provided'}
            borderBottom={false}
            rightElement={<span style={{ fontSize: '10px', fontWeight: 500, color: '#10b981' }}>Verified</span>}
          />
        </SettingsGroup>
      </div>

      {/* Security */}
      <div>
        <SectionTitle>Security</SectionTitle>
        <SettingsGroup>
          <SettingsRow
            label="Password"
            icon={Lock}
            description="Update your login credentials"
            onClick={() => setModalType('password')}
            borderBottom={false}
          />
        </SettingsGroup>
      </div>

      {/* Linked Accounts */}
      <div>
        <SectionTitle>Connected Accounts</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <SocialButton 
            icon={GoogleLogo} 
            label="Google" 
            isConnected={!!user?.googleId} 
            color="#EA4335" 
            onClick={() => !user?.googleId && (window.location.href = `${API_URL}/api/auth/google`)}
          />
          <SocialButton 
            icon={GitHubLogo} 
            label="GitHub" 
            isConnected={!!user?.githubId} 
            color="var(--text-primary)" 
            onClick={() => !user?.githubId && (window.location.href = `${API_URL}/api/auth/github`)}
          />
        </div>
      </div>

      {/* Privacy / Data */}
      <PrivacySection syncSettings={syncSettings} showToast={showToast} />

      {/* Session */}
      <div>
        <SectionTitle>Session</SectionTitle>
        <SettingsGroup>
          <ContextButton icon={LogOut} onClick={() => { logout(); }}>
            Sign Out
          </ContextButton>
        </SettingsGroup>
      </div>

      <div style={{ marginTop: '8px' }}>
        <SectionTitle style={{ color: '#ef4444', opacity: 0.8 }}>Danger</SectionTitle>
        <SettingsGroup>
          <ContextButton icon={Trash2} danger onClick={() => setModalType('delete')} borderBottom={false}>
            Delete Account
          </ContextButton>
        </SettingsGroup>
      </div>

    </div>
  );
}