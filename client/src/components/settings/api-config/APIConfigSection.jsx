import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Brain, Key, Shield, GitBranch,
  Activity, Globe2, Sparkles, Gauge, DollarSign,
  AlertCircle, Plus, X, Globe, ExternalLink
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import {
  SectionTitle, SettingsGroup, SettingsRow,
  AppleToggle, RightInlineSelect
} from '../SettingsShared';
import API, { BASE_URL as API_URL } from '../../../services/api';
import { MODEL_LABELS, PROVIDERS } from './ProviderRegistry';
import UnifiedAPIForm from './UnifiedAPIForm';
import KeyCard from './KeyCard';

// ─── Shared Components ────────────────────────────────────────────────────────

const ProviderDot = ({ color }) => (
  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />
);

// ─── Usage Card ───────────────────────────────────────────────────────────────

const UsageCard = ({ usage }) => {
  if (!usage) return null;
  const isWarning = usage.percent >= 80;
  const isExceeded = usage.percent >= 100;

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: '12px',
      padding: '14px',
      marginBottom: '16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <Sparkles size={13} strokeWidth={2} style={{ color: '#8b5cf6', opacity: 0.7 }} />
        <div>
          <div style={{ fontSize: '12px', fontWeight: 500, letterSpacing: '-0.01em' }}>Platform Credits</div>
          <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 400 }}>Shared quota, auto-managed</div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '4px', fontWeight: 400 }}>
          <span style={{ color: 'var(--text-tertiary)' }}>Monthly usage</span>
          <span style={{ color: isExceeded ? '#ef4444' : isWarning ? '#f59e0b' : 'var(--text-secondary)', fontFamily: '"Geist Mono", monospace', fontWeight: 500 }}>
            {usage.requests} / {usage.limit}
          </span>
        </div>
        <div style={{ height: '4px', background: 'var(--bg-tertiary)', borderRadius: '2px', overflow: 'hidden' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, usage.percent)}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            style={{
              height: '100%',
              background: isExceeded ? '#ef4444' : isWarning ? '#f59e0b' : '#8b5cf6',
              borderRadius: '2px',
            }}
          />
        </div>
      </div>

      {/* Model breakdown */}
      {usage.breakdown && usage.breakdown.length > 0 && (
        <div style={{
          paddingTop: '10px', marginTop: '10px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex', flexDirection: 'column', gap: '8px',
        }}>
          {usage.breakdown.map((m, i) => {
            const mLabel = MODEL_LABELS[m.model] || m.model;
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>{mLabel}</span>
                <span style={{ color: 'var(--text-tertiary)', fontFamily: '"Geist Mono", monospace', fontSize: '10px' }}>{m.requests}/{m.limit}</span>
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
  const [apiKeys, setApiKeys] = useState([]);
  const [preferences, setPreferences] = useState({ useCustomApi: false, smartRouting: false, enableRacing: false, enableAdaptive: false, routingMode: 'auto', modelOverride: '', costControl: { monthlyLimitCents: 0, warningThresholdPct: 80, hardStop: true } });
  const [usageStats, setUsageStats] = useState(null);
  const [universalUsage, setUniversalUsage] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDirectory, setShowDirectory] = useState(false);
  const [testingKeyId, setTestingKeyId] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => { if (token) fetchDashboardData(); }, [token]);

  const fetchDashboardData = async () => {
    try {
      const res = await API.get('/api/apikeys/dashboard');
      const d = res.data;

      if (res.status === 200) {
        setApiKeys(d.keys || []);
        setPreferences(d.preferences || {});
        setUsageStats(d.usage || null);
        if (d.universal) setUniversalUsage(d.universal);
        setError(null);
      } else {
        const data = res.data;
        setError(data.error || 'Save failed.');
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.details || err.response?.data?.error || 'Connection failed');
    }
  };

  const handleUpdatePref = async (key, value) => {
    const updated = { ...preferences, [key]: value };
    setPreferences(updated);
    try {
      await API.put('/api/apikeys/preferences', updated);
      fetchDashboardData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateCostControl = async (field, value) => {
    const updated = { ...preferences, costControl: { ...(preferences.costControl || {}), [field]: value } };
    setPreferences(updated);
    try {
      await API.put('/api/apikeys/preferences', updated);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (keyId) => {
    try {
      const r = await API.delete(`/api/apikeys/${keyId}`);
      if (r.status === 200) { fetchDashboardData(); showToast?.('Key removed', 'info'); }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggle = async (keyId, isActive) => {
    setApiKeys(prev => prev.map(k => k.id === keyId ? { ...k, isActive } : k));
    try {
      await API.put(`/api/apikeys/${keyId}`, { isActive });
      fetchDashboardData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleTest = async (keyId) => {
    setTestingKeyId(keyId);
    setTestResults(prev => ({ ...prev, [keyId]: null }));
    try {
      const res = await API.post(`/api/apikeys/${keyId}/test`);
      const data = res.data;
      setTestResults(prev => ({ ...prev, [keyId]: data }));
      if (data.valid) showToast?.(`OK (${data.latencyMs}ms)`, 'success');
      else showToast?.(data.error || 'Failed', 'error');
      fetchDashboardData();
    } catch {
      setTestResults(prev => ({ ...prev, [keyId]: { valid: false, error: 'Network error' } }));
    } finally {
      setTestingKeyId(null);
    }
  };

  const hasActiveKey = apiKeys.some(k => k.isActive && k.isValid);
  const hasActiveCustom = preferences.useCustomApi && hasActiveKey;
  const keyAddedNotActive = hasActiveKey && !preferences.useCustomApi;

  // Status
  const statusColor = hasActiveCustom ? '#10b981' : keyAddedNotActive ? '#f59e0b' : '#3b82f6';
  const statusText = hasActiveCustom ? 'Custom API active' : keyAddedNotActive ? 'Key added — enable below' : 'Using platform credits';

  const statColors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Status indicator */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '8px 12px', borderRadius: '8px',
        background: `${statusColor}08`,
        border: '1px solid var(--border-color)',
      }}>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
        <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-secondary)' }}>{statusText}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setShowDirectory(true)}
            style={{
              padding: '4px 10px', borderRadius: '6px',
              background: 'transparent', border: '1px solid var(--border-color)',
              color: 'var(--text-tertiary)', fontSize: '10px', fontWeight: 500, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '4px'
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}
          >
            <Globe2 size={12} />
            Supported Providers
          </button>
          {keyAddedNotActive && (
            <button
              onClick={() => handleUpdatePref('useCustomApi', true)}
              style={{
                padding: '6px 14px', borderRadius: '8px',
                background: '#f59e0b', color: '#fff', border: 'none',
                fontSize: '11px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Enable
            </button>
          )}
        </div>
      </div>

      {/* Toggles */}
      <div>
        <SectionTitle>Configuration</SectionTitle>
        <SettingsGroup>
          <SettingsRow icon={Key} label="Use Custom API" rightElement={<AppleToggle value={preferences.useCustomApi} onChange={v => handleUpdatePref('useCustomApi', v)} />} />
          <SettingsRow icon={Brain} label="Smart Routing" rightElement={<AppleToggle value={preferences.smartRouting} onChange={v => handleUpdatePref('smartRouting', v)} />} />
          <SettingsRow icon={GitBranch} label="Adaptive Learning" rightElement={<AppleToggle value={preferences.enableAdaptive} onChange={v => handleUpdatePref('enableAdaptive', v)} />} />
          <SettingsRow icon={Activity} label="Parallel Racing" rightElement={<AppleToggle value={preferences.enableRacing} onChange={v => handleUpdatePref('enableRacing', v)} />} />
          <SettingsRow icon={Globe2} label="Routing" borderBottom={false} rightElement={<RightInlineSelect value={preferences.routingMode || 'auto'} onChange={v => handleUpdatePref('routingMode', v)} options={[{ value: 'auto', label: 'Auto' }, { value: 'manual', label: 'Manual' }]} />} />
        </SettingsGroup>

        {preferences.routingMode === 'manual' && apiKeys.length > 0 && (
          <SettingsGroup>
            <SettingsRow icon={Brain} label="Model Override" borderBottom={false} rightElement={<RightInlineSelect value={preferences.modelOverride || ''} onChange={v => handleUpdatePref('modelOverride', v)} options={[{ value: '', label: 'None' }, ...Array.from(new Set(apiKeys.map(k => k.model))).map(m => ({ value: m, label: MODEL_LABELS[m] || m }))]} />} />
          </SettingsGroup>
        )}
      </div>

      {/* Keys section */}
      <div>
        {!preferences.useCustomApi && universalUsage && <UsageCard usage={universalUsage} />}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <SectionTitle style={{ margin: 0 }}>API Keys</SectionTitle>
          <button
            onClick={() => setShowAddForm(s => !s)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', borderRadius: '10px',
              background: showAddForm ? 'var(--bg-tertiary)' : 'var(--text-primary)',
              color: showAddForm ? 'var(--text-primary)' : 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              cursor: 'pointer', fontSize: '11px', fontWeight: 600,
              transition: 'all 0.12s',
            }}
          >
            {showAddForm ? <><X size={14} /> Cancel</> : <><Plus size={14} /> Add New Key</>}
          </button>
        </div>

        <AnimatePresence>
          {showAddForm && (
            <UnifiedAPIForm
              token={token}
              onSave={() => { setShowAddForm(false); fetchDashboardData(); }}
              onCancel={() => setShowAddForm(false)}
              showToast={showToast}
              openDirectory={() => setShowDirectory(true)}
            />
          )}
        </AnimatePresence>

        {/* Key list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {apiKeys.length === 0 && !showAddForm && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              textAlign: 'center', padding: '40px 20px',
              background: 'var(--bg-secondary)', borderRadius: '12px',
              border: '1px solid var(--border-color)',
            }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                <Key size={20} strokeWidth={2} style={{ color: 'var(--text-tertiary)', opacity: 0.6 }} />
              </div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>No API keys</div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 400, marginBottom: '14px' }}>
                Add your own keys for independent AI access.
              </div>
              <button
                onClick={() => setShowAddForm(true)}
                style={{
                  padding: '8px 20px', borderRadius: '8px',
                  background: 'var(--text-primary)', color: 'var(--bg-primary)',
                  border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 500,
                }}
              >
                Add First Key
              </button>
            </div>
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
      <div>
        <SectionTitle>Limits</SectionTitle>
        <SettingsGroup>
          <SettingsRow icon={DollarSign} label="Monthly Limit" rightElement={
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: '8px', fontSize: '11px', color: 'var(--text-tertiary)', opacity: 0.5 }}>$</span>
              <input
                type="number"
                value={preferences.costControl?.monthlyLimitCents || 0}
                onChange={e => handleUpdateCostControl('monthlyLimitCents', parseInt(e.target.value) || 0)}
                className="hide-arrows"
                style={{
                  width: '80px', padding: '6px 8px 6px 20px', borderRadius: '8px',
                  border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)', fontSize: '12px', textAlign: 'right',
                  fontWeight: 500, fontFamily: '"Geist Mono", monospace', outline: 'none',
                }}
              />
            </div>
          } />
          <SettingsRow icon={Shield} label="Hard Stop" description="Pause when limit reached" borderBottom={false} rightElement={<AppleToggle value={preferences.costControl?.hardStop !== false} onChange={v => handleUpdateCostControl('hardStop', v)} />} />
        </SettingsGroup>
      </div>

      {/* Analytics */}
      {usageStats && (
        <div>
          <SectionTitle>Analytics</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            {[
              { label: 'Requests', value: usageStats.totalRequests || 0, icon: Zap },
              { label: 'Tokens', value: usageStats.totalTokens || 0, icon: Brain },
              { label: 'Latency', value: `${Math.round(usageStats.avgResponseTime || 0)}ms`, icon: Gauge },
              { label: 'Cost', value: `$${((usageStats.totalCost || 0) / 100).toFixed(2)}`, icon: DollarSign },
            ].map((s, i) => (
              <div
                key={i}
                style={{
                  background: 'var(--bg-secondary)', padding: '12px', borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  display: 'flex', flexDirection: 'column', gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <s.icon size={12} strokeWidth={2} style={{ color: statColors[i], opacity: 0.7 }} />
                  <span style={{ fontSize: '10px', fontWeight: 400, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</span>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 600, fontFamily: '"Geist Mono", monospace', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              padding: '10px 14px', background: 'rgba(239,68,68,0.05)',
              border: '1px solid rgba(239,68,68,0.12)', borderRadius: '10px',
              display: 'flex', alignItems: 'center', gap: '8px',
              color: '#ef4444', fontSize: '12px',
            }}
          >
            <AlertCircle size={14} strokeWidth={2} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, fontWeight: 400 }}>{error}</span>
            <button
              onClick={fetchDashboardData}
              style={{
                background: 'rgba(239,68,68,0.08)', border: 'none',
                color: '#ef4444', fontWeight: 500, cursor: 'pointer',
                padding: '4px 10px', borderRadius: '6px', fontSize: '10px',
              }}
            >
              Retry
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDirectory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 100005,
              background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
            }}
            onClick={() => setShowDirectory(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{
                background: 'var(--bg-primary)', borderRadius: '16px',
                width: '100%', maxWidth: '480px', maxHeight: '80vh',
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
                border: '1px solid var(--border-color)',
                boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{
                padding: '16px 20px', borderBottom: '1px solid var(--border-color)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Providers</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px', fontWeight: 400 }}>Supported AI providers</div>
                </div>
                <button
                  onClick={() => setShowDirectory(false)}
                  style={{ background: 'none', border: 'none', padding: '6px', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex' }}
                >
                  <X size={16} strokeWidth={2} />
                </button>
              </div>

              <div style={{ overflowY: 'auto', padding: '12px 16px 20px', display: 'flex', flexDirection: 'column', gap: '6px' }} className="no-scrollbar">
                {[...PROVIDERS]
                  .filter(p => p.id !== 'custom')
                  .sort((a, b) => (a.price || 0) - (b.price || 0))
                  .map(p => (
                    <div
                      key={p.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '12px 14px', borderRadius: '10px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                      }}
                    >
                      <ProviderDot color={p.color} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{p.name}</div>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '3px', alignItems: 'center' }}>
                          {p.price === 0 ? (
                            <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '4px', background: '#10b98110', color: '#10b981', fontWeight: 500 }}>Free</span>
                          ) : (
                            <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '4px', background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)', fontWeight: 500 }}>Paid</span>
                          )}
                          <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontFamily: '"Geist Mono", monospace', fontWeight: 400 }}>{p.hint}</span>
                        </div>
                      </div>
                      {p.link && (
                        <a
                          href={p.link} target="_blank" rel="noopener noreferrer"
                          style={{
                            padding: '6px 12px', borderRadius: '6px', background: 'var(--bg-tertiary)',
                            color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '10px', fontWeight: 500,
                            display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid var(--border-color)',
                          }}
                        >
                          Keys <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                  ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .hide-arrows::-webkit-outer-spin-button, .hide-arrows::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .hide-arrows { -moz-appearance: textfield; }
      `}</style>
    </div>
  );
}
