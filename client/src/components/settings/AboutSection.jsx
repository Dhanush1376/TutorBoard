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

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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
        padding: '12px 16px', borderRadius: '14px',
        background: cfg.bg, border: `1px solid ${cfg.border}`,
        marginBottom: '28px',
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
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (token) checkStatus();
  }, [token]);

  const timeAgo = lastChecked
    ? `Checked ${Math.round((Date.now() - lastChecked) / 1000)}s ago`
    : null;

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', paddingBottom: '80px' }}>

      {/* ── App Header ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ textAlign: 'center', padding: '40px 0 36px' }}
      >
        <motion.div
          initial={{ scale: 0.88, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
          style={{
            width: '76px', height: '76px', borderRadius: '22px',
            background: 'var(--text-primary)',
            margin: '0 auto 18px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 12px 28px rgba(0,0,0,0.12)',
          }}
        >
          <VisaiLogo size="md" className="text-[var(--bg-primary)]" />
        </motion.div>

        <h1 style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 4px' }}>
          TutorBoard AI
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: '0 0 16px' }}>
          Version {APP_VERSION} · Cinematic
        </p>

        {/* Built with tag */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          padding: '5px 12px', borderRadius: '20px',
          background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
        }}>
          <Heart size={11} style={{ color: '#f43f5e' }} />
          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
            Built for learners everywhere
          </span>
        </div>
      </motion.div>

      {/* ── System Health Banner ─────────────────────────────────────── */}
      <SystemHealthBanner statuses={systemStatus} />

      {/* ── System Status ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <SectionTitle style={{ margin: 0 }}>System Status</SectionTitle>
        <button
          onClick={checkStatus}
          disabled={refreshing}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            fontSize: '11px', color: 'var(--text-tertiary)',
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '4px 8px', borderRadius: '8px',
            opacity: refreshing ? 0.5 : 1, transition: 'opacity 0.2s',
          }}
        >
          <motion.div animate={refreshing ? { rotate: 360 } : {}} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}>
            <RefreshCw size={12} />
          </motion.div>
          {timeAgo || 'Refresh'}
        </button>
      </div>

      <SettingsGroup>
        <SettingsRow
          icon={Code}
          label="API Service"
          description="REST endpoints and authentication"
          rightElement={<StatusBadge status={systemStatus.api} />}
        />
        <SettingsRow
          icon={Shield}
          label="Database"
          description="Session storage and user data"
          rightElement={<StatusBadge status={systemStatus.database} />}
        />
        <SettingsRow
          icon={Sparkles}
          label="AI Engine"
          description="Multi-agent reasoning pipeline"
          rightElement={<StatusBadge status={systemStatus.ai} />}
          borderBottom={false}
        />
      </SettingsGroup>

      {/* ── What's inside ────────────────────────────────────────────── */}
      <SectionTitle>What Powers TutorBoard</SectionTitle>
      <SettingsGroup>
        <SettingsRow
          icon={Cpu}
          label="Pedagogical Engine"
          description="6-agent AI pipeline that plans, explains, and adapts to how you learn."
        />
        <SettingsRow
          icon={Layers}
          label="Infinite Canvas"
          description="Hardware-accelerated workspace for visual lessons, diagrams, and notes."
        />
        <SettingsRow
          icon={BookOpen}
          label="24+ Subjects"
          description="Domain-aware prompting tuned for Math, Science, CS, History, and more."
        />
        <SettingsRow
          icon={Globe}
          label="Real-time Sync"
          description="Sessions and canvas state stay in sync across all your devices."
          borderBottom={false}
        />
      </SettingsGroup>

      {/* ── App Info ──────────────────────────────────────────────────── */}
      <SectionTitle>App Info</SectionTitle>
      <SettingsGroup>
        <SettingsRow
          icon={Activity}
          label="Version"
          rightElement={<span style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>{APP_VERSION}</span>}
        />
        <SettingsRow
          icon={Zap}
          label="Build"
          rightElement={<span style={{ color: 'var(--text-tertiary)', fontSize: '13px', fontVariantNumeric: 'tabular-nums' }}>{BUILD_NUMBER}</span>}
          borderBottom={false}
        />
      </SettingsGroup>

      {/* ── Support & Legal ───────────────────────────────────────────── */}
      <SectionTitle>Support</SectionTitle>
      <SettingsGroup>
        <SettingsRow
          icon={FileText}
          label="Documentation"
          description="Guides, tips, and feature walkthroughs"
          onClick={() => window.open('https://docs.tutorboard.ai', '_blank')}
          rightElement={<ChevronRight size={16} style={{ color: 'var(--text-tertiary)', opacity: 0.5 }} />}
        />
        <SettingsRow
          icon={MessageCircle}
          label="Discord Community"
          description="Chat with other learners and the team"
          onClick={() => window.open('https://discord.gg/tutorboard', '_blank')}
          rightElement={<ChevronRight size={16} style={{ color: 'var(--text-tertiary)', opacity: 0.5 }} />}
          borderBottom={false}
        />
      </SettingsGroup>

      {/* Footer */}
      <div style={{ textAlign: 'center', marginTop: '40px' }}>
        <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', opacity: 0.5, margin: 0 }}>
          © 2026 TutorBoard AI · All rights reserved
        </p>
      </div>

    </div>
  );
}