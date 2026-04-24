import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Key, Eye, EyeOff, Trash2,
  Activity, Zap, Edit2, CheckCircle, XCircle, ChevronDown, Shield
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import {
  AppleToggle, PremiumDropdown,
  StatusBadge, ValidationError, API_URL
} from '../SettingsShared';
import { PROVIDER_INFO, MODEL_LABELS } from './ProviderRegistry';

// ─── Shared styles ────────────────────────────────────────────────────────────

const fieldLabel = {
  fontSize: '10px', fontWeight: 700, color: 'var(--text-tertiary)',
  marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.08em',
};

const fieldInput = {
  width: '100%', padding: '10px 12px', borderRadius: '12px',
  border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)',
  color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
  boxSizing: 'border-box', transition: 'border-color 0.2s, box-shadow 0.2s',
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

  const actionBtn = {
    background: 'var(--bg-tertiary)', 
    border: '1px solid var(--border-color)',
    borderRadius: '12px', 
    cursor: 'pointer', 
    color: 'var(--text-secondary)',
    padding: '8px', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center',
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
  };

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', damping: 25, stiffness: 220 }}
      style={{ 
        background: 'var(--bg-secondary)', 
        border: '1px solid var(--border-color)',
        borderRadius: '18px', 
        padding: '12px 16px', 
        opacity: keyData.isActive ? 1 : 0.6,
        boxShadow: keyData.isActive ? `0 8px 24px ${pc}08, 0 1px 2px rgba(0,0,0,0.02)` : '0 2px 8px rgba(0,0,0,0.02)',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Accent glow & Brand Stripe */}
      <div style={{ position: 'absolute', top: -30, right: -30, width: '120px', height: '120px', background: `radial-gradient(circle, ${pc}15, transparent 70%)`, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: pc, opacity: keyData.isActive ? 1 : 0.4 }} />

      {/* Main Content Area */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
        <div style={{ 
          width: '36px', height: '36px', borderRadius: '12px', 
          background: `linear-gradient(135deg, ${pc}15, ${pc}05)`,
          border: `1px solid ${pc}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: pc,
          flexShrink: 0, position: 'relative',
          boxShadow: `0 4px 12px ${pc}08`
        }}>
          <Key size={16} strokeWidth={2.5} />
          {keyData.isActive && (
            <div style={{ position: 'absolute', top: -2, right: -2, width: 10, height: 10, borderRadius: '50%', background: '#10b981', border: '2px solid var(--bg-secondary)', zIndex: 2 }} />
          )}
        </div>
        
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ fontSize: '13.5px', fontWeight: 750, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.02em' }}>
              {keyData.label || info?.name || keyData.provider}
            </div>
            <StatusBadge isValid={keyData.isValid} isActive={keyData.isActive} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px', fontWeight: 500 }}>
            <span style={{ fontFamily: '"Geist Mono", monospace', letterSpacing: '-0.01em', opacity: 0.8, background: 'var(--bg-tertiary)', padding: '1px 5px', borderRadius: '5px' }}>{keyData.maskedKey}</span>
            <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'var(--text-tertiary)', opacity: 0.3 }} />
            <span style={{ color: 'var(--text-secondary)' }}>{MODEL_LABELS[keyData.model] || keyData.model}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-tertiary)44', borderRadius: '14px', padding: '3px', border: '1px solid var(--border-color)' }}>
            <motion.button 
              whileHover={{ scale: 1.05, background: 'var(--bg-primary)' }}
              whileTap={{ scale: 0.95 }}
              onClick={() => !isTesting && onTest(keyData.id)} 
              disabled={isTesting} 
              style={{ ...actionBtn, border: 'none', background: 'transparent' }} 
              title="Test Health"
            >
              {isTesting
                ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}><Activity size={16} strokeWidth={2.5} /></motion.div>
                : <Zap size={16} strokeWidth={2.5} />}
            </motion.button>
            
            <motion.button 
              whileHover={{ scale: 1.05, background: 'var(--bg-primary)' }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setExpanded(e => !e)} 
              style={{ ...actionBtn, border: 'none', background: expanded ? 'var(--bg-primary)' : 'transparent' }} 
              title="Configure"
            >
              <Edit2 size={16} strokeWidth={2.5} />
            </motion.button>
          </div>
          
          <div style={{ marginLeft: '4px', marginRight: '4px' }}>
            <AppleToggle value={keyData.isActive} onChange={v => onToggle(keyData.id, v)} />
          </div>

          <motion.button 
            whileHover={{ scale: 1.1, background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onDelete(keyData.id)} 
            style={{ 
              background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', 
              padding: '8px', borderRadius: '10px', display: 'flex', opacity: 0.4, 
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' 
            }} 
            title="Disconnect"
          >
            <Trash2 size={16} strokeWidth={2.5} />
          </motion.button>
        </div>
      </div>

      {/* Connection Feedback Banner */}
      <AnimatePresence>
        {testResult && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ 
              marginTop: '16px', padding: '12px 16px', borderRadius: '16px', 
              background: testResult.valid ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', 
              border: `1px solid ${testResult.valid ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`, 
              fontSize: '13px', color: testResult.valid ? '#10b981' : '#ef4444', 
              display: 'flex', alignItems: 'center', gap: '10px',
              fontWeight: 600, boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
            }}>
              {testResult.valid ? <CheckCircle size={16} strokeWidth={3} /> : <XCircle size={16} strokeWidth={3} />}
              <span style={{ letterSpacing: '-0.01em' }}>{testResult.valid ? `System connection established — ${testResult.latencyMs}ms` : (typeof testResult.error === 'object' ? JSON.stringify(testResult.error) : testResult.error)}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* High-Fidelity Edit Interface */}
      <AnimatePresence>
        {expanded && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} 
            animate={{ opacity: 1, height: 'auto' }} 
            exit={{ opacity: 0, height: 0 }} 
            style={{ overflow: 'hidden' }}
          >
            <div style={{ 
              marginTop: '20px', paddingTop: '20px', 
              borderTop: '1px solid var(--border-color)', 
              display: 'flex', flexDirection: 'column', gap: '16px' 
            }}>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={fieldLabel}>Label</div>
                  <input type="text" value={editLabel} onChange={e => setEditLabel(e.target.value)} style={{ ...fieldInput, fontWeight: 700 }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={fieldLabel}>Model</div>
                  {isCustom
                    ? <input type="text" value={editModel} onChange={e => setEditModel(e.target.value)} style={{ ...fieldInput, fontFamily: '"Geist Mono", monospace' }} />
                    : info?.models?.length > 0 && (
                      <PremiumDropdown value={editModel} onChange={setEditModel} options={info.models.map(m => ({ value: m, label: MODEL_LABELS[m] || m }))} styleContext="form" />
                    )
                  }
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={fieldLabel}>Credential Update <span style={{ textTransform: 'none', fontWeight: 500, opacity: 0.6 }}>(Leave blank to keep current)</span></div>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showKey ? 'text' : 'password'} 
                    value={editKey} 
                    onChange={e => setEditKey(e.target.value)} 
                    placeholder="••••••••••••••••••••••••" 
                    style={{ ...fieldInput, paddingRight: '48px', fontFamily: '"Geist Mono", monospace' }} 
                  />
                  <button onClick={() => setShowKey(s => !s)} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', padding: '4px', transition: 'color 0.2s' }}>
                    {showKey ? <EyeOff size={16} strokeWidth={2.5} /> : <Eye size={16} strokeWidth={2.5} />}
                  </button>
                </div>
              </div>

              {isCustom && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={fieldLabel}>Proxy / Base URL</div>
                  <input type="text" value={editBaseUrl} onChange={e => setEditBaseUrl(e.target.value)} style={{ ...fieldInput, fontFamily: '"Geist Mono", monospace', opacity: 0.9 }} />
                </div>
              )}

              <AnimatePresence>{editErr && <ValidationError message={editErr} />}</AnimatePresence>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <motion.button 
                  whileHover={{ scale: 1.02, filter: 'brightness(1.05)' }} 
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSave} disabled={saving} 
                  style={{ 
                    flex: 2, padding: '12px', borderRadius: '14px', 
                    background: 'var(--text-primary)', color: 'var(--bg-primary)', 
                    border: 'none', fontSize: '13px', fontWeight: 800, 
                    cursor: saving ? 'default' : 'pointer', letterSpacing: '0.04em', 
                    textTransform: 'uppercase', transition: 'all 0.3s', 
                    opacity: saving ? 0.6 : 1, boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
                  }}
                >
                  {saving ? 'UPDATING…' : 'UPDATE CONFIG'}
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.02, background: 'var(--bg-tertiary)' }} 
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setExpanded(false); setEditErr(''); }} 
                  style={{ 
                    flex: 1, padding: '12px', borderRadius: '14px', 
                    background: 'transparent', border: '1px solid var(--border-color)', 
                    fontSize: '13px', cursor: 'pointer', color: 'var(--text-secondary)', 
                    fontWeight: 700, letterSpacing: '0.02em', textTransform: 'uppercase'
                  }}
                >
                  Cancel
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Advanced Usage Visualization */}
      {keyData.isActive && keyData.usage && (
        <div style={{ marginTop: '18px', paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '10px', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Activity size={12} strokeWidth={3} /> REAL-TIME THROUGHPUT
            </span>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 700, fontFamily: '"Geist Mono", monospace', display: 'flex', gap: '10px' }}>
              <span>{keyData.usage.requests} REQS</span>
              <span style={{ opacity: 0.3 }}>|</span>
              <span>${(keyData.usage.costCents / 100).toFixed(2)}</span>
            </span>
          </div>
          <div style={{ display: 'flex', gap: '4px', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(seg => {
              const intensity = Math.min(15, Math.ceil(keyData.usage.requests / 10));
              const isActive = seg <= intensity;
              return (
                <motion.div 
                  key={seg}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ delay: seg * 0.02, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                  style={{ 
                    flex: 1, height: '100%', 
                    background: isActive ? pc : 'var(--bg-tertiary)', 
                    borderRadius: '2px',
                    opacity: isActive ? (0.4 + (seg * 0.04)) : 0.1,
                    boxShadow: isActive ? `0 0 8px ${pc}44` : 'none',
                  }} 
                />
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default KeyCard;
