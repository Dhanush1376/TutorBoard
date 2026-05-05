import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye, EyeOff, CheckCircle, XCircle,
  ExternalLink, ChevronDown, Activity, Zap,
  Globe, X
} from 'lucide-react';
import { ValidationError, API_URL } from '../SettingsShared';
import API from '../../../services/api';
import { PROVIDERS, ALL_DEFAULT_MODELS, detectProvider } from './ProviderRegistry';

// ─── Shared styles ────────────────────────────────────────────────────────────

const labelStyle = {
  fontSize: '10px', fontWeight: 500, textTransform: 'uppercase',
  letterSpacing: '0.06em', color: 'var(--text-tertiary)',
  marginBottom: '4px', display: 'block',
};

const inputBase = {
  width: '100%', padding: '8px 10px', borderRadius: '8px',
  border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)',
  color: 'var(--text-primary)', fontSize: '12px', outline: 'none',
  boxSizing: 'border-box', transition: 'border-color 0.12s',
};

// ─── Provider Grid ────────────────────────────────────────────────────────────

function ProviderGrid({ selected, onSelect }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
      gap: '6px', marginTop: '8px',
    }}>
      {PROVIDERS.map(p => {
        const isSelected = selected?.id === p.id;
        return (
          <button
            key={p.id}
            onClick={() => onSelect(isSelected ? null : p)}
            style={{
              padding: '8px 6px', borderRadius: '8px',
              border: `1px solid ${isSelected ? p.color : 'var(--border-color)'}`,
              background: isSelected ? `${p.color}0c` : 'transparent',
              cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
              transition: 'all 0.12s',
            }}
          >
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: p.color }} />
            <span style={{
              fontSize: '9px',
              color: isSelected ? p.color : 'var(--text-tertiary)',
              fontWeight: isSelected ? 500 : 400,
              textAlign: 'center', lineHeight: 1.2,
            }}>
              {p.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Saved Key Card ───────────────────────────────────────────────────────────

function SavedKeyCard({ entry, onRemove }) {
  const pColor = entry.provider?.color || '#8b5cf6';
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 12px', borderRadius: '10px',
        border: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        marginBottom: '8px',
      }}
    >
      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: pColor, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          {entry.label}
          <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '4px', background: `${pColor}10`, color: pColor, fontWeight: 500 }}>
            {entry.provider?.name}
          </span>
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '2px', fontFamily: '"Geist Mono", monospace', fontWeight: 400 }}>
          {entry.maskedKey} · {entry.model}
        </div>
      </div>
      <button
        onClick={() => onRemove(entry.id)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', padding: '4px', borderRadius: '6px', opacity: 0.4, transition: 'all 0.12s' }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = '#ef4444'; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '0.4'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}
      >
        <X size={13} strokeWidth={2} />
      </button>
    </motion.div>
  );
}

// ─── Main Form ────────────────────────────────────────────────────────────────

