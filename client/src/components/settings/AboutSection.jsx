import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Shield, Activity, Globe, Cpu, Layers, Sparkles,
  MessageCircle, FileText, Code, RefreshCw, ChevronRight,
  Heart, BookOpen
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import VisaiLogo from '../layout/VisaiLogo';
import { SectionTitle, SettingsGroup, SettingsRow } from './SettingsShared';

import { BASE_URL as API_URL } from '../../services/api';

const APP_VERSION = '2.1.0';
const BUILD_NUMBER = 'TB-2026-0422-REL';

// ─── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  online: { color: '#10b981', bg: 'rgba(16,185,129,0.1)', label: 'Online' },
  offline: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', label: 'Offline' },
  checking: { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', label: 'Checking' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.checking;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '4px 10px', borderRadius: '20px',
      background: cfg.bg, border: `1px solid ${cfg.color}22`,
    }}>
      <motion.div
        animate={status === 'checking' ? { opacity: [1, 0.3, 1] } : {}}
        transition={{ repeat: Infinity, duration: 1.2 }}
        style={{ width: '6px', height: '6px', borderRadius: '50%', background: cfg.color, flexShrink: 0 }}
      />
      <span style={{ fontSize: '11px', fontWeight: 500, color: cfg.color, letterSpacing: '0.04em' }}>
        {cfg.label}
      </span>
    </div>
  );
}

// ─── Overall health indicator ─────────────────────────────────────────────────

