import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Lock, LogOut, Trash2, Download, AlertTriangle, Eye, EyeOff, Check, X, Mail, Cloud } from 'lucide-react';
import useTutorStore from '../../store/tutorStore';
import { useAuth } from '../../hooks/useAuth';
import API from '../../services/api';
import { SectionTitle, SettingsGroup, SettingsRow, ContextButton, DialogModal, API_URL, AppleToggle, Button, fieldClass } from './SettingsShared';

// ─── Provider logos ────────────────────────────────────────────────────────

const GoogleLogo = ({ size = 16 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const GitHubLogo = ({ size = 16 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);

const ProviderRow = ({ logo: Logo, label, isConnected, onConnect }) => (
  <div className="flex items-center gap-3.5 px-4 py-3.5">
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] border border-[var(--st-line)] bg-[var(--st-fill)] text-[var(--text-primary)]">
      <Logo />
    </span>
    <div className="min-w-0 flex-1">
      <div className="text-[13.5px] font-medium tracking-[-0.01em] text-[var(--text-primary)]">{label}</div>
      <div className="mt-0.5 text-[12px] text-[var(--text-tertiary)]">{isConnected ? 'You can sign in with this account' : 'Not connected'}</div>
    </div>
    {isConnected ? (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        Connected
      </span>
    ) : (
      <Button variant="secondary" className="h-8 px-3.5 text-[12px]" onClick={onConnect}>
        Connect
      </Button>
    )}
  </div>
);

// ─── Data & sync ─────────────────────────────────────────────────────────────

export const PrivacySection = ({ syncSettings, showToast }) => {
  const { showAlert } = useTutorStore();
  const [cloudSync, setCloudSync] = useState(localStorage.getItem('tb-cloud-sync') !== 'false');
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const t = setTimeout(() => {
      localStorage.setItem('tb-cloud-sync', String(cloudSync));
      syncSettings('privacy', { cloudSync });
    }, 400);
    return () => clearTimeout(t);
  }, [cloudSync]);

  const handleExport = async () => {
    try {
      const res = await API.get('/api/user/export');
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
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
      if (res.status === 200) showToast?.('Cloud data deleted.', 'info');
      else showToast?.('Could not delete cloud data.', 'error');
    } catch {
      showToast?.('Network error.', 'error');
    }
  };

  return (
    <section>
      <SectionTitle>Your data</SectionTitle>
      <SettingsGroup>
        <SettingsRow
          icon={Cloud}
          label="Cloud sync"
          rightElement={<AppleToggle label="Cloud sync" value={cloudSync} onChange={setCloudSync} />}
        />
        <SettingsRow icon={Download} label="Download my data" onClick={handleExport} />
        <SettingsRow
          icon={Trash2}
          danger
          label="Delete cloud data"
          description="This can’t be undone"
          onClick={() =>
            showAlert({
              title: 'Delete cloud data?',
              message: 'This permanently deletes all cloud-synced sessions.',
              confirmLabel: 'Delete data',
              type: 'warning',
              onConfirm: handleWipeData,
            })
          }
        />
      </SettingsGroup>
    </section>
  );
};

// ─── Password strength ───────────────────────────────────────────────────────

function getStrength(pw) {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s += 25;
  if (/[A-Z]/.test(pw)) s += 25;
  if (/[0-9]/.test(pw)) s += 25;
  if (/[^A-Za-z0-9]/.test(pw)) s += 25;
  return s;
}

const STRENGTH_LABELS = { 0: 'Too short', 25: 'Weak', 50: 'Fair', 75: 'Good', 100: 'Strong' };
const STRENGTH_COLORS = { 0: '#ef4444', 25: '#ef4444', 50: '#f59e0b', 75: '#3b82f6', 100: '#10b981' };

