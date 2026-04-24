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
    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '20px', marginBottom: '24px', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 0, right: 0, padding: '5px 10px', background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', fontSize: '9px', fontWeight: 600, borderRadius: '0 16px 0 12px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>System</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6' }}><Sparkles size={18} /></div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 500 }}>TutorBoard Platform API</div>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Shared credits — no key needed</div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px' }}>
        <span style={{ color: 'var(--text-tertiary)' }}>Monthly usage</span>
        <span style={{ color: isExceeded ? '#ef4444' : isWarning ? '#f59e0b' : 'var(--text-primary)', fontWeight: 500 }}>{usage.requests} / {usage.limit} requests</span>
      </div>
      <div style={{ height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${usage.percent}%` }} transition={{ duration: 0.6 }} style={{ height: '100%', background: isExceeded ? '#ef4444' : isWarning ? '#f59e0b' : 'linear-gradient(90deg,#8b5cf6,#6366f1)', borderRadius: '3px' }} />
      </div>
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
    } catch {}
  };

  const handleUpdateCostControl = async (field, value) => {
    const updated = { ...preferences, costControl: { ...(preferences.costControl || {}), [field]: value } };
    setPreferences(updated);
    try {
      await fetch(`${API_URL}/api/apikeys/preferences`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(updated) });
    } catch {}
  };

  const handleDelete = async (keyId) => {
    try {
      const r = await fetch(`${API_URL}/api/apikeys/${keyId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (r.ok) { fetchDashboardData(); showToast?.('API key removed', 'info'); }
    } catch {}
  };

  const handleToggle = async (keyId, isActive) => {
    setApiKeys(prev => prev.map(k => k.id === keyId ? { ...k, isActive } : k));
    try {
      await fetch(`${API_URL}/api/apikeys/${keyId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ isActive }) });
      fetchDashboardData();
    } catch {}
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

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', paddingBottom: '160px' }}>

      {/* Status banner */}
      <div style={{ background: bannerBg, border: '1px solid var(--border-color)', borderRadius: '16px', padding: '14px 18px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: bannerDot, boxShadow: `0 0 0 3px ${bannerDot}30` }} />
          <div>
            <div style={{ fontSize: '13px', fontWeight: 500 }}>{bannerTitle}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{bannerSub}</div>
          </div>
        </div>
        {keyAddedNotActive && (
          <button onClick={() => handleUpdatePref('useCustomApi', true)} style={{ padding: '5px 14px', borderRadius: '10px', background: '#f59e0b', color: '#fff', border: 'none', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
            Activate
          </button>
        )}
      </div>

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

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', padding: '0 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '3px', height: '14px', borderRadius: '2px', background: 'var(--text-primary)', opacity: 0.8 }}></div>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.9 }}>Your API Keys</span>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowAddForm(s => !s)}
            style={{ 
              padding: '8px 18px', borderRadius: '14px', 
              background: showAddForm ? 'var(--bg-secondary)' : 'var(--text-primary)', 
              color: showAddForm ? 'var(--text-primary)' : 'var(--bg-primary)', 
              border: '1px solid var(--border-color)', 
              cursor: 'pointer', fontSize: '12px', fontWeight: 700,
              boxShadow: showAddForm ? 'none' : '0 4px 12px rgba(0,0,0,0.1)',
              display: 'flex', alignItems: 'center', gap: '6px',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            {showAddForm ? (
              <>
                <X size={14} strokeWidth={2.5} />
                <span>Cancel</span>
              </>
            ) : (
              <>
                <Plus size={14} strokeWidth={2.5} />
                <span>Add Key</span>
              </>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {apiKeys.length === 0 && !showAddForm && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{ 
                textAlign: 'center', padding: '48px 24px', 
                background: 'linear-gradient(135deg, var(--bg-secondary), var(--bg-tertiary))', 
                borderRadius: '24px', border: '1px solid var(--border-color)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.02)',
                marginTop: '12px'
              }}
            >
              <div style={{ 
                width: '64px', height: '64px', borderRadius: '20px', 
                background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 8px 16px rgba(0,0,0,0.05)',
                color: 'var(--text-tertiary)'
              }}>
                <Key size={28} strokeWidth={1.5} />
              </div>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>No active keys</div>
                <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', maxWidth: '240px', lineHeight: 1.5 }}>
                  Add your provider keys to unlock independent, high-performance AI models.
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowAddForm(true)}
                style={{ 
                  marginTop: '8px', padding: '10px 24px', borderRadius: '12px', 
                  background: 'var(--text-primary)', color: 'var(--bg-primary)', 
                  border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}
              >
                Add your first key
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
      <div style={{ marginTop: '40px' }}>
        <SectionTitle>Cost Control</SectionTitle>
        <SettingsGroup>
          <SettingsRow icon={DollarSign} label="Monthly Limit ($)" rightElement={
            <input type="number" value={preferences.costControl?.monthlyLimitCents || 0} onChange={e => handleUpdateCostControl('monthlyLimitCents', parseInt(e.target.value))}
              style={{ width: '72px', padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '13px', textAlign: 'right' }} />
          } />
          <SettingsRow icon={Shield} label="Hard Stop at Limit" borderBottom={false} rightElement={<AppleToggle value={preferences.costControl?.hardStop !== false} onChange={v => handleUpdateCostControl('hardStop', v)} />} />
        </SettingsGroup>
      </div>

      {/* Analytics */}
      {usageStats && (
        <div style={{ marginTop: '40px' }}>
          <SectionTitle>Analytics (30 days)</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
            {[
              { label: 'Requests', value: usageStats.totalRequests || 0, icon: Zap },
              { label: 'Tokens',   value: usageStats.totalTokens   || 0, icon: Brain },
              { label: 'Latency',  value: `${Math.round(usageStats.avgResponseTime || 0)}ms`, icon: Gauge },
              { label: 'Cost',     value: `$${((usageStats.totalCost || 0) / 100).toFixed(2)}`, icon: DollarSign },
            ].map((s, i) => (
              <div key={i} style={{ background: 'var(--bg-secondary)', padding: '18px 10px', borderRadius: '16px', textAlign: 'center', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <s.icon size={15} style={{ color: 'var(--text-tertiary)' }} />
                <div style={{ fontSize: '18px', fontWeight: 600 }}>{s.value}</div>
                <div style={{ fontSize: '9px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sync Error Banner */}
      {error && (
        <div style={{ marginTop: '20px', padding: '12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontSize: '12px' }}>
          <AlertCircle size={14} />
          <span>{error}</span>
          <button onClick={fetchDashboardData} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ef4444', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>Retry</button>
        </div>
      )}
    </div>
  );
}
