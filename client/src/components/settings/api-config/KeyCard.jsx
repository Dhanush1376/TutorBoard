import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Key, Eye, EyeOff, Trash2,
  Activity, Zap, Edit2, CheckCircle, XCircle
} from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import {
  AppleToggle, PremiumDropdown,
  StatusBadge, ValidationError, API_URL
} from '../SettingsShared';
import { PROVIDER_INFO, MODEL_LABELS } from './ProviderRegistry';

// ─── Shared styles ────────────────────────────────────────────────────────────

const fieldLabel = {
  fontSize: '10px', fontWeight: 500, color: 'var(--text-tertiary)',
  marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em',
};

const fieldInput = {
  width: '100%', padding: '8px 10px', borderRadius: '8px',
  border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)',
  color: 'var(--text-primary)', fontSize: '12px', outline: 'none',
  boxSizing: 'border-box', transition: 'border-color 0.12s',
};

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
  const pc   = info?.color || '#8b5cf6';
  const isCustom = keyData.provider === 'custom';

  const handleSave = async () => {
    setSaving(true); setEditErr('');
    try {
      const payload = { label: editLabel.trim(), model: editModel.trim(), baseUrl: editBaseUrl.trim() };
      if (editKey && !editKey.includes('****')) payload.apiKey = editKey.trim();

      const response = await API.put(`/api/apikeys/${keyData.id}`, payload);
      
      if (response.status === 200) {
        showToast?.('Key updated', 'success');
        setExpanded(false);
        onUpdated?.();
      } else {
        setEditErr(response.data?.details || response.data?.error || 'Update failed');
      }
    } catch { setEditErr('Network error'); }
    finally { setSaving(false); }
  };

  return (
    <div 
      style={{ 
        background: 'var(--bg-secondary)', 
        border: '1px solid var(--border-color)',
        borderRadius: '12px', 
        padding: '12px 14px', 
        opacity: keyData.isActive ? 1 : 0.55,
        transition: 'opacity 0.12s',
      }}
    >
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ 
          width: '28px', height: '28px', borderRadius: '8px', 
          background: `${pc}12`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: pc,
          flexShrink: 0,
        }}>
          <Key size={13} strokeWidth={2} />
        </div>
        
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.01em' }}>
              {keyData.label || info?.name || keyData.provider}
            </span>
            <StatusBadge isValid={keyData.isValid} isActive={keyData.isActive} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10.5px', color: 'var(--text-tertiary)', marginTop: '2px', fontWeight: 400 }}>
            <span style={{ fontFamily: '"Geist Mono", monospace', opacity: 0.7 }}>{keyData.maskedKey}</span>
            <span style={{ opacity: 0.3 }}>·</span>
            <span>{MODEL_LABELS[keyData.model] || keyData.model}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button 
            onClick={() => !isTesting && onTest(keyData.id)} 
            disabled={isTesting} 
            title="Test"
            style={{ background: 'none', border: 'none', cursor: isTesting ? 'default' : 'pointer', color: 'var(--text-tertiary)', display: 'flex', padding: '5px', borderRadius: '6px', opacity: 0.5, transition: 'opacity 0.12s' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}
          >
            {isTesting
              ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><Activity size={13} strokeWidth={2} /></motion.div>
              : <Zap size={13} strokeWidth={2} />}
          </button>
          
          <button 
            onClick={() => setExpanded(e => !e)} 
            title="Edit"
            style={{ background: expanded ? 'var(--bg-tertiary)' : 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', padding: '5px', borderRadius: '6px', opacity: expanded ? 1 : 0.5, transition: 'all 0.12s' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => !expanded && (e.currentTarget.style.opacity = '0.5')}
          >
            <Edit2 size={13} strokeWidth={2} />
          </button>
          
          <div style={{ marginLeft: '2px' }}>
            <AppleToggle value={keyData.isActive} onChange={v => onToggle(keyData.id, v)} />
          </div>

          <button 
            onClick={() => onDelete(keyData.id)} 
            title="Delete"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', padding: '5px', borderRadius: '6px', opacity: 0.3, transition: 'all 0.12s' }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#ef4444'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '0.3'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}
          >
            <Trash2 size={13} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Test result banner */}
      <AnimatePresence>
        {testResult && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ 
              marginTop: '10px', padding: '8px 12px', borderRadius: '8px', 
              background: testResult.valid ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)', 
              fontSize: '11px', color: testResult.valid ? '#10b981' : '#ef4444', 
              display: 'flex', alignItems: 'center', gap: '8px',
              fontWeight: 400,
            }}>
              {testResult.valid ? <CheckCircle size={13} strokeWidth={2.5} /> : <XCircle size={13} strokeWidth={2.5} />}
              <span>{testResult.valid ? `Connected — ${testResult.latencyMs}ms` : (typeof testResult.error === 'object' ? JSON.stringify(testResult.error) : testResult.error)}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} 
            animate={{ opacity: 1, height: 'auto' }} 
            exit={{ opacity: 0, height: 0 }} 
            style={{ overflow: 'hidden' }}
          >
            <div style={{ 
              marginTop: '12px', paddingTop: '12px', 
              borderTop: '1px solid var(--border-color)', 
              display: 'flex', flexDirection: 'column', gap: '10px' 
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <div style={fieldLabel}>Label</div>
                  <input type="text" value={editLabel} onChange={e => setEditLabel(e.target.value)} style={fieldInput} />
                </div>
                <div>
                  <div style={fieldLabel}>Model</div>
                  {isCustom
                    ? <input type="text" value={editModel} onChange={e => setEditModel(e.target.value)} style={{ ...fieldInput, fontFamily: '"Geist Mono", monospace' }} />
                    : info?.models?.length > 0 && (
                      <PremiumDropdown value={editModel} onChange={setEditModel} options={info.models.map(m => ({ value: m, label: MODEL_LABELS[m] || m }))} styleContext="form" />
                    )
                  }
                </div>
              </div>

              <div>
                <div style={fieldLabel}>API Key <span style={{ textTransform: 'none', fontWeight: 400, opacity: 0.5 }}>(blank = keep current)</span></div>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showKey ? 'text' : 'password'} 
                    value={editKey} 
                    onChange={e => setEditKey(e.target.value)} 
                    placeholder="••••••••••••" 
                    style={{ ...fieldInput, paddingRight: '36px', fontFamily: '"Geist Mono", monospace' }} 
                  />
                  <button onClick={() => setShowKey(s => !s)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', padding: '2px', opacity: 0.5 }}>
                    {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>

              {isCustom && (
                <div>
                  <div style={fieldLabel}>Base URL</div>
                  <input type="text" value={editBaseUrl} onChange={e => setEditBaseUrl(e.target.value)} style={{ ...fieldInput, fontFamily: '"Geist Mono", monospace' }} />
                </div>
              )}

              <AnimatePresence>{editErr && <ValidationError message={editErr} />}</AnimatePresence>

              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button 
                  onClick={handleSave} disabled={saving} 
                  style={{ 
                    flex: 2, padding: '8px', borderRadius: '8px', 
                    background: 'var(--text-primary)', color: 'var(--bg-primary)', 
                    border: 'none', fontSize: '11px', fontWeight: 500, 
                    cursor: saving ? 'default' : 'pointer',
                    opacity: saving ? 0.5 : 1, transition: 'opacity 0.12s',
                  }}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button 
                  onClick={() => { setExpanded(false); setEditErr(''); }} 
                  style={{ 
                    flex: 1, padding: '8px', borderRadius: '8px', 
                    background: 'transparent', border: '1px solid var(--border-color)', 
                    fontSize: '11px', cursor: 'pointer', color: 'var(--text-secondary)', 
                    fontWeight: 400,
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Usage bar */}
      {keyData.isActive && keyData.usage && (
        <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '6px', fontWeight: 400, color: 'var(--text-tertiary)' }}>
            <span>{keyData.usage.requests} requests</span>
            <span style={{ fontFamily: '"Geist Mono", monospace' }}>${(keyData.usage.costCents / 100).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', gap: '2px', height: '3px' }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(seg => {
              const intensity = Math.min(10, Math.ceil(keyData.usage.requests / 15));
              const isActive = seg <= intensity;
              return (
                <div 
                  key={seg}
                  style={{ 
                    flex: 1, height: '100%', 
                    background: isActive ? pc : 'var(--bg-tertiary)', 
                    borderRadius: '1px',
                    opacity: isActive ? (0.4 + (seg * 0.06)) : 0.15,
                  }} 
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default KeyCard;
