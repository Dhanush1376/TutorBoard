import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Upload, Download, RotateCcw, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { SectionTitle, SettingsGroup, ContextButton, AppleToggle, DialogModal } from './SettingsLayout';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const PrivacySection = ({ syncSettings }) => {
  const { token } = useAuth();
  const [cloudSync, setCloudSync] = useState(localStorage.getItem('tb-cloud-sync') !== 'false');
  const [localHistory, setLocalHistory] = useState(localStorage.getItem('tb-local-history') !== 'false');

  const [modalType, setModalType] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => {
      localStorage.setItem('tb-cloud-sync', String(cloudSync));
      localStorage.setItem('tb-local-history', String(localHistory));
      syncSettings('privacy', { cloudSync, localHistory });
    }, 1000);
    return () => clearTimeout(timeout);
  }, [cloudSync, localHistory, syncSettings]);

  const handleExport = async () => {
    try {
      const res = await fetch(`${API_URL}/api/user/export`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      
      const rows = [];
      rows.push(['TUTORBOARD SESSION EXPORT']);
      rows.push(['Export Date', new Date().toLocaleString()]);
      rows.push(['Name', data.user.name]);
      rows.push(['Email', data.user.email]);
      rows.push([]);
      
      rows.push(['Session ID', 'Session Title', 'Created At', 'Message/Interaction Count']);
      
      (data.sessions || []).forEach(session => {
        rows.push([
          session._id,
          session.title || 'Untitled Session',
          new Date(session.createdAt).toLocaleString(),
          (session.history || []).length
        ]);
      });

      const csvContent = "\uFEFF" + rows.map(r => r.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tutorboard-export-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Failed to export data");
    }
  };

  const handleWipeCloud = async () => {
    setLoading(true); setErrorMsg('');
    try {
      const res = await fetch(`${API_URL}/api/user/data`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        setModalType(null);
      } else {
        const d = await res.json();
        setErrorMsg(d.error || 'Failed to wipe data.');
        setLoading(false);
      }
    } catch (e) { 
      setErrorMsg('Network error while wiping data.');
      setLoading(false);
    }
  };

  const closeModals = () => {
    if (loading) return;
    setModalType(null);
    setErrorMsg('');
  };

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      <AnimatePresence>
        {modalType === 'clear-local' && (
          <DialogModal
            title="Clear Local Data"
            description="Are you sure you want to clear all locally cached data? This includes offline sessions and UI state. The application will immediately reload."
            primaryAction={() => { localStorage.clear(); sessionStorage.clear(); window.location.reload(); }}
            primaryLabel="Clear & Reload"
            primaryDanger={true}
            onClose={closeModals}
          />
        )}
        
        {modalType === 'wipe-cloud' && (
          <DialogModal
            title="Wipe Cloud Data"
            description="Are you absolutely sure you want to permanently delete all your cloud sessions and data backups? This action cannot be undone."
            primaryAction={handleWipeCloud}
            primaryLabel="Yes, Wipe Cloud Data"
            primaryDanger={true}
            loading={loading}
            onClose={closeModals}
          >
            {errorMsg && <div style={{ color: '#ef4444', fontSize: '12px', fontWeight: 500 }}>{errorMsg}</div>}
          </DialogModal>
        )}
      </AnimatePresence>

      <SectionTitle>Cloud & Storage</SectionTitle>
      <SettingsGroup>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
             <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'var(--text-primary)', color: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Upload size={16} />
             </div>
             <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)' }}>Cloud Sync</div>
          </div>
          <AppleToggle value={cloudSync} onChange={setCloudSync} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
             <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'var(--text-primary)', color: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Download size={16} />
             </div>
             <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)' }}>Local History</div>
          </div>
          <AppleToggle value={localHistory} onChange={setLocalHistory} />
        </div>
      </SettingsGroup>

      <SectionTitle>Export</SectionTitle>
      <SettingsGroup>
        <ContextButton icon={Download} onClick={handleExport} borderBottom={false}>
          Export All Session Data
        </ContextButton>
      </SettingsGroup>

      <SectionTitle>Danger Zone</SectionTitle>
      <SettingsGroup>
        <ContextButton icon={RotateCcw} danger onClick={() => setModalType('clear-local')}>
          Clear Local Data & Cache
        </ContextButton>
        <ContextButton icon={Trash2} danger borderBottom={false} onClick={() => setModalType('wipe-cloud')}>
          Wipe Cloud Data
        </ContextButton>
      </SettingsGroup>
    </div>
  );
};

export default PrivacySection;
