import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Brain, Key, Shield, GitBranch,
  Activity, Globe2, Sparkles, Gauge, DollarSign,
  AlertCircle, Plus, X
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import {
  SectionTitle, SettingsGroup, SettingsRow,
  AppleToggle, RightInlineSelect, API_URL
} from '../SettingsShared';
import { MODEL_LABELS } from './ProviderRegistry';
import UnifiedAPIForm from './UnifiedAPIForm';
import KeyCard from './KeyCard';

// ─── Universal usage bar ──────────────────────────────────────────────────────

const UniversalUsageCard = ({ usage }) => {
  if (!usage) return null;
  const isWarning = usage.percent >= 80;
  const isExceeded = usage.percent >= 100;
  
  return (
    <div style={{ 
      background: 'var(--bg-secondary)', 
      border: '1px solid var(--border-color)', 
      borderRadius: '18px', 
      padding: '16px', 
      marginBottom: '24px', 
      position: 'relative', 
      overflow: 'hidden',
      boxShadow: '0 8px 24px rgba(0,0,0,0.02)'
    }}>
      <div style={{ 
        position: 'absolute', top: 0, right: 0, padding: '6px 12px', 
        background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', 
        fontSize: '9px', fontWeight: 800, borderRadius: '0 18px 0 16px', 
        letterSpacing: '0.08em', textTransform: 'uppercase' 
      }}>System Quota</div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <div style={{ 
          width: '36px', height: '36px', borderRadius: '10px', 
          background: 'rgba(139,92,246,0.08)', display: 'flex', alignItems: 'center', 
          justifyContent: 'center', color: '#8b5cf6', boxShadow: '0 4px 12px rgba(139,92,246,0.08)' 
        }}>
          <Sparkles size={20} strokeWidth={2.5} />
        </div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 800, letterSpacing: '-0.02em' }}>TutorBoard Edge Engine</div>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 500, opacity: 0.8 }}>Shared credits — automatically optimized</div>
        </div>
      </div>

      {/* Main progress bar */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '10px', fontWeight: 700 }}>
          <span style={{ color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Monthly Capacity</span>
          <span style={{ color: isExceeded ? '#ef4444' : isWarning ? '#f59e0b' : 'var(--text-primary)' }}>{usage.requests} / {usage.limit}</span>
        </div>
        <div style={{ height: '10px', background: 'var(--bg-tertiary)', borderRadius: '5px', overflow: 'hidden', padding: '1.5px', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)' }}>
          <motion.div 
            initial={{ width: 0 }} 
            animate={{ width: `${usage.percent}%` }} 
            transition={{ duration: 1.2, ease: [0.34, 1.56, 0.64, 1] }} 
            style={{ 
              height: '100%', 
              background: isExceeded ? '#ef4444' : isWarning ? '#f59e0b' : 'linear-gradient(90deg, #8b5cf6, #d946ef)', 
              borderRadius: '4px',
              boxShadow: '0 0 16px rgba(139,92,246,0.4)'
            }} 
          />
        </div>
      </div>

      {/* Breakdown per model if available */}
      {usage.breakdown && usage.breakdown.length > 0 && (
        <div style={{ 
          display: 'flex', flexDirection: 'column', gap: '20px', 
          paddingTop: '24px', borderTop: '1px solid var(--border-color)', 
          opacity: 0.95 
        }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '4px' }}>Model Allocation</div>
          {usage.breakdown.map((m, i) => {
            const mLabel = MODEL_LABELS[m.model] || m.model;
            const mWarning = m.percent >= 80;
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{mLabel}</span>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '11px', fontWeight: 700, fontFamily: '"Geist Mono", monospace' }}>{m.requests} / {m.limit}</span>
                </div>
                <div style={{ display: 'flex', gap: '4px', height: '6px' }}>
                  {[1, 2, 3, 4, 5].map(seg => {
                    const threshold = seg * 20;
                    const isActive = m.percent >= threshold;
                    return (
                      <div 
                        key={seg} 
                        style={{ 
                          flex: 1, 
                          height: '100%', 
                          background: isActive 
                            ? (mWarning ? '#f59e0b' : '#8b5cf6') 
                            : 'var(--bg-tertiary)', 
                          borderRadius: '3px',
                          opacity: isActive ? 1 : 0.25,
                          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                          boxShadow: isActive ? `0 2px 6px ${mWarning ? '#f59e0b' : '#8b5cf6'}33` : 'none'
                        }} 
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function APIConfigSection({ showToast }) {
  const { token } = useAuth();
  const [apiKeys, setApiKeys]             = useState([]);
  const [preferences, setPreferences]     = useState({ useCustomApi: false, smartRouting: false, enableRacing: false, enableAdaptive: false, routingMode: 'auto', modelOverride: '', costControl: { monthlyLimitCents: 0, warningThresholdPct: 80, hardStop: true } });
  const [usageStats, setUsageStats]       = useState(null);
  const [universalUsage, setUniversalUsage] = useState(null);
  const [showAddForm, setShowAddForm]     = useState(false);
  const [testingKeyId, setTestingKeyId]   = useState(null);
  const [testResults, setTestResults]     = useState({});
  const [error, setError]                 = useState(null);

  useEffect(() => { if (token) fetchDashboardData(); }, [token]);

  const fetchDashboardData = async () => {
    try {
      const res = await fetch(`${API_URL}/api/apikeys/dashboard`, { headers: { 'Authorization': `Bearer ${token}` } });
      const d = await res.json();
      
      if (res.ok) {
        setApiKeys(d.keys || []);
        setPreferences(d.preferences || {});
        setUsageStats(d.usage || null);
        if (d.universal) setUniversalUsage(d.universal);
        setError(null);
      } else {
        setError(d.details || d.error || 'Failed to sync');
      }
    } catch (err) {
      console.error(err);
      setError('Connection failed');
    }
  };

  const handleUpdatePref = async (key, value) => {
    const updated = { ...preferences, [key]: value };
    setPreferences(updated);
    try {
      await fetch(`${API_URL}/api/apikeys/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(updated),
      });
      fetchDashboardData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateCostControl = async (field, value) => {
    const updated = { ...preferences, costControl: { ...(preferences.costControl || {}), [field]: value } };
    setPreferences(updated);
    try {
      await fetch(`${API_URL}/api/apikeys/preferences`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(updated) });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (keyId) => {
    try {
      const r = await fetch(`${API_URL}/api/apikeys/${keyId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (r.ok) { fetchDashboardData(); showToast?.('API key removed', 'info'); }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggle = async (keyId, isActive) => {
    setApiKeys(prev => prev.map(k => k.id === keyId ? { ...k, isActive } : k));
    try {
      await fetch(`${API_URL}/api/apikeys/${keyId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ isActive }) });
      fetchDashboardData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleTest = async (keyId) => {
    setTestingKeyId(keyId);
    setTestResults(prev => ({ ...prev, [keyId]: null }));
    try {
      const res = await fetch(`${API_URL}/api/apikeys/${keyId}/test`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      setTestResults(prev => ({ ...prev, [keyId]: data }));
      if (data.valid) showToast?.(`Connection OK (${data.latencyMs}ms)`, 'success');
      else showToast?.(data.error || 'Validation failed', 'error');
      fetchDashboardData();
    } catch {
      setTestResults(prev => ({ ...prev, [keyId]: { valid: false, error: 'Network error' } }));
    } finally {
      setTestingKeyId(null);
    }
  };

  const hasActiveKey      = apiKeys.some(k => k.isActive && k.isValid);
  const hasActiveCustom   = preferences.useCustomApi && hasActiveKey;
  const keyAddedNotActive = hasActiveKey && !preferences.useCustomApi;

  // ─── Status banner colour ─────────────────────────────────────────────────
  const bannerBg    = hasActiveCustom ? 'rgba(16,185,129,0.08)' : keyAddedNotActive ? 'rgba(245,158,11,0.08)' : 'rgba(59,130,246,0.06)';
  const bannerDot   = hasActiveCustom ? '#10b981' : keyAddedNotActive ? '#f59e0b' : '#3b82f6';
  const bannerTitle = hasActiveCustom ? 'Custom API Mode — Active' : keyAddedNotActive ? 'Key Added — Enable Toggle Below' : 'TutorBoard Platform API';
  const bannerSub   = hasActiveCustom ? 'All requests use your API key exclusively' : keyAddedNotActive ? 'Turn on "Use Custom API" to activate your key' : 'Shared platform credits — add your own key for full independence';

  // Analytics accent colors
  const statColors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b'];

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', paddingBottom: '160px' }}>

      {/* Status banner — elevated with gradient accent */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        style={{ 
          background: bannerBg, 
          border: '1px solid var(--border-color)', 
          borderRadius: '16px', 
          padding: '14px 18px', 
          marginBottom: '24px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          position: 'relative', 
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
        }}
      >
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '4px', background: `linear-gradient(90deg, ${bannerDot}, ${bannerDot}50, transparent)` }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ position: 'relative' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: bannerDot, boxShadow: `0 0 10px ${bannerDot}66` }} />
            <div style={{ position: 'absolute', inset: '-4px', borderRadius: '50%', border: `2.5px solid ${bannerDot}30`, animation: hasActiveCustom ? 'pulse-ring 2s infinite' : 'none' }} />
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>{bannerTitle}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px', lineHeight: 1.4, fontWeight: 500 }}>{bannerSub}</div>
          </div>
        </div>
        {keyAddedNotActive && (
          <motion.button 
            whileHover={{ scale: 1.05, filter: 'brightness(1.1)' }} 
            whileTap={{ scale: 0.95 }} 
            onClick={() => handleUpdatePref('useCustomApi', true)} 
            style={{ 
              padding: '8px 18px', borderRadius: '12px', background: '#f59e0b', color: '#fff', 
              border: 'none', fontSize: '12px', fontWeight: 800, cursor: 'pointer', 
              boxShadow: '0 4px 12px rgba(245,158,11,0.4)', letterSpacing: '0.02em' 
            }}
          >
            ACTIVATE
          </motion.button>
        )}
      </motion.div>

      {/* API Configuration toggles */}
      <SectionTitle>API Configuration</SectionTitle>
      <SettingsGroup>
        <SettingsRow icon={Key}       label="Use Custom API"    rightElement={<AppleToggle value={preferences.useCustomApi}    onChange={v => handleUpdatePref('useCustomApi', v)} />} />
        <SettingsRow icon={Brain}     label="Smart Routing"     rightElement={<AppleToggle value={preferences.smartRouting}    onChange={v => handleUpdatePref('smartRouting', v)} />} />
        <SettingsRow icon={GitBranch} label="Adaptive Learning" rightElement={<AppleToggle value={preferences.enableAdaptive}  onChange={v => handleUpdatePref('enableAdaptive', v)} />} />
        <SettingsRow icon={Activity}  label="Parallel Racing"   rightElement={<AppleToggle value={preferences.enableRacing}    onChange={v => handleUpdatePref('enableRacing', v)} />} />
        <SettingsRow icon={Globe2}    label="Routing Mode" borderBottom={false} rightElement={<RightInlineSelect value={preferences.routingMode || 'auto'} onChange={v => handleUpdatePref('routingMode', v)} options={[{ value: 'auto', label: 'Auto' }, { value: 'manual', label: 'Manual' }]} />} />
      </SettingsGroup>

      {preferences.routingMode === 'manual' && apiKeys.length > 0 && (
        <SettingsGroup>
          <SettingsRow icon={Brain} label="Model Override" borderBottom={false} rightElement={<RightInlineSelect value={preferences.modelOverride || ''} onChange={v => handleUpdatePref('modelOverride', v)} options={[{ value: '', label: 'None' }, ...Array.from(new Set(apiKeys.map(k => k.model))).map(m => ({ value: m, label: MODEL_LABELS[m] || m }))]} />} />
        </SettingsGroup>
      )}

      {/* API Keys section */}
      <div style={{ marginTop: '40px' }}>
        {!preferences.useCustomApi && universalUsage && <UniversalUsageCard usage={universalUsage} />}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', padding: '0 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '4px', height: '18px', borderRadius: '4px', background: 'var(--accent-primary)' }} />
            <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Identity Credentials</span>
            {apiKeys.length > 0 && (
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-tertiary)', background: 'var(--bg-tertiary)', padding: '3px 10px', borderRadius: '10px', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)' }}>{apiKeys.length}</span>
            )}
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowAddForm(s => !s)}
            style={{ 
              padding: '10px 24px', borderRadius: '16px', 
              background: showAddForm ? 'var(--bg-secondary)' : 'var(--text-primary)', 
              color: showAddForm ? 'var(--text-primary)' : 'var(--bg-primary)', 
              border: '1px solid var(--border-color)', 
              cursor: 'pointer', fontSize: '12px', fontWeight: 800,
              boxShadow: showAddForm ? 'none' : '0 8px 20px rgba(0,0,0,0.15)',
              display: 'flex', alignItems: 'center', gap: '8px',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              letterSpacing: '0.02em',
            }}
          >
            {showAddForm ? (
              <><X size={16} strokeWidth={3} /><span>CANCEL</span></>
            ) : (
              <><Plus size={16} strokeWidth={3} /><span>ADD KEY</span></>
            )}
          </motion.button>
        </div>

        <AnimatePresence>
          {showAddForm && (
            <UnifiedAPIForm
              token={token}
              onSave={() => { setShowAddForm(false); fetchDashboardData(); }}
              onCancel={() => setShowAddForm(false)}
              showToast={showToast}
            />
          )}
        </AnimatePresence>

        {/* Key list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {apiKeys.length === 0 && !showAddForm && (
            <motion.div 
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
              style={{ 
                textAlign: 'center', padding: '64px 32px', 
                background: 'var(--bg-secondary)',
                borderRadius: '32px', border: '1px solid var(--border-color)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px',
                position: 'relative', overflow: 'hidden',
                marginTop: '8px',
                boxShadow: '0 12px 40px rgba(0,0,0,0.03)'
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '240px', height: '140px', background: 'radial-gradient(ellipse, var(--bg-tertiary), transparent)', pointerEvents: 'none', opacity: 0.5 }} />
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                style={{ 
                  width: '76px', height: '76px', borderRadius: '24px', 
                  background: 'linear-gradient(135deg, var(--bg-primary), var(--bg-tertiary))', border: '1px solid var(--border-color)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 12px 32px rgba(0,0,0,0.08)',
                  color: 'var(--text-tertiary)', position: 'relative', zIndex: 1,
                }}
              >
                <Key size={32} strokeWidth={1.5} />
              </motion.div>
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.02em' }}>No API credentials</div>
                <div style={{ fontSize: '14px', color: 'var(--text-tertiary)', maxWidth: '280px', lineHeight: 1.6, fontWeight: 500 }}>
                  Add your provider keys to unlock independent, ultra-high-performance AI models.
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowAddForm(true)}
                style={{ 
                  marginTop: '8px', padding: '12px 32px', borderRadius: '16px', 
                  background: 'var(--text-primary)', color: 'var(--bg-primary)', 
                  border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 800,
                  boxShadow: '0 10px 25px rgba(0,0,0,0.2)', letterSpacing: '0.02em',
                  position: 'relative', zIndex: 1,
                }}
              >
                Connect First Key
              </motion.button>
            </motion.div>
          )}
          {apiKeys.map(key => (
            <KeyCard
              key={key.id}
              keyData={key}
              onDelete={handleDelete}
              onToggle={handleToggle}
              onTest={handleTest}
              onUpdated={fetchDashboardData}
              showToast={showToast}
              testResult={testResults[key.id]}
              isTesting={testingKeyId === key.id}
            />
          ))}
        </div>
      </div>

      {/* Cost control */}
      <div style={{ marginTop: '48px' }}>
        <SectionTitle>Global Guardrails</SectionTitle>
        <SettingsGroup>
          <SettingsRow icon={DollarSign} label="Monthly Limit ($)" rightElement={
            <input type="number" value={preferences.costControl?.monthlyLimitCents || 0} onChange={e => handleUpdateCostControl('monthlyLimitCents', parseInt(e.target.value))}
              style={{ width: '90px', padding: '8px 12px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '14px', textAlign: 'right', fontWeight: 800, fontFamily: '"Geist Mono", monospace', outline: 'none', transition: 'all 0.2s', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)' }} 
              onFocus={e => (e.target.style.borderColor = 'var(--accent-primary)', e.target.style.background = 'var(--bg-secondary)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border-color)', e.target.style.background = 'var(--bg-tertiary)')}
            />
          } />
          <SettingsRow icon={Shield} label="Hard Stop Protection" borderBottom={false} rightElement={<AppleToggle value={preferences.costControl?.hardStop !== false} onChange={v => handleUpdateCostControl('hardStop', v)} />} />
        </SettingsGroup>
      </div>

      {/* Analytics */}
      {usageStats && (
        <div style={{ marginTop: '48px' }}>
          <SectionTitle>Performance Analytics</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '14px' }}>
            {[
              { label: 'Requests', value: usageStats.totalRequests || 0, icon: Zap },
              { label: 'Tokens',   value: usageStats.totalTokens   || 0, icon: Brain },
              { label: 'Latency',  value: `${Math.round(usageStats.avgResponseTime || 0)}ms`, icon: Gauge },
              { label: 'Total Cost', value: `$${((usageStats.totalCost || 0) / 100).toFixed(2)}`, icon: DollarSign },
            ].map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                whileHover={{ y: -4, boxShadow: `0 12px 32px ${statColors[i]}22`, background: 'var(--bg-tertiary)33' }}
                style={{ 
                  background: 'var(--bg-secondary)', padding: '16px 12px', borderRadius: '18px', 
                  textAlign: 'center', border: '1px solid var(--border-color)', 
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', 
                  cursor: 'default', transition: 'all 0.3s', position: 'relative', overflow: 'hidden',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
                }}
              >
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '3px', background: `linear-gradient(90deg, ${statColors[i]}, transparent)` }} />
                <div style={{ 
                  width: '32px', height: '32px', borderRadius: '10px', 
                  background: `${statColors[i]}15`, display: 'flex', alignItems: 'center', 
                  justifyContent: 'center', color: statColors[i],
                  boxShadow: `0 4px 10px ${statColors[i]}22`
                }}>
                  <s.icon size={16} strokeWidth={2.5} />
                </div>
                <div style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.03em', fontFamily: '"Geist Mono", monospace', color: 'var(--text-primary)' }}>{s.value}</div>
                <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.7 }}>{s.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Sync Error Banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            style={{ 
              marginTop: '28px', padding: '16px 20px', 
              background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', 
              borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '12px', 
              color: '#ef4444', fontSize: '13px', overflow: 'hidden',
              boxShadow: '0 8px 24px rgba(239,68,68,0.1)'
            }}
          >
            <AlertCircle size={18} strokeWidth={2.5} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, lineHeight: 1.5, fontWeight: 500 }}>{error}</span>
            <motion.button 
              whileHover={{ scale: 1.05, background: 'rgba(239,68,68,0.15)' }} 
              whileTap={{ scale: 0.95 }} 
              onClick={fetchDashboardData} 
              style={{ 
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', 
                color: '#ef4444', fontWeight: 800, cursor: 'pointer', 
                padding: '7px 18px', borderRadius: '12px', fontSize: '12px',
                letterSpacing: '0.02em'
              }}
            >
              RETRY
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`@keyframes pulse-ring { 0% { opacity: 0.4; transform: scale(1); } 50% { opacity: 0; transform: scale(1.8); } 100% { opacity: 0; transform: scale(1.8); } }`}</style>
    </div>
  );
}
