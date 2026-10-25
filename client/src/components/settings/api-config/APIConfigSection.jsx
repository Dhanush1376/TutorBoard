import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Brain, Key, Shield, GitBranch,
  Activity, Globe2, Sparkles, Gauge, DollarSign,
  AlertCircle, Plus, X, Globe, ExternalLink, Search
} from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import useWindowSize from '../../../hooks/useWindowSize';
import {
  SectionTitle, SettingsGroup, SettingsRow,
  AppleToggle, RightInlineSelect, Button
} from '../SettingsShared';
import API, { BASE_URL as API_URL } from '../../../services/api';
import { MODEL_LABELS, PROVIDERS } from './ProviderRegistry';
import UnifiedAPIForm from './UnifiedAPIForm';
import KeyCard from './KeyCard';
import ProviderBrandLogo, { BrandLogoBadge } from './ProviderBrandLogo';

// ─── Shared Components ────────────────────────────────────────────────────────

const getProviderMonogram = (name) => {
  if (!name) return 'AI';
  const clean = name.replace(/\(.*?\)/g, '').replace(/[^a-zA-Z0-9 ]/g, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
};

// ─── Usage Card ───────────────────────────────────────────────────────────────

const UsageCard = ({ usage }) => {
  if (!usage) return null;
  const isWarning = usage.percent >= 80;
  const isExceeded = usage.percent >= 100;

  return (
    <div style={{
      background: 'var(--st-surface)',
      border: '1px solid var(--st-line-strong)',
      borderRadius: '16px',
      padding: '14px',
      marginBottom: '16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <Sparkles size={13} strokeWidth={2} style={{ color: '#3b82f6', opacity: 0.7 }} />
        <div>
          <div style={{ fontSize: '12px', fontWeight: 500, letterSpacing: '-0.01em' }}>Platform Credits</div>
          <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 400 }}>Shared quota, auto-managed</div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '4px', fontWeight: 400 }}>
          <span style={{ color: 'var(--text-tertiary)' }}>Monthly usage</span>
          <span style={{ color: isExceeded ? '#ef4444' : isWarning ? '#f59e0b' : 'var(--text-secondary)', fontFamily: '"JetBrains Mono", monospace', fontWeight: 500 }}>
            {usage.requests} / {usage.limit}
          </span>
        </div>
        <div style={{ height: '4px', background: 'var(--st-fill-strong)', borderRadius: '2px', overflow: 'hidden' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, usage.percent)}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            style={{
              height: '100%',
              background: isExceeded ? '#ef4444' : isWarning ? '#f59e0b' : '#3b82f6',
              borderRadius: '2px',
            }}
          />
        </div>
      </div>

      {/* Model breakdown */}
      {usage.breakdown && usage.breakdown.length > 0 && (
        <div style={{
          paddingTop: '10px', marginTop: '10px',
          borderTop: '1px solid var(--st-line-strong)',
          display: 'flex', flexDirection: 'column', gap: '8px',
        }}>
          {usage.breakdown.map((m, i) => {
            const mLabel = MODEL_LABELS[m.model] || m.model;
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>{mLabel}</span>
                <span style={{ color: 'var(--text-tertiary)', fontFamily: '"JetBrains Mono", monospace', fontSize: '10px' }}>{m.requests}/{m.limit}</span>
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
  const { token, user } = useAuth();
  const isGuest = !!user?.isGuest;
  const { isMobile } = useWindowSize();
  const [apiKeys, setApiKeys] = useState([]);
  const [preferences, setPreferences] = useState({ useCustomApi: false, smartRouting: false, enableRacing: false, enableAdaptive: false, routingMode: 'auto', modelOverride: '', costControl: { monthlyLimitCents: 0, warningThresholdPct: 80, hardStop: true } });
  const [usageStats, setUsageStats] = useState(null);
  const [universalUsage, setUniversalUsage] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDirectory, setShowDirectory] = useState(false);
  const [directorySearch, setDirectorySearch] = useState('');
  const [testingKeyId, setTestingKeyId] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [error, setError] = useState(null);

  const directoryProviders = [...PROVIDERS]
    .filter(p => p.id !== 'custom')
    .sort((a, b) => (a.price || 0) - (b.price || 0));

  const filteredDirectoryProviders = directoryProviders.filter(p => {
    if (directorySearch.trim()) {
      const q = directorySearch.toLowerCase().trim();
      const matchName = p.name?.toLowerCase().includes(q);
      const matchHint = p.hint?.toLowerCase().includes(q);
      const matchModel = p.defaultModel?.toLowerCase().includes(q);
      const matchId = p.id?.toLowerCase().includes(q);
      const matchTier = (p.price === 0 && q === 'free') || (p.price > 0 && q === 'paid');
      return matchName || matchHint || matchModel || matchId || matchTier;
    }
    return true;
  });

  const fetchDashboardData = async () => {
    if (isGuest || !token) return;
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

  useEffect(() => { if (token && !isGuest) fetchDashboardData(); }, [token, isGuest]);

  const handleUpdatePref = async (key, value) => {
    const updated = { ...preferences, [key]: value };
    setPreferences(updated);
    if (isGuest) {
      showToast?.('Sign up free to save custom routing preferences.', 'info');
      return;
    }
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
    if (isGuest) {
      showToast?.('Sign up free to configure cost controls.', 'info');
      return;
    }
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

  const statColors = ['#0284c7', '#3b82f6', '#10b981', '#f59e0b'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Status */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--st-line-strong)] bg-[var(--st-surface)] px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-40" style={{ background: statusColor }} />
            <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: statusColor }} />
          </span>
          <div className="text-[13px] font-medium text-[var(--text-primary)] truncate">{statusText}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="secondary" className="h-7 px-2.5 text-[11.5px]" onClick={() => setShowDirectory(true)}>
            <Globe2 size={12} />
            Providers
          </Button>
          {keyAddedNotActive && (
            <Button className="h-7 px-3 text-[11.5px]" onClick={() => handleUpdatePref('useCustomApi', true)}>
              Enable
            </Button>
          )}
        </div>
      </div>

      {/* Toggles */}
      <div>
        <SectionTitle>How keys are used</SectionTitle>
        <SettingsGroup>
          <SettingsRow icon={Key} label="Use my own keys" rightElement={<AppleToggle value={preferences.useCustomApi} onChange={v => handleUpdatePref('useCustomApi', v)} />} />
          <SettingsRow icon={Brain} label="Pick the best key for me" rightElement={<AppleToggle value={preferences.smartRouting} onChange={v => handleUpdatePref('smartRouting', v)} />} />
          <SettingsRow icon={GitBranch} label="Learn which model works best" rightElement={<AppleToggle value={preferences.enableAdaptive} onChange={v => handleUpdatePref('enableAdaptive', v)} />} />
          <SettingsRow icon={Activity} label="Use the fastest answer" rightElement={<AppleToggle value={preferences.enableRacing} onChange={v => handleUpdatePref('enableRacing', v)} />} />
          <SettingsRow icon={Globe2} label="Routing mode" rightElement={<RightInlineSelect value={preferences.routingMode || 'auto'} onChange={v => handleUpdatePref('routingMode', v)} options={[{ value: 'auto', label: 'Auto' }, { value: 'manual', label: 'Manual' }]} />} />
        </SettingsGroup>

        {preferences.routingMode === 'manual' && apiKeys.length > 0 && (
          <SettingsGroup>
            <SettingsRow icon={Brain} label="Model override" rightElement={<RightInlineSelect value={preferences.modelOverride || ''} onChange={v => handleUpdatePref('modelOverride', v)} options={[{ value: '', label: 'None' }, ...Array.from(new Set(apiKeys.map(k => k.model))).map(m => ({ value: m, label: MODEL_LABELS[m] || m }))]} />} />
          </SettingsGroup>
        )}
      </div>

      {/* Keys section */}
      <div>
        {!preferences.useCustomApi && universalUsage && <UsageCard usage={universalUsage} />}

        <SectionTitle
          action={
            <Button
              variant={showAddForm ? 'secondary' : 'primary'}
              className="h-8 px-3.5 text-[12px]"
              onClick={() => {
                if (isGuest) {
                  showToast?.('Create a free account to securely save and encrypt your API keys.', 'info');
                  window.location.href = '/auth';
                  return;
                }
                setShowAddForm((v) => !v);
              }}
            >
              {showAddForm ? <><X size={13} /> Cancel</> : <><Plus size={13} /> Add key</>}
            </Button>
          }
        >
          Keys
        </SectionTitle>

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
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--st-line-strong)] px-4 py-7 text-center">
              <span className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--st-line)] bg-[var(--st-fill)] text-[var(--text-secondary)]">
                <Key size={15} strokeWidth={1.8} />
              </span>
              <div className="mt-2.5 text-[13px] font-medium text-[var(--text-secondary)]">
                {isGuest ? 'Custom keys require an account' : 'No keys added'}
              </div>
              <Button
                className="mt-3.5 h-7 px-3.5 text-[11.5px]"
                onClick={() => {
                  if (isGuest) window.location.href = '/auth';
                  else setShowAddForm(true);
                }}
              >
                {isGuest ? 'Sign up free' : 'Add key'}
              </Button>
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
          <SettingsRow icon={DollarSign} label="Monthly limit" rightElement={
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: '8px', fontSize: '11px', color: 'var(--text-tertiary)', opacity: 0.5 }}>$</span>
              <input
                type="number"
                value={preferences.costControl?.monthlyLimitCents || 0}
                onChange={e => handleUpdateCostControl('monthlyLimitCents', parseInt(e.target.value) || 0)}
                className="hide-arrows"
                style={{
                  width: '80px', padding: '6px 8px 6px 20px', borderRadius: '8px',
                  border: '1px solid var(--st-line-strong)', background: 'var(--st-fill-strong)',
                  color: 'var(--text-primary)', fontSize: '12px', textAlign: 'right',
                  fontWeight: 500, fontFamily: '"JetBrains Mono", monospace', outline: 'none',
                }}
              />
            </div>
          } />
          <SettingsRow icon={Shield} label="Stop at the limit" rightElement={<AppleToggle value={preferences.costControl?.hardStop !== false} onChange={v => handleUpdateCostControl('hardStop', v)} />} />
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
                  background: 'var(--st-surface)', padding: '12px', borderRadius: '10px',
                  border: '1px solid var(--st-line-strong)',
                  display: 'flex', flexDirection: 'column', gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <s.icon size={12} strokeWidth={2} style={{ color: statColors[i], opacity: 0.7 }} />
                  <span style={{ fontSize: '10px', fontWeight: 400, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</span>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 600, fontFamily: '"JetBrains Mono", monospace', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{s.value}</div>
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

      {/* Provider Directory Modal / Mobile App Drawer */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showDirectory && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[100050] flex flex-col justify-end sm:justify-center sm:items-center sm:p-5 bg-black/65 backdrop-blur-sm"
              onClick={() => {
                setShowDirectory(false);
                setDirectorySearch('');
              }}
            >
              <motion.div
                key="provider-drawer"
                initial={isMobile ? { y: '100%' } : { scale: 0.96, opacity: 0, y: 8 }}
                animate={isMobile ? { y: 0 } : { scale: 1, opacity: 1, y: 0 }}
                exit={isMobile ? { y: '100%' } : { scale: 0.96, opacity: 0, y: 8 }}
                transition={
                  isMobile
                    ? { type: 'spring', damping: 28, stiffness: 300, mass: 0.8 }
                    : { duration: 0.16, ease: 'easeOut' }
                }
                drag={isMobile ? 'y' : false}
                dragConstraints={{ top: 0 }}
                dragElastic={{ top: 0.04, bottom: 0.6 }}
                onDragEnd={(e, info) => {
                  if (info.offset.y > 100 || info.velocity.y > 400) {
                    setShowDirectory(false);
                    setDirectorySearch('');
                  }
                }}
                className="w-full sm:max-w-[460px] h-[85vh] sm:h-auto max-h-[88vh] sm:max-h-[82vh] flex flex-col bg-[var(--bg-primary)] rounded-t-[24px] sm:rounded-2xl rounded-b-none sm:rounded-b-2xl border-t border-x sm:border border-[var(--st-line-strong)] shadow-[0_-12px_45px_rgba(0,0,0,0.5)] sm:shadow-[0_24px_70px_-15px_rgba(0,0,0,0.65)] overflow-hidden"
                onClick={e => e.stopPropagation()}
              >
                {/* Mobile Drawer Grabber Pill */}
                <div className="flex sm:hidden justify-center pt-2.5 pb-1 shrink-0 cursor-grab active:cursor-grabbing">
                  <span className="h-1.5 w-10 rounded-full bg-[var(--text-tertiary)]/40" />
                </div>

                {/* Header */}
                <div className="px-4 py-3 sm:py-3.5 border-b border-[var(--st-line)] flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13.5px] font-semibold text-[var(--text-primary)] tracking-tight">
                        Providers
                      </span>
                      <span className="px-1.5 py-0.5 rounded-full bg-[var(--st-fill-strong)] text-[var(--text-tertiary)] text-[10px] font-mono font-medium">
                        {directoryProviders.length}
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5 font-normal">
                      Supported AI providers & API portals
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowDirectory(false);
                      setDirectorySearch('');
                    }}
                    className="h-7 w-7 rounded-full grid place-items-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--st-fill)] transition-colors"
                    aria-label="Close"
                  >
                    <X size={15} strokeWidth={2} />
                  </button>
                </div>

                {/* Search */}
                <div className="px-4 py-3 border-b border-[var(--st-line)] bg-[var(--st-surface)]">
                  <div className="relative group">
                    <Search size={13.5} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] group-focus-within:text-[var(--text-primary)] transition-colors pointer-events-none" />
                    <input
                      type="text"
                      value={directorySearch}
                      onChange={e => setDirectorySearch(e.target.value)}
                      placeholder="Search providers or key formats..."
                      className="directory-search-input w-full h-[34px] pl-8 pr-7 rounded-lg text-[12px] placeholder:text-[var(--text-tertiary)]"
                      style={{
                        outline: 'none',
                        outlineOffset: '0px',
                      }}
                      autoFocus
                    />
                    {directorySearch && (
                      <button
                        onClick={() => setDirectorySearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--st-fill-strong)] transition-colors"
                        aria-label="Clear search"
                      >
                        <X size={11} strokeWidth={2.5} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Provider List */}
                <div className="flex-1 overflow-y-auto p-3.5 no-scrollbar overscroll-contain">
                  {filteredDirectoryProviders.length === 0 ? (
                    <div className="py-12 px-4 text-center">
                      <Globe2 size={22} className="mx-auto text-[var(--text-tertiary)] opacity-40 mb-2" />
                      <div className="text-[12.5px] font-medium text-[var(--text-secondary)]">No providers found</div>
                      <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                        No results matching "{directorySearch}"
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-[var(--st-line)] bg-[var(--st-surface)] divide-y divide-[var(--st-line)] overflow-hidden">
                      {filteredDirectoryProviders.map(p => (
                        <div
                          key={p.id}
                          className="px-3.5 py-2.5 flex items-center justify-between gap-2.5 hover:bg-[#f2efe4] dark:hover:bg-[#191917] transition-colors group"
                        >
                          {/* Left: Brand Logo + Provider Info */}
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {/* Authentic Brand Logo Tile (Opaque & Theme-Inverted: dark in light, light in dark) */}
                            <BrandLogoBadge id={p.id} color={p.color} name={p.name} size={15} tileSize={28} />

                            {/* Provider Name & Key Hint */}
                            <div className="min-w-0 flex-1 pr-1.5">
                              <div className="text-[12.5px] font-medium text-[var(--text-primary)] leading-tight truncate">
                                {p.name}
                              </div>
                              <div className="text-[10px] text-[var(--text-tertiary)] font-mono truncate max-w-[180px] sm:max-w-[210px] mt-0.5">
                                {p.hint}
                              </div>
                            </div>
                          </div>

                          {/* Symmetrical Fixed-Width Tier Badge Column (Solid, Opaque & 50% Pill Radius) */}
                          <div style={{ width: '54px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {p.price === 0 ? (
                              <span
                                className="tier-badge-free"
                                style={{
                                  width: '50px',
                                  height: '24px',
                                  borderRadius: '9999px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '9.5px',
                                  fontWeight: 600,
                                  letterSpacing: '0.04em',
                                  textTransform: 'uppercase',
                                  userSelect: 'none',
                                }}
                              >
                                Free
                              </span>
                            ) : (
                              <span
                                className="tier-badge-paid"
                                style={{
                                  width: '50px',
                                  height: '24px',
                                  borderRadius: '9999px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '9.5px',
                                  fontWeight: 600,
                                  letterSpacing: '0.04em',
                                  textTransform: 'uppercase',
                                  userSelect: 'none',
                                }}
                              >
                                Paid
                              </span>
                            )}
                          </div>

                          {/* Symmetrical Keys Action Button Column (Equal 24px Height & 50% Pill Radius) */}
                          <div style={{ width: '64px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                            {p.link ? (
                              <a
                                href={p.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  width: '100%',
                                  height: '24px',
                                  borderRadius: '9999px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '4px',
                                  fontSize: '10.5px',
                                  fontWeight: 500,
                                  color: 'var(--text-secondary)',
                                  background: 'var(--st-surface)',
                                  border: '1px solid var(--st-line-strong)',
                                  textDecoration: 'none',
                                  userSelect: 'none',
                                }}
                                className="provider-keys-btn hover:bg-[var(--text-primary)] hover:text-[var(--bg-primary)] transition-all"
                              >
                                <span>Keys</span>
                                <ExternalLink size={10} className="opacity-70" />
                              </a>
                            ) : (
                              <span style={{ width: '100%', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'var(--text-tertiary)', fontFamily: '"JetBrains Mono", monospace' }}>
                                Local
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer with mobile safe area padding */}
                <div className="px-4 py-2.5 pb-[max(env(safe-area-inset-bottom),10px)] border-t border-[var(--st-line)] bg-[var(--st-surface)] flex items-center justify-between text-[11px] text-[var(--text-tertiary)]">
                  <span>Showing {filteredDirectoryProviders.length} of {directoryProviders.length}</span>
                  <button
                    onClick={() => {
                      setShowDirectory(false);
                      setDirectorySearch('');
                    }}
                    className="px-3 py-1 rounded-full text-[11px] font-medium text-[var(--text-primary)] bg-[var(--st-fill)] hover:bg-[var(--st-fill-strong)] transition-colors"
                  >
                    Done
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      <style>{`
        .hide-arrows::-webkit-outer-spin-button, .hide-arrows::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .hide-arrows { -moz-appearance: textfield; }
      `}</style>
    </div>
  );
}