function SystemHealthBanner({ statuses }) {
  const values = Object.values(statuses);
  const allOnline = values.every(s => s === 'online');
  const anyOffline = values.some(s => s === 'offline');
  const checking = values.some(s => s === 'checking');

  const state = checking ? 'checking' : anyOffline ? 'degraded' : 'healthy';
  const map = {
    healthy: { icon: '●', color: '#10b981', bg: 'rgba(16,185,129,0.06)', border: 'rgba(16,185,129,0.15)', text: 'All systems operational' },
    degraded: { icon: '▲', color: '#f59e0b', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.15)', text: 'Some services degraded' },
    checking: { icon: '◌', color: 'var(--text-tertiary)', bg: 'var(--bg-secondary)', border: 'var(--border-color)', text: 'Checking system status…' },
  };
  const cfg = map[state];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 14px', borderRadius: '12px',
        background: cfg.bg, border: `1px solid ${cfg.border}`,
        marginBottom: '20px',
      }}
    >
      <span style={{ fontSize: '10px', color: cfg.color }}>{cfg.icon}</span>
      <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 400 }}>{cfg.text}</span>
    </motion.div>
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
    ? `Verified ${Math.round((Date.now() - lastChecked) / 1000)}s ago`
    : null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ maxWidth: '640px', margin: '0 auto', paddingBottom: '20px' }}
    >

      {/* ── App Header — Premium Branding ──────────────────────────────── */}
      <div style={{ textAlign: 'center', padding: '40px 0 32px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)', width: '160px', height: '160px', background: 'radial-gradient(circle, var(--accent-primary)08, transparent 70%)', pointerEvents: 'none' }} />
        
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          style={{
            width: '64px', height: '64px', borderRadius: '18px',
            background: 'var(--text-primary)',
            margin: '0 auto 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 12px 32px rgba(0,0,0,0.15)',
            position: 'relative',
            zIndex: 1
          }}
        >
          <VisaiLogo size="md" className="text-[var(--bg-primary)]" />
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
            transition={{ repeat: Infinity, duration: 3 }}
            style={{ position: 'absolute', inset: -8, borderRadius: '28px', border: '2px solid var(--text-primary)', opacity: 0.1 }}
          />
        </motion.div>

        <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px', letterSpacing: '-0.03em' }}>
          TutorBoard AI
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', margin: '0 0 20px', fontWeight: 500 }}>
          Version {APP_VERSION} · <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>CINEMATIC</span>
        </p>

        {/* Community Tag */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '6px 16px', borderRadius: '24px',
          background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
        }}>
          <Heart size={12} style={{ color: '#f43f5e' }} fill="#f43f5e" />
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.01em' }}>
            Built for learners everywhere
          </span>
        </div>
      </div>

      {/* ── System Health Banner ─────────────────────────────────────── */}
      <SystemHealthBanner statuses={systemStatus} />

      {/* ── System Status ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <SectionTitle style={{ margin: 0 }}>Cloud Infrastructure</SectionTitle>
        <button
          onClick={checkStatus}
          disabled={refreshing}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: '11px', color: refreshing ? 'var(--accent-primary)' : 'var(--text-tertiary)',
            fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', 
            cursor: 'pointer', padding: '6px 12px', borderRadius: '10px',
            transition: 'all 0.2s',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
          }}
          onMouseEnter={e => !refreshing && (e.currentTarget.style.background = 'var(--bg-tertiary)')}
          onMouseLeave={e => !refreshing && (e.currentTarget.style.background = 'var(--bg-secondary)')}
        >
          <motion.div animate={refreshing ? { rotate: 360 } : {}} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
            <RefreshCw size={12} strokeWidth={2.5} />
          </motion.div>
          {refreshing ? 'Syncing…' : timeAgo ? 'Verified' : 'Verify'}
        </button>
      </div>

      <SettingsGroup>
        <SettingsRow
          icon={Code}
          label="API Orchestrator"
          description="High-performance edge endpoints"
          rightElement={<StatusBadge status={systemStatus.api} />}
        />
        <SettingsRow
          icon={Shield}
          label="Secure Vault"
          description="Encrypted session storage"
          rightElement={<StatusBadge status={systemStatus.database} />}
        />
        <SettingsRow
          icon={Sparkles}
          label="Inference Engine"
          description="Multi-model reasoning pipeline"
          rightElement={<StatusBadge status={systemStatus.ai} />}
          borderBottom={false}
        />
      </SettingsGroup>

      {/* ── Core Technologies ────────────────────────────────────────── */}
      <SectionTitle>Core Technologies</SectionTitle>
      <SettingsGroup>
        <SettingsRow
          icon={Cpu}
          label="Pedagogical Intelligence"
          description="6-agent AI pipeline that adapts to your learning style."
        />
        <SettingsRow
          icon={Layers}
          label="Accelerated Canvas"
          description="Hardware-boosted workspace for deep visual learning."
        />
        <SettingsRow
          icon={BookOpen}
          label="Domain Intelligence"
          description="Specialized reasoning tuned for 24+ academic subjects."
        />
        <SettingsRow
          icon={Globe}
          label="Global Continuum"
          description="Instant cross-device synchronization and persistence."
          borderBottom={false}
        />
      </SettingsGroup>

      {/* ── Intelligence Feed ────────────────────────────────────────── */}
      <SectionTitle>Platform Intelligence</SectionTitle>
      <SettingsGroup>
        <SettingsRow
          icon={Activity}
          label="Version Integrity"
          rightElement={<span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 700, background: 'var(--bg-tertiary)', padding: '4px 10px', borderRadius: '8px' }}>{APP_VERSION}</span>}
        />
        <SettingsRow
          icon={Zap}
          label="Build Signature"
          rightElement={<span style={{ color: 'var(--text-tertiary)', fontSize: '12px', fontWeight: 600, fontFamily: '"Geist Mono", monospace' }}>{BUILD_NUMBER}</span>}
          borderBottom={false}
        />
      </SettingsGroup>

      {/* ── Resources ─────────────────────────────────────────────────── */}
      <SectionTitle>Resources</SectionTitle>
      <SettingsGroup>
        <SettingsRow
          icon={FileText}
          label="Developer Docs"
          description="Technical guides and architectural overview"
          onClick={() => window.open('https://docs.tutorboard.ai', '_blank')}
          rightElement={<ChevronRight size={16} style={{ color: 'var(--text-tertiary)', opacity: 0.4 }} />}
        />
        <SettingsRow
          icon={MessageCircle}
          label="Join the Community"
          description="Collaborate with learners and developers"
          onClick={() => window.open('https://discord.gg/tutorboard', '_blank')}
          rightElement={<ChevronRight size={16} style={{ color: 'var(--text-tertiary)', opacity: 0.4 }} />}
          borderBottom={false}
        />
      </SettingsGroup>

      {/* Footer — Premium Refinement */}
      <div style={{ textAlign: 'center', marginTop: '40px', opacity: 0.6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}>
          <div style={{ width: '32px', height: '1px', background: 'var(--border-color)' }} />
          <VisaiLogo size="xxs" />
          <div style={{ width: '32px', height: '1px', background: 'var(--border-color)' }} />
        </div>
        <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          © 2026 TutorBoard AI · The Future of Learning
        </p>
      </div>

    </motion.div>
  );
}