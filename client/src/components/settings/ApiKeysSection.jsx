import React, { useState, useEffect, useCallback } from 'react';
import { Key, Sparkles, Check, ChevronRight, X, Trash2, Power, PowerOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { SectionTitle, SettingsGroup, SettingsRow, RightInlineInput } from './SettingsLayout';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const PROVIDER_INFO = {
  openai: { name: 'OpenAI', color: '#10a37f', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o3-mini'] },
  deepseek: { name: 'DeepSeek', color: '#4d6cfa', models: ['deepseek-chat', 'deepseek-reasoner'] },
  google: { name: 'Google Gemini', color: '#4285f4', models: ['gemini-1.5-pro', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'] },
  anthropic: { name: 'Anthropic', color: '#d97757', models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022', 'claude-3-haiku-20240307'] },
  custom: { name: 'Custom API', color: '#8b5cf6', models: [] },
};

const MODEL_LABELS = {
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o Mini',
  'gpt-4-turbo': 'GPT-4 Turbo',
  'o3-mini': 'o3-mini (Reasoning)',
  'deepseek-chat': 'DeepSeek V3',
  'deepseek-reasoner': 'DeepSeek R1 (Reasoning)',
  'gemini-1.5-pro': 'Gemini 1.5 Pro',
  'gemini-2.0-flash': 'Gemini 2.0 Flash',
  'gemini-2.0-flash-lite': 'Gemini 2.0 Flash Lite',
  'claude-sonnet-4-20250514': 'Claude Sonnet 4',
  'claude-3-5-haiku-20241022': 'Claude 3.5 Haiku',
  'claude-3-haiku-20240307': 'Claude 3 Haiku',
};

const UniversalUsageCard = ({ usage }) => {
  if (!usage) return null;
  const isWarning = usage.percent >= 80;
  const isExceeded = usage.percent >= 100;
  
  return (
    <div style={{ 
      background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', 
      padding: '20px', marginBottom: '24px', overflow: 'hidden', position: 'relative',
      boxShadow: '0 4px 12px rgba(139, 92, 246, 0.05)'
    }}>
      <div style={{ position: 'absolute', top: 0, right: 0, padding: '6px 12px', background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', fontSize: '10px', fontWeight: 700, borderRadius: '0 0 0 12px' }}>
        SYSTEM PROVIDED
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6' }}>
          <Sparkles size={20} />
        </div>
        <div>
          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>TutorBoard Universal API</h4>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-tertiary)' }}>Platform credits for common tasks</p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <div style={{ flex: 1, height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ 
            width: `${Math.min(usage.percent, 100)}%`, height: '100%', 
            background: isExceeded ? '#ef4444' : (isWarning ? '#f59e0b' : '#10b981'),
            transition: 'width 0.5s ease'
          }} />
        </div>
        <span style={{ fontSize: '12px', fontWeight: 700, minWidth: '36px', textAlign: 'right', color: isExceeded ? '#ef4444' : 'var(--text-primary)' }}>
          {Math.round(usage.percent)}%
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-tertiary)' }}>
        <span>{usage.used} / {usage.limit} requests</span>
        <span>{isExceeded ? 'Limit Reached' : 'Resets monthly'}</span>
      </div>
    </div>
  );
};

const ApiKeysSection = ({ showToast }) => {
  const { token } = useAuth();
  const [keys, setKeys] = useState([]);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState(null);
  const [newValue, setNewValue] = useState('');

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/apikeys`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setKeys(data.keys || []);
        setUsage(data.usage);
      }
    } catch (err) {
      console.error('Failed to fetch API keys:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleUpdate = async (provider, value) => {
    try {
      const res = await fetch(`${API_URL}/api/apikeys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ provider, key: value })
      });
      if (res.ok) {
        showToast('API Key updated successfully', 'success');
        fetchKeys();
        setEditingKey(null);
        setNewValue('');
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to update key', 'error');
      }
    } catch (err) {
      showToast('Network error', 'error');
    }
  };

  const handleDelete = async (provider) => {
    if (!window.confirm(`Remove ${PROVIDER_INFO[provider]?.name || provider} API key?`)) return;
    try {
      const res = await fetch(`${API_URL}/api/apikeys/${provider}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('API Key removed', 'success');
        fetchKeys();
      }
    } catch (err) {
      showToast('Network error', 'error');
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading configuration...</div>;

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
      <UniversalUsageCard usage={usage} />

      <SectionTitle>Custom API Providers</SectionTitle>
      <SettingsGroup>
        {Object.keys(PROVIDER_INFO).filter(p => p !== 'custom').map(provider => {
          const info = PROVIDER_INFO[provider];
          const existing = keys.find(k => k.provider === provider);
          const isEditing = editingKey === provider;

          return (
            <div key={provider} style={{ borderBottom: '1px solid var(--border-color)', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isEditing ? '16px' : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ 
                    width: '32px', height: '32px', borderRadius: '8px', 
                    background: info.color, color: '#fff', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center' 
                  }}>
                    <Key size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{info.name}</div>
                    <div style={{ fontSize: '12px', color: existing ? '#10b981' : 'var(--text-tertiary)' }}>
                      {existing ? `Masked: ${existing.maskedKey}` : 'No key configured'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {existing && !isEditing && (
                    <button 
                      onClick={() => handleDelete(provider)}
                      style={{ padding: '6px', borderRadius: '6px', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      if (isEditing) {
                        handleUpdate(provider, newValue);
                      } else {
                        setEditingKey(provider);
                        setNewValue('');
                      }
                    }}
                    style={{ 
                      padding: '6px 14px', borderRadius: '8px', 
                      background: isEditing ? 'var(--text-primary)' : 'var(--bg-tertiary)', 
                      color: isEditing ? 'var(--bg-primary)' : 'var(--text-primary)',
                      fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer' 
                    }}
                  >
                    {isEditing ? 'Save' : (existing ? 'Update' : 'Configure')}
                  </button>
                  {isEditing && (
                    <button 
                      onClick={() => setEditingKey(null)}
                      style={{ padding: '6px', borderRadius: '6px', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
              </div>
              
              {isEditing && (
                <input 
                  autoFocus
                  type="password"
                  value={newValue}
                  onChange={e => setNewValue(e.target.value)}
                  placeholder={`Paste your ${info.name} API Key here...`}
                  style={{ 
                    width: '100%', padding: '10px 14px', borderRadius: '10px', 
                    background: 'var(--bg-primary)', border: '1px solid var(--text-primary)',
                    color: 'var(--text-primary)', fontSize: '14px', outline: 'none'
                  }}
                />
              )}
            </div>
          );
        })}
      </SettingsGroup>
      
      <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center', marginTop: '16px', lineHeight: 1.5 }}>
        API keys are encrypted at rest and never exposed to the frontend after configuration.<br />
        TutorBoard uses your custom keys to bypass platform limits.
      </p>
    </div>
  );
};

export default ApiKeysSection;
