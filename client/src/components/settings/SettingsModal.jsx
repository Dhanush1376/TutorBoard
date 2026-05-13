import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/useTheme';
import useTutorStore from '../../store/tutorStore';
import {
  ChevronRight, X, Minus, Plus, Check, Lock, Maximize2, Minimize2
} from 'lucide-react';

import VisaiLogo from '../layout/VisaiLogo';
import useWindowSize from '../../hooks/useWindowSize';

// Domain Components
import GeneralSection from './GeneralSection';
import AccountSection from './AccountSection';
import AppearanceSection from './AppearanceSection';
import APIConfigSection from './api-config/APIConfigSection';
import AboutSection from './AboutSection';
import { useSettingsSync } from './SettingsShared';
import { SECTIONS } from './SettingsConstants';

const SettingsModal = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const { mode } = useTheme();
  const store = useTutorStore();
  const { 
    isSettingsMinimized = false, setSettingsMinimized, // Defensive fallback
    isExplainMinimized, isVisualizerMinimized,
    layoutView, settingsActiveSection, setSettingsActiveSection,
    showToast
  } = store;
  
  const { isMobile } = useWindowSize();
  const activeSection = settingsActiveSection;
  const setActiveSection = setSettingsActiveSection;
  const isGuest = !!user?.isGuest;
  const GUEST_BLOCKED_SECTIONS = ['account', 'ai'];
  const [isMaximized, setIsMaximized] = useState(false);
  const contentRef = useRef(null);
  const syncSettings = useSettingsSync();

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [activeSection]);

  const renderSection = () => {
    const sectionMap = {
      general: <GeneralSection user={user} syncSettings={syncSettings} showToast={showToast} />,
      account: <AccountSection user={user} logout={logout} syncSettings={syncSettings} showToast={showToast} />,
      appearance: <AppearanceSection syncSettings={syncSettings} />,
      ai: <APIConfigSection showToast={showToast} />,
      about: <AboutSection />,
    };

    return sectionMap[activeSection] || sectionMap.general;
  };

  // Stack minimization logic
  let bottomOffset = 80;
  if (isSettingsMinimized) {
    if (isExplainMinimized && isVisualizerMinimized) bottomOffset = 180;
    else if (isExplainMinimized || isVisualizerMinimized) bottomOffset = 130;
  }

  const isActuallyOpen = isOpen || isSettingsMinimized;

  return createPortal(
    <AnimatePresence>
      {isActuallyOpen && (
        <div 
          className={`fixed inset-0 z-[6000] pointer-events-none ${(!isSettingsMinimized && !isMaximized) ? 'flex items-center justify-center' : ''}`}
          style={{ fontFamily: '"Inter", sans-serif' }}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: isSettingsMinimized ? 0 : 1,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className={`fixed inset-0 ${isSettingsMinimized ? 'pointer-events-none' : 'pointer-events-auto'}`}
            style={{ 
              background: mode === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.3)',
              backdropFilter: isSettingsMinimized ? 'none' : 'blur(12px)',
              WebkitBackdropFilter: isSettingsMinimized ? 'none' : 'blur(12px)',
              zIndex: -1,
            }}
            onClick={() => {
              if (isSettingsMinimized) return;
              setSettingsMinimized(false);
              onClose();
            }}
          />

          <motion.div
            layout
            initial={{ 
              scale: 0.96, 
              opacity: 0, 
              y: 12,
            }}
            animate={
              isSettingsMinimized ? {
                position: 'fixed',
                top: 'auto',
                bottom: `${bottomOffset}px`,
                left: layoutView === 'right' ? '24px' : 'auto',
                right: layoutView === 'right' ? 'auto' : '24px',
                width: '160px',
                height: '40px',
                borderRadius: '20px',
                x: 0, y: 0, scale: 1, opacity: 1,
              } : (isMaximized || isMobile) ? {
                position: 'fixed',
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
                width: '100vw',
                height: '100vh',
                borderRadius: '0px',
                x: 0, y: 0, scale: 1, opacity: 1,
              } : {
                position: 'relative',
                width: 'min(780px, 92vw)',
                height: 'min(580px, 85vh)',
                borderRadius: '20px',
                x: 0, y: 0, scale: 1, opacity: 1,
              }
            }
            exit={{ 
              scale: 0.98, 
              opacity: 0,
              y: 8,
              transition: { duration: 0.15 }
            }}
            transition={{ 
              type: 'spring', 
              damping: 30, 
              stiffness: 350,
              mass: 0.5,
              layout: { duration: 0.35 }
            }}
            className="pointer-events-auto flex flex-col overflow-hidden"
            style={{
              background: isSettingsMinimized 
                ? (mode === 'dark' ? 'rgba(25, 25, 28, 0.8)' : 'rgba(255, 255, 255, 0.8)') 
                : 'var(--bg-primary)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              color: 'var(--text-primary)',
              border: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
              boxShadow: isSettingsMinimized 
                ? '0 8px 30px rgba(0,0,0,0.2)' 
                : '0 24px 80px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.05)',
              cursor: isSettingsMinimized ? 'pointer' : 'default',
              zIndex: 100000,
            }}
            whileHover={isSettingsMinimized ? { y: -4, scale: 1.03 } : {}}
            onClick={() => { if (isSettingsMinimized) setSettingsMinimized(false); }}
          >
            {isSettingsMinimized ? (
              <div style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '0 16px',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--text-tertiary)',
              }}>
                <VisaiLogo size="xxs" />
                <span>Settings</span>
              </div>
            ) : (
              <>
                {/* ── Header ── */}
                <div style={{ 
                  height: '48px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  padding: '0 20px',
                  borderBottom: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  flexShrink: 0,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ 
                      fontSize: 13, 
                      fontWeight: 600, 
                      color: 'var(--text-primary)', 
                      letterSpacing: '-0.01em' 
                    }}>
                      Settings
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setIsMaximized(!isMaximized); }}
                      className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all"
                      title={isMaximized ? "Restore" : "Maximize"}
                    >
                      {isMaximized ? <Minimize2 size={14} strokeWidth={2} /> : <Maximize2 size={14} strokeWidth={2} />}
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setSettingsMinimized(true); }}
                      className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all"
                    >
                      <Minus size={14} strokeWidth={2} />
                    </button>
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setSettingsMinimized(false); 
                        onClose(); 
                      }}
                      className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-all"
                    >
                      <X size={14} strokeWidth={2} />
                    </button>
                  </div>
                </div>

                {/* ── Content: Sidebar + Main ── */}
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                  
                  {/* Sidebar Nav */}
                  <div style={{ 
                    width: isMobile ? '100%' : '200px', 
                    flexShrink: 0,
                    borderRight: isMobile ? 'none' : `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                    padding: '12px 8px',
                    display: 'flex',
                    flexDirection: isMobile ? 'row' : 'column',
                    gap: 2,
                    overflowX: isMobile ? 'auto' : 'visible',
                  }} className="no-scrollbar">
                    {SECTIONS.map(tab => {
                      const isTabActive = activeSection === tab.id;
                      const isBlocked = isGuest && GUEST_BLOCKED_SECTIONS.includes(tab.id);
                      const Icon = isBlocked ? Lock : tab.icon;
                      return (
                        <button 
                          key={tab.id} 
                          onClick={() => {
                            if (isBlocked) {
                              showToast({ message: `"${tab.label}" requires a free account.`, type: 'info' });
                              return;
                            }
                            setActiveSection(tab.id);
                          }} 
                          style={{ 
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: isMobile ? '8px 14px' : '8px 12px',
                            background: isTabActive ? (mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') : 'transparent',
                            border: 'none',
                            borderRadius: '10px',
                            color: isBlocked 
                              ? 'var(--text-tertiary)' 
                              : isTabActive 
                                ? 'var(--text-primary)' 
                                : 'var(--text-secondary)',
                            fontSize: 13,
                            fontWeight: isTabActive ? 500 : 400,
                            cursor: isBlocked ? 'not-allowed' : 'pointer',
                            transition: 'all 0.15s ease',
                            opacity: isBlocked ? 0.45 : 1,
                            whiteSpace: 'nowrap',
                            width: isMobile ? 'auto' : '100%',
                            textAlign: 'left',
                          }}
                        >
                          <Icon 
                            size={15} 
                            strokeWidth={isTabActive ? 2.2 : 1.8} 
                            style={{ opacity: isTabActive ? 1 : 0.6, flexShrink: 0 }} 
                          />
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div 
                      ref={contentRef} 
                      style={{ 
                        flex: 1, 
                        overflowY: 'auto', 
                        padding: isMobile ? '20px 16px 32px' : '28px 28px 40px',
                        display: (isMaximized && !isMobile) ? 'flex' : 'block',
                        flexDirection: 'column',
                        alignItems: 'center',
                      }} 
                      className="no-scrollbar"
                    >
                      <AnimatePresence mode="wait">
                        <motion.div 
                          key={activeSection} 
                          initial={{ opacity: 0, y: 6 }} 
                          animate={{ opacity: 1, y: 0 }} 
                          exit={{ opacity: 0, y: -6 }} 
                          transition={{ duration: 0.15 }} 
                          style={{ 
                            width: '100%',
                            maxWidth: isMaximized ? '720px' : '600px',
                            margin: (isMaximized && !isMobile) ? '0 auto' : '0'
                          }}
                        >
                          {renderSection()}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default SettingsModal;
