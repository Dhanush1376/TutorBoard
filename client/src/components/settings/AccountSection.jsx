import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { 
  Lock, Globe2, LogOut, Trash2, 
  Upload, RotateCcw, Download, Layers, AlertTriangle,
  Eye, EyeOff, Check, X
} from 'lucide-react';
import useTutorStore from '../../store/tutorStore';
import { useAuth } from '../../context/AuthContext';
import { 
  SectionTitle, SettingsGroup, SettingsRow, 
  ContextButton, DialogModal, API_URL, AppleToggle,
  RightInlineSelect
} from './SettingsShared';

export const PrivacySection = ({ syncSettings, token, showToast }) => {
  const { showAlert } = useTutorStore();
  const [cloudSync, setCloudSync] = useState(localStorage.getItem('tb-cloud-sync') !== 'false');
  const [localHistory, setLocalHistory] = useState(localStorage.getItem('tb-local-history') !== 'false');
  const [autoSaveFreq, setAutoSaveFreq] = useState(localStorage.getItem('tb-auto-save') || '5');

  useEffect(() => {
    const timeout = setTimeout(() => {
      localStorage.setItem('tb-cloud-sync', String(cloudSync));
      localStorage.setItem('tb-local-history', String(localHistory));
      localStorage.setItem('tb-auto-save', autoSaveFreq);
      syncSettings('privacy', { cloudSync, localHistory, autoSaveFreq });
    }, 300);
    return () => clearTimeout(timeout);
  }, [cloudSync, localHistory, autoSaveFreq, syncSettings]);

  const handleExport = async () => {
    try {
      const res = await fetch(`${API_URL}/api/user/export`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) throw new Error('Export failed');
      const data = await res.json();
      const content = JSON.stringify(data, null, 2);
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'tutorboard-data.json'; a.click();
      showToast?.('Data exported successfully', 'success');
    } catch (e) { 
      console.error(e);
      showToast?.('Export failed', 'error');
    }
  };

  const handleWipeData = async () => {
    try {
      const res = await fetch(`${API_URL}/api/user/data`, { 
        method: 'DELETE', 
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      if (res.ok) {
        showToast?.('All cloud data wiped', 'info');
      } else {
        showToast?.('Wipe failed', 'error');
      }
    } catch (e) {
      showToast?.('Network error', 'error');
    }
  };

  return (
    <div style={{ marginTop: '40px' }}>
      <SectionTitle>Cloud & Storage</SectionTitle>
      <SettingsGroup>
        <SettingsRow icon={Upload} label="Cloud Sync" rightElement={<AppleToggle value={cloudSync} onChange={setCloudSync} />} />
        <SettingsRow icon={RotateCcw} label="Auto-Save" rightElement={<RightInlineSelect value={autoSaveFreq} onChange={setAutoSaveFreq} options={[{ value: '5', label: '5s' }, { value: '30', label: '30s' }]} />} />
        <SettingsRow icon={Download} label="Local History" borderBottom={false} rightElement={<AppleToggle value={localHistory} onChange={setLocalHistory} />} />
      </SettingsGroup>
      <SectionTitle>Data Management</SectionTitle>
      <SettingsGroup>
        <ContextButton icon={Download} onClick={handleExport}>Export Data</ContextButton>
        <ContextButton icon={Trash2} danger borderBottom={false} onClick={() => showAlert({ 
          title: 'Wipe Cloud Data', 
          message: 'This will permanently delete all your chat sessions and canvas history. This cannot be undone.',
          confirmLabel: 'Wipe Everything',
          type: 'warning',
          onConfirm: handleWipeData 
        })}>Wipe Cloud Data</ContextButton>
      </SettingsGroup>
    </div>
  );
};

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
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
    setShowCurrent(false);
    setShowNew(false);
    setErrorMsg('');
    setSuccessMsg('');
  };

  const getPasswordStrength = (pw) => {
    if (!pw) return 0;
    let strength = 0;
    if (pw.length >= 8) strength += 25;
    if (/[A-Z]/.test(pw)) strength += 25;
    if (/[0-9]/.test(pw)) strength += 25;
    if (/[^A-Za-z0-9]/.test(pw)) strength += 25;
    return strength;
  };

  const handlePasswordSubmit = async () => {
    if (!currentPw || !newPw || !confirmPw) {
      setErrorMsg("Please fill in all fields.");
      return;
    }
    if (newPw !== confirmPw) {
      setErrorMsg("New passwords do not match.");
      return;
    }
    if (newPw.length < 8) {
      setErrorMsg("New password must be at least 8 characters.");
      return;
    }
    setLoading(true); setErrorMsg(''); setSuccessMsg('');
    try {
      const res = await fetch(`${API_URL}/api/user/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg("Password updated successfully.");
        setTimeout(closeModals, 1500);
      } else {
        setErrorMsg(data.error || "Failed to update password");
        setLoading(false);
      }
    } catch (e) {
      setErrorMsg("Network error.");
      setLoading(false);
    }
  };

  const handleDeleteSubmit = async () => {
    setLoading(true); setErrorMsg('');
    try {
      const res = await fetch(`${API_URL}/api/user/account`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        logout();
        navigate('/');
      } else {
        const data = await res.json();
        setErrorMsg(data.error || "Failed to delete account");
        setLoading(false);
      }
    } catch (e) {
      setErrorMsg("Network error.");
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      <AnimatePresence>
        {modalType === 'password' && (
          <DialogModal title="Change Password" primaryAction={handlePasswordSubmit} primaryLabel="Update Password" loading={loading} onClose={closeModals}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showCurrent ? "text" : "password"} 
                  placeholder="Current Password" 
                  value={currentPw} 
                  onChange={e => setCurrentPw(e.target.value)} 
                  style={{ width: '100%', padding: '12px 44px 12px 14px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} 
                />
                <button 
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <div style={{ position: 'relative' }}>
                <input 
                  type={showNew ? "text" : "password"} 
                  placeholder="New Password" 
                  value={newPw} 
                  onChange={e => setNewPw(e.target.value)} 
                  style={{ width: '100%', padding: '12px 44px 12px 14px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} 
                />
                <button 
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <div style={{ position: 'relative' }}>
                <input 
                  type={showNew ? "text" : "password"} 
                  placeholder="Confirm New Password" 
                  value={confirmPw} 
                  onChange={e => setConfirmPw(e.target.value)} 
                  style={{ width: '100%', padding: '12px 44px 12px 14px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} 
                />
                <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', padding: '4px', display: 'flex', alignItems: 'center', opacity: 0.5 }}>
                  {confirmPw && (newPw === confirmPw ? <Check size={16} style={{ color: '#10b981' }} /> : <X size={16} style={{ color: '#ef4444' }} />)}
                </div>
              </div>

              {/* Password Strength Meter */}
              <div style={{ height: '14px', display: 'flex', alignItems: 'center' }}>
                {newPw && (
                  <div style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 500 }}>Password Strength</span>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: getPasswordStrength(newPw) <= 25 ? '#ef4444' : getPasswordStrength(newPw) <= 50 ? '#f59e0b' : getPasswordStrength(newPw) <= 75 ? '#3b82f6' : '#10b981' }}>
                        {getPasswordStrength(newPw) <= 25 ? 'Weak' : getPasswordStrength(newPw) <= 50 ? 'Fair' : getPasswordStrength(newPw) <= 75 ? 'Good' : 'Strong'}
                      </span>
                    </div>
                    <div style={{ height: '4px', width: '100%', background: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden' }}>
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${getPasswordStrength(newPw)}%` }}
                        style={{ height: '100%', background: getPasswordStrength(newPw) <= 25 ? '#ef4444' : getPasswordStrength(newPw) <= 50 ? '#f59e0b' : getPasswordStrength(newPw) <= 75 ? '#3b82f6' : '#10b981' }}
                      />
                    </div>
                  </div>
                )}
              </div>
              {/* Complexity Checklist */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                {[
                  { label: '8+ Characters', met: newPw.length >= 8 },
                  { label: 'Upper Case', met: /[A-Z]/.test(newPw) },
                  { label: 'Number', met: /[0-9]/.test(newPw) },
                  { label: 'Special Char', met: /[^A-Za-z0-9]/.test(newPw) }
                ].map((req, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: req.met ? '#10b981' : 'var(--text-tertiary)', opacity: req.met ? 1 : 0.6 }}>
                    {req.met ? <Check size={12} strokeWidth={3} /> : <div style={{ width: '12px' }} />}
                    {req.label}
                  </div>
                ))}
              </div>

              {errorMsg && <div style={{ color: '#ef4444', fontSize: '12px', fontWeight: 400, background: '#fee2e2', padding: '10px', borderRadius: '10px', border: '1px solid #fecaca', display: 'flex', gap: '8px', alignItems: 'center' }}><AlertTriangle size={14} /> {errorMsg}</div>}
              {successMsg && <div style={{ color: '#10b981', fontSize: '12px', fontWeight: 400, background: '#dcfce7', padding: '10px', borderRadius: '10px', border: '1px solid #bbf7d0', display: 'flex', gap: '8px', alignItems: 'center' }}><Check size={14} /> {successMsg}</div>}
            </div>
          </DialogModal>
        )}
        
        {modalType === 'delete' && (
          <DialogModal title="Delete Account" description="Are you absolutely sure? This action cannot be undone." primaryAction={handleDeleteSubmit} primaryLabel="Yes, Delete Everything" primaryDanger={true} loading={loading} onClose={closeModals}>
            {errorMsg && <div style={{ color: '#ef4444', fontSize: '12px', fontWeight: 400 }}>{errorMsg}</div>}
          </DialogModal>
        )}
      </AnimatePresence>

      <SectionTitle>Email</SectionTitle>
      <SettingsGroup>
        <SettingsRow label="Contact Email" rightElement={<span style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>{user?.email || 'Not provided'}</span>} borderBottom={false} />
      </SettingsGroup>

      <SectionTitle>Security</SectionTitle>
      <SettingsGroup>
        <SettingsRow label="Change Password" icon={Lock} onClick={() => setModalType('password')} borderBottom={false} />
      </SettingsGroup>

      <SectionTitle>Linked Accounts</SectionTitle>
      <SettingsGroup>
        <SettingsRow icon={Globe2} label="Google" description={user?.googleId ? 'Connected' : 'Not Connected'}
          rightElement={<button onClick={() => { if (!user?.googleId) window.location.href = `${API_URL}/api/auth/google`; }} style={{ fontSize: '14px', color: user?.googleId ? 'var(--text-tertiary)' : '#007AFF', background: 'none', border: 'none', cursor: 'pointer' }}>{user?.googleId ? 'Disconnect' : 'Connect'}</button>}
        />
        <SettingsRow icon={Globe2} label="GitHub" description={user?.githubId ? 'Connected' : 'Not Connected'} borderBottom={false}
          rightElement={<button onClick={() => { if (!user?.githubId) window.location.href = `${API_URL}/api/auth/github`; }} style={{ fontSize: '14px', color: user?.githubId ? 'var(--text-tertiary)' : '#007AFF', background: 'none', border: 'none', cursor: 'pointer' }}>{user?.githubId ? 'Disconnect' : 'Connect'}</button>}
        />
      </SettingsGroup>

      <SectionTitle>Session</SectionTitle>
      <SettingsGroup>
        <ContextButton icon={LogOut} onClick={() => { logout(); navigate('/'); }}>Sign Out</ContextButton>
        <ContextButton icon={Trash2} danger onClick={() => setModalType('delete')} borderBottom={false}>Delete Account</ContextButton>
      </SettingsGroup>


    </div>
  );
}
