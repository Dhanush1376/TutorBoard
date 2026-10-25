import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import useTutorStore from '../../store/tutorStore';
import { Lock, ChevronLeft, ChevronRight } from 'lucide-react';
import WindowControls from '../common/WindowControls';

import VisaiLogo from '../layout/VisaiLogo';
import useWindowSize from '../../hooks/useWindowSize';

import GeneralSection from './GeneralSection';
import AccountSection from './AccountSection';
import AppearanceSection from './AppearanceSection';
import APIConfigSection from './api-config/APIConfigSection';
import AboutSection from './AboutSection';
import { useSettingsSync, Avatar } from './SettingsShared';
import { SECTIONS } from './SettingsConstants';

const EASE = [0.22, 1, 0.36, 1];
const GUEST_BLOCKED_SECTIONS = [];

/** A coloured, rounded tile with the section's icon, like a phone's settings list. */
export function SectionTile({ section, size = 28, locked }) {
  const Icon = locked ? Lock : section.icon;
  return (
    <span
      className="grid shrink-0 place-items-center text-white"
      style={{ width: size, height: size, borderRadius: size * 0.28, background: locked ? '#8e8e93' : section.tint }}
    >
      <Icon size={size * 0.55} strokeWidth={2} />
    </span>
  );
}

const SettingsModal = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const {
    settingsActiveSection,
    setSettingsActiveSection,
    showToast,
  } = useTutorStore();

  const { isMobile } = useWindowSize();
  const activeId = SECTIONS.some((s) => s.id === settingsActiveSection) ? settingsActiveSection : 'general';
  const active = SECTIONS.find((s) => s.id === activeId);
  const isGuest = !!user?.isGuest;
  const [isMaximized, setIsMaximized] = useState(false);
  const [phonePage, setPhonePage] = useState(null); // phones: null = the list of sections
  const contentRef = useRef(null);
  const syncSettings = useSettingsSync();

  const isActuallyOpen = isOpen;
  const close = () => {
    setPhonePage(null);
    onClose();
  };

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [activeId, phonePage]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape' || document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      if (isMobile && phonePage) setPhonePage(null);
      else close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isMobile, phonePage]);

  const blocked = (id) => isGuest && GUEST_BLOCKED_SECTIONS.includes(id);
  const pick = (tab) => {
    if (blocked(tab.id)) {
      showToast({ message: `Sign up free to use ${tab.label}.`, type: 'info' });
      return;
    }
    setSettingsActiveSection(tab.id);
    if (isMobile) setPhonePage(tab.id);
  };

  const sections = {
    general: <GeneralSection user={user} syncSettings={syncSettings} showToast={showToast} />,
    account: <AccountSection user={user} logout={logout} syncSettings={syncSettings} showToast={showToast} />,
    appearance: <AppearanceSection syncSettings={syncSettings} />,
    ai: <APIConfigSection showToast={showToast} />,
    about: <AboutSection />,
  };

  const full = isMaximized || isMobile;

  /* ── Phone: list of sections, then one page at a time ───────────── */
  const phone = (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--bg-primary)]">
      <AnimatePresence initial={false} mode="popLayout">
        {!phonePage ? (
          <motion.div
            key="list"
            initial={{ x: '-20%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-20%', opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="flex min-h-0 flex-1 flex-col"
          >
            {/* Sheet grabber */}
            <div className="flex justify-center pt-2.5 pb-1 shrink-0">
              <span className="h-1 w-9 rounded-full bg-[var(--text-tertiary)]/30" />
            </div>

            {/* Header */}
            <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-1">
              <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">Settings</h2>
              <WindowControls onClose={close} />
            </div>
            <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),24px)] pt-2">
              {/* Who you are */}
              <button
                type="button"
                onClick={() => pick(SECTIONS[0])}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl bg-[var(--st-surface)] p-2.5 text-left ring-1 ring-[var(--st-line-strong)] transition-all hover:ring-[var(--text-tertiary)] active:scale-[0.99]"
              >
                <Avatar user={user} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-medium tracking-[-0.015em]">{user?.name || 'Guest'}</div>
                  <div className="truncate text-[11.5px] text-[var(--text-tertiary)]">{isGuest ? 'Not signed in' : user?.email}</div>
                </div>
                <ChevronRight size={16} className="text-[var(--text-tertiary)]" />
              </button>

              {/* Sections */}
              <div className="mt-4 overflow-hidden rounded-xl bg-[var(--st-surface)] ring-1 ring-[var(--st-line-strong)]">
                {SECTIONS.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => pick(s)}
                    className="flex w-full cursor-pointer items-center gap-3 pl-3 text-left transition-colors active:bg-[var(--st-fill-strong)]"
                  >
                    <SectionTile section={s} size={28} locked={blocked(s.id)} />
                    <span className={`flex min-h-[46px] flex-1 items-center gap-2 pr-3.5 ${i ? 'border-t border-[var(--st-line)]' : ''}`}>
                      <span className={`flex-1 text-[14px] tracking-[-0.01em] ${blocked(s.id) ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]'}`}>{s.label}</span>
                      {blocked(s.id) && <span className="text-[12px] text-[var(--text-tertiary)]">Sign up</span>}
                      <ChevronRight size={16} className="text-[var(--text-tertiary)]" />
                    </span>
                  </button>
                ))}
              </div>

              <div className="mt-7 flex items-center justify-center gap-2 text-[12px] text-[var(--text-tertiary)]">
                <VisaiLogo size={13} className="text-[var(--text-tertiary)]" />
                TutorBoard 2.1
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={`page-${phonePage}`}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.28, ease: EASE }}
            className="absolute inset-0 flex flex-col bg-[var(--bg-primary)]"
          >
            {/* Sheet grabber */}
            <div className="flex justify-center pt-2 pb-0.5 shrink-0 bg-[var(--bg-primary)]">
              <span className="h-1 w-9 rounded-full bg-[var(--text-tertiary)]/30" />
            </div>

            {/* Navigation Bar */}
            <div className="relative flex h-12 shrink-0 items-center justify-between border-b border-[var(--st-line)] bg-[var(--bg-primary)]/85 px-3.5 backdrop-blur-xl">
              {/* Back button */}
              <button
                type="button"
                onClick={() => setPhonePage(null)}
                className="group z-10 inline-flex h-8 items-center gap-1 rounded-full border border-[var(--st-line-strong)] bg-[var(--st-fill)] pl-1.5 pr-3 text-[13px] font-medium text-[var(--text-secondary)] shadow-sm transition-all hover:bg-[var(--st-fill-strong)] hover:text-[var(--text-primary)] active:scale-95"
              >
                <ChevronLeft size={16} strokeWidth={2.4} className="text-[var(--text-tertiary)] transition-transform group-hover:-translate-x-0.5 group-hover:text-[var(--text-primary)]" />
                <span>Settings</span>
              </button>

              {/* Absolutely centered Title */}
              <div className="pointer-events-none absolute inset-x-0 flex items-center justify-center px-24">
                <h2 className="truncate text-[15.5px] font-semibold tracking-[-0.015em] text-[var(--text-primary)]">
                  {active.title}
                </h2>
              </div>

              {/* Close button */}
              <div className="z-10 flex items-center">
                <WindowControls onClose={close} />
              </div>
            </div>

            {/* Subpage content */}
            <div ref={contentRef} className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),28px)] pt-3">
              {sections[activeId]}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  /* ── Desktop: sidebar of sections + the open page ────────────────── */
  const desktop = (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-[232px] shrink-0 flex-col border-r border-[var(--st-line)] bg-[var(--st-fill)] px-3 pb-4 pt-5">
        <div className="px-2.5 text-[20px] font-semibold tracking-[-0.03em]">Settings</div>

        <button
          type="button"
          onClick={() => pick(SECTIONS[0])}
          className="mt-3.5 flex cursor-pointer items-center gap-2.5 rounded-xl bg-[var(--bg-primary)] p-2 text-left ring-1 ring-[var(--st-line)] transition-shadow hover:ring-[var(--st-line-strong)]"
        >
          <Avatar user={user} size={28} />
          <div className="min-w-0">
            <div className="truncate text-[12.5px] font-medium tracking-[-0.01em]">{user?.name || 'Guest'}</div>
            <div className="truncate text-[11px] text-[var(--text-tertiary)]">{isGuest ? 'Not signed in' : user?.email}</div>
          </div>
        </button>

        <nav aria-label="Settings sections" className="mt-4 flex flex-col gap-0.5">
          {SECTIONS.map((s) => {
            const on = activeId === s.id;
            return (
              <button
                key={s.id}
                type="button"
                aria-current={on ? 'page' : undefined}
                onClick={() => pick(s)}
                className={`flex h-11 cursor-pointer items-center gap-3 rounded-xl px-2 text-left text-[14px] tracking-[-0.01em] transition-colors ${
                  on
                    ? 'bg-[var(--bg-primary)] font-medium text-[var(--text-primary)] shadow-[0_1px_2px_rgba(0,0,0,0.06),0_0_0_1px_var(--st-line)]'
                    : blocked(s.id)
                      ? 'text-[var(--text-tertiary)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--st-fill-strong)] hover:text-[var(--text-primary)]'
                }`}
              >
                <SectionTile section={s} size={26} locked={blocked(s.id)} />
                <span className="flex-1 truncate">{s.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto flex items-center gap-2 px-2.5 text-[12px] text-[var(--text-tertiary)]">
          <VisaiLogo size={14} className="text-[var(--text-tertiary)]" />
          TutorBoard 2.1
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-4 px-8 pb-3.5 pt-5">
          <h2 className="text-[19px] font-semibold leading-none tracking-[-0.02em]">{active.title}</h2>
          <WindowControls
            onMaximize={() => setIsMaximized((m) => !m)}
            maximized={isMaximized}
            onClose={close}
          />
        </header>

        <div ref={contentRef} className="thin-scrollbar min-h-0 flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: EASE }}
              className={`mx-auto w-full px-8 pb-10 pt-2 ${isMaximized ? 'max-w-[760px]' : 'max-w-[680px]'}`}
            >
              {sections[activeId]}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );

  return createPortal(
    <AnimatePresence>
      {isActuallyOpen && (
        <div
          className={`pointer-events-none fixed inset-0 z-[6000] font-sans ${!full ? 'flex items-center justify-center p-4' : ''}`}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 -z-10 bg-black/40 backdrop-blur-[6px] dark:bg-black/60 pointer-events-auto"
            onClick={close}
          />

          <motion.div
            layout
            role="dialog"
            aria-label="Settings"
            initial={isMobile ? { y: '100%', opacity: 1 } : { scale: 0.97, opacity: 0, y: 14 }}
            animate={
              full
                ? { position: 'fixed', top: 0, bottom: 0, left: 0, right: 0, width: '100vw', height: '100dvh', borderRadius: '0px', x: 0, y: 0, scale: 1, opacity: 1 }
                : { position: 'relative', width: 'min(940px, 100%)', height: 'min(660px, 100%)', borderRadius: '24px', x: 0, y: 0, scale: 1, opacity: 1 }
            }
            exit={isMobile ? { y: '100%', transition: { duration: 0.28, ease: EASE } } : { scale: 0.98, opacity: 0, y: 8, transition: { duration: 0.18 } }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 32,
              mass: 0.8,
              layout: { type: 'spring', stiffness: 300, damping: 32, mass: 0.8 },
            }}
            className={`pointer-events-auto flex flex-col overflow-hidden border text-[var(--text-primary)] bg-[var(--bg-primary)] ${
              full ? 'border-transparent' : 'border-[var(--st-line-strong)] shadow-[0_50px_120px_-40px_rgba(0,0,0,0.55)]'
            }`}
            style={{ zIndex: 100000 }}
          >
            {isMobile ? phone : desktop}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default SettingsModal;
