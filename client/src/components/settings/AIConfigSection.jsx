import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, Brain, Key, Shield, GitBranch, 
  Activity, Globe2, X, ExternalLink, Eye, 
  Trash2, Sparkles, AlertTriangle, Gauge, DollarSign 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { 
  SectionTitle, SettingsGroup, SettingsRow, 
  AppleToggle, RightInlineSelect, PremiumDropdown,
  API_URL, PROVIDER_INFO, MODEL_LABELS 
} from './SettingsShared';

const UniversalUsageCard = ({ usage }) => {
  if (!usage) return null;
  const isWarning = usage.percent >= 80;
  const isExceeded = usage.percent >= 100;
  return (
    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '20px', marginBottom: '24px', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 0, right: 0, padding: '6px 12px', background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', fontSize: '10px', fontWeight: 700, borderRadius: '0 0 0 12px' }}>SYSTEM PROVIDED</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6' }}><Sparkles size={20} /></div>
        <div>
          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>TutorBoard Universal API</h4>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-tertiary)' }}>Platform credits for common tasks</p>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600 }}>
          <span>Monthly Usage</span>
          <span style={{ color: isExceeded ? '#ef4444' : isWarning ? '#f59e0b' : 'var(--text-primary)' }}>{usage.requests} / {usage.limit} requests</span>
        </div>
        <div style={{ height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
          <motion.div initial={{ width: 0 }} animate={{ width: `${usage.percent}%` }} style={{ height: '100%', background: isExceeded ? '#ef4444' : isWarning ? 'linear-gradient(90deg, #8b5cf6, #f59e0b)' : 'linear-gradient(90deg, #8b5cf6, #6366f1)' }} />
        </div>
      </div>
    </div>
  );
};

