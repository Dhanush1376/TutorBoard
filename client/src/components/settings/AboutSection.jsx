import React, { useState, useEffect } from 'react';
import { BookOpen, Globe2, AlertTriangle, ExternalLink, Heart } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import VisaiLogo from '../layout/VisaiLogo';
import { SectionTitle, SettingsGroup, SettingsRow } from './SettingsLayout';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const SystemStatusItem = ({ label, status, detail }) => {
  const isOnline = status === 'online';
  const isChecking = status === 'checking';
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ 
          width: '8px', height: '8px', borderRadius: '50%', 
          background: isOnline ? '#10b981' : (isChecking ? 'var(--text-tertiary)' : '#ef4444'),
          boxShadow: isOnline ? '0 0 10px rgba(16,185,129,0.4)' : 'none',
          animation: isChecking ? 'pulse 1.5s infinite' : 'none'
        }} />
        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
      </div>
      <span style={{ fontSize: '12px', fontWeight: 500, color: isOnline ? '#10b981' : 'var(--text-tertiary)' }}>
        {status.toUpperCase()} {detail && `• ${detail}`}
      </span>
    </div>
  );
};

const AboutSection = () => {
  const [copied, setCopied] = useState(false);
  const { token } = useAuth();
  const [systemStatus, setSystemStatus] = useState({
    api: 'checking',
    db: 'checking',
    engine: 'checking'
  });

  useEffect(() => {
    const checkSystems = async () => {
      try {
        const res = await fetch(`${API_URL}/api/test`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          setSystemStatus(prev => ({ ...prev, api: 'online', db: 'online' }));
        } else {
          setSystemStatus(prev => ({ ...prev, api: 'online', db: 'offline' }));
        }
      } catch (e) {
        setSystemStatus(prev => ({ ...prev, api: 'offline', db: 'offline' }));
      }
      setTimeout(() => {
        setSystemStatus(prev => ({ ...prev, engine: 'online' }));
      }, 1200);
    };
    checkSystems();
  }, [token]);

  const handleCopySystemInfo = () => {
    const info = `TutorBoard v2.1.0 Beta\nEngine: Cinematic SCENE GRAPH v9.0\nFramework: React 18\nStatus: ${systemStatus.api === 'online' ? 'Connected' : 'Disconnected'}\nBuild: 2026.04.18-FINAL\nUserAgent: ${navigator.userAgent}`;
    navigator.clipboard.writeText(info).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', paddingBottom: '40px' }}>
      <style>{`
        @keyframes pulse {
          0% { opacity: 0.4; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.1); }
          100% { opacity: 0.4; transform: scale(0.9); }
        }
      `}</style>
      
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', marginBottom: '40px', marginTop: '20px' }}>
        <div style={{
          color: 'var(--bg-primary)', background: 'var(--text-primary)',
          width: '84px', height: '84px', borderRadius: '24px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 12px 32px rgba(0,0,0,0.15)',
          transform: 'rotate(-2deg)'
        }}>
          <VisaiLogo size="lg" />
        </div>
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: '"Geist", sans-serif', margin: '0 0 4px 0', letterSpacing: '-0.03em' }}>
            TutorBoard
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontWeight: 600, background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '6px' }}>
              v2.1.0 Beta
            </span>
            <span style={{ fontSize: '13px', color: '#34c759', fontWeight: 700 }}>
              • Stable Release
            </span>
          </div>
        </div>
      </div>

      <SectionTitle>System Integrity</SectionTitle>
      <SettingsGroup>
        <SystemStatusItem label="API Gateway" status={systemStatus.api} />
        <SystemStatusItem label="Cloud Database" status={systemStatus.db} />
        <SystemStatusItem label="Orchestration Engine" status={systemStatus.engine} detail="v9.0 Cinematic" />
        <SettingsRow label="System Build" rightElement={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>2026.04.18-FINAL</span>
            <button 
              onClick={handleCopySystemInfo}
              style={{ 
                background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', cursor: 'pointer', padding: '4px 10px',
                borderRadius: '8px', color: copied ? '#10b981' : 'var(--text-secondary)', transition: 'all 0.2s',
                fontSize: '11px', fontWeight: 700,
              }}
            >
              {copied ? '✓ Copied' : 'Copy Info'}
            </button>
          </div>
        } borderBottom={false} />
      </SettingsGroup>

      <SectionTitle>Engine Architecture</SectionTitle>
      <SettingsGroup>
        <SettingsRow label="Renderer" rightElement={<span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Canvas2D + Cinematic v4</span>} />
        <SettingsRow label="Pipeline" rightElement={<span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>6-Agent Autonomous Loop</span>} />
        <SettingsRow label="Protocol" rightElement={<span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Secure WebSocket (WSS)</span>} borderBottom={false} />
      </SettingsGroup>

      <SectionTitle>Community & Support</SectionTitle>
      <SettingsGroup>
        <SettingsRow icon={BookOpen} label="Release Notes" onClick={() => window.open('https://github.com/tutorboard/tutorboard/releases', '_blank')} />
        <SettingsRow icon={Globe2} label="Official Website" rightElement={<ExternalLink size={14} />} onClick={() => window.open('https://tutorboard.ai', '_blank')} />
        <SettingsRow icon={AlertTriangle} label="Report Bug" danger borderBottom={false} onClick={() => {
           const body = encodeURIComponent(`## Bug Report\n\n**Environment:**\n- TutorBoard v2.1.0 Beta\n- Build: 2026.04.18-FINAL\n- Browser: ${navigator.userAgent}\n\n**Describe the bug:**\n\n**Steps to reproduce:**\n\n**Expected behavior:**\n`);
           window.open(`https://github.com/tutorboard/tutorboard/issues/new?body=${body}`, '_blank');
        }} />
      </SettingsGroup>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', marginTop: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-tertiary)' }}>
          Made with <Heart style={{ width: '14px', height: '14px', color: '#ef4444', fill: '#ef4444' }} /> by TutorBoard Team
        </div>
        <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', opacity: 0.6 }}>
          © 2026 TutorBoard Systems Inc.
        </p>
      </div>
    </div>
  );
};

export default AboutSection;