export default function UnifiedAPIForm({ onSave, onCancel, token, showToast, openDirectory }) {
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState(null);
  const [model, setModel] = useState('');
  const [label, setLabel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [error, setError] = useState('');

  const [savedKeys, setSavedKeys] = useState([]);

  useEffect(() => {
    if (!apiKey) { setProvider(null); return; }
    const detected = detectProvider(apiKey);
    if (detected) {
      setProvider(detected);
      if (!model || ALL_DEFAULT_MODELS.has(model)) {
        setModel(detected.defaultModel || '');
      }
    }
  }, [apiKey, model]);

  const handleProviderSelect = (p) => {
    setProvider(p);
    setModel(p.defaultModel || '');
    setValidationResult(null);
    setError('');
  };

  const handleValidate = async () => {
    if (!apiKey.trim()) return setError('API key required.');
    if (!provider) return setError('Provider not detected — select manually.');

    setIsValidating(true);
    setError('');
    setValidationResult(null);

    try {
      const res = await API.post('/api/apikeys/test-transient', {
        provider: provider.id, apiKey: apiKey.trim(),
        model: model || provider.defaultModel,
        baseUrl: provider.id === 'custom' ? baseUrl : undefined,
      });

      const data = res.data;
      
      if (res.status === 200 && data.valid) {
        setValidationResult({ valid: true, latency: data.latencyMs });
      } else {
        const rawErr = data.details || data.error || `Error (${res.status})`;
        const errorMsg = typeof rawErr === 'object' ? (rawErr.message || JSON.stringify(rawErr)) : rawErr;
        setValidationResult({ valid: false, error: errorMsg, suggestions: data.suggestions || [] });
      }
    } catch (err) {
      setError(`Network error: ${err.message || 'Server unreachable'}`);
    } finally {
      setIsValidating(false);
    }
  };

  const handleSave = async () => {
    if (!validationResult?.valid) return setError('Validate the key first.');

    try {
      const res = await API.post('/api/apikeys', {
        provider: provider.id, apiKey: apiKey.trim(), model,
        label: label || `${provider.name} Key`,
        baseUrl: provider.id === 'custom' ? baseUrl : undefined,
      });

      if (res.status === 200 || res.status === 201) {
        const entry = {
          id: Date.now(), provider,
          model: model || provider.defaultModel || '—',
          label: label || `${provider.name} Key`,
          maskedKey: apiKey.slice(0, 8) + '••••' + apiKey.slice(-4),
          latency: validationResult.latency,
        };
        setSavedKeys(prev => [entry, ...prev]);
        showToast?.('Key saved', 'success');
        resetForm();
        onSave?.();
      } else {
        const data = res.data;
        setError(data.error || 'Save failed.');
      }
    } catch {
      setError('Network error.');
    }
  };

  const resetForm = () => {
    setApiKey(''); setProvider(null); setModel(''); setLabel('');
    setBaseUrl(''); setShowKey(false); setShowPicker(false);
    setValidationResult(null); setError('');
  };

  const canValidate = apiKey.trim().length > 4 && !isValidating;
  const canSave = validationResult?.valid;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
      style={{ marginBottom: '16px' }}
    >
      <AnimatePresence mode="popLayout">
        {savedKeys.length > 0 && (
          <div style={{ marginBottom: '12px' }}>
            {savedKeys.map(k => (
              <SavedKeyCard key={k.id} entry={k} onRemove={id => setSavedKeys(prev => prev.filter(x => x.id !== id))} />
            ))}
          </div>
        )}
      </AnimatePresence>

      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '14px', 
        display: 'flex', flexDirection: 'column', gap: '12px',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6' }}>
              <Globe size={13} strokeWidth={2} />
            </div>
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>New API Key</span>
          </div>
          <button 
            onClick={openDirectory}
            style={{ 
              background: 'none', border: 'none', color: '#8b5cf6', 
              fontSize: '10px', fontWeight: 500, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.8
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0.8'}
          >
            Supported Providers
          </button>
        </div>

        {/* API Key input */}
        <div>
          <label style={labelStyle}>API Key</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => { setApiKey(e.target.value); setValidationResult(null); setError(''); }}
              placeholder="Paste your API key..."
              autoComplete="off"
              spellCheck={false}
              style={{
                ...inputBase, paddingRight: '32px',
                fontFamily: apiKey ? '"Geist Mono", monospace' : 'inherit',
                borderColor: apiKey && provider ? `${provider.color}60` : 'var(--border-color)',
              }}
            />
            <button
              onClick={() => setShowKey(v => !v)}
              style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', padding: '2px', opacity: 0.5 }}
            >
              {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
          {provider && (
            <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '4px', fontFamily: '"Geist Mono", monospace', fontWeight: 400 }}>
              <span style={{ color: provider.color }}>{provider.name}</span> detected — {provider.hint}
            </div>
          )}
        </div>

        {/* Provider */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Provider</label>
            <button
              onClick={() => setShowPicker(v => !v)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 400, color: 'var(--text-tertiary)', opacity: 0.7 }}
            >
              <ChevronDown size={12} style={{ transition: 'transform 0.15s', transform: showPicker ? 'rotate(180deg)' : 'none' }} />
              Manual
            </button>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 10px', borderRadius: '8px', marginTop: '4px',
            border: '1px solid var(--border-color)',
            background: provider ? `${provider.color}06` : 'var(--bg-tertiary)',
          }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: provider?.color || 'var(--text-tertiary)' }} />
            <span style={{ fontSize: '12px', fontWeight: 400, color: provider?.color || 'var(--text-tertiary)', flex: 1 }}>
              {provider ? provider.name : (apiKey ? 'Unknown' : 'Awaiting key...')}
            </span>
            {provider?.link && (
              <a
                href={provider.link}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: '10px', color: provider.color, textDecoration: 'none',
                  display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 400, opacity: 0.7,
                }}
              >
                Get key <ExternalLink size={9} />
              </a>
            )}
          </div>

          <AnimatePresence>
            {showPicker && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
                <ProviderGrid selected={provider} onSelect={p => { handleProviderSelect(p); setShowPicker(false); }} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Model & Label */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <label style={labelStyle}>Model</label>
            <input type="text" value={model} onChange={e => setModel(e.target.value)} placeholder={provider?.defaultModel || 'gpt-4o'} style={{ ...inputBase, fontFamily: '"Geist Mono", monospace' }} />
          </div>
          <div>
            <label style={labelStyle}>Label</label>
            <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder={provider ? `${provider.name} Key` : 'My Key'} style={inputBase} />
          </div>
        </div>

        {/* Custom base URL */}
        <AnimatePresence>
          {provider?.id === 'custom' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
              <div>
                <label style={labelStyle}>Base URL</label>
                <input type="text" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://your-proxy.com/v1" style={{ ...inputBase, fontFamily: '"Geist Mono", monospace' }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Validation result */}
        <AnimatePresence>
          {validationResult && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                padding: '10px 12px', borderRadius: '8px',
                background: validationResult.valid ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
                border: `1px solid ${validationResult.valid ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {validationResult.valid
                  ? <CheckCircle size={13} color="#10b981" strokeWidth={2.5} />
                  : <XCircle size={13} color="#ef4444" strokeWidth={2.5} />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', color: validationResult.valid ? '#10b981' : '#ef4444', fontWeight: 500 }}>
                    {validationResult.valid ? 'Verified' : 'Failed'}
                  </div>
                  <div style={{ fontSize: '10px', color: validationResult.valid ? '#10b981' : '#ef4444', opacity: 0.7, fontWeight: 400, marginTop: '1px' }}>
                    {validationResult.valid ? `${validationResult.latency}ms latency` : validationResult.error}
                  </div>
                </div>
              </div>
              
              {/* Suggestions */}
              {!validationResult.valid && validationResult.suggestions?.length > 0 && (
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(239,68,68,0.1)', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {validationResult.suggestions.map(s => (
                    <button
                      key={s}
                      onClick={() => { setModel(s); setValidationResult(null); }}
                      style={{
                        background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
                        color: '#ef4444', padding: '4px 10px', borderRadius: '6px',
                        fontSize: '10px', fontWeight: 400, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '4px',
                      }}
                    >
                      <Zap size={10} /> {s}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
          {error && <ValidationError message={error} />}
        </AnimatePresence>

        {/* Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <button
            onClick={handleValidate}
            disabled={!canValidate}
            style={{
              padding: '10px 14px', borderRadius: '10px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-tertiary)',
              color: canValidate ? 'var(--text-primary)' : 'var(--text-tertiary)',
              fontSize: '12px', fontWeight: 600,
              cursor: canValidate ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              opacity: canValidate ? 1 : 0.4, transition: 'all 0.12s',
            }}
          >
            {isValidating
              ? <Activity size={14} style={{ animation: 'spin 1s linear infinite' }} />
              : <Zap size={14} />}
            {isValidating ? 'Testing...' : 'Test Key'}
          </button>

          <button
            onClick={handleSave}
            disabled={!canSave}
            style={{
              padding: '10px 14px', borderRadius: '10px', border: 'none',
              background: canSave ? 'var(--text-primary)' : 'var(--bg-tertiary)',
              color: canSave ? 'var(--bg-primary)' : 'var(--text-tertiary)',
              fontSize: '12px', fontWeight: 600,
              cursor: canSave ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              opacity: canSave ? 1 : 0.4, transition: 'all 0.12s',
            }}
          >
            <CheckCircle size={14} />
            Save Key
          </button>
        </div>

        <button
          onClick={onCancel}
          style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: '10px', fontWeight: 400, cursor: 'pointer', textAlign: 'center', opacity: 0.5 }}
        >
          Cancel
        </button>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } } 
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </motion.div>
  );
}
