import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import useTutorStore from '../../store/tutorStore';
import {
  ChevronRight, X, Minus
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
    layoutView
  } = useTutorStore();
  
  const [activeSection, setActiveSection] = useState('general');
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
      account: <AccountSection user={user} logout={logout} syncSettings={syncSettings} />,
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
            className={`fixed inset-0 bg-black/60 ${isSettingsMinimized ? 'pointer-events-none' : 'backdrop-blur-xl pointer-events-auto'}`}
            style={{ zIndex: -1 }}
            onClick={onClose}
          />

          <motion.div
            layout
            initial={{ scale: 0.9, opacity: 0 }}
            animate={
              isSettingsMinimized ? {
                position: 'fixed',
                top: 'auto',
                bottom: `${bottomOffset}px`,
                left: layoutView === 'right' ? '24px' : 'auto',
                right: layoutView === 'right' ? 'auto' : '24px',
                width: '190px',
                height: '40px',
                borderRadius: '20px',
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
                width: 'min(1000px, 95vw)',
                height: 'min(800px, 90vh)',
                borderRadius: '24px',
                x: 0, y: 0, scale: 1, opacity: 1,
              }
            }
            exit={{ 
              scale: 0.95, 
              opacity: 0,
              y: 10,
              transition: { duration: 0.2, ease: "easeOut" }
            }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="pointer-events-auto flex flex-col overflow-hidden"
            style={{
              background: isSettingsMinimized ? (mode === 'dark' ? 'rgba(30, 30, 33, 0.8)' : 'rgba(255, 255, 255, 0.8)') : 'var(--bg-primary)',
              backdropFilter: isSettingsMinimized ? 'blur(20px)' : 'none',
              WebkitBackdropFilter: isSettingsMinimized ? 'blur(20px)' : 'none',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              boxShadow: isSettingsMinimized ? '0 8px 32px rgba(0,0,0,0.2)' : '0 40px 100px rgba(0,0,0,0.4)',
              cursor: isSettingsMinimized ? 'pointer' : 'default',
              zIndex: 100000,
            }}
            whileHover={isSettingsMinimized ? { y: -4, scale: 1.02, background: mode === 'dark' ? 'rgba(45, 45, 48, 0.9)' : 'rgba(255, 255, 255, 0.9)' } : {}}
            onClick={() => { if (isSettingsMinimized) setSettingsMinimized(false); }}
          >
            {isSettingsMinimized ? (
              <div style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                padding: '0 16px',
                fontSize: 12,
                fontWeight: 400,
                letterSpacing: '0.01em'
              }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <VisaiLogo size="xxs" style={{ color: '#febc2e' }} />
                  <div style={{
                    position: 'absolute',
                    width: 10, height: 10,
                    borderRadius: '50%',
                    background: '#febc2e',
                    opacity: 0.3,
                    filter: 'blur(4px)',
                    animation: 'pulse 2s infinite'
                  }} />
                </div>
                <span style={{ color: 'var(--text-primary)', opacity: 0.9 }}>Settings</span>
                <style>{`@keyframes pulse { 0% { opacity: 0.2; scale: 0.9; } 50% { opacity: 0.5; scale: 1.2; } 100% { opacity: 0.2; scale: 0.9; } }`}</style>
              </div>
            ) : (
              <>
                {/* Top Bar */}
                <div style={{ height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', zIndex: 10, flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                    <div onMouseEnter={() => setIsTrafficHovered(true)} onMouseLeave={() => setIsTrafficHovered(false)} style={{ display: 'flex', gap: 6 }}>
                      {[
                        { color: '#ff5f57', action: (e) => { e.stopPropagation(); onClose(); }, icon: <X size={7} /> },
                        { color: '#febc2e', action: (e) => { e.stopPropagation(); setSettingsMinimized(true); }, icon: <Minus size={8} /> },
                        { color: '#28c840', action: (e) => { e.stopPropagation(); setIsMaximized(!isMaximized); }, icon: isMaximized ? <Minus size={8} style={{ transform: 'rotate(90deg)' }} /> : <X size={7} style={{ transform: 'rotate(45deg)' }} /> },
                      ].map((btn, i) => (
                        <button 
                          key={i} 
                          onClick={btn.action} 
                          style={{ 
                            width: 12, height: 12, borderRadius: '50%', background: btn.color, border: 'none', 
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                            color: 'rgba(0,0,0,0.5)', transition: 'all 0.15s',
                            boxShadow: `0 0 0 0.5px rgba(0,0,0,0.2)`
                          }}
                        >
                          {isTrafficHovered && btn.icon}
                        </button>
                      ))}
                    </div>
                    <div style={{ width: 1, height: 16, background: 'var(--border-color)', opacity: 0.3 }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <VisaiLogo size="xxs" />
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400 }}>Settings — TutorBoard</span>
                    </div>
                  </div>
                </div>

                {/* Tab Bar */}
                <div style={{ height: 38, background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'center', gap: 2, overflowX: 'auto', flexShrink: 0 }} className="no-scrollbar">
                  {SECTIONS.filter(tab => !user?.isGuest || ['appearance', 'about', 'ai'].includes(tab.id)).map(tab => {
                    const isTabActive = activeSection === tab.id;
                    return (
                      <button key={tab.id} onClick={() => setActiveSection(tab.id)} style={{ padding: '0 16px', background: isTabActive ? 'var(--bg-primary)' : 'transparent', border: 'none', borderTop: isTabActive ? '2px solid var(--accent-primary)' : '2px solid transparent', color: isTabActive ? 'var(--text-primary)' : 'var(--text-tertiary)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                        <tab.icon style={{ width: '12px', height: '12px', opacity: isTabActive ? 1 : 0.6 }} />{tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* Content Area */}
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
                  <div ref={contentRef} style={{ flex: 1, overflowY: 'auto', padding: '40px 24px 160px 24px' }} className="no-scrollbar">
                    <AnimatePresence mode="wait">
                      <motion.div key={activeSection} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.15 }} style={{ maxWidth: '800px', margin: '0 auto' }}>
                        <SectionWrapper isGuest={user?.isGuest} isRestricted={!['appearance', 'about', 'ai'].includes(activeSection)} onUnlock={onClose}>
                          {renderSection()}
                        </SectionWrapper>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>

                {/* Toast */}
                <AnimatePresence>
                  {toast && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                      className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 text-white"
                      style={{ background: toast.type === 'error' ? '#ef4444' : toast.type === 'success' ? '#10b981' : '#3b82f6' }}>
                      <span className="text-xs font-normal">{toast.message}</span>
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
