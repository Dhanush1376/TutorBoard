import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Zap, Shield, Activity, Globe, Cpu, Layers, Sparkles,
  MessageCircle, FileText, Code, RefreshCw, ChevronRight,
  Check, ShieldAlert, BookOpen
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import VisaiLogo from '../layout/VisaiLogo';
import { SectionTitle, SettingsGroup, SettingsRow } from './SettingsShared';

import { BASE_URL as API_URL } from '../../services/api';

const APP_VERSION = '2.1.0';
const BUILD_NUMBER = 'TB-2026-0422-REL';

// ─── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  online: { color: '#10b981', label: 'Online' },
  offline: { color: '#ef4444', label: 'Offline' },
  checking: { color: '#fbbf24', label: 'Checking' },
};

function StatusDot({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.checking;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '5px',
      padding: '3px 8px', borderRadius: '6px',
      background: `${cfg.color}12`,
    }}>
      <motion.div
        animate={status === 'checking' ? { opacity: [1, 0.3, 1] } : {}}
        transition={{ repeat: Infinity, duration: 1.2 }}
        style={{ width: '5px', height: '5px', borderRadius: '50%', background: cfg.color, flexShrink: 0 }}
      />
      <span style={{ fontSize: '10px', fontWeight: 500, color: cfg.color }}>
        {cfg.label}
      </span>
    </div>
  );
}

// ─── System Health Banner ─────────────────────────────────────────────────

