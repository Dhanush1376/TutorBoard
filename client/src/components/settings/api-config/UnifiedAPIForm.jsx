import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye, EyeOff, CheckCircle, XCircle,
  ExternalLink, ChevronDown, Activity, Zap,
  ShieldCheck, Globe, X
} from 'lucide-react';
import { ValidationError, API_URL } from '../SettingsShared';
import { PROVIDERS, ALL_DEFAULT_MODELS, detectProvider } from './ProviderRegistry';

// ─── Shared style constants ───────────────────────────────────────────────────

const labelStyle = {
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--text-tertiary)',
  marginBottom: '7px',
};

const inputBase = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '12px',
  border: '1px solid var(--border-color)',
  background: 'var(--bg-tertiary)',
  color: 'var(--text-primary)',
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
};

const eyeBtn = {
  position: 'absolute',
  right: '10px',
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-tertiary)',
  display: 'flex',
  padding: '4px',
};

// ─── Provider Dot ─────────────────────────────────────────────────────────────

function ProviderDot({ color, size = 10 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color, flexShrink: 0,
      transition: 'background 0.2s',
    }} />
  );
}

// ─── Provider Grid ────────────────────────────────────────────────────────────

function ProviderGrid({ selected, onSelect }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
      gap: '10px',
      marginTop: '12px',
    }}>
      {PROVIDERS.map(p => {
        const isSelected = selected?.id === p.id;
        return (
          <button
            key={p.id}
            onClick={() => onSelect(isSelected ? null : p)}
            style={{
              padding: '10px 8px',
              borderRadius: '12px',
              border: isSelected ? `2px solid ${p.color}` : '1px solid var(--border-color)',
              background: isSelected ? `${p.color}14` : 'var(--bg-tertiary)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '5px',
              transition: 'all 0.12s',
            }}
          >
            <ProviderDot color={p.color} size={8} />
            <span style={{
              fontSize: '11px',
              color: isSelected ? p.color : 'var(--text-secondary)',
              fontWeight: isSelected ? 600 : 400,
              textAlign: 'center',
              lineHeight: 1.3,
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
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 20 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        borderRadius: '14px',
        border: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        marginBottom: '8px',
      }}
    >
      <ProviderDot color={entry.provider?.color || '#888'} size={9} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {entry.label}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px', fontFamily: 'monospace' }}>
          {entry.maskedKey} · {entry.model}
        </div>
      </div>
      <div style={{
        fontSize: '11px', padding: '3px 10px', borderRadius: '999px',
        background: 'rgba(16,185,129,0.08)', color: '#10b981',
        border: '1px solid rgba(16,185,129,0.2)', fontWeight: 600,
      }}>
        active
      </div>
      <button
        onClick={() => onRemove(entry.id)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', padding: '4px' }}
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}

// ─── Main Form ────────────────────────────────────────────────────────────────

export default function UnifiedAPIForm({ onSave, onCancel, token, showToast }) {
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState(null);
  const [model, setModel] = useState('');
  const [label, setLabel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showDirectory, setShowDirectory] = useState(false);

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
  }, [apiKey]);

  const handleProviderSelect = (p) => {
    setProvider(p);
    setModel(p.defaultModel || '');
    setValidationResult(null);
    setError('');
  };

  const handleValidate = async () => {
    if (!apiKey.trim()) return setError('API key is required.');
    if (!provider) return setError('Could not detect provider — please pick one manually.');

    setIsValidating(true);
    setError('');
    setValidationResult(null);

    try {
      const res = await fetch(`${API_URL}/api/apikeys/test-transient`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          provider: provider.id,
          apiKey: apiKey.trim(),
          model: model || provider.defaultModel,
          baseUrl: provider.id === 'custom' ? baseUrl : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.valid) {
        setValidationResult({ valid: true, latency: data.latencyMs });
      } else {
        setValidationResult({ valid: false, error: data.details || data.error || 'Validation failed' });
      }
    } catch {
      setError('Network error during validation.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleSave = async () => {
    if (!validationResult?.valid) return setError('Please validate the API key first.');

    try {
      const res = await fetch(`${API_URL}/api/apikeys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          provider: provider.id,
          apiKey: apiKey.trim(),
          model,
          label: label || `${provider.name} Key`,
          baseUrl: provider.id === 'custom' ? baseUrl : undefined,
        }),
      });

      if (res.ok) {
        const entry = {
          id: Date.now(),
          provider,
          model: model || provider.defaultModel || '—',
          label: label || `${provider.name} Key`,
          maskedKey: apiKey.slice(0, 8) + '••••' + apiKey.slice(-4),
          latency: validationResult.latency,
        };
        setSavedKeys(prev => [entry, ...prev]);
        showToast?.('API key saved and activated', 'success');
        resetForm();
        onSave?.();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save key.');
      }
    } catch {
      setError('Network error. Failed to save.');
    }
  };

  const resetForm = () => {
    setApiKey('');
    setProvider(null);
    setModel('');
    setLabel('');
    setBaseUrl('');
    setShowKey(false);
    setShowPicker(false);
    setValidationResult(null);
    setError('');
  };

  const canValidate = apiKey.trim().length > 4 && !isValidating;
  const canSave = validationResult?.valid;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      style={{ marginBottom: '24px' }}
    >
      <AnimatePresence>
        {savedKeys.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: '10px' }}>
              Active keys
            </div>
            {savedKeys.map(k => (
              <SavedKeyCard
                key={k.id}
                entry={k}
                onRemove={id => setSavedKeys(prev => prev.filter(x => x.id !== id))}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '20px',
        padding: 'clamp(16px, 4vw, 24px)', // Responsive padding
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
      }}>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px', height: '42px', borderRadius: '12px',
              background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6',
              flexShrink: 0
            }}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)' }}>Your API vault</div>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '1px' }}>
                Paste any key — provider auto-detected
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowDirectory(true)}
            style={{
              padding: '6px 12px', borderRadius: '10px',
              background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
              fontSize: '11px', fontWeight: 600, color: '#8b5cf6',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              transition: 'all 0.2s',
            }}
          >
            <Globe size={13} />
            Get API keys
          </button>
        </div>

        <div>
          <div style={labelStyle}>API key</div>
          <div style={{ position: 'relative' }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => {
                setApiKey(e.target.value);
                setValidationResult(null);
                setError('');
              }}
              placeholder="Paste your key here…"
              autoComplete="off"
              spellCheck={false}
              style={{
                ...inputBase,
                fontFamily: apiKey ? 'monospace' : 'inherit',
                paddingRight: '40px',
              }}
            />
            <button
              onClick={() => setShowKey(v => !v)}
              style={eyeBtn}
              title={showKey ? 'Hide key' : 'Show key'}
            >
              {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {provider && (
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '5px', fontFamily: 'monospace' }}>
              pattern: {provider.hint}
            </div>
          )}
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={labelStyle}>Detected provider</div>
            <button
              onClick={() => setShowPicker(v => !v)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-tertiary)' }}
            >
              <ChevronDown size={12} style={{ transition: 'transform 0.2s', transform: showPicker ? 'rotate(180deg)' : 'none' }} />
              pick manually
            </button>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '11px 14px', borderRadius: '12px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-tertiary)',
            flexWrap: 'wrap',
          }}>
            <ProviderDot color={provider?.color || 'var(--text-tertiary)'} />
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: provider?.color || 'var(--text-tertiary)' }}>
                {provider ? provider.name : (apiKey ? 'Unknown — pick manually' : 'Paste a key to auto-detect')}
              </div>
              {provider?.link && (
                <a
                  href={provider.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-tertiary)',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    borderRadius: '8px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  Get Key <ExternalLink size={10} />
                </a>
              )}
            </div>
          </div>

          <AnimatePresence>
            {showPicker && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{ overflow: 'hidden' }}
              >
                <ProviderGrid selected={provider} onSelect={p => { handleProviderSelect(p); setShowPicker(false); }} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Responsive Grid for Model and Label */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
          gap: '12px' 
        }}>
          <div>
            <div style={labelStyle}>Model</div>
            <input
              type="text"
              value={model}
              onChange={e => setModel(e.target.value)}
              placeholder={provider?.defaultModel || 'model-id'}
              style={inputBase}
            />
          </div>
          <div>
            <div style={labelStyle}>Label (optional)</div>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder={provider ? `${provider.name} Key` : 'My key'}
              style={inputBase}
            />
          </div>
        </div>

        <AnimatePresence>
          {provider?.id === 'custom' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
              <div style={labelStyle}>Base URL (proxy / local)</div>
              <div style={{ position: 'relative' }}>
                <Globe size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                <input
                  type="text"
                  value={baseUrl}
                  onChange={e => setBaseUrl(e.target.value)}
                  placeholder="https://your-proxy.com/v1"
                  style={{ ...inputBase, paddingLeft: '32px' }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {validationResult && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '11px 14px', borderRadius: '12px',
                background: validationResult.valid ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.07)',
                border: `1px solid ${validationResult.valid ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                flexWrap: 'wrap',
              }}
            >
              {validationResult.valid
                ? <CheckCircle size={16} color="#10b981" />
                : <XCircle size={16} color="#ef4444" />}
              <span style={{ fontSize: '13px', color: validationResult.valid ? '#10b981' : '#ef4444' }}>
                {validationResult.valid
                  ? `Connected in ${validationResult.latency}ms`
                  : validationResult.error}
              </span>
            </motion.div>
          )}
          {error && <ValidationError message={error} />}
        </AnimatePresence>

        {/* Responsive Buttons */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '10px' 
        }}>
            <button
            onClick={handleValidate}
            disabled={!canValidate}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '14px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-tertiary)',
              color: canValidate ? 'var(--text-primary)' : 'var(--text-tertiary)',
              fontSize: '13px', fontWeight: 600,
              cursor: canValidate ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              transition: 'all 0.15s',
            }}
          >
            {isValidating
              ? <Activity size={14} style={{ animation: 'spin 1s linear infinite' }} />
              : <Zap size={14} />}
            {isValidating ? 'Testing…' : 'Test connection'}
          </button>

            <button
            onClick={handleSave}
            disabled={!canSave}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '14px',
              border: 'none',
              background: canSave ? 'var(--text-primary)' : 'var(--bg-tertiary)',
              color: canSave ? 'var(--bg-primary)' : 'var(--text-tertiary)',
              fontSize: '13px', fontWeight: 700,
              cursor: canSave ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              boxShadow: canSave ? '0 4px 18px rgba(0,0,0,0.15)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            <CheckCircle size={14} />
            Save & activate
          </button>
        </div>

        <button
          onClick={onCancel}
          style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline', textAlign: 'center' }}
        >
          Cancel
        </button>
      </div>

      <AnimatePresence>
        {showDirectory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 2000,
              background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
            }}
            onClick={() => setShowDirectory(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                background: 'var(--bg-primary)', borderRadius: '24px',
                width: '100%', maxWidth: '500px', maxHeight: '80vh',
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
                boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                border: '1px solid var(--border-color)',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Provider Directory</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>Free to Premium</div>
                </div>
                <button onClick={() => setShowDirectory(false)} style={{ background: 'var(--bg-tertiary)', border: 'none', padding: '6px', borderRadius: '10px', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ overflowY: 'auto', padding: '12px' }}>
                {[...PROVIDERS]
                  .filter(p => p.id !== 'custom')
                  .sort((a, b) => (a.price || 0) - (b.price || 0))
                  .map(p => (
                    <div key={p.id} style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px', borderRadius: '16px',
                      border: '1px solid var(--border-color)', marginBottom: '8px',
                      background: 'var(--bg-secondary)',
                    }}>
                      <ProviderDot color={p.color} size={10} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '3px', flexWrap: 'wrap' }}>
                          {p.price === 0 && (
                            <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '4px', background: '#10b98115', color: '#10b981', fontWeight: 700 }}>FREE</span>
                          )}
                          <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{p.hint}</span>
                        </div>
                      </div>
                      {p.link && (
                        <a href={p.link} target="_blank" rel="noopener noreferrer" style={{
                          padding: '8px 12px', borderRadius: '10px', background: 'var(--bg-tertiary)',
                          color: 'var(--text-primary)', textDecoration: 'none', fontSize: '11px', fontWeight: 600,
                          display: 'flex', alignItems: 'center', gap: '5px', border: '1px solid var(--border-color)',
                        }}>
                          Link <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </motion.div>
  );
}
