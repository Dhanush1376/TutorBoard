import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import useTutorStore from '../../store/tutorStore';
import {
  ChevronRight, X, Minus, Plus, Check, Lock
} from 'lucide-react';

import VisaiLogo from '../layout/VisaiLogo';
import useWindowSize from '../../hooks/useWindowSize';

// Domain Components
import GeneralSection from './GeneralSection';
import AccountSection from './AccountSection';
import AppearanceSection from './AppearanceSection';
import APIConfigSection from './api-config/APIConfigSection';
import AboutSection from './AboutSection';
import { useSettingsSync, SECTIONS } from './SettingsShared';

const SettingsModal = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const { mode } = useTheme();
  const { 
    isSettingsMinimized, setSettingsMinimized,
    isExplainMinimized, isVisualizerMinimized,
    layoutView, settingsActiveSection, setSettingsActiveSection,
    showToast
  } = useTutorStore();
  
  const { isMobile } = useWindowSize();
  const activeSection = settingsActiveSection;
  const setActiveSection = setSettingsActiveSection;
  const isGuest = !!user?.isGuest;
  const GUEST_BLOCKED_SECTIONS = ['account', 'ai'];
  const [isTrafficHovered, setIsTrafficHovered] = useState(false);
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
          style={{ fontFamily: '"Outfit", "Inter", sans-serif' }}
        >
          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ 
              opacity: isSettingsMinimized ? 0 : 1,
              backdropFilter: isSettingsMinimized ? 'blur(0px)' : 'blur(24px)'
            }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className={`fixed inset-0 bg-black/60 dark:bg-black/75 ${isSettingsMinimized ? 'pointer-events-none' : 'pointer-events-auto'}`}
            style={{ zIndex: -1 }}
            onClick={onClose}
          />

          <motion.div
            layout
            initial={{ 
              scale: 0.9, 
              opacity: 0, 
              y: 20,
              filter: 'blur(20px)',
              transformPerspective: 1200,
              rotateX: 2
            }}
            animate={
              isSettingsMinimized ? {
                position: 'fixed',
                top: 'auto',
                bottom: `${bottomOffset}px`,
                left: layoutView === 'right' ? '24px' : 'auto',
                right: layoutView === 'right' ? 'auto' : '24px',
                width: '180px',
                height: '44px',
                borderRadius: '22px',
                filter: 'blur(0px)',
                rotateX: 0,
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
                filter: 'blur(0px)',
                rotateX: 0,
                x: 0, y: 0, scale: 1, opacity: 1,
              } : {
                position: 'relative',
                width: 'min(840px, 95vw)',
                height: 'min(640px, 90vh)',
                borderRadius: '24px',
                filter: 'blur(0px)',
                rotateX: 0,
                x: 0, y: 0, scale: 1, opacity: 1,
              }
            }
            exit={{ 
              scale: 0.98, 
              opacity: 0,
              y: 10,
              filter: 'blur(10px)',
              transition: { duration: 0.2, ease: "easeIn" }
            }}
            transition={{ 
              type: 'spring', 
              damping: 35, 
              stiffness: 380,
              mass: 0.6,
              layout: { duration: 0.4, ease: [0.16, 1, 0.3, 1] }
            }}
            className="pointer-events-auto flex flex-col overflow-hidden"
            style={{
              background: isSettingsMinimized ? (mode === 'dark' ? 'rgba(30, 30, 33, 0.7)' : 'rgba(255, 255, 255, 0.7)') : 'var(--bg-primary)',
              backdropFilter: 'blur(30px)',
              WebkitBackdropFilter: 'blur(30px)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              boxShadow: isSettingsMinimized ? '0 12px 40px rgba(0,0,0,0.3)' : '0 60px 120px rgba(0,0,0,0.5)',
              cursor: isSettingsMinimized ? 'pointer' : 'default',
              zIndex: 100000,
            }}
            whileHover={isSettingsMinimized ? { y: -6, scale: 1.04, background: mode === 'dark' ? 'rgba(45, 45, 48, 0.9)' : 'rgba(255, 255, 255, 0.9)' } : {}}
            onClick={() => { if (isSettingsMinimized) setSettingsMinimized(false); }}
          >
            {isSettingsMinimized ? (
              <div style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                padding: '0 20px',
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: '-0.01em'
              }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <VisaiLogo size="xxs" style={{ color: 'var(--accent-primary)' }} />
                  <div style={{
                    position: 'absolute',
                    width: 14, height: 14,
                    borderRadius: '50%',
                    background: 'var(--accent-primary)',
                    opacity: 0.4,
                    filter: 'blur(6px)',
                    animation: 'tb-pulse 2s infinite'
                  }} />
                </div>
                <span style={{ color: 'var(--text-primary)', opacity: 0.9 }}>SETTINGS</span>
                <style>{`@keyframes tb-pulse { 0% { opacity: 0.2; scale: 0.9; } 50% { opacity: 0.6; scale: 1.4; } 100% { opacity: 0.2; scale: 0.9; } }`}</style>
              </div>
            ) : (
              <>
                {/* Traffic Light Header — macOS Style Refinement */}
                <div style={{ 
                  height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                  padding: '0 24px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', 
                  zIndex: 20, flexShrink: 0 
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
                    <div 
                      onMouseEnter={() => setIsTrafficHovered(true)} 
                      onMouseLeave={() => setIsTrafficHovered(false)} 
                      style={{ display: 'flex', gap: 8 }}
                    >
                      {[
                        { color: '#ff5f57', action: (e) => { e.stopPropagation(); onClose(); }, icon: <X size={7} strokeWidth={4} /> },
                        { color: '#febc2e', action: (e) => { e.stopPropagation(); setSettingsMinimized(true); }, icon: <Minus size={8} strokeWidth={4} /> },
                        { color: '#28c840', action: (e) => { e.stopPropagation(); setIsMaximized(!isMaximized); }, icon: isMaximized ? <Minus size={8} strokeWidth={4} style={{ transform: 'rotate(90deg)' }} /> : <Plus size={7} strokeWidth={4} /> },
                      ].map((btn, i) => (
                        <button 
                          key={i} 
                          onClick={btn.action} 
                          style={{ 
                            width: 13, height: 13, borderRadius: '50%', background: btn.color, border: 'none', 
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                            color: 'rgba(0,0,0,0.6)', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: `inset 0 0 0 0.5px rgba(0,0,0,0.15)`
                          }}
                        >
                          {isTrafficHovered && btn.icon}
                        </button>
                      ))}
                    </div>
                    <div style={{ width: 1, height: 18, background: 'var(--border-color)', opacity: 0.4 }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <VisaiLogo size="xxs" />
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, letterSpacing: '0.01em' }}>Settings — TutorBoard AI</span>
                    </div>
                  </div>
                </div>

                {/* Navigation Bar — Premium Segmented Style */}
                <div style={{ 
                  height: 48, background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)', 
                  display: 'flex', justifyContent: 'center', gap: 4, overflowX: 'auto', flexShrink: 0,
                  padding: '0 20px', position: 'relative' 
                }} className="no-scrollbar">
                  {SECTIONS.map(tab => {
                    const isTabActive = activeSection === tab.id;
                    const isBlocked = isGuest && GUEST_BLOCKED_SECTIONS.includes(tab.id);
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
                          padding: '0 20px', background: 'transparent', border: 'none', 
                          color: isBlocked ? 'var(--text-tertiary)' : (isTabActive ? 'var(--accent-primary)' : 'var(--text-tertiary)'), 
                          fontSize: 13, fontWeight: isTabActive ? 600 : 400, cursor: isBlocked ? 'not-allowed' : 'pointer', 
                          display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
                          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                          position: 'relative',
                          opacity: isBlocked ? 0.4 : 1,
                        }}
                      >
                        {isBlocked ? (
                          <Lock size={14} strokeWidth={1.5} style={{ opacity: 0.7 }} />
                        ) : (
                          <tab.icon size={14} strokeWidth={isTabActive ? 2.5 : 1.5} style={{ opacity: isTabActive ? 1 : 0.7 }} />
                        )}
                        {tab.label}
                        {isTabActive && !isBlocked && (
                          <motion.div 
                            layoutId="settings-active-tab"
                            style={{ 
                              position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, 
                              background: 'var(--accent-primary)',
                              boxShadow: '0 -4px 10px var(--accent-primary)44',
                              borderRadius: '2px 2px 0 0'
                            }} 
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Content Area — Refined Spacing */}
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
                  <div ref={contentRef} style={{ flex: 1, overflowY: 'auto', padding: '32px 24px 40px 24px' }} className="no-scrollbar">
                    <AnimatePresence mode="wait">
                      <motion.div 
                        key={activeSection} 
                        initial={{ opacity: 0, x: -10 }} 
                        animate={{ opacity: 1, x: 0 }} 
                        exit={{ opacity: 0, x: 10 }} 
                        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }} 
                        style={{ maxWidth: '840px', margin: '0 auto' }}
                      >
                        {renderSection()}
                      </motion.div>
                    </AnimatePresence>
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
