import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Key, Eye, EyeOff, Trash2,
  Activity, Zap, Edit2, CheckCircle, XCircle
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import {
  AppleToggle, PremiumDropdown,
  StatusBadge, ValidationError, API_URL
} from '../SettingsShared';
import { PROVIDER_INFO, MODEL_LABELS } from './ProviderRegistry';

// ─── Key Card ─────────────────────────────────────────────────────────────────

const KeyCard = ({ keyData, onDelete, onToggle, onTest, onUpdated, showToast, testResult, isTesting }) => {
  const { token } = useAuth();
  const [expanded, setExpanded]           = useState(false);
  const [editLabel, setEditLabel]         = useState(keyData.label || '');
  const [editModel, setEditModel]         = useState(keyData.model || '');
  const [editKey, setEditKey]             = useState('');
  const [editBaseUrl, setEditBaseUrl]     = useState(keyData.baseUrl || '');
  const [showKey, setShowKey]             = useState(false);
  const [saving, setSaving]               = useState(false);
  const [editErr, setEditErr]             = useState('');

  const info = PROVIDER_INFO[keyData.provider];
  const pc   = info?.color || '#888';
  const isCustom = keyData.provider === 'custom';

  const handleSave = async () => {
    setSaving(true); setEditErr('');
    try {
      const payload = { label: editLabel.trim(), model: editModel.trim(), baseUrl: editBaseUrl.trim() };
      if (editKey && !editKey.includes('****')) payload.apiKey = editKey.trim();

      const res = await fetch(`${API_URL}/api/apikeys/${keyData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) { showToast?.('Key updated', 'success'); setExpanded(false); onUpdated?.(); }
      else setEditErr(data.details || data.error || 'Update failed');
    } catch { setEditErr('Network error'); }
    finally { setSaving(false); }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ 
        background: 'var(--bg-secondary)', 
        border: `1px solid var(--border-color)`, 
        borderLeft: `4px solid ${pc}`, 
        borderRadius: '20px', 
        padding: '16px 20px', 
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 
        opacity: keyData.isActive ? 1 : 0.6,
        boxShadow: keyData.isActive ? '0 4px 20px rgba(0,0,0,0.04)' : 'none',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div style={{ position: 'absolute', top: 0, right: 0, width: '60px', height: '60px', background: `radial-gradient(circle at top right, ${pc}10, transparent)`, pointerEvents: 'none' }} />
      
      {/* Row 1 — summary */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{ 
          width: '36px', height: '36px', borderRadius: '12px', 
          background: `${pc}15`, border: `1px solid ${pc}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: pc,
          flexShrink: 0
        }}>
          <Key size={18} strokeWidth={2} />
        </div>
        
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {keyData.label || info?.name || keyData.provider}
            </div>
            <StatusBadge isValid={keyData.isValid} isActive={keyData.isActive} />
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px', fontFamily: '"Geist Mono", monospace', letterSpacing: '-0.02em' }}>
            {keyData.maskedKey} <span style={{ opacity: 0.5 }}>·</span> {keyData.model}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {/* Test button */}
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => !isTesting && onTest(keyData.id)} 
            disabled={isTesting} 
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '10px', cursor: isTesting ? 'default' : 'pointer', color: 'var(--text-secondary)', padding: '6px', opacity: isTesting ? 0.5 : 1, display: 'flex' }} 
            title="Test connection"
          >
            {isTesting
              ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><Activity size={14} /></motion.div>
              : <Zap size={14} />}
          </motion.button>
          
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setExpanded(e => !e)} 
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '10px', cursor: 'pointer', color: 'var(--text-secondary)', padding: '6px', display: 'flex' }} 
            title="Edit"
          >
            <Edit2 size={14} />
          </motion.button>
          
          <div style={{ marginLeft: '4px', marginRight: '4px' }}>
            <AppleToggle value={keyData.isActive} onChange={v => onToggle(keyData.id, v)} />
          </div>

          <motion.button 
            whileHover={{ scale: 1.1, background: '#fee2e2', color: '#ef4444' }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onDelete(keyData.id)} 
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef444488', padding: '6px', borderRadius: '10px', display: 'flex' }} 
            title="Delete key"
          >
            <Trash2 size={14} />
          </motion.button>
        </div>
      </div>

      {/* Test result */}
      {testResult && (
        <div style={{ marginTop: '8px', padding: '6px 10px', borderRadius: '8px', background: testResult.valid ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', fontSize: '11px', color: testResult.valid ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'flex-start', gap: '5px' }}>
          {testResult.valid ? <CheckCircle size={11} style={{ marginTop: '1px', flexShrink: 0 }} /> : <XCircle size={11} style={{ marginTop: '1px', flexShrink: 0 }} />}
          <span style={{ whiteSpace: 'pre-line' }}>{testResult.valid ? `Connected in ${testResult.latencyMs}ms` : testResult.error}</span>
        </div>
      )}

      {/* Inline edit form */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
            <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>

              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '4px', textTransform: 'uppercase' }}>Label</div>
                <input type="text" value={editLabel} onChange={e => setEditLabel(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '4px', textTransform: 'uppercase' }}>New API Key (leave blank to keep current)</div>
                <div style={{ position: 'relative' }}>
                  <input type={showKey ? 'text' : 'password'} value={editKey} onChange={e => setEditKey(e.target.value)} placeholder="Enter new key to replace existing" style={{ width: '100%', padding: '8px 36px 8px 10px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
                  <button onClick={() => setShowKey(s => !s)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                    {showKey ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>
                </div>
              </div>

              {isCustom && (
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '4px', textTransform: 'uppercase' }}>Base URL</div>
                  <input type="text" value={editBaseUrl} onChange={e => setEditBaseUrl(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              )}

              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '4px', textTransform: 'uppercase' }}>Model</div>
                {isCustom
                  ? <input type="text" value={editModel} onChange={e => setEditModel(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
                  : info?.models?.length > 0 && (
                    <PremiumDropdown value={editModel} onChange={setEditModel} options={info.models.map(m => ({ value: m, label: MODEL_LABELS[m] || m }))} styleContext="form" />
                  )
                }
              </div>

              <AnimatePresence>{editErr && <ValidationError message={editErr} />}</AnimatePresence>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: '9px', borderRadius: '10px', background: 'var(--text-primary)', color: 'var(--bg-primary)', border: 'none', fontSize: '12px', fontWeight: 600, cursor: saving ? 'default' : 'pointer' }}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                <button onClick={() => { setExpanded(false); setEditErr(''); }} style={{ padding: '9px 14px', borderRadius: '10px', background: 'transparent', border: '1px solid var(--border-color)', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default KeyCard;
