import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Lock, Globe2, LogOut, Trash2,
  Upload, Download, AlertTriangle,
  Eye, EyeOff, Check, X, ShieldCheck,
  GitBranch, Cloud, RefreshCcw, Shield
} from 'lucide-react';
import useTutorStore from '../../store/tutorStore';
import { useAuth } from '../../context/AuthContext';
import {
  SectionTitle, SettingsGroup, SettingsRow,
  ContextButton, DialogModal, API_URL, AppleToggle
} from './SettingsShared';

// ─── Shared Components ───────────────────────────────────────────────────────

const SectionCard = ({ children, style = {} }) => (
  <div style={{
    background: 'var(--bg-secondary)',
    borderRadius: '20px',
    padding: '24px',
    border: '1px solid var(--border-color)',
    marginBottom: '32px',
    ...style
  }}>
    {children}
  </div>
);

const SocialButton = ({ icon: Icon, label, isConnected, onClick, color }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      width: '100%',
      padding: '14px 16px',
      borderRadius: '14px',
      background: 'var(--bg-primary)',
      border: '1px solid var(--border-color)',
      cursor: isConnected ? 'default' : 'pointer',
      transition: 'background 0.2s',
      textAlign: 'left',
    }}
    onMouseEnter={e => !isConnected && (e.currentTarget.style.background = 'var(--bg-tertiary)')}
    onMouseLeave={e => !isConnected && (e.currentTarget.style.background = 'var(--bg-primary)')}
  >
    <div style={{
      width: '32px', height: '32px', borderRadius: '10px',
      background: isConnected ? `${color}15` : 'var(--bg-tertiary)',
      color: isConnected ? color : 'var(--text-tertiary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <Icon size={18} />
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{label}</div>
      <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
        {isConnected ? 'Connected' : 'Not connected'}
      </div>
    </div>
    {isConnected ? (
      <div style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 500 }}>
        <Check size={14} strokeWidth={3} /> Active
      </div>
    ) : (
      <div style={{ color: '#007AFF', fontSize: '12px', fontWeight: 500 }}>Connect</div>
    )}
  </button>
);

// ─── Privacy / Data Section ──────────────────────────────────────────────────

