import React, { useCallback, useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Activity, Users, Cpu, SlidersHorizontal, ScrollText, Stethoscope, RefreshCw, AlertTriangle, Check, ShieldCheck, ChevronRight, ChevronLeft, Bell, Search, LogOut, X, CheckCircle2, User, Plus, Inbox, History, Eye, EyeOff, ChevronDown, ExternalLink, Zap, KeyRound, Compass, Database, Mail, Server, Send } from 'lucide-react';
import VisaiLogo from '../components/layout/VisaiLogo';
import useWindowSize from '../hooks/useWindowSize';
import API from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { Button, fieldClass, DialogModal, AppleToggle } from '../components/settings/SettingsShared';
import { BrandLogoBadge } from '../components/settings/api-config/ProviderBrandLogo';
import { PROVIDERS, PROVIDER_INFO, detectProvider } from '../components/settings/api-config/ProviderRegistry';

/**
 * Admin control center. Every action calls /api/admin/*, which enforces the
 * admin role on the server; this page only hides itself from non-admins.
 * No secret ever reaches this page: provider keys come back masked.
 */

const TABS = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'providers', label: 'AI providers', icon: Cpu },
  { id: 'settings', label: 'Platform', icon: SlidersHorizontal },
  { id: 'audit', label: 'Activity', icon: ScrollText },
  { id: 'diagnostics', label: 'Diagnostics', icon: Stethoscope },
  { id: 'access', label: 'Admin access', icon: ShieldCheck, superadminOnly: true },
];

const errOf = (e, f = 'Request failed') => e?.response?.data?.error || f;
// the app-wide `select { padding: 8px … }` rule outranks utility classes; keep text inside the 36px control
const SELECT_STYLE = { paddingTop: 0, paddingBottom: 0, paddingLeft: 12, paddingRight: 32, fontSize: 12.5, lineHeight: 'normal' };
const fmt = (d) => (d ? new Date(d).toLocaleString() : '—');

const Card = ({ title, children, action, className = '', style }) => (
  <section style={style} className={`rounded-xl border border-[var(--st-line-strong)] bg-[var(--st-surface)] p-3.5 sm:p-5 transition-shadow duration-200 hover:shadow-[0_4px_24px_-6px_rgba(0,0,0,0.12)] ${className}`}>
    {(title || action) && (
      <div className="mb-3.5 flex shrink-0 items-center justify-between gap-2">
        {title && <h2 className="text-[13.5px] sm:text-[14px] font-medium text-[var(--text-primary)]">{title}</h2>}
        {action}
      </div>
    )}
    {children}
  </section>
);

const Pill = ({ tone = 'neutral', children }) => {
  const tones = {
    ok: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    warn: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    bad: 'bg-red-500/10 text-red-600 dark:text-red-400',
    neutral: 'bg-[var(--st-fill-strong)] text-[var(--text-secondary)]',
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}>{children}</span>;
};

const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
  className = '',
  tone = 'neutral',
  compact = false,
}) => {
  const toneMap = {
    neutral: 'border-[var(--st-line)] bg-[var(--st-fill)] text-[var(--text-secondary)]',
    ok: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-500',
    warn: 'border-amber-500/25 bg-amber-500/10 text-amber-500',
  };

  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'py-4 px-2' : 'py-6 px-3'} ${className}`}>
      {Icon && (
        <div className={`mb-2.5 grid ${compact ? 'h-8 w-8' : 'h-10 w-10'} place-items-center rounded-lg border ${toneMap[tone] || toneMap.neutral}`}>
          <Icon size={compact ? 15 : 18} />
        </div>
      )}
      <div className="text-[13px] font-medium text-[var(--text-primary)]">{title}</div>
      {description && (
        <p className="mt-0.5 max-w-xs text-[11.5px] leading-normal text-[var(--text-tertiary)]">{description}</p>
      )}
      {action && <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
};

function FilterDropdown({ value, onChange, options, ariaLabel = 'Filter', className = '' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    if (open) {
      document.addEventListener('mousedown', handleOutside);
      document.addEventListener('keydown', handleKey);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const selectedOption = options.find((o) => o.value === value) || options[0];

  return (
    <div className={`relative inline-block ${className}`} ref={ref}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={`flex h-8.5 cursor-pointer items-center justify-between gap-2.5 rounded-lg border px-3 text-[12px] font-medium transition-all duration-150 ${
          open
            ? 'border-[var(--st-line-strong)] bg-[var(--st-fill)] text-[var(--text-primary)] shadow-sm'
            : 'border-[var(--st-line)] bg-[var(--st-fill)]/30 text-[var(--text-primary)] hover:border-[var(--st-line-strong)] hover:bg-[var(--st-fill)]/60'
        }`}
      >
        <span className="truncate">{selectedOption?.label || 'Select'}</span>
        <ChevronDown
          size={13}
          className={`shrink-0 text-[var(--text-tertiary)] transition-transform duration-150 ${open ? 'rotate-180 text-[var(--text-primary)]' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 sm:left-auto sm:right-0 top-full mt-1.5 z-40 min-w-[140px] overflow-hidden rounded-lg border border-[var(--st-line-strong)] bg-[var(--st-surface)] p-1 shadow-xl backdrop-blur-xl"
          >
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-left text-[12px] font-medium transition-colors ${
                    active
                      ? 'bg-[var(--st-fill-strong)] text-[var(--text-primary)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--st-fill)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <span>{opt.label}</span>
                  {active && <Check size={12.5} className="shrink-0 text-emerald-400" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const healthTone = (s) => ({ healthy: 'ok', degraded: 'warn', failing: 'bad' }[s] || 'neutral');

const ErrorLine = ({ children, onRetry, className = '' }) =>
  children ? (
    <div
      role="alert"
      className={`mb-3.5 flex items-center justify-between gap-3 rounded-lg border border-red-500/20 bg-red-500/[0.08] px-3.5 py-2.5 text-[12.5px] text-red-300 backdrop-blur-sm ${className}`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-red-500/15 text-red-400">
          <AlertTriangle size={13} />
        </div>
        <span className="truncate font-medium text-red-200/95 leading-snug">
          {children}
        </span>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-red-500/25 bg-red-500/10 px-2.5 py-1 text-[11.5px] font-medium text-red-300 transition-colors hover:bg-red-500/20"
        >
          <RefreshCw size={11} /> Retry
        </button>
      )}
    </div>
  ) : null;

function useAdminGet(url, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await API.get(url);
      setData(r.data);
      setError('');
    } catch (e) {
      setError(errOf(e));
    } finally {
      setLoading(false);
    }
  }, [url]);
  useEffect(() => { load(); }, [load, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, error, loading, reload: load };
}

// ─── Overview ────────────────────────────────────────────────────────────────

