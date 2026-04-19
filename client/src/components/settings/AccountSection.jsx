import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Lock, LogOut, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  SectionTitle, SettingsGroup, SettingsRow,
  DialogModal, ContextButton
} from './SettingsLayout';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const AccountSection = ({ user, logout }) => {
  const navigate = useNavigate();
  const { token } = useAuth();
  
  const [modalType, setModalType] = useState(null); // 'password' | 'delete' | null
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
          <DialogModal
            title="Change Password"
            primaryAction={handlePasswordSubmit}
            primaryLabel="Update Password"
            loading={loading}
            onClose={closeModals}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input 
                type="password" placeholder="Current Password" 
                value={currentPw} onChange={e => setCurrentPw(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
              />
              <input 
                type="password" placeholder="New Password" 
                value={newPw} onChange={e => setNewPw(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
              />
              {errorMsg && <div style={{ color: '#ef4444', fontSize: '12px', fontWeight: 500 }}>{errorMsg}</div>}
              {successMsg && <div style={{ color: '#10b981', fontSize: '12px', fontWeight: 500 }}>{successMsg}</div>}
            </div>
          </DialogModal>
        )}
        
        {modalType === 'delete' && (
          <DialogModal
            title="Delete Account"
            description="This action is permanent and cannot be undone. All your learning progress and data will be erased."
            primaryAction={handleDeleteSubmit}
            primaryLabel="Delete Permanently"
            primaryDanger
            loading={loading}
            onClose={closeModals}
          >
            {errorMsg && <div style={{ color: '#ef4444', fontSize: '12px', fontWeight: 500 }}>{errorMsg}</div>}
          </DialogModal>
        )}
      </AnimatePresence>

      <SectionTitle>Security</SectionTitle>
      <SettingsGroup>
        <SettingsRow
          icon={Lock} label="Change Password"
          description="Update your account security"
          onClick={() => setModalType('password')}
        />
      </SettingsGroup>

      <SectionTitle>Session</SectionTitle>
      <SettingsGroup>
        <ContextButton icon={LogOut} onClick={logout}>Sign Out</ContextButton>
        <ContextButton icon={Trash2} danger onClick={() => setModalType('delete')}>Delete Account</ContextButton>
      </SettingsGroup>
    </div>
  );
};

export default AccountSection;
