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
const GUEST_BLOCKED_SECTIONS = ['account', 'ai'];

/** A coloured, rounded tile with the section's icon, like a phone's settings list. */
export function SectionTile({ section, size = 30, locked }) {
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
    isSettingsMinimized = false,
    setSettingsMinimized,
    isExplainMinimized,
    isVisualizerMinimized,
    layoutView,
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

  const isActuallyOpen = isOpen || isSettingsMinimized;
  const close = () => {
    setSettingsMinimized(false);
    setPhonePage(null);
    onClose();
  };

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [activeId, phonePage]);

  useEffect(() => {
    if (!isOpen || isSettingsMinimized) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape' || document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      if (isMobile && phonePage) setPhonePage(null);
      else close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isSettingsMinimized, isMobile, phonePage]);

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

  // Minimised pills stack above each other.
  let bottomOffset = 80;
  if (isSettingsMinimized) {
    if (isExplainMinimized && isVisualizerMinimized) bottomOffset = 180;
    else if (isExplainMinimized || isVisualizerMinimized) bottomOffset = 130;
  }

  const full = isMaximized || isMobile;

  /* ── Phone: list of sections, then one page at a time ───────────── */
  const phone = (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <AnimatePresence initial={false} mode="popLayout">
        {!phonePage ? (
          <motion.div
            key="list"
            initial={{ x: '-25%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-25%', opacity: 0 }}
            transition={{ duration: 0.32, ease: EASE }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-[max(env(safe-area-inset-top),14px)]">
              <h2 className="text-[30px] font-semibold tracking-[-0.03em]">Settings</h2>
              <WindowControls onClose={close} />
            </div>
            <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),24px)] pt-3">
              {/* Who you are */}
              <button
                type="button"
                onClick={() => pick(SECTIONS[0])}
                className="flex w-full cursor-pointer items-center gap-3.5 rounded-2xl bg-[var(--st-surface)] p-3.5 text-left ring-1 ring-[var(--st-line-strong)] active:scale-[0.99]"
              >
                <Avatar user={user} size={52} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[18px] font-medium tracking-[-0.02em]">{user?.name || 'Guest'}</div>
                  <div className="truncate text-[13.5px] text-[var(--text-tertiary)]">{isGuest ? 'Not signed in' : user?.email}</div>
                </div>
                <ChevronRight size={20} className="text-[var(--text-tertiary)]" />
              </button>

              {/* Sections */}
              <div className="mt-6 overflow-hidden rounded-2xl bg-[var(--st-surface)] ring-1 ring-[var(--st-line-strong)]">
                {SECTIONS.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => pick(s)}
                    className="flex w-full cursor-pointer items-center gap-3.5 pl-3.5 text-left active:bg-[var(--st-fill-strong)]"
                  >
                    <SectionTile section={s} locked={blocked(s.id)} />
                    <span className={`flex min-h-[54px] flex-1 items-center gap-2 pr-3.5 ${i ? 'border-t border-[var(--st-line)]' : ''}`}>
                      <span className={`flex-1 text-[16.5px] tracking-[-0.01em] ${blocked(s.id) ? 'text-[var(--text-tertiary)]' : ''}`}>{s.label}</span>
                      {blocked(s.id) && <span className="text-[13px] text-[var(--text-tertiary)]">Sign up</span>}
                      <ChevronRight size={18} className="text-[var(--text-tertiary)]" />
                    </span>
                  </button>
                ))}
              </div>

              <div className="mt-8 flex items-center justify-center gap-2 text-[12.5px] text-[var(--text-tertiary)]">
                <VisaiLogo size={14} className="text-[var(--text-tertiary)]" />
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
            transition={{ duration: 0.32, ease: EASE }}
            className="absolute inset-0 flex flex-col bg-[var(--bg-primary)]"
          >
            <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-[var(--st-line)] px-2 pb-2 pt-[max(env(safe-area-inset-top),10px)]">
              <button
                type="button"
                onClick={() => setPhonePage(null)}
                className="flex h-10 w-fit cursor-pointer items-center gap-0.5 rounded-full pl-1 pr-3 text-[16px] text-[var(--text-primary)] active:opacity-60"
              >
                <ChevronLeft size={24} strokeWidth={2} />
                Settings
              </button>
              <h2 className="text-[16.5px] font-semibold tracking-[-0.01em]">{active.title}</h2>
              <div className="justify-self-end">
                <WindowControls onClose={close} />
              </div>
            </div>
            <div ref={contentRef} className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),28px)] pt-5">
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
          className="mt-4 flex cursor-pointer items-center gap-3 rounded-2xl bg-[var(--bg-primary)] p-2.5 text-left ring-1 ring-[var(--st-line)] transition-shadow hover:ring-[var(--st-line-strong)]"
        >
          <Avatar user={user} size={36} />
          <div className="min-w-0">
            <div className="truncate text-[13.5px] font-medium tracking-[-0.01em]">{user?.name || 'Guest'}</div>
            <div className="truncate text-[12px] text-[var(--text-tertiary)]">{isGuest ? 'Not signed in' : user?.email}</div>
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
        <header className="flex shrink-0 items-center justify-between gap-4 px-8 pb-4 pt-6">
          <h2 className="text-[26px] font-semibold leading-none tracking-[-0.035em]">{active.title}</h2>
          <WindowControls
            onMinimize={() => setSettingsMinimized(true)}
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
          className={`pointer-events-none fixed inset-0 z-[6000] font-sans ${!isSettingsMinimized && !full ? 'flex items-center justify-center p-4' : ''}`}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: isSettingsMinimized ? 0 : 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className={`fixed inset-0 -z-10 bg-black/40 backdrop-blur-[6px] dark:bg-black/60 ${isSettingsMinimized ? 'pointer-events-none' : 'pointer-events-auto'}`}
            onClick={() => !isSettingsMinimized && close()}
          />

          <motion.div
            layout
            role={isSettingsMinimized ? 'button' : 'dialog'}
            aria-label="Settings"
            initial={isMobile ? { y: '100%', opacity: 1 } : { scale: 0.97, opacity: 0, y: 14 }}
            animate={
              isSettingsMinimized
                ? {
                    position: 'fixed',
                    top: 'auto',
                    bottom: `${bottomOffset}px`,
                    left: layoutView === 'right' ? '24px' : 'auto',
                    right: layoutView === 'right' ? 'auto' : '24px',
                    width: '148px',
                    height: '40px',
                    borderRadius: '20px',
                    x: 0, y: 0, scale: 1, opacity: 1,
                  }
                : full
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
            className={`pointer-events-auto flex flex-col overflow-hidden border text-[var(--text-primary)] ${
              isSettingsMinimized
                ? 'cursor-pointer border-[var(--st-line-strong)] bg-[var(--bg-primary)]/85 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.35)] backdrop-blur-xl'
                : `bg-[var(--bg-primary)] ${full ? 'border-transparent' : 'border-[var(--st-line-strong)] shadow-[0_50px_120px_-40px_rgba(0,0,0,0.55)]'}`
            }`}
            style={{ zIndex: 100000 }}
            whileHover={isSettingsMinimized ? { y: -3 } : {}}
            onClick={() => isSettingsMinimized && setSettingsMinimized(false)}
          >
            {isSettingsMinimized ? (
              <div className="flex h-full items-center justify-center gap-2 px-4 text-[13px] font-medium tracking-[-0.01em]">
                <VisaiLogo size="xxs" className="text-[var(--text-primary)]" />
                Settings
              </div>
            ) : isMobile ? (
              phone
            ) : (
              desktop
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default SettingsModal;