function Overview({ open }) {
  const { data, error, loading, reload } = useAdminGet('/api/admin/overview');

  const authFailures = data?.security?.failedSignInsLast24h || 0;
  const emailFailures = data?.security?.emailDeliveryFailuresLast24h || 0;
  const aiFailures = data?.ai?.failedRequestsLast24h || 0;

  return (
    <div className="flex flex-col gap-4 max-w-6xl w-full mx-auto pb-6">
      {/* Overview Top Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-[17px] font-semibold text-[var(--text-primary)]">Platform Overview</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Operational
          </span>
          <Button
            variant="ghost"
            className="h-7.5 px-2.5 text-[11.5px] inline-flex items-center gap-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            onClick={reload}
            disabled={loading}
            aria-label="Refresh overview data"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      <ErrorLine onRetry={reload}>{error}</ErrorLine>

      {/* Top Card: Account Analytics */}
      <Card
        title={
          <div className="flex items-center gap-2">
            <Users size={16} className="text-[var(--text-tertiary)]" />
            <span>Account Analytics</span>
          </div>
        }
        action={
          <Button
            variant="ghost"
            className="h-7 px-2.5 text-[11.5px] inline-flex items-center gap-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            onClick={() => open?.('users')}
          >
            <span>User Directory</span>
            <ChevronRight size={12} />
          </Button>
        }
      >
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          <button
            type="button"
            onClick={() => open?.('users')}
            className="group flex flex-col rounded-lg border border-[var(--st-line)]/50 bg-[var(--st-fill)]/20 p-3 text-left transition-all hover:border-[var(--st-line-strong)] hover:bg-[var(--st-fill)]/40 cursor-pointer"
          >
            <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Registered</span>
            <div className="mt-1.5 text-[22px] font-semibold tabular-nums text-[var(--text-primary)]">
              {data?.accounts.total ?? '—'}
            </div>
          </button>

          <button
            type="button"
            onClick={() => open?.('users')}
            className="group flex flex-col rounded-lg border border-[var(--st-line)]/50 bg-[var(--st-fill)]/20 p-3 text-left transition-all hover:border-[var(--st-line-strong)] hover:bg-[var(--st-fill)]/40 cursor-pointer"
          >
            <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Verified</span>
            <div className="mt-1.5 text-[22px] font-semibold tabular-nums text-emerald-400">
              {data?.accounts.verified ?? '—'}
            </div>
          </button>

          <button
            type="button"
            onClick={() => open?.('users')}
            className="group flex flex-col rounded-lg border border-[var(--st-line)]/50 bg-[var(--st-fill)]/20 p-3 text-left transition-all hover:border-[var(--st-line-strong)] hover:bg-[var(--st-fill)]/40 cursor-pointer"
          >
            <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Unverified</span>
            <div className="mt-1.5 text-[22px] font-semibold tabular-nums text-[var(--text-secondary)]">
              {data?.accounts.unverified ?? '—'}
            </div>
          </button>

          <button
            type="button"
            onClick={() => open?.('users')}
            className="group flex flex-col rounded-lg border border-[var(--st-line)]/50 bg-[var(--st-fill)]/20 p-3 text-left transition-all hover:border-[var(--st-line-strong)] hover:bg-[var(--st-fill)]/40 cursor-pointer"
          >
            <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Disabled</span>
            <div className={`mt-1.5 text-[22px] font-semibold tabular-nums ${(data?.accounts.disabled || 0) > 0 ? 'text-red-400' : 'text-[var(--text-secondary)]'}`}>
              {data?.accounts.disabled ?? '—'}
            </div>
          </button>

          <button
            type="button"
            onClick={() => open?.('users')}
            className="group flex flex-col rounded-lg border border-[var(--st-line)]/50 bg-[var(--st-fill)]/20 p-3 text-left transition-all hover:border-[var(--st-line-strong)] hover:bg-[var(--st-fill)]/40 cursor-pointer"
          >
            <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Admins</span>
            <div className="mt-1.5 text-[22px] font-semibold tabular-nums text-amber-400">
              {data?.accounts.admins ?? '—'}
            </div>
          </button>

          <button
            type="button"
            onClick={() => open?.('users')}
            className="group flex flex-col rounded-lg border border-[var(--st-line)]/50 bg-[var(--st-fill)]/20 p-3 text-left transition-all hover:border-[var(--st-line-strong)] hover:bg-[var(--st-fill)]/40 cursor-pointer"
          >
            <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">New (7 days)</span>
            <div className="mt-1.5 text-[22px] font-semibold tabular-nums text-[var(--text-primary)]">
              +{data?.accounts.newLast7d ?? 0}
            </div>
          </button>
        </div>
      </Card>

      {/* Middle Grid: Activity & AI Providers */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Activity & Security */}
        <Card
          title={
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-[var(--text-tertiary)]" />
              <span>Activity & Security Health</span>
            </div>
          }
          action={
            <Button
              variant="ghost"
              className="h-7 px-2.5 text-[11.5px] inline-flex items-center gap-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              onClick={() => open?.('audit')}
            >
              <span>Audit Log</span>
              <ChevronRight size={12} />
            </Button>
          }
        >
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-lg border border-[var(--st-line)]/50 bg-[var(--st-fill)]/20 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Active Sessions (24h)</span>
                <Activity size={13} className="text-emerald-400" />
              </div>
              <div className="mt-1.5 text-[20px] font-semibold tabular-nums text-[var(--text-primary)]">
                {data?.sessions.activeLast24h ?? '—'}
              </div>
            </div>

            <div className="rounded-lg border border-[var(--st-line)]/50 bg-[var(--st-fill)]/20 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Guest Chats (7d)</span>
                <Compass size={13} className="text-sky-400" />
              </div>
              <div className="mt-1.5 text-[20px] font-semibold tabular-nums text-[var(--text-primary)]">
                {data?.guests.conversationsActiveLast7d ?? '—'}
              </div>
            </div>

            <div className="rounded-lg border border-[var(--st-line)]/50 bg-[var(--st-fill)]/20 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Failed Sign-ins (24h)</span>
                <AlertTriangle size={13} className={authFailures > 0 ? 'text-red-400' : 'text-emerald-400'} />
              </div>
              <div className={`mt-1.5 text-[20px] font-semibold tabular-nums ${authFailures > 0 ? 'text-red-400' : 'text-[var(--text-primary)]'}`}>
                {authFailures}
              </div>
            </div>

            <div className="rounded-lg border border-[var(--st-line)]/50 bg-[var(--st-fill)]/20 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Email Failures (24h)</span>
                <Mail size={13} className={emailFailures > 0 ? 'text-red-400' : 'text-emerald-400'} />
              </div>
              <div className={`mt-1.5 text-[20px] font-semibold tabular-nums ${emailFailures > 0 ? 'text-red-400' : 'text-[var(--text-primary)]'}`}>
                {emailFailures}
              </div>
            </div>
          </div>
        </Card>

        {/* AI Providers & Model Routing */}
        <Card
          title={
            <div className="flex items-center gap-2">
              <Cpu size={16} className="text-[var(--text-tertiary)]" />
              <span>AI Providers & Routing Engine</span>
            </div>
          }
          action={
            <Button
              variant="ghost"
              className="h-7 px-2.5 text-[11.5px] inline-flex items-center gap-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              onClick={() => open?.('providers')}
            >
              <span>Manage</span>
              <ChevronRight size={12} />
            </Button>
          }
        >
          <div className="grid grid-cols-2 gap-2.5 mb-3">
            <div className="rounded-lg border border-[var(--st-line)]/50 bg-[var(--st-fill)]/20 p-3">
              <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Failed Requests (24h)</span>
              <div className={`mt-1.5 text-[20px] font-semibold tabular-nums ${aiFailures > 0 ? 'text-red-400' : 'text-[var(--text-primary)]'}`}>
                {aiFailures}
              </div>
            </div>

            <div className="rounded-lg border border-[var(--st-line)]/50 bg-[var(--st-fill)]/20 p-3">
              <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Configured Routes</span>
              <div className="mt-1.5 text-[20px] font-semibold tabular-nums text-[var(--text-primary)]">
                {data?.ai.providers?.length || 0}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            {data?.ai.providers?.length === 0 && (
              <div className="flex items-center justify-between gap-2.5 rounded-lg border border-[var(--st-line)]/50 bg-[var(--st-fill)]/20 px-3 py-2.5 text-[12px]">
                <div className="flex items-center gap-2 min-w-0">
                  <Cpu size={14} className="shrink-0 text-emerald-400" />
                  <span className="font-medium text-[var(--text-primary)] truncate">Default Environment Provider</span>
                </div>
                <Pill tone="ok">active</Pill>
              </div>
            )}

            {data?.ai.providers?.map((p) => (
              <div
                key={p._id}
                className="flex items-center justify-between gap-2.5 rounded-lg border border-[var(--st-line)]/40 bg-[var(--st-fill)]/20 px-3 py-2 text-[12.5px] transition-colors hover:bg-[var(--st-fill)]/35"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Cpu size={14} className="shrink-0 text-[var(--text-tertiary)]" />
                  <span className="font-medium text-[var(--text-primary)] truncate">{p.name}</span>
                  <span className="text-[11px] text-[var(--text-tertiary)] font-mono shrink-0">priority {p.priority}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {!p.enabled && <Pill tone="neutral">off</Pill>}
                  <Pill tone={healthTone(p.health?.status)}>{p.health?.status || 'unknown'}</Pill>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Bottom Shortcuts: Command Navigation Grid */}
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => open?.('users')}
          className="flex items-center justify-between rounded-xl border border-[var(--st-line-strong)] bg-[var(--st-surface)] p-3 text-left transition-all hover:border-[var(--text-primary)]/40 hover:bg-[var(--st-fill)]/30 cursor-pointer group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[var(--st-line)] bg-[var(--st-fill)] text-[var(--text-primary)]">
              <Users size={15} />
            </div>
            <span className="text-[13px] font-medium text-[var(--text-primary)] truncate">User Directory</span>
          </div>
          <ChevronRight size={14} className="shrink-0 text-[var(--text-tertiary)] group-hover:translate-x-0.5 transition-transform" />
        </button>

        <button
          type="button"
          onClick={() => open?.('providers')}
          className="flex items-center justify-between rounded-xl border border-[var(--st-line-strong)] bg-[var(--st-surface)] p-3 text-left transition-all hover:border-[var(--text-primary)]/40 hover:bg-[var(--st-fill)]/30 cursor-pointer group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[var(--st-line)] bg-[var(--st-fill)] text-[var(--text-primary)]">
              <Cpu size={15} />
            </div>
            <span className="text-[13px] font-medium text-[var(--text-primary)] truncate">AI Providers</span>
          </div>
          <ChevronRight size={14} className="shrink-0 text-[var(--text-tertiary)] group-hover:translate-x-0.5 transition-transform" />
        </button>

        <button
          type="button"
          onClick={() => open?.('diagnostics')}
          className="flex items-center justify-between rounded-xl border border-[var(--st-line-strong)] bg-[var(--st-surface)] p-3 text-left transition-all hover:border-[var(--text-primary)]/40 hover:bg-[var(--st-fill)]/30 cursor-pointer group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[var(--st-line)] bg-[var(--st-fill)] text-[var(--text-primary)]">
              <Stethoscope size={15} />
            </div>
            <span className="text-[13px] font-medium text-[var(--text-primary)] truncate">Diagnostics</span>
          </div>
          <ChevronRight size={14} className="shrink-0 text-[var(--text-tertiary)] group-hover:translate-x-0.5 transition-transform" />
        </button>

        <button
          type="button"
          onClick={() => open?.('settings')}
          className="flex items-center justify-between rounded-xl border border-[var(--st-line-strong)] bg-[var(--st-surface)] p-3 text-left transition-all hover:border-[var(--text-primary)]/40 hover:bg-[var(--st-fill)]/30 cursor-pointer group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[var(--st-line)] bg-[var(--st-fill)] text-[var(--text-primary)]">
              <SlidersHorizontal size={15} />
            </div>
            <span className="text-[13px] font-medium text-[var(--text-primary)] truncate">Platform Settings</span>
          </div>
          <ChevronRight size={14} className="shrink-0 text-[var(--text-tertiary)] group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </div>
  );
}

// ─── Shared Event Labels ─────────────────────────────────────────────────────

const AUDIT_EVENT_LABELS = {
  'admin.settings_changed': 'Settings changed',
  'admin.settings_rollback': 'Settings rolled back',
  'admin.role_changed': 'Role changed',
  'admin.user_disabled': 'User disabled',
  'admin.user_enabled': 'User enabled',
  'admin.sessions_revoked': 'Sessions revoked',
  'admin.provider_created': 'AI provider added',
  'admin.provider_updated': 'AI provider updated',
  'admin.provider_deleted': 'AI provider deleted',
  'admin.provider_tested': 'AI provider tested',
  'admin.provider_enabled': 'AI provider enabled',
  'admin.provider_disabled': 'AI provider disabled',
  'admin.provider_rollback': 'AI provider rolled back',
  'admin.mail_test': 'Test email sent',
  'admin_access.requested': 'Admin access requested',
  'admin_access.cancelled': 'Admin request cancelled',
  'admin_access.approved': 'Admin access approved',
  'admin_access.rejected': 'Admin access rejected',
  'admin_access.revoked': 'Admin access revoked',
  'auth.signin': 'User signed in',
  'account.created': 'Account created',
  'account.deleted': 'Account deleted',
  'password.change': 'Password changed',
  'password.added': 'Password set',
  'password.reset': 'Password reset',
  'password.reset_code': 'Reset code requested',
  'password.reset_requested': 'Password reset requested',
  'session.revoke': 'Session signed out',
  'session.revoke_all': 'All sessions signed out',
  'session.refresh_reuse': 'Token reuse detected',
  'email.verified': 'Email verified',
  'email.delivery_failed': 'Email delivery failed',
  'identity.linked': 'OAuth account linked',
  'identity.unlinked': 'OAuth account unlinked',
};

function humanEventName(type) {
  if (!type) return 'Activity';
  if (AUDIT_EVENT_LABELS[type]) return AUDIT_EVENT_LABELS[type];
  if (type.startsWith('oauth.')) {
    const provider = type.replace('oauth.', '');
    return `${provider.charAt(0).toUpperCase() + provider.slice(1)} sign-in`;
  }
  return type
    .replace(/^(admin\.|auth\.|session\.|email\.|account\.)/, '')
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Users ───────────────────────────────────────────────────────────────────

function UserDetailContent({ u, detail, me, actionError, setConfirm, selected, loading }) {
  if (!selected) {
    return (
      <EmptyState
        icon={User}
        title="No user selected"
        description="Select an account from the directory to view details."
        className="py-12"
      />
    );
  }

  if (loading && !detail && !actionError) {
    return (
      <div className="py-16 text-center text-[12.5px] text-[var(--text-tertiary)] animate-pulse">
        Loading user profile and history…
      </div>
    );
  }

  if (!u) return null;

  return (
    <div className="flex flex-col gap-4 text-[13px] overflow-x-hidden">
      {/* Profile Hero (Unboxed, clean & breathable) */}
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[var(--st-line-strong)] bg-[var(--st-fill-strong)] text-[14.5px] font-semibold text-[var(--text-primary)]">
          {(u.name || u.email || 'U').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[14.5px] font-semibold text-[var(--text-primary)] truncate">
              {u.name || 'Unnamed User'}
            </h3>
            <Pill tone={u.role === 'superadmin' ? 'warn' : u.role === 'admin' ? 'warn' : 'neutral'}>
              {u.role}
            </Pill>
            {u.disabled && <Pill tone="bad">disabled</Pill>}
          </div>
          <div className="text-[12px] font-mono text-[var(--text-tertiary)] truncate mt-0.5">
            {u.email}
          </div>
        </div>
      </div>

      {u.disabled && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-[12px] text-red-300">
          <span className="font-semibold text-red-200">Account disabled: </span>
          {u.disabledReason || 'By administrator'}
        </div>
      )}

      {/* Quick Stats Ribbon (Unified flat strip with hairline dividers) */}
      <div className="grid grid-cols-3 divide-x divide-[var(--st-line)]/60 rounded-lg border border-[var(--st-line)]/60 bg-[var(--st-fill)]/15 py-2.5">
        <div className="px-2 text-center">
          <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Conversations</div>
          <div className="text-[16px] font-semibold tabular-nums text-[var(--text-primary)] mt-0.5">{detail?.conversations ?? 0}</div>
        </div>
        <div className="px-2 text-center">
          <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Active Sessions</div>
          <div className="text-[16px] font-semibold tabular-nums text-[var(--text-primary)] mt-0.5">{detail?.sessions?.length ?? 0}</div>
        </div>
        <div className="px-2 text-center">
          <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Email Status</div>
          <div className="mt-1 flex items-center justify-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${u.emailVerified ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            <span className="text-[11.5px] font-medium text-[var(--text-secondary)] capitalize">
              {u.emailVerified ? 'verified' : 'unverified'}
            </span>
          </div>
        </div>
      </div>

      {/* Account Info Properties (Clean hairline list) */}
      <div className="flex flex-col divide-y divide-[var(--st-line)]/50 border-y border-[var(--st-line)]/50 py-0.5 text-[12px]">
        <div className="flex items-center justify-between py-2">
          <span className="text-[var(--text-tertiary)]">Sign-in methods</span>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {['password', 'google', 'github'].filter((k) => u.providers?.[k]).map((provider) => (
              <span key={provider} className="inline-flex items-center rounded bg-[var(--st-fill)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)] capitalize">
                {provider === 'password' ? 'Password' : provider === 'google' ? 'Google' : 'GitHub'}
              </span>
            ))}
            {!['password', 'google', 'github'].some((k) => u.providers?.[k]) && (
              <span className="text-[var(--text-tertiary)]">None</span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between py-2">
          <span className="text-[var(--text-tertiary)]">Last sign-in</span>
          <span className="font-mono text-[11.5px] text-[var(--text-secondary)]">
            {fmt(u.lastLoginAt)}
          </span>
        </div>

        <div className="flex items-center justify-between py-2">
          <span className="text-[var(--text-tertiary)]">Account created</span>
          <span className="font-mono text-[11.5px] text-[var(--text-secondary)]">
            {fmt(u.createdAt)}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      {String(u.id) !== String(me?.id) && (
        <div className="flex flex-wrap gap-2">
          {u.disabled ? (
            <Button
              variant="secondary"
              className="h-7.5 px-3 text-[11.5px] font-medium inline-flex items-center gap-1.5 text-emerald-500 hover:text-emerald-400"
              onClick={() => setConfirm({ kind: 'enable', id: u.id, label: `Re-enable ${u.email}?` })}
            >
              <CheckCircle2 size={12} />
              <span>Re-enable</span>
            </Button>
          ) : (
            <Button
              variant="danger"
              className="h-7.5 px-3 text-[11.5px] font-medium inline-flex items-center gap-1.5"
              onClick={() => setConfirm({ kind: 'disable', id: u.id, label: `Disable ${u.email}?`, reason: '' })}
            >
              <AlertTriangle size={12} />
              <span>Disable</span>
            </Button>
          )}

          <Button
            variant="secondary"
            className="h-7.5 px-3 text-[11.5px] font-medium inline-flex items-center gap-1.5"
            onClick={() => setConfirm({ kind: 'revoke-sessions', id: u.id, label: `Sign ${u.email} out everywhere?` })}
          >
            <LogOut size={12} />
            <span>Revoke Sessions</span>
          </Button>

          {me?.role === 'superadmin' && u.role !== 'superadmin' && (
            <Button
              variant="secondary"
              className="h-7.5 px-3 text-[11.5px] font-medium inline-flex items-center gap-1.5"
              onClick={() => setConfirm({
                kind: 'role',
                id: u.id,
                role: u.role === 'admin' ? 'user' : 'admin',
                label: u.role === 'admin' ? `Remove admin from ${u.email}?` : `Make ${u.email} an admin?`,
              })}
            >
              <ShieldCheck size={12} />
              <span>{u.role === 'admin' ? 'Remove Admin' : 'Make Admin'}</span>
            </Button>
          )}
        </div>
      )}

      {/* Recent Security Events (Clean hairline activity feed) */}
      <div className="flex flex-col gap-2 pt-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            Recent Security Events
          </span>
          <span className="text-[10.5px] font-mono text-[var(--text-tertiary)]">
            {detail?.events?.length ?? 0} logged
          </span>
        </div>

        <div className="flex flex-col divide-y divide-[var(--st-line)]/40 max-h-56 overflow-y-auto overflow-x-hidden pr-1">
          {(detail?.events || []).map((ev) => (
            <div
              key={ev._id}
              className="flex items-start justify-between gap-3 py-2 px-1 rounded-md transition-colors hover:bg-[var(--st-fill)]/30"
            >
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <span className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${ev.outcome === 'failure' ? 'bg-red-400' : 'bg-emerald-400'}`} />
                <div className="min-w-0 flex-1">
                  <div className={`text-[12px] font-medium leading-tight truncate ${ev.outcome === 'failure' ? 'text-red-400' : 'text-[var(--text-primary)]'}`}>
                    {humanEventName(ev.type)}
                  </div>
                  <div className="text-[10px] text-[var(--text-tertiary)] font-mono mt-0.5 truncate">
                    {ev.type}
                  </div>
                </div>
              </div>
              <span className="shrink-0 text-[10.5px] text-[var(--text-tertiary)] font-mono whitespace-nowrap pt-0.5">
                {fmt(ev.createdAt)}
              </span>
            </div>
          ))}

          {(detail?.events?.length ?? 0) === 0 && (
            <div className="py-4 text-center text-[12px] text-[var(--text-tertiary)]">
              No recent security events logged.
            </div>
          )}
        </div>
      </div>

      <ErrorLine>{actionError}</ErrorLine>
    </div>
  );
}

function UsersTab({ me, selectedUser, onSelectUser, externalQuery, compact }) {
  const { width } = useWindowSize();
  const isMobile = compact ?? (width < 1024);
  const [q, setQ] = useState(externalQuery || '');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState(externalQuery || '');
  const url = `/api/admin/users?q=${encodeURIComponent(query)}&status=${status}&page=${page}&limit=20`;
  const { data, error, loading, reload } = useAdminGet(url);
  const [selected, setSelected] = useState(selectedUser?.id || null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const open = useCallback(async (id, userSummary) => {
    setSelected(id);
    onSelectUser?.(userSummary || { id });
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await API.get(`/api/admin/users/${id}`);
      setDetail(res.data);
      if (res.data?.user) {
        onSelectUser?.(res.data.user);
      }
    } catch (e) {
      setActionError(errOf(e));
    } finally {
      setDetailLoading(false);
    }
  }, [onSelectUser]);

  // Sync external search query from navbar
  useEffect(() => {
    if (externalQuery !== undefined && externalQuery !== query) {
      setQ(externalQuery);
      setQuery(externalQuery);
      setPage(1);
    }
  }, [externalQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync external selection clear
  useEffect(() => {
    if (!selectedUser) {
      setSelected(null);
      setDetail(null);
    } else if (selectedUser.id && selectedUser.id !== selected) {
      open(selectedUser.id, selectedUser);
    }
  }, [selectedUser, selected, open]);

  const run = async () => {
    if (!confirm) return;
    setBusy(true);
    setActionError('');
    try {
      if (confirm.kind === 'role') await API.put(`/api/admin/users/${confirm.id}/role`, { role: confirm.role });
      else await API.post(`/api/admin/users/${confirm.id}/${confirm.kind}`, confirm.kind === 'disable' ? { reason: confirm.reason || '' } : {});
      setConfirm(null);
      await reload();
      if (selected) await open(selected);
    } catch (e) {
      setActionError(errOf(e));
    } finally {
      setBusy(false);
    }
  };

  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const u = detail?.user;

  return (
    <div className="flex-1 h-full min-h-0 overflow-hidden">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] h-full min-h-0">
        {/* Left Column: User Directory */}
        <Card
          title={
            <div className="flex items-center gap-2">
              <span className="text-[13.5px] sm:text-[14px] font-medium text-[var(--text-primary)]">Users</span>
              {data?.total !== undefined && (
                <span className="rounded-full bg-[var(--st-fill)] border border-[var(--st-line)] px-2 py-0.5 text-[10.5px] font-medium text-[var(--text-secondary)] tabular-nums">
                  {data.total}
                </span>
              )}
            </div>
          }
          className="flex flex-col h-full min-h-0 overflow-hidden"
          style={{ height: '100%' }}
          action={
            <Button
              variant="ghost"
              className="h-7 px-2 text-[11.5px] inline-flex items-center gap-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              onClick={reload}
              disabled={loading}
              aria-label="Refresh user list"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          }
        >
          <form
            className="mb-3 flex items-center gap-2 shrink-0"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setQuery(q.trim());
            }}
          >
            <div className="relative flex-1 min-w-0">
              <Search size={13.5} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none" />
              <input
                aria-label="Search users by email or name"
                placeholder="Search email or name…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full h-8.5 rounded-lg border border-[var(--st-line)] bg-[var(--st-fill)]/20 pl-8 pr-7 text-[12.5px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none transition-colors focus:border-[var(--st-line-strong)] focus:bg-[var(--st-fill)]/40"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => {
                    setQ('');
                    setQuery('');
                    setPage(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] cursor-pointer"
                  aria-label="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <FilterDropdown
              ariaLabel="Filter users by status"
              value={status}
              onChange={(val) => {
                setStatus(val);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All Users' },
                { value: 'unverified', label: 'Unverified' },
                { value: 'disabled', label: 'Disabled' },
                { value: 'admins', label: 'Admins' },
              ]}
            />

            <Button type="submit" variant="secondary" className="h-8.5 px-3 text-[12px] font-medium shrink-0">
              Search
            </Button>
          </form>

          <ErrorLine onRetry={reload}>{error}</ErrorLine>

          <div className="flex flex-col gap-1 flex-1 min-h-0 overflow-y-auto pr-0.5">
            {data?.users.map((x) => {
              const isSel = selected === x.id;
              return (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => open(x.id, x)}
                  className={`group relative flex w-full cursor-pointer items-center gap-3 px-3 py-2 rounded-lg border text-left transition-all duration-150 ${
                    isSel
                      ? 'border-emerald-500/40 bg-emerald-500/[0.07] shadow-sm'
                      : 'border-transparent hover:border-[var(--st-line)] hover:bg-[var(--st-fill)]/40'
                  }`}
                >
                  {isSel && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r bg-emerald-400" />
                  )}

                  <div
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border text-[12px] font-semibold transition-colors ${
                      isSel
                        ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300'
                        : 'border-[var(--st-line)] bg-[var(--st-surface)] text-[var(--text-secondary)] group-hover:border-[var(--st-line-strong)]'
                    }`}
                  >
                    {(x.name || x.email || 'U').charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className={`truncate text-[12.5px] font-medium leading-tight ${isSel ? 'text-white' : 'text-[var(--text-primary)]'}`}>
                      {x.email}
                    </div>
                    <div className="truncate text-[11px] text-[var(--text-tertiary)] mt-0.5 font-mono">
                      {x.name ? `${x.name} · ` : ''}joined {new Date(x.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {x.role !== 'user' && <Pill tone="warn">{x.role}</Pill>}
                    {x.disabled && <Pill tone="bad">disabled</Pill>}
                    {!x.emailVerified && <Pill tone="neutral">unverified</Pill>}
                    <ChevronRight size={13} className={`text-[var(--text-tertiary)] transition-transform ${isSel ? 'opacity-100 text-emerald-400 translate-x-0.5' : 'opacity-0 group-hover:opacity-100'}`} />
                  </div>
                </button>
              );
            })}

            {loading && !data && (
              <div className="flex flex-col gap-1.5 py-1">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg border border-[var(--st-line)]/30 bg-[var(--st-fill)]/10 animate-pulse">
                    <div className="h-8 w-8 rounded-full bg-[var(--st-fill)]/60 shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-44 rounded bg-[var(--st-fill)]/60" />
                      <div className="h-2 w-28 rounded bg-[var(--st-fill)]/30" />
                    </div>
                    <div className="h-4 w-14 rounded-full bg-[var(--st-fill)]/40 shrink-0" />
                  </div>
                ))}
              </div>
            )}

            {!loading && data?.users.length === 0 && (
              <div className="py-6">
                <EmptyState
                  icon={Users}
                  title="No users found"
                  description={query || status ? 'No accounts match this query.' : ''}
                  action={
                    (query || status) ? (
                      <Button
                        variant="ghost"
                        className="h-7 px-2.5 text-[11.5px]"
                        onClick={() => {
                          setQ('');
                          setQuery('');
                          setStatus('');
                          setPage(1);
                        }}
                      >
                        Clear filter
                      </Button>
                    ) : null
                  }
                />
              </div>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-[var(--st-line)] flex items-center justify-between text-[11.5px] text-[var(--text-tertiary)] shrink-0">
            <span className="font-mono">
              {data?.total ? `${(page - 1) * 20 + 1}–${Math.min(page * 20, data.total)} of ${data.total}` : ''}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                className="h-7 px-2 text-[11.5px] inline-flex items-center gap-1"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft size={13} />
                <span>Prev</span>
              </Button>
              <span className="font-mono text-[11px] px-2 text-[var(--text-secondary)]">
                {page} / {pages}
              </span>
              <Button
                variant="ghost"
                className="h-7 px-2 text-[11.5px] inline-flex items-center gap-1"
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
              >
                <span>Next</span>
                <ChevronRight size={13} />
              </Button>
            </div>
          </div>
        </Card>

        {/* Right Column: User Details (Desktop) */}
        <Card
          title="User details"
          action={
            selected ? (
              <Button
                variant="ghost"
                className="h-7 px-2 text-[11.5px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] inline-flex items-center gap-1"
                onClick={() => {
                  setSelected(null);
                  onSelectUser?.(null);
                }}
              >
                <X size={13} />
                <span>Close</span>
              </Button>
            ) : null
          }
          className="hidden lg:flex flex-col h-full min-h-0 overflow-hidden"
          style={{ height: '100%' }}
        >
          <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
            <UserDetailContent
              u={u}
              detail={detail}
              me={me}
              actionError={actionError}
              setConfirm={setConfirm}
              selected={selected}
              loading={detailLoading}
            />
          </div>
        </Card>
      </div>

      {/* Mobile App Drawer (slide-up bottom sheet for < 1024px) */}
      <AnimatePresence>
        {isMobile && selected && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => {
                setSelected(null);
                onSelectUser?.(null);
              }}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm lg:hidden"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88vh] flex-col rounded-t-2xl border-t border-[var(--st-line-strong)] bg-[var(--st-surface)] shadow-[0_-12px_40px_rgba(0,0,0,0.7)] lg:hidden"
            >
              <div className="flex shrink-0 items-center justify-center pt-3 pb-1">
                <div className="h-1.5 w-12 rounded-full bg-[var(--st-line-strong)]" />
              </div>

              <div className="flex shrink-0 items-center justify-between border-b border-[var(--st-line)] px-4 py-2.5">
                <h2 className="text-[14px] font-semibold text-[var(--text-primary)] truncate">
                  User details
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(null);
                    onSelectUser?.(null);
                  }}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--st-line)] bg-[var(--st-fill)] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
                <UserDetailContent
                  u={u}
                  detail={detail}
                  me={me}
                  actionError={actionError}
                  setConfirm={setConfirm}
                  selected={selected}
                  loading={detailLoading}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirm && (
          <DialogModal
            title={confirm.label}
            description={confirm.kind === 'disable' ? 'They are signed out everywhere and cannot sign in until re-enabled.' : undefined}
            primaryAction={run}
            primaryLabel="Confirm"
            primaryDanger={confirm.kind === 'disable'}
            loading={busy}
            onClose={() => !busy && setConfirm(null)}
          >
            {confirm.kind === 'disable' && (
              <input
                aria-label="Reason (optional)"
                placeholder="Reason (optional)"
                value={confirm.reason}
                maxLength={200}
                onChange={(e) => setConfirm((c) => ({ ...c, reason: e.target.value }))}
                className={`${fieldClass} h-10`}
              />
            )}
            <ErrorLine>{actionError}</ErrorLine>
          </DialogModal>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── AI providers ────────────────────────────────────────────────────────────

const EMPTY_PROVIDER = {
  name: '',
  adapter: 'openai',
  baseUrl: '',
  apiKey: '',
  modelIds: 'gpt-4o-mini, gpt-4o, o3-mini',
  defaultModel: 'gpt-4o-mini',
  priority: 100,
  timeoutMs: 60000,
  vision: true,
  presetId: 'openai',
};

const CURATED_PROVIDERS = [
  'openai', 'groq', 'google', 'anthropic', 'deepseek', 'openrouter', 'custom',
];

const PRESET_COLORS = {
  openai: '#10a37f',
  groq: '#f55036',
  google: '#4285f4',
  openrouter: '#2563eb',
  deepseek: '#4d6cfa',
  mistral: '#ff7000',
  together: '#0070f3',
  ollama: '#000000',
  custom: '#3b82f6',
  anthropic: '#d97757',
};

const getProviderBrand = (p) => {
  if (!p) return 'custom';
  if (p.adapter && p.adapter !== 'openai-compatible') return p.adapter;
  const name = (p.name || '').toLowerCase();
  const url = (p.baseUrl || '').toLowerCase();
  if (name.includes('ollama') || url.includes('11434')) return 'ollama';
  if (name.includes('vllm')) return 'vllm';
  if (name.includes('lmstudio')) return 'lmstudio';
  if (name.includes('azure')) return 'azure';
  if (name.includes('anthropic')) return 'anthropic';
  return 'custom';
};

const mapProviderToAdapter = (p) => {
  const nativeAdapters = ['openai', 'google', 'groq', 'openrouter', 'deepseek', 'mistral', 'together'];
  if (nativeAdapters.includes(p.id)) {
    return { adapter: p.id, baseUrl: '' };
  }
  if (p.id === 'ollama') {
    return { adapter: 'openai-compatible', baseUrl: 'http://localhost:11434/v1' };
  }
  if (p.id === 'vllm') {
    return { adapter: 'openai-compatible', baseUrl: 'http://localhost:8000/v1' };
  }
  if (p.id === 'lmstudio') {
    return { adapter: 'openai-compatible', baseUrl: 'http://localhost:1234/v1' };
  }
  return { adapter: 'openai-compatible', baseUrl: p.baseUrl || '' };
};

function TestResult({ result }) {
  if (!result) return null;
  return (
    <ul className="mt-2 flex flex-col gap-1.5 rounded-lg border border-[var(--st-line)] bg-[var(--st-surface)] p-2.5 text-[11.5px]">
      {result.steps.map((s) => (
        <li key={s.step} className="flex items-start justify-between gap-2">
          <span className={s.ok ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-red-500 font-medium'}>
            {s.ok ? <Check size={11} className="mr-1 inline" /> : <AlertTriangle size={11} className="mr-1 inline" />}
            {s.step}: {s.ok ? s.detail : s.error?.message}
          </span>
          <span className="shrink-0 tabular-nums text-[var(--text-tertiary)] font-mono text-[10.5px]">
            {s.latencyMs} ms
          </span>
        </li>
      ))}
    </ul>
  );
}

// ─── Supported Providers Directory Modal ──────────────────────────────────────

function SupportedProvidersModal({ isOpen, onClose, onSelectProvider }) {
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const directoryProviders = [...PROVIDERS]
    .filter((p) => p.id !== 'custom')
    .sort((a, b) => (a.price || 0) - (b.price || 0));

  const filtered = directoryProviders.filter((p) => {
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      return (
        p.name?.toLowerCase().includes(q) ||
        p.hint?.toLowerCase().includes(q) ||
        p.defaultModel?.toLowerCase().includes(q) ||
        p.id?.toLowerCase().includes(q) ||
        (p.price === 0 && q === 'free') ||
        (p.price > 0 && q === 'paid')
      );
    }
    return true;
  });

  return (
    <div
      className="fixed inset-0 z-[100060] flex items-center justify-center p-3 sm:p-5 font-sans"
      style={{ isolation: 'isolate' }}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-[480px] max-h-[82vh] flex flex-col bg-[var(--bg-primary)] rounded-xl border border-[var(--st-line-strong)] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-[var(--st-line)] flex items-center justify-between bg-[var(--st-surface)]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[13.5px] font-semibold text-[var(--text-primary)]">
                Supported Providers
              </span>
              <span className="px-1.5 py-0.5 rounded-full bg-[var(--st-fill-strong)] text-[var(--text-tertiary)] text-[10px] font-mono font-medium">
                {directoryProviders.length}
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
              Click any provider to automatically set adapter & recommended models
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-7 w-7 rounded-lg grid place-items-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--st-fill)] transition-colors"
            aria-label="Close"
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        {/* Search */}
        <div className="px-3.5 py-2.5 border-b border-[var(--st-line)] bg-[var(--st-surface)]">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search providers, models, or key formats..."
              className="w-full h-8 pl-8 pr-7 rounded-lg text-[12px] bg-[var(--bg-primary)] border border-[var(--st-line)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--text-primary)] transition-colors"
              autoFocus
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              >
                <X size={10} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>

        {/* Provider List */}
        <div className="flex-1 overflow-y-auto p-3 no-scrollbar divide-y divide-[var(--st-line)]">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-[12px] text-[var(--text-tertiary)]">
              No providers matching "{search}"
            </div>
          ) : (
            filtered.map((p) => (
              <div
                key={p.id}
                onClick={() => {
                  onSelectProvider(p);
                  onClose();
                }}
                className="py-2.5 px-2 flex items-center justify-between gap-3 rounded-lg hover:bg-[var(--st-fill)] cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <BrandLogoBadge id={p.id} color={p.color} name={p.name} size={15} tileSize={28} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-medium text-[var(--text-primary)] leading-tight flex items-center gap-1.5 truncate">
                      <span>{p.name}</span>
                      <span className="text-[10px] text-[var(--text-tertiary)] font-mono">
                        {p.defaultModel}
                      </span>
                    </div>
                    <div className="text-[10px] text-[var(--text-tertiary)] font-mono truncate mt-0.5">
                      {p.hint}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9.5px] font-semibold uppercase tracking-wider ${
                      p.price === 0
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-[var(--st-fill-strong)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {p.price === 0 ? 'Free' : 'Paid'}
                  </span>
                  {p.link && (
                    <a
                      href={p.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="h-6 px-2.5 rounded-full text-[10.5px] font-medium text-[var(--text-secondary)] border border-[var(--st-line-strong)] hover:border-[var(--text-primary)] hover:text-[var(--text-primary)] transition-all flex items-center gap-1"
                    >
                      <span>Keys</span>
                      <ExternalLink size={9} />
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-[var(--st-line)] bg-[var(--st-surface)] flex items-center justify-between text-[11px] text-[var(--text-tertiary)]">
          <span>Showing {filtered.length} of {directoryProviders.length}</span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg text-[11px] font-medium text-[var(--text-primary)] bg-[var(--st-fill)] hover:bg-[var(--st-fill-strong)] transition-colors"
          >
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Simple UnifiedAPIForm-style Provider Modal ──────────────────────────────

function ProviderModal({
  form,
  setForm,
  onSave,
  onTest,
  busy,
  testBusy,
  formError,
  testResult,
  adapters,
  onClose,
}) {
  const [showKey, setShowKey] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showDirectory, setShowDirectory] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy && !testBusy) {
        if (showDirectory) setShowDirectory(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, testBusy, showDirectory, onClose]);

  const activeProvider = PROVIDER_INFO[form.presetId]
    || PROVIDERS.find((p) => p.id === form.adapter)
    || PROVIDERS.find((p) => p.id === 'custom')
    || { id: 'custom', name: form.name || 'Custom Endpoint', color: '#3b82f6' };

  const selectProvider = (p) => {
    const { adapter, baseUrl } = mapProviderToAdapter(p);
    const models = PROVIDER_INFO[p.id]?.models || (p.defaultModel ? [p.defaultModel] : ['gpt-4o-mini']);
    const defaultModel = p.defaultModel || models[0] || '';
    const vision = ['openai', 'google', 'openrouter'].includes(p.id);

    setForm((f) => ({
      ...f,
      presetId: p.id,
      name: f.id ? f.name : p.name,
      adapter,
      baseUrl: adapter === 'openai-compatible' ? (baseUrl || f.baseUrl) : '',
      defaultModel,
      modelIds: models.join(', '),
      vision,
    }));
  };

  const handleKeyChange = (e) => {
    const val = e.target.value;
    setForm((f) => ({ ...f, apiKey: val }));
    if (!form.id && val.trim().length >= 4) {
      const detected = detectProvider(val.trim());
      if (detected) {
        selectProvider(detected);
      }
    }
  };

  const setField = (k) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: val }));
  };

  const canTest = Boolean(form.id || (form.apiKey && form.apiKey.trim().length >= 4));

  return (
    <>
      <div
        className="fixed inset-0 z-[100010] flex items-center justify-center p-3 sm:p-5 font-sans"
        style={{ isolation: 'isolate' }}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="absolute inset-0 bg-black/65 backdrop-blur-sm"
          onClick={!busy && !testBusy ? onClose : undefined}
        />

        <motion.div
          role="dialog"
          aria-modal="true"
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex flex-col w-full max-w-[520px] max-h-[90vh] rounded-xl border border-[var(--st-line-strong)] bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--st-line)] bg-[var(--st-surface)]">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg border border-[var(--st-line)] bg-[var(--st-fill)] flex items-center justify-center shrink-0">
                {activeProvider && activeProvider.id !== 'custom' ? (
                  <BrandLogoBadge
                    id={activeProvider.id}
                    color={activeProvider.color || '#3b82f6'}
                    name={activeProvider.name}
                    size={15}
                    tileSize={22}
                  />
                ) : (
                  <Cpu size={15} className="text-[var(--text-secondary)]" />
                )}
              </div>
              <div className="min-w-0">
                <h2 className="text-[14px] font-semibold text-[var(--text-primary)] leading-tight truncate">
                  {form.id ? `Edit ${form.name}` : 'New AI Provider'}
                </h2>
                <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5 truncate">
                  {form.id ? 'Update credentials and models' : 'Auto-detect via API key or configure manually'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowDirectory(true)}
                className="h-7 px-2.5 rounded-lg border border-[var(--st-line)] bg-[var(--bg-primary)] hover:bg-[var(--st-fill)] text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Compass size={11} className="text-blue-500" />
                <span>Directory (34)</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={busy || testBusy}
                className="h-7 w-7 rounded-lg grid place-items-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--st-fill)] transition-colors"
                aria-label="Close"
              >
                <X size={15} strokeWidth={2} />
              </button>
            </div>
          </div>

          {/* Body */}
          <form
            id="provider-simple-form"
            className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 no-scrollbar"
            onSubmit={(e) => {
              e.preventDefault();
              onSave();
            }}
          >
            {/* 1. Curated Provider Preset Selector */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-medium text-[var(--text-secondary)]">Provider Preset</span>
                {activeProvider.link && (
                  <a
                    href={activeProvider.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-medium text-[var(--text-tertiary)] hover:text-[var(--text-primary)] flex items-center gap-1 transition-colors"
                  >
                    <span>Get API key</span>
                    <ExternalLink size={10} />
                  </a>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {CURATED_PROVIDERS.map((id) => {
                  const p = PROVIDERS.find((item) => item.id === id) || { id, name: id === 'custom' ? 'Custom' : id };
                  const isSelected = activeProvider.id === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => selectProvider(p)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium transition-all ${
                        isSelected
                          ? 'border border-[var(--text-primary)]/40 bg-[var(--st-fill-strong)] text-[var(--text-primary)] shadow-xs'
                          : 'border border-[var(--st-line)] bg-[var(--st-surface)] text-[var(--text-secondary)] hover:border-[var(--st-line-strong)] hover:text-[var(--text-primary)] hover:bg-[var(--st-fill)]'
                      }`}
                    >
                      <BrandLogoBadge id={p.id} color={p.color || '#3b82f6'} name={p.name} size={12} tileSize={18} />
                      <span>{p.name.split(' ')[0]}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setShowDirectory(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border border-dashed border-[var(--st-line-strong)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:border-[var(--text-secondary)] hover:bg-[var(--st-fill)] transition-all"
                >
                  <span>+ More</span>
                </button>
              </div>
            </div>

            {/* 2. API Key Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[12px] font-medium text-[var(--text-primary)]">
                  API Key {form.id && <span className="text-[11px] font-normal text-[var(--text-tertiary)]">(optional)</span>}
                </label>
                <span className="text-[11px] text-[var(--text-tertiary)] flex items-center gap-1">
                  <ShieldCheck size={11} className="text-emerald-500" />
                  <span>Encrypted at rest</span>
                </span>
              </div>

              <div className="relative flex items-center">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none">
                  <KeyRound size={13} />
                </div>
                <input
                  type={showKey ? 'text' : 'password'}
                  autoComplete="off"
                  required={!form.id}
                  placeholder={form.id ? '•••••••••••••••• (leave blank to keep current)' : 'Paste API key (sk-..., gsk_..., etc.)'}
                  value={form.apiKey}
                  onChange={handleKeyChange}
                  className="w-full h-9 pl-8 pr-9 rounded-lg border border-[var(--st-line-strong)] bg-[var(--bg-primary)] text-[12.5px] font-mono text-[var(--text-primary)] placeholder:font-sans placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--text-primary)] focus:ring-1 focus:ring-[var(--text-primary)]/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors p-1"
                  aria-label={showKey ? 'Hide key' : 'Show key'}
                >
                  {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>

              {activeProvider && activeProvider.id !== 'custom' && form.apiKey && (
                <div className="mt-1.5 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] w-fit">
                  <CheckCircle2 size={12} className="shrink-0" />
                  <span>Detected {activeProvider.name} key ({activeProvider.hint})</span>
                </div>
              )}
            </div>

            {/* 3. Display Name & Default Model */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[12px] font-medium text-[var(--text-primary)] block mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={setField('name')}
                  placeholder={activeProvider ? activeProvider.name : 'My Provider'}
                  className="w-full h-9 rounded-lg border border-[var(--st-line-strong)] bg-[var(--bg-primary)] px-3 text-[12.5px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--text-primary)] focus:ring-1 focus:ring-[var(--text-primary)]/20 transition-all"
                />
              </div>

              <div>
                <label className="text-[12px] font-medium text-[var(--text-primary)] block mb-1">
                  Default Model
                </label>
                <input
                  type="text"
                  required
                  value={form.defaultModel}
                  onChange={setField('defaultModel')}
                  placeholder={activeProvider.defaultModel || 'gpt-4o-mini'}
                  className="w-full h-9 rounded-lg border border-[var(--st-line-strong)] bg-[var(--bg-primary)] px-3 text-[12px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--text-primary)] focus:ring-1 focus:ring-[var(--text-primary)]/20 transition-all"
                />
              </div>

              {/* Recommended model chips */}
              {PROVIDER_INFO[activeProvider.id]?.models?.length > 0 && (
                <div className="col-span-1 sm:col-span-2 -mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10.5px] text-[var(--text-tertiary)]">Recommended:</span>
                  {PROVIDER_INFO[activeProvider.id].models.slice(0, 4).map((m) => {
                    const isCurrent = form.defaultModel === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, defaultModel: m }))}
                        className={`px-2 py-0.5 rounded text-[10.5px] font-mono transition-colors ${
                          isCurrent
                            ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] font-medium shadow-xs'
                            : 'bg-[var(--st-fill)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--st-fill-strong)]'
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 4. Base URL (if openai-compatible or custom) */}
            {(form.adapter === 'openai-compatible' || activeProvider.id === 'custom') && (
              <div>
                <label className="text-[12px] font-medium text-[var(--text-primary)] block mb-1">
                  Endpoint Base URL
                </label>
                <input
                  type="text"
                  required
                  placeholder="https://api.example.com/v1"
                  value={form.baseUrl}
                  onChange={setField('baseUrl')}
                  className="w-full h-9 rounded-lg border border-[var(--st-line-strong)] bg-[var(--bg-primary)] px-3 text-[12px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--text-primary)] focus:ring-1 focus:ring-[var(--text-primary)]/20 transition-all"
                />
                <p className="text-[10.5px] text-[var(--text-tertiary)] mt-1 font-mono">
                  e.g. http://localhost:11434/v1 for local Ollama, http://localhost:1234/v1 for LM Studio
                </p>
              </div>
            )}

            {/* 5. Collapsible Advanced Routing Settings */}
            <div className="rounded-lg border border-[var(--st-line)] bg-[var(--st-surface)] overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-[var(--st-fill)] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 text-[12px] font-medium text-[var(--text-secondary)]">
                  <SlidersHorizontal size={13} className="text-[var(--text-tertiary)]" />
                  <span>Routing & Failover Settings</span>
                </div>
                <ChevronDown
                  size={13}
                  className={`text-[var(--text-tertiary)] transition-transform duration-150 ${showAdvanced ? 'rotate-180' : ''}`}
                />
              </button>

              <AnimatePresence>
                {showAdvanced && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden border-t border-[var(--st-line)] px-3.5 py-3 flex flex-col gap-3"
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-medium text-[var(--text-secondary)] block mb-1">
                          Priority (lower routes first)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={10000}
                          value={form.priority}
                          onChange={setField('priority')}
                          className="w-full h-8 rounded-lg border border-[var(--st-line)] bg-[var(--bg-primary)] px-2.5 font-mono text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)]"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-[var(--text-secondary)] block mb-1">
                          Timeout (ms)
                        </label>
                        <input
                          type="number"
                          min={2000}
                          max={300000}
                          step={1000}
                          value={form.timeoutMs}
                          onChange={setField('timeoutMs')}
                          className="w-full h-8 rounded-lg border border-[var(--st-line)] bg-[var(--bg-primary)] px-2.5 font-mono text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-[var(--text-secondary)] block mb-1">
                        Fallback Model IDs (comma-separated)
                      </label>
                      <input
                        value={form.modelIds}
                        onChange={setField('modelIds')}
                        placeholder="gpt-4o-mini, gpt-4o, o3-mini"
                        className="w-full h-8 rounded-lg border border-[var(--st-line)] bg-[var(--bg-primary)] px-2.5 font-mono text-[11.5px] text-[var(--text-primary)] outline-none focus:border-[var(--text-primary)]"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 items-center">
                      <div>
                        <label className="text-[11px] font-medium text-[var(--text-secondary)] block mb-1">
                          Adapter Driver
                        </label>
                        <select
                          value={form.adapter}
                          onChange={setField('adapter')}
                          className="w-full h-8 rounded-lg border border-[var(--st-line)] bg-[var(--bg-primary)] px-2.5 text-[12px] text-[var(--text-primary)] outline-none"
                          style={SELECT_STYLE}
                        >
                          {Object.keys(adapters || { 'openai-compatible': 1 }).map((a) => (
                            <option key={a} value={a}>{a}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center justify-between sm:justify-start gap-3 sm:mt-4 p-2 rounded-lg bg-[var(--st-fill)]">
                        <div className="min-w-0">
                          <div className="text-[11.5px] font-medium text-[var(--text-primary)] leading-tight">Multimodal vision</div>
                          <div className="text-[10px] text-[var(--text-tertiary)]">Accept image attachments</div>
                        </div>
                        <AppleToggle
                          value={form.vision}
                          onChange={(val) => setForm((f) => ({ ...f, vision: val }))}
                          label="Accepts images (vision)"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Test Connection / Validation Status Banner */}
            {testBusy && (
              <div className="flex items-center gap-2.5 p-3 rounded-lg border border-[var(--st-line)] bg-[var(--st-surface)] text-[12px] text-[var(--text-secondary)] animate-pulse">
                <RefreshCw size={13} className="animate-spin text-amber-500" />
                <span>Verifying endpoint connectivity and model latency…</span>
              </div>
            )}

            <TestResult result={testResult} />
            {formError && (
              <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/10 text-[12px] text-red-500 flex items-start gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}
          </form>

          {/* Footer Actions */}
          <div className="px-5 py-3.5 border-t border-[var(--st-line)] bg-[var(--st-surface)] flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={busy || testBusy || !canTest}
              onClick={onTest}
              className="h-8 px-3 rounded-lg border border-[var(--st-line-strong)] bg-[var(--bg-primary)] hover:bg-[var(--st-fill)] text-[12px] font-medium text-[var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 shadow-xs"
            >
              {testBusy ? (
                <>
                  <RefreshCw size={12} className="animate-spin text-amber-500" />
                  <span>Testing…</span>
                </>
              ) : (
                <>
                  <Zap size={12} className="text-amber-500" />
                  <span>Test connection</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busy || testBusy}
                onClick={onClose}
                className="h-8 px-3.5 rounded-lg text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--st-fill)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="provider-simple-form"
                disabled={busy || testBusy}
                className="h-8 px-4 rounded-lg text-[12px] font-medium bg-[var(--text-primary)] text-[var(--bg-primary)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xs flex items-center gap-1.5"
              >
                {busy ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" />
                    <span>Saving…</span>
                  </>
                ) : (
                  <span>{form.id ? 'Save changes' : 'Save provider'}</span>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Supported Providers Directory Modal */}
      <AnimatePresence>
        {showDirectory && (
          <SupportedProvidersModal
            isOpen={showDirectory}
            onClose={() => setShowDirectory(false)}
            onSelectProvider={selectProvider}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function ProvidersTab() {
  const { data, error, loading, reload } = useAdminGet('/api/admin/providers');
  const [form, setForm] = useState(null); // null | { ...fields, id? }
  const [busy, setBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [tests, setTests] = useState({});
  const [rowBusy, setRowBusy] = useState(null);
  const [rowError, setRowError] = useState('');
  const [toDelete, setToDelete] = useState(null);

  const toBody = (f) => {
    const ids = (f.modelIds || f.defaultModel || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (f.defaultModel && !ids.includes(f.defaultModel.trim())) {
      ids.unshift(f.defaultModel.trim());
    }
    const body = {
      name: (f.name || f.defaultModel || 'AI Provider').trim(),
      adapter: f.adapter || 'openai-compatible',
      models: ids.map((id) => ({ id, capabilities: f.vision ? ['text', 'stream', 'vision'] : ['text', 'stream'] })),
      defaultModel: f.defaultModel.trim() || ids[0] || 'gpt-4o-mini',
      priority: Number(f.priority || 100),
      timeoutMs: Number(f.timeoutMs || 60000),
    };
    if (body.adapter === 'openai-compatible') body.baseUrl = (f.baseUrl || '').trim();
    if (f.apiKey && f.apiKey.trim()) body.apiKey = f.apiKey.trim();
    return body;
  };

  const openAddModal = () => {
    setForm({
      ...EMPTY_PROVIDER,
      adapter: 'openai',
      name: 'OpenAI',
      modelIds: 'gpt-4o-mini, gpt-4o, o3-mini',
      defaultModel: 'gpt-4o-mini',
      vision: true,
      presetId: 'openai',
    });
    setFormError('');
    setTests((t) => ({ ...t, form: null }));
  };

  const openEditModal = (p) => {
    const brand = getProviderBrand(p);
    setForm({
      ...EMPTY_PROVIDER,
      id: p.id,
      name: p.name,
      adapter: p.adapter,
      baseUrl: p.adapter === 'openai-compatible' ? (p.baseUrl || '') : '',
      apiKey: '',
      modelIds: p.models.map((m) => m.id).join(', '),
      defaultModel: p.defaultModel,
      priority: p.priority,
      timeoutMs: p.timeoutMs,
      vision: p.models.some((m) => m.capabilities?.includes('vision')),
      presetId: brand,
    });
    setFormError('');
    setTests((t) => ({ ...t, form: null }));
  };

  const save = async () => {
    setBusy(true);
    setFormError('');
    try {
      const b = toBody(form);
      if (form.id) await API.put(`/api/admin/providers/${form.id}`, b);
      else await API.post('/api/admin/providers', b);
      setForm(null);
      await reload();
    } catch (e) {
      setFormError(errOf(e));
    } finally {
      setBusy(false);
    }
  };

  const testInModal = async () => {
    setTestBusy(true);
    setFormError('');
    try {
      const b = toBody(form);
      let r;
      if (form.id && !b.apiKey) {
        r = await API.post(`/api/admin/providers/${form.id}/test`, {});
      } else {
        r = await API.post('/api/admin/providers/test', {
          adapter: b.adapter,
          baseUrl: b.baseUrl,
          apiKey: b.apiKey,
          defaultModel: b.defaultModel,
          timeoutMs: b.timeoutMs,
        });
      }
      setTests((t) => ({ ...t, form: r.data.result }));
    } catch (e) {
      setFormError(errOf(e));
    } finally {
      setTestBusy(false);
    }
  };

  const rowAction = async (p, action) => {
    setRowBusy(p.id);
    setRowError('');
    try {
      if (action === 'test') {
        const r = await API.post(`/api/admin/providers/${p.id}/test`, {});
        setTests((t) => ({ ...t, [p.id]: r.data.result }));
      } else if (action === 'enable' || action === 'disable') {
        await API.post(`/api/admin/providers/${p.id}/enabled`, { enabled: action === 'enable' });
      } else if (action === 'rollback') {
        await API.post(`/api/admin/providers/${p.id}/rollback`);
      }
      await reload();
    } catch (e) {
      setRowError(`${p.name}: ${errOf(e)}`);
    } finally {
      setRowBusy(null);
    }
  };

  const remove = async () => {
    setRowBusy(toDelete.id);
    try {
      await API.delete(`/api/admin/providers/${toDelete.id}`);
      setToDelete(null);
      await reload();
    } catch (e) {
      setRowError(errOf(e));
    } finally {
      setRowBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card
        title="AI providers"
        action={
          <Button
            className="h-8 text-[12px] rounded-lg"
            onClick={openAddModal}
          >
            <Plus size={13} className="mr-1 inline" /> Add provider
          </Button>
        }
      >
        <ErrorLine>{error || rowError}</ErrorLine>
        <ul className="flex flex-col gap-3">
          {data?.providers.map((p) => {
            const brand = getProviderBrand(p);
            const brandColor = PRESET_COLORS[brand] || '#3b82f6';
            return (
              <li
                key={p.id}
                className="rounded-lg border border-[var(--st-line)] bg-[var(--st-surface)] p-3.5 transition-colors duration-150 hover:border-[var(--st-line-strong)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <BrandLogoBadge
                      id={brand}
                      color={brandColor}
                      name={p.name}
                      size={16}
                      tileSize={32}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 truncate text-[13.5px] font-medium text-[var(--text-primary)]">
                        <span>{p.name}</span>
                        <span className="text-[11.5px] font-normal text-[var(--text-tertiary)] font-mono">
                          · {p.adapter} · priority {p.priority}
                        </span>
                      </div>
                      <div className="truncate text-[11.5px] text-[var(--text-tertiary)] font-mono mt-0.5">
                        {p.baseUrl ? `${p.baseUrl} · ` : ''}key {p.maskedKey} · model {p.defaultModel}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Pill tone={p.enabled ? 'ok' : 'neutral'}>{p.enabled ? 'enabled' : 'off'}</Pill>
                    <Pill tone={healthTone(p.health?.status)}>{p.health?.status}</Pill>
                  </div>
                </div>
                {p.health?.lastError && <p className="mt-2 text-[11.5px] text-red-500">{p.health.lastError}</p>}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Button variant="secondary" className="h-8 text-[12px] rounded-lg" disabled={rowBusy === p.id} onClick={() => rowAction(p, 'test')}>
                    {rowBusy === p.id ? 'Working…' : 'Test'}
                  </Button>
                  {p.enabled ? (
                    <Button variant="secondary" className="h-8 text-[12px] rounded-lg" disabled={rowBusy === p.id} onClick={() => rowAction(p, 'disable')}>
                      Disable
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      className="h-8 text-[12px] rounded-lg"
                      disabled={rowBusy === p.id || !p.testedCurrentConfig}
                      title={p.testedCurrentConfig ? '' : 'Run a passing test first'}
                      onClick={() => rowAction(p, 'enable')}
                    >
                      Enable
                    </Button>
                  )}
                  <Button variant="ghost" className="h-8 text-[12px] rounded-lg" onClick={() => openEditModal(p)}>
                    Edit
                  </Button>
                  {p.hasLastKnownGood && !p.testedCurrentConfig && (
                    <Button variant="ghost" className="h-8 text-[12px] rounded-lg" onClick={() => rowAction(p, 'rollback')}>
                      Restore last good config
                    </Button>
                  )}
                  <Button variant="ghost" className="h-8 text-[12px] rounded-lg text-red-500 hover:text-red-600" onClick={() => setToDelete(p)}>
                    Delete
                  </Button>
                </div>
                <TestResult result={tests[p.id]} />
              </li>
            );
          })}
          {loading && !data && (
            <li className="py-8 text-center text-[12.5px] text-[var(--text-tertiary)] animate-pulse">
              Loading AI providers…
            </li>
          )}
          {!loading && data?.providers.length === 0 && (
            <li className="py-2">
              <EmptyState
                icon={Cpu}
                title="No AI providers configured"
                description="Add an OpenAI-compatible endpoint or select a provider preset."
                action={
                  <Button
                    variant="secondary"
                    className="h-8 text-[12px] font-medium rounded-lg"
                    onClick={openAddModal}
                  >
                    <Plus size={13} className="mr-1 inline" /> Add provider
                  </Button>
                }
              />
            </li>
          )}
        </ul>
      </Card>

      <AnimatePresence>
        {form && (
          <ProviderModal
            form={form}
            setForm={setForm}
            onSave={save}
            onTest={testInModal}
            busy={busy}
            testBusy={testBusy}
            formError={formError}
            testResult={tests.form}
            adapters={data?.adapters}
            onClose={() => setForm(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toDelete && (
          <DialogModal
            title={`Delete ${toDelete.name}?`}
            description="Its stored key is deleted too. Requests fall through to the next provider."
            primaryAction={remove}
            primaryLabel="Delete"
            primaryDanger
            loading={rowBusy === toDelete.id}
            onClose={() => setToDelete(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Platform settings ───────────────────────────────────────────────────────

const SETTING_SECTIONS = [
  {
    title: 'Authentication & Access',
    items: [
      ['auth.registrationEnabled', 'Allow new sign-ups'],
      ['auth.requireEmailVerification', 'Require email verification'],
      ['guest.enabled', 'Guest access'],
    ],
  },
  {
    title: 'Sign-in Methods',
    items: [
      ['auth.providers.password', 'Email + password sign-in'],
      ['auth.providers.google', 'Google sign-in'],
      ['auth.providers.github', 'GitHub sign-in'],
    ],
  },
  {
    title: 'AI Providers & Routing',
    items: [
      ['ai.useAdminProviders', 'Use custom AI providers'],
      ['ai.envFallback', 'Fallback to environment providers'],
    ],
  },
  {
    title: 'Maintenance Mode',
    items: [
      ['maintenance.enabled', 'Maintenance mode'],
    ],
  },
];
const getPath = (o, p) => p.split('.').reduce((a, k) => a?.[k], o);
const patchFor = (p, v) => p.split('.').reverse().reduce((acc, k) => ({ [k]: acc }), v);

function SettingsTab() {
  const { data, error, loading, reload } = useAdminGet('/api/admin/settings');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [message, setMessage] = useState(null);

  const apply = async (patch, note) => {
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const r = await API.put('/api/admin/settings', { patch, expectedVersion: data.version, note });
      setMsg(`Saved as version ${r.data.version}.`);
      await reload();
    } catch (e) {
      setErr(errOf(e));
      if (e?.response?.status === 409) await reload();
    } finally {
      setBusy(false);
    }
  };

  const rollback = async (version) => {
    setBusy(true);
    setErr('');
    try {
      await API.post('/api/admin/settings/rollback', { version });
      setMsg(`Restored version ${version}.`);
      await reload();
    } catch (e) {
      setErr(errOf(e));
    } finally {
      setBusy(false);
    }
  };

  const s = data?.settings;
  return (
    <div className="grid gap-4 lg:grid-cols-2 flex-1 h-full min-h-0 overflow-y-auto lg:overflow-hidden">
      {/* Left Card: Platform Settings */}
      <Card
        title="Platform settings"
        className="flex flex-col h-full min-h-0 overflow-hidden"
        style={{ height: '100%' }}
        action={
          <div className="flex items-center gap-2">
            {data?.version && (
              <span className="inline-flex items-center gap-1 rounded-md border border-[var(--st-line-strong)] bg-[var(--st-fill)] px-2 py-0.5 text-[11px] font-mono text-[var(--text-secondary)]">
                v{data.version}
              </span>
            )}
            <Button
              variant="ghost"
              className="h-8 px-2.5 text-[12px] inline-flex items-center gap-1.5"
              onClick={reload}
              disabled={loading}
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </Button>
          </div>
        }
      >
        <ErrorLine onRetry={reload}>{error || err}</ErrorLine>
        {msg && <p className="mb-2.5 rounded-lg bg-emerald-500/[0.07] px-3 py-2 text-[12px] text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">{msg}</p>}

        {loading && !data && (
          <div className="flex flex-col gap-3 py-2 flex-1">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse rounded-lg border border-[var(--st-line)] bg-[var(--st-fill)]/20 p-3.5 flex items-center justify-between">
                <div className="h-3.5 w-32 rounded bg-[var(--st-fill)]" />
                <div className="h-5 w-10 rounded-full bg-[var(--st-fill)]" />
              </div>
            ))}
          </div>
        )}

        {s && (
          <div className="flex flex-col gap-3.5 flex-1 min-h-0 overflow-y-auto pr-0.5">
            {SETTING_SECTIONS.map((sec) => (
              <div key={sec.title} className="flex flex-col gap-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] px-0.5">
                  {sec.title}
                </div>
                <div className="flex flex-col gap-1.5">
                  {sec.items.map(([path, label]) => (
                    <div
                      key={path}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg border border-[var(--st-line)] bg-[var(--st-fill)]/25 transition-colors duration-150 hover:border-[var(--st-line-strong)] hover:bg-[var(--st-fill)]/40"
                    >
                      <span className="text-[12.5px] sm:text-[13px] font-medium text-[var(--text-primary)] select-none">
                        {label}
                      </span>
                      <div className={`shrink-0 ${busy ? 'pointer-events-none opacity-50' : ''}`}>
                        <AppleToggle
                          label={label}
                          value={!!getPath(s, path)}
                          onChange={(v) => apply(patchFor(path, v), `${label}: ${v ? 'on' : 'off'}`)}
                        />
                      </div>
                    </div>
                  ))}

                  {sec.title === 'Maintenance Mode' && (
                    <form
                      className="mt-1 flex flex-col sm:flex-row gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        apply({ maintenance: { message: message ?? s.maintenance.message } }, 'Maintenance message');
                      }}
                    >
                      <input
                        aria-label="Maintenance message"
                        placeholder="Maintenance message shown to users"
                        maxLength={300}
                        value={message ?? s.maintenance.message}
                        onChange={(e) => setMessage(e.target.value)}
                        className={`${fieldClass} h-8.5 text-[12px] flex-1`}
                      />
                      <Button
                        type="submit"
                        variant="secondary"
                        disabled={busy}
                        className="h-8.5 px-3 text-[12px] shrink-0"
                      >
                        Save message
                      </Button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Right Card: Version History */}
      <Card
        title="History"
        className="flex flex-col h-full min-h-0 overflow-hidden"
        style={{ height: '100%' }}
        action={
          data?.versions && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--st-line)] bg-[var(--st-fill)] px-2.5 py-0.5 text-[11px] font-mono text-[var(--text-tertiary)]">
              {data.versions.length} {data.versions.length === 1 ? 'version' : 'versions'}
            </span>
          )
        }
      >
        {loading && !data && (
          <div className="flex flex-col gap-2.5 py-2 flex-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-lg border border-[var(--st-line)] bg-[var(--st-fill)]/20 p-3.5 space-y-2">
                <div className="h-3.5 w-28 rounded bg-[var(--st-fill)]" />
                <div className="h-2.5 w-44 rounded bg-[var(--st-fill)]" />
              </div>
            ))}
          </div>
        )}

        {data && (
          <div className="flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-0.5">
            {data.versions.map((v) => (
              <div
                key={v.version}
                className={`rounded-lg border p-3 flex flex-col gap-1.5 transition-colors duration-150 ${
                  v.version === data.version
                    ? 'border-emerald-500/30 bg-emerald-500/[0.05]'
                    : 'border-[var(--st-line)] bg-[var(--st-fill)]/25 hover:border-[var(--st-line-strong)] hover:bg-[var(--st-fill)]/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[12.5px] font-semibold text-[var(--text-primary)]">
                      v{v.version}
                    </span>
                    <span className="text-[11px] font-mono text-[var(--text-tertiary)] truncate">
                      {fmt(v.createdAt)}
                    </span>
                  </div>
                  {v.version === data.version ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10.5px] font-medium text-emerald-400">
                      <Check size={10} />
                      Current
                    </span>
                  ) : (
                    <Button
                      variant="ghost"
                      className="h-6.5 px-2 text-[11.5px] font-medium"
                      disabled={busy}
                      onClick={() => rollback(v.version)}
                    >
                      Restore
                    </Button>
                  )}
                </div>

                {v.note && (
                  <div className="text-[11.5px] text-[var(--text-secondary)] break-words leading-relaxed">
                    {v.note}
                  </div>
                )}
              </div>
            ))}

            {data.versions.length === 0 && (
              <div className="flex flex-1 flex-col items-center justify-center py-8">
                <EmptyState
                  icon={History}
                  title="Default settings"
                  description="No modifications recorded."
                  compact
                />
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Activity & diagnostics ──────────────────────────────────────────────────

function formatAuditDetails(e) {
  const meta = e?.meta;
  if (!meta || typeof meta !== 'object' || Object.keys(meta).length === 0) {
    if (e?.target) return `Target: ${e.target}`;
    return '—';
  }

  // 1. Settings patch / changes: {"version":2,"patch":{"auth":{"registrationEnabled":false}},"before":...}
  if (meta.patch && typeof meta.patch === 'object') {
    const changes = [];
    const walk = (obj, prefix = '') => {
      for (const [k, v] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${k}` : k;
        if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
          walk(v, fullKey);
        } else {
          if (k === 'registrationEnabled') {
            changes.push(v ? 'Allowed user registrations' : 'Disabled user registrations');
          } else if (k === 'requireEmailVerification') {
            changes.push(v ? 'Required email verification' : 'Disabled email verification requirement');
          } else if (k === 'enabled' && prefix.includes('maintenance')) {
            changes.push(v ? 'Turned on maintenance mode' : 'Turned off maintenance mode');
          } else {
            changes.push(`${fullKey}: ${String(v)}`);
          }
        }
      }
    };
    walk(meta.patch);
    const ver = meta.version ? ` (v${meta.version})` : '';
    return changes.length > 0 ? `${changes.join(', ')}${ver}` : `Updated platform settings${ver}`;
  }

  // 2. Settings rollback: {"to":1,"newVersion":3}
  if (meta.to !== undefined && (meta.newVersion !== undefined || e.type?.includes('rollback'))) {
    return `Restored settings from version ${meta.to}${meta.newVersion ? ` (now v${meta.newVersion})` : ''}`;
  }

  // 3. Role change: {"from":"user","to":"superadmin","via":"SUPERADMIN_EMAILS"}
  if (meta.from !== undefined || meta.to !== undefined) {
    const via = meta.via ? ` via ${meta.via}` : '';
    return `Role: ${meta.from || 'user'} → ${meta.to || 'admin'}${via}`;
  }

  // 4. Method (OAuth / Sign in): {"method":"google"} or {"method":"password"}
  if (meta.method) {
    const m = String(meta.method).toLowerCase();
    const methodName = m === 'google' ? 'Google' : m === 'github' ? 'GitHub' : m === 'password' ? 'Email & Password' : meta.method;
    return `Signed in with ${methodName}`;
  }

  // 5. Send failed / status: {"status":"send_failed"}
  if (meta.status === 'send_failed' || e.type === 'email.delivery_failed') {
    const purpose = meta.purpose ? ` (${String(meta.purpose).replace(/_/g, ' ')})` : '';
    return `Email delivery failed${purpose}`;
  }

  // 6. Provider created / updated / deleted
  if (meta.name && (e.type?.includes('provider') || meta.adapter)) {
    const adapter = meta.adapter ? ` (${meta.adapter})` : '';
    return `Provider: ${meta.name}${adapter}`;
  }
  if (meta.fields && Array.isArray(meta.fields)) {
    const keyInfo = meta.keyReplaced ? ' • API key updated' : '';
    return `Updated: ${meta.fields.join(', ')}${keyInfo}`;
  }

  // 7. Sessions revoked: {"count": 3} or {"sessionsRevoked": 2}
  if (meta.count !== undefined || meta.sessionsRevoked !== undefined) {
    const count = meta.count ?? meta.sessionsRevoked;
    const reason = meta.reason ? ` (${meta.reason})` : '';
    return `Revoked ${count} active session${count === 1 ? '' : 's'}${reason}`;
  }

  // 8. Reasons / generic messages
  if (meta.reason) {
    const readableReason = String(meta.reason).replace(/_/g, ' ');
    return `Reason: ${readableReason}`;
  }

  // 9. Provider linking / unlinking
  if (meta.provider) {
    return `Provider: ${meta.provider}`;
  }

  // Generic fallback: format key-value pairs cleanly without raw JSON punctuation
  const entries = Object.entries(meta).filter(([k]) => !['before', 'ip', 'requestId'].includes(k));
  if (entries.length > 0) {
    return entries
      .map(([k, v]) => `${k.replace(/([A-Z])/g, ' $1').toLowerCase()}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
      .join(' • ');
  }

  return JSON.stringify(meta);
}

function AnimatedCheckbox({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onChange}
      className={`group relative inline-flex items-center gap-1.5 sm:gap-2 rounded-lg border px-2 sm:px-2.5 py-1 text-[11px] sm:text-[12px] font-medium transition-all duration-200 select-none cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-500/50 ${
        checked
          ? 'border-rose-500/35 bg-rose-500/10 text-rose-300 shadow-[0_1px_8px_rgba(244,63,94,0.15)]'
          : 'border-[var(--st-line)] bg-[var(--st-fill)]/60 text-[var(--text-secondary)] hover:border-[var(--st-line-strong)] hover:bg-[var(--st-fill)] hover:text-[var(--text-primary)]'
      }`}
    >
      <div
        className={`relative grid h-4 w-4 place-items-center rounded-[5px] border transition-all duration-200 ${
          checked
            ? 'border-rose-500 bg-rose-500 text-white'
            : 'border-[var(--st-line-strong)] bg-[var(--st-surface)] group-hover:border-[var(--text-tertiary)]'
        }`}
      >
        <AnimatePresence>
          {checked && (
            <motion.svg
              key="check-icon"
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.3, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 28 }}
              className="h-2.5 w-2.5 text-white"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <motion.path
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                d="M2.5 6.5L4.8 8.8L9.5 3.5"
              />
            </motion.svg>
          )}
        </AnimatePresence>
      </div>
      <span className="leading-none">{label}</span>
      {checked && (
        <motion.span
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="inline-flex h-1.5 w-1.5 rounded-full bg-rose-400"
        />
      )}
    </button>
  );
}

function AuditTab() {
  const [failuresOnly, setFailuresOnly] = useState(false);
  const [page, setPage] = useState(1);
  const { data, error, loading } = useAdminGet(`/api/admin/audit?page=${page}&limit=50${failuresOnly ? '&outcome=failure' : ''}`);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  return (
    <Card
      title="Security & admin activity"
      className="flex flex-1 flex-col h-full min-h-0 overflow-hidden"
      style={{ height: '100%' }}
      action={
        <AnimatedCheckbox
          checked={failuresOnly}
          onChange={() => {
            setFailuresOnly((v) => !v);
            setPage(1);
          }}
          label="Failures only"
        />
      }
    >
      <ErrorLine>{error}</ErrorLine>
      {/* Desktop Table View (>= 640px) */}
      <div className="hidden sm:block flex-1 min-h-0 overflow-y-auto overflow-x-auto rounded-lg border border-[var(--st-line)] bg-[var(--st-fill)]/15">
        <table className="w-full text-left text-[12.5px] border-collapse">
          <thead className="sticky top-0 z-10 bg-[var(--st-surface)]/95 backdrop-blur-md border-b border-[var(--st-line)] text-[11.5px] text-[var(--text-tertiary)]">
            <tr>
              <th className="py-3 pl-5 pr-4 font-medium w-[210px] shrink-0">When</th>
              <th className="py-3 pr-4 font-medium w-[260px] shrink-0">Event</th>
              <th className="py-3 pr-4 font-medium w-[140px] shrink-0">Outcome</th>
              <th className="py-3 pr-5 font-medium">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--st-line)]">
            {data?.events.map((e) => {
              const friendlyDetails = formatAuditDetails(e);
              return (
                <tr key={e._id} className="align-middle transition-colors duration-150 hover:bg-[var(--st-fill)]/40">
                  <td className="whitespace-nowrap py-3.5 pl-5 pr-4 text-[var(--text-tertiary)] text-[12px] font-mono">
                    {fmt(e.createdAt)}
                  </td>
                  <td className="pr-4 py-3.5">
                    <div className="font-medium text-[var(--text-primary)] text-[13px] leading-tight">
                      {humanEventName(e.type)}
                    </div>
                    <div className="text-[10.5px] text-[var(--text-tertiary)] font-mono mt-0.5">
                      {e.type}
                    </div>
                  </td>
                  <td className="pr-4 py-3.5 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-medium ${
                        e.outcome === 'failure'
                          ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                          : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      }`}
                    >
                      {e.outcome === 'failure' ? <AlertTriangle size={11} /> : <Check size={11} />}
                      {e.outcome === 'failure' ? 'Failed' : 'Success'}
                    </span>
                  </td>
                  <td className="py-3.5 pr-5 text-[var(--text-secondary)] text-[12.5px]">
                    <span className="leading-relaxed block">
                      {friendlyDetails}
                    </span>
                  </td>
                </tr>
              );
            })}
            {loading && !data && (
              <tr>
                <td colSpan={4} className="py-12 text-center text-[12.5px] text-[var(--text-tertiary)] animate-pulse">
                  Loading security and audit activity…
                </td>
              </tr>
            )}
            {!loading && (!data || data.events.length === 0) && (
              <tr>
                <td colSpan={4} className="py-10">
                  <EmptyState
                    icon={failuresOnly ? CheckCircle2 : ScrollText}
                    tone={failuresOnly ? 'ok' : 'neutral'}
                    title={failuresOnly ? 'No failures recorded' : 'No activity recorded'}
                    description={failuresOnly ? 'All recent security and platform operations completed successfully.' : undefined}
                    action={
                      failuresOnly ? (
                        <Button variant="ghost" className="h-7 px-2.5 text-[11.5px]" onClick={() => setFailuresOnly(false)}>
                          Show all activity
                        </Button>
                      ) : null
                    }
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Native Event List View (< 640px) */}
      <div className="sm:hidden flex-1 min-h-0 overflow-y-auto divide-y divide-[var(--st-line)] rounded-lg border border-[var(--st-line)] bg-[var(--st-fill)]/10">
        {data?.events.map((e) => {
          const friendlyDetails = formatAuditDetails(e);
          return (
            <div key={e._id} className="p-3.5 flex flex-col gap-1.5 transition-colors duration-150 hover:bg-[var(--st-fill)]/30 active:bg-[var(--st-fill)]/50">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-[13px] text-[var(--text-primary)] leading-tight">
                    {humanEventName(e.type)}
                  </div>
                  <div className="text-[10px] text-[var(--text-tertiary)] font-mono mt-0.5 truncate">
                    {e.type}
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium shrink-0 ${
                    e.outcome === 'failure'
                      ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  }`}
                >
                  {e.outcome === 'failure' ? <AlertTriangle size={10} /> : <Check size={10} />}
                  {e.outcome === 'failure' ? 'Failed' : 'Success'}
                </span>
              </div>

              {friendlyDetails && friendlyDetails !== '—' && (
                <div className="text-[12px] text-[var(--text-secondary)] leading-snug">
                  {friendlyDetails}
                </div>
              )}

              <div className="mt-0.5 text-[10.5px] text-[var(--text-tertiary)] font-mono">
                {fmt(e.createdAt)}
              </div>
            </div>
          );
        })}
        {loading && !data && (
          <div className="py-12 text-center text-[12px] text-[var(--text-tertiary)] animate-pulse">
            Loading security and audit activity…
          </div>
        )}
        {!loading && (!data || data.events.length === 0) && (
          <div className="py-8 px-3">
            <EmptyState
              compact={true}
              icon={failuresOnly ? CheckCircle2 : ScrollText}
              tone={failuresOnly ? 'ok' : 'neutral'}
              title={failuresOnly ? 'No failures recorded' : 'No activity recorded'}
              description={failuresOnly ? 'All recent operations completed successfully.' : undefined}
              action={
                failuresOnly ? (
                  <Button variant="ghost" className="h-7 px-2.5 text-[11.5px]" onClick={() => setFailuresOnly(false)}>
                    Show all activity
                  </Button>
                ) : null
              }
            />
          </div>
        )}
      </div>

      <div className="mt-3.5 pt-3 shrink-0 flex items-center justify-between gap-2 border-t border-[var(--st-line)] text-[12px] text-[var(--text-tertiary)]">
        <span className="text-[11px] sm:text-[11.5px] text-[var(--text-tertiary)] truncate">
          {data?.total !== undefined ? `${data.total} event${data.total === 1 ? '' : 's'}` : ''}
        </span>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button
            variant="ghost"
            className="h-7 px-2 sm:px-2.5 text-[11px] sm:text-[11.5px]"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="font-mono text-[11px] px-1 text-[var(--text-secondary)]">
            {page} / {pages}
          </span>
          <Button
            variant="ghost"
            className="h-7 px-2 sm:px-2.5 text-[11px] sm:text-[11.5px]"
            disabled={page >= pages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </Card>
  );
}

function formatUptime(seconds) {
  if (!seconds || seconds <= 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const GoogleBrandIcon = ({ size = 15 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="shrink-0">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const GitHubBrandIcon = ({ size = 15 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" className="shrink-0">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);

function DiagnosticsTab() {
  const { data, error, loading, reload } = useAdminGet('/api/admin/diagnostics');
  const [mailTest, setMailTest] = useState({ busy: false, ok: '', err: '' });
  const testMail = async () => {
    setMailTest({ busy: true, ok: '', err: '' });
    try {
      const r = await API.post('/api/admin/diagnostics/test-email');
      setMailTest({ busy: false, ok: `Sent to ${r.data.to}. Check inbox and spam.`, err: '' });
    } catch (e) {
      setMailTest({ busy: false, ok: '', err: errOf(e, 'Sending failed') });
    }
  };

  const totalFailures = data
    ? (data.failuresLast24h?.reduce((s, f) => s + (f.count || 0), 0) || 0) +
      (data.aiErrorsLast24h?.reduce((s, f) => s + (f.count || 0), 0) || 0)
    : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-2 flex-1 h-full min-h-0 overflow-y-auto lg:overflow-hidden">
      {/* Left Card: Dependencies */}
      <Card
        title="Dependencies"
        className="flex flex-col h-full min-h-0 overflow-hidden"
        style={{ height: '100%' }}
        action={
          <Button
            variant="ghost"
            className="h-8 px-3 text-[12px] inline-flex items-center gap-1.5"
            onClick={reload}
            disabled={loading}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </Button>
        }
      >
        <ErrorLine onRetry={reload}>{error}</ErrorLine>

        {loading && !data && (
          <div className="flex flex-col gap-2.5 py-2 flex-1">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse rounded-lg border border-[var(--st-line)] bg-[var(--st-fill)]/20 p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-[var(--st-fill)]" />
                  <div className="space-y-1.5">
                    <div className="h-3.5 w-24 rounded bg-[var(--st-fill)]" />
                    <div className="h-2.5 w-36 rounded bg-[var(--st-fill)]" />
                  </div>
                </div>
                <div className="h-5 w-16 rounded-full bg-[var(--st-fill)]" />
              </div>
            ))}
          </div>
        )}

        {data && (
          <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto pr-0.5">
            {/* MongoDB Database */}
            <div className="rounded-lg border border-[var(--st-line)] bg-[var(--st-fill)]/25 p-3.5 transition-colors duration-150 hover:border-[var(--st-line-strong)] hover:bg-[var(--st-fill)]/40">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${data.database.connected ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border-red-500/20 bg-red-500/10 text-red-400'}`}>
                    <Database size={15} />
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[13px] font-medium text-[var(--text-primary)]">MongoDB</span>
                    {data.database.connected && data.database.pingMs !== undefined && data.database.pingMs !== null && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-[var(--st-fill)] px-2 py-0.5 text-[11px] font-mono text-[var(--text-tertiary)] border border-[var(--st-line)]">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        {data.database.pingMs} ms ping
                      </span>
                    )}
                  </div>
                </div>
                <Pill tone={data.database.connected ? 'ok' : 'bad'}>
                  {data.database.connected ? 'connected' : 'disconnected'}
                </Pill>
              </div>
            </div>

            {/* Email (SMTP) */}
            <div className="rounded-lg border border-[var(--st-line)] bg-[var(--st-fill)]/25 p-3.5 transition-colors duration-150 hover:border-[var(--st-line-strong)] hover:bg-[var(--st-fill)]/40">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border mt-0.5 ${data.mail.configured ? 'border-sky-500/20 bg-sky-500/10 text-sky-400' : 'border-[var(--st-line)] bg-[var(--st-fill)] text-[var(--text-tertiary)]'}`}>
                    <Mail size={15} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-[var(--text-primary)]">Email (SMTP)</span>
                    </div>
                    {data.mail.configured && (
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-[var(--text-secondary)]">
                        <span className="font-mono text-[var(--text-primary)]">
                          {data.mail.host}:{data.mail.port}
                        </span>
                        <span className="rounded bg-[var(--st-fill)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--text-tertiary)] uppercase border border-[var(--st-line)]">
                          {data.mail.secure ? 'TLS' : 'STARTTLS'}
                        </span>
                        {data.mail.from && (
                          <span className="truncate text-[var(--text-tertiary)]">
                            · from {data.mail.from}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <Pill tone={data.mail.configured ? 'ok' : 'neutral'}>
                  {data.mail.configured ? 'configured' : 'not configured'}
                </Pill>
              </div>

              <div className="mt-3 pt-3 border-t border-[var(--st-line)] flex flex-wrap items-center justify-between gap-2.5">
                <Button
                  variant="secondary"
                  className="h-8 px-3 text-[12px] font-medium inline-flex items-center gap-1.5"
                  disabled={mailTest.busy || !data.mail.configured}
                  onClick={testMail}
                >
                  <Send size={12} className={mailTest.busy ? 'animate-pulse' : ''} />
                  <span>{mailTest.busy ? 'Sending test…' : 'Send test email to me'}</span>
                </Button>

                {mailTest.ok && (
                  <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={13} className="shrink-0" />
                    <span>{mailTest.ok}</span>
                  </span>
                )}
              </div>
              {mailTest.err && (
                <div className="mt-2.5">
                  <ErrorLine>{mailTest.err}</ErrorLine>
                </div>
              )}
            </div>

            {/* OAuth Services */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="rounded-lg border border-[var(--st-line)] bg-[var(--st-fill)]/25 p-3 transition-colors duration-150 hover:border-[var(--st-line-strong)] hover:bg-[var(--st-fill)]/40">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[var(--st-line)] bg-[var(--st-surface)]">
                      <GoogleBrandIcon size={14} />
                    </span>
                    <span className="text-[12.5px] font-medium text-[var(--text-primary)] truncate">Google OAuth</span>
                  </div>
                  <Pill tone={data.oauth.google ? 'ok' : 'neutral'}>
                    {data.oauth.google ? 'configured' : 'not configured'}
                  </Pill>
                </div>
              </div>

              <div className="rounded-lg border border-[var(--st-line)] bg-[var(--st-fill)]/25 p-3 transition-colors duration-150 hover:border-[var(--st-line-strong)] hover:bg-[var(--st-fill)]/40">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[var(--st-line)] bg-[var(--st-surface)] text-[var(--text-primary)]">
                      <GitHubBrandIcon size={14} />
                    </span>
                    <span className="text-[12.5px] font-medium text-[var(--text-primary)] truncate">GitHub OAuth</span>
                  </div>
                  <Pill tone={data.oauth.github ? 'ok' : 'neutral'}>
                    {data.oauth.github ? 'configured' : 'not configured'}
                  </Pill>
                </div>
              </div>
            </div>

            {/* Instance & Settings Runtime */}
            <div className="rounded-lg border border-[var(--st-line)] bg-[var(--st-fill)]/25 p-3.5 transition-colors duration-150 hover:border-[var(--st-line-strong)] hover:bg-[var(--st-fill)]/40">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-400">
                    <Server size={15} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-[var(--text-primary)]">Server Runtime</span>
                      <span className="rounded bg-[var(--st-fill)] px-1.5 py-0.5 text-[10.5px] font-mono text-[var(--text-secondary)] border border-[var(--st-line)]">
                        {data.instance.node}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-[var(--text-tertiary)] font-mono">
                      <span>PID: {data.instance.pid}</span>
                      <span>·</span>
                      <span>Uptime: {formatUptime(data.instance.uptimeS)}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="inline-flex items-center gap-1 rounded-md bg-[var(--st-fill-strong)] px-2 py-0.5 text-[11.5px] font-mono text-[var(--text-secondary)] border border-[var(--st-line-strong)]">
                    v{data.configVersion}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Right Card: Failures in the last 24 hours */}
      <Card
        title="Failures in the last 24 hours"
        className="flex flex-col h-full min-h-0 overflow-hidden"
        style={{ height: '100%' }}
        action={
          data ? (
            totalFailures === 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11.5px] font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={12} />
                <span>0 issues</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/25 bg-rose-500/10 px-2.5 py-0.5 text-[11.5px] font-medium text-rose-400">
                <AlertTriangle size={12} />
                <span>{totalFailures} {totalFailures === 1 ? 'failure' : 'failures'}</span>
              </span>
            )
          ) : null
        }
      >
        {loading && !data && (
          <div className="flex flex-col gap-2.5 py-2 flex-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-lg border border-[var(--st-line)] bg-[var(--st-fill)]/20 p-3.5 flex items-center justify-between">
                <div className="space-y-1.5">
                  <div className="h-3.5 w-36 rounded bg-[var(--st-fill)]" />
                  <div className="h-2.5 w-48 rounded bg-[var(--st-fill)]" />
                </div>
                <div className="h-5 w-16 rounded-full bg-[var(--st-fill)]" />
              </div>
            ))}
          </div>
        )}

        {data && (
          <div className="flex flex-col gap-2.5 flex-1 min-h-0 overflow-y-auto pr-0.5">
            {data.failuresLast24h.map((f) => (
              <div
                key={f._id}
                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-lg border border-red-500/25 bg-red-500/[0.06] p-3 transition-all duration-150 hover:border-red-500/40 hover:bg-red-500/[0.09]"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-red-500/30 bg-red-500/15 text-red-400 mt-0.5 sm:mt-0">
                    <AlertTriangle size={14} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-red-200/95 leading-tight">
                      {humanEventName(f._id)}
                    </div>
                    <div className="mt-0.5 text-[11px] font-mono text-red-400/80 truncate">
                      {f._id}
                    </div>
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-red-500/15">
                  <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/15 px-2 py-0.5 text-[11px] font-medium text-red-300">
                    {f.count} {f.count === 1 ? 'failure' : 'failures'}
                  </span>
                  {f.last && (
                    <span className="text-[10.5px] font-mono text-[var(--text-tertiary)]">
                      Last: {fmt(f.last)}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {data.aiErrorsLast24h.map((f) => (
              <div
                key={`ai-${f._id}`}
                className="group flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] p-3 transition-all duration-150 hover:border-amber-500/40 hover:bg-amber-500/[0.09]"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-amber-500/30 bg-amber-500/15 text-amber-400 mt-0.5 sm:mt-0">
                    <Cpu size={14} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-amber-200/95 leading-tight">
                      AI Provider Call Failed
                    </div>
                    <div className="mt-0.5 text-[11px] font-mono text-amber-400/80 truncate">
                      Error: {f._id}
                    </div>
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-amber-500/15">
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-300">
                    {f.count} {f.count === 1 ? 'error' : 'errors'}
                  </span>
                </div>
              </div>
            ))}

            {data.failuresLast24h.length === 0 && data.aiErrorsLast24h.length === 0 && (
              <div className="flex flex-1 flex-col items-center justify-center py-10 px-4">
                <EmptyState
                  icon={CheckCircle2}
                  tone="ok"
                  title="All systems operational"
                  description="Zero service, authentication, or AI failures recorded in the last 24 hours."
                  compact
                />
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Admin access (super-admin) ──────────────────────────────────────────────

const REAUTH_TEXT = 'For security, approving or removing an admin needs a sign-in in the last 15 minutes. Sign out, sign back in, and try again.';
const accessErr = (e, f) => (e?.response?.data?.code === 'REAUTH_REQUIRED' ? REAUTH_TEXT : errOf(e, f));
const STATUS_TONE = { pending: 'warn', approved: 'ok', rejected: 'bad', cancelled: 'neutral', revoked: 'bad' };

function AccessTab({ me }) {
  const [filter, setFilter] = useState('pending');
  const requests = useAdminGet(`/api/admin/access/requests${filter ? `?status=${filter}` : ''}`);
  const admins = useAdminGet('/api/admin/access/admins');
  const [confirm, setConfirm] = useState(null); // { kind: 'approve'|'reject'|'revoke', ... }
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const run = async () => {
    setBusy(true);
    setErr('');
    try {
      if (confirm.kind === 'approve') await API.post(`/api/admin/access/requests/${confirm.id}/approve`, { note });
      if (confirm.kind === 'reject') await API.post(`/api/admin/access/requests/${confirm.id}/reject`, { note });
      if (confirm.kind === 'revoke') await API.post(`/api/admin/access/admins/${confirm.id}/revoke`);
      setConfirm(null);
      setNote('');
      await Promise.all([requests.reload(), admins.reload()]);
    } catch (e) {
      setErr(accessErr(e, 'That did not work.'));
      await requests.reload();
    } finally {
      setBusy(false);
    }
  };

  const open = (c) => { setErr(''); setNote(''); setConfirm(c); };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
      <Card
        title={`Admin access requests${requests.data?.pending ? ` · ${requests.data.pending} waiting` : ''}`}
        action={
          <FilterDropdown
            ariaLabel="Filter requests by status"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'pending', label: 'Waiting' },
              { value: 'approved', label: 'Approved' },
              { value: 'rejected', label: 'Declined' },
              { value: 'revoked', label: 'Revoked' },
              { value: 'cancelled', label: 'Cancelled' },
              { value: '', label: 'All' },
            ]}
          />
        }
      >
        <ErrorLine>{requests.error}</ErrorLine>
        <ul className="flex flex-col gap-2">
          {requests.data?.requests.map((r) => (
            <li key={r.id} className="rounded-lg border border-[var(--st-line)] p-3 transition-colors duration-150 hover:border-[var(--st-line-strong)]">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="break-all text-[13.5px] font-medium">{r.email}</div>
                  <div className="text-[11.5px] text-[var(--text-tertiary)]">{r.name} · asked {fmt(r.createdAt)}</div>
                </div>
                <Pill tone={STATUS_TONE[r.status]}>{r.status === 'rejected' ? 'declined' : r.status}</Pill>
              </div>
              {r.reason && <p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-[var(--st-fill)] px-3 py-2 text-[12.5px] text-[var(--text-secondary)]">{r.reason}</p>}
              {r.decisionNote && <p className="mt-1.5 text-[11.5px] text-[var(--text-tertiary)]">Note: {r.decisionNote}</p>}
              {r.status === 'pending' && (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <Button className="h-8 text-[12px]" onClick={() => open({ kind: 'approve', id: r.id, label: `Give admin access to ${r.email}?` })}>Approve</Button>
                  <Button variant="secondary" className="h-8 text-[12px]" onClick={() => open({ kind: 'reject', id: r.id, label: `Decline ${r.email}?` })}>Decline</Button>
                </div>
              )}
            </li>
          ))}
          {requests.loading && !requests.data && (
            <li className="py-8 text-center text-[12.5px] text-[var(--text-tertiary)] animate-pulse">
              Loading access requests…
            </li>
          )}
          {!requests.loading && requests.data?.requests.length === 0 && (
            <li className="py-2">
              <EmptyState
                icon={filter === 'pending' ? ShieldCheck : Inbox}
                title={filter === 'pending' ? 'No pending requests' : 'No requests found'}
                action={
                  filter !== 'pending' ? (
                    <Button variant="ghost" className="h-7 px-2.5 text-[11.5px]" onClick={() => setFilter('pending')}>
                      Show pending
                    </Button>
                  ) : null
                }
              />
            </li>
          )}
        </ul>
      </Card>

      <Card title="Admins">
        <ErrorLine>{admins.error}</ErrorLine>
        <ul className="divide-y divide-[var(--st-line)]">
          {admins.data?.admins.map((a) => (
            <li key={a.id} className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-lg transition-colors duration-150 hover:bg-[var(--st-fill)]/40">
              <div className="min-w-0 flex-1">
                <div className="break-all text-[13px] font-medium">{a.email}</div>
                <div className="text-[11.5px] text-[var(--text-tertiary)]">{a.name}{a.lastLoginAt ? ` · last sign-in ${new Date(a.lastLoginAt).toLocaleDateString()}` : ''}</div>
              </div>
              {a.role === 'superadmin'
                ? <Pill tone="warn">{a.fromEnv ? 'super-admin (.env)' : 'super-admin'}</Pill>
                : String(a.id) !== String(me?.id) && (
                  <Button variant="ghost" className="h-8 px-3 text-[12px] text-red-500" onClick={() => open({ kind: 'revoke', id: a.id, label: `Remove admin access from ${a.email}?` })}>Revoke</Button>
                )}
            </li>
          ))}
          {admins.loading && !admins.data && (
            <li className="py-6 text-center text-[12px] text-[var(--text-tertiary)] animate-pulse">
              Loading administrators…
            </li>
          )}
          {!admins.loading && admins.data?.admins.length === 0 && (
            <li className="py-2">
              <EmptyState
                icon={Users}
                title="No administrators"
                compact
              />
            </li>
          )}
        </ul>
      </Card>

      <AnimatePresence>
        {confirm && (
          <DialogModal
            title={confirm.label}
            description={
              confirm.kind === 'approve' ? 'They will be able to see every account, change platform settings and manage AI providers. They are signed out everywhere and emailed.'
                : confirm.kind === 'revoke' ? 'They lose the admin portal immediately, are signed out everywhere and emailed. Their learning account stays.'
                  : 'They are emailed and can ask again after 24 hours.'
            }
            primaryAction={run}
            primaryLabel={confirm.kind === 'approve' ? 'Approve' : confirm.kind === 'revoke' ? 'Revoke access' : 'Decline'}
            primaryDanger={confirm.kind !== 'approve'}
            loading={busy}
            onClose={() => !busy && setConfirm(null)}
          >
            {confirm.kind !== 'revoke' && (
              <input aria-label="Note to the requester (optional)" placeholder="Note to the requester (optional)" maxLength={300}
                value={note} onChange={(e) => setNote(e.target.value)} className={`${fieldClass} h-10`} />
            )}
            <ErrorLine>{err}</ErrorLine>
          </DialogModal>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Request access (signed-in non-admins) ───────────────────────────────────

function RequestAccess({ user }) {
  const [state, setState] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      setState((await API.get('/api/admin-access/me')).data);
    } catch (e) {
      setErr(errOf(e, 'Could not load your access status.'));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await API.post('/api/admin-access/request', { email: user.email, reason: reason.trim() });
      setReason('');
      await load();
    } catch (e2) {
      setErr(errOf(e2, 'Could not send the request.'));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    setErr('');
    try {
      await API.delete('/api/admin-access/request');
      await load();
    } catch (e) {
      setErr(errOf(e, 'Could not cancel.'));
    } finally {
      setBusy(false);
    }
  };

  const req = state?.request;
  const pending = req?.status === 'pending';

  return (
    <div className="flex min-h-screen items-start justify-center bg-[var(--bg-primary)] px-4 py-12 font-sans text-[var(--text-primary)] sm:items-center">
      <div className="w-full max-w-md">
        <Link to="/session" className="mb-5 inline-flex items-center gap-1.5 text-[12.5px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><ArrowLeft size={14} /> Back to TutorBoard</Link>
        <section className="rounded-xl border border-[var(--st-line-strong)] bg-[var(--st-surface)] p-5 sm:p-6">
          <span className="grid h-10 w-10 place-items-center rounded-lg border border-[var(--st-line)] bg-[var(--st-fill)]"><ShieldCheck size={18} /></span>
          <h1 className="mt-4 text-[20px] font-medium tracking-[-0.02em]">Admin portal</h1>
          <p className="mt-1.5 text-[13px] text-[var(--text-secondary)]">
            Administrator access only. Submit a request for super-admin review.
          </p>

          {!state && !err && (
            <div className="mt-6 py-4 text-center text-[12.5px] text-[var(--text-tertiary)] animate-pulse">
              Checking access permissions…
            </div>
          )}

          {state && pending && (
            <div className="mt-5 rounded-lg bg-amber-500/[0.08] p-4 text-[13px]">
              <div className="font-medium text-amber-600 dark:text-amber-400">Request sent — waiting for review</div>
              <div className="mt-1 text-[12.5px] text-[var(--text-secondary)]">Asked {fmt(req.createdAt)} for {req.email}.</div>
              <Button variant="ghost" className="mt-2 h-8 px-3 text-[12px]" disabled={busy} onClick={cancel}>Cancel request</Button>
            </div>
          )}

          {state && !pending && req?.status === 'rejected' && (
            <p className="mt-5 rounded-lg bg-red-500/[0.06] p-3 text-[12.5px] text-red-500">
              Your last request was declined{req.decisionNote ? `: “${req.decisionNote}”` : '.'} You can ask again 24 hours after the decision.
            </p>
          )}
          {state && !pending && req?.status === 'revoked' && (
            <p className="mt-5 rounded-lg bg-[var(--st-fill)] p-3 text-[12.5px] text-[var(--text-secondary)]">Your admin access was removed by a super-admin.</p>
          )}

          {state && !pending && !state.emailVerified && (
            <p className="mt-5 rounded-lg bg-[var(--st-fill)] p-3 text-[12.5px] text-[var(--text-secondary)]">
              Verify your email first (Settings → Account → Verify email), then come back to request access.
            </p>
          )}

          {state && !pending && state.emailVerified && (
            <form className="mt-5 flex flex-col gap-3" onSubmit={submit}>
              <label className="flex flex-col gap-1.5 text-[12px] font-medium text-[var(--text-secondary)]">
                Your account email
                <input value={state.email} readOnly aria-readonly="true" className={`${fieldClass} h-10 cursor-not-allowed opacity-80`} />
              </label>
              <label className="flex flex-col gap-1.5 text-[12px] font-medium text-[var(--text-secondary)]">
                Why do you need access? (optional)
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={3}
                  className={`${fieldClass} h-auto resize-none rounded-lg py-2`} placeholder="e.g. I manage the AI providers for our team" />
              </label>
              <Button type="submit" disabled={busy} className="h-10">{busy ? 'Sending…' : 'Request admin access'}</Button>
            </form>
          )}
          <ErrorLine>{err}</ErrorLine>
        </section>
      </div>
    </div>
  );
}

// ─── Shell ───────────────────────────────────────────────────────────────────

export default function AdminPortal() {
  const { user, logout } = useAuth();
  const { width } = useWindowSize();
  // below 1024px the sidebar becomes a menu page of section buttons
  const compact = width < 1024;
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const isSuper = user?.role === 'superadmin';
  const tabs = TABS.filter((t) => !t.superadminOnly || isSuper);
  const readTab = () => {
    const t = new URLSearchParams(window.location.search).get('tab');
    return tabs.some((x) => x.id === t) ? t : null;
  };
  const [tab, setTab] = useState(readTab);
  const [pending, setPending] = useState(0);

  // New navbar interactive states
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const searchRef = useRef(null);
  const searchInputRef = useRef(null);
  const notifRef = useRef(null);
  const profileRef = useRef(null);
  const mainRef = useRef(null);

  // Click outside to close popovers
  useEffect(() => {
    const onClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false);
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowSearchDropdown(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Keyboard shortcut Ctrl+K / Cmd+K
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setShowSearchDropdown(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // phone back button: each opened section is a history entry above the menu
  useEffect(() => {
    const onPop = () => setTab(readTab());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isSuper) return;
    API.get('/api/admin/access/requests?status=pending').then((r) => setPending(r.data?.pending || 0)).catch(() => {});
  }, [isSuper, tab]);

  if (!isAdmin) return <RequestAccess user={user} />;

  const current = tab || (compact ? null : 'overview');
  const section = tabs.find((t) => t.id === current);

  const open = (id) => {
    if (id !== 'users') setSelectedUser(null);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', id);
    if (compact) window.history.pushState({ adminTab: id }, '', url);
    else window.history.replaceState({ adminTab: id }, '', url);
    setTab(id);
    mainRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    window.scrollTo(0, 0);
  };
  const backToMenu = () => {
    if (selectedUser) {
      setSelectedUser(null);
      return;
    }
    // opened from the menu: step back through history (keeps the phone back button consistent)
    if (window.history.state?.adminTab) {
      window.history.back();
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.delete('tab');
    window.history.replaceState({}, '', url);
    setTab(null);
    setSelectedUser(null);
  };

  const badge = (id) => (id === 'access' && pending > 0 ? (
    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10.5px] font-semibold text-black" aria-label={`${pending} waiting`}>{pending}</span>
  ) : null);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--bg-primary)] font-sans text-[var(--text-primary)]">
      {/* Top bar: Redesigned with Logo & Title on left, Breadcrumbs, Center Search, Notifications & Profile on right */}
      <header className="sticky top-0 z-30 shrink-0 border-b border-[var(--st-line)] bg-[var(--bg-primary)]/90 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between gap-2.5 px-3 sm:px-5">
          {/* LEFT: Logo & Brand + Breadcrumbs Navigation + Search Bar */}
          <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3.5">
            {/* Logo and Title */}
            <Link
              to="/session"
              className="flex shrink-0 items-center gap-2.5 transition-opacity hover:opacity-85"
              aria-label="TutorBoard Admin Home"
            >
              <VisaiLogo size="md" className="text-[var(--text-primary)]" />
              <span className="text-[15.5px] font-semibold tracking-[-0.01em]">
                TutorBoard
              </span>
            </Link>

            {/* Subtle Divider */}
            <span className="hidden h-5 w-px bg-[var(--st-line-strong)] sm:block mx-1.5 sm:mx-2.5" />

            {/* Breadcrumb Navigation: users > user X details or Admin > Section (hidden on mobile) */}
            <nav aria-label="Breadcrumbs" className="hidden sm:flex shrink-0 items-center gap-2 sm:gap-2.5 text-[12.5px] sm:text-[13px]">
              {selectedUser ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      open('users');
                      setSelectedUser(null);
                    }}
                    className="cursor-pointer text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]"
                  >
                    Users
                  </button>
                  <ChevronRight size={13} className="shrink-0 text-[var(--text-tertiary)]" />
                  <span
                    className="max-w-[120px] truncate font-medium text-[var(--text-primary)] sm:max-w-[200px]"
                    title={selectedUser.email || selectedUser.name}
                  >
                    {selectedUser.name || selectedUser.email || 'User details'}
                  </span>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => open('overview')}
                    className="cursor-pointer text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]"
                  >
                    Admin
                  </button>
                  <ChevronRight size={13} className="shrink-0 text-[var(--text-tertiary)]" />
                  <span className="truncate font-medium text-[var(--text-primary)]">
                    {section ? section.label : 'Overview'}
                  </span>
                </>
              )}
            </nav>

            {/* SEARCH BAR: Aligned on the left side right after breadcrumbs (hidden on mobile) */}
            <div className="relative hidden md:block ml-2 sm:ml-4 w-full max-w-[200px] sm:max-w-xs md:max-w-sm" ref={searchRef}>
              <div className="relative flex items-center">
                <Search size={14} className="pointer-events-none absolute left-3 text-[var(--text-tertiary)]" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSearchDropdown(true);
                  }}
                  onFocus={() => setShowSearchDropdown(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      setShowSearchDropdown(false);
                      open('users');
                      setUserSearchQuery(searchQuery.trim());
                    } else if (e.key === 'Escape') {
                      setShowSearchDropdown(false);
                    }
                  }}
                  placeholder="Search users, sections..."
                  className="h-9 w-full rounded-lg border border-[var(--st-line)] bg-[var(--st-fill)] pl-9 pr-10 text-[12px] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] transition-colors focus:border-[var(--st-line-strong)] focus:bg-[var(--st-surface)] focus:outline-none sm:text-[12.5px]"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setUserSearchQuery('');
                      setShowSearchDropdown(false);
                    }}
                    className="absolute right-2.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                  >
                    <X size={13} />
                  </button>
                ) : (
                  <div className="pointer-events-none absolute right-2.5 hidden sm:flex items-center gap-0.5 rounded border border-[var(--st-line)] px-1 py-0.5 text-[9.5px] font-mono text-[var(--text-tertiary)]">
                    <span>⌘K</span>
                  </div>
                )}
              </div>

              {/* Search Dropdown / Quick Links */}
              <AnimatePresence>
                {showSearchDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 top-11 z-50 w-full min-w-[260px] overflow-hidden rounded-lg border border-[var(--st-line-strong)] bg-[var(--st-surface)] p-1.5 shadow-2xl backdrop-blur-xl"
                  >
                    {searchQuery.trim() && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowSearchDropdown(false);
                          open('users');
                          setUserSearchQuery(searchQuery.trim());
                        }}
                        className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] text-[var(--text-primary)] hover:bg-[var(--st-fill)]"
                      >
                        <Users size={14} className="shrink-0 text-amber-500" />
                        <span className="truncate">
                          Search users for <strong className="font-semibold text-amber-500">"{searchQuery.trim()}"</strong>
                        </span>
                        <span className="ml-auto shrink-0 text-[10.5px] text-[var(--text-tertiary)]">↵ Enter</span>
                      </button>
                    )}

                    <div className="px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                      Quick Navigation
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {tabs.map((t) => {
                        const Icon = t.icon;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              open(t.id);
                              setShowSearchDropdown(false);
                            }}
                            className={`flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[12px] transition-colors ${current === t.id ? 'bg-[var(--st-fill-strong)] font-medium text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--st-fill)] hover:text-[var(--text-primary)]'}`}
                          >
                            <span className="flex items-center gap-2 truncate">
                              <Icon size={13} className="shrink-0 text-[var(--text-tertiary)]" />
                              {t.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* RIGHT: Notifications & Profile Icon */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {/* Notifications Button & Dropdown */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => {
                  setShowNotif((prev) => !prev);
                  setShowProfile(false);
                }}
                aria-label="Admin notifications"
                className="relative grid h-10 w-10 cursor-pointer place-items-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--st-fill)] hover:text-[var(--text-primary)]"
              >
                <Bell size={19} />
                {pending > 0 && (
                  <span className="absolute right-2 top-2 flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                  </span>
                )}
              </button>

              <AnimatePresence>
                {showNotif && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-12 z-50 w-72 sm:w-80 overflow-hidden rounded-xl border border-[var(--st-line-strong)] bg-[var(--st-surface)] p-3 shadow-2xl backdrop-blur-xl"
                  >
                    <div className="flex items-center justify-between border-b border-[var(--st-line)] pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-[var(--text-primary)]">Notifications</span>
                        {pending > 0 && (
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10.5px] font-bold text-amber-500">
                            {pending} new
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowNotif(false)}
                        className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <div className="mt-2.5 flex flex-col gap-2">
                      {pending > 0 ? (
                        <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-[12.5px] font-medium text-amber-600 dark:text-amber-400">
                                Admin Access Requests
                              </div>
                              <div className="mt-0.5 text-[11.5px] text-[var(--text-secondary)]">
                                {pending} request{pending > 1 ? 's' : ''} awaiting approval
                              </div>
                            </div>
                            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-amber-500" />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setShowNotif(false);
                              open('access');
                            }}
                            className="mt-2.5 inline-flex w-full cursor-pointer items-center justify-center rounded-lg bg-amber-500 px-3 py-1.5 text-[11.5px] font-semibold text-black transition-opacity hover:opacity-90"
                          >
                            Review Requests
                          </button>
                        </div>
                      ) : (
                        <div className="rounded-lg bg-[var(--st-fill)] p-3 text-center">
                          <CheckCircle2 size={18} className="mx-auto mb-1 text-emerald-500" />
                          <div className="text-[12.5px] font-medium text-[var(--text-primary)]">All clear</div>
                          <div className="text-[11px] text-[var(--text-tertiary)]">No pending admin requests</div>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setShowNotif(false);
                          open('providers');
                        }}
                        className="flex cursor-pointer items-center justify-between rounded-lg p-2.5 text-left text-[12px] transition-colors hover:bg-[var(--st-fill)]"
                      >
                        <div className="flex items-center gap-2">
                          <Cpu size={14} className="text-[var(--text-tertiary)]" />
                          <span>AI Providers & Models</span>
                        </div>
                        <Pill tone="ok">online</Pill>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowNotif(false);
                          open('audit');
                        }}
                        className="flex cursor-pointer items-center justify-between rounded-lg p-2.5 text-left text-[12px] transition-colors hover:bg-[var(--st-fill)]"
                      >
                        <div className="flex items-center gap-2">
                          <ScrollText size={14} className="text-[var(--text-tertiary)]" />
                          <span>Security & Audit Log</span>
                        </div>
                        <ChevronRight size={13} className="text-[var(--text-tertiary)]" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Profile Button & Dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => {
                  setShowProfile((prev) => !prev);
                  setShowNotif(false);
                }}
                aria-label="Admin profile menu"
                className="flex cursor-pointer items-center gap-2 rounded-full p-0.5 transition-colors hover:bg-[var(--st-fill)]"
              >
                <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-[var(--st-line-strong)] bg-[var(--st-fill-strong)] text-[13px] font-semibold text-[var(--text-primary)]">
                  {user?.avatar ? (
                    <img src={user.avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <User size={18} className="text-[var(--text-secondary)]" />
                  )}
                </div>
              </button>

              <AnimatePresence>
                {showProfile && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-xl border border-[var(--st-line-strong)] bg-[var(--st-surface)] p-2 shadow-2xl backdrop-blur-xl"
                  >
                    <div className="border-b border-[var(--st-line)] px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--st-line-strong)] bg-[var(--st-fill-strong)] text-[var(--text-primary)]">
                          {user?.avatar ? (
                            <img src={user.avatar} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <User size={16} className="text-[var(--text-secondary)]" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13.5px] font-semibold text-[var(--text-primary)]">
                            {user?.name || user?.email}
                          </div>
                          <div className="truncate text-[11.5px] text-[var(--text-tertiary)]">{user?.email}</div>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-1.5 text-[11.5px] font-medium text-white">
                        <span className="font-bold text-amber-500">|</span>
                        <span>{isSuper ? 'Super Admin' : 'Admin'}</span>
                      </div>
                    </div>

                    <div className="mt-1.5 flex flex-col gap-0.5">
                      <Link
                        to="/session"
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12.5px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--st-fill)] hover:text-white"
                      >
                        <ArrowLeft size={14} className="text-[var(--text-tertiary)]" />
                        <span>Exit Admin Portal</span>
                      </Link>

                      <button
                        type="button"
                        onClick={() => {
                          setShowProfile(false);
                          open('settings');
                        }}
                        className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[12.5px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--st-fill)] hover:text-[var(--text-primary)]"
                      >
                        <SlidersHorizontal size={14} className="text-[var(--text-tertiary)]" />
                        <span>Platform Settings</span>
                      </button>

                      {isSuper && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowProfile(false);
                            open('access');
                          }}
                          className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[12.5px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--st-fill)] hover:text-[var(--text-primary)]"
                        >
                          <ShieldCheck size={14} className="text-[var(--text-tertiary)]" />
                          <span>Admin Access</span>
                          {pending > 0 && (
                            <span className="ml-auto inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9.5px] font-bold text-black">
                              {pending}
                            </span>
                          )}
                        </button>
                      )}

                      <div className="my-1 h-px bg-[var(--st-line)]" />

                      <button
                        type="button"
                        onClick={() => {
                          setShowProfile(false);
                          logout();
                        }}
                        className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[12.5px] text-red-500 transition-colors hover:bg-red-500/10"
                      >
                        <LogOut size={14} />
                        <span>Sign out</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar (desktop) */}
        {!compact && (
          <aside className="flex h-full w-64 shrink-0 flex-col border-r border-[var(--st-line)] px-3 py-4 overflow-y-auto">
            <p className="px-3 pb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Manage</p>
            <nav aria-label="Admin sections" className="flex flex-col gap-1">
              {tabs.map(({ id, label, icon: Icon }) => {
                const active = current === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => open(id)}
                    aria-current={active ? 'page' : undefined}
                    className={`group relative flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13px] transition-colors duration-200 ${
                      active ? 'font-medium text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {active && (
                      <motion.div
                        layoutId="adminSidebarActivePill"
                        className="absolute inset-0 rounded-lg bg-[var(--st-fill-strong)] border border-[var(--st-line-strong)]"
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      />
                    )}
                    <span className="relative z-10 flex w-full items-center gap-2.5">
                      <Icon
                        size={15}
                        className={`shrink-0 transition-colors duration-200 ${
                          active ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]'
                        }`}
                      />
                      <span className="flex-1 truncate">{label}</span>
                      {badge(id)}
                    </span>
                  </button>
                );
              })}
            </nav>
            <div className="mt-auto px-1 pt-3">
              <div className="truncate text-[12.5px] font-medium text-white">{user.email}</div>
              <div className="mt-1 flex items-center gap-1.5 text-[11.5px] font-medium text-white">
                <span className="font-bold text-amber-500">|</span>
                <span>{isSuper ? 'Super Admin' : 'Admin'}</span>
              </div>
              <Link
                to="/session"
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 text-[12.5px] font-semibold !text-black text-black shadow-sm transition-opacity hover:opacity-90 active:scale-[0.99]"
                style={{ color: '#000000' }}
              >
                <ArrowLeft size={14} className="!text-black text-black" style={{ color: '#000000' }} />
                <span className="!text-black text-black font-semibold" style={{ color: '#000000' }}>Exit Admin Portal</span>
              </Link>
            </div>
          </aside>
        )}

        <main
          ref={mainRef}
          className={`min-w-0 flex-1 ${current === 'audit' || current === 'diagnostics' || current === 'settings' || current === 'users' ? 'flex flex-col h-full overflow-hidden p-3.5 sm:p-5' : 'overflow-y-auto p-3.5 sm:p-5'}`}
          style={current === 'audit' || current === 'diagnostics' || current === 'settings' || current === 'users' ? { height: '100%', display: 'flex', flexDirection: 'column' } : undefined}
          aria-label={section ? section.label : 'Admin menu'}
        >
          <AnimatePresence mode="wait" initial={false}>
            {/* Menu (phone/tablet): one button per section */}
            {compact && !section ? (
              <motion.div
                key="compact-menu"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="mx-auto max-w-xl"
              >
                <div className="mb-3.5 flex items-center gap-4 rounded-xl border border-[var(--st-line)] bg-[var(--st-surface)] p-4 sm:p-5">
                  <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--st-line-strong)] bg-[var(--st-fill-strong)] text-[var(--text-primary)]">
                    {user?.avatar ? (
                      <img src={user.avatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <User size={24} className="text-[var(--text-secondary)]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] sm:text-[16px] font-semibold text-white">{user.email}</div>
                    <div className="mt-1 flex items-center gap-1.5 text-[12.5px] font-medium text-white">
                      <span className="font-bold text-amber-500 text-[14px]">|</span>
                      <span>{isSuper ? 'Super Admin' : 'Admin'}</span>
                    </div>
                  </div>
                </div>
                <nav aria-label="Admin sections" className="overflow-hidden rounded-xl border border-[var(--st-line)] bg-[var(--st-surface)]">
                  {tabs.map(({ id, label, icon: Icon }, i) => (
                    <button key={id} type="button" onClick={() => open(id)}
                      className={`flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-[var(--st-fill)] active:bg-[var(--st-fill-strong)] ${i ? 'border-t border-[var(--st-line)]' : ''}`}>
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[var(--st-line)] bg-[var(--st-fill)]"><Icon size={15} /></span>
                      <span className="min-w-0 flex-1 text-[13px] font-medium text-[var(--text-primary)]">{label}</span>
                      {badge(id)}
                      <ChevronRight size={14} className="shrink-0 text-[var(--text-tertiary)]" />
                    </button>
                  ))}
                </nav>
                <div className="mt-3 flex justify-end">
                  <Link
                    to="/session"
                    className="inline-flex items-center justify-end gap-2 rounded-full bg-white px-4 py-2.5 text-[12.5px] font-semibold !text-black text-black shadow-sm transition-opacity hover:opacity-90 active:scale-[0.99]"
                    style={{ color: '#000000' }}
                  >
                    <ArrowLeft size={14} className="!text-black text-black" style={{ color: '#000000' }} />
                    <span className="!text-black text-black font-semibold" style={{ color: '#000000' }}>Exit Admin Portal</span>
                  </Link>
                </div>
              </motion.div>
            ) : section ? (
              <motion.div
                key={current}
                initial={{ opacity: 0, y: 8, scale: 0.998 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.998 }}
                className={current === 'audit' || current === 'diagnostics' || current === 'settings' || current === 'users' ? 'w-full h-full flex-1 flex flex-col min-h-0' : 'mx-auto max-w-6xl w-full'}
                style={current === 'audit' || current === 'diagnostics' || current === 'settings' || current === 'users' ? { height: '100%', display: 'flex', flexDirection: 'column', flex: 1 } : undefined}
              >
                {compact && (
                  <div className="mb-3.5 flex shrink-0 items-center justify-between gap-3 lg:hidden">
                    <button
                      type="button"
                      onClick={backToMenu}
                      aria-label="Back to sections"
                      className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--st-line)] bg-[var(--st-surface)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--st-fill)] hover:text-[var(--text-primary)] active:scale-95 cursor-pointer"
                    >
                      <ArrowLeft size={16} />
                    </button>
                    <h1 className="text-[14.5px] font-semibold text-[var(--text-primary)] truncate text-center flex-1">
                      {section?.label || 'Admin'}
                    </h1>
                    <div className="w-9 shrink-0" aria-hidden="true" />
                  </div>
                )}
                {current === 'overview' && <Overview open={open} />}
                {current === 'users' && <UsersTab me={user} selectedUser={selectedUser} onSelectUser={setSelectedUser} externalQuery={userSearchQuery} compact={compact} />}
                {current === 'providers' && <ProvidersTab />}
                {current === 'settings' && <SettingsTab />}
                {current === 'audit' && <AuditTab />}
                {current === 'diagnostics' && <DiagnosticsTab />}
                {current === 'access' && isSuper && <AccessTab me={user} />}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
