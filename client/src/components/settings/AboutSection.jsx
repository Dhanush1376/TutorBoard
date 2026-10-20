import React, { useState, useEffect } from 'react';
import { Shield, Code, RefreshCw } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import VisaiLogo from '../layout/VisaiLogo';
import { SectionTitle, SettingsGroup, SettingsRow } from './SettingsShared';

import { BASE_URL as API_URL } from '../../services/api';

const APP_VERSION = '2.1.0';

// ─── Status ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  online: { tone: 'text-emerald-600 dark:text-emerald-400', label: 'Online' },
  offline: { tone: 'text-red-500', label: 'Offline' },
  checking: { tone: 'text-[var(--text-tertiary)]', label: 'Checking' },
};

function StatusDot({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.checking;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${cfg.tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full bg-current ${status === 'checking' ? 'animate-pulse' : ''}`} />
      {cfg.label}
    </span>
  );
}

function overall(statuses) {
  const values = Object.values(statuses);
  if (values.some((s) => s === 'checking')) return { text: 'Checking status', tone: 'bg-[var(--text-tertiary)]' };
  if (values.some((s) => s === 'offline')) return { text: 'Some services degraded', tone: 'bg-amber-500' };
  return { text: 'All systems operational', tone: 'bg-emerald-500' };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AboutSection() {
  const { token } = useAuth();
  const [systemStatus, setSystemStatus] = useState({
    api: 'checking',
    database: 'checking',
  });
  const [lastChecked, setLastChecked] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const checkStatus = async () => {
    setRefreshing(true);
    setSystemStatus(prev => ({ ...prev, api: 'checking', database: 'checking' }));
    try {
      const res = await fetch(`${API_URL}/health`);
      
      if (res.ok) {
        setSystemStatus({
          api: 'online',
          database: 'online',
        });
      } else {
        const isDbOffline = res.status === 503;
        setSystemStatus({
          api: 'online',
          database: isDbOffline ? 'offline' : 'online',
        });
      }
      setLastChecked(new Date());
    } catch {
      setSystemStatus({ api: 'offline', database: 'offline' });
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

  const health = overall(systemStatus);

  return (
    <div className="flex flex-col gap-8">
      {/* Product card */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--st-line-strong)] bg-[var(--st-surface)] p-5">
        <div
          aria-hidden="true"
          className="mk-dots pointer-events-none absolute inset-0 opacity-60"
          style={{ maskImage: 'radial-gradient(ellipse 60% 90% at 100% 0%, #000, transparent 70%)', WebkitMaskImage: 'radial-gradient(ellipse 60% 90% at 100% 0%, #000, transparent 70%)' }}
        />
        <div className="relative flex items-center gap-4">
          <VisaiLogo size={48} className="text-[var(--text-primary)]" />
          <div className="min-w-0">
            <h3 className="text-[19px] font-medium leading-none tracking-[-0.03em]">TutorBoard</h3>
            <p className="mt-1.5 text-[12.5px] text-[var(--text-tertiary)]">The tutor that draws. Version {APP_VERSION}</p>
          </div>
        </div>
        <div className="relative mt-5 flex items-center gap-2 border-t border-[var(--st-line)] pt-4 text-[12.5px] text-[var(--text-secondary)]">
          <span className={`h-1.5 w-1.5 rounded-full ${health.tone}`} />
          {health.text}
        </div>
      </div>

      <section>
        <SectionTitle
          action={
            <button
              type="button"
              onClick={checkStatus}
              disabled={refreshing}
              className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)] disabled:cursor-default"
            >
              <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Checking' : timeAgo ? `Checked ${timeAgo}` : 'Check now'}
            </button>
          }
        >
          System status
        </SectionTitle>
        <SettingsGroup>
          <SettingsRow icon={Code} label="Server" rightElement={<StatusDot status={systemStatus.api} />} />
          <SettingsRow icon={Shield} label="Saved data" rightElement={<StatusDot status={systemStatus.database} />} />
        </SettingsGroup>
      </section>

      <p className="text-center text-[11.5px] font-normal text-[var(--text-tertiary)]">© 2026 TutorBoard</p>
    </div>
  );
}