export const PrivacySection = ({ syncSettings, token, showToast }) => {
  const { showAlert } = useTutorStore();
  const [cloudSync, setCloudSync] = useState(localStorage.getItem('tb-cloud-sync') !== 'false');
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      localStorage.setItem('tb-cloud-sync', String(cloudSync));
      syncSettings('privacy', { cloudSync });
      setIsSyncing(true);
      setTimeout(() => setIsSyncing(false), 1000);
    }, 300);
    return () => clearTimeout(t);
  }, [cloudSync]);

  const handleExport = async () => {
    try {
      const res = await fetch(`${API_URL}/api/user/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tutorboard-data.json';
      a.click();
      URL.revokeObjectURL(url);
      showToast?.('Your data has been exported.', 'success');
    } catch {
      showToast?.('Export failed. Try again.', 'error');
    }
  };

  const handleWipeData = async () => {
    try {
      const res = await fetch(`${API_URL}/api/user/data`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) showToast?.('All cloud data wiped.', 'info');
      else showToast?.('Wipe failed.', 'error');
    } catch {
      showToast?.('Network error.', 'error');
    }
  };

  return (
    <div style={{ marginTop: '40px' }}>
      <SectionTitle>Cloud Storage</SectionTitle>
      <SectionCard>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(0,122,255,0.1)', color: '#007AFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Cloud size={20} />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)' }}>Cloud Sync</div>
              <div style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>Sync sessions across your devices</div>
            </div>
          </div>
          <AppleToggle value={cloudSync} onChange={setCloudSync} />
        </div>
        
        {cloudSync && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} 
            animate={{ opacity: 1, height: 'auto' }}
            style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <motion.div
              animate={isSyncing ? { rotate: 360 } : {}}
              transition={{ duration: 1, repeat: isSyncing ? Infinity : 0, ease: "linear" }}
              style={{ color: isSyncing ? '#007AFF' : '#10b981' }}
            >
              <RefreshCcw size={12} />
            </motion.div>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 500 }}>
              {isSyncing ? 'Synchronizing with cloud...' : 'All sessions up to date'}
            </span>
          </motion.div>
        )}
      </SectionCard>

      <SectionTitle>Your Data</SectionTitle>
      <SectionCard>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button 
            onClick={handleExport}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', 
              background: 'var(--bg-primary)', border: '1px solid var(--border-color)', 
              borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s' 
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-primary)'}
          >
            <div style={{ color: 'var(--text-secondary)' }}><Download size={18} /></div>
            <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--text-primary)' }}>Export All Data</span>
          </button>

          <div style={{ 
            marginTop: '12px', padding: '16px', borderRadius: '16px', 
            background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.1)' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', marginBottom: '8px' }}>
              <AlertTriangle size={14} />
              <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Danger Zone</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '12px', lineHeight: 1.5 }}>
              Wiping your data is permanent. This removes all session history and canvas states from the cloud.
            </p>
            <button 
              onClick={() => showAlert({
                title: 'Wipe Cloud Data',
                message: 'This permanently deletes all your sessions and history. Continue?',
                confirmLabel: 'Wipe Everything',
                type: 'warning',
                onConfirm: handleWipeData,
              })}
              style={{ 
                width: '100%', padding: '10px', background: '#ef4444', color: '#fff', 
                border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' 
              }}
            >
              Wipe Cloud Data
            </button>
          </div>
        </div>
      </SectionCard>
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

const STRENGTH_LABELS = { 0: '', 25: 'Weak', 50: 'Fair', 75: 'Good', 100: 'Strong' };
const STRENGTH_COLORS = { 25: '#ef4444', 50: '#f59e0b', 75: '#3b82f6', 100: '#10b981' };

function PasswordStrengthBar({ password }) {
  const strength = getStrength(password);
  if (!password) return null;
  const color = STRENGTH_COLORS[strength] || '#ef4444';
  const label = STRENGTH_LABELS[strength] || 'Weak';
  const checks = [
    { label: '8+ chars', met: password.length >= 8 },
    { label: 'Uppercase', met: /[A-Z]/.test(password) },
    { label: 'Number', met: /[0-9]/.test(password) },
    { label: 'Symbol', met: /[^A-Za-z0-9]/.test(password) },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      style={{ overflow: 'hidden' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Password strength</span>
        <span style={{ fontSize: '11px', fontWeight: 600, color }}>{label}</span>
      </div>
      <div style={{ height: '4px', background: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden', marginBottom: '12px' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${strength}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          style={{ height: '100%', background: color, borderRadius: '2px' }}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        {checks.map((c, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: c.met ? '#10b981' : 'var(--text-tertiary)', opacity: c.met ? 1 : 0.6 }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: c.met ? '#10b98122' : 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {c.met ? <Check size={10} strokeWidth={3} /> : <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--text-tertiary)', opacity: 0.5 }} />}
            </div>
            {c.label}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Reusable Password Input ─────────────────────────────────────────────────

function PasswordInput({ value, onChange, placeholder, showToggle, onToggle, suffix }) {
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={showToggle ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        style={{
          width: '100%', padding: '14px 44px 14px 14px',
          borderRadius: '14px', border: '1px solid var(--border-color)',
          background: 'var(--bg-secondary)', color: 'var(--text-primary)',
          fontSize: '14px', outline: 'none', boxSizing: 'border-box',
          fontFamily: 'inherit', transition: 'all 0.2s',
        }}
        onFocus={e => (e.target.style.borderColor = '#007AFF', e.target.style.boxShadow = '0 0 0 4px rgba(0,122,255,0.1)')}
        onBlur={e => (e.target.style.borderColor = 'var(--border-color)', e.target.style.boxShadow = 'none')}
      />
      <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 8 }}>
        {suffix}
        <button
          type="button"
          onClick={onToggle}
          style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 0, display: 'flex' }}
        >
          {showToggle ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}

// ─── Main AccountSection ─────────────────────────────────────────────────────

export default function AccountSection({ user, logout, syncSettings, showToast }) {
  const navigate = useNavigate();
  const { token } = useAuth();

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
    if (newPw !== confirmPw) return setErrorMsg('New passwords do not match.');
    if (newPw.length < 8) return setErrorMsg('Password must be at least 8 characters.');
    if (getStrength(newPw) < 50) return setErrorMsg('Please choose a stronger password.');

    setLoading(true); setErrorMsg(''); setSuccessMsg('');
    try {
      const res = await fetch(`${API_URL}/api/user/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg('Password updated successfully.');
        setTimeout(closeModals, 1500);
      } else {
        setErrorMsg(data.error || 'Failed to update password.');
        setLoading(false);
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
      setLoading(false);
    }
  };

  const handleDeleteSubmit = async () => {
    setLoading(true); setErrorMsg('');
    try {
      const res = await fetch(`${API_URL}/api/user/account`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { logout(); navigate('/'); }
      else {
        const data = await res.json();
        setErrorMsg(data.error || 'Could not delete account.');
        setLoading(false);
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
      setLoading(false);
    }
  };

  const matchIcon = confirmPw ? (
    newPw === confirmPw ? <Check size={14} style={{ color: '#10b981' }} /> : <X size={14} style={{ color: '#ef4444' }} />
  ) : null;

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>

      {/* ── Modals ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {modalType === 'password' && (
          <DialogModal
            title="Change Password"
            primaryAction={handlePasswordSubmit}
            primaryLabel="Update Password"
            loading={loading}
            onClose={closeModals}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <PasswordInput
                value={currentPw}
                onChange={e => setCurrentPw(e.target.value)}
                placeholder="Current password"
                showToggle={showCurrent}
                onToggle={() => setShowCurrent(v => !v)}
              />
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
                <motion.div
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  style={{
                    color: '#ef4444', fontSize: '12px', background: 'rgba(239,68,68,0.1)',
                    padding: '12px', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.2)',
                    display: 'flex', gap: '8px', alignItems: 'center',
                  }}
                >
                  <AlertTriangle size={14} /> {errorMsg}
                </motion.div>
              )}
              {successMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  style={{
                    color: '#10b981', fontSize: '12px', background: 'rgba(16,185,129,0.1)',
                    padding: '12px', borderRadius: '12px', border: '1px solid rgba(16,185,129,0.2)',
                    display: 'flex', gap: '8px', alignItems: 'center',
                  }}
                >
                  <Check size={14} strokeWidth={3} /> {successMsg}
                </motion.div>
              )}
            </div>
          </DialogModal>
        )}

        {modalType === 'delete' && (
          <DialogModal
            title="Delete Account"
            description="All your data, sessions, and canvas history will be permanently erased. This cannot be undone."
            primaryAction={handleDeleteSubmit}
            primaryLabel="Delete Everything"
            primaryDanger
            loading={loading}
            onClose={closeModals}
          >
            {errorMsg && (
              <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '8px' }}>{errorMsg}</div>
            )}
          </DialogModal>
        )}
      </AnimatePresence>

      {/* ── Email ──────────────────────────────────────────────────── */}
      <SectionTitle>Account</SectionTitle>
      <SectionCard>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Email Address</div>
            <div style={{ fontSize: '15px', color: 'var(--text-primary)', fontWeight: 400 }}>{user?.email || 'Not provided'}</div>
          </div>
          <div style={{ padding: '4px 10px', borderRadius: '20px', background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: '11px', fontWeight: 600 }}>Verified</div>
        </div>
      </SectionCard>

      {/* ── Security ───────────────────────────────────────────────── */}
      <SectionTitle>Security</SectionTitle>
      <SettingsGroup>
        <SettingsRow
          label="Change Password"
          icon={Lock}
          description="Update your login credentials"
          onClick={() => setModalType('password')}
          borderBottom={false}
        />
      </SettingsGroup>

      {/* ── Linked Accounts ────────────────────────────────────────── */}
      <SectionTitle>Linked Accounts</SectionTitle>
      <SectionCard style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <SocialButton 
          icon={Globe2} 
          label="Google" 
          isConnected={!!user?.googleId} 
          color="#EA4335" 
          onClick={() => !user?.googleId && (window.location.href = `${API_URL}/api/auth/google`)}
        />
        <SocialButton 
          icon={GitBranch} 
          label="GitHub" 
          isConnected={!!user?.githubId} 
          color="#333" 
          onClick={() => !user?.githubId && (window.location.href = `${API_URL}/api/auth/github`)}
        />
      </SectionCard>

      {/* ── Privacy / Data ────────────────────────────────────────── */}
      <PrivacySection syncSettings={syncSettings} token={token} showToast={showToast} />

      {/* ── Session ──────────────────────────────────────────────────── */}
      <SectionTitle>Session Management</SectionTitle>
      <SettingsGroup>
        <ContextButton icon={LogOut} onClick={() => { logout(); navigate('/'); }}>
          Sign Out of TutorBoard
        </ContextButton>
        <ContextButton icon={Trash2} danger onClick={() => setModalType('delete')} borderBottom={false}>
          Delete Account Permanently
        </ContextButton>
      </SettingsGroup>

    </div>
  );
}