export default function AIConfigSection({ showToast }) {
  const { token } = useAuth();
  const [apiKeys, setApiKeys] = useState([]);
  const [preferences, setPreferences] = useState({
    useCustomApi: false, fallbackToDefault: true, smartRouting: false,
    enableRacing: false, enableAdaptive: false, routingMode: 'auto',
    modelOverride: '', costControl: { monthlyLimitCents: 0, warningThresholdPct: 80, hardStop: true },
  });
  const [usageStats, setUsageStats] = useState(null);
  const [healthData, setHealthData] = useState(null);
  const [costStatus, setCostStatus] = useState(null);
  const [universalUsage, setUniversalUsage] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProvider, setNewProvider] = useState('openai');
  const [newApiKey, setNewApiKey] = useState('');
  const [newModel, setNewModel] = useState('gpt-4o');
  const [newBaseUrl, setNewBaseUrl] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [testingKeyId, setTestingKeyId] = useState(null);
  const [testResults, setTestResults] = useState({});

  useEffect(() => { if (token) fetchDashboardData(); }, [token]);
  useEffect(() => { if (!token) return; const interval = setInterval(fetchDashboardData, 30000); return () => clearInterval(interval); }, [token]);
  useEffect(() => { const models = PROVIDER_INFO[newProvider]?.models || []; setNewModel(models[0] || ''); }, [newProvider]);

  const fetchDashboardData = async () => {
    try {
      const res = await fetch(`${API_URL}/api/apikeys/dashboard`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const d = await res.json();
        setApiKeys(d.keys || []);
        setPreferences(d.preferences || {});
        setUsageStats(d.usage || null);
        setHealthData(d.health || null);
        setCostStatus(d.cost || null);
        if (d.universal) setUniversalUsage(d.universal);
      }
    } catch (e) {}
  };

  const handleUpdateCostControl = async (field, value) => {
    const updated = { ...preferences, costControl: { ...(preferences.costControl || {}), [field]: value } };
    setPreferences(updated);
    try { await fetch(`${API_URL}/api/apikeys/preferences`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(updated) }); fetchDashboardData(); } catch (e) {}
  };

  const handleAddKey = async () => {
    if (!newApiKey.trim()) return;
    setIsValidating(true); setValidationResult(null);
    try {
      const res = await fetch(`${API_URL}/api/apikeys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ 
          provider: newProvider, apiKey: newApiKey.trim(), 
          model: newModel, label: newLabel.trim() || `${PROVIDER_INFO[newProvider]?.name} Key`, 
          baseUrl: newProvider === 'custom' ? newBaseUrl : undefined 
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setValidationResult({ success: true, message: data.message });
        setNewApiKey(''); setShowAddForm(false); fetchDashboardData();
        showToast?.('API key added successfully!', 'success');
      } else { setValidationResult({ success: false, message: data.details || data.error }); }
    } catch (e) { setValidationResult({ success: false, message: 'Network error' }); }
    finally { setIsValidating(false); }
  };

  const handleDeleteKey = async (keyId) => {
    try {
      const r = await fetch(`${API_URL}/api/apikeys/${keyId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (r.ok) { fetchDashboardData(); showToast?.('API key removed', 'info'); }
    } catch (e) {}
  };

  const handleToggleKey = async (keyId, isActive) => {
    try { 
      if (isActive) { setApiKeys(prev => prev.map(k => ({ ...k, isActive: k.id === keyId }))); }
      else { setApiKeys(prev => prev.map(k => k.id === keyId ? { ...k, isActive: false } : k)); }
      await fetch(`${API_URL}/api/apikeys/${keyId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ isActive }) }); 
      fetchDashboardData(); 
    } catch (e) {}
  };

  const handleUpdatePref = async (key, value) => {
    const updated = { ...preferences, [key]: value };
    setPreferences(updated);
    try { await fetch(`${API_URL}/api/apikeys/preferences`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(updated) }); } catch (e) {}
  };

  const handleTestKey = async (keyId) => {
    setTestingKeyId(keyId); setTestResults(prev => ({ ...prev, [keyId]: null }));
    try {
      const res = await fetch(`${API_URL}/api/apikeys/${keyId}/test`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      setTestResults(prev => ({ ...prev, [keyId]: data }));
      if (data.valid) showToast?.(`Connection OK (${data.latencyMs}ms)`, 'success');
      else showToast?.(data.error || 'Validation failed', 'error');
      fetchDashboardData();
    } catch (e) { setTestResults(prev => ({ ...prev, [keyId]: { valid: false, error: 'Network error' } })); showToast?.('Network error', 'error'); }
    finally { setTestingKeyId(null); }
  };

  const hasActiveCustomKey = preferences.useCustomApi && apiKeys.some(k => k.isActive && k.isValid);

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      <div style={{ background: hasActiveCustomKey ? 'rgba(16,185,129,0.08)' : 'rgba(59,130,246,0.08)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '16px 20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: hasActiveCustomKey ? '#10b981' : '#3b82f6' }} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700 }}>{hasActiveCustomKey ? 'Your Personal API' : 'TutorBoard Platform API'}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{hasActiveCustomKey ? 'Using your keys' : 'Shared platform credits'}</div>
            </div>
          </div>
        </div>
      </div>

      <SectionTitle>API Configuration</SectionTitle>
      <SettingsGroup>
        <SettingsRow icon={Key} label="Use Custom API" rightElement={<AppleToggle value={preferences.useCustomApi} onChange={v => handleUpdatePref('useCustomApi', v)} />} />
        <SettingsRow icon={Shield} label="Auto-Fallback" rightElement={<AppleToggle value={preferences.fallbackToDefault} onChange={v => handleUpdatePref('fallbackToDefault', v)} />} />
        <SettingsRow icon={Brain} label="Smart Routing" rightElement={<AppleToggle value={preferences.smartRouting} onChange={v => handleUpdatePref('smartRouting', v)} />} />
        <SettingsRow icon={GitBranch} label="Adaptive Learning" rightElement={<AppleToggle value={preferences.enableAdaptive} onChange={v => handleUpdatePref('enableAdaptive', v)} />} />
        <SettingsRow icon={Activity} label="Parallel Racing" rightElement={<AppleToggle value={preferences.enableRacing} onChange={v => handleUpdatePref('enableRacing', v)} />} />
        <SettingsRow icon={Globe2} label="Routing Mode" borderBottom={false} rightElement={<RightInlineSelect value={preferences.routingMode || 'auto'} onChange={v => handleUpdatePref('routingMode', v)} options={[{ value: 'auto', label: 'Auto' }, { value: 'manual', label: 'Manual' }]} />} />
      </SettingsGroup>

      {preferences.routingMode === 'manual' && apiKeys.length > 0 && (
        <SettingsGroup>
          <SettingsRow icon={Brain} label="Model Override" borderBottom={false} rightElement={<RightInlineSelect value={preferences.modelOverride || ''} onChange={v => handleUpdatePref('modelOverride', v)} options={[{ value: '', label: 'None' }, ...Array.from(new Set(apiKeys.map(k => k.model))).map(m => ({ value: m, label: MODEL_LABELS[m] || m }))]} />} />
        </SettingsGroup>
      )}

      <div style={{ marginTop: '20px' }}>
        {!preferences.useCustomApi && universalUsage && <UniversalUsageCard usage={universalUsage} />}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Your API Keys</span>
          <button onClick={() => setShowAddForm(!showAddForm)} style={{ padding: '4px 12px', borderRadius: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', cursor: 'pointer' }}>{showAddForm ? 'Cancel' : 'Add Key'}</button>
        </div>

        <AnimatePresence>
          {showAddForm && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ marginBottom: '16px' }}>
              <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                  {Object.entries(PROVIDER_INFO).map(([id, info]) => (
                    <button key={id} onClick={() => setNewProvider(id)} style={{ padding: '10px 4px', borderRadius: '12px', border: '1px solid', borderColor: newProvider === id ? info.color : 'var(--border-color)', background: newProvider === id ? `${info.color}15` : 'transparent', cursor: 'pointer' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: info.color, margin: '0 auto 4px' }} />
                      <span style={{ fontSize: '8px', fontWeight: 700 }}>{id}</span>
                    </button>
                  ))}
                </div>
                <div style={{ position: 'relative' }}>
                  <input type={showKey ? 'text' : 'password'} value={newApiKey} onChange={e => setNewApiKey(e.target.value)} placeholder="Enter API key" style={{ width: '100%', padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }} />
                  <button onClick={() => setShowKey(!showKey)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer' }}><Eye size={14} /></button>
                </div>
                <input type="text" value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Key Label" style={{ width: '100%', padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }} />
                {newProvider === 'custom' && <input type="text" value={newBaseUrl} onChange={e => setNewBaseUrl(e.target.value)} placeholder="Base URL" style={{ width: '100%', padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }} />}
                {PROVIDER_INFO[newProvider]?.models.length > 0 && <PremiumDropdown value={newModel} onChange={setNewModel} options={PROVIDER_INFO[newProvider].models.map(m => ({ value: m, label: MODEL_LABELS[m] || m }))} styleContext="form" />}
                <button onClick={handleAddKey} disabled={isValidating} style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'var(--text-primary)', color: 'var(--bg-primary)', border: 'none', fontWeight: 700, cursor: 'pointer' }}>{isValidating ? 'Validating...' : 'Validate & Save'}</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {apiKeys.map(key => {
            const pc = PROVIDER_INFO[key.provider]?.color || '#888';
            const testResult = testResults[key.id];
            return (
              <div key={key.id} style={{ background: key.isActive ? 'var(--bg-tertiary)' : 'var(--bg-primary)', border: '1px solid var(--border-color)', borderLeft: `3px solid ${pc}`, borderRadius: '16px', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 800 }}>{key.label || key.provider}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{key.maskedKey}</div>
                  </div>
                  <button onClick={() => handleTestKey(key.id)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><Zap size={13} /></button>
                  <AppleToggle value={key.isActive} onChange={v => handleToggleKey(key.id, v)} />
                  <button onClick={() => handleDeleteKey(key.id)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={13} /></button>
                </div>
                {testResult && <div style={{ marginTop: '8px', fontSize: '11px', color: testResult.valid ? '#10b981' : '#ef4444' }}>{testResult.valid ? `Connected (${testResult.latencyMs}ms)` : testResult.error}</div>}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: '24px' }}>
        <SectionTitle>Cost Control</SectionTitle>
        <SettingsGroup>
          <SettingsRow icon={DollarSign} label="Monthly Limit ($)" rightElement={<input type="number" value={preferences.costControl?.monthlyLimitCents || 0} onChange={e => handleUpdateCostControl('monthlyLimitCents', parseInt(e.target.value))} style={{ width: '80px' }} />} />
          <SettingsRow icon={Shield} label="Hard Stop" borderBottom={false} rightElement={<AppleToggle value={preferences.costControl?.hardStop !== false} onChange={v => handleUpdateCostControl('hardStop', v)} />} />
        </SettingsGroup>
      </div>

      {usageStats && (
        <div style={{ marginTop: '24px' }}>
          <SectionTitle>Analytics</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            {[{ label: 'Requests', value: usageStats.totals?.totalRequests, icon: Zap }, { label: 'Tokens', value: usageStats.totals?.totalTokens, icon: Brain }, { label: 'Latency', value: `${Math.round(usageStats.totals?.avgResponseTime || 0)}ms`, icon: Gauge }, { label: 'Cost', value: `$${((usageStats.totals?.totalCost || 0) / 100).toFixed(2)}`, icon: DollarSign }].map((s, i) => (
              <div key={i} style={{ background: 'var(--bg-tertiary)', padding: '12px 6px', borderRadius: '16px', textAlign: 'center' }}>
                <s.icon size={14} style={{ marginBottom: '4px' }} />
                <div style={{ fontSize: '16px', fontWeight: 700 }}>{s.value}</div>
                <div style={{ fontSize: '8px', textTransform: 'uppercase' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
