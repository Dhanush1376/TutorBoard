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
  fontSize: '10px',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--text-tertiary)',
  marginBottom: '8px',
  display: 'block',
};

const inputBase = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '12px',
  border: '1px solid var(--border-color)',
  background: 'var(--bg-tertiary)',
  color: 'var(--text-primary)',
  fontSize: '12px',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s, box-shadow 0.2s',
};

const eyeBtn = {
  position: 'absolute',
  right: '12px',
  top: '50%',
  transform: 'translateY(-50%)',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-tertiary)',
  display: 'flex',
  padding: '4px',
  transition: 'color 0.2s',
};

// ─── Provider Dot ─────────────────────────────────────────────────────────────

function ProviderDot({ color, size = 10, pulsing = false }) {
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: color, transition: 'background 0.3s',
        boxShadow: `0 0 8px ${color}40`,
      }} />
      {pulsing && (
        <div style={{
          position: 'absolute', inset: -2, borderRadius: '50%',
          border: `1px solid ${color}50`,
          animation: 'pulse-ring 2s infinite',
        }} />
      )}
    </div>
  );
}

// ─── Provider Grid ────────────────────────────────────────────────────────────

function ProviderGrid({ selected, onSelect }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(85px, 1fr))',
      gap: '12px',
      marginTop: '16px',
    }}>
      {PROVIDERS.map((p, i) => {
        const isSelected = selected?.id === p.id;
        return (
          <motion.button
            key={p.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.015, duration: 0.25, ease: 'easeOut' }}
            onClick={() => onSelect(isSelected ? null : p)}
            whileHover={{ y: -3, boxShadow: `0 8px 24px ${p.color}25` }}
            whileTap={{ scale: 0.94 }}
            style={{
              padding: '10px 8px',
              borderRadius: '16px',
              border: isSelected ? `2px solid ${p.color}` : '1px solid var(--border-color)',
              background: isSelected ? `${p.color}10` : 'var(--bg-tertiary)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative', overflow: 'hidden'
            }}
          >
            {isSelected && (
              <motion.div 
                layoutId="active-bg"
                style={{ position: 'absolute', inset: 0, background: `${p.color}08`, zIndex: 0 }} 
              />
            )}
            <div style={{ position: 'relative', zIndex: 1 }}>
              <ProviderDot color={p.color} size={10} pulsing={isSelected} />
            </div>
            <span style={{
              fontSize: '10px',
              color: isSelected ? p.color : 'var(--text-secondary)',
              fontWeight: isSelected ? 700 : 500,
              textAlign: 'center',
              lineHeight: 1.2,
              letterSpacing: '-0.01em',
              position: 'relative', zIndex: 1,
              textTransform: 'uppercase'
            }}>
              {p.name}
            </span>
          </motion.button>
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
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '12px 16px',
        borderRadius: '20px',
        border: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        marginBottom: '12px',
        boxShadow: `0 4px 20px rgba(0,0,0,0.02), inset 0 0 0 1px ${pColor}10`,
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, width: '3px', height: '100%', background: pColor }} />
      <ProviderDot color={pColor} size={12} pulsing />
      
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {entry.label}
          <div style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '999px', background: `${pColor}15`, color: pColor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {entry.provider?.name}
          </div>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px', fontFamily: '"Geist Mono", monospace', letterSpacing: '-0.01em', fontWeight: 500 }}>
          {entry.maskedKey} <span style={{ opacity: 0.3 }}>·</span> <span style={{ color: 'var(--text-secondary)' }}>{entry.model}</span>
        </div>
      </div>

      <motion.button
        whileHover={{ scale: 1.1, background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
        whileTap={{ scale: 0.9 }}
        onClick={() => onRemove(entry.id)}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', padding: '8px', borderRadius: '12px', transition: 'all 0.2s', opacity: 0.6 }}
      >
        <X size={16} strokeWidth={2.5} />
      </motion.button>
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
  }, [apiKey, model]);

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

      const data = await res.json().catch(() => ({ error: 'The server returned an invalid response. Please check your backend logs.' }));
      
      if (res.ok && data.valid) {
        setValidationResult({ valid: true, latency: data.latencyMs });
      } else {
        // SAFE ERROR PARSING: Ensure we never display [object Object]
        const rawErr = data.details || data.error || `Server error (HTTP ${res.status})`;
        const errorMsg = typeof rawErr === 'object' 
          ? (rawErr.message || JSON.stringify(rawErr)) 
          : rawErr;

        setValidationResult({ 
          valid: false, 
          error: errorMsg,
          suggestions: data.suggestions || []
        });
      }
    } catch (err) {
      console.error('[Validation] Network error:', err);
      setError(`Network error: ${err.message || 'Could not reach the server'}. Please ensure the API is accessible.`);
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
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ type: 'spring', damping: 25, stiffness: 240 }}
      style={{ marginBottom: '32px' }}
    >
      <AnimatePresence mode="popLayout">
        {savedKeys.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} 
            animate={{ opacity: 1, y: 0 }} 
            style={{ marginBottom: '28px' }}
          >
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: '16px', paddingLeft: '4px' }}>
              PROVISIONED CREDENTIALS
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
        position: 'relative',
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid var(--glass-border)',
        borderRadius: '28px',
        padding: '18px', 
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        boxShadow: 'var(--glass-shadow)',
        overflow: 'hidden',
      }}>
        {/* Animated accent gradient */}
        <div style={{ 
          position: 'absolute', top: -150, right: -150, width: '400px', height: '400px', 
          background: 'radial-gradient(circle, rgba(139,92,246,0.08), transparent 70%)', 
          pointerEvents: 'none', filter: 'blur(40px)' 
        }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '20px', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '11px',
              background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(139,92,246,0.05))', 
              border: '1px solid rgba(139,92,246,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6',
              flexShrink: 0, boxShadow: '0 8px 16px rgba(139,92,246,0.15)'
            }}>
              <ShieldCheck size={18} strokeWidth={2.2} />
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Identity Credentials</div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px', fontWeight: 500 }}>
                Securely bind your API keys. Patterns are matched in real-time.
              </div>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.05, background: 'var(--bg-primary)' }} whileTap={{ scale: 0.95 }}
            onClick={() => setShowDirectory(true)}
            style={{
              padding: '7px 14px', borderRadius: '11px',
              background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
              fontSize: '11px', fontWeight: 700, color: '#8b5cf6',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)', letterSpacing: '0.03em',
              textTransform: 'uppercase'
            }}
          >
            <Globe size={12} strokeWidth={2.5} />
            Providers
          </motion.button>
        </div>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <label style={labelStyle}>API key</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={e => {
                setApiKey(e.target.value);
                setValidationResult(null);
                setError('');
              }}
              placeholder="••••••••••••••••••••••••••••••••"
              autoComplete="off"
              spellCheck={false}
              style={{
                ...inputBase,
                padding: '9px 12px',
                borderRadius: '12px',
                fontFamily: apiKey ? '"Geist Mono", monospace' : 'inherit',
                paddingRight: '44px',
                fontSize: '12px',
                border: apiKey ? (provider ? `1.5px solid ${provider.color}80` : '1px solid var(--border-color)') : '1px solid var(--border-color)',
                boxShadow: apiKey && provider ? `0 0 0 4px ${provider.color}10` : 'none',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            />
            <button
              onClick={() => setShowKey(v => !v)}
              style={{ ...eyeBtn, right: '16px' }}
              title={showKey ? 'Hide key' : 'Show key'}
            >
              {showKey ? <EyeOff size={15} strokeWidth={2.5} /> : <Eye size={15} strokeWidth={2.5} />}
            </button>
          </div>
          {provider && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '10px', fontFamily: '"Geist Mono", monospace', paddingLeft: '4px', fontWeight: 600 }}>
              <span style={{ color: provider.color }}>{provider.name}</span> detected via pattern: <span style={{ opacity: 0.7 }}>{provider.hint}</span>
            </motion.div>
          )}
        </div>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Matched Provider</label>
            <button
              onClick={() => setShowPicker(v => !v)}
              style={{ 
                background: 'none', border: 'none', cursor: 'pointer', 
                display: 'flex', alignItems: 'center', gap: '6px', 
                fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)',
                opacity: 0.8, transition: 'opacity 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = '0.8'}
            >
              <ChevronDown size={14} strokeWidth={2.5} style={{ transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)', transform: showPicker ? 'rotate(180deg)' : 'none' }} />
              Manual Override
            </button>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 14px', borderRadius: '12px',
            border: '1px solid var(--border-color)',
            background: provider ? `${provider.color}0c` : 'var(--bg-tertiary)',
            flexWrap: 'wrap',
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: provider ? `inset 0 0 20px ${provider.color}05` : 'none'
          }}>
            <div style={{ 
              width: '24px', height: '24px', borderRadius: '8px', 
              background: provider ? `${provider.color}20` : 'var(--bg-secondary)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center' 
            }}>
              <ProviderDot color={provider?.color || 'var(--text-tertiary)'} size={10} pulsing={!!provider} />
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: provider?.color || 'var(--text-secondary)', letterSpacing: '-0.01em' }}>
                {provider ? provider.name : (apiKey ? 'Unrecognized pattern' : 'Awaiting credentials')}
              </div>
              {provider?.link && (
                <motion.a
                  whileHover={{ scale: 1.05, background: provider.color, color: '#fff' }}
                  href={provider.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: '11px',
                    color: provider.color,
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: '10px',
                    background: 'var(--bg-secondary)',
                    border: `1px solid ${provider.color}40`,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em'
                  }}
                >
                  Acquire Key <ExternalLink size={11} strokeWidth={2.5} />
                </motion.a>
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
                <div style={{ padding: '8px 4px' }}>
                  <ProviderGrid selected={provider} onSelect={p => { handleProviderSelect(p); setShowPicker(false); }} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Responsive Grid for Model and Label */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
          gap: '12px',
          position: 'relative', zIndex: 1
        }}>
          <div>
            <label style={labelStyle}>Execution Model</label>
            <input
              type="text"
              value={model}
              onChange={e => setModel(e.target.value)}
              placeholder={provider?.defaultModel || 'gpt-4o'}
              style={{ ...inputBase, padding: '10px 12px', borderRadius: '12px', fontWeight: 600, fontFamily: '"Geist Mono", monospace' }}
            />
          </div>
          <div>
            <label style={labelStyle}>Workspace Label</label>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder={provider ? `${provider.name} Primary` : 'Personal Key'}
              style={{ ...inputBase, padding: '10px 12px', borderRadius: '12px', fontWeight: 600 }}
            />
          </div>
        </div>

        <AnimatePresence>
          {provider?.id === 'custom' && (
            <motion.div initial={{ opacity: 0, y: -10, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: -10, height: 0 }} style={{ overflow: 'hidden' }}>
              <div style={{ paddingTop: '4px' }}>
                <label style={labelStyle}>Proxy / Gateway Endpoint</label>
                <div style={{ position: 'relative' }}>
                  <Globe size={18} strokeWidth={2} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', opacity: 0.6 }} />
                  <input
                    type="text"
                    value={baseUrl}
                    onChange={e => setBaseUrl(e.target.value)}
                    placeholder="https://your-proxy.com/v1"
                    style={{ ...inputBase, padding: '14px 16px', paddingLeft: '48px', borderRadius: '14px', fontFamily: '"Geist Mono", monospace', fontWeight: 500 }}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {validationResult && (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.96, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              style={{
                display: 'flex', flexDirection: 'column', gap: '10px',
                padding: '14px 18px', borderRadius: '14px',
                background: validationResult.valid ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                border: `1.5px solid ${validationResult.valid ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                boxShadow: validationResult.valid ? '0 12px 30px rgba(16,185,129,0.1)' : '0 12px 30px rgba(239,68,68,0.1)',
                position: 'relative', zIndex: 1
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ 
                  width: '26px', height: '26px', borderRadius: '8px', 
                  background: validationResult.valid ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {validationResult.valid
                    ? <CheckCircle size={14} color="#10b981" strokeWidth={3} />
                    : <XCircle size={14} color="#ef4444" strokeWidth={3} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', color: validationResult.valid ? '#10b981' : '#ef4444', fontWeight: 700, letterSpacing: '-0.01em' }}>
                    {validationResult.valid ? 'Connectivity Verified' : 'Validation Failed'}
                  </div>
                  <div style={{ fontSize: '11px', color: validationResult.valid ? '#10b981' : '#ef4444', opacity: 0.8, fontWeight: 500, marginTop: '2px' }}>
                    {validationResult.valid
                      ? `Latency: ${validationResult.latency}ms — ready for deployment.`
                      : validationResult.error}
                  </div>
                </div>
              </div>
              
              {/* Auto-Correction Engine UI */}
              {!validationResult.valid && validationResult.suggestions?.length > 0 && (
                <div style={{ marginTop: '8px', paddingTop: '16px', borderTop: '1px dashed rgba(239,68,68,0.25)' }}>
                  <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
                    REPAIR SUGGESTIONS
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                    {validationResult.suggestions.map(s => (
                      <motion.button
                        key={s}
                        whileHover={{ scale: 1.04, background: 'rgba(239,68,68,0.18)' }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => {
                          setModel(s);
                          setValidationResult(null);
                        }}
                        style={{
                          background: 'rgba(239,68,68,0.1)',
                          border: '1px solid rgba(239,68,68,0.35)',
                          color: '#ef4444',
                          padding: '8px 16px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: '8px',
                          transition: 'all 0.2s',
                          letterSpacing: '0.02em'
                        }}
                      >
                        <Zap size={13} strokeWidth={2.5} /> USE {s.toUpperCase()}
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
          {error && <ValidationError message={error} />}
        </AnimatePresence>

        {/* Responsive Action Core */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '16px',
          marginTop: '8px',
          position: 'relative', zIndex: 1
        }}>
            <motion.button
            whileHover={canValidate ? { scale: 1.02, background: 'var(--bg-primary)' } : {}}
            whileTap={canValidate ? { scale: 0.98 } : {}}
            onClick={handleValidate}
            disabled={!canValidate}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '14px',
              border: canValidate ? '1.5px solid var(--text-primary)' : '1px solid var(--border-color)',
              background: 'var(--bg-tertiary)',
              color: canValidate ? 'var(--text-primary)' : 'var(--text-tertiary)',
              fontSize: '12px', fontWeight: 700,
              cursor: canValidate ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              opacity: canValidate ? 1 : 0.5,
              textTransform: 'uppercase', letterSpacing: '0.04em'
            }}
          >
            {isValidating
              ? <Activity size={15} strokeWidth={2.5} style={{ animation: 'spin 1.2s linear infinite' }} />
              : <Zap size={15} strokeWidth={2.5} />}
            {isValidating ? 'VALIDATING…' : 'TEST CONNECTION'}
          </motion.button>

            <motion.button
            whileHover={canSave ? { scale: 1.02, filter: 'brightness(1.1)', boxShadow: '0 12px 30px rgba(0,0,0,0.25)' } : {}}
            whileTap={canSave ? { scale: 0.98 } : {}}
            onClick={handleSave}
            disabled={!canSave}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '14px',
              border: 'none',
              background: canSave ? 'var(--text-primary)' : 'var(--bg-tertiary)',
              color: canSave ? 'var(--bg-primary)' : 'var(--text-tertiary)',
              fontSize: '12px', fontWeight: 700,
              cursor: canSave ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              boxShadow: canSave ? '0 8px 24px rgba(0,0,0,0.15)' : 'none',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              opacity: canSave ? 1 : 0.5,
              textTransform: 'uppercase', letterSpacing: '0.05em'
            }}
          >
            <CheckCircle size={15} strokeWidth={3} />
            AUTHORIZE & BIND
          </motion.button>
        </div>

        <button
          onClick={onCancel}
          style={{ 
            background: 'none', border: 'none', color: 'var(--text-tertiary)', 
            fontSize: '11px', fontWeight: 600, cursor: 'pointer', 
            textAlign: 'center', transition: 'all 0.2s', opacity: 0.6,
            letterSpacing: '0.02em'
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.opacity = '1'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.opacity = '0.6'; }}
        >
          Dismiss Setup
        </button>
      </div>

      <AnimatePresence>
        {showDirectory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 100005,
              background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(16px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
            }}
            onClick={() => setShowDirectory(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 30 }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              style={{
                background: 'var(--bg-primary)', borderRadius: '32px',
                width: '100%', maxWidth: '560px', maxHeight: '85vh',
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
                boxShadow: '0 40px 100px rgba(0,0,0,0.5), inset 0 0 0 1px var(--border-color)',
                border: '1px solid rgba(255,255,255,0.05)',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ 
                padding: '28px 32px', 
                borderBottom: '1px solid var(--border-color)', 
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                background: 'var(--bg-secondary)',
                position: 'relative'
              }}>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Intelligence Index</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px', fontWeight: 500 }}>Global Directory of Supported AI Providers</div>
                </div>
                <motion.button 
                  whileHover={{ scale: 1.1, background: 'var(--bg-tertiary)', color: '#ef4444' }} whileTap={{ scale: 0.9 }}
                  onClick={() => setShowDirectory(false)} 
                  style={{ 
                    background: 'transparent', border: '1px solid var(--border-color)', 
                    padding: '10px', borderRadius: '14px', cursor: 'pointer', 
                    color: 'var(--text-secondary)', display: 'flex', transition: 'all 0.2s' 
                  }}
                >
                  <X size={20} strokeWidth={2.5} />
                </motion.button>
              </div>

              <div style={{ 
                overflowY: 'auto', padding: '20px 32px 32px', 
                display: 'flex', flexDirection: 'column', gap: '12px',
                scrollbarWidth: 'none'
              }} className="no-scrollbar">
                {[...PROVIDERS]
                  .filter(p => p.id !== 'custom')
                  .sort((a, b) => (a.price || 0) - (b.price || 0))
                  .map(p => (
                    <motion.div 
                      key={p.id} 
                      whileHover={{ scale: 1.02, background: `${p.color}08`, border: `1px solid ${p.color}40` }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '20px',
                        padding: '18px 24px', borderRadius: '24px',
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        cursor: 'default'
                      }}
                    >
                      <div style={{ 
                        width: '42px', height: '42px', borderRadius: '14px', 
                        background: `${p.color}15`, display: 'flex', alignItems: 'center', 
                        justifyContent: 'center', boxShadow: `0 4px 12px ${p.color}10` 
                      }}>
                        <ProviderDot color={p.color} size={14} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{p.name}</div>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                          {p.price === 0 ? (
                            <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '8px', background: '#10b98115', color: '#10b981', fontWeight: 700, letterSpacing: '0.06em' }}>FREE TIER</span>
                          ) : (
                            <span style={{ fontSize: '10px', padding: '3px 8px', borderRadius: '8px', background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)', fontWeight: 700, letterSpacing: '0.06em' }}>PREMIUM API</span>
                          )}
                          <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--text-tertiary)', opacity: 0.3 }} />
                          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: '"Geist Mono", monospace', fontWeight: 600 }}>{p.hint}</span>
                        </div>
                      </div>
                      {p.link && (
                        <motion.a 
                          whileHover={{ scale: 1.06, background: 'var(--text-primary)', color: 'var(--bg-primary)' }}
                          href={p.link} target="_blank" rel="noopener noreferrer" 
                          style={{
                            padding: '12px 18px', borderRadius: '14px', background: 'var(--bg-tertiary)',
                            color: 'var(--text-primary)', textDecoration: 'none', fontSize: '12px', fontWeight: 700,
                            display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--border-color)',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', letterSpacing: '0.02em',
                            textTransform: 'uppercase'
                          }}
                        >
                          KEYS <ExternalLink size={14} strokeWidth={2.5} />
                        </motion.a>
                      )}
                    </motion.div>
                  ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } } 
        @keyframes pulse-ring { 
          0% { opacity: 0.6; transform: scale(1); } 
          50% { opacity: 0; transform: scale(1.8); } 
          100% { opacity: 0; transform: scale(1.8); } 
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </motion.div>
  );
}