function SystemHealthBanner({ statuses }) {
  const values = Object.values(statuses);
  const anyOffline = values.some(s => s === 'offline');
  const checking = values.some(s => s === 'checking');

  const state = checking ? 'checking' : anyOffline ? 'degraded' : 'healthy';
  const map = {
    healthy: { icon: Check, color: '#10b981', bg: 'rgba(16,185,129,0.05)', text: 'All systems operational' },
    degraded: { icon: ShieldAlert, color: '#f59e0b', bg: 'rgba(245,158,11,0.05)', text: 'Some services degraded' },
    checking: { icon: RefreshCw, color: 'var(--text-tertiary)', bg: 'var(--bg-secondary)', text: 'Checking status...' },
  };
  const cfg = map[state];
  const Icon = cfg.icon;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '8px 12px', borderRadius: '10px',
      background: cfg.bg, border: '1px solid var(--border-color)',
      marginBottom: '16px',
    }}>
      <Icon size={12} strokeWidth={2.5} style={{ color: cfg.color }} className={state === 'checking' ? 'animate-spin' : ''} />
      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 400 }}>{cfg.text}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AboutSection() {
  const { token } = useAuth();
  const [systemStatus, setSystemStatus] = useState({
    api: 'checking',
    database: 'checking',
    ai: 'online',
  });
  const [lastChecked, setLastChecked] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const checkStatus = async () => {
    setRefreshing(true);
    setSystemStatus(prev => ({ ...prev, api: 'checking', database: 'checking' }));
    try {
      const res = await fetch(`${API_URL}/api/test`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const ok = res.ok;
      setSystemStatus(prev => ({
        ...prev,
        api: ok ? 'online' : 'offline',
        database: ok ? 'online' : 'offline',
      }));
      setLastChecked(new Date());
    } catch {
      setSystemStatus(prev => ({ ...prev, api: 'offline', database: 'offline' }));
    } finally {
      setTimeout(() => setRefreshing(false), 600);
    }
  };

  useEffect(() => {
    if (token) checkStatus();
  }, [token]);

  const timeAgo = lastChecked
    ? `${Math.round((Date.now() - lastChecked) / 1000)}s ago`
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* App Header */}
      <div style={{ textAlign: 'center', padding: '24px 0 20px' }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: '14px',
          background: 'var(--text-primary)',
          margin: '0 auto 12px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <VisaiLogo size="sm" className="text-[var(--bg-primary)]" />
        </div>

        <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
          TutorBoard AI
        </h1>
        <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: 0, fontWeight: 400 }}>
          Version {APP_VERSION}
        </p>
      </div>

      {/* System Health Banner */}
      <SystemHealthBanner statuses={systemStatus} />

      {/* System Status */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <SectionTitle style={{ margin: 0 }}>Infrastructure</SectionTitle>
          <button
            onClick={checkStatus}
            disabled={refreshing}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              fontSize: '10px', color: 'var(--text-tertiary)',
              fontWeight: 500,
              background: 'none', border: 'none', 
              cursor: 'pointer', padding: '4px 8px', borderRadius: '6px',
              transition: 'all 0.12s',
              opacity: refreshing ? 0.5 : 0.7,
            }}
          >
            <motion.div animate={refreshing ? { rotate: 360 } : {}} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
              <RefreshCw size={10} strokeWidth={2} />
            </motion.div>
            {refreshing ? 'Checking' : timeAgo ? `Checked ${timeAgo}` : 'Check'}
          </button>
        </div>

        <SettingsGroup>
          <SettingsRow
            icon={Code}
            label="API"
            description="Edge endpoints"
            rightElement={<StatusDot status={systemStatus.api} />}
          />
          <SettingsRow
            icon={Shield}
            label="Database"
            description="Encrypted storage"
            rightElement={<StatusDot status={systemStatus.database} />}
          />
          <SettingsRow
            icon={Sparkles}
            label="AI Engine"
            description="Inference pipeline"
            rightElement={<StatusDot status={systemStatus.ai} />}
            borderBottom={false}
          />
        </SettingsGroup>
      </div>

      {/* Core Technologies */}
      <div>
        <SectionTitle>Platform</SectionTitle>
        <SettingsGroup>
          <SettingsRow
            icon={Cpu}
            label="Pedagogical AI"
            description="Multi-agent pipeline that adapts to your style"
          />
          <SettingsRow
            icon={Layers}
            label="Interactive Canvas"
            description="Hardware-accelerated visual workspace"
          />
          <SettingsRow
            icon={BookOpen}
            label="Domain Intelligence"
            description="Specialized reasoning for 24+ subjects"
          />
          <SettingsRow
            icon={Globe}
            label="Cloud Sync"
            description="Cross-device persistence"
            borderBottom={false}
          />
        </SettingsGroup>
      </div>

      {/* Version Info */}
      <div>
        <SectionTitle>Build</SectionTitle>
        <SettingsGroup>
          <SettingsRow
            icon={Activity}
            label="Version"
            rightElement={<span style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600, fontFamily: '"Geist Mono", monospace' }}>{APP_VERSION}</span>}
          />
          <SettingsRow
            icon={Zap}
            label="Build"
            rightElement={<span style={{ color: 'var(--text-tertiary)', fontSize: '11px', fontWeight: 400, fontFamily: '"Geist Mono", monospace' }}>{BUILD_NUMBER}</span>}
            borderBottom={false}
          />
        </SettingsGroup>
      </div>

      {/* Resources */}
      <div>
        <SectionTitle>Resources</SectionTitle>
        <SettingsGroup>
          <SettingsRow
            icon={FileText}
            label="Documentation"
            onClick={() => window.open('https://docs.tutorboard.ai', '_blank')}
            rightElement={<ChevronRight size={14} style={{ color: 'var(--text-tertiary)', opacity: 0.3 }} />}
          />
          <SettingsRow
            icon={MessageCircle}
            label="Community"
            onClick={() => window.open('https://discord.gg/tutorboard', '_blank')}
            rightElement={<ChevronRight size={14} style={{ color: 'var(--text-tertiary)', opacity: 0.3 }} />}
            borderBottom={false}
          />
        </SettingsGroup>
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', paddingTop: '8px', opacity: 0.4 }}>
        <p style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontWeight: 400, letterSpacing: '0.03em' }}>
          2026 TutorBoard AI
        </p>
      </div>

    </div>
  );
}