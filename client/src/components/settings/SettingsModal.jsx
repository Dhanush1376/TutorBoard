import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import useTutorStore from '../../store/tutorStore';
import {
  ChevronRight, X, Minus, Plus, Check
} from 'lucide-react';

import VisaiLogo from '../layout/VisaiLogo';

// Domain Components
import GeneralSection from './GeneralSection';
import AccountSection from './AccountSection';
import AppearanceSection from './AppearanceSection';
import APIConfigSection from './api-config/APIConfigSection';
import AboutSection from './AboutSection';
import { useSettingsSync, SECTIONS, SectionWrapper } from './SettingsShared';

const SettingsModal = ({ isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const { mode } = useTheme();
  const { 
    isSettingsMinimized, setSettingsMinimized,
    isExplainMinimized, isVisualizerMinimized,
    layoutView, settingsActiveSection, setSettingsActiveSection
  } = useTutorStore();
  
  const activeSection = settingsActiveSection;
  const setActiveSection = setSettingsActiveSection;
  const [isTrafficHovered, setIsTrafficHovered] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [toast, setToast] = useState(null);
  const contentRef = useRef(null);
  const syncSettings = useSettingsSync();
 
  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

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
          style={{ fontFamily: '"Geist", sans-serif' }}
        >
          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: isSettingsMinimized ? 0 : 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 bg-black/65 ${isSettingsMinimized ? 'pointer-events-none' : 'backdrop-blur-2xl pointer-events-auto'}`}
            style={{ zIndex: -1 }}
            onClick={onClose}
          />

          <motion.div
            layout
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
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
                x: 0, y: 0, scale: 1, opacity: 1,
              } : isMaximized ? {
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
                width: 'min(1040px, 95vw)',
                height: 'min(820px, 90vh)',
                borderRadius: '32px',
                x: 0, y: 0, scale: 1, opacity: 1,
              }
            }
            exit={{ 
              scale: 0.95, 
              opacity: 0,
              y: 20,
              transition: { duration: 0.2, ease: "easeOut" }
            }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
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
                fontWeight: 700,
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
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.01em' }}>Settings — TutorBoard AI</span>
                    </div>
                  </div>
                </div>

                {/* Navigation Bar — Premium Segmented Style */}
                <div style={{ 
                  height: 48, background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)', 
                  display: 'flex', justifyContent: 'center', gap: 4, overflowX: 'auto', flexShrink: 0,
                  padding: '0 20px', position: 'relative' 
                }} className="no-scrollbar">
                  {SECTIONS.filter(tab => !user?.isGuest || ['appearance', 'about', 'ai'].includes(tab.id)).map(tab => {
                    const isTabActive = activeSection === tab.id;
                    return (
                      <button 
                        key={tab.id} 
                        onClick={() => setActiveSection(tab.id)} 
                        style={{ 
                          padding: '0 20px', background: 'transparent', border: 'none', 
                          color: isTabActive ? 'var(--accent-primary)' : 'var(--text-tertiary)', 
                          fontSize: 13, fontWeight: isTabActive ? 700 : 500, cursor: 'pointer', 
                          display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
                          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                          position: 'relative'
                        }}
                      >
                        <tab.icon size={14} strokeWidth={isTabActive ? 3 : 2} style={{ opacity: isTabActive ? 1 : 0.7 }} />
                        {tab.label}
                        {isTabActive && (
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
                  <div ref={contentRef} style={{ flex: 1, overflowY: 'auto', padding: '48px 32px 180px 32px' }} className="no-scrollbar">
                    <AnimatePresence mode="wait">
                      <motion.div 
                        key={activeSection} 
                        initial={{ opacity: 0, x: -10 }} 
                        animate={{ opacity: 1, x: 0 }} 
                        exit={{ opacity: 0, x: 10 }} 
                        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }} 
                        style={{ maxWidth: '840px', margin: '0 auto' }}
                      >
                        <SectionWrapper isGuest={user?.isGuest} isRestricted={!['appearance', 'about', 'ai'].includes(activeSection)} onUnlock={onClose}>
                          {renderSection()}
                        </SectionWrapper>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>

                {/* Premium Toast Feedback */}
                <AnimatePresence>
                  {toast && (
                    <motion.div 
                      initial={{ opacity: 0, y: 30, scale: 0.9 }} 
                      animate={{ opacity: 1, y: 0, scale: 1 }} 
                      exit={{ opacity: 0, y: 30, scale: 0.9 }}
                      className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-xl border border-white/10"
                      style={{ 
                        background: toast.type === 'error' ? 'rgba(239, 68, 68, 0.9)' : toast.type === 'success' ? 'rgba(16, 185, 129, 0.9)' : 'rgba(59, 130, 246, 0.9)',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
                      }}
                    >
                      {toast.type === 'success' && <Check size={16} strokeWidth={4} className="text-white" />}
                      <span className="text-sm font-bold text-white letter-spacing-[-0.01em] uppercase">{toast.message}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
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