function PasswordStrengthBar({ password }) {
  const strength = getStrength(password);
  if (!password) return null;
  const color = STRENGTH_COLORS[strength] || '#ef4444';
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium">
        <span className="text-[var(--text-tertiary)]">Strength</span>
        <span style={{ color }}>{STRENGTH_LABELS[strength] || 'Weak'}</span>
      </div>
      <div className="flex gap-1">
        {[25, 50, 75, 100].map((step) => (
          <div key={step} className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--st-fill-strong)]">
            <motion.div initial={false} animate={{ width: strength >= step ? '100%' : '0%' }} transition={{ duration: 0.3 }} className="h-full" style={{ background: color }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function PasswordInput({ value, onChange, placeholder, showToggle, onToggle, suffix }) {
  return (
    <div className="relative">
      <input type={showToggle ? 'text' : 'password'} placeholder={placeholder} value={value} onChange={onChange} className={`${fieldClass} h-10 pr-16`} />
      <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
        {suffix}
        <button
          type="button"
          onClick={onToggle}
          aria-label={showToggle ? 'Hide password' : 'Show password'}
          className="grid h-6 w-6 cursor-pointer place-items-center rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
        >
          {showToggle ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  );
}

const Notice = ({ tone, icon: Icon, children }) => (
  <div
    className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12.5px] ${
      tone === 'ok' ? 'bg-emerald-500/[0.07] text-emerald-600 dark:text-emerald-400' : 'bg-red-500/[0.06] text-red-500'
    }`}
  >
    <Icon size={14} strokeWidth={2.2} /> {children}
  </div>
);

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
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
    setShowCurrent(false);
    setShowNew(false);
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handlePasswordSubmit = async () => {
    if (!currentPw || !newPw || !confirmPw) return setErrorMsg('Please fill in all fields.');
    if (newPw !== confirmPw) return setErrorMsg('Passwords do not match.');
    if (newPw.length < 8) return setErrorMsg('Minimum 8 characters.');
    if (getStrength(newPw) < 50) return setErrorMsg('Choose a stronger password.');

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
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
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await API.delete('/api/user/account');
      if (res.status === 200) {
        logout();
        navigate('/');
      } else {
        setErrorMsg(res.data?.error || 'Could not delete account.');
        setLoading(false);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Network error.');
      setLoading(false);
    }
  };

  const matchIcon = confirmPw ? (
    newPw === confirmPw ? <Check size={13} strokeWidth={2.6} className="text-emerald-500" /> : <X size={13} strokeWidth={2.6} className="text-red-500" />
  ) : null;

  return (
    <div className="flex flex-col gap-8">
      <AnimatePresence>
        {modalType === 'password' && (
          <DialogModal title="Change password" description="Use at least 8 characters with a mix of letters, numbers and symbols." primaryAction={handlePasswordSubmit} primaryLabel="Update password" loading={loading} onClose={closeModals}>
            <div className="flex flex-col gap-2.5">
              <PasswordInput value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder="Current password" showToggle={showCurrent} onToggle={() => setShowCurrent((v) => !v)} />
              <div className="my-1 h-px bg-[var(--st-line)]" />
              <PasswordInput value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="New password" showToggle={showNew} onToggle={() => setShowNew((v) => !v)} />
              <PasswordInput value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Confirm new password" showToggle={showNew} onToggle={() => setShowNew((v) => !v)} suffix={matchIcon} />
              {newPw && (
                <div className="mt-1">
                  <PasswordStrengthBar password={newPw} />
                </div>
              )}
              {errorMsg && <Notice icon={AlertTriangle}>{errorMsg}</Notice>}
              {successMsg && (
                <Notice tone="ok" icon={Check}>
                  {successMsg}
                </Notice>
              )}
            </div>
          </DialogModal>
        )}

        {modalType === 'delete' && (
          <DialogModal
            title="Delete your account?"
            description="This permanently erases your workspace, sessions and all data. It cannot be undone."
            primaryAction={handleDeleteSubmit}
            primaryLabel="Delete account"
            primaryDanger
            loading={loading}
            onClose={closeModals}
          >
            {errorMsg && <Notice icon={AlertTriangle}>{errorMsg}</Notice>}
          </DialogModal>
        )}
      </AnimatePresence>

      <section>
        <SectionTitle>Sign in</SectionTitle>
        <SettingsGroup>
          <SettingsRow
            icon={Mail}
            label={user?.email || 'No email on file'}
            rightElement={
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <Check size={11} strokeWidth={2.6} />
                Verified
              </span>
            }
          />
          <SettingsRow icon={Lock} label="Change password" onClick={() => setModalType('password')} />
        </SettingsGroup>
      </section>

      <section>
        <SectionTitle>Connected accounts</SectionTitle>
        <SettingsGroup>
          <ProviderRow logo={GoogleLogo} label="Google" isConnected={!!user?.googleId} onConnect={() => (window.location.href = `${API_URL}/api/auth/google`)} />
          <ProviderRow logo={GitHubLogo} label="GitHub" isConnected={!!user?.githubId} onConnect={() => (window.location.href = `${API_URL}/api/auth/github`)} />
        </SettingsGroup>
      </section>

      <PrivacySection syncSettings={syncSettings} showToast={showToast} />

      <section>
        <SectionTitle>Session</SectionTitle>
        <SettingsGroup>
          <ContextButton icon={LogOut} onClick={() => logout()}>
            Sign out
          </ContextButton>
          <ContextButton icon={Trash2} danger onClick={() => setModalType('delete')}>
            Delete account
          </ContextButton>
        </SettingsGroup>
      </section>
    </div>
  );
}
