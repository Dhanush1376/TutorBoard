import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { 
  Lock, Globe2, LogOut, Trash2, 
  Upload, RotateCcw, Download, Layers, AlertTriangle 
} from 'lucide-react';
import useTutorStore from '../../store/tutorStore';

const PrivacySection = ({ syncSettings }) => {
  const { token } = useAuth();
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
    }, 1000);
    return () => clearTimeout(timeout);
  }, [cloudSync, localHistory, autoSaveFreq, syncSettings]);

  const handleExport = async () => {
    try {
      const res = await fetch(`${API_URL}/api/user/export`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      const csvContent = "\uFEFF" + (data.sessions || []).map(s => `"${s.title}", "${s.createdAt}"`).join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'export.csv'; a.click();
    } catch (e) { console.error(e); }
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
        <ContextButton icon={Trash2} danger borderBottom={false} onClick={() => showAlert({ title: 'Wipe Data', onConfirm: () => {} })}>Wipe Cloud Data</ContextButton>
      </SettingsGroup>
    </div>
  );
};
import { useAuth } from '../../context/AuthContext';
import { 
  SectionTitle, SettingsGroup, SettingsRow, 
  ContextButton, DialogModal, API_URL 
} from './SettingsShared';

export default function AccountSection({ user, logout, syncSettings }) {
  const navigate = useNavigate();
  const { token } = useAuth();
  
  const [modalType, setModalType] = useState(null);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const closeModals = () => {
    if (loading) return;
    setModalType(null);
    setCurrentPw('');
    setNewPw('');
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handlePasswordSubmit = async () => {
    if (!currentPw || !newPw) {
      setErrorMsg("Please fill in both fields.");
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input type="password" placeholder="Current Password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              <input type="password" placeholder="New Password" value={newPw} onChange={e => setNewPw(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              {errorMsg && <div style={{ color: '#ef4444', fontSize: '12px', fontWeight: 500 }}>{errorMsg}</div>}
              {successMsg && <div style={{ color: '#10b981', fontSize: '12px', fontWeight: 500 }}>{successMsg}</div>}
            </div>
          </DialogModal>
        )}
        
        {modalType === 'delete' && (
          <DialogModal title="Delete Account" description="Are you absolutely sure? This action cannot be undone." primaryAction={handleDeleteSubmit} primaryLabel="Yes, Delete Everything" primaryDanger={true} loading={loading} onClose={closeModals}>
            {errorMsg && <div style={{ color: '#ef4444', fontSize: '12px', fontWeight: 500 }}>{errorMsg}</div>}
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

      <PrivacySection syncSettings={syncSettings} />
    </div>
  );
}
