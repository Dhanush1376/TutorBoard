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
    borderRadius: '24px',
    padding: '28px',
    border: '1px solid var(--border-color)',
    marginBottom: '32px',
    boxShadow: '0 12px 40px rgba(0,0,0,0.03)',
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
      gap: '14px',
      width: '100%',
      padding: '16px 18px',
      borderRadius: '18px',
      background: 'var(--bg-primary)',
      border: `1.5px solid ${isConnected ? 'var(--border-color)' : 'var(--border-color)'}`,
      cursor: isConnected ? 'default' : 'pointer',
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      textAlign: 'left',
      boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
    }}
    onMouseEnter={e => !isConnected && (e.currentTarget.style.background = 'var(--bg-tertiary)', e.currentTarget.style.transform = 'translateY(-2px)')}
    onMouseLeave={e => !isConnected && (e.currentTarget.style.background = 'var(--bg-primary)', e.currentTarget.style.transform = 'translateY(0)')}
  >
    <div style={{
      width: '36px', height: '36px', borderRadius: '10px',
      background: isConnected ? `${color}15` : 'var(--bg-tertiary)',
      color: isConnected ? color : 'var(--text-tertiary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: isConnected ? `0 4px 12px ${color}22` : 'none',
    }}>
      <Icon size={20} strokeWidth={2.5} />
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{label}</div>
      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {isConnected ? 'Link Active' : 'Not Linked'}
      </div>
    </div>
    {isConnected ? (
      <div style={{ 
        padding: '4px 10px', borderRadius: '10px', 
        background: 'rgba(16,185,129,0.1)', color: '#10b981', 
        display: 'flex', alignItems: 'center', gap: '5px', 
        fontSize: '11px', fontWeight: 700 
      }}>
        <Check size={12} strokeWidth={4} /> CONNECTED
      </div>
    ) : (
      <div style={{ color: 'var(--accent-primary)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.02em' }}>CONNECT</div>
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
      setTimeout(() => setIsSyncing(false), 1200);
    }, 400);
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
      const res = await fetch(`${API_URL}/api/user/data`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) showToast?.('Cloud cache purged.', 'info');
      else showToast?.('Purge failed.', 'error');
    } catch {
      showToast?.('Network error.', 'error');
    }
  };

  return (
    <div style={{ marginTop: '48px' }}>
      <SectionTitle>Cloud Continuity</SectionTitle>
      <SectionCard>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(0,122,255,0.08)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,122,255,0.1)' }}>
              <Cloud size={22} strokeWidth={2} />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Universal Cloud Sync</div>
              <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: 500 }}>Keep your sessions & canvas in sync globally</div>
            </div>
          </div>
          <AppleToggle value={cloudSync} onChange={setCloudSync} />
        </div>
        
        <AnimatePresence>
          {cloudSync && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }} 
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ marginTop: '18px', paddingTop: '18px', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}
            >
              <motion.div
                animate={isSyncing ? { rotate: 360 } : {}}
                transition={{ duration: 1, repeat: isSyncing ? Infinity : 0, ease: "linear" }}
                style={{ color: isSyncing ? 'var(--accent-primary)' : '#10b981' }}
              >
                <RefreshCcw size={14} strokeWidth={2.5} />
              </motion.div>
              <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                {isSyncing ? 'SYNCHRONIZING SECURELY…' : 'SYSTEM FULLY SYNCHRONIZED'}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </SectionCard>

      <SectionTitle>Data Portability</SectionTitle>
      <SectionCard>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <button 
            onClick={handleExport}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '14px', padding: '16px', 
              background: 'var(--bg-primary)', border: '1.5px solid var(--border-color)', 
              borderRadius: '16px', cursor: 'pointer', transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)', e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-primary)', e.currentTarget.style.transform = 'translateY(0)')}
          >
            <div style={{ 
              width: '32px', height: '32px', borderRadius: '8px',
              background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Download size={18} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Export Personal Data</div>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 500 }}>Download JSON backup of all workspace states</div>
            </div>
          </button>

          <div style={{ 
            marginTop: '12px', padding: '20px', borderRadius: '20px', 
            background: 'linear-gradient(135deg, rgba(239,68,68,0.04), rgba(239,68,68,0.02))', 
            border: '1px solid rgba(239,68,68,0.1)' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#ef4444', marginBottom: '10px' }}>
              <AlertTriangle size={16} strokeWidth={2.5} />
              <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Danger Zone</span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '16px', lineHeight: 1.6, fontWeight: 500 }}>
              Purging your cloud data is irreversible. This action removes all session history and canvas artifacts.
            </p>
            <button 
              onClick={() => showAlert({
                title: 'Confirm Data Purge',
                message: 'This will permanently delete all cloud-synced sessions. Are you absolutely sure?',
                confirmLabel: 'Purge Cloud Data',
                type: 'warning',
                onConfirm: handleWipeData,
              })}
              style={{ 
                width: '100%', padding: '14px', background: '#ef4444', color: '#fff', 
                border: 'none', borderRadius: '14px', fontSize: '13px', fontWeight: 700, 
                cursor: 'pointer', boxShadow: '0 8px 20px rgba(239,68,68,0.2)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
              onMouseLeave={e => e.currentTarget.style.filter = 'none'}
            >
              Purge All Cloud Data
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

const STRENGTH_LABELS = { 0: '', 25: 'Weak', 50: 'Fair', 75: 'Secure', 100: 'Hardened' };
const STRENGTH_COLORS = { 25: '#ef4444', 50: '#f59e0b', 75: 'var(--accent-primary)', 100: '#10b981' };

function PasswordStrengthBar({ password }) {
  const strength = getStrength(password);
  if (!password) return null;
  const color = STRENGTH_COLORS[strength] || '#ef4444';
  const label = STRENGTH_LABELS[strength] || 'Weak';
  const checks = [
    { label: '8+ CHARACTERS', met: password.length >= 8 },
    { label: 'UPPERCASE', met: /[A-Z]/.test(password) },
    { label: 'NUMBER', met: /[0-9]/.test(password) },
    { label: 'SYMBOL', met: /[^A-Za-z0-9]/.test(password) },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      style={{ overflow: 'hidden', padding: '4px 0' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.02em' }}>SECURITY SCORE</span>
        <span style={{ fontSize: '11px', fontWeight: 800, color, textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div style={{ height: '5px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden', marginBottom: '14px', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${strength}%` }}
          transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
          style={{ height: '100%', background: color, borderRadius: '3px', boxShadow: `0 0 12px ${color}44` }}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {checks.map((c, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', fontWeight: 700, color: c.met ? '#10b981' : 'var(--text-tertiary)', opacity: c.met ? 1 : 0.5, transition: 'all 0.3s' }}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', background: c.met ? '#10b98122' : 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {c.met ? <Check size={10} strokeWidth={4} /> : <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--text-tertiary)', opacity: 0.5 }} />}
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
          width: '100%', padding: '16px 48px 16px 18px',
          borderRadius: '16px', border: '1.5px solid var(--border-color)',
          background: 'var(--bg-secondary)', color: 'var(--text-primary)',
          fontSize: '15px', outline: 'none', boxSizing: 'border-box',
          fontFamily: 'inherit', transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
        }}
        onFocus={e => (e.target.style.borderColor = 'var(--accent-primary)', e.target.style.boxShadow = '0 0 0 4px var(--accent-primary)15')}
        onBlur={e => (e.target.style.borderColor = 'var(--border-color)', e.target.style.boxShadow = 'none')}
      />
      <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 10 }}>
        {suffix}
        <button
          type="button"
          onClick={onToggle}
          style={{ 
            background: 'var(--bg-tertiary)', border: 'none', 
            width: '28px', height: '28px', borderRadius: '8px',
            color: 'var(--text-tertiary)', cursor: 'pointer', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}
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
        setSuccessMsg('Security credentials updated.');
        setTimeout(closeModals, 1500);
      } else {
        setErrorMsg(data.error || 'Failed to update password.');
        setLoading(false);
      }
    } catch {
      setErrorMsg('Network error. Check connection.');
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
      setErrorMsg('Network error. Try again later.');
      setLoading(false);
    }
  };

  const matchIcon = confirmPw ? (
    newPw === confirmPw ? <Check size={14} strokeWidth={3} style={{ color: '#10b981' }} /> : <X size={14} strokeWidth={3} style={{ color: '#ef4444' }} />
  ) : null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ maxWidth: '640px', margin: '0 auto', paddingBottom: '100px' }}
    >

      {/* ── Modals ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {modalType === 'password' && (
          <DialogModal
            title="Update Credentials"
            primaryAction={handlePasswordSubmit}
            primaryLabel="Secure Account"
            loading={loading}
            onClose={closeModals}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', padding: '8px 0' }}>
              <PasswordInput
                value={currentPw}
                onChange={e => setCurrentPw(e.target.value)}
                placeholder="Current secure password"
                showToggle={showCurrent}
                onToggle={() => setShowCurrent(v => !v)}
              />
              <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0', opacity: 0.5 }} />
              <PasswordInput
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="New strong password"
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
                    color: '#ef4444', fontSize: '13px', fontWeight: 500, background: 'rgba(239,68,68,0.08)',
                    padding: '14px', borderRadius: '16px', border: '1.5px solid rgba(239,68,68,0.1)',
                    display: 'flex', gap: '10px', alignItems: 'center',
                  }}
                >
                  <AlertTriangle size={16} strokeWidth={2.5} /> {errorMsg}
                </motion.div>
              )}
              {successMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  style={{
                    color: '#10b981', fontSize: '13px', fontWeight: 600, background: 'rgba(16,185,129,0.08)',
                    padding: '14px', borderRadius: '16px', border: '1.5px solid rgba(16,185,129,0.1)',
                    display: 'flex', gap: '10px', alignItems: 'center',
                  }}
                >
                  <Check size={16} strokeWidth={3.5} /> {successMsg}
                </motion.div>
              )}
            </div>
          </DialogModal>
        )}

        {modalType === 'delete' && (
          <DialogModal
            title="Terminate Account"
            description="Warning: This will permanently erase your workspace, session history, and cloud presence. This action cannot be reversed."
            primaryAction={handleDeleteSubmit}
            primaryLabel="Destroy Account Permanently"
            primaryDanger
            loading={loading}
            onClose={closeModals}
          >
            {errorMsg && (
              <div style={{ color: '#ef4444', fontSize: '13px', marginTop: '12px', fontWeight: 600 }}>{errorMsg}</div>
            )}
          </DialogModal>
        )}
      </AnimatePresence>

      {/* ── Identity ──────────────────────────────────────────────────── */}
      <SectionTitle>Identity</SectionTitle>
      <SectionCard>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ width: 52, height: 52, borderRadius: '16px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
            <Shield size={26} strokeWidth={2} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>VERIFIED EMAIL</div>
            <div style={{ fontSize: '16px', color: 'var(--text-primary)', fontWeight: 600, letterSpacing: '-0.01em' }}>{user?.email || 'Not provided'}</div>
          </div>
          <div style={{ padding: '6px 12px', borderRadius: '12px', background: 'rgba(16,185,129,0.1)', color: '#10b981', fontSize: '11px', fontWeight: 800, letterSpacing: '0.02em', boxShadow: '0 2px 8px rgba(16,185,129,0.05)' }}>ACTIVE</div>
        </div>
      </SectionCard>

      {/* ── Security ───────────────────────────────────────────────── */}
      <SectionTitle>Protection</SectionTitle>
      <SettingsGroup>
        <SettingsRow
          label="Secure Credentials"
          icon={Lock}
          description="Update your password and login methods"
          onClick={() => setModalType('password')}
          borderBottom={false}
          rightElement={<div style={{ padding: '6px 12px', borderRadius: '10px', background: 'var(--bg-tertiary)', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>UPDATE</div>}
        />
      </SettingsGroup>

      {/* ── Linked Accounts ────────────────────────────────────────── */}
      <SectionTitle>Linked Identity</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
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
      </div>

      {/* ── Privacy / Data ────────────────────────────────────────── */}
      <PrivacySection syncSettings={syncSettings} token={token} showToast={showToast} />

      {/* ── Management ──────────────────────────────────────────────────── */}
      <SectionTitle>Workspace Management</SectionTitle>
      <SettingsGroup>
        <ContextButton icon={LogOut} onClick={() => { logout(); navigate('/'); }}>
          End Current Session
        </ContextButton>
        <ContextButton icon={Trash2} danger onClick={() => setModalType('delete')} borderBottom={false}>
          Terminate Account Permanently
        </ContextButton>
      </SettingsGroup>

    </motion.div>
  );
}